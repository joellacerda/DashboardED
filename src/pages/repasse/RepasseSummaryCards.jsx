import { formatCurrency } from '../../utils/helpers';

export default function RepasseSummaryCards({
  totalHonorariosRepassados,
  deficitClinica,
  cotaPorSocio,
  countSocios,
  totalLiquidoGeral,
  repasseRowsCount,
}) {
  return (
    <div className="summary-cards">
      <div className="summary-card card-accent-emerald">
        <div className="summary-card-header">
          <span className="summary-card-label">Total Honorários</span>
          <div className="summary-card-icon">👨‍⚕️</div>
        </div>
        <div className="summary-card-value">{formatCurrency(totalHonorariosRepassados)}</div>
        <div className="summary-card-footer">Nos exames do período aquisitivo</div>
      </div>

      <div className="summary-card card-accent-amber">
        <div className="summary-card-header">
          <span className="summary-card-label">Déficit da Clínica</span>
          <div className="summary-card-icon amber">📉</div>
        </div>
        <div
          className={`summary-card-value ${deficitClinica > 0 ? 'value-negative' : 'value-positive'}`}
        >
          {deficitClinica > 0 ? formatCurrency(deficitClinica) : 'R$ 0,00'}
        </div>
        <div className="summary-card-footer">
          {deficitClinica > 0
            ? `Cota por sócio (${countSocios}): -${formatCurrency(cotaPorSocio)}`
            : 'Clínica sem déficit no período'}
        </div>
      </div>

      <div className="summary-card card-accent-blue">
        <div className="summary-card-header">
          <span className="summary-card-label">Total Repasses Líquidos</span>
          <div className="summary-card-icon blue">💰</div>
        </div>
        <div
          className={`summary-card-value ${totalLiquidoGeral >= 0 ? 'value-positive' : 'value-negative'}`}
        >
          {totalLiquidoGeral >= 0
            ? formatCurrency(totalLiquidoGeral)
            : `-${formatCurrency(Math.abs(totalLiquidoGeral))}`}
        </div>
        <div className="summary-card-footer">Total final dos repasses médicos</div>
      </div>

      <div className="summary-card card-accent-purple">
        <div className="summary-card-header">
          <span className="summary-card-label">Médicos Ativos</span>
          <div className="summary-card-icon purple">👥</div>
        </div>
        <div className="summary-card-value">{repasseRowsCount}</div>
        <div className="summary-card-footer">{countSocios} médico(s) sócio(s)</div>
      </div>
    </div>
  );
}
