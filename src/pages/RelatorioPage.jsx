import { useState, useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import {
  formatCurrency,
  getAcquisitionPeriod,
  navigateAcquisitionPeriod,
} from '../utils/helpers';
import {
  getConsolidatedFinancialReport,
  exportConsolidatedReportCSV,
} from '../utils/relatorioConsolidado';

export default function RelatorioPage() {
  const data = useData();
  const [period, setPeriod] = useState(() => getAcquisitionPeriod());

  const currentPeriod = useMemo(() => getAcquisitionPeriod(), []);
  const isCurrentPeriod = period.start === currentPeriod.start && period.end === currentPeriod.end;

  // Generate complete consolidated report for the active period
  const report = useMemo(() => {
    return getConsolidatedFinancialReport(data, period);
  }, [data, period]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    if (report) {
      exportConsolidatedReportCSV(report, period);
    }
  };

  if (!report) {
    return (
      <div className="relatorio-loading">
        <div className="spinner-inline" />
        <p>Carregando dados financeiros consolidados...</p>
      </div>
    );
  }

  const {
    faturamentoBrutoTotal,
    faturamentoParticulares,
    faturamentoConvenios,
    faturamentoOutrasEntradas,
    totalDeducoesReceita,
    deducoesTaxasCartao,
    deducoesImpostosNF,
    custosBiopsias,
    custosAcessorios,
    custosAnestesistas,
    receitaOperacionalLiquida,
    totalHonorariosMedicos,
    honorariosParticulares,
    honorariosConvenios,
    totalRepassesLiquidos,
    totalAjustesCreditos,
    totalAjustesDebitos,
    totalDespesasOperacionais,
    categoriasDespesas,
    resultadoLiquidoClinica,
    margemLiquidaPercent,
    isSuperavit,
    repassesPorMedico = [],
    meiosDePagamento = {},
    folhaResumo = {},
    totalExamesParticulares,
    totalExamesConvenio,
    totalAtendimentos,
  } = report;

  const totalMeiosValor =
    Object.values(meiosDePagamento).reduce((s, m) => s + (m.valor || 0), 0) || 1;

  const totalDespesasValor = totalDespesasOperacionais || 1;

  return (
    <>
      {/* Printable Header (Visible only when printing) */}
      <div className="relatorio-print-header">
        <div className="print-brand">
          <h2>Clínica Endodiagnose</h2>
          <span className="print-subtitle">Relatório Financeiro Consolidado & DRE Gerencial</span>
        </div>
        <div className="print-meta">
          <div><strong>Competência:</strong> {period.label} ({period.start} a {period.end})</div>
          <div><strong>Emissão:</strong> {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
      </div>

      {/* Screen Sticky Page Header */}
      <div className="page-header no-print">
        <div>
          <h1 className="page-title">Relatório Financeiro Consolidado</h1>
          <p
            className="page-subtitle"
            style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-xs)', marginTop: '2px' }}
          >
            Demonstrativo de Resultado do Exercício (DRE), repasses médicos e indicadores de desempenho gerencial
          </p>
        </div>

        <div className="header-actions">
          {/* Period Navigator */}
          <div className="period-selector-wrapper">
            <div className="period-selector">
              <button
                type="button"
                className="period-btn"
                onClick={() => setPeriod((p) => navigateAcquisitionPeriod(p, -1))}
                title="Período anterior"
              >
                ◀
              </button>
              <span className="period-label">{period.label}</span>
              <button
                type="button"
                className="period-btn"
                onClick={() => setPeriod((p) => navigateAcquisitionPeriod(p, 1))}
                title="Próximo período"
              >
                ▶
              </button>
            </div>

            {!isCurrentPeriod && (
              <button
                type="button"
                className="btn btn-secondary btn-sm period-today-btn"
                onClick={() => setPeriod(getAcquisitionPeriod())}
                title="Ir para o período atual"
              >
                Hoje
              </button>
            )}
          </div>

          {/* Action Buttons */}
          <div className="table-actions">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleExportCSV}
              title="Exportar dados consolidados em planilha CSV"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>Exportar CSV</span>
            </button>

            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handlePrint}
              title="Imprimir ou gerar PDF executivo do relatório"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              <span>Imprimir / PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable Page Container */}
      <div className="page-container">
        {/* 4 Executive KPI Cards */}
        <div className="summary-cards">
          {/* KPI 1: Faturamento Bruto */}
          <div className="summary-card card-accent-emerald">
            <div className="summary-card-header">
              <span className="summary-card-label">Faturamento Bruto Consolidado</span>
              <div className="summary-card-icon emerald">💵</div>
            </div>
            <div className="summary-card-value value-positive">{formatCurrency(faturamentoBrutoTotal)}</div>
            <div className="summary-card-footer">
              {totalAtendimentos} exames ({totalExamesParticulares} part. · {totalExamesConvenio} conv.)
            </div>
          </div>

          {/* KPI 2: Custos & Deduções */}
          <div className="summary-card card-accent-red">
            <div className="summary-card-header">
              <span className="summary-card-label">Custos Diretos & Deduções</span>
              <div className="summary-card-icon red">📉</div>
            </div>
            <div className="summary-card-value value-negative">{formatCurrency(totalDeducoesReceita)}</div>
            <div className="summary-card-footer">
              {faturamentoBrutoTotal > 0
                ? `${((totalDeducoesReceita / faturamentoBrutoTotal) * 100).toFixed(1)}% do faturamento bruto`
                : 'Impostos, taxas e insumos'}
            </div>
          </div>

          {/* KPI 3: Repasses Médicos */}
          <div className="summary-card card-accent-purple">
            <div className="summary-card-header">
              <span className="summary-card-label">Repasses Médicos Totais</span>
              <div className="summary-card-icon purple">🩺</div>
            </div>
            <div className="summary-card-value">{formatCurrency(totalRepassesLiquidos)}</div>
            <div className="summary-card-footer">
              {repassesPorMedico.length} médicos com produção no período
            </div>
          </div>

          {/* KPI 4: Resultado Líquido & Margem */}
          <div className={`summary-card ${isSuperavit ? 'card-accent-emerald' : 'card-accent-red'}`}>
            <div className="summary-card-header">
              <span className="summary-card-label">Resultado Líquido da Clínica</span>
              <span className={`badge ${isSuperavit ? 'badge-success' : 'badge-danger'}`}>
                {isSuperavit ? 'Superávit' : 'Déficit'}
              </span>
            </div>
            <div className={`summary-card-value ${isSuperavit ? 'value-positive' : 'value-negative'}`}>
              {formatCurrency(resultadoLiquidoClinica)}
            </div>
            <div className="summary-card-footer">
              Margem Líquida: <strong>{margemLiquidaPercent}%</strong> do faturamento
            </div>
          </div>
        </div>

        {/* DRE Gerencial Table */}
        <div className="table-container" style={{ marginBottom: '2rem' }}>
          <div className="table-header">
            <div>
              <h3 className="table-title">Demonstrativo de Resultado do Exercício (DRE Gerencial)</h3>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Estrutura contábil-gerencial do período de {period.label}
              </div>
            </div>
          </div>

          <div className="table-scroll">
            <table className="data-table dre-table">
              <thead>
                <tr>
                  <th style={{ width: '60%' }}>Estrutura / Conta Gerencial</th>
                  <th style={{ width: '22%', textAlign: 'right' }}>Valor (R$)</th>
                  <th style={{ width: '18%', textAlign: 'right' }}>% da Receita Bruta</th>
                </tr>
              </thead>
              <tbody>
                {/* NÍVEL 1: RECEITA OPERACIONAL BRUTA */}
                <tr className="dre-row-header">
                  <td>
                    <strong>1. RECEITA OPERACIONAL BRUTA</strong>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <strong>{formatCurrency(faturamentoBrutoTotal)}</strong>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <strong>100,0%</strong>
                  </td>
                </tr>
                <tr className="dre-row-item">
                  <td style={{ paddingLeft: '28px' }}>1.1 Faturamento de Exames Particulares</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(faturamentoParticulares)}</td>
                  <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                    {faturamentoBrutoTotal > 0
                      ? `${((faturamentoParticulares / faturamentoBrutoTotal) * 100).toFixed(1)}%`
                      : '0,0%'}
                  </td>
                </tr>
                <tr className="dre-row-item">
                  <td style={{ paddingLeft: '28px' }}>1.2 Faturamento de Exames de Convênio</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(faturamentoConvenios)}</td>
                  <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                    {faturamentoBrutoTotal > 0
                      ? `${((faturamentoConvenios / faturamentoBrutoTotal) * 100).toFixed(1)}%`
                      : '0,0%'}
                  </td>
                </tr>
                {faturamentoOutrasEntradas > 0 && (
                  <tr className="dre-row-item">
                    <td style={{ paddingLeft: '28px' }}>1.3 Outras Entradas do Caixa Geral</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(faturamentoOutrasEntradas)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                      {faturamentoBrutoTotal > 0
                        ? `${((faturamentoOutrasEntradas / faturamentoBrutoTotal) * 100).toFixed(1)}%`
                        : '0,0%'}
                    </td>
                  </tr>
                )}

                {/* NÍVEL 2: DEDUÇÕES DA RECEITA & CUSTOS DIRETOS */}
                <tr className="dre-row-header dre-deducoes-header">
                  <td>
                    <strong>(-) 2. DEDUÇÕES DA RECEITA & CUSTOS DIRETOS</strong>
                  </td>
                  <td style={{ textAlign: 'right', color: 'var(--color-red)' }}>
                    <strong>-{formatCurrency(totalDeducoesReceita)}</strong>
                  </td>
                  <td style={{ textAlign: 'right', color: 'var(--color-red)' }}>
                    <strong>
                      {faturamentoBrutoTotal > 0
                        ? `${((totalDeducoesReceita / faturamentoBrutoTotal) * 100).toFixed(1)}%`
                        : '0,0%'}
                    </strong>
                  </td>
                </tr>
                <tr className="dre-row-item">
                  <td style={{ paddingLeft: '28px' }}>2.1 Impostos & Notas Fiscais (Particulares)</td>
                  <td style={{ textAlign: 'right', color: 'var(--color-red)' }}>
                    -{formatCurrency(deducoesImpostosNF)}
                  </td>
                  <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                    {faturamentoBrutoTotal > 0
                      ? `${((deducoesImpostosNF / faturamentoBrutoTotal) * 100).toFixed(1)}%`
                      : '0,0%'}
                  </td>
                </tr>
                <tr className="dre-row-item">
                  <td style={{ paddingLeft: '28px' }}>2.2 Taxas de Cartão & Maquininhas</td>
                  <td style={{ textAlign: 'right', color: 'var(--color-red)' }}>
                    -{formatCurrency(deducoesTaxasCartao)}
                  </td>
                  <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                    {faturamentoBrutoTotal > 0
                      ? `${((deducoesTaxasCartao / faturamentoBrutoTotal) * 100).toFixed(1)}%`
                      : '0,0%'}
                  </td>
                </tr>
                <tr className="dre-row-item">
                  <td style={{ paddingLeft: '28px' }}>2.3 Custos com Biópsias & Patologia</td>
                  <td style={{ textAlign: 'right', color: 'var(--color-red)' }}>
                    -{formatCurrency(custosBiopsias)}
                  </td>
                  <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                    {faturamentoBrutoTotal > 0
                      ? `${((custosBiopsias / faturamentoBrutoTotal) * 100).toFixed(1)}%`
                      : '0,0%'}
                  </td>
                </tr>
                <tr className="dre-row-item">
                  <td style={{ paddingLeft: '28px' }}>2.4 Custos com Acessórios & Descartáveis</td>
                  <td style={{ textAlign: 'right', color: 'var(--color-red)' }}>
                    -{formatCurrency(custosAcessorios)}
                  </td>
                  <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                    {faturamentoBrutoTotal > 0
                      ? `${((custosAcessorios / faturamentoBrutoTotal) * 100).toFixed(1)}%`
                      : '0,0%'}
                  </td>
                </tr>
                {custosAnestesistas > 0 && (
                  <tr className="dre-row-item">
                    <td style={{ paddingLeft: '28px' }}>2.5 Honorários de Anestesistas</td>
                    <td style={{ textAlign: 'right', color: 'var(--color-red)' }}>
                      -{formatCurrency(custosAnestesistas)}
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                      {faturamentoBrutoTotal > 0
                        ? `${((custosAnestesistas / faturamentoBrutoTotal) * 100).toFixed(1)}%`
                        : '0,0%'}
                    </td>
                  </tr>
                )}

                {/* NÍVEL 3: RECEITA OPERACIONAL LÍQUIDA */}
                <tr className="dre-row-subtotal">
                  <td>
                    <strong>(=) 3. RECEITA OPERACIONAL LÍQUIDA</strong>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <strong>{formatCurrency(receitaOperacionalLiquida)}</strong>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <strong>
                      {faturamentoBrutoTotal > 0
                        ? `${((receitaOperacionalLiquida / faturamentoBrutoTotal) * 100).toFixed(1)}%`
                        : '0,0%'}
                    </strong>
                  </td>
                </tr>

                {/* NÍVEL 4: REPASSES MÉDICOS */}
                <tr className="dre-row-header dre-repasses-header">
                  <td>
                    <strong>(-) 4. REPASSES & HONORÁRIOS MÉDICOS TOTAIS</strong>
                  </td>
                  <td style={{ textAlign: 'right', color: 'var(--color-amber)' }}>
                    <strong>-{formatCurrency(totalRepassesLiquidos)}</strong>
                  </td>
                  <td style={{ textAlign: 'right', color: 'var(--color-amber)' }}>
                    <strong>
                      {faturamentoBrutoTotal > 0
                        ? `${((totalRepassesLiquidos / faturamentoBrutoTotal) * 100).toFixed(1)}%`
                        : '0,0%'}
                    </strong>
                  </td>
                </tr>
                <tr className="dre-row-item">
                  <td style={{ paddingLeft: '28px' }}>4.1 Honorários de Exames Particulares</td>
                  <td style={{ textAlign: 'right', color: 'var(--color-amber)' }}>
                    -{formatCurrency(honorariosParticulares)}
                  </td>
                  <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                    {faturamentoBrutoTotal > 0
                      ? `${((honorariosParticulares / faturamentoBrutoTotal) * 100).toFixed(1)}%`
                      : '0,0%'}
                  </td>
                </tr>
                <tr className="dre-row-item">
                  <td style={{ paddingLeft: '28px' }}>4.2 Honorários de Exames de Convênio</td>
                  <td style={{ textAlign: 'right', color: 'var(--color-amber)' }}>
                    -{formatCurrency(honorariosConvenios)}
                  </td>
                  <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                    {faturamentoBrutoTotal > 0
                      ? `${((honorariosConvenios / faturamentoBrutoTotal) * 100).toFixed(1)}%`
                      : '0,0%'}
                  </td>
                </tr>
                {(totalAjustesCreditos > 0 || totalAjustesDebitos > 0) && (
                  <tr className="dre-row-item">
                    <td style={{ paddingLeft: '28px' }}>
                      4.3 Ajustes Líquidos de Repasses (Créditos / Débitos)
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                      {formatCurrency(totalAjustesCreditos - totalAjustesDebitos)}
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>-</td>
                  </tr>
                )}

                {/* NÍVEL 5: DESPESAS OPERACIONAIS DO CAIXA */}
                <tr className="dre-row-header dre-despesas-header">
                  <td>
                    <strong>(-) 5. DESPESAS OPERACIONAIS DO CAIXA</strong>
                  </td>
                  <td style={{ textAlign: 'right', color: 'var(--color-red)' }}>
                    <strong>-{formatCurrency(totalDespesasOperacionais)}</strong>
                  </td>
                  <td style={{ textAlign: 'right', color: 'var(--color-red)' }}>
                    <strong>
                      {faturamentoBrutoTotal > 0
                        ? `${((totalDespesasOperacionais / faturamentoBrutoTotal) * 100).toFixed(1)}%`
                        : '0,0%'}
                    </strong>
                  </td>
                </tr>
                {Object.entries(categoriasDespesas).map(([catNome, catValor]) => {
                  if (catValor <= 0) return null;
                  return (
                    <tr key={catNome} className="dre-row-item">
                      <td style={{ paddingLeft: '28px' }}>5.{catNome}</td>
                      <td style={{ textAlign: 'right', color: 'var(--color-red)' }}>
                        -{formatCurrency(catValor)}
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                        {faturamentoBrutoTotal > 0
                          ? `${((catValor / faturamentoBrutoTotal) * 100).toFixed(1)}%`
                          : '0,0%'}
                      </td>
                    </tr>
                  );
                })}

                {/* NÍVEL 6: RESULTADO LÍQUIDO FINAL */}
                <tr
                  className={`dre-row-total ${
                    isSuperavit ? 'dre-total-superavit' : 'dre-total-deficit'
                  }`}
                >
                  <td>
                    <strong>
                      (=) 6. RESULTADO LÍQUIDO FINAL ({isSuperavit ? 'SUPERÁVIT' : 'DÉFICIT'})
                    </strong>
                  </td>
                  <td
                    style={{
                      textAlign: 'right',
                      fontSize: '1.05rem',
                      fontWeight: '700',
                      color: isSuperavit ? 'var(--color-emerald)' : 'var(--color-red)',
                    }}
                  >
                    {formatCurrency(resultadoLiquidoClinica)}
                  </td>
                  <td
                    style={{
                      textAlign: 'right',
                      fontSize: '1.05rem',
                      fontWeight: '700',
                      color: isSuperavit ? 'var(--color-emerald)' : 'var(--color-red)',
                    }}
                  >
                    {margemLiquidaPercent}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Quadro de Repasses por Médico */}
        <div className="table-container" style={{ marginBottom: '2rem' }}>
          <div className="table-header">
            <div>
              <h3 className="table-title">Quadro Consolidado de Repasses Médicos</h3>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Honorários apurados, ajustes e repasse líquido final por médico no período
              </div>
            </div>
          </div>

          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Médico</th>
                  <th>Vínculo</th>
                  <th style={{ textAlign: 'right' }}>Particulares</th>
                  <th style={{ textAlign: 'right' }}>Convênios</th>
                  <th style={{ textAlign: 'right' }}>Total Honorários</th>
                  <th style={{ textAlign: 'right' }}>Ajustes Líquidos</th>
                  <th style={{ textAlign: 'right' }}>Cota Déficit</th>
                  <th style={{ textAlign: 'right' }}>Repasse Líquido</th>
                </tr>
              </thead>
              <tbody>
                {repassesPorMedico.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
                      Nenhum honorário ou repasse apurado para o período de {period.label}.
                    </td>
                  </tr>
                ) : (
                  repassesPorMedico.map((r) => (
                    <tr key={r.medicoId || r.nome}>
                      <td>
                        <strong>{r.nome}</strong>
                      </td>
                      <td>
                        {r.isSocio ? (
                          <span className="badge badge-success" title="Médico Sócio da Clínica">
                            Sócio
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Prestador</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(r.honorariosParticulares)}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(r.honorariosConvenio)}</td>
                      <td style={{ textAlign: 'right', fontWeight: '600' }}>
                        {formatCurrency(r.totalHonorariosBruto)}
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          color:
                            r.ajustesLiquidos > 0
                              ? 'var(--color-emerald)'
                              : r.ajustesLiquidos < 0
                              ? 'var(--color-red)'
                              : 'inherit',
                        }}
                      >
                        {formatCurrency(r.ajustesLiquidos)}
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          color: r.cotaDeficit > 0 ? 'var(--color-red)' : 'inherit',
                        }}
                      >
                        {r.cotaDeficit > 0 ? `-${formatCurrency(r.cotaDeficit)}` : 'R$ 0,00'}
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          fontWeight: '700',
                          color: 'var(--text-primary)',
                        }}
                      >
                        {formatCurrency(r.repasseLiquido)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {repassesPorMedico.length > 0 && (
                <tfoot>
                  <tr className="table-total-row">
                    <td colSpan="2">
                      <strong>TOTAL GERAL</strong>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <strong>{formatCurrency(honorariosParticulares)}</strong>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <strong>{formatCurrency(honorariosConvenios)}</strong>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <strong>{formatCurrency(totalHonorariosMedicos)}</strong>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <strong>{formatCurrency(totalAjustesCreditos - totalAjustesDebitos)}</strong>
                    </td>
                    <td style={{ textAlign: 'right' }}>-</td>
                    <td style={{ textAlign: 'right', color: 'var(--color-emerald)', fontSize: '1rem' }}>
                      <strong>{formatCurrency(totalRepassesLiquidos)}</strong>
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* Two Column Section: Meios de Pagamento & Despesas por Categoria */}
        <div className="overview-grid" style={{ marginBottom: '2rem' }}>
          {/* Col 1: Meios de Pagamento */}
          <div className="chart-card">
            <h3 className="chart-card-title">Distribuição por Meio de Pagamento (Particulares)</h3>
            <div className="relatorio-breakdown-list">
              {Object.entries(meiosDePagamento).map(([key, item]) => {
                const pct = ((item.valor / totalMeiosValor) * 100).toFixed(1);
                return (
                  <div key={key} className="breakdown-item">
                    <div className="breakdown-header">
                      <span className="breakdown-label">
                        <strong>{item.label}</strong>
                        <span className="breakdown-count">({item.transacoes} transações)</span>
                      </span>
                      <span className="breakdown-value">
                        {formatCurrency(item.valor)}{' '}
                        <small className="breakdown-pct">({pct}%)</small>
                      </span>
                    </div>
                    <div className="breakdown-bar-bg">
                      <div
                        className="breakdown-bar-fill fill-primary"
                        style={{ width: `${Math.min(100, Math.max(0, Number(pct)))}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Col 2: Despesas por Categoria */}
          <div className="chart-card">
            <h3 className="chart-card-title">Despesas Operacionais por Categoria (Caixa)</h3>
            <div className="relatorio-breakdown-list">
              {Object.entries(categoriasDespesas).map(([cat, val]) => {
                const pct = ((val / totalDespesasValor) * 100).toFixed(1);
                return (
                  <div key={cat} className="breakdown-item">
                    <div className="breakdown-header">
                      <span className="breakdown-label">
                        <strong>{cat}</strong>
                      </span>
                      <span className="breakdown-value value-negative">
                        {formatCurrency(val)}{' '}
                        <small className="breakdown-pct">({pct}%)</small>
                      </span>
                    </div>
                    <div className="breakdown-bar-bg">
                      <div
                        className="breakdown-bar-fill fill-danger"
                        style={{ width: `${Math.min(100, Math.max(0, Number(pct)))}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Resumo da Folha de Pagamento */}
        <div className="chart-card" style={{ marginBottom: '2rem' }}>
          <h3 className="chart-card-title">
            Resumo da Folha de Pagamento da Competência ({folhaResumo.colaboradoresCount} colaboradores cadastrados)
          </h3>
          <div className="folha-summary-grid">
            <div className="folha-summary-item">
              <span className="folha-summary-label">Salários-Base</span>
              <span className="folha-summary-val">{formatCurrency(folhaResumo.totalSalariosBase)}</span>
            </div>
            <div className="folha-summary-item">
              <span className="folha-summary-label">Benefícios (VT/VR)</span>
              <span className="folha-summary-val">{formatCurrency(folhaResumo.totalBeneficios)}</span>
            </div>
            <div className="folha-summary-item">
              <span className="folha-summary-label">Adicionais / Variáveis</span>
              <span className="folha-summary-val">{formatCurrency(folhaResumo.totalVariaveis)}</span>
            </div>
            <div className="folha-summary-item">
              <span className="folha-summary-label">Descontos Legais</span>
              <span className="folha-summary-val value-negative">
                -{formatCurrency(folhaResumo.totalDescontosFolha)}
              </span>
            </div>
            <div className="folha-summary-item folha-summary-highlight">
              <span className="folha-summary-label">Custo Líquido da Folha</span>
              <span className="folha-summary-val value-positive">
                {formatCurrency(folhaResumo.totalFolhaLiquida)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
