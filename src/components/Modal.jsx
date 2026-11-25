import { useEffect, useRef, useId } from 'react';

// Pilha global de modais abertos: apenas o modal do topo responde a Escape/Tab
const openModalStack = [];

function getVisibleFocusableElements(container) {
  if (!container) return [];
  const candidates = container.querySelectorAll(
    'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );
  return Array.from(candidates).filter((el) => {
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
  });
}

export default function Modal({ isOpen, onClose, title, children, footer, className = '', maxWidth }) {
  const modalId = useId();
  const titleId = `${modalId}-title`;
  const overlayRef = useRef(null);
  const modalRef = useRef(null);
  const previousActiveElementRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const mouseDownOnOverlayRef = useRef(false);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!isOpen) return;

    openModalStack.push(modalId);
    previousActiveElementRef.current = document.activeElement;

    const focusTimer = setTimeout(() => {
      if (!modalRef.current) return;
      if (openModalStack[openModalStack.length - 1] !== modalId) return;

      if (modalRef.current.contains(document.activeElement) && document.activeElement !== modalRef.current) {
        return;
      }

      const autoFocusEl = modalRef.current.querySelector('[autofocus]');
      if (autoFocusEl && autoFocusEl.offsetParent !== null) {
        autoFocusEl.focus();
        return;
      }

      const bodyEl = modalRef.current.querySelector('.modal-body');
      const bodyFocusable = getVisibleFocusableElements(bodyEl);
      if (bodyFocusable.length > 0) {
        bodyFocusable[0].focus();
        return;
      }

      const footerEl = modalRef.current.querySelector('.modal-footer');
      const footerFocusable = getVisibleFocusableElements(footerEl);
      if (footerFocusable.length > 0) {
        footerFocusable[0].focus();
        return;
      }

      const allFocusable = getVisibleFocusableElements(modalRef.current);
      if (allFocusable.length > 0) {
        allFocusable[0].focus();
      } else {
        modalRef.current.focus();
      }
    }, 50);

    const handleKey = (e) => {
      // Apenas o modal no topo da pilha captura Escape e Tab
      if (openModalStack[openModalStack.length - 1] !== modalId) return;

      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current?.();
        return;
      }

      if (e.key === 'Tab') {
        if (!modalRef.current) return;
        const focusable = getVisibleFocusableElements(modalRef.current);

        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && (document.activeElement === first || !modalRef.current.contains(document.activeElement))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && (document.activeElement === last || !modalRef.current.contains(document.activeElement))) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKey);
    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKey);
      const idx = openModalStack.lastIndexOf(modalId);
      if (idx !== -1) openModalStack.splice(idx, 1);
      if (
        openModalStack.length === 0 &&
        previousActiveElementRef.current &&
        typeof previousActiveElementRef.current.focus === 'function'
      ) {
        previousActiveElementRef.current.focus();
      }
    };
  }, [isOpen, modalId]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      ref={overlayRef}
      onMouseDown={(e) => {
        mouseDownOnOverlayRef.current = e.target === overlayRef.current;
      }}
      onClick={(e) => {
        if (mouseDownOnOverlayRef.current && e.target === overlayRef.current) {
          onCloseRef.current?.();
        }
        mouseDownOnOverlayRef.current = false;
      }}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className={`modal ${className}`.trim()}
        style={maxWidth ? { width: `min(100%, ${maxWidth})` } : undefined}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="modal-header">
          <h2 id={titleId} className="modal-title">{title}</h2>
          <button
            type="button"
            className="modal-close"
            onClick={() => onCloseRef.current?.()}
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
