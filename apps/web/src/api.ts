import { auth } from './firebase';
import { apiBaseUrl } from './config';

export type MoneyString = string;

export interface ActorCoordination {
  id: string;
  name: string;
  isPrimary?: boolean;
}

export type UserCoordinationAssignment = {
  id: string;
  name: string;
  isPrimary: boolean;
};

export interface SessionUser {
  id: string;
  firebaseUid: string;
  email: string;
  displayName: string;
  role: 'admin' | 'coordinador' | 'direccion' | 'rh' | 'finanzas' | 'contador' | 'contabilidad';
  status: 'ACTIVO' | 'INACTIVO';
  isProtectedSuperAdmin: boolean;
  permissions: string[];
  actorCoordinations: ActorCoordination[];
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
  code?: string;
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
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
  coordinations: UserCoordinationAssignment[];
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
  createdById: string | null;
  createdByEmail: string;
  createdByName: string;
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
  isPrimary?: boolean;
}

export interface ScheduleResponsibleOption {
  id: string;
  name: string;
  email: string;
  responsibleUserId: string;
  primaryCoordinationId: string | null;
  primaryCoordinationName: string;
  hasTechnicalScope: boolean;
}

export interface CycleOption {
  id: string;
  periodLabel: string;
  quarterCode: string;
  baseHoursStartDate: string | null;
  baseHoursEndDate: string | null;
  module1Start: string;
  module1End: string;
  module2Start: string;
  module2End: string;
  status: 'PLANEACION' | 'ACTIVO' | 'CERRADO';
  scheduleCount?: number;
  calendarPeriodCount?: number;
}

export interface CloseAcademicCyclePayload {
  nextCycleId: string;
  observation?: string;
}

export interface CloseAcademicCycleResponse {
  closedCycle: CycleOption;
  activeCycle: CycleOption;
  quarterClosure: {
    id: string;
    executedAt: string;
  };
  validation: {
    periodCount: number;
    paidPeriods: string[];
    payrollRunIds: string[];
    pendingRuns: number;
    missingPaidPeriods: number;
    scheduleCountNextCycle: number;
  };
  message: string;
}

export interface SubjectOption {
  id: string;
  officialCode?: string | null;
  name: string;
  status?: 'ACTIVO' | 'INACTIVO';
}

export interface TabulatorOption {
  id: string;
  name: string;
  amount: MoneyString;
  sortOrder: number;
}

export interface CatalogSubject {
  id: string;
  officialCode: string | null;
  name: string;
  status: 'ACTIVO' | 'INACTIVO';
  scheduleCount: number;
  activeScheduleCount: number;
}

export interface CatalogTabulator {
  id: string;
  name: string;
  amount: MoneyString;
  status: 'ACTIVO' | 'INACTIVO';
  sortOrder: number;
  scheduleCount: number;
  activeScheduleCount: number;
}

export interface CatalogSummary {
  subjects: {
    total: number;
    active: number;
    inactive: number;
    usedInWorkingCycles: number;
  };
  tabulators: {
    total: number;
    active: number;
    inactive: number;
    usedInWorkingCycles: number;
  };
}

export interface SubjectPayload {
  name: string;
  status: 'ACTIVO' | 'INACTIVO';
}

