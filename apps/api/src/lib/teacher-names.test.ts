import { describe, expect, it } from 'vitest';
import {
  buildTeacherFullName,
  normalizeTeacherComparableName,
  normalizeTeacherNameComponent,
  normalizeTeacherText
} from './teacher-names.js';

describe('teacher name canonical helpers', () => {
  it('builds the same uppercase full name used by Directory', () => {
    expect(
      buildTeacherFullName({
        firstNames: '  José   Ángel ',
        paternalLastName: 'Muñoz',
        maternalLastName: ' García '
      })
    ).toBe('JOSÉ ÁNGEL MUÑOZ GARCÍA');
  });

  it('keeps visible accents and Ñ while producing an accent-insensitive comparison key', () => {
    expect(normalizeTeacherNameComponent('Iñaki Álvarez')).toBe('IÑAKI ÁLVAREZ');
    expect(normalizeTeacherComparableName('IÑAKI ÁLVAREZ')).toBe('INAKI ALVAREZ');
  });

  it('omits empty maternal names and collapses whitespace', () => {
    expect(
      buildTeacherFullName({
        firstNames: 'Ana  María',
        paternalLastName: 'López',
        maternalLastName: ''
      })
    ).toBe('ANA MARÍA LÓPEZ');
    expect(normalizeTeacherText('  Aula   Centro  ')).toBe('Aula Centro');
  });
});
