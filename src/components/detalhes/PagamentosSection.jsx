import { formatCurrency, isCreditCardPayment } from '../../utils/helpers';

export default function PagamentosSection({
  form,
  updatePagamento,
  addPagamento,
  removePagamento,
  hasError,
  validationErrors,
  submitted,
  totalPagamentos,
}) {
  return (
    <div className="full-width pagamentos-section">
      <div className="pagamentos-header">
        <span className="pagamentos-title">💳 Pagamentos <span className="required">*</span></span>
        <button
          type="button"
          className="btn-pagamento-add"
          onClick={addPagamento}
        >
          + Adicionar
        </button>
      </div>

      {hasError('pagamentos') && (
        <div className="input-feedback-error" style={{ marginBottom: '0.75rem' }}>
          <span>⚠</span> {validationErrors.pagamentos}
        </div>
      )}

      {(form.pagamentos || []).map((pag, idx) => (
        <div key={idx} className="pagamento-row">
          <div className="pagamento-row-header">
            <span className="pagamento-row-label">Pagamento {idx + 1}</span>
            {(form.pagamentos || []).length > 1 && (
              <button
                type="button"
                className="pagamento-row-remove"
                onClick={() => removePagamento(idx)}
                title="Remover pagamento"
              >
                ✕
              </button>
            )}
          </div>
          <div className="pagamento-row-fields">
            <div className="input-group">
              <label className="input-label">Forma</label>
              <select
                className="input-field"
                value={pag.forma || 'Cartão de Crédito'}
                onChange={(e) => updatePagamento(idx, 'forma', e.target.value)}
              >
                <option value="Cartão de Crédito">Cartão de Crédito</option>
                <option value="Pix">Pix</option>
                <option value="Espécie">Espécie</option>
                <option value="Cartão de Débito">Cartão de Débito</option>
              </select>
            </div>
            <div className="input-group">
              <label className="input-label">Valor (R$)</label>
              <input
                type="number"
                className={`input-field ${submitted && (!pag.valor || Number(pag.valor) <= 0) ? 'is-invalid' : ''}`}
                min="0"
                step="0.01"
                placeholder="0,00"
                value={pag.valor}
                onChange={(e) => updatePagamento(idx, 'valor', e.target.value)}
              />
              {submitted && (!pag.valor || Number(pag.valor) <= 0) && (
                <div className="input-feedback-error">
                  <span>⚠</span> Valor maior que R$ 0,00 obrigatório
                </div>
              )}
            </div>
            {isCreditCardPayment(pag.forma, 1) && (
              <div className="input-group">
                <label className="input-label">Parcelas</label>
                <input
                  type="number"
                  className="input-field"
                  min="1"
                  step="1"
                  placeholder="1"
                  value={pag.parcelas}
                  onChange={(e) => updatePagamento(idx, 'parcelas', e.target.value)}
                />
              </div>
            )}
          </div>
        </div>
      ))}

      {totalPagamentos > 0 && (
        <div className="pagamentos-total">
          Total Pagamentos: <strong>{formatCurrency(totalPagamentos)}</strong>
        </div>
      )}
    </div>
  );
}
