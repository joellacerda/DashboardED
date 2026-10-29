import { useEffect, useRef } from 'react';

export default function Modal({ isOpen, onClose, title, children, footer, className = '', maxWidth }) {
  const overlayRef = useRef(null);
  const modalRef = useRef(null);
  const previousActiveElementRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!isOpen) return;

    previousActiveElementRef.current = document.activeElement;

    // Foca o primeiro elemento apropriado do modal
    const focusTimer = setTimeout(() => {
      if (!modalRef.current) return;

      // Se o usuário já focou algum elemento dentro do modal, não rouba o foco
      if (modalRef.current.contains(document.activeElement) && document.activeElement !== modalRef.current) {
        return;
      }

      // Prioridade:
      // 1. Elemento com autofocus explícito
      // 2. Primeiro campo interativo no corpo (.modal-body)
      // 3. Primeiro botão no rodapé (.modal-footer)
      // 4. Qualquer elemento focável no modal
      // 5. O próprio container do modal
      const autoFocusEl = modalRef.current.querySelector('[autofocus]');
      if (autoFocusEl) {
        autoFocusEl.focus();
        return;
      }

      const bodyFocusable = modalRef.current.querySelector(
        '.modal-body input:not([disabled]), .modal-body select:not([disabled]), .modal-body textarea:not([disabled]), .modal-body button:not([disabled]), .modal-body [tabindex]:not([tabindex="-1"])'
      );
      if (bodyFocusable) {
        bodyFocusable.focus();
        return;
      }

      const footerFocusable = modalRef.current.querySelector(
        '.modal-footer button:not([disabled]), .modal-footer [tabindex]:not([tabindex="-1"])'
      );
      if (footerFocusable) {
        footerFocusable.focus();
        return;
      }

      const focusable = modalRef.current.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length > 0) {
        focusable[0].focus();
      } else {
        modalRef.current.focus();
      }
    }, 50);

    const handleKey = (e) => {
      if (e.key === 'Escape') {
        onCloseRef.current?.();
        return;
      }

      if (e.key === 'Tab') {
        if (!modalRef.current) return;
        const focusable = Array.from(
          modalRef.current.querySelectorAll(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        );

        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKey);
    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKey);
      if (previousActiveElementRef.current && typeof previousActiveElementRef.current.focus === 'function') {
        previousActiveElementRef.current.focus();
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className={`modal ${className}`.trim()}
        style={maxWidth ? { width: `min(100%, ${maxWidth})` } : undefined}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
