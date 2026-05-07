import { auth } from './firebase';
import { apiBaseUrl } from './config';

export interface SessionUser {
  id: string;
  firebaseUid: string;
  email: string;
  displayName: string;
  role: 'admin' | 'coordinador' | 'finanzas' | 'contador' | 'contabilidad';
  status: 'ACTIVO' | 'INACTIVO';
  isProtectedSuperAdmin: boolean;
  permissions: string[];
}

export interface DashboardMetrics {
  teachers: number;
  activeTeachers: number;
  schedules: number;
  extraHoursRecords: number;
  activeUsers: number;
}

interface ApiErrorBody {
  message?: string;
  error?: string;
}

export interface RoleOption {
  id: string;
  code: SessionUser['role'];
  name: string;
  description: string;
}

export interface AccessUser {
  id: string;
  firebaseUid: string | null;
  email: string;
  displayName: string;
  role: SessionUser['role'];
  roleName: string;
  status: 'ACTIVO' | 'INACTIVO';
  notes: string;
  legacyUsername: string;
  legacyRowNumber: number | null;
  isProtectedSuperAdmin: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AccessSummary {
  total: number;
  active: number;
  inactive: number;
  admins: number;
}

export interface Teacher {
  id: string;
  legacyRowNumber: number | null;
  legacyTeacherId: string;
  fullName: string;
  normalizedName: string;
  firstNames: string;
  paternalLastName: string;
  maternalLastName: string;
  degree: string;
  paymentType: 'E' | '1' | '2' | '';
  category: 'V' | 'M' | 'N' | '';
  location: string;
  comment: string;
  observation: string;
  coordinationId: string | null;
  coordinationName: string;
  phone: string;
  email: string;
  rfc: string;
  externalIdentifier: string;
  bankDetail: string;
  status: 'ACTIVO' | 'INACTIVO';
  createdAt: string;
  updatedAt: string;
  createdByEmail: string;
  updatedByEmail: string;
  documentId: string | null;
  documentName: string;
  documentMimeType: string;
  documentUploadedAt: string | null;
}

export interface TeacherSummary {
  total: number;
  active: number;
  inactive: number;
  withRfc: number;
  withBank: number;
  withConstancia: number;
  fiscalReady: number;
}

export interface CoordinationOption {
  id: string;
  name: string;
}

export interface CycleOption {
  id: string;
  periodLabel: string;
  quarterCode: string;
  module1Start: string;
  module1End: string;
  module2Start: string;
  module2End: string;
  status: 'PLANEACION' | 'ACTIVO' | 'CERRADO';
}

export interface SubjectOption {
  id: string;
  name: string;
}

export interface TabulatorOption {
  id: string;
  name: string;
  amount: number;
  sortOrder: number;
}

export interface ScheduleTeacher {
  id: string;
  fullName: string;
  category: 'V' | 'M' | 'N' | '';
  status: 'ACTIVO' | 'INACTIVO';
  coordinationId: string | null;
  coordinationName: string;
  maxHours: number;
  currentWeekHours: number;
  currentS1Hours: number;
  currentS2Hours: number;
  currentMod1Hours: number;
  currentMod2Hours: number;
}

export interface Schedule {
  id: string;
  cycleId: string;
  periodLabel: string;
  quarterCode: string;
  cycleStatus: CycleOption['status'];
  coordinationId: string;
  coordinationName: string;
  teacherId: string;
  teacherName: string;
  teacherCategory: 'V' | 'M' | 'N' | '';
  teacherStatus: 'ACTIVO' | 'INACTIVO';
  subjectId: string | null;
  subjectName: string;
  groupCode: string;
  tabulatorId: string | null;
  tabulatorName: string;
  tabulatorAmount: number;
  hoursL: number;
  hoursM: number;
  hoursX: number;
  hoursJ: number;
  hoursV: number;
  hoursS1: number;
  hoursS2: number;
  weekHours: number;
  mod1Hours: number;
  mod2Hours: number;
  baseHours: number;
  createdAt: string;
  updatedAt: string;
  createdByEmail: string;
  updatedByEmail: string;
}

export interface ScheduleSummary {
  total: number;
  activeTeachers: number;
  weekHours: number;
  mod1Hours: number;
  mod2Hours: number;
  teachersAtLimit: number;
}

export interface SchedulePayload {
  cycleId?: string;
  teacherId: string;
  coordinationId?: string | null;
  coordinationName: string;
  subjectName: string;
  groupCode: string;
  tabulatorId?: string;
  tabulatorName: string;
  tabulatorAmount: number;
  hoursL: number;
  hoursM: number;
  hoursX: number;
  hoursJ: number;
  hoursV: number;
  hoursS1: number;
  hoursS2: number;
}

export interface IncidenceSchedule {
  id: string;
  cycleId: string;
  periodLabel: string;
  quarterCode: string;
  cycleStatus: CycleOption['status'];
  calendarConfigId: string;
  calendarPeriodLabel: string;
  payrollLocked: boolean;
  coordinationId: string;
  coordinationName: string;
  teacherId: string;
  teacherName: string;
  teacherCategory: 'V' | 'M' | 'N' | '';
  subjectName: string;
  groupCode: string;
  tabulatorName: string;
  tabulatorAmount: number;
  weekHours: number;
  mod1Hours: number;
  mod2Hours: number;
  baseHours: number;
  absences: number;
  delays: number;
  extraHoursInSchedule: number;
  incidenceUpdatedAt: string | null;
  incidenceUpdatedByEmail: string;
  canEdit: boolean;
}

export interface IncidenceSummary {
  total: number;
  teachers: number;
  editable: number;
  withIncidences: number;
  absences: number;
  delays: number;
  extraHoursInSchedule: number;
}

export interface IncidencePayload {
  scheduleId?: string;
  calendarConfigId: string;
  absences: number;
  delays: number;
  extraHoursInSchedule: number;
}

export interface IncidenceCalendarPeriod {
  id: string;
  cycleId: string;
  periodLabel: string;
  payrollStart: string;
  payrollEnd: string;
  hasPayrollRun: boolean;
}

export interface ExtraTeacher {
  id: string;
  fullName: string;
  category: 'V' | 'M' | 'N' | '';
  status: 'ACTIVO' | 'INACTIVO';
  coordinationId: string | null;
  coordinationName: string;
  maxHours: number;
  suggestedTabulatorAmount: number;
  scheduleWeekHours: number;
  scheduleMod1Hours: number;
  scheduleMod2Hours: number;
  incidenceExtraHours: number;
  loggedExtraHours: number;
  extraHours: number;
  totalWeekHours: number;
  totalMod1Hours: number;
  totalMod2Hours: number;
  loadStatus: 'DISPONIBLE' | 'CERCA' | 'LIMITE' | 'EXCEDE';
}

export interface ExtraRecord {
  id: string;
  cycleId: string;
  periodLabel: string;
  quarterCode: string;
  cycleStatus: CycleOption['status'];
  coordinationId: string;
  coordinationName: string;
  teacherId: string;
  teacherName: string;
  teacherCategory: 'V' | 'M' | 'N' | '';
  hours: number;
  tabulatorAmount: number;
  totalAmount: number;
  reason: string;
  activityDate: string | null;
  reference: string;
  observations: string;
  capturedAt: string;
  capturedByEmail: string;
  updatedAt: string;
  updatedByEmail: string;
  canEdit: boolean;
}

export interface ExtraSummary {
  total: number;
  hours: number;
  amount: number;
  impactedTeachers: number;
  overloadedTeachers: number;
}

export interface ExtraPayload {
  cycleId?: string;
  coordinationId?: string;
  teacherId: string;
  hours: number;
  tabulatorId?: string;
  tabulatorAmount: number;
  reason: string;
  activityDate?: string;
  reference: string;
  observations: string;
}

export interface PayrollInput {
  calendarConfigId?: string;
  cycleId?: string;
  periodLabel: string;
  payrollStart: string;
  payrollEnd: string;
  module1Start: string;
  module1End: string;
  module2Start: string;
  module2End: string;
}

export interface PayrollCalendar {
  dayCounts: {
    L: number;
    M: number;
    X: number;
    J: number;
    V: number;
  };
  module1Saturdays: number;
  module2Saturdays: number;
  blackoutDates: string[];
}

export interface PayrollSummary {
  lines: number;
  teachers: number;
  coordinations: number;
  baseHours: number;
  grossBaseAmount: number;
  absenceDiscountAmount: number;
  delayDiscountAmount: number;
  discountAmount: number;
  scheduleExtraHours: number;
  scheduleExtraAmount: number;
  loggedExtraHours: number;
  loggedExtraAmount: number;
  totalExtraHours: number;
  totalExtraAmount: number;
  totalAmount: number;
  alerts: number;
}

export interface PayrollLine {
  key: string;
  teacherId: string;
  coordinationId: string;
  teacherName: string;
  coordinationName: string;
  paymentType: string;
  category: string;
  baseHours: number;
  absences: number;
  delays: number;
  delayDiscountHours: number;
  grossBaseAmount: number;
  absenceDiscountAmount: number;
  delayDiscountAmount: number;
  baseNetAmount: number;
  scheduleExtraHours: number;
  scheduleExtraAmount: number;
  loggedExtraHours: number;
  loggedExtraAmount: number;
  totalExtraHours: number;
  totalExtraAmount: number;
  totalAmount: number;
  alerts: string[];
  scheduleCount: number;
  loggedExtraCount: number;
}

export interface PayrollScheduleDetail {
  lineKey: string;
  scheduleId: string;
  teacherId: string;
  coordinationId: string;
  teacherName: string;
  coordinationName: string;
  subjectName: string;
  groupCode: string;
  tabulatorName: string;
  tabulatorAmount: number;
  weekdayHours: number;
  module1Hours: number;
  module2Hours: number;
  baseHours: number;
  grossBaseAmount: number;
  absences: number;
  delays: number;
  delayDiscountHours: number;
  absenceDiscountAmount: number;
  delayDiscountAmount: number;
  scheduleExtraHours: number;
  scheduleExtraAmount: number;
  baseNetAmount: number;
}

export interface PayrollExtraDetail {
  lineKey: string;
  extraId: string;
  teacherId: string;
  coordinationId: string;
  teacherName: string;
  coordinationName: string;
  reason: string;
  activityDate: string | null;
  hours: number;
  tabulatorAmount: number;
  totalAmount: number;
}

export interface PayrollRun {
  id: string;
  cycleId: string;
  cycleLabel: string;
  periodLabel: string;
  status: 'BORRADOR' | 'CALCULADA' | 'EN_REVISION' | 'APROBADA' | 'PAGADA' | 'CERRADA' | 'CANCELADA';
  weights: Record<string, unknown>;
  summary: PayrollSummary;
  calculatedAt: string | null;
  calculatedByEmail: string;
  createdAt: string;
}

export interface CalendarBlackoutDate {
  id?: string;
  configId?: string;
  blackoutDate: string;
  reason: string;
}

export interface CalendarPeriod {
  id: string;
  cycleId: string;
  periodLabel: string;
  payrollStart: string;
  payrollEnd: string;
  module1Start: string;
  module1End: string;
  module2Start: string;
  module2End: string;
  incidencesAccessDays: number;
  extrasAccessDays: number;
  createdAt: string;
  updatedAt: string;
  blackoutDates: CalendarBlackoutDate[];
}

export interface CalendarPeriodPayload {
  cycleId?: string;
  periodLabel: string;
  payrollStart: string;
  payrollEnd: string;
  module1Start: string;
  module1End: string;
  module2Start: string;
  module2End: string;
  incidencesAccessDays: number;
  extrasAccessDays: number;
  blackoutDates: Array<Pick<CalendarBlackoutDate, 'blackoutDate' | 'reason'>>;
}

export interface CycleModuleDatesPayload {
  module1Start: string;
  module1End: string;
  module2Start: string;
  module2End: string;
}

export interface PayrollContext {
  activeCycle: CycleOption;
  cycles: CycleOption[];
  defaults: PayrollInput;
  calendarPeriods: CalendarPeriod[];
  recentRuns: PayrollRun[];
}

export interface PayrollPreview {
  activeCycle: CycleOption;
  input: PayrollInput;
  calendar: PayrollCalendar;
  summary: PayrollSummary;
  lines: PayrollLine[];
  details: PayrollScheduleDetail[];
  extraDetails: PayrollExtraDetail[];
  run?: PayrollRun;
  message?: string;
}

export interface FinanceSummary {
  lines: number;
  teachers: number;
  coordinations: number;
  baseHours: number;
  grossBaseAmount: number;
  discountAmount: number;
  totalExtraHours: number;
  totalExtraAmount: number;
  totalAmount: number;
  alerts: number;
  fiscalPending: number;
  readyPayments: number;
}

export interface FinanceRun {
  id: string;
  cycleId: string;
  cycleLabel: string;
  periodLabel: string;
  status: PayrollRun['status'];
  summary: FinanceSummary;
  calculatedAt: string | null;
  calculatedByEmail: string;
  reviewedAt: string | null;
  reviewedByEmail: string;
  approvedAt: string | null;
  approvedByEmail: string;
  paidAt: string | null;
  paidByEmail: string;
  statusUpdatedAt: string | null;
  statusUpdatedByEmail: string;
  createdAt: string;
}

export interface FinanceLine {
  id: string;
  lineKey: string;
  teacherId: string;
  coordinationId: string;
  teacherName: string;
  coordinationName: string;
  paymentType: string;
  category: string;
  rfc: string;
  email: string;
  bankDetail: string;
  hasConstancia: boolean;
  baseHours: number;
  grossBaseAmount: number;
  absences: number;
  delays: number;
  absenceDiscountAmount: number;
  delayDiscountAmount: number;
  baseNetAmount: number;
  scheduleExtraHours: number;
  scheduleExtraAmount: number;
  loggedExtraHours: number;
  loggedExtraAmount: number;
  totalExtraHours: number;
  totalExtraAmount: number;
  totalAmount: number;
  alerts: string[];
  fiscalMissing: string[];
  paymentStatus: 'LISTO' | 'PENDIENTE';
}

export interface FinanceScheduleDetail {
  lineKey: string;
  scheduleId: string;
  teacherId: string;
  coordinationId: string;
  teacherName: string;
  coordinationName: string;
  subjectName: string;
  groupCode: string;
  tabulatorName: string;
  tabulatorAmount: number;
  weekdayHours: number;
  module1Hours: number;
  module2Hours: number;
  baseHours: number;
  grossBaseAmount: number;
  absences: number;
  delays: number;
  delayDiscountHours: number;
  absenceDiscountAmount: number;
  delayDiscountAmount: number;
  scheduleExtraHours: number;
  scheduleExtraAmount: number;
  baseNetAmount: number;
}

export interface FinanceExtraDetail {
  lineKey: string;
  extraId: string;
  teacherId: string;
  coordinationId: string;
  teacherName: string;
  coordinationName: string;
  reason: string;
  activityDate: string | null;
  hours: number;
  tabulatorAmount: number;
  totalAmount: number;
}

export interface FinanceCoordinationSummary {
  coordinationId: string;
  coordinationName: string;
  teachers: number;
  lines: number;
  baseHours: number;
  totalExtraHours: number;
  discountAmount: number;
  totalAmount: number;
  fiscalPending: number;
  alerts: number;
}

export interface FinanceContext {
  activeCycle: CycleOption | null;
  cycles: CycleOption[];
  actorCoordination: CoordinationOption | null;
  runs: FinanceRun[];
  selectedRun: FinanceRun | null;
  summary: FinanceSummary;
  lines: FinanceLine[];
  coordinationSummary: FinanceCoordinationSummary[];
  scheduleDetails: FinanceScheduleDetail[];
  extraDetails: FinanceExtraDetail[];
}

export interface TeacherPayload {
  firstNames: string;
  paternalLastName: string;
  maternalLastName: string;
  degree: string;
  paymentType: 'E' | '1' | '2';
  category: 'V' | 'M' | 'N';
  location: string;
  comment: string;
  observation: string;
  coordinationName: string;
  phone: string;
  email: string;
  rfc: string;
  externalIdentifier: string;
  bankDetail: string;
  status: 'ACTIVO' | 'INACTIVO';
  legacyTeacherId?: string;
}

export interface UserPayload {
  email: string;
  displayName: string;
  roleCode: SessionUser['role'];
  status: 'ACTIVO' | 'INACTIVO';
  notes: string;
  legacyUsername: string;
}

async function getIdToken(): Promise<string> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('No hay una sesion activa.');
  return currentUser.getIdToken();
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getIdToken();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    ...((options.headers as Record<string, string> | undefined) || {})
  };
  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    let body: ApiErrorBody = {};
    try {
      body = (await response.json()) as ApiErrorBody;
    } catch {
      body = {};
    }
    throw new Error(body.message || body.error || 'No fue posible completar la solicitud.');
  }

  return response.json() as Promise<T>;
}

