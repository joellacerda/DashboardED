import Modal from '../../components/Modal';
import { formatCurrency } from '../../utils/helpers';

export default function RepasseAjusteModal({
  isOpen,
  onClose,
  selectedMedico,
  selectedRow,
  ajusteForm,
  setAjusteForm,
  handleSaveAjuste,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Ajustes de Repasse — ${selectedMedico?.nome || ''}`}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn-primary" onClick={handleSaveAjuste}>
            Salvar Ajustes
          </button>
        </>
      }
    >
      <form onSubmit={handleSaveAjuste} autoComplete="off">
        <div className="modal-form-grid">
          {selectedRow?.compensacaoConvenios > 0 && (
            <div
              className="input-group full-width"
              style={{
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: 'var(--radius-md)',
                padding: '0.65rem 0.9rem',
                fontSize: 'var(--text-xs)',
                color: 'var(--color-amber)',
                lineHeight: 1.4,
              }}
            >
              ✂️{' '}
              <strong>
                Compensações Automáticas no Período: -{formatCurrency(selectedRow.compensacaoConvenios)}
              </strong>
              <div style={{ color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                Este valor já é descontado automaticamente do total líquido (
                {selectedRow.compensacaoCount} exame(s) com retenção de alça/polipectomia). Não é
                necessário lançar em Débitos.
              </div>
            </div>
          )}

          <div className="input-group full-width">
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                cursor: 'pointer',
                fontSize: 'var(--text-sm)',
              }}
            >
              <input
                type="checkbox"
                checked={ajusteForm.isSocio}
                onChange={(e) => setAjusteForm({ ...ajusteForm, isSocio: e.target.checked })}
              />
              <span>
                👑 <strong>Médico Sócio da Clínica</strong> (Participa do rateio da cota clínica em
                caso de déficit)
              </span>
            </label>
          </div>

          <div className="input-group">
            <label className="input-label">Créditos Adicionais (R$)</label>
            <input
              type="number"
              className="input-field"
              min="0"
              step="0.01"
              placeholder="0,00"
              value={ajusteForm.creditos}
              onChange={(e) => setAjusteForm({ ...ajusteForm, creditos: e.target.value })}
            />
          </div>

          <div className="input-group">
            <label className="input-label">Débitos / Descontos (R$)</label>
            <input
              type="number"
              className="input-field"
              min="0"
              step="0.01"
              placeholder="0,00"
              value={ajusteForm.debitos}
              onChange={(e) => setAjusteForm({ ...ajusteForm, debitos: e.target.value })}
            />
          </div>

          <div className="input-group full-width">
            <label className="input-label">Financiamento / BNB (R$)</label>
            <input
              type="number"
              className="input-field"
              min="0"
              step="0.01"
              placeholder="0,00"
              value={ajusteForm.bnb}
              onChange={(e) => setAjusteForm({ ...ajusteForm, bnb: e.target.value })}
            />
          </div>

          <div className="input-group full-width">
            <label className="input-label">Observações (OBS)</label>
            <textarea
              className="input-field"
              rows="3"
              placeholder="Anotações ou observações para o repasse deste médico"
              value={ajusteForm.obs}
              onChange={(e) => setAjusteForm({ ...ajusteForm, obs: e.target.value })}
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}
