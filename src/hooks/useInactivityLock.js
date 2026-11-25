import { useState, useEffect, useCallback, useRef } from 'react';
import { getInactivityTimeoutMinutes } from '../utils/security';

const LOCK_SESSION_KEY = 'endodiagnose_screen_locked';
const ACTIVITY_THROTTLE_MS = 1000;

function readInitialLockState() {
  if (typeof sessionStorage === 'undefined') return false;
  try {
    return sessionStorage.getItem(LOCK_SESSION_KEY) === 'true';
  } catch {
    return false;
  }
}

function persistLockState(locked) {
  if (typeof sessionStorage === 'undefined') return;
  try {
    if (locked) {
      sessionStorage.setItem(LOCK_SESSION_KEY, 'true');
    } else {
      sessionStorage.removeItem(LOCK_SESSION_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

/**
 * Hook para monitorar inatividade do usuário e gerenciar o bloqueio de tela.
 * Persiste o estado de bloqueio em sessionStorage (sobrevive a F5), aplica throttle
 * nos eventos de atividade e valida o tempo decorrido no evento visibilitychange.
 */
export function useInactivityLock(enabled = true) {
  const [isLocked, setIsLocked] = useState(() => (enabled ? readInitialLockState() : false));
  const timeoutIdRef = useRef(null);
  const lastActivityRef = useRef(Date.now());
  const lastThrottleRef = useRef(0);

  const lockNow = useCallback(() => {
    persistLockState(true);
    setIsLocked(true);
  }, []);

  const unlock = useCallback(() => {
    persistLockState(false);
    lastActivityRef.current = Date.now();
    setIsLocked(false);
  }, []);

  const scheduleTimeout = useCallback(() => {
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = null;
    }

    if (!enabled) return;

    const timeoutMins = getInactivityTimeoutMinutes();
    if (timeoutMins <= 0) return;

    const ms = timeoutMins * 60 * 1000;
    const elapsed = Date.now() - lastActivityRef.current;
    const remaining = ms - elapsed;

    if (remaining <= 0) {
      lockNow();
      return;
    }

    timeoutIdRef.current = setTimeout(() => {
      lockNow();
    }, remaining);
  }, [enabled, lockNow]);

  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    scheduleTimeout();
  }, [scheduleTimeout]);

  useEffect(() => {
    if (!enabled) {
      persistLockState(false);
      setIsLocked(false);
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
        timeoutIdRef.current = null;
      }
      return;
    }

    if (isLocked) {
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
        timeoutIdRef.current = null;
      }
      return;
    }

    const activityEvents = ['mousemove', 'keydown', 'touchstart', 'click', 'scroll'];

    const handleUserActivity = () => {
      const now = Date.now();
      if (now - lastThrottleRef.current < ACTIVITY_THROTTLE_MS) return;
      lastThrottleRef.current = now;
      lastActivityRef.current = now;
      scheduleTimeout();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        scheduleTimeout();
      }
    };

    const handleTimeoutChanged = () => {
      scheduleTimeout();
    };

    activityEvents.forEach((evt) => {
      window.addEventListener(evt, handleUserActivity, { passive: true });
    });
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('endodiagnose:inactivity-timeout-changed', handleTimeoutChanged);

    scheduleTimeout();

    return () => {
      activityEvents.forEach((evt) => {
        window.removeEventListener(evt, handleUserActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('endodiagnose:inactivity-timeout-changed', handleTimeoutChanged);
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
        timeoutIdRef.current = null;
      }
    };
  }, [enabled, isLocked, scheduleTimeout]);

  return {
    isLocked,
    lockNow,
    unlock,
    resetTimer,
  };
}
