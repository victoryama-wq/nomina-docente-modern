import { createHash } from 'node:crypto';
import path from 'node:path';
import { parseString } from '@fast-csv/parse';
import type { PoolClient } from 'pg';
import { normalizeTeacherExternalIdentifierKey } from './teacher-identifiers.js';
import {
  buildTeacherFullName,
  normalizeTeacherComparableName,
  normalizeTeacherNameComponent,
  normalizeTeacherText
} from './teacher-names.js';
import type { SessionUser } from '../types.js';

export const TEACHER_IMPORT_MAX_BYTES = 1024 * 1024;
export const TEACHER_IMPORT_MAX_ROWS = 5_000;
export const TEACHER_IMPORT_HEADERS = [
  'id',
  'identificador',
  'nombres',
  'apellido_paterno',
  'apellido_materno',
  'responsable_operativo_email',
  'categoria',
  'telefono',
  'ubicacion',
  'estatus'
] as const;

export const TEACHER_IMPORT_RISK_ACTIONS = [
  'REASIGNAR_RESPONSABLE_OPERATIVO',
  'INACTIVAR',
  'ACTUALIZAR_CATEGORIA',
  'ACTUALIZAR_NOMBRE',
  'ACTUALIZAR_MULTIPLE'
] as const;

export type TeacherImportRiskAction = (typeof TEACHER_IMPORT_RISK_ACTIONS)[number];
export type TeacherImportStatus = 'ACTIVO' | 'INACTIVO';
export type TeacherImportCategory = 'V' | 'M' | 'N';
export type TeacherImportAction =
  | 'NUEVO'
  | 'ACTUALIZAR_IDENTIFICADOR'
  | 'ACTUALIZAR_NOMBRE'
  | 'ACTUALIZAR_RESPONSABLE_OPERATIVO'
  | 'REASIGNAR_RESPONSABLE_OPERATIVO'
  | 'ACTUALIZAR_CATEGORIA'
  | 'ACTUALIZAR_CONTACTO'
  | 'ACTUALIZAR_ESTATUS'
  | 'ACTUALIZAR_MULTIPLE'
  | 'INACTIVAR'
  | 'REACTIVAR'
  | 'SIN_CAMBIOS'
  | 'ID_NO_ENCONTRADO'
  | 'ID_INVALIDO'
  | 'ID_IDENTIFICADOR_INCOMPATIBLE'
  | 'IDENTIFICADOR_DUPLICADO_CSV'
  | 'IDENTIFICADOR_DUPLICADO_BD'
  | 'DUPLICADO_NOMBRE_CSV'
  | 'POSIBLE_DUPLICADO_NOMBRE'
  | 'RESPONSABLE_NO_ENCONTRADO'
  | 'RESPONSABLE_INACTIVO'
  | 'RESPONSABLE_AMBIGUO'
  | 'RESPONSABLE_NO_AUTORIZADO'
  | 'RESPONSABLE_OPERATIVO_REQUERIDO'
  | 'CATEGORIA_INVALIDA'
  | 'ESTATUS_INVALIDO'
  | 'CAMPO_OBLIGATORIO_FALTANTE'
  | 'INACTIVACION_CON_DEPENDENCIAS'
  | 'ERROR';

type MatchedBy = 'id' | 'identificador' | 'new' | null;
type OperationalChange =
  | 'identifier'
  | 'name'
  | 'responsible'
  | 'category'
  | 'contact'
  | 'status';

export class TeacherImportError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode = 400
  ) {
    super(message);
  }
}

interface ParsedTeacherRow {
  rowNumber: number;
  id: string;
  identifier: string;
  firstNames: string;
  paternalLastName: string;
  maternalLastName: string;
  responsibleEmail: string;
  category: string;
  phone: string;
  location: string;
  status: string;
}

interface TeacherOperationalRow {
  id: string;
  externalIdentifier: string;
  firstNames: string;
  paternalLastName: string;
  maternalLastName: string;
  fullName: string;
  normalizedName: string;
  category: string;
  phone: string;
  location: string;
  status: TeacherImportStatus;
  createdBy: string | null;
  createdByEmail: string;
  createdByName: string;
  updatedAt: string;
}

interface ResponsibleUserRow {
  id: string;
  email: string;
  displayName: string;
  role: string;
  status: 'ACTIVO' | 'INACTIVO';
  updatedAt: string;
}

export interface TeacherImportValues {
  identifier: string;
  firstNames: string;
  paternalLastName: string;
  maternalLastName: string;
  derivedName: string;
  responsibleEmail: string;
  responsibleName: string;
  category: string;
  phone: string;
  location: string;
  status: string;
}

export interface TeacherImportDependencies {
  schedules: number;
  incidences: number;
  extras: number;
  cycles: string[];
}

export interface TeacherImportPreviewRow {
  rowNumber: number;
  teacherId: string | null;
  matchedBy: MatchedBy;
  teacherName: string;
  action: TeacherImportAction;
  blocking: boolean;
  warnings: string[];
  errors: string[];
  current: TeacherImportValues | null;
  proposed: TeacherImportValues | null;
  dependencies?: TeacherImportDependencies;
  message: string;
  changes: OperationalChange[];
  responsibleUserId: string | null;
}

