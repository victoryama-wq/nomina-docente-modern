import { describe, expect, it } from 'vitest';
import {
  TEACHER_EXTERNAL_IDENTIFIER_UNIQUE_INDEX,
  TeacherExternalIdentifierConflictError,
  isTeacherExternalIdentifierConflict,
  normalizeTeacherExternalIdentifierKey
} from './teacher-identifiers.js';

describe('teacher external identifier helpers', () => {
  it('normalizes comparison keys without changing the identifier contract', () => {
    expect(normalizeTeacherExternalIdentifierKey('  docente-ñ-01  ')).toBe('DOCENTE-Ñ-01');
    expect(normalizeTeacherExternalIdentifierKey('')).toBe('');
  });

  it('recognizes only the approved PostgreSQL unique index conflict', () => {
    expect(
      isTeacherExternalIdentifierConflict({
        code: '23505',
        constraint: TEACHER_EXTERNAL_IDENTIFIER_UNIQUE_INDEX
      })
    ).toBe(true);
    expect(isTeacherExternalIdentifierConflict({ code: '23505', constraint: 'teachers_normalized_name_key' })).toBe(
      false
    );
    expect(
      isTeacherExternalIdentifierConflict({
        code: '23503',
        constraint: TEACHER_EXTERNAL_IDENTIFIER_UNIQUE_INDEX
      })
    ).toBe(false);
    expect(isTeacherExternalIdentifierConflict(new TeacherExternalIdentifierConflictError())).toBe(true);
  });
});
