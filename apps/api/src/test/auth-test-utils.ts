import type { FastifyInstance, InjectOptions, LightMyRequestResponse } from 'fastify';
import type { SessionUser } from '../types.js';

const TEST_AUTH_TOKEN_PREFIX = 'test-actor:';

type TestAuthGlobal = typeof globalThis & {
  __NOMINA_TEST_ACTORS__?: Map<string, SessionUser>;
};

function testActorRegistry(): Map<string, SessionUser> {
  const testGlobal = globalThis as TestAuthGlobal;
  testGlobal.__NOMINA_TEST_ACTORS__ ??= new Map<string, SessionUser>();
  return testGlobal.__NOMINA_TEST_ACTORS__;
}

function cloneSessionUser(user: SessionUser): SessionUser {
  return {
    ...user,
    permissions: [...user.permissions],
    actorCoordinations: user.actorCoordinations.map((coordination) => ({ ...coordination }))
  };
}

export function authHeaderForTestActor(actor: SessionUser): string {
  const token = `${TEST_AUTH_TOKEN_PREFIX}${actor.id}`;
  testActorRegistry().set(token, cloneSessionUser(actor));
  return `Bearer ${token}`;
}

export function clearTestActors(): void {
  testActorRegistry().clear();
}

export async function injectAs(
  app: FastifyInstance,
  actor: SessionUser,
  options: InjectOptions
): Promise<LightMyRequestResponse> {
  return app.inject({
    ...options,
    headers: {
      ...options.headers,
      authorization: authHeaderForTestActor(actor)
    }
  });
}