export interface TabulatorPayload {
  name: string;
  amount: number;
  status: 'ACTIVO' | 'INACTIVO';
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
  tabulatorAmount: MoneyString;
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
  createdById?: string | null;
  createdByEmail: string;
  updatedByEmail: string;
  canEdit: boolean;
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
  responsibleUserId?: string | null;
  coordinationId?: string | null;
  coordinationName: string;
  subjectId: string;
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

export type SubjectImportClassification =
  | 'NUEVA'
  | 'ACTUALIZAR_CLAVE'
  | 'ACTUALIZAR_NOMBRE'
  | 'ACTUALIZAR_ESTATUS'
  | 'ACTUALIZAR_MULTIPLE'
  | 'SIN_CAMBIOS'
  | 'INACTIVAR'
  | 'DUPLICADO_CLAVE_CSV'
  | 'DUPLICADO_NOMBRE_CSV'
  | 'POSIBLE_DUPLICADO_NOMBRE'
  | 'ID_NO_EXISTE'
  | 'ID_CLAVE_INCOMPATIBLE'
  | 'CLAVE_EXISTENTE_NOMBRE_INCOMPATIBLE'
  | 'INACTIVACION_CON_USO_OPERATIVO'
  | 'CAMPO_OBLIGATORIO_FALTANTE'
  | 'ESTATUS_INVALIDO'
  | 'ERROR';

export interface SubjectImportPreviewRow {
  line: number;
  id: string | null;
  officialCode: string | null;
  name: string;
  status: 'ACTIVO' | 'INACTIVO' | null;
  classification: SubjectImportClassification;
  blocking: boolean;
  existingSubjectId: string | null;
  expectedCurrent: { officialCode: string | null; name: string; status: 'ACTIVO' | 'INACTIVO' } | null;
  changes: Array<'officialCode' | 'name' | 'status'>;
  message: string;
}

export interface SubjectImportPreview {
  fileSha256: string;
  catalogFingerprint: string;
  totalRows: number;
  summary: Record<SubjectImportClassification, number>;
  hasBlockingErrors: boolean;
  rows: SubjectImportPreviewRow[];
}

export interface SubjectImportApplyResult {
  inserted: number;
  updated: number;
  unchanged: number;
  total: number;
}

export type TeacherImportTemplateScope = 'blank' | 'active' | 'all';

export type TeacherImportRiskAction =
  | 'REASIGNAR_RESPONSABLE_OPERATIVO'
  | 'INACTIVAR'
  | 'ACTUALIZAR_CATEGORIA'
  | 'ACTUALIZAR_NOMBRE'
  | 'ACTUALIZAR_MULTIPLE';

export type TeacherImportAction =
  | 'NUEVO'
  | 'ACTUALIZAR_IDENTIFICADOR'
  | 'ACTUALIZAR_NOMBRE'
  | 'ACTUALIZAR_RESPONSABLE_OPERATIVO'
  | 'REASIGNAR_RESPONSABLE_OPERATIVO'
  | 'ACTUALIZAR_CATEGORIA'
  | 'ACTUALIZAR_CONTACTO'
  | 'ACTUALIZAR_ESTATUS'
  | 'ACTUALIZAR_MULTIPLE'
  | 'INACTIVAR'
  | 'REACTIVAR'
  | 'SIN_CAMBIOS'
  | 'ID_NO_ENCONTRADO'
  | 'ID_INVALIDO'
  | 'ID_IDENTIFICADOR_INCOMPATIBLE'
  | 'IDENTIFICADOR_DUPLICADO_CSV'
  | 'IDENTIFICADOR_DUPLICADO_BD'
  | 'DUPLICADO_NOMBRE_CSV'
  | 'POSIBLE_DUPLICADO_NOMBRE'
  | 'RESPONSABLE_NO_ENCONTRADO'
  | 'RESPONSABLE_INACTIVO'
  | 'RESPONSABLE_AMBIGUO'
  | 'RESPONSABLE_NO_AUTORIZADO'
  | 'RESPONSABLE_OPERATIVO_REQUERIDO'
  | 'CATEGORIA_INVALIDA'
  | 'ESTATUS_INVALIDO'
  | 'CAMPO_OBLIGATORIO_FALTANTE'
  | 'INACTIVACION_CON_DEPENDENCIAS'
  | 'ERROR';

export interface TeacherImportValues {
  identifier: string;
  firstNames: string;
  paternalLastName: string;
  maternalLastName: string;
  derivedName: string;
  responsibleEmail: string;
  responsibleName: string;
  category: string;
  phone: string;
  location: string;
  status: string;
}

export interface TeacherImportDependencies {
  schedules: number;
  incidences: number;
  extras: number;
  cycles: string[];
}

export interface TeacherImportPreviewRow {
  rowNumber: number;
  teacherId: string | null;
  matchedBy: 'id' | 'identificador' | 'new' | null;
  teacherName: string;
  action: TeacherImportAction;
  blocking: boolean;
  warnings: string[];
  errors: string[];
  current: TeacherImportValues | null;
  proposed: TeacherImportValues | null;
  dependencies?: TeacherImportDependencies;
  message: string;
  changes: Array<'identifier' | 'name' | 'responsible' | 'category' | 'contact' | 'status'>;
}

export interface TeacherImportPreview {
  fileName: string;
  fileSha256: string;
  teachersFingerprint: string;
  responsibleUsersFingerprint: string;
  totalRows: number;
  summary: Partial<Record<TeacherImportAction, number>>;
  hasBlockingErrors: boolean;
  requiresSecondConfirmation: TeacherImportRiskAction[];
  rows: TeacherImportPreviewRow[];
}

export interface TeacherImportApplyResult {
  applied: true;
  fileSha256: string;
  totalRows: number;
  created: number;
  updated: number;
  unchanged: number;
  inactivated: number;
  reactivated: number;
  responsibleAssigned: number;
  responsibleReassigned: number;
  warnings: number;
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
  accessStartAt: string;
  accessEndAt: string;
  accessStatus: 'PENDIENTE' | 'ABIERTO' | 'CERRADO';
  accessOpen: boolean;
  coordinationId: string;
  coordinationName: string;
  teacherId: string;
  teacherName: string;
  teacherCategory: 'V' | 'M' | 'N' | '';
  subjectName: string;
  groupCode: string;
  tabulatorName: string;
  tabulatorAmount: MoneyString;
  weekHours: number;
  mod1Hours: number;
  mod2Hours: number;
  baseHours: number;
  absences: number;
  delays: number;
  extraHoursInSchedule: number;
  incidenceUpdatedAt: string | null;
  incidenceUpdatedByEmail: string;
  hasEligibleOccurrences: boolean;
  eligibilityMessage: string | null;
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
  accessStartAt: string;
  accessEndAt: string;
  accessStatus: 'PENDIENTE' | 'ABIERTO' | 'CERRADO';
  accessOpen: boolean;
  hasPayrollRun: boolean;
}

export interface ExtraAccessPeriod {
  id: string;
  cycleId: string;
  periodLabel: string;
  payrollStart: string;
  payrollEnd: string;
  accessStartAt: string;
  accessEndAt: string;
  accessStatus: 'PENDIENTE' | 'ABIERTO' | 'CERRADO';
  accessOpen: boolean;
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
  suggestedTabulatorAmount: MoneyString;
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
  tabulatorAmount: MoneyString;
  totalAmount: MoneyString;
  reason: string;
  activityDate: string | null;
  reference: string;
  observations: string;
  capturedAt: string;
  capturedByEmail: string;
  updatedAt: string;
  updatedByEmail: string;
  payrollLocked: boolean;
  accessStartAt: string | null;
  accessEndAt: string | null;
  accessStatus: 'PENDIENTE' | 'ABIERTO' | 'CERRADO' | 'SIN_QUINCENA';
  accessOpen: boolean;
  canEdit: boolean;
}

export interface ExtraSummary {
  total: number;
  hours: number;
  amount: MoneyString;
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
  grossBaseAmount: MoneyString;
  absenceDiscountAmount: MoneyString;
  delayDiscountAmount: MoneyString;
  discountAmount: MoneyString;
  scheduleExtraHours: number;
  scheduleExtraAmount: MoneyString;
  loggedExtraHours: number;
  loggedExtraAmount: MoneyString;
  totalExtraHours: number;
  totalExtraAmount: MoneyString;
  totalAmount: MoneyString;
  alerts: number;
}

export interface PayrollLine {
  key: string;
  teacherId: string;
  coordinationId: string;
  teacherName: string;
  coordinationName: string;
  paymentType?: string;
  category: string;
  baseHours: number;
  absences: number;
  delays: number;
  delayDiscountHours: number;
  grossBaseAmount: MoneyString;
  absenceDiscountAmount: MoneyString;
  delayDiscountAmount: MoneyString;
  baseNetAmount: MoneyString;
  scheduleExtraHours: number;
  scheduleExtraAmount: MoneyString;
  loggedExtraHours: number;
  loggedExtraAmount: MoneyString;
  totalExtraHours: number;
  totalExtraAmount: MoneyString;
  totalAmount: MoneyString;
  alerts: string[];
  scheduleCount: number;
  loggedExtraCount: number;
  isTeacherAggregate?: boolean;
  coordinationIds?: string[];
  coordinationNames?: string[];
  scope?: {
    ownedByActor: boolean;
    inActorCoordination: boolean;
    hasOtherCoordinations: boolean;
  };
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
  tabulatorAmount: MoneyString;
  weekdayHours: number;
  module1Hours: number;
  module2Hours: number;
  baseHours: number;
  grossBaseAmount: MoneyString;
  absences: number;
  delays: number;
  delayDiscountHours: number;
  absenceDiscountAmount: MoneyString;
  delayDiscountAmount: MoneyString;
  scheduleExtraHours: number;
  scheduleExtraAmount: MoneyString;
  baseNetAmount: MoneyString;
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
  tabulatorAmount: MoneyString;
  totalAmount: MoneyString;
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
  incidencesAccessStartAt: string;
  incidencesAccessDays: number;
  incidencesAccessEndAt: string;
  extrasAccessStartAt: string;
  extrasAccessDays: number;
  extrasAccessEndAt: string;
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
  incidencesAccessStartAt: string;
  incidencesAccessDays: number;
  extrasAccessStartAt: string;
  extrasAccessDays: number;
  blackoutDates: Array<Pick<CalendarBlackoutDate, 'blackoutDate' | 'reason'>>;
}

export interface CycleModuleDatesPayload {
  baseHoursStartDate: string;
  baseHoursEndDate: string;
  module1Start: string;
  module1End: string;
  module2Start: string;
  module2End: string;
}

export interface AcademicCyclePayload extends CycleModuleDatesPayload {
  periodLabel: string;
  quarterCode: string;
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
  teacherSummaries?: PayrollLine[];
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
  grossBaseAmount: MoneyString;
  discountAmount: MoneyString;
  totalExtraHours: number;
  totalExtraAmount: MoneyString;
  totalAmount: MoneyString;
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
  grossBaseAmount: MoneyString;
  absences: number;
  delays: number;
  absenceDiscountAmount: MoneyString;
  delayDiscountAmount: MoneyString;
  baseNetAmount: MoneyString;
  scheduleExtraHours: number;
  scheduleExtraAmount: MoneyString;
  loggedExtraHours: number;
  loggedExtraAmount: MoneyString;
  totalExtraHours: number;
  totalExtraAmount: MoneyString;
  totalAmount: MoneyString;
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
  tabulatorAmount: MoneyString;
  weekdayHours: number;
  module1Hours: number;
  module2Hours: number;
  baseHours: number;
  grossBaseAmount: MoneyString;
  absences: number;
  delays: number;
  delayDiscountHours: number;
  absenceDiscountAmount: MoneyString;
  delayDiscountAmount: MoneyString;
  scheduleExtraHours: number;
  scheduleExtraAmount: MoneyString;
  baseNetAmount: MoneyString;
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
  tabulatorAmount: MoneyString;
  totalAmount: MoneyString;
}

export interface FinanceCoordinationSummary {
  coordinationId: string;
  coordinationName: string;
  teachers: number;
  lines: number;
  baseHours: number;
  totalExtraHours: number;
  discountAmount: MoneyString;
  totalAmount: MoneyString;
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

export type AuditActionGroup = 'ALL' | 'CREATE' | 'UPDATE' | 'DELETE' | 'PAYROLL' | 'ACCESS' | 'FISCAL';

export interface AuditLogEntry {
  id: string;
  actorUserId: string | null;
  actorEmail: string;
  action: string;
  entityType: string;
  entityId: string | null;
  beforeData: Record<string, unknown> | null;
  afterData: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  recordLabel: string;
}

export interface AuditSummary {
  total: number;
  creates: number;
  updates: number;
  deletions: number;
  payrollEvents: number;
  actors: number;
}

export interface AuditOption {
  value: string;
  total: number;
}

export interface AuditContext {
  logs: AuditLogEntry[];
  summary: AuditSummary;
  options: {
    entityTypes: AuditOption[];
    actions: AuditOption[];
    actors: AuditOption[];
  };
  pagination: {
    limit: number;
    offset: number;
    returned: number;
  };
}

export interface AuditFilters {
  search?: string;
  entityType?: string;
  actionGroup?: AuditActionGroup;
  actorEmail?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

export interface TeacherPayload {
  firstNames: string;
  paternalLastName: string;
  maternalLastName: string;
  degree: string;
  paymentType?: 'E' | '1' | '2' | '';
  category: 'V' | 'M' | 'N';
  location: string;
  comment: string;
  observation: string;
  coordinationId?: string | null;
  coordinationName: string;
  phone: string;
  email?: string;
  rfc?: string;
  externalIdentifier: string;
  bankDetail?: string;
  status: 'ACTIVO' | 'INACTIVO';
  legacyTeacherId?: string;
}

export interface TeacherFiscalPayload {
  paymentType: 'E' | '1' | '2';
  email: string;
  rfc: string;
  bankDetail: string;
}

export interface UserPayload {
  email: string;
  displayName: string;
  roleCode: SessionUser['role'];
  status: 'ACTIVO' | 'INACTIVO';
  notes: string;
  legacyUsername: string;
  coordinationIds?: string[];
}

export type ExportFormat = 'csv' | 'xlsx';
export type OperationalReportSource = 'live' | 'snapshot';
export type OperationalReportSourceFilter = 'auto' | OperationalReportSource;
export type BaseExtraReportTypeFilter = 'all' | 'withExtras' | 'withoutExtras';
export type CategoryHoursStatus = 'completo' | 'faltante' | 'excedido';
export type CategoryHoursStatusFilter = 'all' | CategoryHoursStatus;

export interface BaseExtraReportFilters {
  cycleId?: string;
  calendarConfigId?: string;
  teacherId?: string;
  coordinationId?: string;
  category?: string;
  capturedBy?: string;
  dateFrom?: string;
  dateTo?: string;
  type?: BaseExtraReportTypeFilter;
  source?: OperationalReportSourceFilter;
  q?: string;
}

export interface BaseExtraReportRow {
  source: OperationalReportSource;
  cycleId: string;
  cycleLabel: string;
  calendarConfigId?: string | null;
  periodLabel?: string | null;
  teacherId: string;
  teacherName: string;
  category: string;
  categoryLabel: string;
  coordinationId?: string | null;
  coordinationName?: string | null;
  baseHours: string;
  incidenceExtraHours: string;
  externalExtraHours: string;
  totalExtraHours: string;
  externalExtraCapturedByEmail?: string | null;
  externalExtraCapturedByName?: string | null;
  incidenceUpdatedByEmail?: string | null;
  incidenceUpdatedByName?: string | null;
  reason?: string | null;
  activityDate?: string | null;
}

export interface BaseExtraReportResponse {
  meta: {
    source: OperationalReportSource;
    cycleId: string;
    cycleLabel: string;
    calendarConfigId?: string | null;
    periodLabel?: string | null;
  };
  rows: BaseExtraReportRow[];
}

export interface CategoryHoursReportFilters {
  cycleId?: string;
  coordinationId?: string;
  teacherId?: string;
  category?: string;
  status?: CategoryHoursStatusFilter;
  teacherStatus?: string;
  q?: string;
}

export interface CategoryHoursReportRow {
  cycleId: string;
  cycleLabel: string;
  teacherId: string;
  teacherName: string;
  category: string;
  categoryLabel: string;
  expectedHours: string;
  assignedHours: string;
  remainingHours: string;
  status: CategoryHoursStatus;
  hoursLv: string;
  hoursModule1: string;
  hoursModule2: string;
  coordinationId?: string | null;
  coordinationName?: string | null;
}

export interface CategoryHoursReportResponse {
  meta: {
    cycleId: string;
    coordinatorScope?: string[] | null;
  };
  rows: CategoryHoursReportRow[];
}

export interface OperationalReportCycleFilterOption {
  id: string;
  label: string;
  status: string;
  quarterCode?: string | null;
  periodLabel?: string | null;
}

export interface OperationalReportPayrollPeriodOption {
  calendarConfigId: string;
  payrollRunId?: string | null;
  label: string;
  payrollStart: string;
  payrollEnd: string;
  status?: string | null;
}

async function getIdToken(): Promise<string> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('No hay una sesión activa.');
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
    throw new ApiRequestError(
      body.message || body.error || 'No fue posible completar la solicitud.',
      response.status,
      body.code || body.error || 'ERROR'
    );
  }

