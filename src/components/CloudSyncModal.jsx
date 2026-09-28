import { useState, useEffect } from 'react';
import Modal from './Modal';
import { useToast } from '../contexts/ToastContext';
import {
  getStoredFirebaseConfig,
  saveStoredFirebaseConfig,
  isCloudConfigured,
  testConnection,
  initFirebase,
  reinitFirebase,
  uploadAllLocalToCloud,
  downloadAllCloudToLocal,
} from '../services/firebase';
import { getAllData, restoreAllData, MODULE_KEYS } from '../utils/storage';

export default function CloudSyncModal({ isOpen, onClose, onDataUpdated }) {
  const toast = useToast();
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
  const [activeTab, setActiveTab] = useState('sync'); // 'sync' | 'config' | 'tutorial'

  useEffect(() => {
    if (isOpen) {
      const stored = getStoredFirebaseConfig();
      if (stored) {
        setConfig(stored);
        setConfigured(true);
      } else {
        setConfigured(false);
        setActiveTab('tutorial');
      }
      setStatusMessage(null);
    }
  }, [isOpen]);

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

  const handleDisconnect = async () => {
    if (window.confirm('Deseja realmente desconectar o Firebase? Seus dados locais serão mantidos no navegador.')) {
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
    }
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

  const handleDownloadFromCloud = async () => {
    if (!isCloudConfigured()) {
      setStatusMessage({ type: 'error', text: 'Conecte o Firebase primeiro na aba de Configuração.' });
      return;
    }
    if (!window.confirm('Isso irá substituir os dados atuais deste navegador pelos dados salvos na nuvem. Deseja continuar?')) {
      return;
    }
    setIsLoading(true);
    setStatusMessage(null);
    try {
      const cloudData = await downloadAllCloudToLocal(MODULE_KEYS);
      restoreAllData(cloudData);
      setIsLoading(false);
      setStatusMessage({ type: 'success', text: '📥 Dados baixados da nuvem e restaurados com sucesso!' });
      toast.success('Dados restaurados da nuvem com sucesso!');
      if (onDataUpdated) onDataUpdated();
    } catch (err) {
      setIsLoading(false);
      setStatusMessage({ type: 'error', text: `Erro ao baixar dados da nuvem: ${err.message}` });
      toast.error('Erro ao baixar dados da nuvem.');
    }
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
      try {
        const parsed = JSON.parse(event.target.result);
        if (window.confirm('Deseja restaurar as informações deste arquivo de backup? Os dados locais serão atualizados.')) {
          restoreAllData(parsed);
          setStatusMessage({ type: 'success', text: 'Backup em JSON restaurado com sucesso!' });
          if (onDataUpdated) onDataUpdated();
        }
      } catch (err) {
        setStatusMessage({ type: 'error', text: 'Arquivo inválido: ' + err.message });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Nuvem & Backup (Firebase Firestore)"
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
        <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'sync' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('sync')}
          >
            🔄 Sincronização & Backup
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
  );
}
