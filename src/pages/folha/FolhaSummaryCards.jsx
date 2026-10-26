import { formatCurrency } from '../../utils/helpers';

export default function FolhaSummaryCards({
  totalFolha,
  totalBase,
  totalBeneficios,
  totalVariaveis,
  totalDescontos,
}) {
  return (
    <div className="summary-cards summary-cards-5">
      <div className="summary-card card-accent-emerald">
        <div className="summary-card-header">
          <span className="summary-card-label">Total Líquido da Folha</span>
          <div className="summary-card-icon">💰</div>
        </div>
        <div className="summary-card-value">{formatCurrency(totalFolha)}</div>
      </div>

      <div className="summary-card card-accent-blue">
        <div className="summary-card-header">
          <span className="summary-card-label">Salários Base</span>
          <div className="summary-card-icon blue">📊</div>
        </div>
        <div className="summary-card-value">{formatCurrency(totalBase)}</div>
      </div>

      <div className="summary-card card-accent-amber">
        <div className="summary-card-header">
          <span className="summary-card-label">Benefícios (VA + VT)</span>
          <div className="summary-card-icon amber">🥪</div>
        </div>
        <div className="summary-card-value">{formatCurrency(totalBeneficios)}</div>
      </div>

      <div className="summary-card card-accent-purple">
        <div className="summary-card-header">
          <span className="summary-card-label">Extras & Produtividade</span>
          <div className="summary-card-icon purple">📈</div>
        </div>
        <div className="summary-card-value">{formatCurrency(totalVariaveis)}</div>
      </div>

      <div className="summary-card card-accent-red">
        <div className="summary-card-header">
          <span className="summary-card-label">Total Descontos</span>
          <div className="summary-card-icon red">📉</div>
        </div>
        <div className="summary-card-value">{formatCurrency(totalDescontos)}</div>
      </div>
    </div>
  );
}
