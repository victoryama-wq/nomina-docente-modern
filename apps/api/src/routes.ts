import type { FastifyInstance } from 'fastify';
import { authenticate } from './auth.js';
import { query } from './db.js';
import { registerCalendarRoutes } from './routes/calendar.js';
import { registerExtraRoutes } from './routes/extras.js';
import { registerIncidenceRoutes } from './routes/incidences.js';
import { registerPayrollRoutes } from './routes/payroll.js';
import { registerScheduleRoutes } from './routes/schedules.js';
import { registerTeacherRoutes } from './routes/teachers.js';
import { registerUserRoutes } from './routes/users.js';

interface CountRow {
  total: string;
}

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => {
    const tables = await query<CountRow>(
      "SELECT count(*)::text AS total FROM information_schema.tables WHERE table_schema = 'public'"
    );

    return {
      ok: true,
      service: 'nomina-docente-api',
      tables: Number(tables[0]?.total || 0),
      timestamp: new Date().toISOString()
    };
  });

  app.get('/auth/session', { preHandler: authenticate }, async (request) => {
    return { user: request.user };
  });

  app.get('/dashboard/overview', { preHandler: authenticate }, async (request) => {
    const [teachers, activeTeachers, schedules, extras, users] = await Promise.all([
      query<CountRow>('SELECT count(*)::text AS total FROM teachers'),
      query<CountRow>("SELECT count(*)::text AS total FROM teachers WHERE status = 'ACTIVO'"),
      query<CountRow>('SELECT count(*)::text AS total FROM schedules'),
      query<CountRow>('SELECT count(*)::text AS total FROM extra_hours'),
      query<CountRow>("SELECT count(*)::text AS total FROM app_users WHERE status = 'ACTIVO'")
    ]);

    return {
      user: request.user,
      metrics: {
        teachers: Number(teachers[0]?.total || 0),
        activeTeachers: Number(activeTeachers[0]?.total || 0),
        schedules: Number(schedules[0]?.total || 0),
        extraHoursRecords: Number(extras[0]?.total || 0),
        activeUsers: Number(users[0]?.total || 0)
      }
    };
  });

  await registerUserRoutes(app);
  await registerTeacherRoutes(app);
  await registerScheduleRoutes(app);
  await registerIncidenceRoutes(app);
  await registerExtraRoutes(app);
  await registerPayrollRoutes(app);
  await registerCalendarRoutes(app);
}
