import { getAcquisitionPeriod, navigateAcquisitionPeriod } from '../utils/helpers';

export default function PeriodSelector({
  period,
  onChange,
  isCurrentPeriod,
  className = '',
}) {
  if (!period || typeof onChange !== 'function') return null;

  const currentPeriod = getAcquisitionPeriod();
  const isCurrent =
    isCurrentPeriod !== undefined
      ? Boolean(isCurrentPeriod)
      : period.start === currentPeriod.start && period.end === currentPeriod.end;

  return (
    <div className={`period-selector-wrapper ${className}`.trim()}>
      <div className="period-selector">
        <button
          type="button"
          className="period-btn"
          onClick={() => onChange(navigateAcquisitionPeriod(period, -1))}
          title="Período anterior"
          aria-label="Período anterior"
        >
          ◀
        </button>
        <span className="period-label">{period.label}</span>
        <button
          type="button"
          className="period-btn"
          onClick={() => onChange(navigateAcquisitionPeriod(period, 1))}
          title="Próximo período"
          aria-label="Próximo período"
        >
          ▶
        </button>
      </div>
      {!isCurrent && (
        <button
          type="button"
          className="btn btn-secondary btn-sm period-today-btn"
          onClick={() => onChange(getAcquisitionPeriod())}
          title="Ir para o período atual"
        >
          Hoje
        </button>
      )}
    </div>
  );
}
