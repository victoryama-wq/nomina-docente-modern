import type { Teacher } from '../api';

type TeacherResponsible = Pick<Teacher, 'createdByName' | 'createdByEmail'>;

export function teacherResponsibleLabel(teacher: TeacherResponsible): string {
  return teacher.createdByName.trim() || teacher.createdByEmail.trim() || 'Sin responsable';
}