  return response.json() as Promise<T>;
}

function queryString(filters: Record<string, unknown>): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    params.set(key, String(value));
  });
  return params.toString() ? `?${params.toString()}` : '';
}

async function downloadAuthenticatedFile(path: string, fallbackFileName: string, errorMessage: string): Promise<void> {
  const token = await getIdToken();
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    let body: ApiErrorBody = {};
    try {
      body = (await response.json()) as ApiErrorBody;
    } catch {
      body = {};
    }
    throw new ApiRequestError(
      body.message || errorMessage,
      response.status,
      body.code || body.error || 'ERROR'
    );
  }

  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') || '';
  const match = /filename="([^"]+)"/.exec(disposition);
  const fileName = match?.[1] || fallbackFileName;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
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
  actorCoordination: CoordinationOption | null;
  actorCoordinations?: CoordinationOption[];
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

export async function updateTeacherFiscal(
  id: string,
  payload: TeacherFiscalPayload
): Promise<{ teacher: Teacher; message: string }> {
  return request(`/teachers/${id}/fiscal`, {
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
    throw new Error(body.message || 'No fue posible generar la exportación.');
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

export async function fetchTeacherConstanciaBlob(teacherId: string): Promise<{
  blob: Blob;
  fileName: string;
  mimeType: string;
}> {
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
    throw new Error(body.message || 'No fue posible obtener la constancia.');
  }

  const disposition = response.headers.get('Content-Disposition') || '';
  const match = /filename="([^"]+)"/.exec(disposition);
  const blob = await response.blob();
  return {
    blob,
    fileName: match?.[1] || 'constancia-fiscal',
    mimeType: response.headers.get('Content-Type') || blob.type || 'application/octet-stream'
  };
}

