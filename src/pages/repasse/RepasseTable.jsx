import { formatCurrency, exportCSV, exportPDF } from '../../utils/helpers';
import ExportMenu from '../../components/ExportMenu';

export default function RepasseTable({
  repasseRows,
  onNavigateToDoctor,
  setViewingCompensacao,
  setViewingObs,
  openEditAjuste,
  totalHonorariosRepassados,
  totalCreditos,
  totalDebitos,
  totalCompensacoesGeral,
  totalBNB,
  totalCotaClinica,
  totalLiquidoGeral,
  cotaPorSocio,
  exportColumns,
  period,
}) {
  return (
    <div className="table-container">
      <div className="table-header">
        <h3 className="table-title">Demostrativo de Repasse por Médico</h3>
        <div className="table-actions">
          <ExportMenu
            onExportCSV={() => exportCSV(repasseRows, exportColumns, `repasses_medicos_${period.start}`)}
            onExportPDF={() => exportPDF(repasseRows, exportColumns, `Repasses Médicos — ${period.label}`)}
          />
        </div>
      </div>

      <div className="table-scroll">
        <table className="data-table repasse-table" style={{ fontSize: 'var(--text-sm)' }}>
          <thead>
            <tr style={{ background: 'oklch(22% 0.04 160)' }}>
              <th style={{ color: 'white', fontWeight: 600 }}>Médico</th>
              <th style={{ color: 'white', fontWeight: 600 }}>Honorários</th>
              <th style={{ color: 'white', fontWeight: 600 }}>Créditos</th>
              <th style={{ color: 'white', fontWeight: 600 }}>Débitos</th>
              <th
                style={{ color: 'white', fontWeight: 600 }}
                title="Compensação automática de materiais/alça e 50% de polipectomia recebidos pelo médico"
              >
                Compensações
              </th>
              <th style={{ color: 'white', fontWeight: 600 }}>BNB</th>
              <th style={{ color: 'white', fontWeight: 600 }}>Cota clínica</th>
              <th style={{ color: 'white', fontWeight: 600 }}>Total</th>
              <th style={{ color: 'white', fontWeight: 600, width: '60px', textAlign: 'center' }}>OBS</th>
              <th style={{ color: 'white', fontWeight: 600, width: '70px', textAlign: 'center' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {repasseRows.length === 0 ? (
              <tr>
                <td colSpan="10">
                  <div className="table-empty">
                    <div className="table-empty-icon">👨‍⚕️</div>
                    <p>Nenhum médico ou repasse registrado para este período.</p>
                  </div>
                </td>
              </tr>
            ) : (
              <>
                {repasseRows.map((row) => (
                  <tr key={row.nome}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 500 }}>
                        <span
                          style={{
                            cursor: onNavigateToDoctor ? 'pointer' : 'default',
                            color: onNavigateToDoctor ? 'var(--color-emerald)' : 'inherit',
                            textDecoration: onNavigateToDoctor ? 'underline' : 'none',
                            textUnderlineOffset: '2px',
                          }}
                          onClick={() => onNavigateToDoctor && onNavigateToDoctor(row.nome)}
                          title="Abrir Dashboard Individual deste Médico"
                        >
                          {row.nome}
                        </span>
                        {row.isSocio && (
                          <span className="badge badge-success" title="Médico Sócio da Clínica">
                            Sócio
                          </span>
                        )}
                        {!row.isActive && (
                          <span
                            className="badge badge-danger"
                            style={{ opacity: 0.8 }}
                            title="Médico Desativado (histórico preservado)"
                          >
                            Inativo
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="value-currency">{formatCurrency(row.honorarios)}</td>

                    <td className={row.creditos > 0 ? 'value-positive' : ''}>
                      {formatCurrency(row.creditos)}
                    </td>

                    <td className={row.debitos > 0 ? 'value-negative' : ''}>
                      {row.debitos > 0 ? `-${formatCurrency(row.debitos)}` : 'R$ 0,00'}
                    </td>

                    <td className={row.compensacaoConvenios > 0 ? 'value-negative' : ''}>
                      {row.compensacaoConvenios > 0 ? (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            justifyContent: 'flex-end',
                          }}
                        >
                          <span style={{ fontWeight: 600 }}>
                            -{formatCurrency(row.compensacaoConvenios)}
                          </span>
                          <button
                            type="button"
                            className="btn btn-ghost btn-icon btn-sm"
                            style={{
                              padding: '2px 5px',
                              fontSize: '11px',
                              color: 'var(--color-amber)',
                              background: 'rgba(245, 158, 11, 0.12)',
                              borderRadius: '4px',
                              border: '1px solid rgba(245, 158, 11, 0.25)',
                              cursor: 'pointer',
                            }}
                            onClick={() =>
                              setViewingCompensacao({
                                doctor: row.nome,
                                items: row.compensacaoItems,
                                total: row.compensacaoConvenios,
                              })
                            }
                            title={`Ver detalhes das compensações deste médico (${row.compensacaoCount} exame(s))`}
                          >
                            ℹ️
                          </button>
                        </div>
                      ) : (
                        'R$ 0,00'
                      )}
                    </td>

                    <td className={row.bnb > 0 ? 'value-negative' : ''}>
                      {row.bnb > 0 ? `-${formatCurrency(row.bnb)}` : 'R$ 0,00'}
                    </td>

                    <td className={row.cotaClinica > 0 ? 'value-negative' : ''}>
                      {row.cotaClinica > 0 ? `-${formatCurrency(row.cotaClinica)}` : 'R$ 0,00'}
                    </td>

                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span
                          className={row.total >= 0 ? 'value-positive' : 'value-negative'}
                          style={{ fontWeight: 700 }}
                        >
                          {row.total >= 0
                            ? formatCurrency(row.total)
                            : `-${formatCurrency(Math.abs(row.total))}`}
                        </span>
                        <span
                          style={{
                            fontSize: '10px',
                            color: row.total >= 0 ? 'var(--color-emerald)' : 'var(--color-red)',
                          }}
                        >
                          {row.total >= 0 ? '▲ A receber da clínica' : '▼ A pagar à clínica'}
                        </span>
                      </div>
                    </td>

                    <td style={{ textAlign: 'center', width: '60px' }}>
                      {row.obs ? (
                        <button
                          type="button"
                          className="btn btn-ghost btn-icon btn-sm"
                          style={{
                            background: 'rgba(16, 185, 129, 0.12)',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            color: 'var(--color-emerald)',
                            borderRadius: '6px',
                            padding: '3px 8px',
                            fontSize: '13px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s ease',
                          }}
                          onClick={() => setViewingObs({ doctor: row.nome, obs: row.obs, row })}
                          title={`Clique para ver a observação:\n"${row.obs}"`}
                        >
                          📝
                        </button>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>

                    <td style={{ textAlign: 'center', width: '70px' }}>
                      <button
                        className="btn btn-ghost btn-icon btn-sm"
                        onClick={() => openEditAjuste(row)}
                        title="Editar débitos, créditos, BNB e sócio"
                      >
                        ✏️
                      </button>
                    </td>
                  </tr>
                ))}

                {/* Totals Row */}
                <tr className="totals-row">
                  <td style={{ fontWeight: 700 }}>Totais no período:</td>
                  <td className="value-currency">{formatCurrency(totalHonorariosRepassados)}</td>
                  <td className="value-positive">{formatCurrency(totalCreditos)}</td>
                  <td className="value-negative">
                    {totalDebitos > 0 ? `-${formatCurrency(totalDebitos)}` : 'R$ 0,00'}
                  </td>
                  <td className="value-negative">
                    {totalCompensacoesGeral > 0
                      ? `-${formatCurrency(totalCompensacoesGeral)}`
                      : 'R$ 0,00'}
                  </td>
                  <td className="value-negative">
                    {totalBNB > 0 ? `-${formatCurrency(totalBNB)}` : 'R$ 0,00'}
                  </td>
                  <td className="value-negative">
                    {totalCotaClinica > 0 ? `-${formatCurrency(totalCotaClinica)}` : 'R$ 0,00'}
                  </td>
                  <td
                    className={totalLiquidoGeral >= 0 ? 'value-positive' : 'value-negative'}
                    style={{ fontWeight: 700 }}
                  >
                    {totalLiquidoGeral >= 0
                      ? formatCurrency(totalLiquidoGeral)
                      : `-${formatCurrency(Math.abs(totalLiquidoGeral))}`}
                  </td>
                  <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>—</td>
                  <td />
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>

      {repasseRows.length > 0 && (
        <div className="table-footer">
          <span>{repasseRows.length} médico(s) no demonstrativo</span>
          <span>Cota Clínica Rateada por Sócio: {formatCurrency(cotaPorSocio)}</span>
        </div>
      )}
    </div>
  );
}
