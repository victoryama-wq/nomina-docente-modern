<script setup lang="ts">
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock3,
  CircleDollarSign,
  CreditCard,
  Database,
  Download,
  Edit3,
  FileSpreadsheet,
  FileText,
  FolderLock,
  GraduationCap,
  LayoutDashboard,
  Loader2,
  LockKeyhole,
  LogOut,
  Mail,
  Menu,
  PlusCircle,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  UserCog,
  UserPlus,
  Users,
  WalletCards,
  X
} from 'lucide-vue-next';
import { computed, onMounted, ref } from 'vue';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import {
  createAccessUser,
  createTeacher,
  deleteAccessUser,
  deleteTeacher,
  downloadTeacherExport,
  fetchAccessUsers,
  fetchDashboardOverview,
  fetchHealth,
  fetchSession,
  fetchTeachers,
  openTeacherConstancia,
  updateAccessUser,
  updateTeacher,
  uploadTeacherConstancia,
  createSchedule,
  deleteSchedule,
  fetchSchedulesContext,
  updateSchedule,
  type AccessSummary,
  type AccessUser,
  type CoordinationOption,
  type CycleOption,
  type DashboardMetrics,
  type RoleOption,
  type Schedule,
  type SchedulePayload,
  type ScheduleSummary,
  type ScheduleTeacher,
  type SessionUser,
  type SubjectOption,
  type TabulatorOption,
  type Teacher,
  type TeacherPayload,
  type TeacherSummary,
  type UserPayload
} from './api';
import { auth, googleProvider } from './firebase';

type ViewKey = 'dashboard' | 'teachers' | 'schedules' | 'access';
type ModuleStatus = 'Disponible' | 'Preparando' | 'Migracion';

interface ModuleItem {
  name: string;
  description: string;
  status: ModuleStatus;
  icon: unknown;
  accent: string;
}

const firebaseUser = ref<User | null>(null);
const session = ref<SessionUser | null>(null);
const activeView = ref<ViewKey>('dashboard');
const menuOpen = ref(false);
const teacherModalOpen = ref(false);
const accessModalOpen = ref(false);
const metrics = ref<DashboardMetrics>({
  teachers: 0,
  activeTeachers: 0,
  schedules: 0,
  extraHoursRecords: 0,
  activeUsers: 0
});
const health = ref<{ ok: boolean; tables: number; timestamp: string } | null>(null);
const loading = ref(true);
const signingIn = ref(false);
const pageBusy = ref(false);
const error = ref('');
const notice = ref<{ type: 'ok' | 'error'; text: string } | null>(null);

const teachers = ref<Teacher[]>([]);
const teacherSummary = ref<TeacherSummary>({
  total: 0,
  active: 0,
  inactive: 0,
  withRfc: 0,
  withBank: 0,
  withConstancia: 0,
  fiscalReady: 0
});
const coordinations = ref<CoordinationOption[]>([]);
const teacherSearch = ref('');
const teacherStatusFilter = ref<'TODOS' | 'ACTIVO' | 'INACTIVO'>('TODOS');
const teacherSaving = ref(false);
const teacherUploading = ref(false);
const teacherExporting = ref<'active' | 'history' | ''>('');
const editingTeacherId = ref<string | null>(null);
const selectedConstancia = ref<File | null>(null);

const schedules = ref<Schedule[]>([]);
const scheduleTeachers = ref<ScheduleTeacher[]>([]);
const scheduleCycles = ref<CycleOption[]>([]);
const activeScheduleCycle = ref<CycleOption | null>(null);
const selectedScheduleCycleId = ref('');
const scheduleCoordinations = ref<CoordinationOption[]>([]);
const actorScheduleCoordination = ref<CoordinationOption | null>(null);
const scheduleSubjects = ref<SubjectOption[]>([]);
const scheduleTabulators = ref<TabulatorOption[]>([]);
const scheduleSummary = ref<ScheduleSummary>({
  total: 0,
  activeTeachers: 0,
  weekHours: 0,
  mod1Hours: 0,
  mod2Hours: 0,
  teachersAtLimit: 0
});
const scheduleSearch = ref('');
const scheduleTeacherSearch = ref('');
const scheduleTeacherPickerOpen = ref(false);
const scheduleModalOpen = ref(false);
const scheduleSaving = ref(false);
const scheduleFormError = ref('');
const editingScheduleId = ref<string | null>(null);

const accessUsers = ref<AccessUser[]>([]);
const accessRoles = ref<RoleOption[]>([]);
const accessSummary = ref<AccessSummary>({ total: 0, active: 0, inactive: 0, admins: 0 });
const accessSearch = ref('');
const accessStatusFilter = ref<'TODOS' | 'ACTIVO' | 'INACTIVO'>('TODOS');
const accessSaving = ref(false);
const editingAccessId = ref<string | null>(null);

const modules: ModuleItem[] = [
  {
    name: 'Directorio Docente',
    description: 'Expediente, estatus, datos fiscales y coordinacion.',
    status: 'Disponible',
    icon: GraduationCap,
    accent: 'teal'
  },
  {
    name: 'Control de Accesos',
    description: 'Usuarios autorizados, roles y super admin protegido.',
    status: 'Disponible',
    icon: UserCog,
    accent: 'blue'
  },
  {
    name: 'Horarios',
    description: 'Carga por ciclo con docentes activos.',
    status: 'Disponible',
    icon: CalendarClock,
    accent: 'amber'
  },
  {
    name: 'Extras',
    description: 'Horas adicionales solo para docentes activos.',
    status: 'Preparando',
    icon: PlusCircle,
    accent: 'emerald'
  },
  {
    name: 'Nomina',
    description: 'Motor de calculo y comparacion contra legacy.',
    status: 'Migracion',
    icon: CircleDollarSign,
    accent: 'indigo'
  },
  {
    name: 'Reportes',
    description: 'Exportaciones, historicos y vista financiera.',
    status: 'Migracion',
    icon: FileSpreadsheet,
    accent: 'cyan'
  }
];

const blankTeacher = (): TeacherPayload => ({
  firstNames: '',
  paternalLastName: '',
  maternalLastName: '',
  degree: 'Licenciatura',
  paymentType: '1',
  category: 'N',
  location: 'Local',
  comment: 'Docente activo',
  observation: '',
  coordinationName: '',
  phone: '',
  email: '',
  rfc: '',
  externalIdentifier: '',
  bankDetail: '',
  status: 'ACTIVO'
});

const blankAccessUser = (): UserPayload => ({
  email: '',
  displayName: '',
  roleCode: 'coordinador',
  status: 'ACTIVO',
  notes: '',
  legacyUsername: ''
});

const blankSchedule = (): SchedulePayload => ({
  teacherId: '',
  coordinationId: null,
  coordinationName: '',
  subjectName: '',
  groupCode: '',
  tabulatorId: '',
  tabulatorName: '',
  tabulatorAmount: 0,
  hoursL: 0,
  hoursM: 0,
  hoursX: 0,
  hoursJ: 0,
  hoursV: 0,
  hoursS1: 0,
  hoursS2: 0
});

const teacherForm = ref<TeacherPayload>(blankTeacher());
const scheduleForm = ref<SchedulePayload>(blankSchedule());
const accessForm = ref<UserPayload>(blankAccessUser());

const canManageAccess = computed(() => session.value?.permissions.includes('access.manage') || false);
const canManageTeachers = computed(() => session.value?.permissions.includes('teachers.manage') || false);
const canManageSchedules = computed(() => session.value?.permissions.includes('schedules.manage') || false);
const isAdmin = computed(() => session.value?.role === 'admin');
const canExportTeacherHistory = computed(() => session.value?.permissions.includes('audit.view') || false);
const canViewTeachers = computed(
  () =>
    canManageTeachers.value ||
    session.value?.permissions.includes('finance.view') ||
    session.value?.permissions.includes('reports.view') ||
    false
);

