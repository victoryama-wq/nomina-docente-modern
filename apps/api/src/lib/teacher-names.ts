export interface TeacherNameComponents {
  firstNames: string;
  paternalLastName: string;
  maternalLastName?: string;
}

export function normalizeTeacherText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function normalizeTeacherNameComponent(value: string): string {
  return normalizeTeacherText(value).toUpperCase();
}

export function normalizeTeacherComparableName(value: string): string {
  return normalizeTeacherNameComponent(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildTeacherFullName(components: TeacherNameComponents): string {
  return [
    components.firstNames,
    components.paternalLastName,
    components.maternalLastName || ''
  ]
    .map(normalizeTeacherNameComponent)
    .filter(Boolean)
    .join(' ');
}
