import { useData } from '../contexts/DataContext';

export default function StorageMonitorWidget({ onOpenStorageManager, className = '' }) {
  const { storageInfo } = useData();

  if (!storageInfo) return null;

  const {
    formattedTotal,
    formattedQuota,
    usedPercentage,
    status,
    totalRecords,
    collections = [],
  } = storageInfo;

  // Status configuration
  const statusConfig = {
    healthy: {
      label: 'Saudável',
      badgeClass: 'badge-success',
      color: 'var(--accent-emerald)',
      gradient: 'linear-gradient(90deg, #10b981, #059669)',
    },
    warning: {
      label: 'Atenção (Uso Alto)',
      badgeClass: 'badge-warning',
      color: 'var(--accent-amber)',
      gradient: 'linear-gradient(90deg, #f59e0b, #d97706)',
    },
    critical: {
      label: 'Crítico (Quase Cheio)',
      badgeClass: 'badge-danger',
      color: 'var(--accent-red)',
      gradient: 'linear-gradient(90deg, #ef4444, #dc2626)',
    },
  }[status] || {
    label: 'Normal',
    badgeClass: 'badge-info',
    color: 'var(--accent-emerald)',
    gradient: 'linear-gradient(90deg, #10b981, #059669)',
  };

  // Pegar as 3 coleções mais pesadas
  const topCollections = collections.slice(0, 3);

  return (
    <div className={`chart-card storage-monitor-card ${className}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.25rem' }}>💾</span>
          <h3 className="chart-card-title" style={{ margin: 0 }}>
            Uso do Armazenamento
          </h3>
        </div>
        <span className={`badge ${statusConfig.badgeClass}`} style={{ fontSize: '11px', textTransform: 'uppercase' }}>
          {statusConfig.label}
        </span>
      </div>

      {/* Barra principal de capacidade */}
      <div style={{ marginBottom: '1.1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.45rem' }}>
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
            {formattedTotal} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>de {formattedQuota}</span>
          </span>
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: statusConfig.color }}>
            {usedPercentage}%
          </span>
        </div>

        <div
          style={{
            height: '10px',
            borderRadius: '999px',
            background: 'var(--bg-surface-elevated)',
            overflow: 'hidden',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${Math.min(100, Math.max(1, usedPercentage))}%`,
              background: statusConfig.gradient,
              borderRadius: '999px',
              transition: 'width 0.4s ease, background 0.3s ease',
            }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4rem', fontSize: '11px', color: 'var(--text-muted)' }}>
          <span>{totalRecords} registros cadastrados</span>
          <span>Limite estimado: 5 MB</span>
        </div>
      </div>

      {/* Mini ranking das maiores coleções */}
      {topCollections.length > 0 && (
        <div
          style={{
            paddingTop: '0.85rem',
            borderTop: '1px solid var(--border-subtle)',
            marginBottom: onOpenStorageManager ? '1rem' : 0,
          }}
        >
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.6rem' }}>
            Principais Coleções em Uso:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
            {topCollections.map((col) => {
              const colPercent = storageInfo.totalBytes > 0
                ? Math.round((col.bytes / storageInfo.totalBytes) * 100)
                : 0;

              return (
                <div key={col.key} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px' }}>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 500 }} title={col.name}>
                      {col.name} ({col.count})
                    </span>
                    <span style={{ color: 'var(--text-muted)' }}>
                      {col.formattedSize} ({colPercent}%)
                    </span>
                  </div>
                  <div
                    style={{
                      height: '4px',
                      borderRadius: '999px',
                      background: 'rgba(255, 255, 255, 0.06)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${colPercent}%`,
                        background: 'oklch(72% 0.19 160)',
                        borderRadius: '999px',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Ação rápida para abrir o modal de gerenciamento */}
      {onOpenStorageManager && (
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          style={{
            width: '100%',
            justifyContent: 'center',
            marginTop: 'auto',
            gap: '0.4rem',
            fontSize: 'var(--text-xs)',
          }}
          onClick={onOpenStorageManager}
        >
          <span>⚙️</span>
          <span>Gerenciar & Arquivar Dados</span>
        </button>
      )}
    </div>
  );
}