export interface TeacherImportPreview {
  fileName: string;
  fileSha256: string;
  teachersFingerprint: string;
  responsibleUsersFingerprint: string;
  totalRows: number;
  summary: Record<string, number>;
  hasBlockingErrors: boolean;
  requiresSecondConfirmation: TeacherImportRiskAction[];
  rows: TeacherImportPreviewRow[];
}

export interface TeacherImportApplyInput {
  fileName: string;
  buffer: Buffer;
  expectedFileSha256: string;
  expectedTeachersFingerprint: string;
  expectedResponsibleUsersFingerprint: string;
  confirmedRiskActions: TeacherImportRiskAction[];
}

export interface TeacherImportApplyResult {
  applied: true;
  fileSha256: string;
  totalRows: number;
  created: number;
  updated: number;
  unchanged: number;
  inactivated: number;
  reactivated: number;
  responsibleAssigned: number;
  responsibleReassigned: number;
  warnings: number;
}

const allowedResponsibleRoles = new Set(['admin', 'coordinador', 'direccion']);

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function stableJson(value: unknown): string {
  return JSON.stringify(value);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function decodeUtf8(buffer: Buffer): string {
  if (buffer.byteLength > TEACHER_IMPORT_MAX_BYTES) {
    throw new TeacherImportError('ARCHIVO_EXCEDE_LIMITE', 'El CSV excede el limite de 1 MiB.');
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer).replace(/^\uFEFF/, '');
  } catch {
    throw new TeacherImportError('ARCHIVO_INVALIDO', 'El archivo debe usar UTF-8 valido.');
  }
}

function parseCsvArrays(csvText: string): Promise<string[][]> {
  return new Promise((resolve, reject) => {
    const rows: string[][] = [];
    parseString<string[], string[]>(csvText, { headers: false, ignoreEmpty: false, trim: false })
      .on('error', () => reject(new TeacherImportError('ARCHIVO_INVALIDO', 'El CSV no tiene un formato valido.')))
      .on('data', (row: string[]) => rows.push(row.map((cell) => String(cell))))
      .on('end', () => resolve(rows));
  });
}

function normalizePhone(value: string): string {
  return value.replace(/[^0-9+]/g, '');
}

function validPhone(value: string): boolean {
  return value === '' || /^\+?[0-9]{10,15}$/.test(value);
}

function sanitizeFileName(value: string): string {
  const baseName = path.basename(value.replace(/\\/g, '/')).replace(/[^\p{L}\p{N}._ -]/gu, '_').trim();
  return baseName.slice(0, 180);
}

export function teacherImportBuffer(base64Data: string): Buffer {
  const compact = base64Data.replace(/\s+/g, '');
  if (!compact || compact.length % 4 !== 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(compact)) {
    throw new TeacherImportError('ARCHIVO_INVALIDO', 'Contenido Base64 invalido.');
  }
  return Buffer.from(compact, 'base64');
}

export function validateTeacherImportFileName(fileName: string): string {
  const sanitized = sanitizeFileName(fileName);
  if (!sanitized || !sanitized.toLowerCase().endsWith('.csv')) {
    throw new TeacherImportError('ARCHIVO_INVALIDO', 'Selecciona un archivo CSV valido.');
  }
  return sanitized;
}

async function parseTeacherCsv(buffer: Buffer): Promise<{ fileSha256: string; rows: ParsedTeacherRow[] }> {
  const csvText = decodeUtf8(buffer);
  const parsed = (await parseCsvArrays(csvText)).filter((row) => row.some((cell) => cell.trim() !== ''));
  if (parsed.length === 0) throw new TeacherImportError('ARCHIVO_INVALIDO', 'El CSV esta vacio.');

  const headers = parsed[0];
  if (
    headers.length !== TEACHER_IMPORT_HEADERS.length ||
    headers.some((header, index) => header !== TEACHER_IMPORT_HEADERS[index]) ||
    new Set(headers).size !== headers.length
  ) {
    throw new TeacherImportError(
      'ENCABEZADO_INVALIDO',
      `Encabezados requeridos y en orden: ${TEACHER_IMPORT_HEADERS.join(',')}.`
    );
  }

  const dataRows = parsed.slice(1);
  if (dataRows.length > TEACHER_IMPORT_MAX_ROWS) {
    throw new TeacherImportError('ARCHIVO_EXCEDE_LIMITE', `El CSV excede ${TEACHER_IMPORT_MAX_ROWS} filas.`);
  }

  return {
    fileSha256: sha256(buffer),
    rows: dataRows.map((cells, index) => {
      if (cells.length !== TEACHER_IMPORT_HEADERS.length) {
        throw new TeacherImportError('ENCABEZADO_INVALIDO', `La fila ${index + 2} no tiene diez columnas.`);
      }
      return {
        rowNumber: index + 2,
        id: cells[0].trim(),
        identifier: cells[1].trim(),
        firstNames: normalizeTeacherText(cells[2]),
        paternalLastName: normalizeTeacherText(cells[3]),
        maternalLastName: normalizeTeacherText(cells[4]),
        responsibleEmail: cells[5].trim().toLowerCase(),
        category: cells[6].trim().toUpperCase(),
        phone: cells[7].trim(),
        location: normalizeTeacherText(cells[8]),
        status: cells[9].trim().toUpperCase()
      };
    })
  };
}