const roleLabel = computed(() => {
  const role = session.value?.role;
  if (role === 'admin') return 'Administrador';
  if (role === 'finanzas') return 'Finanzas';
  if (role === 'contador') return 'Contador';
  if (role === 'contabilidad') return 'Contabilidad';
  return 'Coordinador';
});

const pageTitle = computed(() => {
  if (activeView.value === 'teachers') return 'Directorio Docente';
  if (activeView.value === 'schedules') return 'Capturar Horarios';
  if (activeView.value === 'access') return 'Control de Accesos';
  return 'Centro de control';
});

const initials = computed(() => {
  const base = session.value?.displayName || firebaseUser.value?.displayName || 'ND';
  const parts = base.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
});

const filteredTeachers = computed(() => {
  const text = teacherSearch.value.toLowerCase().trim();
  return teachers.value.filter((teacher) => {
    const matchesStatus = teacherStatusFilter.value === 'TODOS' || teacher.status === teacherStatusFilter.value;
    const haystack = [
      teacher.fullName,
      teacher.rfc,
      teacher.email,
      teacher.phone,
      teacher.externalIdentifier,
      teacher.bankDetail,
      teacher.coordinationName,
      teacher.documentName
    ]
      .join(' ')
      .toLowerCase();
    return matchesStatus && (!text || haystack.includes(text));
  });
});

const selectedScheduleTeacher = computed(
  () => scheduleTeachers.value.find((teacher) => teacher.id === scheduleForm.value.teacherId) || null
);

const currentUserCoordination = computed(() => {
  if (actorScheduleCoordination.value) return actorScheduleCoordination.value;
  const currentName = normalizeMatch(session.value?.displayName || '');
  if (!currentName) return null;
  return scheduleCoordinations.value.find((coordination) => normalizeMatch(coordination.name) === currentName) || null;
});

const currentCoordinatorName = computed(
  () => currentUserCoordination.value?.name || session.value?.displayName || 'Coordinador logeado'
);

const editingSchedule = computed(
  () => schedules.value.find((schedule) => schedule.id === editingScheduleId.value) || null
);

const scheduleFormProjection = computed(() => {
  const teacher = selectedScheduleTeacher.value;
  const edited = editingSchedule.value;
  const weekNew =
    numberValue(scheduleForm.value.hoursL) +
    numberValue(scheduleForm.value.hoursM) +
    numberValue(scheduleForm.value.hoursX) +
    numberValue(scheduleForm.value.hoursJ) +
    numberValue(scheduleForm.value.hoursV);
  const s1New = numberValue(scheduleForm.value.hoursS1);
  const s2New = numberValue(scheduleForm.value.hoursS2);
  let existingWeek = teacher?.currentWeekHours || 0;
  let existingS1 = teacher?.currentS1Hours || 0;
  let existingS2 = teacher?.currentS2Hours || 0;

  if (teacher && edited && edited.teacherId === teacher.id) {
    existingWeek -= edited.weekHours;
    existingS1 -= edited.hoursS1;
    existingS2 -= edited.hoursS2;
  }

  const maxHours = teacher?.maxHours || 0;
  const weekFinal = Math.max(0, existingWeek) + weekNew;
  const mod1Final = weekFinal + Math.max(0, existingS1) + s1New;
  const mod2Final = weekFinal + Math.max(0, existingS2) + s2New;

  return {
    weekNew,
    s1New,
    s2New,
    baseNew: weekNew + s1New + s2New,
    weekFinal,
    mod1Final,
    mod2Final,
    maxHours,
    remainingWeek: maxHours - weekFinal,
    remainingMod1: maxHours - mod1Final,
    remainingMod2: maxHours - mod2Final,
    exceeds: !!teacher && (weekFinal > maxHours || mod1Final > maxHours || mod2Final > maxHours)
  };
});

const scheduleOverallLoadClass = computed(() => {
  const projection = scheduleFormProjection.value;
  if (!selectedScheduleTeacher.value) return '';
  if (projection.exceeds) return 'danger';
  if (
    projection.weekFinal >= projection.maxHours ||
    projection.mod1Final >= projection.maxHours ||
    projection.mod2Final >= projection.maxHours
  ) {
    return 'limit';
  }
  if (
    projection.weekFinal >= projection.maxHours * 0.8 ||
    projection.mod1Final >= projection.maxHours * 0.8 ||
    projection.mod2Final >= projection.maxHours * 0.8
  ) {
    return 'warning';
  }
  return 'ok';
});

const filteredScheduleTeacherOptions = computed(() => {
  const text = scheduleTeacherSearch.value.toLowerCase().trim();
  const selectedId = scheduleForm.value.teacherId;
  const teachers = scheduleTeachers.value.filter((teacher) => {
    if (!text) return true;
    const haystack = [teacher.fullName, teacher.category, teacher.coordinationName].join(' ').toLowerCase();
    return haystack.includes(text);
  });

  return teachers
    .sort((left, right) => {
      if (left.id === selectedId) return -1;
      if (right.id === selectedId) return 1;
      return left.fullName.localeCompare(right.fullName);
    })
    .slice(0, 12);
});

const filteredSchedules = computed(() => {
  const text = scheduleSearch.value.toLowerCase().trim();
  return schedules.value.filter((schedule) => {
    const haystack = [
      schedule.teacherName,
      schedule.teacherCategory,
      schedule.coordinationName,
      schedule.subjectName,
      schedule.groupCode,
      schedule.tabulatorName,
      schedule.periodLabel,
      schedule.quarterCode
    ]
      .join(' ')
      .toLowerCase();
    return !text || haystack.includes(text);
  });
});

const filteredAccessUsers = computed(() => {
  const text = accessSearch.value.toLowerCase().trim();
  return accessUsers.value.filter((user) => {
    const matchesStatus = accessStatusFilter.value === 'TODOS' || user.status === accessStatusFilter.value;
    const haystack = [user.displayName, user.email, user.roleName, user.role, user.notes, user.legacyUsername]
      .join(' ')
      .toLowerCase();
    return matchesStatus && (!text || haystack.includes(text));
  });
});

function setNotice(type: 'ok' | 'error', text: string) {
  notice.value = { type, text };
}

function clearNotice() {
  notice.value = null;
}

function paymentLabel(value: string) {
  if (value === 'E') return 'Efectivo';
  if (value === '1') return 'Santander';
  if (value === '2') return 'Banorte';
  return 'Sin definir';
}