export async function fetchSession(): Promise<SessionUser> {
  const result = await request<{ user: SessionUser }>('/auth/session');
  return result.user;
}

export async function fetchDashboardOverview(): Promise<{
  user: SessionUser;
  metrics: DashboardMetrics;
}> {
  return request('/dashboard/overview');
}

export async function fetchHealth(): Promise<{ ok: boolean; tables: number; timestamp: string }> {
  const response = await fetch(`${apiBaseUrl}/health`);
  if (!response.ok) throw new Error('API no disponible.');
  return response.json();
}

export async function fetchTeachers(): Promise<{
  teachers: Teacher[];
  summary: TeacherSummary;
  coordinations: CoordinationOption[];
}> {
  return request('/teachers');
}

export async function createTeacher(payload: TeacherPayload): Promise<{ teacher: Teacher; message: string }> {
  return request('/teachers', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function updateTeacher(
  id: string,
  payload: TeacherPayload
): Promise<{ teacher: Teacher; message: string }> {
  return request(`/teachers/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export async function deleteTeacher(id: string): Promise<{ message: string }> {
  return request(`/teachers/${id}`, {
    method: 'DELETE'
  });
}

export async function downloadTeacherExport(kind: 'active' | 'history'): Promise<void> {
  const token = await getIdToken();
  const response = await fetch(`${apiBaseUrl}/teachers/export/${kind}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    let body: ApiErrorBody = {};
    try {
      body = (await response.json()) as ApiErrorBody;
    } catch {
      body = {};
    }
    throw new Error(body.message || 'No fue posible generar la exportacion.');
  }

  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') || '';
  const match = /filename="([^"]+)"/.exec(disposition);
  const fileName = match?.[1] || (kind === 'active' ? 'docentes-activos.csv' : 'docentes-completo-historial.csv');
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export async function uploadTeacherConstancia(
  teacherId: string,
  payload: { fileName: string; mimeType: string; base64Data: string }
): Promise<{ teacher: Teacher; message: string }> {
  return request(`/teachers/${teacherId}/documents/constancia`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function openTeacherConstancia(teacherId: string): Promise<void> {
  const token = await getIdToken();
  const response = await fetch(`${apiBaseUrl}/teachers/${teacherId}/documents/current`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    let body: ApiErrorBody = {};
    try {
      body = (await response.json()) as ApiErrorBody;
    } catch {
      body = {};
    }
    throw new Error(body.message || 'No fue posible abrir la constancia.');
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function fetchSchedulesContext(cycleId?: string): Promise<{
  activeCycle: CycleOption;
  cycles: CycleOption[];
  schedules: Schedule[];
  teachers: ScheduleTeacher[];
  coordinations: CoordinationOption[];
  actorCoordination: CoordinationOption | null;
  subjects: SubjectOption[];
  tabulators: TabulatorOption[];
  summary: ScheduleSummary;
}> {
  const queryString = cycleId ? `?cycleId=${encodeURIComponent(cycleId)}` : '';
  return request(`/schedules/context${queryString}`);
}

export async function createSchedule(payload: SchedulePayload): Promise<{ schedule: Schedule; message: string }> {
  return request('/schedules', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function updateSchedule(
  id: string,
  payload: SchedulePayload
): Promise<{ schedule: Schedule; message: string }> {
  return request(`/schedules/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export async function deleteSchedule(id: string): Promise<{ message: string }> {
  return request(`/schedules/${id}`, {
    method: 'DELETE'
  });
}

export async function fetchIncidencesContext(cycleId?: string, calendarConfigId?: string): Promise<{
  activeCycle: CycleOption;
  cycles: CycleOption[];
  calendarPeriods: IncidenceCalendarPeriod[];
  activeCalendarPeriod: IncidenceCalendarPeriod | null;
  actorCoordination: CoordinationOption | null;
  schedules: IncidenceSchedule[];
  summary: IncidenceSummary;
}> {
  const params = new URLSearchParams();
  if (cycleId) params.set('cycleId', cycleId);
  if (calendarConfigId) params.set('calendarConfigId', calendarConfigId);
  const queryString = params.toString() ? `?${params.toString()}` : '';
  return request(`/incidences/context${queryString}`);
}

export async function updateIncidence(
  scheduleId: string,
  payload: IncidencePayload
): Promise<{ schedule: IncidenceSchedule; message: string }> {
  return request(`/incidences/${scheduleId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export async function updateIncidencesBatch(
  rows: Array<IncidencePayload & { scheduleId: string }>
): Promise<{ schedules: IncidenceSchedule[]; message: string }> {
  return request('/incidences', {
    method: 'PATCH',
    body: JSON.stringify({ rows })
  });
}

export async function fetchExtrasContext(cycleId?: string): Promise<{
  activeCycle: CycleOption;
  cycles: CycleOption[];
  actorCoordination: CoordinationOption | null;
  coordinations: CoordinationOption[];
  teachers: ExtraTeacher[];
  extras: ExtraRecord[];
  tabulators: TabulatorOption[];
  summary: ExtraSummary;
}> {
  const queryString = cycleId ? `?cycleId=${encodeURIComponent(cycleId)}` : '';
  return request(`/extras/context${queryString}`);
}

export async function createExtra(payload: ExtraPayload): Promise<{ extra: ExtraRecord; message: string }> {
  return request('/extras', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function updateExtra(id: string, payload: ExtraPayload): Promise<{ extra: ExtraRecord; message: string }> {
  return request(`/extras/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export async function deleteExtra(id: string): Promise<{ message: string }> {
  return request(`/extras/${id}`, {
    method: 'DELETE'
  });
}

export async function fetchPayrollContext(cycleId?: string): Promise<PayrollContext> {
  const queryString = cycleId ? `?cycleId=${encodeURIComponent(cycleId)}` : '';
  return request(`/payroll/context${queryString}`);
}

export async function previewPayroll(payload: PayrollInput): Promise<PayrollPreview> {
  return request('/payroll/preview', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function savePayrollRun(payload: PayrollInput): Promise<PayrollPreview & { run: PayrollRun; message: string }> {
  return request('/payroll/runs', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function fetchPayrollRun(id: string): Promise<PayrollPreview & { run: PayrollRun }> {
  return request(`/payroll/runs/${id}`);
}

export async function downloadPayrollExport(runId: string, kind: 'summary' | 'schedules' | 'extras'): Promise<void> {
  const token = await getIdToken();
  const response = await fetch(`${apiBaseUrl}/payroll/runs/${runId}/export/${kind}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    let body: ApiErrorBody = {};
    try {
      body = (await response.json()) as ApiErrorBody;
    } catch {
      body = {};
    }
    throw new Error(body.message || 'No fue posible generar la exportacion de nomina.');
  }

  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') || '';
  const match = /filename="([^"]+)"/.exec(disposition);
  const fileName = match?.[1] || `nomina-${kind}.csv`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export async function fetchFinanceContext(cycleId?: string, runId?: string): Promise<FinanceContext> {
  const params = new URLSearchParams();
  if (cycleId) params.set('cycleId', cycleId);
  if (runId) params.set('runId', runId);
  const queryString = params.toString() ? `?${params.toString()}` : '';
  return request(`/reports/finance/context${queryString}`);
}

export async function downloadFinanceExport(kind: 'payments' | 'fiscal' | 'coordinations', runId?: string, cycleId?: string): Promise<void> {
  const token = await getIdToken();
  const params = new URLSearchParams();
  if (cycleId) params.set('cycleId', cycleId);
  if (runId) params.set('runId', runId);
  const queryString = params.toString() ? `?${params.toString()}` : '';
  const response = await fetch(`${apiBaseUrl}/reports/finance/export/${kind}${queryString}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    let body: ApiErrorBody = {};
    try {
      body = (await response.json()) as ApiErrorBody;
    } catch {
      body = {};
    }
    throw new Error(body.message || 'No fue posible generar la exportacion financiera.');
  }

  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') || '';
  const match = /filename="([^"]+)"/.exec(disposition);
  const fileName = match?.[1] || `finanzas-${kind}.csv`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export async function updateFinanceRunStatus(
  runId: string,
  status: Extract<PayrollRun['status'], 'EN_REVISION' | 'APROBADA' | 'PAGADA' | 'CANCELADA'>
): Promise<{ message: string }> {
  return request(`/reports/finance/runs/${runId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  });
}

export async function downloadCashReceipts(runId: string): Promise<void> {
  const token = await getIdToken();
  const response = await fetch(`${apiBaseUrl}/reports/finance/runs/${runId}/cash-receipts`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    let body: ApiErrorBody = {};
    try {
      body = (await response.json()) as ApiErrorBody;
    } catch {
      body = {};
    }
    throw new Error(body.message || 'No fue posible generar los comprobantes de efectivo.');
  }

  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') || '';
  const match = /filename="([^"]+)"/.exec(disposition);
  const fileName = match?.[1] || 'comprobantes-efectivo.pdf';
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export async function fetchCalendarContext(cycleId?: string): Promise<{
  activeCycle: CycleOption;
  cycles: CycleOption[];
  periods: CalendarPeriod[];
}> {
  const queryString = cycleId ? `?cycleId=${encodeURIComponent(cycleId)}` : '';
  return request(`/calendar/context${queryString}`);
}

export async function updateCycleModuleDates(
  cycleId: string,
  payload: CycleModuleDatesPayload
): Promise<{ activeCycle: CycleOption; message: string }> {
  return request(`/calendar/cycles/${cycleId}/modules`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export async function createCalendarPeriod(
  payload: CalendarPeriodPayload
): Promise<{ period: CalendarPeriod; message: string }> {
  return request('/calendar/periods', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function updateCalendarPeriod(
  id: string,
  payload: CalendarPeriodPayload
): Promise<{ period: CalendarPeriod; message: string }> {
  return request(`/calendar/periods/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export async function deleteCalendarPeriod(id: string): Promise<{ period: CalendarPeriod; message: string }> {
  return request(`/calendar/periods/${id}`, {
    method: 'DELETE'
  });
}

export async function fetchAccessUsers(): Promise<{
  users: AccessUser[];
  roles: RoleOption[];
  summary: AccessSummary;
}> {
  return request('/users');
}

export async function createAccessUser(payload: UserPayload): Promise<{ user: AccessUser; message: string }> {
  return request('/users', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function updateAccessUser(
  id: string,
  payload: Partial<UserPayload>
): Promise<{ user: AccessUser; message: string }> {
  return request(`/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export async function deleteAccessUser(id: string): Promise<{ message: string }> {
  return request(`/users/${id}`, {
    method: 'DELETE'
  });
}
