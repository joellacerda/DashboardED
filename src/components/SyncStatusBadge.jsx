import { useState, useEffect, useCallback } from 'react';
import { getSyncStatus, processPendingQueue } from '../services/syncQueue';

/**
 * Componente indicador visual de status de sincronização e conectividade em nuvem.
 *
 * Estados:
 * - 🟢 Sincronizado: Tudo em dia com a nuvem
 * - 🔄 Sincronizando...: Em processo de upload/download
 * - 🟡 N pendentes: Alterações locais salvas aguardando envio
 * - 🔴 Offline: Sem conexão com a internet
 * - ☁️ Nuvem / Backup: Não configurado ou modo local
 */
export default function SyncStatusBadge({ onOpenModal, variant = 'header' }) {
  const [status, setStatus] = useState(() => getSyncStatus());
  const [syncingManual, setSyncingManual] = useState(false);

  const updateStatus = useCallback(() => {
    setStatus(getSyncStatus());
  }, []);

  useEffect(() => {
    updateStatus();

    const handleSyncStatus = (e) => {
      if (e?.detail) {
        setStatus(e.detail);
      } else {
        updateStatus();
      }
    };

    const handleNetworkChange = () => {
      updateStatus();
    };

    window.addEventListener('endodiagnose:sync-status-changed', handleSyncStatus);
    window.addEventListener('online', handleNetworkChange);
    window.addEventListener('offline', handleNetworkChange);

    const interval = setInterval(updateStatus, 5000);

    return () => {
      window.removeEventListener('endodiagnose:sync-status-changed', handleSyncStatus);
      window.removeEventListener('online', handleNetworkChange);
      window.removeEventListener('offline', handleNetworkChange);
      clearInterval(interval);
    };
  }, [updateStatus]);

  const handleManualSync = async (e) => {
    e.stopPropagation();
    if (!status.isOnline || !status.isConfigured || status.isSyncing) {
      if (onOpenModal) onOpenModal('sync');
      return;
    }
    setSyncingManual(true);
    try {
      await processPendingQueue();
    } finally {
      setSyncingManual(false);
      updateStatus();
    }
  };

  const isSyncingActive = status.isSyncing || syncingManual;

  // Formata hora da última sincronização
  const formatLastSync = (isoString) => {
    if (!isoString) return 'Nunca';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'Recentemente';
    }
  };

  // 1. Não configurado
  if (!status.isConfigured) {
    if (variant === 'sidebar') {
      return (
        <button
          type="button"
          className="btn btn-secondary btn-sm sidebar-cloud-btn"
          style={{
            width: '100%',
            justifyContent: 'center',
            gap: '0.5rem',
            display: 'flex',
            alignItems: 'center',
            background: 'var(--bg-surface-elevated)',
            borderColor: 'var(--border-subtle)',
            color: 'var(--text-primary)',
          }}
          onClick={() => onOpenModal && onOpenModal('sync')}
          title="Configurar Sincronização em Nuvem (Firebase Firestore)"
        >
          <span>☁️</span>
          <span>Salvar na Nuvem</span>
        </button>
      );
    }
    return (
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        style={{
          marginLeft: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem',
          fontSize: 'var(--text-xs)',
        }}
        onClick={() => onOpenModal && onOpenModal('sync')}
        title="Configurar sincronização em nuvem"
      >
        <span>☁️</span>
        <span>Backup</span>
      </button>
    );
  }

  // 2. Offline
  if (!status.isOnline) {
    const text = status.pendingCount > 0 ? `Offline (${status.pendingCount})` : 'Offline';
    const tooltip = `Sem conexão com a internet. ${
      status.pendingCount > 0
        ? `${status.pendingCount} alteração(ões) salva(s) localmente e aguardando reconexão.`
        : 'Os dados estão salvos localmente com segurança.'
    }`;

    if (variant === 'sidebar') {
      return (
        <button
          type="button"
          className="btn btn-secondary btn-sm sidebar-cloud-btn"
          style={{
            width: '100%',
            justifyContent: 'center',
            gap: '0.5rem',
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(239, 68, 68, 0.12)',
            borderColor: 'rgba(239, 68, 68, 0.35)',
            color: 'var(--color-danger, #ef4444)',
          }}
          onClick={() => onOpenModal && onOpenModal('sync')}
          title={tooltip}
        >
          <span>🔴</span>
          <span>{text}</span>
        </button>
      );
    }

    return (
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        style={{
          marginLeft: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem',
          fontSize: 'var(--text-xs)',
          color: 'var(--color-danger, #ef4444)',
        }}
        onClick={() => onOpenModal && onOpenModal('sync')}
        title={tooltip}
      >
        <span>🔴</span>
        <span>{text}</span>
      </button>
    );
  }

  // 3. Sincronizando
  if (isSyncingActive) {
    if (variant === 'sidebar') {
      return (
        <button
          type="button"
          className="btn btn-secondary btn-sm sidebar-cloud-btn"
          style={{
            width: '100%',
            justifyContent: 'center',
            gap: '0.5rem',
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(14, 165, 233, 0.12)',
            borderColor: 'rgba(14, 165, 233, 0.4)',
            color: 'var(--color-info, #0ea5e9)',
          }}
          onClick={() => onOpenModal && onOpenModal('sync')}
          title="Sincronizando alterações com a nuvem..."
        >
          <span className="spinner-inline" style={{ width: '13px', height: '13px', borderWidth: '1.5px' }} />
          <span>Sincronizando...</span>
        </button>
      );
    }

    return (
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        style={{
          marginLeft: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem',
          fontSize: 'var(--text-xs)',
          color: 'var(--color-info, #0ea5e9)',
        }}
        onClick={() => onOpenModal && onOpenModal('sync')}
        title="Sincronizando alterações com a nuvem..."
      >
        <span className="spinner-inline" style={{ width: '11px', height: '11px', borderWidth: '1.5px' }} />
        <span>Sincronizando...</span>
      </button>
    );
  }

  // 4. Pendências na fila
  if (status.pendingCount > 0) {
    const text = `${status.pendingCount} pendente${status.pendingCount > 1 ? 's' : ''}`;
    const tooltip = `${status.pendingCount} alteração(ões) gravada(s) localmente aguardando envio à nuvem. Clique para sincronizar agora.`;

    if (variant === 'sidebar') {
      return (
        <button
          type="button"
          className="btn btn-secondary btn-sm sidebar-cloud-btn"
          style={{
            width: '100%',
            justifyContent: 'center',
            gap: '0.5rem',
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(245, 158, 11, 0.12)',
            borderColor: 'rgba(245, 158, 11, 0.4)',
            color: 'var(--color-warning, #f59e0b)',
          }}
          onClick={handleManualSync}
          title={tooltip}
        >
          <span>🟡</span>
          <span>{text}</span>
          <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>⚡</span>
        </button>
      );
    }

    return (
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        style={{
          marginLeft: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem',
          fontSize: 'var(--text-xs)',
          color: 'var(--color-warning, #f59e0b)',
        }}
        onClick={handleManualSync}
        title={tooltip}
      >
        <span>🟡</span>
        <span>{text}</span>
      </button>
    );
  }

  // 5. Conectado e 100% Sincronizado
  const tooltipSincronizado = `Nuvem conectada e sincronizada. Última atualização: ${formatLastSync(
    status.lastSyncTime
  )}`;

  if (variant === 'sidebar') {
    return (
      <button
        type="button"
        className="btn btn-secondary btn-sm sidebar-cloud-btn"
        style={{
          width: '100%',
          justifyContent: 'center',
          gap: '0.5rem',
          display: 'flex',
          alignItems: 'center',
          background: 'rgba(16, 185, 129, 0.12)',
          borderColor: 'rgba(16, 185, 129, 0.4)',
          color: 'var(--accent-emerald, #10b981)',
        }}
        onClick={() => onOpenModal && onOpenModal('sync')}
        title={tooltipSincronizado}
      >
        <span>🟢</span>
        <span>Sincronizado</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      style={{
        marginLeft: 'auto',
        display: 'flex',
        alignItems: 'center',
        gap: '0.35rem',
        fontSize: 'var(--text-xs)',
        color: 'var(--accent-emerald, #10b981)',
      }}
      onClick={() => onOpenModal && onOpenModal('sync')}
      title={tooltipSincronizado}
    >
      <span>🟢</span>
      <span>Nuvem</span>
    </button>
  );
}
