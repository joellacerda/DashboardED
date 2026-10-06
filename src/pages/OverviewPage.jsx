import { useState, useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import {
  formatCurrency,
  getAcquisitionPeriod,
  navigateAcquisitionPeriod,
  isDateInPeriod,
  getHonorarioInPeriod,
  normalizeProcedimentosComplementares,
} from '../utils/helpers';

function calcVariation(curr, prev) {
  if (prev === undefined || prev === null || prev === 0) {
    if (curr > 0) return 100;
    return null;
  }
  return ((curr - prev) / Math.abs(prev)) * 100;
}

function TrendBadge({ value, invert = false }) {
  if (value === null || value === undefined || isNaN(value)) {
    return (
      <span className="kpi-trend trend-neutral" title="Sem dados no período anterior para comparação">
        —
      </span>
    );
  }
  const isZero = Math.abs(value) < 0.05;
  if (isZero) {
    return (
      <span className="kpi-trend trend-neutral" title="Estável em relação ao período anterior">
        0%
      </span>
    );
  }
  const isPositive = value > 0;
  const isGood = invert ? !isPositive : isPositive;
  const arrow = isPositive ? '↑' : '↓';
  const formatted = `${isPositive ? '+' : ''}${value.toFixed(1)}%`;
  return (
    <span
      className={`kpi-trend ${isGood ? 'trend-up' : 'trend-down'}`}
      title={`Variação vs. período anterior (${formatted})`}
    >
      <span>{arrow}</span>
      <span>{formatted}</span>
    </span>
  );
}

export default function OverviewPage() {
  const [period, setPeriod] = useState(() => getAcquisitionPeriod());
  const {
    exames: examesParticulares = [],
    examesConvenio = [],
    fluxoCaixa: fluxo = [],
    detalhesExames: detalhes = [],
  } = useData();

  const currentPeriod = useMemo(() => getAcquisitionPeriod(), []);
  const isCurrentPeriod = period.start === currentPeriod.start && period.end === currentPeriod.end;
  const previousPeriod = useMemo(() => navigateAcquisitionPeriod(period, -1), [period]);

  // Current period metrics
  const examesParticularesInPeriod = useMemo(
    () => examesParticulares.filter((e) => isDateInPeriod(e.data, period)),
    [examesParticulares, period]
  );
  const examesConvenioInPeriod = useMemo(
    () => examesConvenio.filter((e) => isDateInPeriod(e.data, period)),
    [examesConvenio, period]
  );
  const totalExames = examesParticularesInPeriod.length + examesConvenioInPeriod.length;

  const periodFluxo = useMemo(
    () => fluxo.filter((f) => isDateInPeriod(f.data, period)),
    [fluxo, period]
  );
  const totalEntradas = periodFluxo
    .filter((f) => f.tipo === 'entrada')
    .reduce((s, f) => s + Number(f.valor || 0), 0);
  const totalSaidas = periodFluxo
    .filter((f) => f.tipo === 'saida')
    .reduce((s, f) => s + Number(f.valor || 0), 0);
  const saldo = totalEntradas - totalSaidas;

  const detalhesNoPeriodo = useMemo(
    () => detalhes.filter((d) => isDateInPeriod(d.data, period)),
    [detalhes, period]
  );
  const totalClinica = detalhesNoPeriodo.reduce((s, d) => s + Number(d.taxaClinica || 0), 0);
  const totalAcessorios = detalhesNoPeriodo.reduce((s, d) => s + Number(d.valorAcessorios || 0), 0);
  const totalBiopsia = detalhesNoPeriodo.reduce((s, d) => s + Number(d.valorBiopsia || 0), 0);
  const totalReceitaClinica = totalClinica + totalAcessorios + totalBiopsia;

  const totalHonorariosPeriodo = useMemo(
    () => detalhes.reduce((s, d) => s + getHonorarioInPeriod(d, period), 0),
    [detalhes, period]
  );

  const totalPagamentosExames = detalhesNoPeriodo.reduce((s, d) => s + Number(d.valorPagamento || 0), 0);
  const ticketMedio =
    totalExames > 0
      ? (totalPagamentosExames > 0 ? totalPagamentosExames : totalReceitaClinica) / totalExames
      : 0;

  // Previous period metrics for comparison
  const prevExamesParticulares = useMemo(
    () => examesParticulares.filter((e) => isDateInPeriod(e.data, previousPeriod)),
    [examesParticulares, previousPeriod]
  );
  const prevExamesConvenio = useMemo(
    () => examesConvenio.filter((e) => isDateInPeriod(e.data, previousPeriod)),
    [examesConvenio, previousPeriod]
  );
  const prevTotalExames = prevExamesParticulares.length + prevExamesConvenio.length;

  const prevPeriodFluxo = useMemo(
    () => fluxo.filter((f) => isDateInPeriod(f.data, previousPeriod)),
    [fluxo, previousPeriod]
  );
  const prevEntradas = prevPeriodFluxo
    .filter((f) => f.tipo === 'entrada')
    .reduce((s, f) => s + Number(f.valor || 0), 0);
  const prevSaidas = prevPeriodFluxo
    .filter((f) => f.tipo === 'saida')
    .reduce((s, f) => s + Number(f.valor || 0), 0);
  const prevSaldo = prevEntradas - prevSaidas;

  const prevDetalhes = useMemo(
    () => detalhes.filter((d) => isDateInPeriod(d.data, previousPeriod)),
    [detalhes, previousPeriod]
  );
  const prevTotalClinica = prevDetalhes.reduce((s, d) => s + Number(d.taxaClinica || 0), 0);
  const prevTotalAcessorios = prevDetalhes.reduce((s, d) => s + Number(d.valorAcessorios || 0), 0);
  const prevTotalBiopsia = prevDetalhes.reduce((s, d) => s + Number(d.valorBiopsia || 0), 0);
  const prevTotalReceitaClinica = prevTotalClinica + prevTotalAcessorios + prevTotalBiopsia;

  const prevTotalHonorarios = useMemo(
    () => detalhes.reduce((s, d) => s + getHonorarioInPeriod(d, previousPeriod), 0),
    [detalhes, previousPeriod]
  );

  const prevTotalPagamentosExames = prevDetalhes.reduce((s, d) => s + Number(d.valorPagamento || 0), 0);
  const prevTicketMedio =
    prevTotalExames > 0
      ? (prevTotalPagamentosExames > 0 ? prevTotalPagamentosExames : prevTotalReceitaClinica) / prevTotalExames
      : 0;

  // Trend variations
  const varTotalExames = calcVariation(totalExames, prevTotalExames);
  const varReceitaClinica = calcVariation(totalReceitaClinica, prevTotalReceitaClinica);
  const varHonorarios = calcVariation(totalHonorariosPeriodo, prevTotalHonorarios);
  const varTicketMedio = calcVariation(ticketMedio, prevTicketMedio);
  const varSaldo = calcVariation(saldo, prevSaldo);

  // Combined exam distribution by type in selected period
  const isMatchedInParticulares = (d) =>
    examesParticularesInPeriod.some(
      (e) =>
        e.id === d.id ||
        (e.data === d.data &&
          e.paciente &&
          d.paciente &&
          e.paciente.trim().toLowerCase() === d.paciente.trim().toLowerCase())
    );

  const standaloneDetalhesInPeriod = detalhesNoPeriodo.filter((d) => !isMatchedInParticulares(d));

  const allExamsCombined = [
    ...examesParticularesInPeriod.map((e) => ({
      exame: e.exame,
      procedimentoComplementar: e.procedimentoComplementar,
      medico: e.medico,
    })),
    ...examesConvenioInPeriod.map((e) => ({
      exame: e.exame,
      procedimentoComplementar: e.procedimentoComplementar,
      medico: e.medico,
    })),
    ...standaloneDetalhesInPeriod.map((d) => ({
      exame: d.tipoExame,
      procedimentoComplementar: d.procedimentoComplementar,
      medico: d.medico,
    })),
  ];

  const examCountByType = {};
  allExamsCombined.forEach((e) => {
    if (e.exame && e.exame.trim()) {
      const type = e.exame.trim().toUpperCase();
      examCountByType[type] = (examCountByType[type] || 0) + 1;
    }
    normalizeProcedimentosComplementares(e.procedimentoComplementar).forEach((proc) => {
      examCountByType[proc] = (examCountByType[proc] || 0) + 1;
    });
  });

  const examTypes = Object.entries(examCountByType)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  const maxExamCount = examTypes.length > 0 ? examTypes[0][1] : 1;

  // Combined doctor distribution in selected period
  const examCountByDoctor = {};
  allExamsCombined.forEach((e) => {
    if (e.medico && e.medico.trim()) {
      const doc = e.medico.trim().toUpperCase();
      examCountByDoctor[doc] = (examCountByDoctor[doc] || 0) + 1;
    }
  });

  const doctors = Object.entries(examCountByDoctor)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const maxDoctorCount = doctors.length > 0 ? doctors[0][1] : 1;

  // Convênios breakdown
  const convenioCountMap = {};
  examesConvenioInPeriod.forEach((e) => {
    const conv = (e.convenio || 'OUTROS').trim().toUpperCase();
    convenioCountMap[conv] = (convenioCountMap[conv] || 0) + 1;
  });
  const conveniosRanking = Object.entries(convenioCountMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Visão Geral</h1>
        <div className="header-actions">
          <div className="period-selector-wrapper">
            <div className="period-selector">
              <button
                className="period-btn"
                onClick={() => setPeriod(navigateAcquisitionPeriod(period, -1))}
                title="Período anterior"
              >
                ◀
              </button>
              <span className="period-label">{period.label}</span>
              <button
                className="period-btn"
                onClick={() => setPeriod(navigateAcquisitionPeriod(period, 1))}
                title="Próximo período"
              >
                ▶
              </button>
            </div>
            {!isCurrentPeriod && (
              <button
                className="btn btn-secondary btn-sm period-today-btn"
                onClick={() => setPeriod(getAcquisitionPeriod())}
                title="Ir para o período atual"
              >
                Hoje
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="page-container">
        {/* 5 KPI Cards Row */}
        <div className="summary-cards summary-cards-5">
          {/* Card 1: Total Exames */}
          <div className="summary-card card-accent-emerald">
            <div className="summary-card-header">
              <span className="summary-card-label">Exames no Período</span>
              <TrendBadge value={varTotalExames} />
            </div>
            <div className="summary-card-value">{totalExames}</div>
            <div className="summary-card-footer">
              {examesParticularesInPeriod.length} particulares · {examesConvenioInPeriod.length} convênios
            </div>
          </div>

          {/* Card 2: Receita Clínica */}
          <div className="summary-card card-accent-amber">
            <div className="summary-card-header">
              <span className="summary-card-label">Receita da Clínica</span>
              <TrendBadge value={varReceitaClinica} />
            </div>
            <div className="summary-card-value value-positive">{formatCurrency(totalReceitaClinica)}</div>
            <div className="summary-card-footer">
              Taxa: {formatCurrency(totalClinica)} · Outros: {formatCurrency(totalAcessorios + totalBiopsia)}
            </div>
          </div>

          {/* Card 3: Honorários Médicos */}
          <div className="summary-card card-accent-purple">
            <div className="summary-card-header">
              <span className="summary-card-label">Honorários Médicos</span>
              <TrendBadge value={varHonorarios} />
            </div>
            <div className="summary-card-value">{formatCurrency(totalHonorariosPeriodo)}</div>
            <div className="summary-card-footer">
              Repasses com vencimento no período
            </div>
          </div>

          {/* Card 4: Ticket Médio */}
          <div className="summary-card card-accent-blue">
            <div className="summary-card-header">
              <span className="summary-card-label">Ticket Médio</span>
              <TrendBadge value={varTicketMedio} />
            </div>
            <div className="summary-card-value">{formatCurrency(ticketMedio)}</div>
            <div className="summary-card-footer">
              Média faturada por procedimento
            </div>
          </div>

          {/* Card 5: Saldo Fluxo */}
          <div className="summary-card card-accent-cyan">
            <div className="summary-card-header">
              <span className="summary-card-label">Saldo Operacional</span>
              <TrendBadge value={varSaldo} />
            </div>
            <div className={`summary-card-value ${saldo >= 0 ? 'value-positive' : 'value-negative'}`}>
              {formatCurrency(saldo)}
            </div>
            <div className="summary-card-footer">
              Entradas: {formatCurrency(totalEntradas)} · Saídas: {formatCurrency(totalSaidas)}
            </div>
          </div>
        </div>

        {/* Charts & Visual Analytics Grid */}
        <div className="overview-grid">
          {/* Chart 1: Procedimentos por Tipo */}
          <div className="chart-card">
            <h3 className="chart-card-title">Procedimentos por Tipo no Período</h3>
            {examTypes.length > 0 ? (
              <div className="bar-chart">
                {examTypes.map(([type, count], i) => (
                  <div className="bar-row" key={type}>
                    <span className="bar-label" title={type}>{type}</span>
                    <div className="bar-track">
                      <div
                        className={`bar-fill ${i % 3 === 1 ? 'blue' : i % 3 === 2 ? 'amber' : ''}`}
                        style={{ width: `${(count / maxExamCount) * 100}%` }}
                      />
                    </div>
                    <span className="bar-value-outside">{count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                Nenhum procedimento registrado neste período.
              </p>
            )}
          </div>

          {/* Chart 2: Procedimentos por Médico */}
          <div className="chart-card">
            <h3 className="chart-card-title">Procedimentos por Médico no Período</h3>
            {doctors.length > 0 ? (
              <div className="bar-chart">
                {doctors.map(([doc, count], i) => (
                  <div className="bar-row" key={doc}>
                    <span className="bar-label" title={doc}>{doc}</span>
                    <div className="bar-track">
                      <div
                        className={`bar-fill ${i % 2 === 1 ? 'blue' : ''}`}
                        style={{ width: `${(count / maxDoctorCount) * 100}%` }}
                      />
                    </div>
                    <span className="bar-value-outside">{count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                Nenhum médico registrado neste período.
              </p>
            )}
          </div>

          {/* Chart 3: Composição da Receita da Clínica */}
          <div className="chart-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 className="chart-card-title" style={{ margin: 0 }}>Composição da Receita da Clínica</h3>
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-emerald)' }}>
                {formatCurrency(totalReceitaClinica)}
              </span>
            </div>
            <div className="bar-chart">
              <div className="bar-row">
                <span className="bar-label" title="Taxa Clínica">Taxa Clínica</span>
                <div className="bar-track">
                  <div
                    className="bar-fill amber"
                    style={{
                      width: `${totalReceitaClinica > 0 ? (totalClinica / totalReceitaClinica) * 100 : 0}%`,
                    }}
                  />
                </div>
                <span className="bar-value-outside bar-value-currency">{formatCurrency(totalClinica)}</span>
              </div>
              <div className="bar-row">
                <span className="bar-label" title="Biópsias">Biópsias</span>
                <div className="bar-track">
                  <div
                    className="bar-fill blue"
                    style={{
                      width: `${totalReceitaClinica > 0 ? (totalBiopsia / totalReceitaClinica) * 100 : 0}%`,
                    }}
                  />
                </div>
                <span className="bar-value-outside bar-value-currency">{formatCurrency(totalBiopsia)}</span>
              </div>
              <div className="bar-row">
                <span className="bar-label" title="Acessórios">Acessórios</span>
                <div className="bar-track">
                  <div
                    className="bar-fill purple"
                    style={{
                      width: `${totalReceitaClinica > 0 ? (totalAcessorios / totalReceitaClinica) * 100 : 0}%`,
                    }}
                  />
                </div>
                <span className="bar-value-outside bar-value-currency">{formatCurrency(totalAcessorios)}</span>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '0.85rem', paddingTop: '0.65rem', borderTop: '1px solid var(--border-subtle)' }}>
              <span>Taxa: {totalReceitaClinica > 0 ? ((totalClinica / totalReceitaClinica) * 100).toFixed(0) : 0}%</span>
              <span>Biópsia: {totalReceitaClinica > 0 ? ((totalBiopsia / totalReceitaClinica) * 100).toFixed(0) : 0}%</span>
              <span>Acessórios: {totalReceitaClinica > 0 ? ((totalAcessorios / totalReceitaClinica) * 100).toFixed(0) : 0}%</span>
            </div>
          </div>

          {/* Chart 4: Canais de Atendimento */}
          <div className="chart-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 className="chart-card-title" style={{ margin: 0 }}>Canais de Atendimento</h3>
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                {totalExames} {totalExames === 1 ? 'exame' : 'exames'}
              </span>
            </div>
            <div className="bar-chart">
              <div className="bar-row">
                <span className="bar-label" title="Particular">Particular</span>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{
                      width: `${totalExames > 0 ? (examesParticularesInPeriod.length / totalExames) * 100 : 0}%`,
                    }}
                  />
                </div>
                <span className="bar-value-outside">
                  {examesParticularesInPeriod.length} ({totalExames > 0 ? ((examesParticularesInPeriod.length / totalExames) * 100).toFixed(0) : 0}%)
                </span>
              </div>
              <div className="bar-row">
                <span className="bar-label" title="Convênios">Convênios</span>
                <div className="bar-track">
                  <div
                    className="bar-fill blue"
                    style={{
                      width: `${totalExames > 0 ? (examesConvenioInPeriod.length / totalExames) * 100 : 0}%`,
                    }}
                  />
                </div>
                <span className="bar-value-outside">
                  {examesConvenioInPeriod.length} ({totalExames > 0 ? ((examesConvenioInPeriod.length / totalExames) * 100).toFixed(0) : 0}%)
                </span>
              </div>
            </div>
            {conveniosRanking.length > 0 && (
              <div style={{ marginTop: '0.85rem', paddingTop: '0.65rem', borderTop: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                  Principais Convênios:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                  {conveniosRanking.map(([conv, count]) => (
                    <span key={conv} className="badge badge-info" style={{ fontSize: '11px', padding: '0.15rem 0.45rem' }}>
                      {conv}: {count}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Chart 5: Fluxo de Caixa */}
          <div className="chart-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 className="chart-card-title" style={{ margin: 0 }}>Fluxo de Caixa</h3>
              <span className={`badge ${saldo >= 0 ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '11px' }}>
                Saldo: {formatCurrency(saldo)}
              </span>
            </div>
            <div className="bar-chart">
              <div className="bar-row">
                <span className="bar-label">Entradas</span>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{
                      width: `${totalEntradas + totalSaidas > 0 ? (totalEntradas / (totalEntradas + totalSaidas)) * 100 : 0}%`,
                    }}
                  />
                </div>
                <span className="bar-value-outside bar-value-currency">{formatCurrency(totalEntradas)}</span>
              </div>
              <div className="bar-row">
                <span className="bar-label">Saídas</span>
                <div className="bar-track">
                  <div
                    className="bar-fill red"
                    style={{
                      width: `${totalEntradas + totalSaidas > 0 ? (totalSaidas / (totalEntradas + totalSaidas)) * 100 : 0}%`,
                    }}
                  />
                </div>
                <span className="bar-value-outside bar-value-currency">{formatCurrency(totalSaidas)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
