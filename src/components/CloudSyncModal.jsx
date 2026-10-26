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
import {
  recordBackupDone,
  getInactivityTimeoutMinutes,
  setInactivityTimeoutMinutes,
  hasQuickLockPin,
  setQuickLockPin,
  clearQuickLockPin,
  getAllowedEmailsList,
  setAllowedEmailsList,
  getLastBackupDate,
  getDaysSinceLastBackup,
  isPublicRegistrationAllowed,
} from '../utils/security';
import StorageTab from './cloudModal/StorageTab';
import SyncTab from './cloudModal/SyncTab';
import TutorialTab from './cloudModal/TutorialTab';
import ConfigTab from './cloudModal/ConfigTab';
import SecurityTab from './cloudModal/SecurityTab';

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

  // Estados para Segurança & LGPD
  const [inactivityMins, setInactivityMins] = useState(() => getInactivityTimeoutMinutes());
  const [hasPin, setHasPin] = useState(() => hasQuickLockPin());
  const [pinInput, setPinInput] = useState('');
  const [allowedEmailsText, setAllowedEmailsText] = useState(() => getAllowedEmailsList().join(', '));
  const publicRegAllowed = isPublicRegistrationAllowed();
  const lastBackupIso = getLastBackupDate();
  const daysSinceBackup = getDaysSinceLastBackup();

  const handleSaveInactivity = (val) => {
    const mins = parseInt(val, 10);
    setInactivityMins(mins);
    setInactivityTimeoutMinutes(mins);
    toast.success(`Bloqueio por inatividade: ${mins === 0 ? 'Desativado' : mins + ' minutos'}.`);
  };

  const handleSavePin = async (e) => {
    e?.preventDefault();
    if (pinInput.length < 4 || pinInput.length > 8) {
      toast.error('O PIN deve conter entre 4 e 8 dígitos numéricos.');
      return;
    }
    try {
      await setQuickLockPin(pinInput);
      setHasPin(true);
      setPinInput('');
      toast.success('PIN de acesso rápido salvo com sucesso!');
    } catch (err) {
      toast.error(err.message || 'Erro ao definir PIN.');
    }
  };

  const handleClearPin = () => {
    clearQuickLockPin();
    setHasPin(false);
    setPinInput('');
    toast.info('PIN de acesso rápido removido.');
  };

  const handleSaveAllowedEmails = (e) => {
    e?.preventDefault();
    const list = allowedEmailsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    setAllowedEmailsList(list);
    toast.success('Lista de usuários/domínios autorizados atualizada com sucesso!');
  };

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
      recordBackupDone();
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
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'security' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('security')}
          >
            🛡️ Segurança & LGPD
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

        {/* Tab 1: Armazenamento & Limpeza */}
        {activeTab === 'storage' && (
          <StorageTab
            storageInfo={storageInfo}
            refreshStorageInfo={refreshStorageInfo}
            cutoffType={cutoffType}
            setCutoffType={setCutoffType}
            customCutoffDate={customCutoffDate}
            setCustomCutoffDate={setCustomCutoffDate}
            activeCutoffDate={activeCutoffDate}
            formatDisplayDate={formatDisplayDate}
            archivePreview={archivePreview}
            showArchiveConfirm={showArchiveConfirm}
            setShowArchiveConfirm={setShowArchiveConfirm}
            isArchiving={isArchiving}
            handleExecuteArchive={handleExecuteArchive}
            handleExportJSON={handleExportJSON}
            handleImportJSON={handleImportJSON}
          />
        )}

        {/* Tab 2: Sincronização & Nuvem */}
        {activeTab === 'sync' && (
          <SyncTab
            configured={configured}
            isLoading={isLoading}
            pendingQueue={pendingQueue}
            handleUploadToCloud={handleUploadToCloud}
            handleDownloadFromCloud={handleDownloadFromCloud}
            handleDrainQueue={handleDrainQueue}
            handleClearPendingQueue={handleClearPendingQueue}
            handleExportJSON={handleExportJSON}
            handleImportJSON={handleImportJSON}
          />
        )}

        {/* Tab 3: Tutorial Passo a Passo */}
        {activeTab === 'tutorial' && (
          <TutorialTab onGoToConfig={() => setActiveTab('config')} />
        )}

        {/* Tab 4: Configurar Chaves */}
        {activeTab === 'config' && (
          <ConfigTab
            config={config}
            setConfig={setConfig}
            pasteSnippet={pasteSnippet}
            handleParseSnippet={handleParseSnippet}
            handleSaveConfig={handleSaveConfig}
            handleDisconnect={handleDisconnect}
            configured={configured}
            isLoading={isLoading}
          />
        )}

        {/* Tab 5: Segurança & LGPD */}
        {activeTab === 'security' && (
          <SecurityTab
            inactivityMins={inactivityMins}
            handleSaveInactivity={handleSaveInactivity}
            hasPin={hasPin}
            pinInput={pinInput}
            setPinInput={setPinInput}
            handleSavePin={handleSavePin}
            handleClearPin={handleClearPin}
            publicRegAllowed={publicRegAllowed}
            allowedEmailsText={allowedEmailsText}
            setAllowedEmailsText={setAllowedEmailsText}
            handleSaveAllowedEmails={handleSaveAllowedEmails}
            lastBackupIso={lastBackupIso}
            daysSinceBackup={daysSinceBackup}
            exportAllDataAsJSON={exportAllDataAsJSON}
            toast={toast}
          />
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
