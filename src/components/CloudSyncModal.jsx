import { useState, useEffect, useMemo } from 'react';
import Modal from './Modal';
import ConfirmDialog from './ConfirmDialog';
import { useToast } from '../contexts/ToastContext';
import { useData } from '../contexts/DataContext';
import {
  getStoredFirebaseConfig,
  isCloudConfigured,
  testConnection,
  reinitFirebase,
  uploadAllLocalToCloud,
  downloadAllCloudToLocal,
} from '../services/firebase';
import {
  getPendingQueue,
  processPendingQueue,
  clearPendingQueue,
  mergeCloudDataWithLocal,
} from '../services/syncQueue';
import { getAllData, getData, setData, restoreAllData, MODULE_KEYS } from '../utils/storage';

function formatDisplayDate(isoDateStr) {
  if (!isoDateStr) return '';
  const parts = String(isoDateStr).split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return isoDateStr;
}

function getCutoffDateString(type, customDate) {
  if (type === 'custom') {
    return customDate || new Date().toISOString().slice(0, 10);
  }
  const now = new Date();
  if (type === '24m') {
    now.setMonth(now.getMonth() - 24);
  } else if (type === '12m') {
    now.setMonth(now.getMonth() - 12);
  } else if (type === '6m') {
    now.setMonth(now.getMonth() - 6);
  }
  return now.toISOString().slice(0, 10);
}

