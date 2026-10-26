export default function StorageTab({
  storageInfo,
  refreshStorageInfo,
  cutoffType,
  setCutoffType,
  customCutoffDate,
  setCustomCutoffDate,
  activeCutoffDate,
  formatDisplayDate,
  archivePreview,
  showArchiveConfirm,
  setShowArchiveConfirm,
  isArchiving,
  handleExecuteArchive,
  handleExportJSON,
  handleImportJSON,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Card de Medição e Capacidade */}
      <div
        style={{
          padding: '1.1rem',
          borderRadius: '8px',
          background: 'var(--bg-surface-elevated)',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 style={{ margin: 0, fontSize: 'var(--text-base)', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <span>💾</span>
            <span>Capacidade do Navegador (localStorage)</span>
          </h4>
          <span
            className={`badge ${
              storageInfo?.status === 'critical'
                ? 'badge-danger'
                : storageInfo?.status === 'warning'
                  ? 'badge-warning'
                  : 'badge-success'
            }`}
            style={{ fontSize: '11px', textTransform: 'uppercase' }}
          >
            {storageInfo?.status === 'critical'
              ? '🔴 Crítico'
              : storageInfo?.status === 'warning'
                ? '🟡 Atenção'
                : '🟢 Saudável'}
          </span>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: 'var(--text-sm)' }}>
            <span style={{ fontWeight: 600 }}>
              {storageInfo?.formattedTotal || '0 B'}{' '}
              <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
                de {storageInfo?.formattedQuota || '5,0 MB'}
              </span>
            </span>
            <span
              style={{
                fontWeight: 700,
                color:
                  storageInfo?.status === 'critical'
                    ? 'var(--accent-red)'
                    : storageInfo?.status === 'warning'
                      ? 'var(--accent-amber)'
                      : 'var(--accent-emerald)',
              }}
            >
              {storageInfo?.usedPercentage || 0}%
            </span>
          </div>

          <div
            style={{
              height: '12px',
              borderRadius: '999px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${Math.min(100, Math.max(1, storageInfo?.usedPercentage || 0))}%`,
                background:
                  storageInfo?.status === 'critical'
                    ? 'linear-gradient(90deg, #ef4444, #dc2626)'
                    : storageInfo?.status === 'warning'
                      ? 'linear-gradient(90deg, #f59e0b, #d97706)'
                      : 'linear-gradient(90deg, #10b981, #059669)',
                borderRadius: '999px',
                transition: 'width 0.4s ease',
              }}
            />
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '11.5px',
              color: 'var(--text-muted)',
              marginTop: '0.45rem',
            }}
          >
            <span>{storageInfo?.totalRecords || 0} registros totais salvos localmente</span>
            <span>Cota do navegador: ~5 MB (UTF-16)</span>
          </div>
        </div>

        <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 1.4 }}>
          Navegadores web alocam até ~5 MB de memória persistente para cada domínio. O monitoramento garante que o sistema nunca atinja a cota máxima silenciosamente.
        </p>
      </div>

      {/* Tabela de Detalhamento por Coleção */}
      <div
        style={{
          padding: '1rem',
          borderRadius: '8px',
          background: 'var(--bg-surface-elevated)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h4 style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: 600 }}>
            📊 Consumo Detalhado por Coleção
          </h4>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ fontSize: '11px', padding: '0.2rem 0.5rem' }}
            onClick={() => {
              if (refreshStorageInfo) refreshStorageInfo();
            }}
          >
            🔄 Atualizar Medição
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ fontSize: 'var(--text-xs)', width: '100%' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Coleção</th>
                <th style={{ textAlign: 'center' }}>Registros</th>
                <th style={{ textAlign: 'right' }}>Tamanho</th>
                <th style={{ textAlign: 'right' }}>% do Total</th>
                <th style={{ textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {(storageInfo?.collections || []).map((col) => {
                const pct = storageInfo?.totalBytes > 0
                  ? ((col.bytes / storageInfo.totalBytes) * 100).toFixed(1)
                  : 0;

                return (
                  <tr key={col.key}>
                    <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                      {col.name}
                    </td>
                    <td style={{ textAlign: 'center' }}>{col.count}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                      {col.formattedSize}
                    </td>
                    <td style={{ textAlign: 'right' }}>{pct}%</td>
                    <td style={{ textAlign: 'center' }}>
                      {col.canArchive ? (
                        <span className="badge badge-info" style={{ fontSize: '10px', padding: '0.1rem 0.4rem' }}>
                          Arquivável
                        </span>
                      ) : (
                        <span className="badge badge-neutral" style={{ fontSize: '10px', padding: '0.1rem 0.4rem' }}>
                          Cadastral
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Seção de Arquivamento Histórico & Limpeza Segura */}
      <div
        style={{
          padding: '1.1rem',
          borderRadius: '8px',
          background: 'var(--bg-surface-elevated)',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.9rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.25rem' }}>📦</span>
          <div>
            <h4 style={{ margin: 0, fontSize: 'var(--text-base)' }}>
              Arquivamento Histórico &amp; Liberação de Espaço
            </h4>
            <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              Transfira atendimentos e movimentações financeiras antigas para um arquivo de segurança no seu computador e libere memória no navegador.
            </p>
          </div>
        </div>

        <div
          style={{
            padding: '0.75rem',
            borderRadius: '6px',
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            fontSize: 'var(--text-xs)',
            lineHeight: 1.5,
            color: 'var(--text-primary)',
          }}
        >
          <strong>🔒 Regra de Segurança Anti-Perda de Dados:</strong> O sistema fará o download <strong>automático</strong> de um arquivo de backup completo (<code>backup_endodiagnose_pre_expurgo_*.json</code>) contendo todos os dados do sistema antes de remover os registros antigos da memória local.
        </div>

        {/* Seletor de Período de Corte */}
        <div>
          <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
            Selecione o corte temporal para arquivar:
          </label>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {[
              { id: '24m', label: 'Mais de 24 meses (2 anos)' },
              { id: '12m', label: 'Mais de 12 meses (1 ano)' },
              { id: '6m', label: 'Mais de 6 meses' },
              { id: 'custom', label: 'Data personalizada' },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`btn btn-sm ${cutoffType === opt.id ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setCutoffType(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {cutoffType === 'custom' && (
            <div style={{ marginTop: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                Arquivar registros anteriores a:
              </span>
              <input
                type="date"
                className="input-field"
                style={{ width: 'auto', padding: '0.35rem 0.6rem', fontSize: 'var(--text-xs)' }}
                value={customCutoffDate}
                onChange={(e) => setCustomCutoffDate(e.target.value)}
              />
            </div>
          )}
        </div>

        {/* Pré-visualização do Arquivamento */}
        {archivePreview && (
          <div
            style={{
              padding: '0.85rem',
              borderRadius: '6px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-primary)' }}>
                Pré-visualização para corte em: <strong>{formatDisplayDate(activeCutoffDate)}</strong>
              </span>
              <span className="badge badge-warning" style={{ fontSize: '11px' }}>
                {archivePreview.totalArchived} registros a arquivar
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: '0.6rem',
                marginBottom: '0.8rem',
              }}
            >
              <div style={{ background: 'var(--bg-surface-elevated)', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>Exames Particulares</div>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700 }}>
                  {archivePreview.modules?.exames?.archiveCount || 0}
                </div>
              </div>
              <div style={{ background: 'var(--bg-surface-elevated)', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>Detalhes Financeiros</div>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700 }}>
                  {archivePreview.modules?.detalhesExames?.archiveCount || 0}
                </div>
              </div>
              <div style={{ background: 'var(--bg-surface-elevated)', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>Exames de Convênio</div>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700 }}>
                  {archivePreview.modules?.examesConvenio?.archiveCount || 0}
                </div>
              </div>
              <div style={{ background: 'var(--bg-surface-elevated)', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>Fluxo de Caixa</div>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700 }}>
                  {archivePreview.modules?.fluxoCaixa?.archiveCount || 0}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', color: 'var(--text-muted)' }}>
              <span>Espaço estimado a liberar: <strong style={{ color: 'var(--accent-emerald)' }}>{archivePreview.formattedFreedBytes}</strong></span>
              <span>Registros que permanecerão: {archivePreview.totalRemaining}</span>
            </div>
          </div>
        )}

        {/* Botão de Arquivamento */}
        <div>
          <button
            type="button"
            className="btn btn-primary"
            style={{
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              borderColor: '#f59e0b',
              color: '#fff',
              fontWeight: 600,
            }}
            disabled={isArchiving || !archivePreview || archivePreview.totalArchived === 0}
            onClick={() => setShowArchiveConfirm(true)}
          >
            {isArchiving
              ? 'Processando e Baixando Backup...'
              : archivePreview && archivePreview.totalArchived > 0
                ? `📦 Arquivar ${archivePreview.totalArchived} Registros & Baixar Backup`
                : 'Nenhum registro para arquivar neste período'}
          </button>
        </div>
      </div>

      {/* Diálogo de Confirmação de Arquivamento */}
      {showArchiveConfirm && (
        <div
          style={{
            padding: '1.1rem',
            borderRadius: '8px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '2px solid var(--accent-red)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.8rem',
          }}
        >
          <h4 style={{ margin: 0, color: 'var(--accent-red)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span>⚠️</span>
            <span>Confirmar Arquivamento de Registros</span>
          </h4>
          <p style={{ margin: 0, fontSize: 'var(--text-sm)', lineHeight: 1.5 }}>
            Você está prestes a arquivar <strong>{archivePreview?.totalArchived} registros</strong> anteriores a{' '}
            <strong>{formatDisplayDate(activeCutoffDate)}</strong>.
          </p>
          <ul style={{ margin: '0 0 0 1.2rem', padding: 0, fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            <li>Um arquivo completo de backup JSON será baixado automaticamente para a pasta Downloads.</li>
            <li>Os registros anteriores à data serão removidos da memória deste navegador e do banco na nuvem.</li>
            <li>Os registros recentes e cadastros de médicos/salas serão mantidos intactos.</li>
          </ul>
          <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.4rem' }}>
            <button
              type="button"
              className="btn btn-danger"
              disabled={isArchiving}
              onClick={handleExecuteArchive}
            >
              {isArchiving ? 'Gerando Backup e Arquivando...' : 'Sim, Baixar Backup e Arquivar'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={isArchiving}
              onClick={() => setShowArchiveConfirm(false)}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Ações de Backup Manual */}
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
        <h4 style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: 600 }}>
          💾 Backup Completo Manual &amp; Restauração
        </h4>
        <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
          Baixe uma cópia instantânea de todas as tabelas ou restaure um arquivo JSON anterior.
        </p>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={handleExportJSON}>
            📥 Baixar Backup Completo (.json)
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
