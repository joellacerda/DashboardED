import { useState, useRef, useEffect } from 'react';
import { useToast } from '../contexts/ToastContext';

export default function ExportMenu({ onExportCSV, onExportPDF }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const handleCSV = async () => {
    setOpen(false);
    setExporting(true);
    try {
      const result = await onExportCSV?.();
      if (result !== false) {
        toast.success('Arquivo CSV exportado com sucesso!');
      }
    } catch (err) {
      console.error('Erro ao exportar CSV:', err);
      toast.error('Falha ao exportar arquivo CSV.');
    } finally {
      setExporting(false);
    }
  };

  const handlePDF = async () => {
    setOpen(false);
    setExporting(true);
    try {
      const result = await onExportPDF?.();
      if (result !== false) {
        toast.success('Relatório PDF gerado com sucesso!');
      }
    } catch (err) {
      console.error('Erro ao exportar PDF:', err);
      toast.error('Falha ao gerar relatório PDF.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="export-menu" ref={menuRef}>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="menu"
        disabled={exporting}
      >
        {exporting ? '⏳ Exportando...' : '📥 Exportar'}
      </button>
      {open && (
        <div className="export-dropdown" role="menu">
          <button
            type="button"
            role="menuitem"
            className="export-dropdown-item"
            onClick={handleCSV}
          >
            📄 Exportar CSV
          </button>
          <button
            type="button"
            role="menuitem"
            className="export-dropdown-item"
            onClick={handlePDF}
          >
            🖨️ Exportar PDF
          </button>
        </div>
      )}
    </div>
  );
}