export async function downloadTeacherConstancia(teacherId: string): Promise<void> {
  const { blob, fileName } = await fetchTeacherConstanciaBlob(teacherId);
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
  const { blob } = await fetchTeacherConstanciaBlob(teacherId);
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function fetchCatalogsContext(): Promise<{
  subjects: CatalogSubject[];
  tabulators: CatalogTabulator[];
  summary: CatalogSummary;
}> {
  return request('/catalogs/context');
}

export async function fetchCatalogSubjects(filters: {
  q?: string;
  status?: 'ACTIVO' | 'INACTIVO' | 'TODOS';
  page?: number;
  pageSize?: number;
} = {}): Promise<{
  subjects: CatalogSubject[];
  pagination: { page: number; pageSize: number; total: number };
}> {
  return request(`/catalogs/subjects${queryString(filters)}`);
}

export async function downloadSubjectImportTemplate(scope: 'blank' | 'catalog' = 'blank'): Promise<void> {
  return downloadAuthenticatedFile(
    `/catalogs/subjects/import/template${queryString({ scope })}`,
    `plantilla-importacion-asignaturas-${scope}.csv`,
    'No fue posible descargar la plantilla de asignaturas.'
  );
}

export async function previewSubjectImport(payload: {
  fileName: string;
  base64Data: string;
}): Promise<{ preview: SubjectImportPreview }> {
  return request('/catalogs/subjects/import/preview', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function applySubjectImport(payload: {
  fileName: string;
  base64Data: string;
  fileSha256: string;
  catalogFingerprint: string;
  confirmed: true;
}): Promise<{ result: SubjectImportApplyResult; message: string }> {
  return request('/catalogs/subjects/import/apply', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function downloadTeacherImportTemplate(scope: TeacherImportTemplateScope): Promise<void> {
  return downloadAuthenticatedFile(
    `/teachers/import/template${queryString({ scope })}`,
    `plantilla-importacion-docentes-${scope}.csv`,
    'No fue posible descargar la plantilla de docentes.'
  );
}

export async function previewTeacherImport(payload: {
  fileName: string;
  base64Data: string;
}): Promise<{ preview: TeacherImportPreview }> {
  return request('/teachers/import/preview', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function applyTeacherImport(payload: {
  fileName: string;
  base64Data: string;
  fileSha256: string;
  teachersFingerprint: string;
  responsibleUsersFingerprint: string;
  confirmedRiskActions: TeacherImportRiskAction[];
}): Promise<{ result: TeacherImportApplyResult; message: string }> {
  return request('/teachers/import/apply', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function createCatalogSubject(payload: SubjectPayload): Promise<{ subject: CatalogSubject; message: string }> {
  return request('/catalogs/subjects', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function updateCatalogSubject(
  id: string,
  payload: SubjectPayload
): Promise<{ subject: CatalogSubject; message: string }> {
  return request(`/catalogs/subjects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export async function createCatalogTabulator(payload: TabulatorPayload): Promise<{ tabulator: CatalogTabulator; message: string }> {
  return request('/catalogs/tabulators', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function updateCatalogTabulator(
  id: string,
  payload: TabulatorPayload
): Promise<{ tabulator: CatalogTabulator; message: string }> {
  return request(`/catalogs/tabulators/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export async function fetchSchedulesContext(cycleId?: string): Promise<{
  activeCycle: CycleOption;
  cycles: CycleOption[];
  schedules: Schedule[];
  teachers: ScheduleTeacher[];
  coordinations: CoordinationOption[];
  responsibles?: ScheduleResponsibleOption[];
  actorCoordination: CoordinationOption | null;
  actorCoordinations?: CoordinationOption[];
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
  actorCoordinations?: CoordinationOption[];
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
  actorCoordinations?: CoordinationOption[];
  coordinations: CoordinationOption[];
  teachers: ExtraTeacher[];
  extras: ExtraRecord[];
  extraAccessPeriods: ExtraAccessPeriod[];
  activeExtraAccessPeriod: ExtraAccessPeriod | null;
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
    throw new Error(body.message || 'No fue posible generar la exportación de nómina.');
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
    throw new Error(body.message || 'No fue posible generar la exportación financiera.');
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

export async function fetchOperationalBaseExtraReport(
  filters: BaseExtraReportFilters = {}
): Promise<BaseExtraReportResponse> {
  return request(`/reports/operational/base-extra${queryString(filters as Record<string, unknown>)}`);
}

export async function fetchOperationalReportCycles(): Promise<{
  cycles: OperationalReportCycleFilterOption[];
}> {
  return request('/reports/operational/filters/cycles');
}

export async function fetchOperationalReportPayrollPeriods(cycleId: string): Promise<{
  periods: OperationalReportPayrollPeriodOption[];
}> {
  return request(`/reports/operational/filters/payroll-periods${queryString({ cycleId })}`);
}

export async function downloadOperationalBaseExtraReport(
  filters: BaseExtraReportFilters = {},
  format: ExportFormat
): Promise<void> {
  const suffix = format === 'xlsx' ? 'xlsx' : 'csv';
  return downloadAuthenticatedFile(
    `/reports/operational/base-extra/export${queryString({ ...filters, format })}`,
    `reporte-horas-base-extras.${suffix}`,
    'No fue posible generar el reporte de horas base y extras.'
  );
}

export async function fetchOperationalCategoryHoursReport(
  filters: CategoryHoursReportFilters
): Promise<CategoryHoursReportResponse> {
  return request(`/reports/operational/category-hours${queryString(filters as Record<string, unknown>)}`);
}

export async function downloadOperationalCategoryHoursReport(
  filters: CategoryHoursReportFilters,
  format: ExportFormat
): Promise<void> {
  const suffix = format === 'xlsx' ? 'xlsx' : 'csv';
  return downloadAuthenticatedFile(
    `/reports/operational/category-hours/export${queryString({ ...filters, format })}`,
    `reporte-horas-base-categoria.${suffix}`,
    'No fue posible generar el reporte de horas base por categoria.'
  );
}

export async function downloadFinancePdf(kind: 'summary' | 'coordinations', runId: string): Promise<void> {
  const token = await getIdToken();
  const endpoint = kind === 'summary' ? 'summary-pdf' : 'coordinations-pdf';
  const response = await fetch(`${apiBaseUrl}/reports/finance/runs/${runId}/${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    let body: ApiErrorBody = {};
    try {
      body = (await response.json()) as ApiErrorBody;
    } catch {
      body = {};
    }
    throw new Error(body.message || 'No fue posible generar el PDF financiero.');
  }

  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') || '';
  const match = /filename="([^"]+)"/.exec(disposition);
  const fileName = match?.[1] || `finanzas-${kind}.pdf`;
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

function auditQueryString(filters: AuditFilters): string {
  const params = new URLSearchParams();
  if (filters.search) params.set('search', filters.search);
  if (filters.entityType) params.set('entityType', filters.entityType);
  if (filters.actionGroup) params.set('actionGroup', filters.actionGroup);
  if (filters.actorEmail) params.set('actorEmail', filters.actorEmail);
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) params.set('dateTo', filters.dateTo);
  if (filters.limit) params.set('limit', String(filters.limit));
  if (filters.offset) params.set('offset', String(filters.offset));
  return params.toString() ? `?${params.toString()}` : '';
}

export async function fetchAuditLogs(filters: AuditFilters = {}): Promise<AuditContext> {
  return request(`/audit/logs${auditQueryString(filters)}`);
}

export async function downloadAuditExport(filters: AuditFilters = {}): Promise<void> {
  const token = await getIdToken();
  const response = await fetch(`${apiBaseUrl}/audit/export${auditQueryString(filters)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    let body: ApiErrorBody = {};
    try {
      body = (await response.json()) as ApiErrorBody;
    } catch {
      body = {};
    }
    throw new Error(body.message || 'No fue posible generar la bitácora.');
  }

  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') || '';
  const match = /filename="([^"]+)"/.exec(disposition);
  const fileName = match?.[1] || 'auditoria-bitacora.csv';
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

export async function createAcademicCycle(payload: AcademicCyclePayload): Promise<{ cycle: CycleOption; message: string }> {
  return request('/calendar/cycles', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function updateAcademicCycle(
  cycleId: string,
  payload: AcademicCyclePayload
): Promise<{ cycle: CycleOption; message: string }> {
  return request(`/calendar/cycles/${cycleId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export async function activateAcademicCycle(cycleId: string): Promise<{ activeCycle: CycleOption; message: string }> {
  return request(`/calendar/cycles/${cycleId}/activate`, {
    method: 'POST'
  });
}

export async function closeAcademicCycle(
  cycleId: string,
  payload: CloseAcademicCyclePayload
): Promise<CloseAcademicCycleResponse> {
  return request(`/calendar/cycles/${cycleId}/close`, {
    method: 'POST',
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
  coordinations: CoordinationOption[];
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
