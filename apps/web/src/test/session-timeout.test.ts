import { mount } from '@vue/test-utils';
import { computed, defineComponent, nextTick, ref, type Ref } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SessionTimeoutModal from '../components/modals/SessionTimeoutModal.vue';
import { IDLE_TIMEOUT_MS, IDLE_WARNING_MS, useIdleTimeout } from '../composables/useIdleTimeout';
import { INACTIVITY_LOGOUT_MESSAGE, logoutForInactivity } from '../utils/session';

type TestActivityTarget = Pick<Window, 'addEventListener' | 'removeEventListener'> & {
  dispatch: (eventName: string) => void;
};

function createActivityTarget(): TestActivityTarget {
  const listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();

  return {
    addEventListener: vi.fn((eventName: string, listener: EventListenerOrEventListenerObject) => {
      const eventListeners = listeners.get(eventName) ?? new Set<EventListenerOrEventListenerObject>();
      eventListeners.add(listener);
      listeners.set(eventName, eventListeners);
    }) as unknown as Window['addEventListener'],
    removeEventListener: vi.fn((eventName: string, listener: EventListenerOrEventListenerObject) => {
      listeners.get(eventName)?.delete(listener);
    }) as unknown as Window['removeEventListener'],
    dispatch(eventName: string) {
      listeners.get(eventName)?.forEach((listener) => {
        if (typeof listener === 'function') {
          listener(new Event(eventName));
          return;
        }
        listener.handleEvent(new Event(eventName));
      });
    }
  };
}

function createHarness(
  enabled: Ref<boolean>,
  onTimeout: () => Promise<void> | void,
  target: TestActivityTarget
) {
  return defineComponent({
    components: { SessionTimeoutModal },
    setup() {
      const idle = useIdleTimeout({
        enabled,
        onTimeout,
        target
      });

      return {
        ...idle,
        sessionVisible: computed(() => enabled.value)
      };
    },
    template: `
      <div>
        <span v-if="sessionVisible">sesion-activa</span>
        <SessionTimeoutModal
          :show="showWarning"
          :remaining-label="remainingLabel"
          @continue="continueSession"
          @logout="expireNow"
        />
      </div>
    `
  });
}

describe('idle session timeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('starts the inactivity timer when a user is authenticated', () => {
    const target = createActivityTarget();
    const onTimeout = vi.fn();
    const enabled = ref(true);

    const wrapper = mount(createHarness(enabled, onTimeout, target));

    expect(wrapper.text()).toContain('sesion-activa');
    expect(target.addEventListener).toHaveBeenCalledTimes(6);
    expect(vi.getTimerCount()).toBe(2);

    wrapper.unmount();
  });

  it('does not start timers or listeners on login without a user', () => {
    const target = createActivityTarget();
    const onTimeout = vi.fn();
    const enabled = ref(false);

    const wrapper = mount(createHarness(enabled, onTimeout, target));

    expect(target.addEventListener).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);

    wrapper.unmount();
  });

  it('resets the inactivity timer on user activity without duplicating listeners', async () => {
    const target = createActivityTarget();
    const onTimeout = vi.fn();
    const enabled = ref(true);

    const wrapper = mount(createHarness(enabled, onTimeout, target));

    vi.advanceTimersByTime(IDLE_TIMEOUT_MS - IDLE_WARNING_MS - 1000);
    target.dispatch('mousemove');
    await nextTick();

    expect(target.addEventListener).toHaveBeenCalledTimes(6);

    vi.advanceTimersByTime(2000);
    await nextTick();

    expect(wrapper.text()).not.toContain('Sesion por expirar');
    expect(onTimeout).not.toHaveBeenCalled();

    wrapper.unmount();
  });

  it('shows the warning modal at 55 minutes of inactivity with countdown text', async () => {
    const target = createActivityTarget();
    const onTimeout = vi.fn();
    const enabled = ref(true);

    const wrapper = mount(createHarness(enabled, onTimeout, target));

    vi.advanceTimersByTime(IDLE_TIMEOUT_MS - IDLE_WARNING_MS);
    await nextTick();

    expect(wrapper.text()).toContain('Sesion por expirar');
    expect(wrapper.text()).toContain('Tu sesion se cerrara por inactividad en 5 minutos.');
    expect(wrapper.text()).toContain('Guarda tus cambios antes de que termine el tiempo.');
    expect(wrapper.text()).toContain('Tiempo restante: 05:00');

    wrapper.unmount();
  });

  it('continues the session from the warning modal and restarts the timer', async () => {
    const target = createActivityTarget();
    const onTimeout = vi.fn();
    const enabled = ref(true);

    const wrapper = mount(createHarness(enabled, onTimeout, target));

    vi.advanceTimersByTime(IDLE_TIMEOUT_MS - IDLE_WARNING_MS);
    await nextTick();

    await wrapper.find('button.primary-inline').trigger('click');

    expect(wrapper.text()).not.toContain('Sesion por expirar');
    expect(onTimeout).not.toHaveBeenCalled();

    vi.advanceTimersByTime(IDLE_TIMEOUT_MS - IDLE_WARNING_MS - 1000);
    await nextTick();

    expect(wrapper.text()).not.toContain('Sesion por expirar');

    wrapper.unmount();
  });

  it('logs out from the warning modal when the user chooses to close the session', async () => {
    const target = createActivityTarget();
    const onTimeout = vi.fn();
    const enabled = ref(true);

    const wrapper = mount(createHarness(enabled, onTimeout, target));

    vi.advanceTimersByTime(IDLE_TIMEOUT_MS - IDLE_WARNING_MS);
    await nextTick();

    await wrapper.find('button.secondary-action').trigger('click');

    expect(onTimeout).toHaveBeenCalledTimes(1);

    wrapper.unmount();
  });

  it('logs out automatically at 60 minutes of inactivity', async () => {
    const target = createActivityTarget();
    const onTimeout = vi.fn();
    const enabled = ref(true);

    const wrapper = mount(createHarness(enabled, onTimeout, target));

    vi.advanceTimersByTime(IDLE_TIMEOUT_MS);
    await nextTick();

    expect(onTimeout).toHaveBeenCalledTimes(1);

    wrapper.unmount();
  });

  it('clears session state and redirects to login on inactivity', async () => {
    const authStore = {
      logout: vi.fn().mockResolvedValue(undefined)
    };
    const router = {
      replace: vi.fn().mockResolvedValue(undefined)
    };

    await logoutForInactivity(authStore, router);

    expect(authStore.logout).toHaveBeenCalledWith(INACTIVITY_LOGOUT_MESSAGE);
    expect(router.replace).toHaveBeenCalledWith({ name: 'login' });
  });

  it('removes listeners when the protected session stops', async () => {
    const target = createActivityTarget();
    const onTimeout = vi.fn();
    const enabled = ref(true);

    const wrapper = mount(createHarness(enabled, onTimeout, target));
    enabled.value = false;
    await nextTick();

    expect(target.removeEventListener).toHaveBeenCalledTimes(6);
    expect(vi.getTimerCount()).toBe(0);

    wrapper.unmount();
  });
});
