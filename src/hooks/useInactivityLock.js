import { useState, useEffect, useCallback, useRef } from 'react';
import { getInactivityTimeoutMinutes } from '../utils/security';

/**
 * Hook para monitorar inatividade do usuário e gerenciar o bloqueio de tela.
 */
export function useInactivityLock(enabled = true) {
  const [isLocked, setIsLocked] = useState(false);
  const timeoutIdRef = useRef(null);

  const lockNow = useCallback(() => {
    setIsLocked(true);
  }, []);

  const unlock = useCallback(() => {
    setIsLocked(false);
  }, []);

  const resetTimer = useCallback(() => {
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = null;
    }

    if (!enabled) return;

    const timeoutMins = getInactivityTimeoutMinutes();
    if (timeoutMins <= 0) return; // Inatividade desativada

    const ms = timeoutMins * 60 * 1000;
    timeoutIdRef.current = setTimeout(() => {
      setIsLocked(true);
    }, ms);
  }, [enabled]);

  useEffect(() => {
    if (!enabled || isLocked) {
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
      return;
    }

    const activityEvents = ['mousemove', 'keydown', 'touchstart', 'click', 'scroll'];

    const handleUserActivity = () => {
      resetTimer();
    };

    activityEvents.forEach((evt) => {
      window.addEventListener(evt, handleUserActivity, { passive: true });
    });

    // Inicia o timer
    resetTimer();

    return () => {
      activityEvents.forEach((evt) => {
        window.removeEventListener(evt, handleUserActivity);
      });
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
    };
  }, [enabled, isLocked, resetTimer]);

  return {
    isLocked,
    lockNow,
    unlock,
    resetTimer,
  };
}
