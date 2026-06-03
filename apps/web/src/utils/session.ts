export const INACTIVITY_LOGOUT_MESSAGE = 'La sesion se cerro por inactividad.';

type AuthSessionController = {
  logout: (message?: string) => Promise<void> | void;
};

type LoginRouter = {
  replace: (location: { name: 'login' }) => Promise<unknown> | unknown;
};

export async function logoutForInactivity(authStore: AuthSessionController, router: LoginRouter) {
  await authStore.logout(INACTIVITY_LOGOUT_MESSAGE);
  await router.replace({ name: 'login' });
}
