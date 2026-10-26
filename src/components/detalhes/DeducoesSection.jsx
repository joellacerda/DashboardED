import { formatCurrency } from '../../utils/helpers';

export default function DeducoesSection({
  form,
  updateField,
  totalPagamentos,
}) {
  return (
    <>
      <div className="input-group">
        <label className="input-label">Valor Retido em Taxas (R$)</label>
        <input
          type="number"
          className="input-field"
          min="0"
          step="0.01"
          placeholder="0,00"
          value={form.valorRetidoTaxas}
          onChange={(e) => updateField('valorRetidoTaxas', e.target.value)}
        />
      </div>

      <div className="input-group">
        <label className="input-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Valor Nota Fiscal (R$)</span>
          {totalPagamentos > 0 && (
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400 }}>
              {form.notaFiscalPercentual || 0}% de {formatCurrency(totalPagamentos)}
            </span>
          )}
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', width: '68px', flexShrink: 0 }}>
            <input
              type="number"
              className="input-field"
              min="0"
              max="100"
              step="0.5"
              style={{ width: '100%', textAlign: 'center', padding: '0.45rem 0.2rem' }}
              value={form.notaFiscalPercentual}
              onChange={(e) => updateField('notaFiscalPercentual', e.target.value)}
              title="Porcentagem da Nota Fiscal"
            />
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', fontWeight: 600 }}>%</span>
          </div>
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>=</span>
          <input
            type="number"
            className="input-field"
            min="0"
            step="0.01"
            placeholder="0,00"
            style={{ flex: 1, minWidth: 0 }}
            value={form.valorNotaFiscal}
            onChange={(e) => updateField('valorNotaFiscal', e.target.value)}
          />
        </div>
      </div>

      <div className="input-group">
        <label className="input-label">Valor Anestesista (R$)</label>
        <input
          type="number"
          className="input-field"
          min="0"
          step="0.01"
          placeholder="0,00"
          value={form.valorAnestesista}
          onChange={(e) => updateField('valorAnestesista', e.target.value)}
        />
      </div>

      <div className="input-group">
        <label className="input-label">Taxa de Clínica (R$)</label>
        <input
          type="number"
          className="input-field"
          min="0"
          step="0.01"
          placeholder="0,00"
          value={form.taxaClinica}
          onChange={(e) => updateField('taxaClinica', e.target.value)}
        />
      </div>

      <div className="input-group">
        <label className="input-label">Valor de Acessórios (R$)</label>
        <input
          type="number"
          className="input-field"
          min="0"
          step="0.01"
          placeholder="0,00"
          value={form.valorAcessorios}
          onChange={(e) => updateField('valorAcessorios', e.target.value)}
        />
        {Number(form.valorAcessorios) > 0 && (
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer', fontSize: 'var(--text-xs)', marginTop: '0.4rem', color: form.acessorioParaMedico ? 'var(--color-emerald)' : 'var(--text-muted)', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={form.acessorioParaMedico}
              onChange={(e) => updateField('acessorioParaMedico', e.target.checked)}
            />
            <span>👨‍⚕️ Adicionar ao honorário do médico realizante (ao invés do caixa da clínica)</span>
          </label>
        )}
      </div>

      <div className="input-group">
        <label className="input-label">Valor de Biópsia (R$)</label>
        <input
          type="number"
          className="input-field"
          min="0"
          step="0.01"
          placeholder="0,00"
          value={form.valorBiopsia}
          onChange={(e) => updateField('valorBiopsia', e.target.value)}
        />
      </div>

      <div className="input-group full-width">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label className="input-label">Honorários Médicos — Total (R$)</label>
        </div>
        <input
          type="number"
          className="input-field"
          min="0"
          step="0.01"
          placeholder="0,00"
          value={form.honorariosMedicos}
          onChange={(e) => updateField('honorariosMedicos', e.target.value)}
        />
      </div>
    </>
  );
}
