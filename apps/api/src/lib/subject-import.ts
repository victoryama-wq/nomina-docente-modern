import { createHash } from 'node:crypto';
import { parseString } from '@fast-csv/parse';
import type { PoolClient } from 'pg';

export const SUBJECT_IMPORT_MAX_BYTES = 512 * 1024;
export const SUBJECT_IMPORT_MAX_ROWS = 5_000;
export const SUBJECT_IMPORT_HEADERS = ['id', 'clave', 'nombre', 'estatus'] as const;

export type SubjectImportStatus = 'ACTIVO' | 'INACTIVO';
export type SubjectImportClassification =
  | 'NUEVA'
  | 'ACTUALIZAR_CLAVE'
  | 'ACTUALIZAR_NOMBRE'
  | 'ACTUALIZAR_ESTATUS'
  | 'ACTUALIZAR_MULTIPLE'
  | 'SIN_CAMBIOS'
  | 'INACTIVAR'
  | 'DUPLICADO_CLAVE_CSV'
  | 'DUPLICADO_NOMBRE_CSV'
  | 'POSIBLE_DUPLICADO_NOMBRE'
  | 'ID_NO_EXISTE'
  | 'ID_CLAVE_INCOMPATIBLE'
  | 'CLAVE_EXISTENTE_NOMBRE_INCOMPATIBLE'
  | 'INACTIVACION_CON_USO_OPERATIVO'
  | 'CAMPO_OBLIGATORIO_FALTANTE'
  | 'ESTATUS_INVALIDO'
  | 'ERROR';

export interface SubjectImportCsvRow {
  line: number;
  id: string | null;
  officialCode: string | null;
  name: string;
  status: SubjectImportStatus | null;
}

export interface SubjectImportPreviewRow extends SubjectImportCsvRow {
  classification: SubjectImportClassification;
  blocking: boolean;
  existingSubjectId: string | null;
  expectedCurrent: {
    officialCode: string | null;
    name: string;
    status: SubjectImportStatus;
  } | null;
  changes: Array<'officialCode' | 'name' | 'status'>;
  message: string;
}

export interface SubjectImportPreview {
  fileSha256: string;
  catalogFingerprint: string;
  totalRows: number;
  summary: Record<SubjectImportClassification, number>;
  hasBlockingErrors: boolean;
  rows: SubjectImportPreviewRow[];
}

interface SubjectCatalogRow {
  id: string;
  officialCode: string | null;
  name: string;
  normalizedName: string;
  status: SubjectImportStatus;
  activeScheduleCount: number;
}

function httpError(message: string, statusCode = 400): Error & { statusCode: number } {
  return Object.assign(new Error(message), { statusCode });
}

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function decodeUtf8(buffer: Buffer): string {
  if (buffer.byteLength > SUBJECT_IMPORT_MAX_BYTES) {
    throw httpError(`El CSV excede el limite de ${SUBJECT_IMPORT_MAX_BYTES / 1024} KiB.`);
  }

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer).replace(/^\uFEFF/, '');
  } catch {
    throw httpError('El archivo debe estar codificado en UTF-8 valido.');
  }
}

