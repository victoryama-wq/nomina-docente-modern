import type { Pool } from 'pg';

export const WORKER_TIME_ZONE = 'America/Cancun';
export const WORKER_BUDGET_MS = 230_000;
const formatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: WORKER_TIME_ZONE, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
});

export function workerWindowAllows(date: Date, phase: 'start' | 'running' = 'start'): boolean {
  if (!Number.isFinite(date.getTime())) return false;
  const parts = formatter.formatToParts(date);
  const value = (type: string) => Number(parts.find(part => part.type === type)?.value);
  const seconds = value('hour') * 3600 + value('minute') * 60 + value('second');
  return seconds >= 7 * 3600 && seconds < 21 * 3600 + (phase === 'start' ? 50 : 55) * 60;
}

export interface WorkerLease { release(): void }
export type FatalWorkerReason = 'WORKER_DEADLINE' | 'WORKER_LOCK_LOST';

// A dedicated session holds the database-wide lock, separate from operation transactions.
// Discarding it releases the lock even if a query failed; never return a locked session to the pool.
export async function acquireWorkerLease(pool: Pool, lost: () => never): Promise<WorkerLease | null> {
  const client = await pool.connect();
  let released = false;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  const release = () => {
    if (released) return;
    released = true;
    if (heartbeat) clearInterval(heartbeat);
    client.removeListener('error', onLost);
    client.removeListener('end', onLost);
    client.release(true);
  };
  const onLost = () => { if (!released) lost(); };
  client.on('error', onLost);
  client.on('end', onLost);
  try {
    const lockQuery = {
      text: 'SELECT pg_try_advisory_lock(4731444, 1) AS acquired', query_timeout: 5000
    };
    const result = await client.query(lockQuery);
    if (!result.rows[0]?.acquired) { release(); return null; }
    let checking = false;
    heartbeat = setInterval(() => {
      if (checking || released) return;
      checking = true;
      const ping = { text: 'SELECT 1', query_timeout: 4000 };
      void client.query(ping)
        .catch(onLost).finally(() => { checking = false; });
    }, 5000);
    return { release };
  } catch (error) { release(); throw error; }
}

export async function runGuardedDossierWorker<T extends { exitCode: number }>(dependencies: {
  now?: () => Date;
  acquire: (lost: () => never) => Promise<WorkerLease | null>;
  run: () => Promise<T>;
  // Must terminate the process, not just reject a promise while storage work continues.
  terminate: (reason: FatalWorkerReason) => never;
}) {
  const now = dependencies.now ?? (() => new Date());
  const skipped = (outcome: 'SKIPPED_HOURS' | 'SKIPPED_OVERLAP') => ({
    event: 'dossier_reconcile', severity: 'INFO', outcome, cleanupSucceeded: false, exitCode: 0
  });
  if (!workerWindowAllows(now())) return skipped('SKIPPED_HOURS');
  const started = performance.now();
  const deadline = setTimeout(() => dependencies.terminate('WORKER_DEADLINE'), WORKER_BUDGET_MS);
  const wallClock = setInterval(() => {
    if (!workerWindowAllows(now(), 'running')) dependencies.terminate('WORKER_DEADLINE');
  }, 1000);
  let lease: WorkerLease | null = null;
  try {
    lease = await dependencies.acquire(() => dependencies.terminate('WORKER_LOCK_LOST'));
    if (performance.now() - started >= WORKER_BUDGET_MS) dependencies.terminate('WORKER_DEADLINE');
    if (!lease) return skipped('SKIPPED_OVERLAP');
    // Recheck actual time after connection/dispatch delays, never trust the scheduler timestamp.
    if (!workerWindowAllows(now())) return skipped('SKIPPED_HOURS');
    const summary = await dependencies.run();
    if (!workerWindowAllows(now(), 'running') || performance.now() - started >= WORKER_BUDGET_MS) {
      dependencies.terminate('WORKER_DEADLINE');
    }
    return { ...summary, outcome: summary.exitCode === 0 ? 'COMPLETED' : 'FAILED',
      cleanupSucceeded: summary.exitCode === 0 };
  } finally {
    clearTimeout(deadline);
    clearInterval(wallClock);
    lease?.release();
  }
}
