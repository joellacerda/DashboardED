import { useState, useEffect, useRef } from 'react';

function ToastIcon({ type }) {
  switch (type) {
    case 'success':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="toast-icon">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      );
    case 'error':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="toast-icon">
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      );
    case 'warning':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="toast-icon">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );
    case 'info':
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="toast-icon">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      );
  }
}

function ToastItem({ toast, onRemove }) {
  const [isPaused, setIsPaused] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const timerRef = useRef(null);
  const startTimeRef = useRef(Date.now());
  const remainingRef = useRef(toast.duration || 4000);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => {
      onRemove(toast.id);
    }, 250);
  };

  // Mantém sempre a versão mais recente de handleDismiss sem reiniciar o timer a cada render
  const handleDismissRef = useRef(handleDismiss);
  useEffect(() => {
    handleDismissRef.current = handleDismiss;
  });

  useEffect(() => {
    if (!toast.duration || toast.duration <= 0) return;

    const startTimer = () => {
      startTimeRef.current = Date.now();
      timerRef.current = setTimeout(() => {
        handleDismissRef.current();
      }, remainingRef.current);
    };

    if (!isPaused) {
      startTimer();
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isPaused, toast.duration]);

  const handleMouseEnter = () => {
    if (!toast.duration || toast.duration <= 0) return;
    setIsPaused(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    const elapsed = Date.now() - startTimeRef.current;
    remainingRef.current = Math.max(0, remainingRef.current - elapsed);
  };

  const handleMouseLeave = () => {
    if (!toast.duration || toast.duration <= 0) return;
    setIsPaused(false);
  };

  return (
    <div
      className={`toast-item toast-${toast.type}${isExiting ? ' toast-exiting' : ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      role={toast.type === 'error' ? 'alert' : 'status'}
      aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
    >
      <div className="toast-content">
        <ToastIcon type={toast.type} />
        <div className="toast-text-group">
          {toast.title && <div className="toast-title">{toast.title}</div>}
          <div className="toast-message">{toast.message}</div>
        </div>

        {toast.action && (
          <button
            type="button"
            className="toast-action-btn"
            onClick={() => {
              if (toast.action.onClick) toast.action.onClick();
              handleDismiss();
            }}
          >
            {toast.action.label}
          </button>
        )}

        <button
          type="button"
          className="toast-close-btn"
          onClick={handleDismiss}
          aria-label="Fechar notificação"
          title="Fechar"
        >
          ✕
        </button>
      </div>

      {toast.duration > 0 && (
        <div className="toast-progress-track">
          <div
            className="toast-progress-bar"
            style={{
              animationDuration: `${toast.duration}ms`,
              animationPlayState: isPaused ? 'paused' : 'running',
            }}
          />
        </div>
      )}
    </div>
  );
}

export default function ToastContainer({ toasts, onRemove }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <aside className="toast-container" aria-label="Notificações do sistema">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </aside>
  );
}
