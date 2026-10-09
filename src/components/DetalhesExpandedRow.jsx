import {
  migrateLegacyPayment,
  isDateInPeriod,
  formatCurrency,
  roundCurrency,
  getInstallmentLabels,
} from '../utils/helpers';

export default function DetalhesExpandedRow({ item, period }) {
  const pags = migrateLegacyPayment(item);
  const isExamInThisPeriod = isDateInPeriod(item.data, period);

  return (
    <tr className="expanded-detail-row">
      <td colSpan="8">
        <div className="expanded-detail-panel">
          {item.isConvenio && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '0.75rem',
              padding: '0.4rem 0.75rem',
              borderRadius: '6px',
              background: item.manualOverride ? 'oklch(0.25 0.05 240 / 0.3)' : 'oklch(0.2 0.04 160 / 0.3)',
              border: `1px solid ${item.manualOverride ? 'oklch(0.4 0.1 240 / 0.4)' : 'oklch(0.35 0.08 160 / 0.4)'}`,
              fontSize: 'var(--text-xs)',
            }}>
              <span>{item.manualOverride ? '🛡️' : '⚡'}</span>
              <span style={{ fontWeight: 600 }}>
                {item.manualOverride ? 'Sincronização Personalizada:' : 'Sincronizado do Convênio:'}
              </span>
              <span style={{ color: 'var(--text-muted)' }}>
                {item.manualOverride
                  ? 'Valores manuais protegidos contra sobreposição automática do Convênio.'
                  : 'Cálculos sincronizados diretamente do módulo de Convênios.'}
              </span>
            </div>
          )}
          <div className="expanded-detail-grid">
            {/* Coluna 1: Financeiro Bruto */}
            <div className="expanded-detail-section">
              <div className="expanded-detail-section-title">💳 Pagamento</div>
              <div className="expanded-detail-items">
                <div className="expanded-detail-item">
                  <span className="expanded-detail-label">Total Pagamento</span>
                  <span className="expanded-detail-value">
                    {isExamInThisPeriod ? formatCurrency(item.valorPagamento) : '—'}
                  </span>
                </div>
                {pags.map((p, i) => (
                  <div className="expanded-detail-item" key={i}>
                    <span className="expanded-detail-label">{p.forma}</span>
                    <span className="expanded-detail-value" style={{ fontSize: 'var(--text-xs)' }}>
                      {formatCurrency(p.valor)}
                      {p.parcelas > 1 ? ` (${p.parcelas}x)` : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Coluna 2: Deduções */}
            <div className="expanded-detail-section">
              <div className="expanded-detail-section-title">📊 Deduções</div>
              <div className="expanded-detail-items">
                <div className="expanded-detail-item">
                  <span className="expanded-detail-label">Taxas Retidas</span>
                  <span className="expanded-detail-value value-negative">
                    {isExamInThisPeriod ? formatCurrency(item.valorRetidoTaxas) : '—'}
                  </span>
                </div>
                <div className="expanded-detail-item">
                  <span className="expanded-detail-label">
                    Nota Fiscal{item.notaFiscalPercentual ? ` (${item.notaFiscalPercentual}%)` : ''}
                  </span>
                  <span className="expanded-detail-value value-negative">
                    {isExamInThisPeriod ? formatCurrency(item.valorNotaFiscal) : '—'}
                  </span>
                </div>
                <div className="expanded-detail-item">
                  <span className="expanded-detail-label">Anestesista</span>
                  <span className="expanded-detail-value value-negative">
                    {isExamInThisPeriod ? formatCurrency(item.valorAnestesista) : '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Coluna 3: Receita Clínica */}
            <div className="expanded-detail-section">
              <div className="expanded-detail-section-title">🏥 Receita Clínica</div>
              <div className="expanded-detail-items">
                <div className="expanded-detail-item">
                  <span className="expanded-detail-label">Taxa Clínica</span>
                  <span className="expanded-detail-value value-positive">
                    {isExamInThisPeriod ? formatCurrency(item.taxaClinica) : '—'}
                  </span>
                </div>
                <div className="expanded-detail-item">
                  <span className="expanded-detail-label">
                    Acessórios{item.acessorioParaMedico ? ' (→ Médico)' : ''}
                  </span>
                  <span className="expanded-detail-value value-positive">
                    {isExamInThisPeriod ? formatCurrency(item.valorAcessorios) : '—'}
                  </span>
                </div>
                <div className="expanded-detail-item">
                  <span className="expanded-detail-label">Biópsia</span>
                  <span className="expanded-detail-value value-positive">
                    {isExamInThisPeriod ? formatCurrency(item.valorBiopsia) : '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Coluna 4: Honorários */}
            <div className="expanded-detail-section">
              <div className="expanded-detail-section-title">👨‍⚕️ Honorários</div>
              <div className="expanded-detail-items">
                <div className="expanded-detail-item">
                  <span className="expanded-detail-label">Total Honorários</span>
                  <span className="expanded-detail-value" style={{ fontWeight: 700 }}>
                    {formatCurrency(item.honorariosMedicos)}
                  </span>
                </div>
                {(item.temDivisao || item.medico2) && (
                  <>
                    {item.divisaoTipo === 'valor' ? (
                      <>
                        <div className="expanded-detail-item">
                          <span className="expanded-detail-label">{item.medico || 'Médico 1'}</span>
                          <span className="expanded-detail-value">
                            {formatCurrency(item.valorMedico1)}
                          </span>
                        </div>
                        <div className="expanded-detail-item">
                          <span className="expanded-detail-label">{item.medico2 || 'Médico 2'}</span>
                          <span className="expanded-detail-value">
                            {formatCurrency(item.valorMedico2)}
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="expanded-detail-item">
                          <span className="expanded-detail-label">
                            {item.medico || 'Médico 1'} ({item.porcentagemMedico1 ?? 50}%)
                          </span>
                          <span className="expanded-detail-value">
                            {formatCurrency(
                              roundCurrency(
                                (Number(item.honorariosMedicos || 0) *
                                  (Number(item.porcentagemMedico1) ?? 50)) /
                                  100
                              )
                            )}
                          </span>
                        </div>
                        <div className="expanded-detail-item">
                          <span className="expanded-detail-label">
                            {item.medico2 || 'Médico 2'} ({item.porcentagemMedico2 ?? 50}%)
                          </span>
                          <span className="expanded-detail-value">
                            {formatCurrency(
                              roundCurrency(
                                (Number(item.honorariosMedicos || 0) *
                                  (Number(item.porcentagemMedico2) ?? 50)) /
                                  100
                              )
                            )}
                          </span>
                        </div>
                      </>
                    )}
                  </>
                )}
                <div
                  className="expanded-detail-item"
                  style={{
                    borderTop: '1px dashed var(--border-subtle)',
                    paddingTop: '0.35rem',
                    marginTop: '0.2rem',
                  }}
                >
                  <span className="expanded-detail-label">Período Parcelas</span>
                  <span
                    className="expanded-detail-value"
                    style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}
                  >
                    {getInstallmentLabels(item.data, pags, item.formaPagamento).map(
                      (label, idx) => (
                        <div key={idx} style={{ whiteSpace: 'nowrap' }}>
                          {label}
                        </div>
                      )
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}