function parseCsvArrays(csvText: string): Promise<string[][]> {
  return new Promise((resolve, reject) => {
    const rows: string[][] = [];
    parseString<string[], string[]>(csvText, { headers: false, ignoreEmpty: false, trim: false })
      .on('error', (error) => reject(httpError(`CSV invalido: ${error.message}`)))
      .on('data', (row: string[]) => rows.push(row.map((cell) => String(cell))))
      .on('end', () => resolve(rows));
  });
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase();
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizedCode(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed.toUpperCase() : null;
}

async function parseSubjectCsv(buffer: Buffer): Promise<{ fileSha256: string; rows: SubjectImportCsvRow[] }> {
  const csvText = decodeUtf8(buffer);
  const parsed = (await parseCsvArrays(csvText)).filter((row) => row.some((cell) => cell.trim() !== ''));
  if (parsed.length === 0) throw httpError('El CSV esta vacio.');

  const headers = parsed[0].map(normalizeHeader);
  if (
    headers.length !== SUBJECT_IMPORT_HEADERS.length ||
    headers.some((header, index) => header !== SUBJECT_IMPORT_HEADERS[index])
  ) {
    throw httpError(`Encabezados requeridos y en orden: ${SUBJECT_IMPORT_HEADERS.join(', ')}.`);
  }

  const dataRows = parsed.slice(1);
  if (dataRows.length > SUBJECT_IMPORT_MAX_ROWS) {
    throw httpError(`El CSV excede el limite de ${SUBJECT_IMPORT_MAX_ROWS} filas.`);
  }

  return {
    fileSha256: sha256(buffer),
    rows: dataRows.map((cells, index) => {
      if (cells.length !== SUBJECT_IMPORT_HEADERS.length) {
        return { line: index + 2, id: null, officialCode: null, name: '', status: null };
      }
      const statusText = cells[3].trim().toUpperCase();
      return {
        line: index + 2,
        id: cells[0].trim() || null,
        officialCode: normalizedCode(cells[1]),
        name: cells[2].trim().replace(/\s+/g, ' '),
        status: statusText === 'ACTIVO' || statusText === 'INACTIVO' ? statusText : null
      };
    })
  };
}

async function loadCatalog(client: PoolClient, lock: boolean): Promise<SubjectCatalogRow[]> {
  if (lock) {
    await client.query('SELECT id FROM subjects ORDER BY id FOR UPDATE');
  }
  const result = await client.query<SubjectCatalogRow>(
    `
      SELECT
        s.id,
        s.official_code AS "officialCode",
        s.name,
        s.normalized_name AS "normalizedName",
        s.status,
        count(sc.id) FILTER (WHERE ac.status IN ('ACTIVO', 'PLANEACION'))::int AS "activeScheduleCount"
      FROM subjects s
      LEFT JOIN schedules sc ON sc.subject_id = s.id
      LEFT JOIN academic_cycles ac ON ac.id = sc.cycle_id
      GROUP BY s.id
      ORDER BY s.id
    `
  );
  return result.rows;
}

function catalogFingerprint(subjects: SubjectCatalogRow[]): string {
  return sha256(
    JSON.stringify(
      subjects.map((subject) => [
        subject.id,
        subject.officialCode,
        subject.name,
        subject.normalizedName,
        subject.status,
        subject.activeScheduleCount
      ])
    )
  );
}

async function normalizeNames(client: PoolClient, names: string[]): Promise<string[]> {
  if (names.length === 0) return [];
  const result = await client.query<{ normalized: string }>(
    'SELECT normalize_subject_search(value) AS normalized FROM unnest($1::text[]) AS value',
    [names]
  );
  return result.rows.map((row) => row.normalized);
}

function emptySummary(): Record<SubjectImportClassification, number> {
  return {
    NUEVA: 0,
    ACTUALIZAR_CLAVE: 0,
    ACTUALIZAR_NOMBRE: 0,
    ACTUALIZAR_ESTATUS: 0,
    ACTUALIZAR_MULTIPLE: 0,
    SIN_CAMBIOS: 0,
    INACTIVAR: 0,
    DUPLICADO_CLAVE_CSV: 0,
    DUPLICADO_NOMBRE_CSV: 0,
    POSIBLE_DUPLICADO_NOMBRE: 0,
    ID_NO_EXISTE: 0,
    ID_CLAVE_INCOMPATIBLE: 0,
    CLAVE_EXISTENTE_NOMBRE_INCOMPATIBLE: 0,
    INACTIVACION_CON_USO_OPERATIVO: 0,
    CAMPO_OBLIGATORIO_FALTANTE: 0,
    ESTATUS_INVALIDO: 0,
    ERROR: 0
  };
}

function blockingRow(
  row: SubjectImportCsvRow,
  classification: SubjectImportClassification,
  message: string,
  existing: SubjectCatalogRow | null = null
): SubjectImportPreviewRow {
  return {
    ...row,
    classification,
    blocking: true,
    existingSubjectId: existing?.id || null,
    expectedCurrent: existing
      ? { officialCode: existing.officialCode, name: existing.name, status: existing.status }
      : null,
    changes: [],
    message
  };
}

export async function buildSubjectImportPreview(
  client: PoolClient,
  buffer: Buffer,
  options: { lockCatalog?: boolean } = {}
): Promise<SubjectImportPreview> {
  const parsed = await parseSubjectCsv(buffer);
  const subjects = await loadCatalog(client, options.lockCatalog === true);
  const normalizedNames = await normalizeNames(client, parsed.rows.map((row) => row.name));
  const byId = new Map(subjects.map((subject) => [subject.id.toLowerCase(), subject]));
  const byCode = new Map(
    subjects.filter((subject) => subject.officialCode).map((subject) => [subject.officialCode!.toUpperCase(), subject])
  );
  const byNormalized = new Map<string, SubjectCatalogRow[]>();
  subjects.forEach((subject) => {
    const matches = byNormalized.get(subject.normalizedName) || [];
    matches.push(subject);
    byNormalized.set(subject.normalizedName, matches);
  });

  const idCounts = new Map<string, number>();
  const codeCounts = new Map<string, number>();
  const nameCounts = new Map<string, number>();
  parsed.rows.forEach((row, index) => {
    if (row.id) idCounts.set(row.id.toLowerCase(), (idCounts.get(row.id.toLowerCase()) || 0) + 1);
    if (row.officialCode) codeCounts.set(row.officialCode, (codeCounts.get(row.officialCode) || 0) + 1);
    const normalizedName = normalizedNames[index];
    if (normalizedName) nameCounts.set(normalizedName, (nameCounts.get(normalizedName) || 0) + 1);
  });

  const rows = parsed.rows.map<SubjectImportPreviewRow>((row, index) => {
    const normalizedName = normalizedNames[index] || '';
    if (!row.name) {
      return blockingRow(row, 'CAMPO_OBLIGATORIO_FALTANTE', 'El nombre es obligatorio.');
    }
    if (row.name.length > 160 || (row.id !== null && !isUuid(row.id))) {
      return blockingRow(row, 'ERROR', 'El ID o la longitud del nombre no es valida.');
    }
    if (!row.status) {
      return blockingRow(row, 'ESTATUS_INVALIDO', 'El estatus debe ser ACTIVO o INACTIVO.');
    }
    if (row.officialCode && (row.officialCode.length > 50 || !/^[A-Z0-9][A-Z0-9._/-]*$/.test(row.officialCode))) {
      return blockingRow(row, 'ERROR', 'La clave debe usar mayusculas, numeros, punto, guion o diagonal.');
    }
    if (row.id && (idCounts.get(row.id.toLowerCase()) || 0) > 1) {
      return blockingRow(row, 'ERROR', 'El CSV repite el mismo ID.');
    }
    if (row.officialCode && (codeCounts.get(row.officialCode) || 0) > 1) {
      return blockingRow(row, 'DUPLICADO_CLAVE_CSV', 'El CSV repite la misma clave.');
    }
    if ((nameCounts.get(normalizedName) || 0) > 1) {
      return blockingRow(row, 'DUPLICADO_NOMBRE_CSV', 'El CSV repite el mismo nombre normalizado.');
    }

    const subjectById = row.id ? byId.get(row.id.toLowerCase()) || null : null;
    const subjectByCode = row.officialCode ? byCode.get(row.officialCode) || null : null;
    if (row.id && !subjectById) {
      return blockingRow(row, 'ID_NO_EXISTE', 'El ID indicado no existe; las altas nuevas deben dejar ID vacio.');
    }
    if (subjectById && subjectByCode && subjectById.id !== subjectByCode.id) {
      return blockingRow(row, 'ID_CLAVE_INCOMPATIBLE', 'El ID y la clave pertenecen a asignaturas distintas.');
    }

    const existing = subjectById || subjectByCode;
    if (!existing) {
      if (!row.officialCode) {
        return blockingRow(row, 'CAMPO_OBLIGATORIO_FALTANTE', 'La clave es obligatoria para nuevas asignaturas.');
      }
      if ((byNormalized.get(normalizedName) || []).length > 0) {
        return blockingRow(row, 'POSIBLE_DUPLICADO_NOMBRE', 'Ya existe una asignatura con nombre normalizado equivalente.');
      }
      return {
        ...row,
        classification: 'NUEVA',
        blocking: false,
        existingSubjectId: null,
        expectedCurrent: null,
        changes: ['officialCode', 'name', 'status'],
        message: 'Alta nueva lista para aplicar.'
      };
    }

    if (normalizedName !== existing.normalizedName) {
      return blockingRow(
        row,
        'CLAVE_EXISTENTE_NOMBRE_INCOMPATIBLE',
        'La clave existente tiene un nombre normalizado diferente.',
        existing
      );
    }
    const normalizedMatches = (byNormalized.get(normalizedName) || []).filter((subject) => subject.id !== existing.id);
    if (normalizedMatches.length > 0) {
      return blockingRow(row, 'POSIBLE_DUPLICADO_NOMBRE', 'El nombre normalizado colisiona con otra asignatura.', existing);
    }
    if (row.status === 'INACTIVO' && existing.status === 'ACTIVO' && existing.activeScheduleCount > 0) {
      return blockingRow(
        row,
        'INACTIVACION_CON_USO_OPERATIVO',
        `La asignatura tiene ${existing.activeScheduleCount} horario(s) en ciclo activo o planeacion.`,
        existing
      );
    }

    const changes: Array<'officialCode' | 'name' | 'status'> = [];
    if (row.officialCode && existing.officialCode !== row.officialCode) changes.push('officialCode');
    if (existing.name !== row.name) changes.push('name');
    if (existing.status !== row.status) changes.push('status');
    return {
      ...row,
      classification:
        changes.length === 0
          ? 'SIN_CAMBIOS'
          : changes.length > 1
            ? 'ACTUALIZAR_MULTIPLE'
            : changes[0] === 'officialCode'
              ? 'ACTUALIZAR_CLAVE'
              : changes[0] === 'name'
                ? 'ACTUALIZAR_NOMBRE'
                : row.status === 'INACTIVO'
                  ? 'INACTIVAR'
                  : 'ACTUALIZAR_ESTATUS',
      blocking: false,
      existingSubjectId: existing.id,
      expectedCurrent: { officialCode: existing.officialCode, name: existing.name, status: existing.status },
      changes,
      message: changes.length ? `Cambios: ${changes.join(', ')}.` : 'Sin cambios.'
    };
  });

  const summary = emptySummary();
  rows.forEach((row) => {
    summary[row.classification] += 1;
  });
  return {
    fileSha256: parsed.fileSha256,
    catalogFingerprint: catalogFingerprint(subjects),
    totalRows: rows.length,
    summary,
    hasBlockingErrors: rows.some((row) => row.blocking),
    rows
  };
}

export function subjectImportBuffer(base64Data: string): Buffer {
  if (!base64Data || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64Data.replace(/\s+/g, ''))) {
    throw httpError('Contenido base64 invalido.');
  }
  return Buffer.from(base64Data.replace(/\s+/g, ''), 'base64');
}
