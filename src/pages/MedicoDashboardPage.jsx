import { useState, useMemo, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import {
  formatCurrency,
  getAcquisitionPeriod,
  navigateAcquisitionPeriod,
} from '../utils/helpers';
import {
  getAllDoctors,
  getDoctorPeriodMetrics,
  getDoctorHistoricalEvolution,
  exportDoctorStatementCSV,
} from '../utils/medicoAnalytics';

export default function MedicoDashboardPage({ initialDoctor = null }) {
  const data = useData();
  const [period, setPeriod] = useState(() => getAcquisitionPeriod());

  const currentPeriod = useMemo(() => getAcquisitionPeriod(), []);
  const isCurrentPeriod = period.start === currentPeriod.start && period.end === currentPeriod.end;

  // Lista unificada de todos os médicos
  const doctorsList = useMemo(() => {
    return getAllDoctors(data);
  }, [data]);

  // Médico selecionado atualmente
  const [selectedDoctorName, setSelectedDoctorName] = useState(() => {
    if (initialDoctor) return initialDoctor.trim().toUpperCase();
    if (doctorsList.length > 0) return doctorsList[0].nome;
    return '';
  });

  // Atualiza seleção caso `initialDoctor` mude externamente
  useEffect(() => {
    if (initialDoctor) {
      setSelectedDoctorName(initialDoctor.trim().toUpperCase());
    } else if (!selectedDoctorName && doctorsList.length > 0) {
      setSelectedDoctorName(doctorsList[0].nome);
    }
  }, [initialDoctor, doctorsList, selectedDoctorName]);

  // Métricas do médico no período ativo
  const metrics = useMemo(() => {
    if (!selectedDoctorName) return null;
    return getDoctorPeriodMetrics(selectedDoctorName, period, data);
  }, [selectedDoctorName, period, data]);

  // Histórico de repasses dos últimos 6 períodos
  const history = useMemo(() => {
    if (!selectedDoctorName) return [];
    return getDoctorHistoricalEvolution(selectedDoctorName, period, data, 6);
  }, [selectedDoctorName, period, data]);

  // Filtros da tabela de atendimentos
  const [searchFilter, setSearchFilter] = useState('');
  const [tipoFilter, setTipoFilter] = useState('todos'); // 'todos' | 'particular' | 'convenio'

  const filteredProcedimentos = useMemo(() => {
    if (!metrics?.procedimentos) return [];
    return metrics.procedimentos.filter((p) => {
      // Filtro de Tipo
      if (tipoFilter === 'particular' && p.tipo !== 'Particular') return false;
      if (tipoFilter === 'convenio' && p.tipo !== 'Convênio') return false;

      // Filtro de Busca
      if (searchFilter.trim()) {
        const query = searchFilter.toLowerCase();
        const pacMatch = (p.paciente || '').toLowerCase().includes(query);
        const examMatch = (p.exame || '').toLowerCase().includes(query);
        const convMatch = (p.convenioNome || '').toLowerCase().includes(query);
        if (!pacMatch && !examMatch && !convMatch) return false;
      }

      return true;
    });
  }, [metrics, searchFilter, tipoFilter]);

  const handlePrint = () => {
    const originalTitle = document.title;
    const docName = (metrics?.nome || 'Medico').replace(/[^a-zA-Z0-9]/g, '_');
    document.title = `Extrato_Repasse_${docName}_${period?.start || ''}_${period?.end || ''}`;
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  };

  const handleExportCSV = () => {
    if (metrics) {
      exportDoctorStatementCSV(metrics, period);
    }
  };

  // Maior valor histórico para normalizar escala de barras
  const maxHistoricalRepasse = useMemo(() => {
    if (!history.length) return 1;
    const maxVal = Math.max(...history.map((h) => h.repasseLiquido || 0));
    return maxVal > 0 ? maxVal : 1;
  }, [history]);

  if (!metrics) {
    return (
      <div className="relatorio-loading">
        <div className="spinner-inline" />
        <p>Carregando dados do médico...</p>
      </div>
    );
  }

  const {
    nome,
    isSocio,
    isAtivo,
    totalProcedimentos,
    participacaoVolume,
    totalParticulares,
    totalHonorariosParticulares,
    totalConvenios,
    totalHonorariosConvenios,
    totalHonorariosBrutos,
    ticketMedioHonorario,
    creditos,
    debitos,
    bnb,
    cotaClinica,
    totalAjustesLiquidos,
    repasseLiquido,
    rankingProcedimentos,
    obs,
  } = metrics;

  const totalHonParaBarras = totalHonorariosBrutos || 1;
  const pctParticular = ((totalHonorariosParticulares / totalHonParaBarras) * 100).toFixed(1);
  const pctConvenio = ((totalHonorariosConvenios / totalHonParaBarras) * 100).toFixed(1);

  // Iniciais do médico para o avatar
  const initials = nome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('');

  return (
    <>
      {/* Printable Header (Visible only when printing) */}
      <div className="relatorio-print-header">
        <div className="print-brand">
          <h2>Clínica Endodiagnose</h2>
          <span className="print-subtitle">
            Extrato Individual de Repasse Médico — {nome} ({isSocio ? 'Sócio' : 'Prestador'})
          </span>
        </div>
        <div className="print-meta">
          <div>
            <strong>Competência:</strong> {period.label} ({period.start} a {period.end})
          </div>
          <div>
            <strong>Emissão:</strong> {new Date().toLocaleDateString('pt-BR')} às{' '}
            {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>

      {/* Screen Sticky Page Header */}
      <div className="page-header no-print">
        <div>
          <h1 className="page-title">Dashboard por Médico</h1>
          <p
            className="page-subtitle"
            style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-xs)', marginTop: '2px' }}
          >
            Visão individual de produtividade, honorários e extrato analítico de repasses
          </p>
        </div>

        <div className="header-actions">
          {/* Seletor do Médico */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', fontWeight: 600 }}>
              MÉDICO:
            </span>
            <select
              className="input-field"
              value={selectedDoctorName}
              onChange={(e) => setSelectedDoctorName(e.target.value)}
              style={{
                minWidth: '220px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                background: 'var(--bg-surface-elevated)',
              }}
            >
              {doctorsList.map((doc) => (
                <option key={doc.id || doc.nome} value={doc.nome}>
                  {doc.nome} {doc.socio ? '👑 (Sócio)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Seletor de Período Aquisitivo */}
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
              title="Exportar extrato analítico do médico em CSV"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>Exportar Extrato</span>
            </button>

            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handlePrint}
              title="Imprimir ou gerar PDF do extrato individual"
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
        {/* Banner do Perfil do Médico */}
        <div className="medico-profile-banner">
          <div className="medico-profile-avatar">{initials}</div>
          <div className="medico-profile-info">
            <div className="medico-profile-title-row">
              <h2 className="medico-profile-name">{nome}</h2>
              <div className="medico-profile-badges">
                {isSocio ? (
                  <span className="badge badge-success" title="Médico sócio da clínica">
                    👑 Sócio da Clínica
                  </span>
                ) : (
                  <span className="badge badge-info" title="Médico prestador de serviços">
                    Médico Prestador
                  </span>
                )}
                {isAtivo ? (
                  <span className="badge badge-success">Ativo</span>
                ) : (
                  <span className="badge badge-danger">Inativo</span>
                )}
              </div>
            </div>
            <p className="medico-profile-sub">
              Competência ativa: <strong>{period.label}</strong> ({period.start} a {period.end}) ·{' '}
              Representa <strong>{participacaoVolume}%</strong> do total de atendimentos da clínica no período
            </p>
          </div>
        </div>

        {/* 4 Summary Cards Estratégicos */}
        <div className="summary-cards">
          {/* Card 1: Procedimentos Realizados */}
          <div className="summary-card card-accent-blue">
            <div className="summary-card-header">
              <span className="summary-card-label">Procedimentos no Período</span>
              <div className="summary-card-icon blue">🩺</div>
            </div>
            <div className="summary-card-value">{totalProcedimentos}</div>
            <div className="summary-card-footer">
              {totalParticulares} particulares · {totalConvenios} convênios
            </div>
          </div>

          {/* Card 2: Honorários Brutos */}
          <div className="summary-card card-accent-purple">
            <div className="summary-card-header">
              <span className="summary-card-label">Honorários Brutos</span>
              <div className="summary-card-icon purple">💰</div>
            </div>
            <div className="summary-card-value">{formatCurrency(totalHonorariosBrutos)}</div>
            <div className="summary-card-footer">
              Ticket Médio: {formatCurrency(ticketMedioHonorario)} / exame
            </div>
          </div>

          {/* Card 3: Ajustes & Retenções */}
          <div className="summary-card card-accent-amber">
            <div className="summary-card-header">
              <span className="summary-card-label">Ajustes & Deduções</span>
              <div className="summary-card-icon amber">⚖️</div>
            </div>
            <div
              className={`summary-card-value ${
                totalAjustesLiquidos < 0
                  ? 'value-negative'
                  : totalAjustesLiquidos > 0
                  ? 'value-positive'
                  : ''
              }`}
            >
              {totalAjustesLiquidos > 0 ? '+' : ''}
              {formatCurrency(totalAjustesLiquidos)}
            </div>
            <div className="summary-card-footer">
              {cotaClinica > 0 ? `Cota déficit: -${formatCurrency(cotaClinica)}` : 'Créditos e débitos da competência'}
            </div>
          </div>

          {/* Card 4: Repasse Líquido */}
          <div className="summary-card card-accent-emerald">
            <div className="summary-card-header">
              <span className="summary-card-label">Repasse Líquido a Receber</span>
              <div className="summary-card-icon emerald">💵</div>
            </div>
            <div className="summary-card-value value-positive">{formatCurrency(repasseLiquido)}</div>
            <div className="summary-card-footer">
              Valor líquido a ser transferido ao profissional
            </div>
          </div>
        </div>

        {/* Evolução Histórica dos Repasses (Últimos 6 Períodos) */}
        <div className="chart-card" style={{ marginBottom: '1.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 className="chart-card-title" style={{ margin: 0 }}>
                Evolução Histórica de Repasses Líquidos (Últimos 6 Períodos)
              </h3>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                Acompanhamento mensal da receita líquida auferida pelo médico
              </span>
            </div>
          </div>

          <div className="medico-history-grid">
            {history.map((h) => {
              const heightPct = Math.max(8, Math.min(100, Math.round((h.repasseLiquido / maxHistoricalRepasse) * 100)));
              const isSelected = h.start === period.start && h.end === period.end;
              return (
                <div
                  key={h.start}
                  className={`medico-history-bar-col ${isSelected ? 'is-active-period' : ''}`}
                  onClick={() => setPeriod(h.period)}
                  title={`Clique para navegar para o período ${h.label}\nRepasse Líquido: ${formatCurrency(h.repasseLiquido)}\nExames: ${h.totalProcedimentos}`}
                >
                  <div className="medico-history-val-label">{formatCurrency(h.repasseLiquido)}</div>
                  <div className="medico-history-bar-track">
                    <div
                      className={`medico-history-bar-fill ${isSelected ? 'fill-active' : ''}`}
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                  <div className="medico-history-month-label">{h.label.split('—')[0]?.trim()}</div>
                  <div className="medico-history-count-label">{h.totalProcedimentos} exames</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Duas Colunas Analíticas: Composição de Honorários & Ranking de Procedimentos */}
        <div className="overview-grid" style={{ marginBottom: '1.75rem' }}>
          {/* Card 1: Composição dos Honorários */}
          <div className="chart-card">
            <h3 className="chart-card-title">Composição da Produção (Particular vs Convênio)</h3>
            <div className="relatorio-breakdown-list">
              {/* Particulares */}
              <div className="breakdown-item">
                <div className="breakdown-header">
                  <span className="breakdown-label">
                    <strong>Exames Particulares</strong>
                    <span className="breakdown-count">({totalParticulares} procedimentos)</span>
                  </span>
                  <span className="breakdown-value">
                    {formatCurrency(totalHonorariosParticulares)}{' '}
                    <small className="breakdown-pct">({pctParticular}%)</small>
                  </span>
                </div>
                <div className="breakdown-bar-bg">
                  <div
                    className="breakdown-bar-fill"
                    style={{
                      width: `${Math.min(100, Math.max(0, Number(pctParticular)))}%`,
                      background: 'var(--color-blue, #3b82f6)',
                    }}
                  />
                </div>
              </div>

              {/* Convênios */}
              <div className="breakdown-item">
                <div className="breakdown-header">
                  <span className="breakdown-label">
                    <strong>Exames de Convênio</strong>
                    <span className="breakdown-count">({totalConvenios} procedimentos)</span>
                  </span>
                  <span className="breakdown-value">
                    {formatCurrency(totalHonorariosConvenios)}{' '}
                    <small className="breakdown-pct">({pctConvenio}%)</small>
                  </span>
                </div>
                <div className="breakdown-bar-bg">
                  <div
                    className="breakdown-bar-fill"
                    style={{
                      width: `${Math.min(100, Math.max(0, Number(pctConvenio)))}%`,
                      background: 'var(--color-purple, #a855f7)',
                    }}
                  />
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: '1.25rem',
                paddingTop: '1rem',
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 'var(--text-xs)',
                color: 'var(--text-secondary)',
              }}
            >
              <div>
                Ticket Médio Geral: <strong>{formatCurrency(ticketMedioHonorario)}</strong>
              </div>
              <div>
                Honorários Brutos: <strong>{formatCurrency(totalHonorariosBrutos)}</strong>
              </div>
            </div>
          </div>

          {/* Card 2: Procedimentos mais realizados pelo médico */}
          <div className="chart-card">
            <h3 className="chart-card-title">Procedimentos mais Realizados no Período</h3>
            {rankingProcedimentos.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', padding: '1rem 0' }}>
                Nenhum procedimento registrado para {nome} neste período.
              </p>
            ) : (
              <div className="relatorio-breakdown-list">
                {rankingProcedimentos.slice(0, 5).map((proc) => {
                  const pct = totalProcedimentos > 0 ? ((proc.quantidade / totalProcedimentos) * 100).toFixed(1) : 0;
                  return (
                    <div key={proc.nome} className="breakdown-item">
                      <div className="breakdown-header">
                        <span className="breakdown-label">
                          <strong>{proc.nome}</strong>
                          <span className="breakdown-count">({proc.quantidade} exames)</span>
                        </span>
                        <span className="breakdown-value">
                          {formatCurrency(proc.honorarios)}{' '}
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
            )}
          </div>
        </div>

        {/* Demonstrativo de Fechamento de Repasse (DRE Individual) */}
        <div className="table-container" style={{ marginBottom: '1.75rem' }}>
          <div className="table-header">
            <div>
              <h3 className="table-title">Demonstrativo de Fechamento de Repasse</h3>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Detalhamento dos honorários, bonificações, descontos e rateios da competência
              </div>
            </div>
          </div>

          <div className="table-scroll">
            <table className="data-table dre-table">
              <thead>
                <tr>
                  <th style={{ width: '65%' }}>Item / Conta de Repasse</th>
                  <th style={{ width: '35%', textAlign: 'right' }}>Valor (R$)</th>
                </tr>
              </thead>
              <tbody>
                {/* Honorários Particulares */}
                <tr className="dre-row-item">
                  <td style={{ paddingLeft: '20px' }}>(+) Honorários de Exames Particulares ({totalParticulares} exames)</td>
                  <td style={{ textAlign: 'right', color: 'var(--text-primary)', fontWeight: 600 }}>
                    {formatCurrency(totalHonorariosParticulares)}
                  </td>
                </tr>

                {/* Honorários Convênios */}
                <tr className="dre-row-item">
                  <td style={{ paddingLeft: '20px' }}>(+) Honorários de Exames de Convênio ({totalConvenios} exames)</td>
                  <td style={{ textAlign: 'right', color: 'var(--text-primary)', fontWeight: 600 }}>
                    {formatCurrency(totalHonorariosConvenios)}
                  </td>
                </tr>

                {/* Subtotal Honorários Brutos */}
                <tr className="dre-row-header">
                  <td>
                    <strong>TOTAL DE HONORÁRIOS BRUTOS DO PERÍODO</strong>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <strong>{formatCurrency(totalHonorariosBrutos)}</strong>
                  </td>
                </tr>

                {/* Ajustes: Créditos */}
                {creditos > 0 && (
                  <tr className="dre-row-item">
                    <td style={{ paddingLeft: '20px' }}>(+) Créditos Extras / Bonificações</td>
                    <td style={{ textAlign: 'right', color: 'var(--color-emerald)', fontWeight: 600 }}>
                      +{formatCurrency(creditos)}
                    </td>
                  </tr>
                )}

                {/* Ajustes: Débitos */}
                {debitos > 0 && (
                  <tr className="dre-row-item">
                    <td style={{ paddingLeft: '20px' }}>(-) Débitos Operacionais / Adiantamentos</td>
                    <td style={{ textAlign: 'right', color: 'var(--color-red)', fontWeight: 600 }}>
                      -{formatCurrency(debitos)}
                    </td>
                  </tr>
                )}

                {/* Ajustes: BNB */}
                {bnb > 0 && (
                  <tr className="dre-row-item">
                    <td style={{ paddingLeft: '20px' }}>(-) Retenção Financiamento BNB</td>
                    <td style={{ textAlign: 'right', color: 'var(--color-red)', fontWeight: 600 }}>
                      -{formatCurrency(bnb)}
                    </td>
                  </tr>
                )}

                {/* Ajustes: Cota Déficit */}
                {cotaClinica > 0 && (
                  <tr className="dre-row-item">
                    <td style={{ paddingLeft: '20px' }}>
                      (-) Rateio de Cota de Déficit da Clínica (Médico Sócio)
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--color-red)', fontWeight: 600 }}>
                      -{formatCurrency(cotaClinica)}
                    </td>
                  </tr>
                )}

                {/* Linha Final de Repasse Líquido */}
                <tr className="dre-row-total dre-total-superavit">
                  <td>
                    <strong style={{ fontSize: '1rem' }}>(=) REPASSE LÍQUIDO FINAL A RECEBER</strong>
                  </td>
                  <td
                    style={{
                      textAlign: 'right',
                      fontSize: '1.15rem',
                      fontWeight: 800,
                      color: 'var(--color-emerald)',
                    }}
                  >
                    {formatCurrency(repasseLiquido)}
                  </td>
                </tr>

                {obs && (
                  <tr>
                    <td colSpan="2" style={{ padding: '12px 20px', background: 'var(--bg-surface-hover)', fontSize: 'var(--text-xs)' }}>
                      <strong>Observações do Fechamento:</strong> {obs}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tabela de Extrato Detalhado de Procedimentos */}
        <div className="table-container" style={{ marginBottom: '2.5rem' }}>
          <div className="table-header">
            <div>
              <h3 className="table-title">Extrato Detalhado de Procedimentos ({filteredProcedimentos.length})</h3>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Todos os exames realizados ou com repasses apropriados nesta competência
              </div>
            </div>

            <div className="table-actions">
              {/* Filtro por Tipo */}
              <div style={{ display: 'flex', gap: '0.3rem' }}>
                <button
                  type="button"
                  className={`btn btn-xs ${tipoFilter === 'todos' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setTipoFilter('todos')}
                >
                  Todos
                </button>
                <button
                  type="button"
                  className={`btn btn-xs ${tipoFilter === 'particular' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setTipoFilter('particular')}
                >
                  Particulares
                </button>
                <button
                  type="button"
                  className={`btn btn-xs ${tipoFilter === 'convenio' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setTipoFilter('convenio')}
                >
                  Convênios
                </button>
              </div>

              {/* Campo de Busca Rápida */}
              <div className="search-input-wrapper">
                <span className="search-icon">🔍</span>
                <input
                  type="search"
                  className="search-input"
                  placeholder="Buscar paciente, exame ou convênio..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  style={{ width: '240px' }}
                />
              </div>
            </div>
          </div>

          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '10%' }}>Data</th>
                  <th style={{ width: '25%' }}>Paciente</th>
                  <th style={{ width: '25%' }}>Procedimento</th>
                  <th style={{ width: '12%' }}>Origem</th>
                  <th style={{ width: '13%', textAlign: 'right' }}>Valor Total</th>
                  <th style={{ width: '15%', textAlign: 'right' }}>Honorário</th>
                </tr>
              </thead>
              <tbody>
                {filteredProcedimentos.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
                      Nenhum procedimento encontrado para os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  filteredProcedimentos.map((proc) => (
                    <tr key={proc.id}>
                      <td>{proc.data}</td>
                      <td>
                        <strong>{proc.paciente}</strong>
                      </td>
                      <td>
                        <span title={proc.exame}>{proc.exame}</span>
                        {proc.isSplit && (
                          <span
                            className="badge badge-warning"
                            style={{ marginLeft: '6px', fontSize: '10px' }}
                            title={`Procedimento compartilhado com Dr(a). ${proc.outroMedico}`}
                          >
                            Dividido ({proc.outroMedico})
                          </span>
                        )}
                      </td>
                      <td>
                        {proc.tipo === 'Particular' ? (
                          <span className="badge badge-info">Particular</span>
                        ) : (
                          <span className="badge badge-warning" title={proc.convenioNome}>
                            {proc.convenioNome || 'Convênio'}
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                        {formatCurrency(proc.valorTotal)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-emerald)' }}>
                        {formatCurrency(proc.honorarioMedico)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {filteredProcedimentos.length > 0 && (
                <tfoot>
                  <tr className="table-total-row">
                    <td colSpan="4">
                      <strong>TOTAL DOS PROCEDIMENTOS FILTRADOS ({filteredProcedimentos.length})</strong>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <strong>
                        {formatCurrency(
                          filteredProcedimentos.reduce((s, p) => s + (p.valorTotal || 0), 0)
                        )}
                      </strong>
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--color-emerald)', fontSize: '0.98rem' }}>
                      <strong>
                        {formatCurrency(
                          filteredProcedimentos.reduce((s, p) => s + (p.honorarioMedico || 0), 0)
                        )}
                      </strong>
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
