import { useState } from 'react';
import { getData } from '../utils/storage';
import {
  formatCurrency,
  getAcquisitionPeriod,
  navigateAcquisitionPeriod,
  isDateInPeriod,
  getHonorarioInPeriod,
} from '../utils/helpers';

export default function OverviewPage() {
  const [period, setPeriod] = useState(() => getAcquisitionPeriod());

  const examesParticulares = getData('exames');
  const examesConvenio = getData('examesConvenio');
  const fluxo = getData('fluxoCaixa');
  const detalhes = getData('detalhesExames');
  const folha = getData('folhaPagamento');

  // Exams performed IN THIS acquisition period
  const examesParticularesInPeriod = examesParticulares.filter((e) => isDateInPeriod(e.data, period));
  const examesConvenioInPeriod = examesConvenio.filter((e) => isDateInPeriod(e.data, period));

  // Cash flow in selected acquisition period (16 to 15)
  const periodFluxo = fluxo.filter((f) => isDateInPeriod(f.data, period));
  const totalEntradas = periodFluxo
    .filter((f) => f.tipo === 'entrada')
    .reduce((s, f) => s + Number(f.valor), 0);
  const totalSaidas = periodFluxo
    .filter((f) => f.tipo === 'saida')
    .reduce((s, f) => s + Number(f.valor), 0);
  const saldo = totalEntradas - totalSaidas;

  // Clinic revenue in selected acquisition period
  const detalhesNoPeriodo = detalhes.filter((d) => isDateInPeriod(d.data, period));
  const totalClinica = detalhesNoPeriodo.reduce((s, d) => s + Number(d.taxaClinica || 0), 0);
  const totalAcessorios = detalhesNoPeriodo.reduce((s, d) => s + Number(d.valorAcessorios || 0), 0);
  const totalBiopsia = detalhesNoPeriodo.reduce((s, d) => s + Number(d.valorBiopsia || 0), 0);

  // Honorários distributed by installments in selected period
  const totalHonorariosPeriodo = detalhes.reduce(
    (s, d) => s + getHonorarioInPeriod(d, period), 0
  );

  // Combined exam distribution by type in selected period
  // Match details with particular exams by id or (paciente + data) to prevent double counting
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
    ...examesParticularesInPeriod.map((e) => ({ exame: e.exame, medico: e.medico })),
    ...examesConvenioInPeriod.map((e) => ({ exame: e.exame, medico: e.medico })),
    ...standaloneDetalhesInPeriod.map((d) => ({ exame: d.tipoExame, medico: d.medico })),
  ];

  const examCountByType = {};
  allExamsCombined.forEach((e) => {
    if (e.exame && e.exame.trim()) {
      const type = e.exame.trim().toUpperCase();
      examCountByType[type] = (examCountByType[type] || 0) + 1;
    }
  });

  const examTypes = Object.entries(examCountByType)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  const maxExamCount = examTypes.length > 0 ? examTypes[0][1] : 1;

  // Combined doctor distribution in selected period
  const examCountByDoctor = {};
  allExamsCombined.forEach((e) => {
    if (e.medico && e.medico.trim()) {
      const doc = e.medico.trim();
      examCountByDoctor[doc] = (examCountByDoctor[doc] || 0) + 1;
    }
  });

  const doctors = Object.entries(examCountByDoctor)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const maxDoctorCount = doctors.length > 0 ? doctors[0][1] : 1;

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Visão Geral</h1>
        <div className="header-actions">
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
        </div>
      </div>

      <div className="page-container">
        <div className="summary-cards summary-cards-compact">
          <div className="summary-card card-accent-emerald">
            <div className="summary-card-header">
              <span className="summary-card-label">Exames no Período</span>
              <div className="summary-card-icon">🏥</div>
            </div>
            <div className="summary-card-value">
              {examesParticularesInPeriod.length + examesConvenioInPeriod.length}
            </div>
            <div className="summary-card-footer">
              {examesParticularesInPeriod.length} particulares · {examesConvenioInPeriod.length} convênios
            </div>
          </div>

          <div className="summary-card card-accent-blue">
            <div className="summary-card-header">
              <span className="summary-card-label">Saldo do Período</span>
              <div className="summary-card-icon blue">💰</div>
            </div>
            <div className={`summary-card-value ${saldo >= 0 ? 'value-positive' : 'value-negative'}`}>
              {formatCurrency(saldo)}
            </div>
            <div className="summary-card-footer">{period.label}</div>
          </div>

          <div className="summary-card card-accent-amber">
            <div className="summary-card-header">
              <span className="summary-card-label">Receita Clínica</span>
              <div className="summary-card-icon amber">🩺</div>
            </div>
            <div className="summary-card-value value-positive">
              {formatCurrency(totalClinica + totalAcessorios + totalBiopsia + totalHonorariosPeriodo)}
            </div>
            <div className="summary-card-footer summary-card-footer-detailed">
              <span>Clínica: {formatCurrency(totalClinica)}</span>
              <span>Acess/Bióp: {formatCurrency(totalAcessorios + totalBiopsia)}</span>
              <span>Honorários: {formatCurrency(totalHonorariosPeriodo)}</span>
            </div>
          </div>
        </div>

        <div className="overview-grid">
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
                      >
                        <span className="bar-value">{count}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                Nenhum procedimento registrado neste período.
              </p>
            )}
          </div>

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
                      >
                        <span className="bar-value">{count}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                Nenhum médico registrado neste período.
              </p>
            )}
          </div>

          <div className="chart-card">
            <h3 className="chart-card-title">Fluxo de Caixa — Período Selecionado ({period.label})</h3>
            <div className="bar-chart">
              <div className="bar-row">
                <span className="bar-label">Entradas</span>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{
                      width: `${totalEntradas + totalSaidas > 0 ? (totalEntradas / (totalEntradas + totalSaidas)) * 100 : 0}%`,
                    }}
                  >
                    <span className="bar-value">{formatCurrency(totalEntradas)}</span>
                  </div>
                </div>
              </div>
              <div className="bar-row">
                <span className="bar-label">Saídas</span>
                <div className="bar-track">
                  <div
                    className="bar-fill red"
                    style={{
                      width: `${totalEntradas + totalSaidas > 0 ? (totalSaidas / (totalEntradas + totalSaidas)) * 100 : 0}%`,
                    }}
                  >
                    <span className="bar-value">{formatCurrency(totalSaidas)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