export default function CloudSyncModal({ isOpen, onClose, onDataUpdated, initialTab = 'storage' }) {
  const toast = useToast();
  const {
    storageInfo,
    refreshStorageInfo,
    archiveAndPurge,
    previewArchiveData,
  } = useData();

  const [configured, setConfigured] = useState(false);
  const [config, setConfig] = useState({
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: '',
  });
  const [pasteSnippet, setPasteSnippet] = useState('');
  const [statusMessage, setStatusMessage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(initialTab || 'storage');

  // Estado para Arquivamento Histórico
  const [cutoffType, setCutoffType] = useState('12m'); // '24m' | '12m' | '6m' | 'custom'
  const [customCutoffDate, setCustomCutoffDate] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [isArchiving, setIsArchiving] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [pendingQueue, setPendingQueue] = useState(() => getPendingQueue());

  // Confirmação genérica ({ title, message, confirmLabel, action }) — substitui window.confirm
  const [pendingConfirm, setPendingConfirm] = useState(null);
  const askConfirm = (options) => setPendingConfirm(options);

  const activeCutoffDate = useMemo(
    () => getCutoffDateString(cutoffType, customCutoffDate),
    [cutoffType, customCutoffDate]
  );

  const archivePreview = useMemo(() => {
    if (!previewArchiveData || !activeCutoffDate) return null;
    return previewArchiveData(activeCutoffDate);
  // storageInfo é dependência intencional: previewArchiveData lê o localStorage, então a
  // prévia precisa ser recalculada sempre que o uso de armazenamento muda.
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [previewArchiveData, activeCutoffDate, storageInfo]);

  useEffect(() => {
    if (isOpen) {
      const stored = getStoredFirebaseConfig();
      if (stored) {
        setConfig(stored);
        setConfigured(true);
      } else {
        setConfigured(false);
      }
      if (initialTab) {
        setActiveTab(initialTab);
      } else if (!stored) {
        setActiveTab('tutorial');
      } else {
        setActiveTab('storage');
      }
      setStatusMessage(null);
      setShowArchiveConfirm(false);
      if (refreshStorageInfo) refreshStorageInfo();
      setPendingQueue(getPendingQueue());
    }
  }, [isOpen, initialTab, refreshStorageInfo]);

  useEffect(() => {
    const handleSyncStatus = () => {
      setPendingQueue(getPendingQueue());
    };
    window.addEventListener('endodiagnose:sync-status-changed', handleSyncStatus);
    return () => window.removeEventListener('endodiagnose:sync-status-changed', handleSyncStatus);
  }, []);

  const handleExecuteArchive = async () => {
    if (!archiveAndPurge || !activeCutoffDate) return;
    setIsArchiving(true);
    setStatusMessage(null);

    try {
      const res = await archiveAndPurge(activeCutoffDate);
      setIsArchiving(false);
      setShowArchiveConfirm(false);

      if (res.totalArchived === 0) {
        toast.info('Nenhum registro encontrado para a data de corte.');
      } else {
        toast.success(
          `Sucesso! ${res.totalArchived} registros arquivados no arquivo "${res.backupFileName}".`
        );
        setStatusMessage({
          type: 'success',
          text: `✅ Arquivamento realizado: ${res.totalArchived} registros antigos salvos no arquivo "${res.backupFileName}". Memória liberada: ${res.formattedFreedBytes}.`,
        });
        if (onDataUpdated) onDataUpdated();
      }
    } catch (err) {
      setIsArchiving(false);
      setShowArchiveConfirm(false);
      toast.error(err.message || 'Falha ao executar arquivamento.');
      setStatusMessage({
        type: 'error',
        text: `Erro no arquivamento: ${err.message}`,
      });
    }
  };

  // Helper to parse pasted Firebase JS SDK snippet
  const handleParseSnippet = (text) => {
    setPasteSnippet(text);
    if (!text.trim()) return;

    try {
      const apiKeyMatch = text.match(/apiKey:\s*["']([^"']+)["']/);
      const authDomainMatch = text.match(/authDomain:\s*["']([^"']+)["']/);
      const projectIdMatch = text.match(/projectId:\s*["']([^"']+)["']/);
      const storageBucketMatch = text.match(/storageBucket:\s*["']([^"']+)["']/);
      const messagingSenderIdMatch = text.match(/messagingSenderId:\s*["']([^"']+)["']/);
      const appIdMatch = text.match(/appId:\s*["']([^"']+)["']/);

      if (apiKeyMatch && projectIdMatch) {
        setConfig({
          apiKey: apiKeyMatch[1] || '',
          authDomain: authDomainMatch ? authDomainMatch[1] : '',
          projectId: projectIdMatch[1] || '',
          storageBucket: storageBucketMatch ? storageBucketMatch[1] : '',
          messagingSenderId: messagingSenderIdMatch ? messagingSenderIdMatch[1] : '',
          appId: appIdMatch ? appIdMatch[1] : '',
        });
        setStatusMessage({ type: 'success', text: 'Chaves detectadas com sucesso a partir do código colado!' });
      }
    } catch {
      // ignore
    }
  };

  const handleSaveConfig = async (e) => {
    if (e) e.preventDefault();
    if (!config.apiKey || !config.projectId) {
      setStatusMessage({ type: 'error', text: 'Por favor, preencha pelo menos API Key e Project ID.' });
      return;
    }

    setIsLoading(true);
    setStatusMessage(null);

    const testRes = await testConnection(config);
    if (!testRes.success) {
      setIsLoading(false);
      setStatusMessage({ type: 'error', text: `Erro na conexão: ${testRes.message}. Verifique se o Firestore foi criado no console do Firebase e as regras permitem leitura/escrita.` });
      return;
    }

    await reinitFirebase(config);
    setConfigured(true);
    setIsLoading(false);
    toast.success('Firebase conectado com sucesso!');
    setStatusMessage({
      type: 'success',
      text: testRes.protectedByAuth
        ? '✅ Firebase conectado com sucesso! O banco de dados está ativo e protegido por autenticação.'
        : '✅ Firebase conectado com sucesso! Seus dados agora serão salvos na nuvem.',
    });
    setActiveTab('sync');
  };

  const handleDisconnect = () => {
    askConfirm({
      title: 'Desconectar nuvem',
      message: 'Deseja realmente desconectar o Firebase? Seus dados locais serão mantidos no navegador.',
      confirmLabel: 'Desconectar',
      action: async () => {
        await reinitFirebase(null);
        setConfig({
          apiKey: '',
          authDomain: '',
          projectId: '',
          storageBucket: '',
          messagingSenderId: '',
          appId: '',
        });
        setConfigured(false);
        setStatusMessage({ type: 'info', text: 'Firebase desconectado. O sistema voltou ao modo local.' });
        toast.info('Firebase desconectado.');
      },
    });
  };

  const handleUploadToCloud = async () => {
    if (!isCloudConfigured()) {
      setStatusMessage({ type: 'error', text: 'Conecte o Firebase primeiro na aba de Configuração.' });
      return;
    }
    setIsLoading(true);
    setStatusMessage(null);
    try {
      const allLocalData = getAllData();
      const count = await uploadAllLocalToCloud(allLocalData);
      setIsLoading(false);
      setStatusMessage({ type: 'success', text: `🚀 Backup concluído com sucesso! ${count} registros enviados para o Firestore na nuvem.` });
      toast.success(`Backup concluído! ${count} registros salvos na nuvem.`);
    } catch (err) {
      setIsLoading(false);
      setStatusMessage({ type: 'error', text: `Erro ao enviar dados para a nuvem: ${err.message}` });
      toast.error('Erro ao enviar dados para a nuvem.');
    }
  };

  const runDownloadFromCloud = async () => {
    setIsLoading(true);
    setStatusMessage(null);
    try {
      const cloudData = await downloadAllCloudToLocal(MODULE_KEYS);
      const stats = mergeCloudDataWithLocal(cloudData, getData, setData);
      setIsLoading(false);
      const details = `+${stats.added} novos, ~${stats.updated} atualizados, -${stats.deleted} excluídos`;
      setStatusMessage({
        type: 'success',
        text: `📥 Sincronização da nuvem concluída! (${details}).`,
      });
      toast.success('Dados sincronizados com a nuvem com sucesso!');
      if (onDataUpdated) onDataUpdated();
    } catch (err) {
      setIsLoading(false);
      setStatusMessage({ type: 'error', text: `Erro ao baixar dados da nuvem: ${err.message}` });
      toast.error('Erro ao baixar dados da nuvem.');
    }
  };

  const handleDownloadFromCloud = () => {
    if (!isCloudConfigured()) {
      setStatusMessage({ type: 'error', text: 'Conecte o Firebase primeiro na aba de Configuração.' });
      return;
    }
    askConfirm({
      title: 'Sincronizar da nuvem',
      message: 'Isso irá mesclar os dados da nuvem com os dados locais, aplicando alterações mais recentes e respeitando exclusões. Deseja continuar?',
      confirmLabel: 'Sincronizar dados',
      action: runDownloadFromCloud,
    });
  };

  const handleDrainQueue = async () => {
    setIsLoading(true);
    try {
      await processPendingQueue();
      const freshQueue = getPendingQueue();
      setPendingQueue(freshQueue);
      if (freshQueue.length === 0) {
        toast.success('Todas as pendências foram enviadas à nuvem!');
      } else {
        toast.info(`${freshQueue.length} item(ns) aguardando nova tentativa de envio.`);
      }
    } catch (err) {
      toast.error('Erro ao processar fila: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearPendingQueue = () => {
    askConfirm({
      title: 'Descartar Pendências',
      message: 'Deseja realmente limpar a fila de alterações pendentes? Essas operações locais não serão enviadas para a nuvem.',
      confirmLabel: 'Descartar Fila',
      confirmVariant: 'danger',
      action: () => {
        clearPendingQueue();
        setPendingQueue([]);
        toast.info('Fila de pendências limpa.');
      },
    });
  };

  const handleExportJSON = () => {
    const data = getAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const today = new Date().toISOString().split('T')[0];
    a.href = url;
    a.download = `backup_endodiagnose_${today}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJSON = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      let parsed;
      try {
        parsed = JSON.parse(event.target.result);
      } catch (err) {
        setStatusMessage({ type: 'error', text: 'Arquivo inválido: ' + err.message });
        return;
      }
      askConfirm({
        title: 'Restaurar backup',
        message: 'Deseja restaurar as informações deste arquivo de backup? Os dados locais serão atualizados.',
        confirmLabel: 'Restaurar',
        action: () => {
          try {
            restoreAllData(parsed);
            setStatusMessage({ type: 'success', text: 'Backup em JSON restaurado com sucesso!' });
            if (onDataUpdated) onDataUpdated();
          } catch (err) {
            setStatusMessage({ type: 'error', text: 'Falha ao restaurar o backup: ' + err.message });
          }
        },
      });
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <>
    <Modal
      isOpen={isOpen}
      onClose={pendingConfirm ? () => {} : onClose}
      title="Armazenamento, Nuvem & Backup"
      footer={
        <button className="btn btn-secondary" onClick={onClose}>
          Fechar
        </button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Status Pill */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            background: configured ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
            border: `1px solid ${configured ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '1.25rem' }}>{configured ? '☁️' : '💾'}</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                {configured ? 'Nuvem Conectada' : 'Modo Offline / Local'}
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                {configured
                  ? `Projeto Firebase: ${config.projectId}`
                  : 'Os dados estão salvos apenas no armazenamento deste navegador'}
              </div>
            </div>
          </div>
          <span
            className={`badge ${configured ? 'badge-success' : 'badge-warning'}`}
            style={{ fontSize: 'var(--text-xs)' }}
          >
            {configured ? 'Sincronização Ativa' : 'Não Conectado'}
          </span>
        </div>

        {/* Tab Buttons */}
        <div style={{ display: 'flex', gap: '0.4rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'storage' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('storage')}
          >
            💾 Armazenamento & Limpeza
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'sync' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('sync')}
          >
            🔄 Sincronização & Nuvem
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'tutorial' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('tutorial')}
          >
            📖 Passo a Passo (Tutorial)
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'config' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('config')}
          >
            ⚙️ Configurar Chaves
          </button>
        </div>

        {statusMessage && (
          <div
            style={{
              padding: '0.6rem 0.8rem',
              borderRadius: '6px',
              fontSize: 'var(--text-sm)',
              background:
                statusMessage.type === 'success'
                  ? 'rgba(16, 185, 129, 0.15)'
                  : statusMessage.type === 'error'
                    ? 'rgba(239, 68, 68, 0.15)'
                    : 'rgba(59, 130, 246, 0.15)',
              color:
                statusMessage.type === 'success'
                  ? 'var(--accent-emerald)'
                  : statusMessage.type === 'error'
                    ? 'var(--accent-red)'
                    : 'var(--accent-blue)',
              border: '1px solid currentColor',
            }}
          >
            {statusMessage.text}
          </div>
        )}

        {/* Tab 0: Storage Monitor & Archiving */}
        {activeTab === 'storage' && (
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
                    Arquivamento Histórico & Liberação de Espaço
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
                💾 Backup Completo Manual & Restauração
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
        )}

        {/* Tab 1: Sync & Backup actions */}
        {activeTab === 'sync' && (
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
              {pendingQueue.length > 0 && (
                <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={handleDrainQueue}
                    disabled={isLoading || !configured}
                    title="Forçar envio imediato das pendências para o Firestore"
                  >
                    {isLoading ? 'Enviando...' : '⚡ Sincronizar Pendências Agora'}
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
        )}

        {/* Tab 2: Tutorial */}
        {activeTab === 'tutorial' && (
          <div
            style={{
              padding: '1rem',
              borderRadius: '8px',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
              fontSize: 'var(--text-sm)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              lineHeight: 1.5,
            }}
          >
            <h4 style={{ margin: 0, color: 'var(--accent-blue)' }}>
              Passo a Passo para criar seu Banco Gratuito no Firebase:
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <div>
                <strong>1. Criar o Projeto:</strong>
                <div>Acesse <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-blue)', textDecoration: 'underline' }}>console.firebase.google.com</a>, faça login com sua conta Google e clique em <strong>"Adicionar projeto"</strong> (ex: <code>endodiagnose-app</code>).</div>
              </div>

              <div>
                <strong>2. Ativar o Firestore Database:</strong>
                <div>No menu lateral do Firebase, clique em <strong>Criação &gt; Firestore Database</strong> &gt; clique no botão <strong>"Criar banco de dados"</strong>. Selecione a localização (ex: <code>southamerica-east1</code> para São Paulo) e escolha o modo de teste ou configure as regras.</div>
              </div>

              <div>
                <strong>3. Configurar Regras de Segurança do Firestore:</strong>
                <div>Na aba <strong>Regras (Rules)</strong> do Firestore Database, cole a regra segura abaixo e clique em <strong>Publicar</strong> (permite acesso apenas a usuários autenticados):</div>
                <pre style={{ background: 'var(--bg-surface)', padding: '0.6rem', borderRadius: '4px', fontSize: '11px', overflowX: 'auto', border: '1px solid var(--border-subtle)', color: 'var(--accent-emerald)' }}>
                  {`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}`}
                </pre>
              </div>

              <div>
                <strong>4. Ativar os Métodos de Login (Authentication):</strong>
                <div>No menu do Firebase, clique em <strong>Criação &gt; Authentication</strong> &gt; clique em <strong>"Começar"</strong>. Na aba <strong>Sign-in method</strong>, ative:</div>
                <ul style={{ paddingLeft: '1.2rem', margin: '0.4rem 0', fontSize: 'var(--text-xs)' }}>
                  <li><strong>E-mail/senha</strong> (ative a primeira chave)</li>
                  <li><strong>Google</strong> (ative e informe o e-mail de suporte)</li>
                </ul>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  *Dica: em <em>Settings &gt; Authorized domains</em>, verifique se <code>localhost</code> está na lista.
                </div>
              </div>

              <div>
                <strong>5. Obter as Chaves:</strong>
                <div>Clique no ícone de engrenagem ⚙️ (Configurações do projeto) &gt; role até <strong>"Seus aplicativos"</strong> e clique no ícone da Web <strong>(&lt;/&gt;)</strong>. Dê um apelido e copie o bloco de código com <code>const firebaseConfig = &#123; ... &#125;</code>.</div>
              </div>

              <div>
                <strong>6. Colar no App:</strong>
                <div>Vá para a aba <strong>"⚙️ Configurar Chaves"</strong> e cole o código copiado no campo de texto para preenchimento automático.</div>
              </div>
            </div>

            <button
              className="btn btn-primary"
              style={{ alignSelf: 'flex-start' }}
              onClick={() => setActiveTab('config')}
            >
              Ir para Configurar Chaves ➔
            </button>
          </div>
        )}

        {/* Tab 3: Config */}
        {activeTab === 'config' && (
          <form onSubmit={handleSaveConfig} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <div className="input-group full-width">
              <label className="input-label">
                Colar snippet de código do Firebase (Preenchimento Automático):
              </label>
              <textarea
                className="input-field"
                rows={3}
                placeholder={`const firebaseConfig = {\n  apiKey: "AIzaSy...",\n  projectId: "seu-projeto",\n  ...\n};`}
                value={pasteSnippet}
                onChange={(e) => handleParseSnippet(e.target.value)}
                style={{ fontFamily: 'monospace', fontSize: '12px' }}
              />
            </div>

            <div className="modal-form-grid">
              <div className="input-group">
                <label className="input-label">API Key <span className="required">*</span></label>
                <input
                  type="text"
                  className="input-field"
                  required
                  placeholder="AIzaSy..."
                  value={config.apiKey}
                  onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                />
              </div>

              <div className="input-group">
                <label className="input-label">Project ID <span className="required">*</span></label>
                <input
                  type="text"
                  className="input-field"
                  required
                  placeholder="endodiagnose-12345"
                  value={config.projectId}
                  onChange={(e) => setConfig({ ...config, projectId: e.target.value })}
                />
              </div>

              <div className="input-group">
                <label className="input-label">Auth Domain</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="projeto.firebaseapp.com"
                  value={config.authDomain}
                  onChange={(e) => setConfig({ ...config, authDomain: e.target.value })}
                />
              </div>

              <div className="input-group">
                <label className="input-label">Storage Bucket</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="projeto.appspot.com"
                  value={config.storageBucket}
                  onChange={(e) => setConfig({ ...config, storageBucket: e.target.value })}
                />
              </div>

              <div className="input-group">
                <label className="input-label">Messaging Sender ID</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="1234567890"
                  value={config.messagingSenderId}
                  onChange={(e) => setConfig({ ...config, messagingSenderId: e.target.value })}
                />
              </div>

              <div className="input-group">
                <label className="input-label">App ID</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="1:12345:web:67890"
                  value={config.appId}
                  onChange={(e) => setConfig({ ...config, appId: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.5rem', justifyContent: 'flex-end' }}>
              {configured && (
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleDisconnect}
                  style={{ marginRight: 'auto' }}
                >
                  Desconectar Nuvem
                </button>
              )}
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isLoading}
              >
                {isLoading ? 'Testando Conexão...' : 'Testar e Conectar Firebase'}
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
    <ConfirmDialog
      isOpen={Boolean(pendingConfirm)}
      onClose={() => setPendingConfirm(null)}
      onConfirm={() => pendingConfirm?.action?.()}
      title={pendingConfirm?.title}
      confirmLabel={pendingConfirm?.confirmLabel}
      message={pendingConfirm?.message}
    />
    </>
  );
}
