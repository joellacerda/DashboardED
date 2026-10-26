import {
  formatDate,
  getTodayISO,
  formatCurrency,
  getAcquisitionPeriod,
} from '../../utils/helpers';

export default function FluxoCaixaLancamentoSection({
  fluxoPeriod,
  setFluxoPeriod,
  handleNavigateFluxoPeriod,
  handleFluxoDateChange,
  fluxoForm,
  setFluxoForm,
  hasError,
  markTouched,
  validationErrors,
  splitCalculations,
  item,
  destinoFluxo,
  currentConsolidatedValor,
}) {
  return (
    <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div
        style={{
          fontSize: 'var(--text-sm)',
          fontWeight: 700,
          color: 'var(--text-primary)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
        }}
      >
        💵 Lançar Entrada no Fluxo de Caixa
      </div>

      {/* SELETOR DE PERÍODO / COMPETÊNCIA FINANCEIRA */}
      <div
        style={{
          background: 'var(--color-dark-850)',
          border: '1px solid var(--border-medium)',
          borderRadius: 'var(--radius-md)',
          padding: '0.85rem 1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.6rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}
        >
          <div>
            <span
              style={{
                fontSize: 'var(--text-xs)',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--color-emerald)',
              }}
            >
              📅 Período de Entrada / Competência Financeira
            </span>
            <div
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--text-secondary)',
                marginTop: '0.15rem',
              }}
            >
              Defina em qual período financeiro este valor deve entrar no Fluxo de Caixa:
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {item.data && (
              <button
                type="button"
                className="split-quick-btn"
                title="Definir para o período em que o exame foi realizado meses atrás"
                onClick={() => {
                  try {
                    const p = getAcquisitionPeriod(new Date(item.data.replace(/-/g, '/')));
                    setFluxoPeriod(p);
                    setFluxoForm((prev) => ({ ...prev, data: item.data }));
                  } catch {
                    // ignore
                  }
                }}
              >
                Mês do Exame ({formatDate(item.data)})
              </button>
            )}
            <button
              type="button"
              className="split-quick-btn highlight"
              title="Definir para o período financeiro atual"
              onClick={() => {
                const p = getAcquisitionPeriod();
                setFluxoPeriod(p);
                setFluxoForm((prev) => ({ ...prev, data: getTodayISO() }));
              }}
            >
              ⚡ Período Atual
            </button>
          </div>
        </div>

        {/* Botões de navegação de período ◀ [Label] ▶ */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: '0.2rem',
          }}
        >
          <div
            className="period-selector"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-strong)',
              padding: '0.35rem 0.75rem',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
            }}
          >
            <button
              type="button"
              className="period-btn"
              onClick={() => handleNavigateFluxoPeriod(-1)}
              title="Período anterior"
              style={{ fontSize: '1rem', padding: '0.2rem 0.5rem' }}
            >
              ◀
            </button>
            <span
              className="period-label"
              style={{
                fontWeight: 700,
                color: 'var(--color-emerald)',
                fontSize: 'var(--text-sm)',
                letterSpacing: '0.02em',
              }}
            >
              {fluxoPeriod.label}
            </span>
            <button
              type="button"
              className="period-btn"
              onClick={() => handleNavigateFluxoPeriod(1)}
              title="Próximo período"
              style={{ fontSize: '1rem', padding: '0.2rem 0.5rem' }}
            >
              ▶
            </button>
          </div>
        </div>
      </div>

      <div className="modal-form-grid">
        <div className="input-group">
          <label className="input-label">
            Data Específica do Recebimento <span className="required">*</span>
          </label>
          <input
            type="date"
            className={`input-field ${hasError('data') ? 'is-invalid' : ''}`}
            required
            value={fluxoForm.data}
            onChange={(e) => handleFluxoDateChange(e.target.value)}
            onBlur={() => markTouched('data')}
          />
          {hasError('data') && (
            <div className="input-feedback-error">
              <span>⚠</span> {validationErrors.data}
            </div>
          )}
        </div>

        <div className="input-group">
          <label className="input-label">
            Valor a Lançar (R$) <span className="required">*</span>{' '}
            <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>
              (Edição manual livre)
            </span>
          </label>
          <input
            type="number"
            className={`input-field ${hasError('valor') ? 'is-invalid' : ''}`}
            required
            min="0.01"
            step="0.01"
            placeholder="0,00"
            value={fluxoForm.valor}
            onChange={(e) => setFluxoForm({ ...fluxoForm, valor: e.target.value })}
            onBlur={() => markTouched('valor')}
          />
          {hasError('valor') && (
            <div className="input-feedback-error">
              <span>⚠</span> {validationErrors.valor}
            </div>
          )}
          {splitCalculations.total > 0 && (
            <div className="split-quick-fills">
              <button
                type="button"
                className="split-quick-btn highlight"
                title={
                  splitCalculations.isPolipectomiaMode
                    ? 'Preenche com o Direito da Clínica (Taxa de sala + 50% polipectomia + 100% alça)'
                    : 'Preenche com o valor líquido que fica com a clínica após descontar o repasse do médico'
                }
                onClick={() =>
                  setFluxoForm({
                    ...fluxoForm,
                    valor:
                      splitCalculations.direitoClinica > 0
                        ? splitCalculations.direitoClinica.toFixed(2)
                        : '0.00',
                  })
                }
              >
                {splitCalculations.isPolipectomiaMode
                  ? `⚡ Usar Direito da Clínica (${formatCurrency(splitCalculations.direitoClinica)})`
                  : `⚡ Usar Líquido (${formatCurrency(splitCalculations.direitoClinica)})`}
              </button>
              <button
                type="button"
                className="split-quick-btn"
                title={
                  splitCalculations.isPolipectomiaMode
                    ? 'Preenche com o que o convênio pagou diretamente à clínica (Taxa de sala)'
                    : 'Preenche com o valor bruto total recebido pela clínica'
                }
                onClick={() =>
                  setFluxoForm({
                    ...fluxoForm,
                    valor:
                      splitCalculations.valClinicaNum > 0
                        ? splitCalculations.valClinicaNum.toFixed(2)
                        : '0.00',
                  })
                }
              >
                {splitCalculations.isPolipectomiaMode
                  ? `⚡ Usar Recebido do Convênio (${formatCurrency(splitCalculations.valClinicaNum)})`
                  : `⚡ Usar Bruto Clínica (${formatCurrency(splitCalculations.valClinicaNum)})`}
              </button>
            </div>
          )}
        </div>

        <div className="input-group full-width">
          <label className="input-label">Entrada no Fluxo de Caixa (Consolidada)</label>
          <div
            style={{
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              borderRadius: 'var(--radius-md)',
              padding: '0.75rem 1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.4rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.2rem' }}>🏢</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--text-sm)' }}>
                  Consolidação no Fluxo:{' '}
                  <strong style={{ color: 'var(--color-emerald)', fontSize: 'var(--text-base)' }}>
                    {destinoFluxo.display}
                  </strong>
                </span>
              </div>
              <span className="badge badge-success" style={{ textTransform: 'none' }}>
                Entrada Única
              </span>
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
              {!destinoFluxo.isUnimed &&
              item?.convenio &&
              item.convenio.trim().toUpperCase() !== 'COOPEND' ? (
                <>
                  Este exame do convênio <strong>{item.convenio}</strong> entra no repasse
                  consolidado da <strong>"Coopend"</strong> (cooperativa que repassa todos os
                  convênios exceto Unimed) no período <strong>{fluxoPeriod.label}</strong>.
                </>
              ) : (
                <>
                  No Fluxo de Caixa, este valor é somado à entrada única de{' '}
                  <strong>"{destinoFluxo.display}"</strong> do período{' '}
                  <strong>{fluxoPeriod.label}</strong>. Não serão criadas entradas duplicadas.
                </>
              )}
            </div>
            {currentConsolidatedValor > 0 && (
              <div
                style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-muted)',
                  borderTop: '1px dashed var(--border-subtle)',
                  paddingTop: '0.4rem',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                  justifyContent: 'space-between',
                }}
              >
                <span>
                  Total já acumulado de {destinoFluxo.display}:{' '}
                  <strong>{formatCurrency(currentConsolidatedValor)}</strong>
                </span>
                {Number(fluxoForm.valor) > 0 && (
                  <span>
                    ➔ Novo total consolidado:{' '}
                    <strong style={{ color: 'var(--color-emerald)' }}>
                      {formatCurrency(
                        currentConsolidatedValor -
                          (Number(item?.fluxoValorLancado) || 0) +
                          Number(fluxoForm.valor)
                      )}
                    </strong>
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="input-group">
          <label className="input-label">Categoria</label>
          <input type="text" className="input-field" readOnly value={fluxoForm.categoria} />
        </div>

        <div className="input-group">
          <label className="input-label">Tipo</label>
          <input type="text" className="input-field" readOnly value="Entrada" />
        </div>
      </div>
    </div>
  );
}
