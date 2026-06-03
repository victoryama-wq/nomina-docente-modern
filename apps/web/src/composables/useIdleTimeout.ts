import { computed, onBeforeUnmount, ref, watch, type Ref } from 'vue';

export const IDLE_TIMEOUT_MS = 60 * 60 * 1000;
export const IDLE_WARNING_MS = 5 * 60 * 1000;

const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart', 'focus'] as const;

type ActivityEvent = (typeof ACTIVITY_EVENTS)[number];

type ActivityTarget = Pick<Window, 'addEventListener' | 'removeEventListener'>;

type IdleTimeoutOptions = {
  enabled: Ref<boolean>;
  onTimeout: () => Promise<void> | void;
  timeoutMs?: number;
  warningMs?: number;
  target?: ActivityTarget;
};

export function formatRemainingTime(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function useIdleTimeout(options: IdleTimeoutOptions) {
  const timeoutMs = options.timeoutMs ?? IDLE_TIMEOUT_MS;
  const warningMs = options.warningMs ?? IDLE_WARNING_MS;
  const warningDelayMs = Math.max(0, timeoutMs - warningMs);
  const target = options.target ?? window;

  const showWarning = ref(false);
  const remainingMs = ref(warningMs);
  const remainingLabel = computed(() => formatRemainingTime(remainingMs.value));

  let warningTimer: number | undefined;
  let timeoutTimer: number | undefined;
  let countdownTimer: number | undefined;
  let listenersAttached = false;
  let timeoutInProgress = false;

  function clearTimer(timerId: number | undefined, clear: (id: number) => void) {
    if (timerId !== undefined) {
      clear(timerId);
    }
  }

  function clearTimers() {
    clearTimer(warningTimer, window.clearTimeout);
    clearTimer(timeoutTimer, window.clearTimeout);
    clearTimer(countdownTimer, window.clearInterval);
    warningTimer = undefined;
    timeoutTimer = undefined;
    countdownTimer = undefined;
  }

  function updateCountdown() {
    remainingMs.value = Math.max(0, remainingMs.value - 1000);
  }

  function startCountdown() {
    clearTimer(countdownTimer, window.clearInterval);
    remainingMs.value = warningMs;
    countdownTimer = window.setInterval(updateCountdown, 1000);
  }

  function openWarning() {
    if (!options.enabled.value) return;
    showWarning.value = true;
    startCountdown();
  }

  async function expireNow() {
    if (timeoutInProgress) return;
    timeoutInProgress = true;
    clearTimers();
    showWarning.value = false;
    detachListeners();
    await options.onTimeout();
    timeoutInProgress = false;
  }

  function resetTimer() {
    if (!options.enabled.value || timeoutInProgress) return;

    clearTimers();
    showWarning.value = false;
    remainingMs.value = warningMs;
    warningTimer = window.setTimeout(openWarning, warningDelayMs);
    timeoutTimer = window.setTimeout(() => {
      void expireNow();
    }, timeoutMs);
  }

  function handleActivity() {
    resetTimer();
  }

  function attachListeners() {
    if (listenersAttached) return;
    ACTIVITY_EVENTS.forEach((eventName: ActivityEvent) => {
      target.addEventListener(eventName, handleActivity, { passive: true });
    });
    listenersAttached = true;
  }

  function detachListeners() {
    if (!listenersAttached) return;
    ACTIVITY_EVENTS.forEach((eventName: ActivityEvent) => {
      target.removeEventListener(eventName, handleActivity);
    });
    listenersAttached = false;
  }

  function start() {
    if (!options.enabled.value) return;
    attachListeners();
    resetTimer();
  }

  function stop() {
    clearTimers();
    detachListeners();
    showWarning.value = false;
    remainingMs.value = warningMs;
    timeoutInProgress = false;
  }

  function continueSession() {
    resetTimer();
  }

  watch(
    options.enabled,
    (enabled) => {
      if (enabled) {
        start();
        return;
      }
      stop();
    },
    { immediate: true }
  );

  onBeforeUnmount(stop);

  return {
    showWarning,
    remainingMs,
    remainingLabel,
    continueSession,
    expireNow,
    resetTimer,
    stop
  };
}
