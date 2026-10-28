import type { FastifyReply, FastifyRequest } from 'fastify';
import { requireDossier } from './dossier-policy.js';

// Shared by constancias/additional uploads, replacements and both route prefixes.
const requests = new Set<FastifyRequest>();
const timers = new Map<FastifyRequest, NodeJS.Timeout>();
function clearTimer(request: FastifyRequest) {
  const timer = timers.get(request);
  if (timer) clearTimeout(timer);
  timers.delete(request);
}
function release(request: FastifyRequest) { clearTimer(request); requests.delete(request); }
export const documentAdmission = {
  onRequest: async (request: FastifyRequest, reply: FastifyReply) => {
    await requireDossier('manage')(request, reply);
    if (reply.sent) return;
    if (requests.size >= 2) {
      await reply.code(429).header('Retry-After', '2').send({ error: 'DOSSIER_BUSY', message: 'Espera a que termine la carga anterior.' });
      return;
    }
    requests.add(request);
    const timer = setTimeout(() => { request.raw.destroy(); release(request); }, 30_000);
    timer.unref();
    timers.set(request, timer);
  },
  preValidation: async (request: FastifyRequest) => { clearTimer(request); },
  onResponse: async (request: FastifyRequest) => { release(request); },
  onRequestAbort: async (request: FastifyRequest) => { release(request); },
  onTimeout: async (request: FastifyRequest) => { release(request); }
};
