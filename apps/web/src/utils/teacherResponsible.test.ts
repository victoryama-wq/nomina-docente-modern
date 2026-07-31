import { describe, expect, it } from 'vitest';
import { teacherResponsibleLabel } from './teacherResponsible';

describe('teacherResponsibleLabel', () => {
  it('shows the responsible display name when created_by resolves to an active user', () => {
    expect(
      teacherResponsibleLabel({
        createdByName: 'Coordinación Idiomas',
        createdByEmail: 'qa.coordinador.idiomas@tecplayacar.edu.mx'
      })
    ).toBe('Coordinación Idiomas');
  });

  it('uses the operational email only when a display name is unavailable', () => {
    expect(
      teacherResponsibleLabel({
        createdByName: '',
        createdByEmail: 'qa.coordinador.idiomas@tecplayacar.edu.mx'
      })
    ).toBe('qa.coordinador.idiomas@tecplayacar.edu.mx');
  });

  it('keeps the legacy fallback only when created_by has no resolvable user', () => {
    expect(teacherResponsibleLabel({ createdByName: '', createdByEmail: '' })).toBe('Sin responsable');
  });
});