function fiscalPercent(teacher: Teacher) {
  const checks = [teacher.rfc, teacher.bankDetail, teacher.email, teacher.phone, teacher.externalIdentifier, teacher.documentId];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function normalizeMatch(value: string) {
  return value
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function numberValue(value: number | string | null | undefined) {
  return Number(value) || 0;
}

function formatHours(value: number | string | null | undefined) {
  const numeric = numberValue(value);
  return Number.isInteger(numeric) ? numeric.toString() : numeric.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function moneyLabel(value: number | string | null | undefined) {
  return numberValue(value).toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 6
  });
}

function categoryLimitLabel(category: string) {
  if (category === 'V') return 'VIP 35 h';
  if (category === 'M') return 'Medio tiempo 25 h';
  return 'Nuevo ingreso 15 h';
}

function loadLevelClass(value: number, maxHours: number) {
  if (!maxHours) return 'ok';
  if (value > maxHours) return 'danger';
  if (value >= maxHours) return 'limit';
  if (value >= maxHours * 0.8) return 'warning';
  return 'ok';
}

function remainingHoursLabel(value: number, maxHours: number) {
  const remaining = maxHours - value;
  if (remaining < 0) return `Excede ${formatHours(Math.abs(remaining))} h`;
  if (remaining === 0) return 'Al tope';
  return `Faltan ${formatHours(remaining)} h`;
}

async function loadProtectedData() {
  error.value = '';
  try {
    const [sessionData, overview, healthData] = await Promise.all([
      fetchSession(),
      fetchDashboardOverview(),
      fetchHealth()
    ]);
    session.value = sessionData;
    metrics.value = overview.metrics;
    health.value = healthData;
  } catch (err) {
    session.value = null;
    error.value = err instanceof Error ? err.message : 'No fue posible validar tu acceso.';
  } finally {
    loading.value = false;
  }
}

async function loadTeachers() {
  pageBusy.value = true;
  clearNotice();
  try {
    const data = await fetchTeachers();
    teachers.value = data.teachers;
    teacherSummary.value = data.summary;
    coordinations.value = data.coordinations;
  } catch (err) {
    setNotice('error', err instanceof Error ? err.message : 'No fue posible cargar docentes.');
  } finally {
    pageBusy.value = false;
  }
}

async function loadSchedules(cycleId = selectedScheduleCycleId.value || undefined) {
  pageBusy.value = true;
  clearNotice();
  try {
    const data = await fetchSchedulesContext(cycleId);
    activeScheduleCycle.value = data.activeCycle;
    selectedScheduleCycleId.value = data.activeCycle.id;
    scheduleCycles.value = data.cycles;
    schedules.value = data.schedules;
    scheduleTeachers.value = data.teachers;
    scheduleCoordinations.value = data.coordinations;
    actorScheduleCoordination.value = data.actorCoordination;
    scheduleSubjects.value = data.subjects;
    scheduleTabulators.value = data.tabulators;
    scheduleSummary.value = data.summary;
  } catch (err) {
    setNotice('error', err instanceof Error ? err.message : 'No fue posible cargar horarios.');
  } finally {
    pageBusy.value = false;
  }
}

async function loadAccessUsers() {
  pageBusy.value = true;
  clearNotice();
  try {
    const data = await fetchAccessUsers();
    accessUsers.value = data.users;
    accessRoles.value = data.roles;
    accessSummary.value = data.summary;
  } catch (err) {
    setNotice('error', err instanceof Error ? err.message : 'No fue posible cargar usuarios.');
  } finally {
    pageBusy.value = false;
  }
}

async function switchView(view: ViewKey) {
  activeView.value = view;
  menuOpen.value = false;
  clearNotice();
  if (view === 'teachers' && canViewTeachers.value) await loadTeachers();
  if (view === 'schedules' && canManageSchedules.value) await loadSchedules();
  if (view === 'access' && canManageAccess.value) await loadAccessUsers();
}

async function login() {
  signingIn.value = true;
  error.value = '';
  try {
    await signInWithPopup(auth, googleProvider);
    await loadProtectedData();
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'No fue posible iniciar sesion.';
  } finally {
    signingIn.value = false;
  }
}

async function logout() {
  await signOut(auth);
  session.value = null;
  firebaseUser.value = null;
  activeView.value = 'dashboard';
  menuOpen.value = false;
  scheduleModalOpen.value = false;
  teacherModalOpen.value = false;
  accessModalOpen.value = false;
}

function newTeacher() {
  editingTeacherId.value = null;
  teacherForm.value = blankTeacher();
  selectedConstancia.value = null;
  teacherModalOpen.value = true;
  clearNotice();
}

function closeTeacherModal() {
  teacherModalOpen.value = false;
  editingTeacherId.value = null;
  teacherForm.value = blankTeacher();
  selectedConstancia.value = null;
}

function editTeacher(teacher: Teacher) {
  editingTeacherId.value = teacher.id;
  teacherForm.value = {
    firstNames: teacher.firstNames,
    paternalLastName: teacher.paternalLastName,
    maternalLastName: teacher.maternalLastName,
    degree: teacher.degree || 'Licenciatura',
    paymentType: teacher.paymentType === 'E' || teacher.paymentType === '1' || teacher.paymentType === '2' ? teacher.paymentType : '1',
    category: teacher.category === 'V' || teacher.category === 'M' || teacher.category === 'N' ? teacher.category : 'N',
    location: teacher.location || 'Local',
    comment: teacher.comment,
    observation: teacher.observation,
    coordinationName: teacher.coordinationName,
    phone: teacher.phone,
    email: teacher.email,
    rfc: teacher.rfc,
    externalIdentifier: teacher.externalIdentifier,
    bankDetail: teacher.bankDetail,
    status: teacher.status,
    legacyTeacherId: teacher.legacyTeacherId
  };
  selectedConstancia.value = null;
  teacherModalOpen.value = true;
  clearNotice();
}

async function saveTeacher() {
  if (!canManageTeachers.value) return;
  teacherSaving.value = true;
  clearNotice();
  try {
    const response = editingTeacherId.value
      ? await updateTeacher(editingTeacherId.value, teacherForm.value)
      : await createTeacher(teacherForm.value);
    setNotice('ok', response.message);
    closeTeacherModal();
    await loadTeachers();
  } catch (err) {
    setNotice('error', err instanceof Error ? err.message : 'No fue posible guardar el docente.');
  } finally {
    teacherSaving.value = false;
  }
}

function onConstanciaSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  selectedConstancia.value = input.files?.[0] || null;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result?.toString() || '';
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.onerror = () => reject(new Error('No fue posible leer el archivo.'));
    reader.readAsDataURL(file);
  });
}

async function uploadConstancia() {
  if (!editingTeacherId.value || !selectedConstancia.value) return;
  teacherUploading.value = true;
  clearNotice();
  try {
    const file = selectedConstancia.value;
    const base64Data = await readFileAsBase64(file);
    const response = await uploadTeacherConstancia(editingTeacherId.value, {
      fileName: file.name,
      mimeType: file.type,
      base64Data
    });
    setNotice('ok', response.message);
    editTeacher(response.teacher);
    await loadTeachers();
  } catch (err) {
    setNotice('error', err instanceof Error ? err.message : 'No fue posible cargar la constancia.');
  } finally {
    teacherUploading.value = false;
  }
}

async function openConstancia(teacher: Teacher) {
  try {
    await openTeacherConstancia(teacher.id);
  } catch (err) {
    setNotice('error', err instanceof Error ? err.message : 'No fue posible abrir la constancia.');
  }
}

async function exportTeachers(kind: 'active' | 'history') {
  teacherExporting.value = kind;
  clearNotice();
  try {
    await downloadTeacherExport(kind);
    setNotice('ok', kind === 'active' ? 'Exportacion de docentes activos generada.' : 'Exportacion completa con historial generada.');
  } catch (err) {
    setNotice('error', err instanceof Error ? err.message : 'No fue posible exportar docentes.');
  } finally {
    teacherExporting.value = '';
  }
}

async function removeTeacher(teacher: Teacher) {
  if (!isAdmin.value) return;
  const confirmed = window.confirm(`Eliminar docente ${teacher.fullName}? Esta accion no se permitira si tiene historial operativo.`);
  if (!confirmed) return;

  clearNotice();
  try {
    const response = await deleteTeacher(teacher.id);
    setNotice('ok', response.message);
    if (editingTeacherId.value === teacher.id) closeTeacherModal();
    await loadTeachers();
  } catch (err) {
    setNotice('error', err instanceof Error ? err.message : 'No fue posible eliminar el docente.');
  }
}

function newSchedule() {
  editingScheduleId.value = null;
  scheduleTeacherSearch.value = '';
  scheduleTeacherPickerOpen.value = false;
  scheduleFormError.value = '';
  scheduleForm.value = {
    ...blankSchedule(),
    cycleId: selectedScheduleCycleId.value || activeScheduleCycle.value?.id,
    coordinationId: currentUserCoordination.value?.id || null,
    coordinationName: currentUserCoordination.value?.name || (!isAdmin.value ? currentCoordinatorName.value : '')
  };
  scheduleModalOpen.value = true;
  clearNotice();
}

