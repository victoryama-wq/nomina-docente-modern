import type { PayrollExtraDetail, PayrollLine, PayrollPreview, PayrollScheduleDetail } from '../api';

export function payrollDisplayLines(preview: PayrollPreview | null): PayrollLine[] {
  if (!preview) return [];
  return preview.teacherSummaries?.length ? preview.teacherSummaries : preview.lines;
}

export function scheduleDetailsForPayrollLine(
  line: PayrollLine | null,
  details: PayrollScheduleDetail[]
): PayrollScheduleDetail[] {
  if (!line) return [];
  return line.isTeacherAggregate
    ? details.filter((detail) => detail.teacherId === line.teacherId)
    : details.filter((detail) => detail.lineKey === line.key);
}

export function extraDetailsForPayrollLine(
  line: PayrollLine | null,
  details: PayrollExtraDetail[]
): PayrollExtraDetail[] {
  if (!line) return [];
  return line.isTeacherAggregate
    ? details.filter((detail) => detail.teacherId === line.teacherId)
    : details.filter((detail) => detail.lineKey === line.key);
}

export function payrollTeacherScopeLabels(line: PayrollLine): string[] {
  if (!line.scope) return [];
  const labels: string[] = [];
  if (line.scope.ownedByActor) labels.push('Docente bajo mi responsabilidad');
  if (line.scope.inActorCoordination) labels.push('Imparte en mi coordinación');
  if (line.scope.hasOtherCoordinations) labels.push('Carga compartida con otras coordinaciones');
  return labels;
}