async function loadTeachers(client: PoolClient, lock: boolean): Promise<TeacherOperationalRow[]> {
  if (lock) await client.query('SELECT id FROM teachers ORDER BY id FOR UPDATE');
  const result = await client.query<TeacherOperationalRow>(`
    SELECT
      t.id,
      t.external_identifier AS "externalIdentifier",
      t.first_names AS "firstNames",
      t.paternal_last_name AS "paternalLastName",
      t.maternal_last_name AS "maternalLastName",
      t.full_name AS "fullName",
      t.normalized_name AS "normalizedName",
      t.category,
      t.phone,
      t.location,
      t.status,
      t.created_by AS "createdBy",
      COALESCE(u.email, '') AS "createdByEmail",
      COALESCE(u.display_name, '') AS "createdByName",
      t.updated_at::text AS "updatedAt"
    FROM teachers t
    LEFT JOIN app_users u ON u.id = t.created_by
    ORDER BY t.id
  `);
  return result.rows;
}

async function loadResponsibleUsers(
  client: PoolClient,
  emails: string[],
  lock: boolean
): Promise<ResponsibleUserRow[]> {
  if (emails.length === 0) return [];
  const result = await client.query<ResponsibleUserRow>(
    `
      SELECT
        u.id,
        u.email,
        u.display_name AS "displayName",
        r.code AS role,
        u.status,
        u.updated_at::text AS "updatedAt"
      FROM app_users u
      JOIN roles r ON r.id = u.role_id
      WHERE lower(u.email) = ANY($1::text[])
      ORDER BY u.id
      ${lock ? 'FOR UPDATE OF u' : ''}
    `,
    [emails]
  );
  return result.rows;
}

function teacherFingerprint(teachers: TeacherOperationalRow[]): string {
  return sha256(
    stableJson(
      teachers.map((teacher) => [
        teacher.id,
        teacher.externalIdentifier,
        teacher.firstNames,
        teacher.paternalLastName,
        teacher.maternalLastName,
        teacher.fullName,
        teacher.normalizedName,
        teacher.category,
        teacher.phone,
        teacher.location,
        teacher.status,
        teacher.createdBy,
        teacher.updatedAt
      ])
    )
  );
}

function responsibleFingerprint(emails: string[], users: ResponsibleUserRow[]): string {
  const byEmail = new Map<string, ResponsibleUserRow[]>();
  users.forEach((user) => {
    const matches = byEmail.get(user.email.toLowerCase()) || [];
    matches.push(user);
    byEmail.set(user.email.toLowerCase(), matches);
  });
  return sha256(
    stableJson(
      emails.map((email) => [
        email,
        ...(byEmail.get(email) || []).map((user) => [
          user.id,
          user.email,
          user.status,
          user.role,
          user.updatedAt
        ])
      ])
    )
  );
}

function operationalValues(
  teacher: TeacherOperationalRow,
  responsibleName = teacher.createdByName
): TeacherImportValues {
  return {
    identifier: teacher.externalIdentifier,
    firstNames: teacher.firstNames,
    paternalLastName: teacher.paternalLastName,
    maternalLastName: teacher.maternalLastName,
    derivedName: teacher.fullName,
    responsibleEmail: teacher.createdByEmail,
    responsibleName,
    category: teacher.category,
    phone: teacher.phone,
    location: teacher.location,
    status: teacher.status
  };
}

async function loadDependencies(client: PoolClient, teacherId: string): Promise<TeacherImportDependencies> {
  const result = await client.query<{
    schedules: number;
    incidences: number;
    extras: number;
    cycles: string[];
  }>(
    `
      SELECT
        (
          SELECT count(*)::int
          FROM schedules s
          JOIN academic_cycles ac ON ac.id = s.cycle_id
          WHERE s.teacher_id = $1 AND ac.status IN ('ACTIVO', 'PLANEACION')
        ) AS schedules,
        (
          SELECT count(*)::int
          FROM schedule_incidences si
          JOIN schedules s ON s.id = si.schedule_id
          JOIN academic_cycles ac ON ac.id = s.cycle_id
          WHERE s.teacher_id = $1 AND ac.status IN ('ACTIVO', 'PLANEACION')
        ) AS incidences,
        (
          SELECT count(*)::int
          FROM extra_hours eh
          JOIN academic_cycles ac ON ac.id = eh.cycle_id
          WHERE eh.teacher_id = $1 AND ac.status IN ('ACTIVO', 'PLANEACION')
        ) AS extras,
        ARRAY(
          SELECT DISTINCT ac.period_label
          FROM academic_cycles ac
          WHERE ac.status IN ('ACTIVO', 'PLANEACION')
            AND (
              EXISTS (SELECT 1 FROM schedules s WHERE s.teacher_id = $1 AND s.cycle_id = ac.id)
              OR EXISTS (SELECT 1 FROM extra_hours eh WHERE eh.teacher_id = $1 AND eh.cycle_id = ac.id)
            )
          ORDER BY ac.period_label
        ) AS cycles
    `,
    [teacherId]
  );
  return result.rows[0] || { schedules: 0, incidences: 0, extras: 0, cycles: [] };
}

