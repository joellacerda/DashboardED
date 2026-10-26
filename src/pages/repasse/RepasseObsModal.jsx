import Modal from '../../components/Modal';

export default function RepasseObsModal({ viewingObs, onClose, openEditAjuste }) {
  if (!viewingObs) return null;

  return (
    <Modal
      isOpen={Boolean(viewingObs)}
      onClose={onClose}
      title={`📝 Observações — ${viewingObs?.doctor || ''}`}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: '0.75rem' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              const targetRow = viewingObs?.row;
              onClose();
              if (targetRow) openEditAjuste(targetRow);
            }}
          >
            ✏️ Editar Ajustes / OBS
          </button>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Fechar
          </button>
        </div>
      }
    >
      <div style={{ padding: '0.5rem 0' }}>
        <div
          style={{
            background: 'var(--bg-secondary, #1a2234)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '1.25rem',
            whiteSpace: 'pre-wrap',
            lineHeight: 1.6,
            color: 'var(--text-primary)',
            fontSize: 'var(--text-sm)',
            minHeight: '80px',
            maxHeight: '320px',
            overflowY: 'auto',
          }}
        >
          {viewingObs?.obs}
        </div>
      </div>
    </Modal>
  );
}