function closeScheduleModal() {
  scheduleModalOpen.value = false;
  editingScheduleId.value = null;
  scheduleForm.value = blankSchedule();
  scheduleTeacherSearch.value = '';
  scheduleTeacherPickerOpen.value = false;
  scheduleFormError.value = '';
}

function applySelectedTeacherDefaults() {
  const teacher = selectedScheduleTeacher.value;
  if (!isAdmin.value) {
    scheduleForm.value.coordinationId = currentUserCoordination.value?.id || null;
    scheduleForm.value.coordinationName = currentCoordinatorName.value;
    return;
  }

  if (!scheduleForm.value.coordinationId) {
    scheduleForm.value.coordinationId = currentUserCoordination.value?.id || teacher?.coordinationId || null;
    scheduleForm.value.coordinationName = currentUserCoordination.value?.name || teacher?.coordinationName || '';
  }
}

function selectScheduleTeacher(teacher: ScheduleTeacher) {
  scheduleForm.value.teacherId = teacher.id;
  scheduleTeacherSearch.value = `${teacher.fullName} / ${categoryLimitLabel(teacher.category)}`;
  scheduleTeacherPickerOpen.value = false;
  scheduleFormError.value = '';
  applySelectedTeacherDefaults();
}

function onScheduleTeacherSearchInput() {
  scheduleTeacherPickerOpen.value = true;
  const selected = selectedScheduleTeacher.value;
  if (!selected) return;
  const expected = `${selected.fullName} / ${categoryLimitLabel(selected.category)}`.toLowerCase();
  if (scheduleTeacherSearch.value.toLowerCase() !== expected) {
    scheduleForm.value.teacherId = '';
  }
}

function applySelectedTabulator() {
  const selected = scheduleTabulators.value.find((tabulator) => tabulator.id === scheduleForm.value.tabulatorId);
  scheduleForm.value.tabulatorName = selected?.name || '';
  scheduleForm.value.tabulatorAmount = Number(selected?.amount || 0);
}

function editSchedule(schedule: Schedule) {
  editingScheduleId.value = schedule.id;
  selectedScheduleCycleId.value = schedule.cycleId;
  activeScheduleCycle.value = {
    id: schedule.cycleId,
    periodLabel: schedule.periodLabel,
    quarterCode: schedule.quarterCode,
    module1Start: '',
    module1End: '',
    module2Start: '',
    module2End: '',
    status: schedule.cycleStatus
  };
  scheduleForm.value = {
    cycleId: schedule.cycleId,
    teacherId: schedule.teacherId,
    coordinationId: isAdmin.value ? schedule.coordinationId : currentUserCoordination.value?.id || null,
    coordinationName: isAdmin.value ? schedule.coordinationName : currentCoordinatorName.value,
    subjectName: schedule.subjectName,
    groupCode: schedule.groupCode,
    tabulatorId: schedule.tabulatorId || '',
    tabulatorName: schedule.tabulatorName,
    tabulatorAmount: Number(schedule.tabulatorAmount || 0),
    hoursL: schedule.hoursL,
    hoursM: schedule.hoursM,
    hoursX: schedule.hoursX,
    hoursJ: schedule.hoursJ,
    hoursV: schedule.hoursV,
    hoursS1: schedule.hoursS1,
    hoursS2: schedule.hoursS2
  };
  scheduleTeacherSearch.value = `${schedule.teacherName} / ${categoryLimitLabel(schedule.teacherCategory)}`;
  scheduleTeacherPickerOpen.value = false;
  scheduleFormError.value = '';
  scheduleModalOpen.value = true;
  clearNotice();
}

async function saveSchedule() {
  if (!canManageSchedules.value) return;
  scheduleFormError.value = '';
  if (!selectedScheduleTeacher.value) {
    scheduleFormError.value = 'Selecciona un docente activo desde el buscador.';
    return;
  }
  if (!scheduleForm.value.tabulatorId) {
    scheduleFormError.value = 'Selecciona un tabulador del catalogo.';
    return;
  }
  if (scheduleFormProjection.value.exceeds) {
    scheduleFormError.value = 'La carga proyectada excede el limite de la categoria docente.';
    return;
  }
  scheduleSaving.value = true;
  clearNotice();
  try {
    const payload = {
      ...scheduleForm.value,
      cycleId: scheduleForm.value.cycleId || selectedScheduleCycleId.value || activeScheduleCycle.value?.id,
      coordinationId: isAdmin.value ? scheduleForm.value.coordinationId : currentUserCoordination.value?.id || null,
      coordinationName: isAdmin.value ? scheduleForm.value.coordinationName : currentCoordinatorName.value
    };
    const response = editingScheduleId.value
      ? await updateSchedule(editingScheduleId.value, payload)
      : await createSchedule(payload);
    setNotice('ok', response.message);
    closeScheduleModal();
    await loadSchedules(payload.cycleId);
  } catch (err) {
    scheduleFormError.value = err instanceof Error ? err.message : 'No fue posible guardar el horario.';
  } finally {
    scheduleSaving.value = false;
  }
}

async function removeSchedule(schedule: Schedule) {
  if (!canManageSchedules.value) return;
  const confirmed = window.confirm(`Eliminar horario de ${schedule.teacherName} en ${schedule.groupCode}?`);
  if (!confirmed) return;

  clearNotice();
  try {
    const response = await deleteSchedule(schedule.id);
    setNotice('ok', response.message);
    if (editingScheduleId.value === schedule.id) closeScheduleModal();
    await loadSchedules(selectedScheduleCycleId.value);
  } catch (err) {
    setNotice('error', err instanceof Error ? err.message : 'No fue posible eliminar el horario.');
  }
}

function newAccessUser() {
  editingAccessId.value = null;
  accessForm.value = blankAccessUser();
  accessModalOpen.value = true;
  clearNotice();
}

function closeAccessModal() {
  accessModalOpen.value = false;
  editingAccessId.value = null;
  accessForm.value = blankAccessUser();
}

function editAccessUser(user: AccessUser) {
  editingAccessId.value = user.id;
  accessForm.value = {
    email: user.email,
    displayName: user.displayName,
    roleCode: user.role,
    status: user.status,
    notes: user.notes,
    legacyUsername: user.legacyUsername
  };
  accessModalOpen.value = true;
  clearNotice();
}

async function saveAccessUser() {
  if (!canManageAccess.value) return;
  accessSaving.value = true;
  clearNotice();
  try {
    const response = editingAccessId.value
      ? await updateAccessUser(editingAccessId.value, accessForm.value)
      : await createAccessUser(accessForm.value);
    setNotice('ok', response.message);
    closeAccessModal();
    await loadAccessUsers();
  } catch (err) {
    setNotice('error', err instanceof Error ? err.message : 'No fue posible guardar el usuario.');
  } finally {
    accessSaving.value = false;
  }
}

async function removeAccessUser(user: AccessUser) {
  if (!canManageAccess.value || user.isProtectedSuperAdmin) return;
  const confirmed = window.confirm(`Eliminar acceso de ${user.displayName}?`);
  if (!confirmed) return;

  clearNotice();
  try {
    const response = await deleteAccessUser(user.id);
    setNotice('ok', response.message);
    if (editingAccessId.value === user.id) closeAccessModal();
    await loadAccessUsers();
  } catch (err) {
    setNotice('error', err instanceof Error ? err.message : 'No fue posible eliminar el usuario.');
  }
}

onMounted(() => {
  onAuthStateChanged(auth, async (user) => {
    firebaseUser.value = user;
    if (user) {
      await loadProtectedData();
    } else {
      loading.value = false;
    }
  });
});
</script>

