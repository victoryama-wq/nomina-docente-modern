import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { contactSchema, dossierParams } from '../lib/dossier-contract.js';

describe('PD-06 Zod 4 compatibility and bounded collection validation', () => {
  it.each([
    '00000000-0000-0000-0000-000000000001',
    'ABCDEF01-2345-6789-0123-ABCDEF012345',
    '11111111-1111-4111-8111-111111111111',
    'ffffffff-ffff-ffff-ffff-ffffffffffff'
  ])('preserves the historical UUID acceptance and lowercase projection: %s', (id) => {
    expect(dossierParams.parse({ teacherId: id }).teacherId).toBe(id.toLowerCase());
  });

  it.each(['not-a-uuid', '1', '00000000-0000-0000-0000-00000000000g',
    ' 11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111\n'])('still rejects malformed identifiers: %s', (id) => {
    const result = dossierParams.safeParse({ teacherId: id });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toBe('Invalid uuid');
  });

  it('preserves strict contact fields, formatting and optimistic concurrency data', () => {
    const input = { operationId: 'ABCDEF01-2345-6789-0123-ABCDEF012345',
      phone: '+52 (998) 123-4567', expectedVersion: 'unchanged-version' };
    expect(contactSchema.parse(input)).toEqual({ ...input,
      operationId: input.operationId.toLowerCase(), phone: '+529981234567' });
    expect(contactSchema.safeParse({ ...input, role: 'admin' }).success).toBe(false);
    expect(contactSchema.safeParse({ ...input, expectedVersion: undefined }).success).toBe(false);
  });

  it('rejects an oversized bounded array before visiting elements (GHSA-mrhx-c7xc-m3w5)', () => {
    let visited = 0;
    const schema = z.array(z.string().superRefine(() => { visited++; })).max(500);
    const result = schema.safeParse(Array.from({ length: 501 }, () => 'synthetic'));
    expect(result.success).toBe(false);
    expect(visited).toBe(0);
    if (!result.success) expect(result.error.issues).toHaveLength(1);
    expect(schema.safeParse(Array.from({ length: 500 }, () => 'synthetic')).success).toBe(true);
    expect(visited).toBe(500);
  });
});
