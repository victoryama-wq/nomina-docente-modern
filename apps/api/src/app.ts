import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import Fastify from 'fastify';
import { config, corsOrigins } from './config.js';
import { registerRoutes } from './routes.js';

export async function buildApp() {
  const app = Fastify({
    bodyLimit: 12 * 1024 * 1024,
    logger: {
      level: config.NODE_ENV === 'production' ? 'info' : 'debug'
    }
  });

  await app.register(helmet, {
    contentSecurityPolicy: false
  });

  await app.register(cors, {
    origin(origin, callback) {
      if (!origin || corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin not allowed: ${origin}`), false);
    },
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    credentials: true
  });

  app.setErrorHandler((error, request, reply) => {
    const appError = error as { code?: string; statusCode?: number; message?: string };
    const dbCode = appError.code;
    const statusCode =
      dbCode === '23505' ? 409 : appError.statusCode && appError.statusCode >= 400 ? appError.statusCode : 400;
    const message =
      dbCode === '23505'
        ? 'Ya existe un registro con esos datos.'
        : appError.message || 'No fue posible completar la solicitud.';

    request.log.warn({ error }, 'Request failed');
    void reply.code(statusCode).send({
      error: dbCode === '23505' ? 'DUPLICATE_RECORD' : 'REQUEST_ERROR',
      message
    });
  });

  await app.register(async (rootApp) => {
    await registerRoutes(rootApp);
  });

  await app.register(
    async (apiApp) => {
      await registerRoutes(apiApp);
    },
    { prefix: '/api' }
  );

  return app;
}
