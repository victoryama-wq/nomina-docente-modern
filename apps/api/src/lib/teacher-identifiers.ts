export const TEACHER_EXTERNAL_IDENTIFIER_UNIQUE_INDEX = 'teachers_external_identifier_unique_idx';

export class TeacherExternalIdentifierConflictError extends Error {
  readonly code = 'IDENTIFICADOR_DUPLICADO';

  constructor() {
    super('Ya existe otro docente con el mismo identificador institucional.');
    this.name = 'TeacherExternalIdentifierConflictError';
  }
}

export function normalizeTeacherExternalIdentifierKey(value: string): string {
  return value.trim().toUpperCase();
}

export function isTeacherExternalIdentifierConflict(error: unknown): boolean {
  if (error instanceof TeacherExternalIdentifierConflictError) return true;
  if (!error || typeof error !== 'object') return false;

  const databaseError = error as { code?: string; constraint?: string };
  return (
    databaseError.code === '23505' &&
    databaseError.constraint === TEACHER_EXTERNAL_IDENTIFIER_UNIQUE_INDEX
  );
}