<template>
  <main class="app-shell">
    <section v-if="loading" class="center-stage">
      <Loader2 class="spin" :size="34" />
      <p>Preparando Nomina Docente...</p>
    </section>

    <section v-else-if="!session" class="login-page">
      <div class="login-panel">
        <div class="brand-mark">
          <ShieldCheck :size="34" />
        </div>
        <div>
          <p class="eyebrow">Tec Playacar</p>
          <h1>Nomina Docente</h1>
          <p class="login-copy">
            Acceso institucional para administrar docentes, roles, operacion academica y control financiero.
          </p>
        </div>

        <button class="primary-action" type="button" :disabled="signingIn" @click="login">
          <Loader2 v-if="signingIn" class="spin" :size="18" />
          <LockKeyhole v-else :size="18" />
          Ingresar con Google institucional
        </button>

        <p class="policy-note">Solo correos autorizados de @tecplayacar.edu.mx pueden acceder.</p>

        <div v-if="error" class="error-box">{{ error }}</div>
      </div>
    </section>

    <section v-else class="workspace">
      <div v-if="menuOpen" class="screen-scrim" @click="menuOpen = false"></div>
      <aside class="sidebar" :class="{ open: menuOpen }">
        <div class="sidebar-brand">
          <div class="sidebar-brand-main">
            <div class="brand-icon"><WalletCards :size="24" /></div>
            <div>
              <strong>Nomina Docente</strong>
              <span>Panel ejecutivo</span>
            </div>
          </div>
          <button class="sidebar-close" type="button" title="Cerrar menu" @click="menuOpen = false">
            <X :size="19" />
          </button>
        </div>

        <nav class="nav-list" aria-label="Modulos">
          <button class="nav-item" :class="{ active: activeView === 'dashboard' }" type="button" @click="switchView('dashboard')">
            <LayoutDashboard :size="18" />
            Dashboard
          </button>
          <button
            v-if="canViewTeachers"
            class="nav-item"
            :class="{ active: activeView === 'teachers' }"
            type="button"
            @click="switchView('teachers')"
          >
            <Users :size="18" />
            Directorio
          </button>
          <button
            v-if="canManageAccess"
            class="nav-item"
            :class="{ active: activeView === 'access' }"
            type="button"
            @click="switchView('access')"
          >
            <UserCog :size="18" />
            Accesos
          </button>
          <button
            v-if="canManageSchedules"
            class="nav-item"
            :class="{ active: activeView === 'schedules' }"
            type="button"
            @click="switchView('schedules')"
          >
            <CalendarClock :size="18" />
            Horarios
          </button>
          <button class="nav-item" type="button" disabled>
            <CircleDollarSign :size="18" />
            Nomina
          </button>
        </nav>

        <div class="sidebar-footer">
          <Database :size="17" />
          <span>Cloud SQL PostgreSQL</span>
        </div>
      </aside>

      <div class="content" @click="menuOpen = false">
        <header class="topbar">
          <div class="title-row">
            <button class="icon-button menu-button" type="button" title="Abrir menu" @click.stop="menuOpen = true">
              <Menu :size="20" />
            </button>
            <div>
              <p class="eyebrow">Operacion academica y financiera</p>
              <h2>{{ pageTitle }}</h2>
            </div>
          </div>
          <div class="user-menu">
            <div class="avatar">{{ initials }}</div>
            <div class="user-text">
              <strong>{{ session.displayName }}</strong>
              <span>{{ roleLabel }} - {{ session.email }}</span>
            </div>
            <button class="icon-button" type="button" title="Cerrar sesion" @click="logout">
              <LogOut :size="18" />
            </button>
          </div>
        </header>

        <div v-if="notice" class="notice" :class="notice.type">
          <CheckCircle2 v-if="notice.type === 'ok'" :size="18" />
          <X v-else :size="18" />
          {{ notice.text }}
        </div>

        <section v-if="activeView === 'dashboard'" class="view-stack">
          <section class="executive-strip">
            <div>
              <p class="eyebrow">Estado de plataforma</p>
              <h3>Base moderna lista para migracion controlada</h3>
              <p>
                Autenticacion con Google, roles desde PostgreSQL y estructura preparada para migrar datos desde Apps Script.
              </p>
            </div>
            <div class="status-pill">
              <BadgeCheck :size="18" />
              Acceso validado
            </div>
          </section>

          <section class="metric-grid">
            <article class="metric-card">
              <span class="metric-icon teal"><GraduationCap :size="20" /></span>
              <p>Docentes activos</p>
              <strong>{{ metrics.activeTeachers }}</strong>
              <small>{{ metrics.teachers }} docentes totales</small>
            </article>
            <article class="metric-card">
              <span class="metric-icon blue"><CalendarClock :size="20" /></span>
              <p>Horarios migrados</p>
              <strong>{{ metrics.schedules }}</strong>
              <small>Registros en base moderna</small>
            </article>
            <article class="metric-card">
              <span class="metric-icon emerald"><Activity :size="20" /></span>
              <p>Extras registrados</p>
              <strong>{{ metrics.extraHoursRecords }}</strong>
              <small>Bitacora nueva</small>
            </article>
            <article class="metric-card">
              <span class="metric-icon indigo"><ShieldCheck :size="20" /></span>
              <p>Usuarios activos</p>
              <strong>{{ metrics.activeUsers }}</strong>
              <small>{{ health?.tables || 0 }} tablas operativas</small>
            </article>
          </section>

          <section class="main-grid">
            <div class="module-board">
              <div class="section-title">
                <div>
                  <p class="eyebrow">Mapa funcional</p>
                  <h3>Modulos prioritarios</h3>
                </div>
                <span class="subtle-pill">Fase base</span>
              </div>

              <div class="module-grid">
                <article v-for="item in modules" :key="item.name" class="module-card" :class="item.accent">
                  <component :is="item.icon" :size="22" />
                  <div>
                    <strong>{{ item.name }}</strong>
                    <p>{{ item.description }}</p>
                  </div>
                  <span>{{ item.status }}</span>
                </article>
              </div>
            </div>

            <aside class="readiness-panel">
              <div class="section-title compact">
                <div>
                  <p class="eyebrow">Ruta inmediata</p>
                  <h3>Migracion activa</h3>
                </div>
              </div>

              <ol class="timeline">
                <li>
                  <span></span>
                  <div>
                    <strong>Directorio y accesos</strong>
                    <p>CRUD moderno con auditoria y reglas de dominio institucional.</p>
                  </div>
                </li>
                <li>
                  <span></span>
                  <div>
                    <strong>Importacion desde Sheets</strong>
                    <p>CSV de Directorio y Coord. Academicos hacia PostgreSQL.</p>
                  </div>
                </li>
                <li>
                  <span></span>
                  <div>
                    <strong>Horarios</strong>
                    <p>Solo docentes con estatus ACTIVO participaran en captura.</p>
                  </div>
                </li>
              </ol>

              <div class="security-box">
                <FolderLock :size="20" />
                <div>
                  <strong>Super admin protegido</strong>
                  <p>victor.yama@tecplayacar.edu.mx no puede ser eliminado ni degradado.</p>
                </div>
              </div>
            </aside>
          </section>
        </section>

        <section v-else-if="activeView === 'teachers'" class="view-stack">
          <section class="toolbar-card">
            <div>
              <p class="eyebrow">Directorio Docente</p>
              <h3>Expedientes y estatus operativo</h3>
            </div>
            <div class="toolbar-actions">
              <button class="secondary-action" type="button" @click="loadTeachers">
                <RefreshCw :size="17" :class="{ spin: pageBusy }" />
                Actualizar
              </button>
              <button v-if="canManageTeachers" class="primary-inline" type="button" @click="newTeacher">
                <UserPlus :size="17" />
                Nuevo docente
              </button>
            </div>
          </section>

          <section class="metric-grid compact">
            <article class="metric-card mini"><p>Total</p><strong>{{ teacherSummary.total }}</strong></article>
            <article class="metric-card mini"><p>Activos</p><strong>{{ teacherSummary.active }}</strong></article>
            <article class="metric-card mini"><p>Con RFC</p><strong>{{ teacherSummary.withRfc }}</strong></article>
            <article class="metric-card mini"><p>Expediente fiscal</p><strong>{{ teacherSummary.fiscalReady }}</strong></article>
          </section>

          <section class="single-grid">
            <div class="data-panel full">
              <div class="filters-row with-actions">
                <label class="search-box">
                  <Search :size="17" />
                  <input v-model="teacherSearch" placeholder="Buscar docente, RFC, correo o coordinacion" />
                </label>
                <select v-model="teacherStatusFilter">
                  <option value="TODOS">Todos</option>
                  <option value="ACTIVO">Activos</option>
                  <option value="INACTIVO">Inactivos</option>
                </select>
                <div class="export-actions">
                  <button class="secondary-action" type="button" :disabled="teacherExporting === 'active'" @click="exportTeachers('active')">
                    <Loader2 v-if="teacherExporting === 'active'" class="spin" :size="16" />
                    <Download v-else :size="16" />
                    Exportar activos
                  </button>
                  <button
                    v-if="canExportTeacherHistory"
                    class="secondary-action"
                    type="button"
                    :disabled="teacherExporting === 'history'"
                    @click="exportTeachers('history')"
                  >
                    <Loader2 v-if="teacherExporting === 'history'" class="spin" :size="16" />
                    <Download v-else :size="16" />
                    Todo + historial
                  </button>
                </div>
              </div>

              <div class="table-shell">
                <table>
                  <thead>
                    <tr>
                      <th>Docente</th>
                      <th>Fiscal</th>
                      <th>Pago</th>
                      <th>Estatus</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="!filteredTeachers.length">
                      <td colspan="5" class="empty-cell">No hay docentes con el filtro actual.</td>
                    </tr>
                    <tr v-for="teacher in filteredTeachers" :key="teacher.id">
                      <td>
                        <strong>{{ teacher.fullName }}</strong>
                        <span><Building2 :size="13" /> {{ teacher.coordinationName || 'Sin coordinacion' }}</span>
                        <span><Mail :size="13" /> {{ teacher.email || 'Sin correo' }}</span>
                      </td>
                      <td>
                        <div class="progress-line">
                          <span :style="{ width: fiscalPercent(teacher) + '%' }"></span>
                        </div>
                        <small>{{ fiscalPercent(teacher) }}% completo</small>
                      </td>
                      <td>
                        <span class="badge neutral"><CreditCard :size="13" /> {{ paymentLabel(teacher.paymentType) }}</span>
                        <small>Categoria {{ teacher.category || '-' }}</small>
                      </td>
                      <td>
                        <span class="badge" :class="teacher.status === 'ACTIVO' ? 'ok' : 'muted'">{{ teacher.status }}</span>
                      </td>
                      <td class="row-actions">
                        <button v-if="teacher.documentId" class="icon-button" type="button" title="Abrir constancia" @click="openConstancia(teacher)">
                          <FileText :size="16" />
                        </button>
                        <button v-if="canManageTeachers" class="icon-button" type="button" title="Editar" @click="editTeacher(teacher)">
                          <Edit3 :size="16" />
                        </button>
                        <button v-if="isAdmin" class="icon-button danger" type="button" title="Eliminar" @click="removeTeacher(teacher)">
                          <Trash2 :size="16" />
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </section>

        <section v-else-if="activeView === 'schedules'" class="view-stack">
          <section class="toolbar-card">
            <div>
              <p class="eyebrow">Capturar Horarios</p>
              <h3>Carga semanal por categoria docente</h3>
            </div>
            <div class="toolbar-actions">
              <select v-if="scheduleCycles.length" v-model="selectedScheduleCycleId" @change="loadSchedules(selectedScheduleCycleId)">
                <option v-for="cycle in scheduleCycles" :key="cycle.id" :value="cycle.id">
                  {{ cycle.periodLabel }} - {{ cycle.quarterCode }} / {{ cycle.status }}
                </option>
              </select>
              <button class="secondary-action" type="button" @click="loadSchedules(selectedScheduleCycleId)">
                <RefreshCw :size="17" :class="{ spin: pageBusy }" />
                Actualizar
              </button>
              <button class="primary-inline" type="button" :disabled="activeScheduleCycle?.status === 'CERRADO'" @click="newSchedule">
                <CalendarClock :size="17" />
                Nuevo horario
              </button>
            </div>
          </section>

          <section class="metric-grid compact">
            <article class="metric-card mini"><p>Registros</p><strong>{{ scheduleSummary.total }}</strong></article>
            <article class="metric-card mini"><p>Docentes activos</p><strong>{{ scheduleSummary.activeTeachers }}</strong></article>
            <article class="metric-card mini"><p>Horas L-V</p><strong>{{ formatHours(scheduleSummary.weekHours) }}</strong></article>
            <article class="metric-card mini"><p>Al limite</p><strong>{{ scheduleSummary.teachersAtLimit }}</strong></article>
          </section>

          <section class="single-grid">
            <div class="data-panel full">
              <div class="filters-row schedules">
                <label class="search-box">
                  <Search :size="17" />
                  <input v-model="scheduleSearch" placeholder="Buscar docente, asignatura, grupo o coordinacion" />
                </label>
                <span class="subtle-pill">
                  <Clock3 :size="16" />
                  {{ activeScheduleCycle?.periodLabel || 'Ciclo operativo' }}
                </span>
              </div>

              <div class="table-shell">
                <table class="schedule-table">
                  <thead>
                    <tr>
                      <th>Docente</th>
                      <th>Asignatura</th>
                      <th>Carga</th>
                      <th>Tabulador</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="!filteredSchedules.length">
                      <td colspan="5" class="empty-cell">No hay horarios con el filtro actual.</td>
                    </tr>
                    <tr v-for="schedule in filteredSchedules" :key="schedule.id">
                      <td>
                        <strong>{{ schedule.teacherName }}</strong>
                        <span><Building2 :size="13" /> {{ schedule.coordinationName }}</span>
                        <small>{{ categoryLimitLabel(schedule.teacherCategory) }}</small>
                      </td>
                      <td>
                        <strong>{{ schedule.subjectName }}</strong>
                        <span>Grupo {{ schedule.groupCode }}</span>
                        <small>{{ schedule.periodLabel }} - {{ schedule.quarterCode }}</small>
                      </td>
                      <td>
                        <div class="hours-row">
                          <span>L {{ formatHours(schedule.hoursL) }}</span>
                          <span>M {{ formatHours(schedule.hoursM) }}</span>
                          <span>X {{ formatHours(schedule.hoursX) }}</span>
                          <span>J {{ formatHours(schedule.hoursJ) }}</span>
                          <span>V {{ formatHours(schedule.hoursV) }}</span>
                          <span>S1 {{ formatHours(schedule.hoursS1) }}</span>
                          <span>S2 {{ formatHours(schedule.hoursS2) }}</span>
                        </div>
                        <small>
                          Semana {{ formatHours(schedule.weekHours) }} h / M1 {{ formatHours(schedule.mod1Hours) }} h / M2
                          {{ formatHours(schedule.mod2Hours) }} h
                        </small>
                      </td>
                      <td>
                        <span class="badge neutral">{{ schedule.tabulatorName }}</span>
                        <small>{{ moneyLabel(schedule.tabulatorAmount) }}</small>
                      </td>
                      <td class="row-actions">
                        <button class="icon-button" type="button" title="Editar" @click="editSchedule(schedule)">
                          <Edit3 :size="16" />
                        </button>
                        <button class="icon-button danger" type="button" title="Eliminar" @click="removeSchedule(schedule)">
                          <Trash2 :size="16" />
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </section>

        <section v-else-if="activeView === 'access'" class="view-stack">
          <section class="toolbar-card">
            <div>
              <p class="eyebrow">Usuarios y roles</p>
              <h3>Accesos autorizados</h3>
            </div>
            <div class="toolbar-actions">
              <button class="secondary-action" type="button" @click="loadAccessUsers">
                <RefreshCw :size="17" :class="{ spin: pageBusy }" />
                Actualizar
              </button>
              <button class="primary-inline" type="button" @click="newAccessUser">
                <UserPlus :size="17" />
                Nuevo acceso
              </button>
            </div>
          </section>

          <section class="metric-grid compact">
            <article class="metric-card mini"><p>Total</p><strong>{{ accessSummary.total }}</strong></article>
            <article class="metric-card mini"><p>Activos</p><strong>{{ accessSummary.active }}</strong></article>
            <article class="metric-card mini"><p>Inactivos</p><strong>{{ accessSummary.inactive }}</strong></article>
            <article class="metric-card mini"><p>Admins</p><strong>{{ accessSummary.admins }}</strong></article>
          </section>

          <section class="single-grid">
            <div class="data-panel full">
              <div class="filters-row">
                <label class="search-box">
                  <Search :size="17" />
                  <input v-model="accessSearch" placeholder="Buscar usuario, correo o rol" />
                </label>
                <select v-model="accessStatusFilter">
                  <option value="TODOS">Todos</option>
                  <option value="ACTIVO">Activos</option>
                  <option value="INACTIVO">Inactivos</option>
                </select>
              </div>

              <div class="table-shell">
                <table>
                  <thead>
                    <tr>
                      <th>Usuario</th>
                      <th>Rol</th>
                      <th>Estatus</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="!filteredAccessUsers.length">
                      <td colspan="4" class="empty-cell">No hay usuarios con el filtro actual.</td>
                    </tr>
                    <tr v-for="user in filteredAccessUsers" :key="user.id">
                      <td>
                        <strong>{{ user.displayName }}</strong>
                        <span><Mail :size="13" /> {{ user.email }}</span>
                        <span v-if="user.isProtectedSuperAdmin"><FolderLock :size="13" /> Super admin protegido</span>
                      </td>
                      <td>
                        <span class="badge neutral">{{ user.roleName }}</span>
                        <small>{{ user.legacyUsername || 'Sin usuario legacy' }}</small>
                      </td>
                      <td>
                        <span class="badge" :class="user.status === 'ACTIVO' ? 'ok' : 'muted'">{{ user.status }}</span>
                      </td>
                      <td class="row-actions">
                        <button class="icon-button" type="button" title="Editar" @click="editAccessUser(user)">
                          <Edit3 :size="16" />
                        </button>
                        <button
                          class="icon-button danger"
                          type="button"
                          title="Eliminar"
                          :disabled="user.isProtectedSuperAdmin"
                          @click="removeAccessUser(user)"
                        >
                          <Trash2 :size="16" />
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </section>

        <div v-if="scheduleModalOpen" class="modal-backdrop" @click.self="closeScheduleModal">
          <form class="modal-card large" @submit.prevent="saveSchedule">
            <div class="modal-header">
              <div>
                <p class="eyebrow">{{ editingScheduleId ? 'Edicion' : 'Alta' }}</p>
                <h3>{{ editingScheduleId ? 'Actualizar horario' : 'Nuevo horario' }}</h3>
              </div>
              <button class="icon-button" type="button" title="Cerrar" @click="closeScheduleModal">
                <X :size="17" />
              </button>
            </div>

            <div class="form-grid">
              <label class="span-2 teacher-picker-field">
                <span>Docente activo</span>
                <div class="combo-box">
                  <Search :size="17" />
                  <input
                    v-model="scheduleTeacherSearch"
                    autocomplete="off"
                    placeholder="Buscar por nombre, categoria o coordinacion"
                    required
                    @focus="scheduleTeacherPickerOpen = true"
                    @input="onScheduleTeacherSearchInput"
                    @keydown.escape="scheduleTeacherPickerOpen = false"
                  />
                  <div v-if="scheduleTeacherPickerOpen" class="combo-list">
                    <button
                      v-for="teacher in filteredScheduleTeacherOptions"
                      :key="teacher.id"
                      type="button"
                      @mousedown.prevent="selectScheduleTeacher(teacher)"
                    >
                      <strong>{{ teacher.fullName }}</strong>
                      <span>{{ categoryLimitLabel(teacher.category) }} / {{ teacher.coordinationName || 'Sin coordinacion' }}</span>
                    </button>
                    <p v-if="!filteredScheduleTeacherOptions.length">Sin coincidencias.</p>
                  </div>
                </div>
              </label>
              <label>
                <span>Coordinacion</span>
                <select v-if="isAdmin" v-model="scheduleForm.coordinationId">
                  <option :value="null">{{ scheduleForm.coordinationName || currentCoordinatorName }}</option>
                  <option v-for="coordination in scheduleCoordinations" :key="coordination.id" :value="coordination.id">
                    {{ coordination.name }}
                  </option>
                </select>
                <input v-else :value="currentCoordinatorName" disabled />
              </label>
              <label>
                <span>Ciclo</span>
                <select v-model="scheduleForm.cycleId" disabled>
                  <option v-for="cycle in scheduleCycles" :key="cycle.id" :value="cycle.id">
                    {{ cycle.periodLabel }} - {{ cycle.quarterCode }}
                  </option>
                </select>
              </label>
              <label>
                <span>Asignatura</span>
                <input v-model.trim="scheduleForm.subjectName" list="schedule-subjects" required />
                <datalist id="schedule-subjects">
                  <option v-for="subject in scheduleSubjects" :key="subject.id" :value="subject.name" />
                </datalist>
              </label>
              <label>
                <span>Grupo</span>
                <input v-model.trim="scheduleForm.groupCode" required />
              </label>
              <label>
                <span>Tabulador</span>
                <select v-model="scheduleForm.tabulatorId" required @change="applySelectedTabulator">
                  <option disabled value="">Selecciona tabulador</option>
                  <option v-for="tabulator in scheduleTabulators" :key="tabulator.id" :value="tabulator.id">
                    {{ tabulator.name }} - {{ moneyLabel(tabulator.amount) }}
                  </option>
                </select>
              </label>
              <label>
                <span>Monto</span>
                <input :value="moneyLabel(scheduleForm.tabulatorAmount)" disabled />
              </label>
              <label>
                <span>Lunes</span>
                <input v-model.number="scheduleForm.hoursL" type="number" min="0" step="0.25" />
              </label>
              <label>
                <span>Martes</span>
                <input v-model.number="scheduleForm.hoursM" type="number" min="0" step="0.25" />
              </label>
              <label>
                <span>Miercoles</span>
                <input v-model.number="scheduleForm.hoursX" type="number" min="0" step="0.25" />
              </label>
              <label>
                <span>Jueves</span>
                <input v-model.number="scheduleForm.hoursJ" type="number" min="0" step="0.25" />
              </label>
              <label>
                <span>Viernes</span>
                <input v-model.number="scheduleForm.hoursV" type="number" min="0" step="0.25" />
              </label>
              <label>
                <span>S1</span>
                <input v-model.number="scheduleForm.hoursS1" type="number" min="0" step="0.25" />
              </label>
              <label>
                <span>S2</span>
                <input v-model.number="scheduleForm.hoursS2" type="number" min="0" step="0.25" />
              </label>
            </div>

            <div v-if="selectedScheduleTeacher" class="schedule-load-strip" :class="scheduleOverallLoadClass">
              <div>
                <strong>{{ selectedScheduleTeacher.fullName }}</strong>
                <span>{{ categoryLimitLabel(selectedScheduleTeacher.category) }}</span>
              </div>
              <span class="load-card" :class="loadLevelClass(scheduleFormProjection.weekFinal, scheduleFormProjection.maxHours)">
                <strong>Semana</strong>
                <b>{{ formatHours(scheduleFormProjection.weekFinal) }} / {{ formatHours(scheduleFormProjection.maxHours) }} h</b>
                <small>{{ remainingHoursLabel(scheduleFormProjection.weekFinal, scheduleFormProjection.maxHours) }}</small>
              </span>
              <span class="load-card" :class="loadLevelClass(scheduleFormProjection.mod1Final, scheduleFormProjection.maxHours)">
                <strong>Mod 1</strong>
                <b>{{ formatHours(scheduleFormProjection.mod1Final) }} / {{ formatHours(scheduleFormProjection.maxHours) }} h</b>
                <small>{{ remainingHoursLabel(scheduleFormProjection.mod1Final, scheduleFormProjection.maxHours) }}</small>
              </span>
              <span class="load-card" :class="loadLevelClass(scheduleFormProjection.mod2Final, scheduleFormProjection.maxHours)">
                <strong>Mod 2</strong>
                <b>{{ formatHours(scheduleFormProjection.mod2Final) }} / {{ formatHours(scheduleFormProjection.maxHours) }} h</b>
                <small>{{ remainingHoursLabel(scheduleFormProjection.mod2Final, scheduleFormProjection.maxHours) }}</small>
              </span>
              <AlertTriangle v-if="scheduleFormProjection.exceeds" :size="18" />
            </div>

            <div v-if="scheduleFormError" class="error-box wide">{{ scheduleFormError }}</div>

            <div class="modal-actions">
              <button class="secondary-action" type="button" @click="closeScheduleModal">Cancelar</button>
              <button class="primary-inline" type="submit" :disabled="scheduleSaving || !selectedScheduleTeacher">
                <Loader2 v-if="scheduleSaving" class="spin" :size="18" />
                <Save v-else :size="18" />
                {{ editingScheduleId ? 'Guardar cambios' : 'Guardar horario' }}
              </button>
            </div>
          </form>
        </div>

        <div v-if="teacherModalOpen" class="modal-backdrop" @click.self="closeTeacherModal">
          <form class="modal-card large" @submit.prevent="saveTeacher">
            <div class="modal-header">
              <div>
                <p class="eyebrow">{{ editingTeacherId ? 'Edicion' : 'Alta' }}</p>
                <h3>{{ editingTeacherId ? 'Actualizar docente' : 'Nuevo docente' }}</h3>
              </div>
              <button class="icon-button" type="button" title="Cerrar" @click="closeTeacherModal">
                <X :size="17" />
              </button>
            </div>

            <div class="form-grid">
              <label>
                <span>Nombre(s)</span>
                <input v-model.trim="teacherForm.firstNames" required />
              </label>
              <label>
                <span>Apellido paterno</span>
                <input v-model.trim="teacherForm.paternalLastName" required />
              </label>
              <label>
                <span>Apellido materno</span>
                <input v-model.trim="teacherForm.maternalLastName" />
              </label>
              <label>
                <span>Grado</span>
                <input v-model.trim="teacherForm.degree" />
              </label>
              <label>
                <span>Tipo de pago</span>
                <select v-model="teacherForm.paymentType" required>
                  <option value="E">Efectivo</option>
                  <option value="1">Santander</option>
                  <option value="2">Banorte</option>
                </select>
              </label>
              <label>
                <span>Categoria</span>
                <select v-model="teacherForm.category" required>
                  <option value="V">V - 35 h</option>
                  <option value="M">M - 25 h</option>
                  <option value="N">N - 15 h</option>
                </select>
              </label>
              <label>
                <span>Ubicacion</span>
                <input v-model.trim="teacherForm.location" />
              </label>
              <label>
                <span>Estatus</span>
                <select v-model="teacherForm.status">
                  <option value="ACTIVO">ACTIVO</option>
                  <option value="INACTIVO">INACTIVO</option>
                </select>
              </label>
              <label>
                <span>Coordinacion</span>
                <input v-model.trim="teacherForm.coordinationName" list="coordinations" />
                <datalist id="coordinations">
                  <option v-for="coordination in coordinations" :key="coordination.id" :value="coordination.name" />
                </datalist>
              </label>
              <label>
                <span>Telefono</span>
                <input v-model.trim="teacherForm.phone" />
              </label>
              <label>
                <span>Correo</span>
                <input v-model.trim="teacherForm.email" type="email" />
              </label>
              <label>
                <span>RFC</span>
                <input v-model.trim="teacherForm.rfc" />
              </label>
              <label>
                <span>Identificador</span>
                <input v-model.trim="teacherForm.externalIdentifier" />
              </label>
              <label>
                <span>Banco / cuenta</span>
                <input v-model.trim="teacherForm.bankDetail" />
              </label>
              <label class="span-2">
                <span>Comentario</span>
                <input v-model.trim="teacherForm.comment" />
              </label>
              <label class="span-2">
                <span>Observacion</span>
                <textarea v-model.trim="teacherForm.observation" rows="3"></textarea>
              </label>
            </div>

            <div v-if="editingTeacherId" class="upload-box">
              <div>
                <strong>Constancia fiscal</strong>
                <span>{{ selectedConstancia?.name || 'Sin archivo seleccionado' }}</span>
              </div>
              <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" @change="onConstanciaSelected" />
              <button class="secondary-action" type="button" :disabled="teacherUploading || !selectedConstancia" @click="uploadConstancia">
                <Upload :size="16" />
                {{ teacherUploading ? 'Cargando...' : 'Cargar' }}
              </button>
            </div>

            <div class="modal-actions">
              <button class="secondary-action" type="button" @click="closeTeacherModal">Cancelar</button>
              <button class="primary-inline" type="submit" :disabled="teacherSaving">
                <Loader2 v-if="teacherSaving" class="spin" :size="18" />
                <Save v-else :size="18" />
                {{ editingTeacherId ? 'Guardar cambios' : 'Guardar docente' }}
              </button>
            </div>
          </form>
        </div>

        <div v-if="accessModalOpen" class="modal-backdrop" @click.self="closeAccessModal">
          <form class="modal-card" @submit.prevent="saveAccessUser">
            <div class="modal-header">
              <div>
                <p class="eyebrow">{{ editingAccessId ? 'Edicion' : 'Alta' }}</p>
                <h3>{{ editingAccessId ? 'Actualizar acceso' : 'Autorizar usuario' }}</h3>
              </div>
              <button class="icon-button" type="button" title="Cerrar" @click="closeAccessModal">
                <X :size="17" />
              </button>
            </div>

            <div class="form-grid one">
              <label>
                <span>Correo institucional</span>
                <input v-model.trim="accessForm.email" type="email" required placeholder="usuario@tecplayacar.edu.mx" />
              </label>
              <label>
                <span>Nombre</span>
                <input v-model.trim="accessForm.displayName" required />
              </label>
              <label>
                <span>Rol</span>
                <select v-model="accessForm.roleCode">
                  <option v-for="role in accessRoles" :key="role.id" :value="role.code">{{ role.name }}</option>
                </select>
              </label>
              <label>
                <span>Estatus</span>
                <select v-model="accessForm.status">
                  <option value="ACTIVO">ACTIVO</option>
                  <option value="INACTIVO">INACTIVO</option>
                </select>
              </label>
              <label>
                <span>Usuario legacy</span>
                <input v-model.trim="accessForm.legacyUsername" />
              </label>
              <label>
                <span>Observacion</span>
                <textarea v-model.trim="accessForm.notes" rows="3"></textarea>
              </label>
            </div>

            <div class="modal-actions">
              <button class="secondary-action" type="button" @click="closeAccessModal">Cancelar</button>
              <button class="primary-inline" type="submit" :disabled="accessSaving">
                <Loader2 v-if="accessSaving" class="spin" :size="18" />
                <Save v-else :size="18" />
                {{ editingAccessId ? 'Guardar cambios' : 'Autorizar acceso' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  </main>
</template>
