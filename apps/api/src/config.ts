import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8080),
  GCP_PROJECT_ID: z.string().default('nomina-docente-prod'),
  FIREBASE_PROJECT_ID: z.string().default('nomina-docente-prod'),
  ALLOWED_EMAIL_DOMAIN: z.string().default(''), // TODO: Cambiar a 'tecplayacar.edu.mx' en prod
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  DB_NAME: z.string().default('nomina_docente'),
  DB_USER: z.string().default('app_nomina'),
  DB_PASSWORD: z.string().optional(),
  DB_HOST: z.string().optional(),
  DB_PORT: z.coerce.number().int().positive().default(5432),
  INSTANCE_CONNECTION_NAME: z.string().optional(),
  CONSTANCIAS_BUCKET: z.string().default('nomina-docente-prod-constancias')
});

export const config = envSchema.parse(process.env);

export const corsOrigins = config.CORS_ORIGINS.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

export function getDatabaseHost(): string | undefined {
  if (config.DB_HOST) return config.DB_HOST;
  if (config.INSTANCE_CONNECTION_NAME && config.NODE_ENV === 'production') {
    return `/cloudsql/${config.INSTANCE_CONNECTION_NAME}`;
  }
  return undefined;
}
