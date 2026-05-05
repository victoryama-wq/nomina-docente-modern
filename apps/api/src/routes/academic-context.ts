import type { PoolClient } from 'pg';
import { query } from '../db.js';
import type { SessionUser } from '../types.js';

export type CycleStatus = 'PLANEACION' | 'ACTIVO' | 'CERRADO';

export interface CycleRow {
  id: string;
  periodLabel: string;
  quarterCode: string;
  module1Start: string;
  module1End: string;
  module2Start: string;
  module2End: string;
  status: CycleStatus;
}

export interface CoordinationRow {
  id: string;
  name: string;
}

export function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function normalizeComparable(value: string): string {
  return normalizeText(value)
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function categoryMaxHours(category: string): number {
  if (category === 'V') return 35;
  if (category === 'M') return 25;
  return 15;
}

export function cycleSelectSql(whereClause = ''): string {
  return `
    SELECT
      id,
      period_label AS "periodLabel",
      quarter_code AS "quarterCode",
      module1_start AS "module1Start",
      module1_end AS "module1End",
      module2_start AS "module2Start",
      module2_end AS "module2End",
      status
    FROM academic_cycles
    ${whereClause}
  `;
}

export async function listCycles(): Promise<CycleRow[]> {
  return query<CycleRow>(`
    ${cycleSelectSql()}
    ORDER BY
      CASE status
        WHEN 'ACTIVO' THEN 1
        WHEN 'PLANEACION' THEN 2
        ELSE 3
      END,
      created_at DESC
  `);
}

export async function loadCycleById(client: PoolClient, id: string): Promise<CycleRow | null> {
  const result = await client.query<CycleRow>(`${cycleSelectSql('WHERE id = $1')} LIMIT 1`, [id]);
  return result.rows[0] || null;
}

export async function ensureWorkingCycle(
  client: PoolClient,
  actor: SessionUser,
  preferredCycleId?: string
): Promise<CycleRow> {
  if (preferredCycleId) {
    const cycle = await loadCycleById(client, preferredCycleId);
    if (!cycle) throw new Error('El ciclo seleccionado no existe.');
    return cycle;
  }

  const existing = await client.query<CycleRow>(
    `
      ${cycleSelectSql("WHERE status IN ('ACTIVO', 'PLANEACION')")}
      ORDER BY
        CASE status
          WHEN 'ACTIVO' THEN 1
          ELSE 2
        END,
        created_at DESC
      LIMIT 1
    `
  );
  if (existing.rows[0]) return existing.rows[0];

  const year = new Date().getFullYear();
  const created = await client.query<CycleRow>(
    `
      INSERT INTO academic_cycles (
        period_label,
        quarter_code,
        module1_start,
        module1_end,
        module2_start,
        module2_end,
        status,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVO', $7)
      ON CONFLICT (period_label, quarter_code) DO UPDATE
      SET status = 'ACTIVO',
          closed_at = NULL,
          closed_by = NULL
      RETURNING
        id,
        period_label AS "periodLabel",
        quarter_code AS "quarterCode",
        module1_start AS "module1Start",
        module1_end AS "module1End",
        module2_start AS "module2Start",
        module2_end AS "module2End",
        status
    `,
    ['CICLO INICIAL', 'ACTUAL', `${year}-01-01`, `${year}-06-30`, `${year}-07-01`, `${year}-12-31`, actor.id]
  );

  return created.rows[0];
}

export async function ensureWritableCycle(
  client: PoolClient,
  actor: SessionUser,
  preferredCycleId?: string
): Promise<CycleRow> {
  const cycle = await ensureWorkingCycle(client, actor, preferredCycleId);
  if (cycle.status === 'CERRADO') {
    throw new Error('No se pueden modificar registros de un ciclo cerrado.');
  }
  return cycle;
}

export async function loadActorCoordination(
  client: PoolClient,
  actor: SessionUser,
  createIfMissing: boolean
): Promise<CoordinationRow | null> {
  const user = await client.query<{ displayName: string; legacyUsername: string }>(
    `
      SELECT display_name AS "displayName", COALESCE(legacy_username, '') AS "legacyUsername"
      FROM app_users
      WHERE id = $1
      LIMIT 1
    `,
    [actor.id]
  );

  const candidates = [user.rows[0]?.displayName, user.rows[0]?.legacyUsername, actor.displayName]
    .map((value) => normalizeText(value || ''))
    .filter(Boolean);
  const uniqueCandidates = [...new Map(candidates.map((candidate) => [normalizeComparable(candidate), candidate])).values()];

  for (const candidate of uniqueCandidates) {
    const existing = await client.query<CoordinationRow>(
      'SELECT id, name FROM coordinations WHERE lower(name) = lower($1) LIMIT 1',
      [candidate]
    );
    if (existing.rows[0]) return existing.rows[0];
  }

  if (!createIfMissing) return null;

  const name = uniqueCandidates[0] || actor.displayName || actor.email;
  const created = await client.query<CoordinationRow>(
    'INSERT INTO coordinations (name, status) VALUES ($1, $2) RETURNING id, name',
    [name, 'ACTIVO']
  );
  return created.rows[0];
}

export async function listActiveCoordinations(): Promise<CoordinationRow[]> {
  return query<CoordinationRow>("SELECT id, name FROM coordinations WHERE status = 'ACTIVO' ORDER BY name ASC");
}
