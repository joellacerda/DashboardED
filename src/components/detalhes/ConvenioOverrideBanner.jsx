export default function ConvenioOverrideBanner({
  isConvenio,
  manualOverride,
  convenio,
  editItemId,
  onRevertConvenio,
}) {
  if (!isConvenio) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.75rem 1rem',
        borderRadius: '8px',
        marginBottom: '1.25rem',
        background: 'oklch(0.24 0.05 240 / 0.4)',
        border: '1px solid oklch(0.4 0.1 240 / 0.5)',
        gap: '0.75rem',
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <span style={{ fontSize: '1.3rem' }}>{manualOverride ? '🛡️' : '⚡'}</span>
        <div>
          <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
            {manualOverride
              ? `Personalizado Manualmente (${convenio || 'Convênio'})`
              : `Sincronizado do Convênio (${convenio || 'Convênio'})`}
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            {manualOverride
              ? 'Ajustes manuais protegidos contra sobreposição automática do módulo de Convênios.'
              : 'Qualquer alteração manual salva aqui será protegida contra sobreposição automática.'}
          </div>
        </div>
      </div>
      {manualOverride && editItemId && (
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          onClick={onRevertConvenio}
          style={{
            color: 'var(--color-primary)',
            borderColor: 'var(--border-subtle)',
            whiteSpace: 'nowrap',
          }}
          title="Restaurar valores calculados originalmente do convênio"
        >
          ↺ Restaurar Padrão do Convênio
        </button>
      )}
    </div>
  );
}
