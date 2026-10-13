import Modal from './Modal';

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  message,
  title = 'Confirmar',
  confirmLabel = 'Excluir',
  confirmVariant = 'danger',
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title || 'Confirmar'}
      footer={
        <div className="confirm-actions">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button
            className={`btn btn-${confirmVariant}`}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel || 'Excluir'}
          </button>
        </div>
      }
    >
      <div className="confirm-dialog">
        <p>{message || 'Tem certeza que deseja excluir este registro?'}</p>
      </div>
    </Modal>
  );
}
