import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TEACHER_EXTERNAL_IDENTIFIER_UNIQUE_INDEX } from '../lib/teacher-identifiers.js';
import { injectAs } from './auth-test-utils.js';
import { cleanupTestApp, describeIntegration, freshTestApp } from './api-integration-helpers.js';
import { connectTestDb } from './db/test-db-utils.js';
import { adminActor } from './fixtures/index.js';

const describeIfDb = describeIntegration ? describe : describe.skip;

function teacherPayload(sequence: number, externalIdentifier: string) {
  return {
    firstNames: `Docente H22 ${sequence}`,
    paternalLastName: 'Identificador',
    maternalLastName: 'QA',
    category: 'N',
    externalIdentifier,
    status: 'ACTIVO'
  };
}

describeIfDb('H22 teacher external identifier integrity', () => {
  let app: FastifyInstance | null = null;

  beforeEach(async () => {
    app = await freshTestApp();
  });

  afterEach(async () => {
    await cleanupTestApp(app);
    app = null;
  });

  async function createTeacher(sequence: number, externalIdentifier: string) {
    return injectAs(app!, adminActor(), {
      method: 'POST',
      url: '/api/teachers',
      payload: teacherPayload(sequence, externalIdentifier)
    });
  }

  it('allows new identifiers and multiple empty legacy identifiers', async () => {
    expect((await createTeacher(1, 'H22-NEW-001')).statusCode).toBe(201);
    expect((await createTeacher(2, '')).statusCode).toBe(201);
    expect((await createTeacher(3, '   ')).statusCode).toBe(201);
  });

  it.each([
    ['exacto', 'H22-DUP-001'],
    ['mayusculas/minusculas', 'h22-dup-001'],
    ['espacios laterales', '  H22-DUP-001  ']
  ])('blocks a %s duplicate with a stable safe conflict response', async (_caseName, duplicateValue) => {
    expect((await createTeacher(10, 'H22-DUP-001')).statusCode).toBe(201);

    const duplicate = await createTeacher(11, duplicateValue);
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json()).toEqual({
      error: 'IDENTIFICADOR_DUPLICADO',
      code: 'IDENTIFICADOR_DUPLICADO',
      message: 'Ya existe otro docente con el mismo identificador institucional.'
    });
    expect(JSON.stringify(duplicate.json())).not.toMatch(
      /23505|constraint|duplicate key|teachers_external|INSERT INTO|UPDATE teachers/i
    );
  });

  it('allows keeping the current identifier and blocks changing to another teacher identifier', async () => {
    const first = await createTeacher(20, 'H22-EDIT-001');
    const second = await createTeacher(21, 'H22-EDIT-002');
    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(201);

    const firstId = first.json().teacher.id as string;
    const secondId = second.json().teacher.id as string;

    const unchanged = await injectAs(app!, adminActor(), {
      method: 'PATCH',
      url: `/api/teachers/${firstId}`,
      payload: teacherPayload(20, ' h22-edit-001 ')
    });
    expect(unchanged.statusCode).toBe(200);
    expect(unchanged.json().teacher.externalIdentifier).toBe('H22-EDIT-001');

    const conflict = await injectAs(app!, adminActor(), {
      method: 'PATCH',
      url: `/api/teachers/${secondId}`,
      payload: teacherPayload(21, 'H22-EDIT-001')
    });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json().code).toBe('IDENTIFICADOR_DUPLICADO');
  });

  it('keeps normalized_name uniqueness independent from identifier conflicts', async () => {
    expect((await createTeacher(30, 'H22-NAME-001')).statusCode).toBe(201);

    const sameName = await createTeacher(30, 'H22-NAME-002');
    expect(sameName.statusCode).toBe(409);
    expect(sameName.json().error).toBe('DUPLICATE_RECORD');
    expect(sameName.json().error).not.toBe('IDENTIFICADOR_DUPLICADO');
  });

  it('uses PostgreSQL as the final authority for canonical identifier uniqueness', async () => {
    const client = await connectTestDb();
    try {
      await client.query(
        `
          INSERT INTO teachers (
            full_name,
            normalized_name,
            first_names,
            paternal_last_name,
            category,
            external_identifier,
            created_by,
            updated_by
          )
          VALUES (
            'Docente H22 Indice Uno',
            'docente h22 indice uno',
            'Docente H22',
            'Indice Uno',
            'N',
            ' H22-INDEX-001 ',
            $1,
            $1
          )
        `,
        [adminActor().id]
      );

      await expect(
        client.query(
          `
            INSERT INTO teachers (
              full_name,
              normalized_name,
              first_names,
              paternal_last_name,
              category,
              external_identifier,
              created_by,
              updated_by
            )
            VALUES (
              'Docente H22 Indice Dos',
              'docente h22 indice dos',
              'Docente H22',
              'Indice Dos',
              'N',
              'h22-index-001',
              $1,
              $1
            )
          `,
          [adminActor().id]
        )
      ).rejects.toMatchObject({
        code: '23505',
        constraint: TEACHER_EXTERNAL_IDENTIFIER_UNIQUE_INDEX
      });
    } finally {
      await client.end();
    }
  });
});
