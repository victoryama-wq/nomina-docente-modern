import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { requireDossier } from '../lib/dossier-policy.js';
import { createDossierService } from '../lib/dossier-runtime.js';
import { DossierError, dossierParams, uploadSchema, replaceSchema, metadataSchema, deleteSchema, contactSchema } from '../lib/dossier-contract.js';
import type { TeacherDossierService } from '../lib/teacher-dossier.js';
import { DossierStorageError } from '../lib/dossier-storage.js';
import { documentAdmission as fileAdmission } from '../lib/document-admission.js';
import { DocumentSecurityError } from '../lib/document-security.js';

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    if (parsed.error.issues.some((issue) => issue.path[0] === 'base64Data' && issue.code === 'too_big')) {
      throw new DossierError('FILE_TOO_LARGE', 413, 'El PDF excede 7.5 MiB.');
    }
    if (parsed.error.issues.some((issue) => issue.path[0] === 'mimeType')) {
      throw new DossierError('UNSUPPORTED_MEDIA_TYPE', 415, 'Solo se admiten documentos PDF.');
    }
    throw new DossierError('VALIDATION_ERROR', 400, 'Verifica los datos del expediente.');
  }
  return parsed.data;
}

async function respond(reply: FastifyReply, work: () => Promise<unknown>) {
  try { return await work(); }
  catch (error) {
    if (error instanceof DocumentSecurityError) return reply.code(error.statusCode).send({ error: error.code, message: error.publicMessage });
    if (error instanceof DossierError) return reply.code(error.statusCode).send({ error: error.code, message: error.message });
    if (error instanceof DossierStorageError) {
      const status = error.code === 'DOSSIER_PDF_INVALID' ? 422 : error.code === 'DOSSIER_PDF_TOO_LARGE' ? 413 : 503;
      return reply.code(status).send({ error: error.code, message: status === 422 ? 'El PDF no es valido o no esta permitido.' : 'El almacenamiento o validador documental no esta disponible.' });
    }
    // Never forward storage/parser/SQL diagnostics to clients or request logs.
    return reply.code(503).send({ error: 'DOSSIER_UNAVAILABLE', message: 'No fue posible completar la operacion del expediente.' });
  }
}

function operationResponse(reply: FastifyReply, result: { state: string }) {
  return reply.code(result.state === 'COMPLETE' || result.state === 'FAILED' ? 200 : 202).send(result);
}

export async function registerDossierRoutes(app: FastifyInstance, injected?: TeacherDossierService) {
  // Lazy configuration: disabled by default, without breaking existing modules or migrations.
  let configured = injected;
  const service = () => configured ??= createDossierService();
  const base = '/teachers/:teacherId/dossier';
  app.get(base, { preHandler: requireDossier('view') }, (request, reply) => respond(reply, async () => {
    const { teacherId } = parse(dossierParams, request.params);
    return service().get(request.user!, teacherId);
  }));
  app.patch(`${base}/contact`, { preHandler: requireDossier('contact') }, (request, reply) => respond(reply, async () => {
    const { teacherId } = parse(dossierParams, request.params);
    return operationResponse(reply, await service().contact(request.user!, teacherId, parse(contactSchema, request.body)));
  }));
  app.post(`${base}/documents`, fileAdmission, (request, reply) => respond(reply, async () => {
    const { teacherId } = parse(dossierParams, request.params);
    return operationResponse(reply, await service().upload(request.user!, teacherId, parse(uploadSchema, request.body)));
  }));
  app.patch(`${base}/documents/:documentId`, { preHandler: requireDossier('manage') }, (request, reply) => respond(reply, async () => {
    const { teacherId, documentId } = parse(dossierParams, request.params);
    return operationResponse(reply, await service().metadata(request.user!, teacherId, documentId!, parse(metadataSchema, request.body)));
  }));
  app.put(`${base}/documents/:documentId/content`, fileAdmission, (request, reply) => respond(reply, async () => {
    const { teacherId, documentId } = parse(dossierParams, request.params);
    return operationResponse(reply, await service().replace(request.user!, teacherId, documentId!, parse(replaceSchema, request.body)));
  }));
  app.delete(`${base}/documents/:documentId`, { preHandler: requireDossier('manage') }, (request, reply) => respond(reply, async () => {
    const { teacherId, documentId } = parse(dossierParams, request.params);
    return operationResponse(reply, await service().remove(request.user!, teacherId, documentId!, parse(deleteSchema, request.body)));
  }));
  app.get(`${base}/documents/:documentId/content`, { preHandler: requireDossier('read') }, (request, reply) => respond(reply, async () => {
    const { teacherId, documentId } = parse(dossierParams, request.params);
    const { download } = parse(z.object({ download: z.enum(['true', 'false']).optional() }).strict(), request.query);
    const file = await service().content(request.user!, teacherId, documentId!);
    const asciiName = file.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const encodedName = encodeURIComponent(file.fileName).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
    return reply.header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `${download === 'true' ? 'attachment' : 'inline'}; filename="${asciiName}"; filename*=UTF-8''${encodedName}`)
      .header('Access-Control-Expose-Headers', 'Content-Disposition')
      .header('Cache-Control', 'private, no-store').header('X-Content-Type-Options', 'nosniff')
      .header('Content-Security-Policy', "sandbox; default-src 'none'").send(file.bytes);
  }));
  app.get(`${base}/operations/:operationId`, { preHandler: requireDossier('view') }, (request, reply) => respond(reply, async () => {
    const { teacherId, operationId } = parse(dossierParams, request.params);
    return service().operation(request.user!, teacherId, operationId!);
  }));
}
