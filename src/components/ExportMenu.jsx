import { useState, useRef, useEffect } from 'react';
import { useToast } from '../contexts/ToastContext';

export default function ExportMenu({ onExportCSV, onExportPDF }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div className="export-menu" ref={menuRef}>
      <button className="btn btn-secondary btn-sm" onClick={() => setOpen(!open)}>
        📥 Exportar
      </button>
      {open && (
        <div className="export-dropdown">
          <button
            className="export-dropdown-item"
            onClick={() => {
              onExportCSV();
              setOpen(false);
              toast.success('Arquivo CSV exportado com sucesso!');
            }}
          >
            📄 Exportar CSV
          </button>
          <button
            className="export-dropdown-item"
            onClick={() => {
              onExportPDF();
              setOpen(false);
              toast.success('Relatório PDF gerado com sucesso!');
            }}
          >
            🖨️ Exportar PDF
          </button>
        </div>
      )}
    </div>
  );
}