function blockingPreviewRow(
  row: ParsedTeacherRow,
  action: TeacherImportAction,
  message: string,
  options: {
    existing?: TeacherOperationalRow | null;
    matchedBy?: MatchedBy;
    current?: TeacherImportValues | null;
    proposed?: TeacherImportValues | null;
    dependencies?: TeacherImportDependencies;
    warnings?: string[];
  } = {}
): TeacherImportPreviewRow {
  return {
    rowNumber: row.rowNumber,
    teacherId: options.existing?.id || null,
    matchedBy: options.matchedBy || null,
    teacherName: options.proposed?.derivedName || options.existing?.fullName || '',
    action,
    blocking: true,
    warnings: options.warnings || [],
    errors: [action],
    current: options.current ?? (options.existing ? operationalValues(options.existing) : null),
    proposed: options.proposed || null,
    dependencies: options.dependencies,
    message,
    changes: [],
    responsibleUserId: null
  };
}

function actionForChanges(
  changes: OperationalChange[],
  current: TeacherOperationalRow,
  proposed: TeacherImportValues
): TeacherImportAction {
  if (changes.length === 0) return 'SIN_CAMBIOS';
  if (changes.length > 1) return 'ACTUALIZAR_MULTIPLE';
  switch (changes[0]) {
    case 'identifier':
      return 'ACTUALIZAR_IDENTIFICADOR';
    case 'name':
      return 'ACTUALIZAR_NOMBRE';
    case 'responsible':
      return current.createdBy ? 'REASIGNAR_RESPONSABLE_OPERATIVO' : 'ACTUALIZAR_RESPONSABLE_OPERATIVO';
    case 'category':
      return 'ACTUALIZAR_CATEGORIA';
    case 'contact':
      return 'ACTUALIZAR_CONTACTO';
    case 'status':
      return proposed.status === 'INACTIVO' ? 'INACTIVAR' : current.status === 'INACTIVO' ? 'REACTIVAR' : 'ACTUALIZAR_ESTATUS';
  }
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right, 'en'));
}

function summaryFor(rows: TeacherImportPreviewRow[]): Record<string, number> {
  const summary: Record<string, number> = {};
  rows.forEach((row) => {
    summary[row.action] = (summary[row.action] || 0) + 1;
  });
  return summary;
}

