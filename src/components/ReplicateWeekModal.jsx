import { useState } from 'react';
import Modal from './Modal';
import { navigateWeek } from '../utils/helpers';

export default function ReplicateWeekModal({
  isOpen,
  onClose,
  currentWeek,
  onConfirmReplicate,
}) {
  const [weeksDelta, setWeeksDelta] = useState(1);
  const [overwrite, setOverwrite] = useState(true);

  if (!isOpen || !currentWeek) return null;

  const targetWeek = navigateWeek(currentWeek.mondayISO, weeksDelta);

  const handleConfirm = () => {
    const srcDays = currentWeek.days.map((d) => d.date);
    const tgtDays = targetWeek.days.map((d) => d.date);

    onConfirmReplicate(srcDays, tgtDays, overwrite);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="📋 Replicar Escala Semanal"
      maxWidth="520px"
    >
      <div className="replicate-modal-container">
        <p className="text-secondary text-sm" style={{ marginBottom: '1rem' }}>
          Copie rapidamente toda a programação de salas, médicos e turnos trancados desta semana para uma semana futura.
        </p>

        {/* Source and Target comparison cards */}
        <div className="replicate-compare-box">
          <div className="replicate-card src-card">
            <span className="replicate-card-tag">Semana de Origem</span>
            <strong className="replicate-card-title">{currentWeek.label}</strong>
            <span className="text-xs text-muted">6 dias (Segunda a Sábado)</span>
          </div>

          <div className="replicate-arrow">➔</div>

          <div className="replicate-card tgt-card">
            <span className="replicate-card-tag">Semana de Destino</span>
            <strong className="replicate-card-title">{targetWeek.label}</strong>
            <span className="text-xs text-muted">
              {weeksDelta === 1 ? 'Próxima semana' : `Em ${weeksDelta} semanas`}
            </span>
          </div>
        </div>

        {/* Options */}
        <div className="input-group full-width" style={{ marginTop: '1.2rem' }}>
          <label className="input-label" htmlFor="select-weeks-delta">
            Copiar para:
          </label>
          <select
            id="select-weeks-delta"
            className="input-field"
            value={weeksDelta}
            onChange={(e) => setWeeksDelta(Number(e.target.value))}
          >
            <option value={1}>Próxima Semana (+1 semana)</option>
            <option value={2}>Daqui a 2 semanas (+2 semanas)</option>
            <option value={3}>Daqui a 3 semanas (+3 semanas)</option>
            <option value={4}>Daqui a 4 semanas (+4 semanas)</option>
          </select>
        </div>

        <div className="input-group full-width" style={{ marginTop: '0.8rem' }}>
          <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={overwrite}
              onChange={(e) => setOverwrite(e.target.checked)}
            />
            <span style={{ fontSize: 'var(--text-sm)' }}>
              Sobrescrever escalas já existentes na semana de destino
            </span>
          </label>
          <p className="text-muted text-xs" style={{ marginLeft: '1.5rem', marginTop: '0.2rem' }}>
            {overwrite
              ? 'Se desmarcado, os turnos que já tiverem médico ou tranca na semana futura serão preservados.'
              : 'Apenas turnos totalmente vazios na semana futura receberão a cópia.'}
          </p>
        </div>

        {/* Modal Footer */}
        <div className="modal-footer" style={{ padding: '1rem 0 0 0', marginTop: '1.5rem', borderTop: '1px solid var(--border-subtle)' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary" onClick={handleConfirm}>
            📋 Confirmar Replicação
          </button>
        </div>
      </div>
    </Modal>
  );
}
