import Modal from '../../components/Modal';
import { formatCurrency } from '../../utils/helpers';
import { calcLiquido } from './useFolhaData';

export default function FolhaModal({
  isOpen,
  onClose,
  editId,
  form,
  updateField,
  period,
  hasError,
  markTouched,
  validationErrors,
  handleSave,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editId ? `Editar Colaborador — ${form.nome || 'Colaborador'}` : 'Novo Colaborador'}
      maxWidth="640px"
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSave}>
            {editId ? 'Salvar Alterações' : 'Cadastrar'}
          </button>
        </>
      }
    >
      <form onSubmit={handleSave} noValidate autoComplete="off">
        <div
          style={{
            marginBottom: '0.85rem',
            padding: '0.5rem 0.75rem',
            background: 'var(--bg-surface-elevated)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
            fontSize: 'var(--text-xs)',
            color: 'var(--text-secondary)',
          }}
        >
          📅 Competência / Período:{' '}
          <strong style={{ color: 'var(--text-primary)' }}>{period.label}</strong>
        </div>

        <div className="modal-form-grid">
          <div className="input-group">
            <label className="input-label">
              Nome do Colaborador <span className="required">*</span>
            </label>
            <input
              type="text"
              className={`input-field ${hasError('nome') ? 'is-invalid' : ''}`}
              autoComplete="off"
              placeholder="Ex: MARIA SILVA"
              value={form.nome}
              onChange={(e) => updateField('nome', e.target.value.toUpperCase())}
              onBlur={() => markTouched('nome')}
            />
            {hasError('nome') && (
              <div className="input-feedback-error">
                <span>⚠</span> {validationErrors.nome}
              </div>
            )}
          </div>

          <div className="input-group">
            <label className="input-label">Cargo / Função</label>
            <input
              type="text"
              className="input-field"
              placeholder="Ex: RECEPCIONISTA, ENFERMEIRA..."
              value={form.cargo}
              onChange={(e) => updateField('cargo', e.target.value.toUpperCase())}
            />
          </div>

          <div className="input-group">
            <label className="input-label">
              Salário Base (R$) <span className="required">*</span>
            </label>
            <input
              type="number"
              className={`input-field ${hasError('salarioBase') ? 'is-invalid' : ''}`}
              min="0"
              step="0.01"
              placeholder="0,00"
              value={form.salarioBase}
              onChange={(e) => updateField('salarioBase', e.target.value)}
              onBlur={() => markTouched('salarioBase')}
            />
            {hasError('salarioBase') && (
              <div className="input-feedback-error">
                <span>⚠</span> {validationErrors.salarioBase}
              </div>
            )}
          </div>

          <div className="input-group">
            <label className="input-label">Vale Alimentação (R$)</label>
            <input
              type="number"
              className="input-field"
              min="0"
              step="0.01"
              placeholder="0,00"
              value={form.valeAlimentacao}
              onChange={(e) => updateField('valeAlimentacao', e.target.value)}
            />
          </div>

          <div className="input-group">
            <label className="input-label">Vale Transporte (R$)</label>
            <input
              type="number"
              className="input-field"
              min="0"
              step="0.01"
              placeholder="0,00"
              value={form.valeTransporte}
              onChange={(e) => updateField('valeTransporte', e.target.value)}
            />
          </div>

          <div className="input-group">
            <label className="input-label">Extras / Horas Extras (R$)</label>
            <input
              type="number"
              className="input-field"
              min="0"
              step="0.01"
              placeholder="0,00"
              value={form.extras}
              onChange={(e) => updateField('extras', e.target.value)}
            />
          </div>

          <div className="input-group">
            <label className="input-label">Produtividade / Bônus (R$)</label>
            <input
              type="number"
              className="input-field"
              min="0"
              step="0.01"
              placeholder="0,00"
              value={form.produtividade}
              onChange={(e) => updateField('produtividade', e.target.value)}
            />
          </div>

          <div className="input-group">
            <label className="input-label">Descontos / Faltas (R$)</label>
            <input
              type="number"
              className="input-field"
              min="0"
              step="0.01"
              placeholder="0,00"
              value={form.descontos}
              onChange={(e) => updateField('descontos', e.target.value)}
            />
          </div>
        </div>

        {(form.salarioBase ||
          form.extras ||
          form.descontos ||
          form.produtividade ||
          form.valeAlimentacao ||
          form.valeTransporte) && (
          <div
            style={{
              marginTop: '1rem',
              padding: '0.75rem 1rem',
              background: 'oklch(72% 0.19 160 / 0.08)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 'var(--text-sm)',
              border: '1px solid oklch(72% 0.19 160 / 0.2)',
            }}
          >
            <span style={{ color: 'var(--text-secondary)' }}>
              Salário Líquido Estimado no Período:
            </span>
            <span
              style={{
                fontWeight: 700,
                color: 'var(--color-emerald)',
                fontSize: 'var(--text-lg)',
              }}
            >
              {formatCurrency(calcLiquido(form))}
            </span>
          </div>
        )}
      </form>
    </Modal>
  );
}