export async function buildTeacherImportPreview(
  client: PoolClient,
  fileName: string,
  buffer: Buffer,
  options: { lock?: boolean } = {}
): Promise<TeacherImportPreview> {
  const sanitizedFileName = validateTeacherImportFileName(fileName);
  const parsed = await parseTeacherCsv(buffer);
  const teachers = await loadTeachers(client, options.lock === true);
  const referencedEmails = uniqueSorted(parsed.rows.map((row) => row.responsibleEmail).filter(Boolean));
  const responsibleUsers = await loadResponsibleUsers(client, referencedEmails, options.lock === true);

  const byId = new Map(teachers.map((teacher) => [teacher.id.toLowerCase(), teacher]));
  const byIdentifier = new Map<string, TeacherOperationalRow[]>();
  const byNormalizedName = new Map<string, TeacherOperationalRow[]>();
  teachers.forEach((teacher) => {
    const identifier = normalizeTeacherExternalIdentifierKey(teacher.externalIdentifier);
    if (identifier) {
      const matches = byIdentifier.get(identifier) || [];
      matches.push(teacher);
      byIdentifier.set(identifier, matches);
    }
    const matches = byNormalizedName.get(teacher.normalizedName) || [];
    matches.push(teacher);
    byNormalizedName.set(teacher.normalizedName, matches);
  });

  const usersByEmail = new Map<string, ResponsibleUserRow[]>();
  responsibleUsers.forEach((user) => {
    const matches = usersByEmail.get(user.email.toLowerCase()) || [];
    matches.push(user);
    usersByEmail.set(user.email.toLowerCase(), matches);
  });

  const idCounts = new Map<string, number>();
  const identifierCounts = new Map<string, number>();
  const proposedNameCounts = new Map<string, number>();
  parsed.rows.forEach((row) => {
    if (row.id) idCounts.set(row.id.toLowerCase(), (idCounts.get(row.id.toLowerCase()) || 0) + 1);
    const identifier = normalizeTeacherExternalIdentifierKey(row.identifier);
    if (identifier) identifierCounts.set(identifier, (identifierCounts.get(identifier) || 0) + 1);
    if (row.firstNames && row.paternalLastName) {
      const normalized = normalizeTeacherComparableName(
        buildTeacherFullName({
          firstNames: row.firstNames,
          paternalLastName: row.paternalLastName,
          maternalLastName: row.maternalLastName
        })
      );
      proposedNameCounts.set(normalized, (proposedNameCounts.get(normalized) || 0) + 1);
    }
  });

  const previewRows: TeacherImportPreviewRow[] = [];
  for (const row of parsed.rows) {
    if (row.id && !isUuid(row.id)) {
      previewRows.push(blockingPreviewRow(row, 'ID_INVALIDO', 'El ID no es un UUID valido.'));
      continue;
    }
    if (row.id && (idCounts.get(row.id.toLowerCase()) || 0) > 1) {
      previewRows.push(blockingPreviewRow(row, 'ERROR', 'El CSV repite el mismo ID de docente.'));
      continue;
    }

    const identifierKey = normalizeTeacherExternalIdentifierKey(row.identifier);
    if (identifierKey && (identifierCounts.get(identifierKey) || 0) > 1) {
      previewRows.push(blockingPreviewRow(row, 'IDENTIFICADOR_DUPLICADO_CSV', 'El CSV repite el identificador.'));
      continue;
    }
    const idMatch = row.id ? byId.get(row.id.toLowerCase()) || null : null;
    const identifierMatches = identifierKey ? byIdentifier.get(identifierKey) || [] : [];
    if (row.id && !idMatch) {
      previewRows.push(blockingPreviewRow(row, 'ID_NO_ENCONTRADO', 'El ID no corresponde a un docente existente.'));
      continue;
    }
    if (identifierMatches.length > 1) {
      previewRows.push(blockingPreviewRow(row, 'IDENTIFICADOR_DUPLICADO_BD', 'El identificador no es unico en la base.'));
      continue;
    }
    const identifierMatch = identifierMatches[0] || null;
    if (idMatch && identifierMatch && idMatch.id !== identifierMatch.id) {
      previewRows.push(
        blockingPreviewRow(row, 'ID_IDENTIFICADOR_INCOMPATIBLE', 'El ID y el identificador pertenecen a docentes distintos.')
      );
      continue;
    }
    const existing = idMatch || identifierMatch;
    const matchedBy: MatchedBy = idMatch ? 'id' : identifierMatch ? 'identificador' : 'new';

    const firstNames = existing && !row.firstNames ? existing.firstNames : normalizeTeacherNameComponent(row.firstNames);
    const paternalLastName =
      existing && !row.paternalLastName ? existing.paternalLastName : normalizeTeacherNameComponent(row.paternalLastName);
    const maternalLastName =
      existing && !row.maternalLastName ? existing.maternalLastName : normalizeTeacherNameComponent(row.maternalLastName);
    const identifier = existing && !row.identifier ? existing.externalIdentifier : row.identifier.trim();
    const category = existing && !row.category ? existing.category : row.category;
    const status = existing && !row.status ? existing.status : row.status;
    const phone = existing && !row.phone ? existing.phone : normalizePhone(row.phone);
    const location = existing && !row.location ? existing.location : row.location;

    if (!existing && (!identifier || !firstNames || !paternalLastName || !row.responsibleEmail || !category || !status)) {
      previewRows.push(
        blockingPreviewRow(row, 'CAMPO_OBLIGATORIO_FALTANTE', 'La alta requiere identificador, nombres, apellido paterno, responsable, categoria y estatus.')
      );
      continue;
    }
    if (!firstNames || !paternalLastName) {
      previewRows.push(blockingPreviewRow(row, 'CAMPO_OBLIGATORIO_FALTANTE', 'Nombres y apellido paterno son obligatorios.'));
      continue;
    }
    if (identifier.length > 60 || firstNames.length > 120 || paternalLastName.length > 80 || maternalLastName.length > 80) {
      previewRows.push(blockingPreviewRow(row, 'ERROR', 'Uno de los campos excede la longitud permitida.'));
      continue;
    }
    if (category && !['V', 'M', 'N'].includes(category)) {
      previewRows.push(blockingPreviewRow(row, 'CATEGORIA_INVALIDA', 'La categoria debe ser V, M o N.'));
      continue;
    }
    if (status && !['ACTIVO', 'INACTIVO'].includes(status)) {
      previewRows.push(blockingPreviewRow(row, 'ESTATUS_INVALIDO', 'El estatus debe ser ACTIVO o INACTIVO.'));
      continue;
    }
    if (!validPhone(phone) || location.length > 40) {
      previewRows.push(blockingPreviewRow(row, 'ERROR', 'El telefono o la ubicacion no tienen un formato valido.'));
      continue;
    }

    const derivedName = buildTeacherFullName({ firstNames, paternalLastName, maternalLastName });
    const normalizedName = normalizeTeacherComparableName(derivedName);
    const responsibleMatches = row.responsibleEmail ? usersByEmail.get(row.responsibleEmail) || [] : [];
    if (row.responsibleEmail && responsibleMatches.length === 0) {
      previewRows.push(blockingPreviewRow(row, 'RESPONSABLE_NO_ENCONTRADO', 'No existe el responsable operativo.'));
      continue;
    }
    if (responsibleMatches.length > 1) {
      previewRows.push(blockingPreviewRow(row, 'RESPONSABLE_AMBIGUO', 'El responsable operativo no es inequivoco.'));
      continue;
    }
    const responsible = responsibleMatches[0] || null;
    if (responsible?.status === 'INACTIVO') {
      previewRows.push(blockingPreviewRow(row, 'RESPONSABLE_INACTIVO', 'El responsable operativo esta inactivo.'));
      continue;
    }
    if (responsible && !allowedResponsibleRoles.has(responsible.role)) {
      previewRows.push(blockingPreviewRow(row, 'RESPONSABLE_NO_AUTORIZADO', 'El rol del responsable no esta autorizado.'));
      continue;
    }

    const responsibleId = responsible?.id || existing?.createdBy || null;
    const responsibleEmail = responsible?.email || existing?.createdByEmail || '';
    const responsibleName = responsible?.displayName || existing?.createdByName || '';
    const proposed: TeacherImportValues = {
      identifier,
      firstNames,
      paternalLastName,
      maternalLastName,
      derivedName,
      responsibleEmail,
      responsibleName,
      category,
      phone,
      location,
      status
    };

    if (!existing) {
      if (!responsible) {
        previewRows.push(blockingPreviewRow(row, 'RESPONSABLE_OPERATIVO_REQUERIDO', 'La alta requiere responsable operativo.', { proposed }));
        continue;
      }
      if ((byNormalizedName.get(normalizedName) || []).length > 0) {
        previewRows.push(blockingPreviewRow(row, 'POSIBLE_DUPLICADO_NOMBRE', 'Ya existe un docente con nombre normalizado equivalente.', { proposed }));
        continue;
      }
      if ((proposedNameCounts.get(normalizedName) || 0) > 1) {
        previewRows.push(blockingPreviewRow(row, 'DUPLICADO_NOMBRE_CSV', 'El CSV repite el nombre normalizado.', { proposed }));
        continue;
      }
      previewRows.push({
        rowNumber: row.rowNumber,
        teacherId: null,
        matchedBy: 'new',
        teacherName: derivedName,
        action: 'NUEVO',
        blocking: false,
        warnings: [],
        errors: [],
        current: null,
        proposed,
        message: 'Alta nueva lista para aplicar.',
        changes: ['identifier', 'name', 'responsible', 'category', 'contact', 'status'],
        responsibleUserId: responsible.id
      });
      continue;
    }

    const current = operationalValues(existing);
    const changes: OperationalChange[] = [];
    if (normalizeTeacherExternalIdentifierKey(identifier) !== normalizeTeacherExternalIdentifierKey(existing.externalIdentifier)) {
      changes.push('identifier');
    }
    if (
      firstNames !== existing.firstNames ||
      paternalLastName !== existing.paternalLastName ||
      maternalLastName !== existing.maternalLastName
    ) {
      changes.push('name');
    }
    if (responsibleId !== existing.createdBy) changes.push('responsible');
    if (category !== existing.category) changes.push('category');
    if (phone !== existing.phone || location !== existing.location) changes.push('contact');
    if (status !== existing.status) changes.push('status');

    if (!existing.createdBy && changes.length > 0 && !responsible) {
      previewRows.push(
        blockingPreviewRow(
          row,
          'RESPONSABLE_OPERATIVO_REQUERIDO',
          'El docente legacy requiere responsable antes de modificar datos operativos.',
          { existing, matchedBy, current, proposed }
        )
      );
      continue;
    }
    const normalizedMatches = (byNormalizedName.get(normalizedName) || []).filter((teacher) => teacher.id !== existing.id);
    if (changes.includes('name') && normalizedMatches.length > 0) {
      previewRows.push(
        blockingPreviewRow(row, 'POSIBLE_DUPLICADO_NOMBRE', 'El nombre propuesto colisiona con otro docente.', {
          existing,
          matchedBy,
          current,
          proposed
        })
      );
      continue;
    }
    const action = actionForChanges(changes, existing, proposed);
    let dependencies: TeacherImportDependencies | undefined;
    if (changes.includes('status') && proposed.status === 'INACTIVO') {
      dependencies = await loadDependencies(client, existing.id);
      if (dependencies.schedules + dependencies.incidences + dependencies.extras > 0) {
        previewRows.push(
          blockingPreviewRow(
            row,
            'INACTIVACION_CON_DEPENDENCIAS',
            'El docente conserva dependencias en ciclos ACTIVO o PLANEACION.',
            { existing, matchedBy, current, proposed, dependencies }
          )
        );
        continue;
      }
    }
    const warnings = !existing.createdBy && action === 'SIN_CAMBIOS' ? ['RESPONSABLE_OPERATIVO_AUSENTE'] : [];
    previewRows.push({
      rowNumber: row.rowNumber,
      teacherId: existing.id,
      matchedBy,
      teacherName: proposed.derivedName,
      action,
      blocking: false,
      warnings,
      errors: [],
      current,
      proposed,
      dependencies,
      message: action === 'SIN_CAMBIOS' ? 'Sin cambios operativos.' : `Cambios: ${changes.join(', ')}.`,
      changes,
      responsibleUserId: responsibleId
    });
  }

  const requiredConfirmations = uniqueSorted(
    previewRows
      .filter((row) => !row.blocking && TEACHER_IMPORT_RISK_ACTIONS.includes(row.action as TeacherImportRiskAction))
      .map((row) => row.action)
  ) as TeacherImportRiskAction[];

  return {
    fileName: sanitizedFileName,
    fileSha256: parsed.fileSha256,
    teachersFingerprint: teacherFingerprint(teachers),
    responsibleUsersFingerprint: responsibleFingerprint(referencedEmails, responsibleUsers),
    totalRows: previewRows.length,
    summary: summaryFor(previewRows),
    hasBlockingErrors: previewRows.some((row) => row.blocking),
    requiresSecondConfirmation: requiredConfirmations,
    rows: previewRows
  };
}

