import Modal from './Modal';

export default function ConfirmDialog({ isOpen, onClose, onConfirm, message }) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Confirmar"
      footer={
        <div className="confirm-actions">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn btn-danger"
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            Excluir
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
