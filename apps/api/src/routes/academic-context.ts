import type { PoolClient } from 'pg';
import { loadActorScope, selectCompatibleActorCoordination } from '../actor-scope.js';
import { query } from '../db.js';
import type { SessionUser } from '../types.js';

export type CycleStatus = 'PLANEACION' | 'ACTIVO' | 'CERRADO';

export interface CycleRow {
  id: string;
  periodLabel: string;
  quarterCode: string;
  baseHoursStartDate: string | null;
  baseHoursEndDate: string | null;
  module1Start: string;
  module1End: string;
  module2Start: string;
  module2End: string;
  status: CycleStatus;
  scheduleCount?: number;
  calendarPeriodCount?: number;
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
      ac.id,
      ac.period_label AS "periodLabel",
      ac.quarter_code AS "quarterCode",
      ac.base_hours_start_date::text AS "baseHoursStartDate",
      ac.base_hours_end_date::text AS "baseHoursEndDate",
      ac.module1_start::text AS "module1Start",
      ac.module1_end::text AS "module1End",
      ac.module2_start::text AS "module2Start",
      ac.module2_end::text AS "module2End",
      ac.status,
      (
        SELECT count(*)::int
        FROM schedules s
        WHERE s.cycle_id = ac.id
      ) AS "scheduleCount",
      (
        SELECT count(*)::int
        FROM payroll_calendar_config pcc
        WHERE pcc.cycle_id = ac.id
      ) AS "calendarPeriodCount"
    FROM academic_cycles ac
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
      VALUES ($1, $2, $3, $4, $5, $6, 'PLANEACION', $7)
      ON CONFLICT (period_label, quarter_code) DO UPDATE
      SET status = academic_cycles.status
      RETURNING
        id,
        period_label AS "periodLabel",
        quarter_code AS "quarterCode",
        base_hours_start_date::text AS "baseHoursStartDate",
        base_hours_end_date::text AS "baseHoursEndDate",
        module1_start::text AS "module1Start",
        module1_end::text AS "module1End",
        module2_start::text AS "module2Start",
        module2_end::text AS "module2End",
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
  const scope = await loadActorScope(client, actor, {
    module: 'academic-context.loadActorCoordination'
  });

  if (createIfMissing && scope.coordinations.length === 0) {
    console.warn('H02_COMPAT_COORDINATION_NOT_CREATED', {
      actorEmail: actor.email,
      role: actor.role,
      module: 'academic-context.loadActorCoordination'
    });
  }

  // TODO H02: migrar este uso a actorCoordinations[] en fases posteriores.
  const selected = selectCompatibleActorCoordination(scope);
  return selected ? { id: selected.id, name: selected.name } : null;
}

export async function listActiveCoordinations(): Promise<CoordinationRow[]> {
  return query<CoordinationRow>("SELECT id, name FROM coordinations WHERE status = 'ACTIVO' ORDER BY name ASC");
}