function safeAuditValues(values: TeacherImportValues | null): unknown {
  if (!values) return null;
  return {
    identifier: values.identifier,
    firstNames: values.firstNames,
    paternalLastName: values.paternalLastName,
    maternalLastName: values.maternalLastName,
    derivedName: values.derivedName,
    responsibleEmail: values.responsibleEmail,
    category: values.category,
    phone: values.phone,
    location: values.location,
    status: values.status
  };
}

async function auditTeacherImport(
  client: PoolClient,
  actor: SessionUser,
  action: string,
  entityType: 'teacher' | 'teacher_import',
  entityId: string | null,
  beforeData: unknown,
  afterData: unknown
): Promise<void> {
  await client.query(
    `
      INSERT INTO audit_log (actor_user_id, actor_email, action, entity_type, entity_id, before_data, after_data)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)
    `,
    [actor.id, actor.email, action, entityType, entityId, JSON.stringify(beforeData), JSON.stringify(afterData)]
  );
}

function postgresConstraint(error: unknown): { code?: string; constraint?: string } {
  return error && typeof error === 'object' ? (error as { code?: string; constraint?: string }) : {};
}

export async function applyTeacherImport(
  client: PoolClient,
  actor: SessionUser,
  input: TeacherImportApplyInput
): Promise<TeacherImportApplyResult> {
  await client.query("SELECT pg_advisory_xact_lock(hashtext('nomina_docente_teacher_import'))");
  const preview = await buildTeacherImportPreview(client, input.fileName, input.buffer, { lock: true });
  if (
    preview.fileSha256 !== input.expectedFileSha256 ||
    preview.teachersFingerprint !== input.expectedTeachersFingerprint ||
    preview.responsibleUsersFingerprint !== input.expectedResponsibleUsersFingerprint
  ) {
    throw new TeacherImportError('PREVIEW_OBSOLETO', 'El archivo, docentes o responsables cambiaron despues del Preview.', 409);
  }
  if (preview.hasBlockingErrors) {
    throw new TeacherImportError('PREVIEW_OBSOLETO', 'El Preview recalculado contiene errores bloqueantes.', 409);
  }
  const confirmed = new Set(input.confirmedRiskActions);
  const missingConfirmation = preview.requiresSecondConfirmation.filter((action) => !confirmed.has(action));
  if (missingConfirmation.length > 0) {
    throw new TeacherImportError(
      'CONFIRMACION_INSUFICIENTE',
      `Falta confirmar: ${missingConfirmation.join(', ')}.`,
      409
    );
  }

  const result: TeacherImportApplyResult = {
    applied: true,
    fileSha256: preview.fileSha256,
    totalRows: preview.totalRows,
    created: 0,
    updated: 0,
    unchanged: 0,
    inactivated: 0,
    reactivated: 0,
    responsibleAssigned: 0,
    responsibleReassigned: 0,
    warnings: preview.rows.reduce((total, row) => total + row.warnings.length, 0)
  };

  try {
    for (const row of preview.rows) {
      if (row.action === 'SIN_CAMBIOS') {
        result.unchanged += 1;
        continue;
      }
      if (!row.proposed || !row.responsibleUserId) {
        throw new TeacherImportError('PREVIEW_OBSOLETO', `La fila ${row.rowNumber} no tiene datos aplicables.`, 409);
      }

      let teacherId = row.teacherId;
      if (row.action === 'NUEVO') {
        const created = await client.query<{ id: string }>(
          `
            INSERT INTO teachers (
              external_identifier,
              first_names,
              paternal_last_name,
              maternal_last_name,
              full_name,
              normalized_name,
              created_by,
              category,
              phone,
              location,
              status,
              updated_by
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING id
          `,
          [
            row.proposed.identifier,
            row.proposed.firstNames,
            row.proposed.paternalLastName,
            row.proposed.maternalLastName,
            row.proposed.derivedName,
            normalizeTeacherComparableName(row.proposed.derivedName),
            row.responsibleUserId,
            row.proposed.category,
            row.proposed.phone,
            row.proposed.location,
            row.proposed.status,
            actor.id
          ]
        );
        teacherId = created.rows[0].id;
        result.created += 1;
        await auditTeacherImport(client, actor, 'TEACHER_CREATED', 'teacher', teacherId, null, safeAuditValues(row.proposed));
        continue;
      }

      if (!teacherId || !row.current) {
        throw new TeacherImportError('PREVIEW_OBSOLETO', `La fila ${row.rowNumber} perdio su docente asociado.`, 409);
      }
      const assignments: string[] = [];
      const params: unknown[] = [];
      const assign = (column: string, value: unknown): void => {
        params.push(value);
        assignments.push(`${column} = $${params.length}`);
      };
      if (row.changes.includes('identifier')) assign('external_identifier', row.proposed.identifier);
      if (row.changes.includes('name')) {
        assign('first_names', row.proposed.firstNames);
        assign('paternal_last_name', row.proposed.paternalLastName);
        assign('maternal_last_name', row.proposed.maternalLastName);
        assign('full_name', row.proposed.derivedName);
        assign('normalized_name', normalizeTeacherComparableName(row.proposed.derivedName));
      }
      if (row.changes.includes('responsible')) assign('created_by', row.responsibleUserId);
      if (row.changes.includes('category')) assign('category', row.proposed.category);
      if (row.changes.includes('contact')) {
        assign('phone', row.proposed.phone);
        assign('location', row.proposed.location);
      }
      if (row.changes.includes('status')) assign('status', row.proposed.status);
      assign('updated_by', actor.id);
      assignments.push('updated_at = now()');
      params.push(teacherId);
      const changed = await client.query(
        `UPDATE teachers SET ${assignments.join(', ')} WHERE id = $${params.length}`,
        params
      );
      if (changed.rowCount !== 1) {
        throw new TeacherImportError('PREVIEW_OBSOLETO', `El docente de la fila ${row.rowNumber} cambio durante Apply.`, 409);
      }
      result.updated += 1;
      if (row.action === 'INACTIVAR') result.inactivated += 1;
      if (row.action === 'REACTIVAR') result.reactivated += 1;
      if (row.changes.includes('responsible')) {
        if (row.current.responsibleEmail) result.responsibleReassigned += 1;
        else result.responsibleAssigned += 1;
      }
      await auditTeacherImport(
        client,
        actor,
        'TEACHER_UPDATED',
        'teacher',
        teacherId,
        safeAuditValues(row.current),
        safeAuditValues(row.proposed)
      );
      if (row.changes.includes('responsible')) {
        await auditTeacherImport(
          client,
          actor,
          'TEACHER_RESPONSIBLE_REASSIGNED',
          'teacher',
          teacherId,
          { responsibleEmail: row.current.responsibleEmail || null },
          { responsibleEmail: row.proposed.responsibleEmail }
        );
      }
      if (row.changes.includes('status')) {
        await auditTeacherImport(
          client,
          actor,
          'TEACHER_STATUS_CHANGED',
          'teacher',
          teacherId,
          { status: row.current.status },
          { status: row.proposed.status }
        );
      }
    }
  } catch (error) {
    const dbError = postgresConstraint(error);
    if (dbError.code === '23505' && dbError.constraint === 'teachers_external_identifier_unique_idx') {
      throw new TeacherImportError('IDENTIFICADOR_DUPLICADO', 'El identificador ya pertenece a otro docente.', 409);
    }
    if (dbError.code === '23505' && dbError.constraint === 'teachers_normalized_name_key') {
      throw new TeacherImportError('POSIBLE_DUPLICADO_NOMBRE', 'El nombre normalizado colisiona con otro docente.', 409);
    }
    throw error;
  }

  await auditTeacherImport(client, actor, 'TEACHER_IMPORT_APPLIED', 'teacher_import', null, null, {
    fileName: preview.fileName,
    fileSha256: preview.fileSha256,
    totalRows: preview.totalRows,
    summary: preview.summary,
    warnings: result.warnings,
    created: result.created,
    updated: result.updated,
    inactivated: result.inactivated,
    reactivated: result.reactivated
  });
  return result;
}

