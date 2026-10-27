export default function SyncTab({
  configured,
  isLoading,
  pendingQueue,
  handleUploadToCloud,
  handleDownloadFromCloud,
  handleDrainQueue,
  handleClearPendingQueue,
  handleExportJSON,
  handleImportJSON,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div
        style={{
          padding: '1rem',
          borderRadius: '8px',
          background: 'var(--bg-surface-elevated)',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.8rem',
        }}
      >
        <h4 style={{ margin: 0, fontSize: 'var(--text-base)' }}>☁️ Sincronização na Nuvem (Firebase)</h4>
        <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
          Ao cadastrar ou editar qualquer registro, a alteração é salva automaticamente na nuvem. Você também pode forçar o envio de todos os dados locais ou restaurar da nuvem a qualquer momento.
        </p>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <button
            className="btn btn-primary"
            onClick={handleUploadToCloud}
            disabled={isLoading || !configured}
            title="Envia todos os exames, fluxo de caixa e convênios para o Firebase"
          >
            {isLoading ? 'Enviando...' : '⬆️ Fazer Backup Completo na Nuvem'}
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleDownloadFromCloud}
            disabled={isLoading || !configured}
            title="Baixa os dados salvos no Firebase para este navegador"
          >
            {isLoading ? 'Baixando...' : '⬇️ Restaurar da Nuvem'}
          </button>
        </div>
      </div>

      {/* Fila de Pendências Offline */}
      <div
        style={{
          padding: '1rem',
          borderRadius: '8px',
          background: 'var(--bg-surface-elevated)',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.8rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h4 style={{ margin: 0, fontSize: 'var(--text-base)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span>{pendingQueue.length > 0 ? '🟡' : '🟢'}</span>
            <span>Fila de Pendências Offline</span>
          </h4>
          <span
            style={{
              fontSize: 'var(--text-xs)',
              fontWeight: 600,
              padding: '0.2rem 0.6rem',
              borderRadius: '12px',
              background: pendingQueue.length > 0 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
              color: pendingQueue.length > 0 ? 'var(--color-warning, #f59e0b)' : 'var(--accent-emerald, #10b981)',
            }}
          >
            {pendingQueue.length === 0
              ? '100% Sincronizado'
              : `${pendingQueue.length} ${pendingQueue.length === 1 ? 'item pendente' : 'itens pendentes'}`}
          </span>
        </div>
        <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
          {pendingQueue.length === 0
            ? 'Nenhuma alteração pendente. Todas as mutações locais foram salvas no Firestore ou você está em modo offline sem pendências.'
            : 'Alterações registradas offline ou aguardando confirmação do servidor. O sistema tentará sincronizar automaticamente quando houver conexão.'}
        </p>

        {pendingQueue.length > 0 && pendingQueue.find((i) => i.error) && (
          <div
            style={{
              fontSize: 'var(--text-xs)',
              padding: '0.5rem 0.75rem',
              borderRadius: '6px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: 'var(--accent-red, #ef4444)',
              lineHeight: 1.4,
            }}
          >
            <strong>⚠️ Falha no envio recente:</strong> {pendingQueue.find((i) => i.error)?.error}
          </div>
        )}

        {pendingQueue.length > 0 && (
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            <button
              className="btn btn-sm btn-primary"
              onClick={handleDrainQueue}
              disabled={isLoading || !configured}
              title="Forçar envio imediato das pendências para o Firestore"
            >
              {isLoading ? '⏳ Enviando Pendências...' : '⚡ Sincronizar Pendências Agora'}
            </button>
            <button
              className="btn btn-sm btn-secondary"
              onClick={handleClearPendingQueue}
              disabled={isLoading}
              title="Descarta a fila de pendências locais"
            >
              🗑️ Descartar Fila
            </button>
          </div>
        )}
      </div>

      <div
        style={{
          padding: '1rem',
          borderRadius: '8px',
          background: 'var(--bg-surface-elevated)',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.8rem',
        }}
      >
        <h4 style={{ margin: 0, fontSize: 'var(--text-base)' }}>💾 Backup Manual em Arquivo (.json)</h4>
        <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
          Como garantia adicional, você pode baixar uma cópia completa de todo o seu banco de dados em arquivo JSON para guardar no seu computador ou pen-drive.
        </p>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={handleExportJSON}>
            📥 Baixar Arquivo de Backup (.json)
          </button>
          <label className="btn btn-secondary" style={{ cursor: 'pointer', margin: 0 }}>
            📤 Restaurar de Arquivo (.json)
            <input
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleImportJSON}
            />
          </label>
        </div>
      </div>
    </div>
  );
}
