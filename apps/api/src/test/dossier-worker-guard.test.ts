import { afterEach, describe, expect, it, vi } from 'vitest';
import { runGuardedDossierWorker, workerWindowAllows, WORKER_BUDGET_MS } from '../lib/dossier-worker-guard.js';

afterEach(() => vi.useRealTimers());
const localDate = (time: string) => new Date(`2026-11-09T${time}-05:00`);
const fixture = (time = '12:00:00') => ({
  now: vi.fn(() => localDate(time)),
  acquire: vi.fn(async () => ({ release: vi.fn() })),
  run: vi.fn(async () => ({ event: 'dossier_reconcile', exitCode: 0 })),
  terminate: vi.fn((reason: string): never => { throw new Error(reason); })
});

describe('H24 worker admission in America/Cancun', () => {
  it.each([
    ['00:00:00', false], ['06:49:59', false], ['06:50:00', false], ['06:59:59', false],
    ['07:00:00', true], ['21:49:59', true], ['21:50:00', false], ['22:00:00', false]
  ])('%s start allowed: %s', (time, expected) => {
    expect(workerWindowAllows(localDate(time))).toBe(expected);
  });
  it('is independent of UTC date, seasonal host timezone and invalid input', () => {
    expect(workerWindowAllows(new Date('2026-07-01T12:00:00Z'))).toBe(true);
    expect(workerWindowAllows(new Date('2026-11-10T02:49:59Z'))).toBe(true);
    expect(workerWindowAllows(new Date(NaN))).toBe(false);
    expect(workerWindowAllows(localDate('21:54:59'), 'running')).toBe(true);
    expect(workerWindowAllows(localDate('21:55:00'), 'running')).toBe(false);
  });
  it('does not connect outside the window or record a successful cleanup', async () => {
    const deps = fixture('22:00:00');
    expect(await runGuardedDossierWorker(deps)).toMatchObject({ outcome: 'SKIPPED_HOURS', cleanupSucceeded: false });
    expect(deps.acquire).not.toHaveBeenCalled();
    expect(deps.run).not.toHaveBeenCalled();
  });
  it('checks delayed admission again after acquiring the lock', async () => {
    const deps = fixture('21:49:59'), release = vi.fn();
    deps.acquire.mockImplementation(async () => { deps.now.mockReturnValue(localDate('21:50:00')); return { release }; });
    expect(await runGuardedDossierWorker(deps)).toMatchObject({ outcome: 'SKIPPED_HOURS' });
    expect(deps.run).not.toHaveBeenCalled();
    expect(release).toHaveBeenCalledOnce();
  });
  it('skips overlapping runs without claiming success', async () => {
    const deps = fixture();
    expect(await runGuardedDossierWorker({ ...deps, acquire: async () => null }))
      .toMatchObject({ outcome: 'SKIPPED_OVERLAP', cleanupSucceeded: false });
    expect(deps.run).not.toHaveBeenCalled();
  });
  it.each([0, 1])('records actual completed/failed cleanup and releases the lock: %i', async exitCode => {
    const deps = fixture(), release = vi.fn();
    deps.acquire.mockResolvedValue({ release });
    deps.run.mockResolvedValue({ event: 'dossier_reconcile', exitCode });
    expect(await runGuardedDossierWorker(deps)).toMatchObject({
      outcome: exitCode ? 'FAILED' : 'COMPLETED', cleanupSucceeded: !exitCode
    });
    expect(release).toHaveBeenCalledOnce();
  });
  it('releases a failed execution so a retry can run', async () => {
    const deps = fixture(), release = vi.fn();
    deps.acquire.mockResolvedValue({ release });
    deps.run.mockRejectedValueOnce(new Error('synthetic')).mockResolvedValue({ event: 'dossier_reconcile', exitCode: 0 });
    await expect(runGuardedDossierWorker(deps)).rejects.toThrow('synthetic');
    expect(release).toHaveBeenCalledOnce();
    expect(await runGuardedDossierWorker(deps)).toMatchObject({ cleanupSucceeded: true });
  });
  it.each(['elapsed', 'shutdown'] as const)('terminates rather than releasing a still-running job: %s', async reason => {
    vi.useFakeTimers();
    const deps = fixture(), release = vi.fn();
    let complete!: (value: { exitCode: number; event: string }) => void;
    deps.acquire.mockResolvedValue({ release });
    deps.run.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
    const pending = runGuardedDossierWorker(deps);
    await Promise.resolve();
    if (reason === 'shutdown') deps.now.mockReturnValue(localDate('21:55:00'));
    await expect(vi.advanceTimersByTimeAsync(reason === 'elapsed' ? WORKER_BUDGET_MS : 1000)).rejects.toThrow('WORKER_DEADLINE');
    expect(release).not.toHaveBeenCalled();
    // The injected terminator throws for this test only; the entrypoint exits the process.
    deps.now.mockReturnValue(localDate('12:00:00'));
    complete({ event: 'dossier_reconcile', exitCode: 1 });
    if (reason === 'elapsed') await expect(pending).rejects.toThrow('WORKER_DEADLINE');
    else await pending;
    expect(release).toHaveBeenCalledOnce();
  });
  it('a lost lease invokes the fatal terminator', async () => {
    const deps = fixture();
    await expect(runGuardedDossierWorker({ ...deps, acquire: async lost => lost() })).rejects.toThrow('WORKER_LOCK_LOST');
    expect(deps.run).not.toHaveBeenCalled();
  });
  it.each(['acquisition', 'completion'])('rejects elapsed budget before a delayed timer callback at %s', async phase => {
    const deps = fixture(), release = vi.fn();
    deps.acquire.mockResolvedValue({ release });
    const clock = vi.spyOn(performance, 'now').mockReturnValueOnce(0)
      .mockReturnValueOnce(phase === 'acquisition' ? WORKER_BUDGET_MS : 1)
      .mockReturnValue(WORKER_BUDGET_MS);
    try {
      await expect(runGuardedDossierWorker(deps)).rejects.toThrow('WORKER_DEADLINE');
      expect(release).toHaveBeenCalledOnce();
      if (phase === 'acquisition') expect(deps.run).not.toHaveBeenCalled();
    } finally { clock.mockRestore(); }
  });
});
