import type { ActorCoordination, SessionUser, Teacher } from '../api';

type TeacherAccessRecord = Pick<Teacher, 'coordinationId' | 'createdById'>;

function hasPermission(session: SessionUser, permission: string): boolean {
  return session.role === 'admin' || session.isProtectedSuperAdmin || session.permissions.includes(permission);
}

export function teacherBelongsToActorScope(
  teacher: Pick<TeacherAccessRecord, 'coordinationId'>,
  actorCoordinations: ActorCoordination[]
): boolean {
  return Boolean(teacher.coordinationId && actorCoordinations.some((coordination) => coordination.id === teacher.coordinationId));
}

export function canEditTeacherOperational(
  session: SessionUser | null,
  teacher: TeacherAccessRecord,
  actorCoordinations: ActorCoordination[]
): boolean {
  if (!session) return false;
  if (session.role === 'admin' || session.isProtectedSuperAdmin) return true;
  if (!hasPermission(session, 'teachers.manage')) return false;
  if (session.role === 'coordinador') return teacherBelongsToActorScope(teacher, actorCoordinations);
  return Boolean(teacher.createdById && teacher.createdById === session.id);
}
