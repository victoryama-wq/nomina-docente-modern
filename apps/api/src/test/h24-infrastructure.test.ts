import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const read = (name: string) => readFile(new URL(`../../../../ops/h24/${name}`, import.meta.url), 'utf8');
const json = async (name: string) => JSON.parse(await read(name));

describe('H24 offline infrastructure contract (no cloud calls)', () => {
  it('keeps worker storage permissions narrower than API and excludes restore/list/admin', async () => {
    const api = await json('api-storage-role.json'), worker = await json('worker-storage-role.json');
    expect(api.includedPermissions).toEqual(['storage.buckets.get', 'storage.objects.get', 'storage.objects.create', 'storage.objects.delete']);
    expect(worker.includedPermissions).toEqual(['storage.buckets.get', 'storage.objects.get', 'storage.objects.delete']);
  });
  it('ships disarmed, with separate buckets and no analyzer or credential values', async () => {
    const env = await read('worker-env.yaml');
    expect(env).toContain('ALLOW_DOSSIER_RECONCILE: "false"');
    expect(env).toContain('CONSTANCIAS_BUCKET: nomina-docente-prod-constancias');
    expect(env).toContain('DOSSIER_BUCKET: nomina-docente-prod-h24-expedientes');
    expect(env).not.toMatch(/CLAM|SCANNER|PARSER|PASSWORD|PRIVATE_KEY/);
  });
  it('counts only true cleanup completion, never skips or task exit status alone', async () => {
    const metric = await json('cleanup-success-metric.json');
    expect(metric.filter).toContain('jsonPayload.outcome="COMPLETED"');
    expect(metric.filter).toContain('jsonPayload.cleanupSucceeded=true');
    expect(metric.filter).toContain('jsonPayload.exitCode=0');
    expect(metric.metricDescriptor).toMatchObject({ metricKind: 'DELTA', valueType: 'INT64' });
  });
  it('keeps alerts disabled pending recipient and cloud validation, with zero and missing detection', async () => {
    for (const file of ['cleanup-failure-alert.json', 'cleanup-absence-alert.json']) {
      const alert = await json(file);
      expect(alert.enabled).toBe(false);
      expect(alert.notificationChannels).toEqual(['REPLACE_WITH_APPROVED_CHANNEL_RESOURCE']);
    }
    const absence = await json('cleanup-absence-alert.json');
    const condition = absence.conditions[0].conditionPrometheusQueryLanguage;
    expect(condition.query).toContain('sum(sum_over_time(');
    expect(condition.query).toContain('== 0');
    expect(condition.query).toContain('absent_over_time(');
    expect(condition.query).toContain('>= 45000');
    expect(condition.query).toContain('< 7800');
    expect(condition).toMatchObject({ duration: '300s', evaluationInterval: '60s' });
    const failure = await json('cleanup-failure-alert.json');
    expect(failure.conditions[0].conditionMatchedLog.filter).toContain('severity>=ERROR');
  });
  it.each([
    ['07:29:59', false], ['07:30:00', true], ['20:59:59', true],
    ['21:09:59', true], ['21:10:00', false], ['06:59:59', false]
  ])('checks the UTC conversion of the proposed absence window at %s', (time, expected) => {
    const utcSecond = (new Date(`2026-11-09T${time}-05:00`).getTime() / 1000) % 86400;
    expect(utcSecond >= 45000 || utcSecond < 7800).toBe(expected);
  });
});