export async function teacherImportTemplateRows(
  client: PoolClient,
  scope: 'blank' | 'active' | 'all'
): Promise<string[][]> {
  if (scope === 'blank') return [];
  const result = await client.query<{
    id: string;
    identifier: string;
    firstNames: string;
    paternalLastName: string;
    maternalLastName: string;
    responsibleEmail: string;
    category: string;
    phone: string;
    location: string;
    status: string;
  }>(
    `
      SELECT
        t.id,
        t.external_identifier AS identifier,
        t.first_names AS "firstNames",
        t.paternal_last_name AS "paternalLastName",
        t.maternal_last_name AS "maternalLastName",
        COALESCE(u.email, '') AS "responsibleEmail",
        t.category,
        t.phone,
        t.location,
        t.status::text AS status
      FROM teachers t
      LEFT JOIN app_users u ON u.id = t.created_by
      WHERE ($1::text = 'all' OR t.status = 'ACTIVO')
      ORDER BY t.full_name ASC, t.id ASC
    `,
    [scope]
  );
  return result.rows.map((row) => [
    row.id,
    row.identifier,
    row.firstNames,
    row.paternalLastName,
    row.maternalLastName,
    row.responsibleEmail,
    row.category,
    row.phone,
    row.location,
    row.status
  ]);
}
