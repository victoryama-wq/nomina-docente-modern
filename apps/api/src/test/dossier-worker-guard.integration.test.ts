import pg from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { acquireWorkerLease, runGuardedDossierWorker } from '../lib/dossier-worker-guard.js';
import { getTestDbConfig, isTestDbExplicitlyConfigured } from './db/test-db-utils.js';

const local = isTestDbExplicitlyConfigured() ? describe : describe.skip;
local('H24 worker real PostgreSQL session exclusion', () => {
  it('excludes overlapping workers, releases after failure, and admits the next retry', async () => {
    const config = getTestDbConfig();
    expect(config.database).toBe('nomina_docente_test');
    expect(['localhost', '127.0.0.1', '::1']).toContain(config.host);
    const pool = new pg.Pool(config);
    const fatal = (reason: string): never => { throw new Error(reason); };
    const acquire = () => acquireWorkerLease(pool, () => fatal('lost'));
    const now = () => new Date('2026-11-09T12:00:00-05:00');
    let unblock!: () => void;
    let started!: () => void;
    const running = new Promise<void>(resolve => { started = resolve; });
    const wait = new Promise<void>(resolve => { unblock = resolve; });
    try {
      const first = runGuardedDossierWorker({ now, acquire, terminate: fatal,
        run: async () => { started(); await wait; throw new Error('synthetic failure'); } });
      const rejected = expect(first).rejects.toThrow('synthetic failure');
      await running;
      const run = vi.fn(async () => ({ exitCode: 0 }));
      expect(await runGuardedDossierWorker({ now, acquire, terminate: fatal, run }))
        .toMatchObject({ outcome: 'SKIPPED_OVERLAP', cleanupSucceeded: false });
      expect(run).not.toHaveBeenCalled();
      unblock(); await rejected;
      await expect.poll(async () => {
        const retry = await runGuardedDossierWorker({ now, acquire, terminate: fatal, run });
        return retry.cleanupSucceeded;
      }).toBe(true);
    } finally { unblock?.(); await pool.end(); }
  });
  it('server connection loss signals termination and releases the server-side lease', async () => {
    const config = getTestDbConfig();
    expect(config.database).toBe('nomina_docente_test');
    expect(['localhost', '127.0.0.1', '::1']).toContain(config.host);
    const pool = new pg.Pool({ ...config, application_name: 'h24_synthetic_lease' });
    // Stub the fatal callback only to observe connection events; production exits immediately.
    const lost = vi.fn(() => undefined as never);
    const lease = await acquireWorkerLease(pool, lost);
    try {
      expect(lease).not.toBeNull();
      const rows = await pool.query(`SELECT pid FROM pg_locks WHERE locktype='advisory'
        AND classid=4731444 AND objid=1 AND granted AND database=(SELECT oid FROM pg_database WHERE datname=current_database())`);
      expect(rows.rows).toHaveLength(1);
      await pool.query('SELECT pg_terminate_backend($1)', [rows.rows[0].pid]);
      await expect.poll(() => lost.mock.calls.length).toBeGreaterThan(0);
      lease?.release();
      const next = await acquireWorkerLease(pool, () => { throw new Error('unexpected loss'); });
      expect(next).not.toBeNull(); next?.release();
    } finally { lease?.release(); await pool.end(); }
  });
});
