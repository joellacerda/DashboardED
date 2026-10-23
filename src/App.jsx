import { useState, useEffect, lazy, Suspense } from 'react';
import Sidebar from './components/Sidebar';
import ErrorBoundary from './components/ErrorBoundary';
import CloudSyncModal from './components/CloudSyncModal';
import LoginPage from './components/LoginPage';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { DataProvider, useData } from './contexts/DataContext';
import { initFirebase } from './services/firebase';
import { runDataMigrations, setAuditUser } from './utils/storage';
import AuditLogModal from './components/AuditLogModal';
import SyncStatusBadge from './components/SyncStatusBadge';
import { initSyncQueueListeners } from './services/syncQueue';
import LockScreen from './components/LockScreen';
import BackupReminderBanner from './components/BackupReminderBanner';
import { useInactivityLock } from './hooks/useInactivityLock';

const ROUTES = [
  {
    id: 'overview',
    title: 'Visão Geral',
    component: lazy(() => import('./pages/OverviewPage')),
  },
  {
    id: 'cronograma',
    title: 'Cronograma de Salas',
    aliases: ['cronograma-salas', 'salas', 'escala'],
    component: lazy(() => import('./pages/CronogramaPage')),
  },
  {
    id: 'exames',
    title: 'Exames Particulares',
    component: lazy(() => import('./pages/ExamesPage')),
  },
  {
    id: 'convenios',
    title: 'Exames de Convênio',
    component: lazy(() => import('./pages/ConveniosPage')),
  },
  {
    id: 'fluxo-caixa',
    title: 'Fluxo de Caixa',
    component: lazy(() => import('./pages/FluxoCaixaPage')),
  },
  {
    id: 'detalhes',
    title: 'Detalhes de Exames',
    component: lazy(() => import('./pages/DetalhesPage')),
  },
  {
    id: 'repasses',
    title: 'Repasse Médico',
    component: lazy(() => import('./pages/RepassePage')),
  },
  {
    id: 'medicos',
    title: 'Dashboard por Médico',
    aliases: ['medico', 'doutor', 'doutores'],
    component: lazy(() => import('./pages/MedicoDashboardPage')),
  },
  {
    id: 'folha',
    title: 'Folha de Pagamento',
    component: lazy(() => import('./pages/FolhaPage')),
  },
  {
    id: 'relatorio',
    title: 'Relatório Consolidado',
    component: lazy(() => import('./pages/RelatorioPage')),
  },
];

const ROUTE_MAP = new Map(ROUTES.map((r) => [r.id, r]));
const DEFAULT_ROUTE_ID = 'overview';

function getTabFromHash() {
  if (typeof window === 'undefined') return DEFAULT_ROUTE_ID;
  const rawHash = window.location.hash || '';
  const cleanHash = rawHash.replace(/^#\/?/, '').trim().toLowerCase();
  if (!cleanHash) return DEFAULT_ROUTE_ID;
  if (ROUTE_MAP.has(cleanHash)) {
    return cleanHash;
  }
  for (const route of ROUTES) {
    if (route.aliases && route.aliases.includes(cleanHash)) {
      return route.id;
    }
  }
  return DEFAULT_ROUTE_ID;
}

function PageLoadingFallback() {
  return (
    <div className="page-loading-skeleton" role="status" aria-label="Carregando página">
      <div className="spinner-inline" style={{ width: '28px', height: '28px' }} />
      <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', fontWeight: 500 }}>
        Carregando página...
      </span>
    </div>
  );
}

function AppContent() {
  const { user, loading, isConfigured, refreshConfig } = useAuth();
  const { reloadAll, storageInfo } = useData();

  const [activeTab, setActiveTab] = useState(() => getTabFromHash());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [prefillDetalhe, setPrefillDetalhe] = useState(null);
  const [selectedDoctorForDashboard, setSelectedDoctorForDashboard] = useState(null);
  const [cloudModalOpen, setCloudModalOpen] = useState(false);
  const [cloudModalTab, setCloudModalTab] = useState('storage');
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [storageQuotaExceeded, setStorageQuotaExceeded] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Bloqueio de tela por inatividade (LGPD)
  const { isLocked, lockNow, unlock } = useInactivityLock(Boolean(user || !isConfigured));

  // Define usuário atual para log de auditoria
  useEffect(() => {
    setAuditUser(user?.email || user?.displayName || 'Usuário Local');
  }, [user]);

  // Monitora evento de limite de armazenamento atingido
  useEffect(() => {
    const handleQuota = () => {
      setStorageQuotaExceeded(true);
      setBannerDismissed(false);
    };
    window.addEventListener('endodiagnose:storage-quota-exceeded', handleQuota);
    return () => window.removeEventListener('endodiagnose:storage-quota-exceeded', handleQuota);
  }, []);

  // Synchronize browser history / hashchange (e.g. Back/Forward button, manual URL change)
  useEffect(() => {
    const handleHashChange = () => {
      const tabFromUrl = getTabFromHash();
      setActiveTab((prev) => (prev !== tabFromUrl ? tabFromUrl : prev));
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Synchronize URL hash and document title whenever activeTab changes
  useEffect(() => {
    const targetHash = `#/${activeTab}`;
    if (window.location.hash !== targetHash) {
      window.location.hash = targetHash;
    }
    const currentRoute = ROUTE_MAP.get(activeTab) || ROUTE_MAP.get(DEFAULT_ROUTE_ID);
    document.title = `${currentRoute.title} — Clínica Endodiagnose`;
  }, [activeTab]);

  useEffect(() => {
    runDataMigrations();
    initFirebase();
    const cleanupSync = initSyncQueueListeners();
    return () => {
      if (typeof cleanupSync === 'function') cleanupSync();
    };
  }, []);

  const handleNavigateToDetalhes = (examData) => {
    setPrefillDetalhe(examData);
    setActiveTab('detalhes');
  };

  const handleClearPrefill = () => {
    setPrefillDetalhe(null);
  };

  const handleNavigateToDoctor = (doctorName) => {
    if (doctorName) {
      setSelectedDoctorForDashboard(doctorName);
    }
    setActiveTab('medicos');
  };

  const handleOpenCloudModal = (tab = 'sync') => {
    setCloudModalTab(tab);
    setCloudModalOpen(true);
  };

  const handleCloudModalClose = () => {
    setCloudModalOpen(false);
    refreshConfig();
  };

  const handleDataUpdated = () => {
    reloadAll();
    setRefreshKey((k) => k + 1);
    refreshConfig();
    setStorageQuotaExceeded(false);
  };

  // If Firebase is configured and auth is verifying, show full-page loading
  if (isConfigured && loading) {
    return (
      <div className="auth-loading-screen">
        <div className="sidebar-logo login-logo-glow auth-loading-logo">ED</div>
        <div className="auth-loading-text">
          <h2>Endodiagnose</h2>
          <p>Verificando credenciais de acesso seguro...</p>
        </div>
        <div className="spinner-inline auth-loading-spinner" />
      </div>
    );
  }

  // If Firebase is configured and user is NOT authenticated, show Login Screen
  if (isConfigured && !user) {
    return (
      <>
        <LoginPage onOpenConfigModal={() => setCloudModalOpen(true)} />
        <CloudSyncModal
          isOpen={cloudModalOpen}
          onClose={handleCloudModalClose}
          onDataUpdated={handleDataUpdated}
        />
      </>
    );
  }

  const activeRoute = ROUTE_MAP.get(activeTab) || ROUTE_MAP.get(DEFAULT_ROUTE_ID);
  const ActivePageComponent = activeRoute.component;

  const renderActivePage = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <ActivePageComponent
            onOpenStorageManager={() => handleOpenCloudModal('storage')}
            onOpenAuditModal={() => setAuditModalOpen(true)}
          />
        );
      case 'exames':
        return <ActivePageComponent onNavigateToDetalhes={handleNavigateToDetalhes} />;
      case 'detalhes':
        return (
          <ActivePageComponent
            prefillData={prefillDetalhe}
            onClearPrefill={handleClearPrefill}
          />
        );
      case 'repasses':
        return <ActivePageComponent onNavigateToDoctor={handleNavigateToDoctor} />;
      case 'medicos':
        return (
          <ActivePageComponent
            initialDoctor={selectedDoctorForDashboard}
          />
        );
      case 'relatorio':
        return <ActivePageComponent onNavigateToDoctor={handleNavigateToDoctor} />;
      default:
        return <ActivePageComponent />;
    }
  };

  return (
    <div className="app-layout">
      {/* Top bar for smaller / mobile screens */}
      <header className="mobile-header">
        <button
          className="btn-hamburger"
          onClick={() => setSidebarOpen(true)}
          aria-label="Abrir Menu Lateral"
          title="Abrir Menu"
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <div className="mobile-header-brand">
          <div className="sidebar-logo" style={{ width: '32px', height: '32px', fontSize: 'var(--text-sm)' }}>ED</div>
          <span className="sidebar-brand-name" style={{ fontSize: 'var(--text-base)' }}>Endodiagnose</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <button
            type="button"
            className="btn btn-sm"
            onClick={lockNow}
            title="Bloquear Tela Agora (Inatividade / LGPD)"
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#cbd5e1',
              padding: '0.35rem 0.6rem',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              fontSize: '0.8rem',
            }}
          >
            🔒
          </button>
          <SyncStatusBadge onOpenModal={handleOpenCloudModal} variant="header" />
        </div>
      </header>

      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onOpenCloudModal={(tab = 'sync') => handleOpenCloudModal(tab)}
        onOpenAuditModal={() => setAuditModalOpen(true)}
        onLockScreen={lockNow}
      />
      <main className="main-content" key={refreshKey}>
        {/* Lembrete de Segurança / Backup periódico LGPD */}
        <BackupReminderBanner onOpenBackupModal={() => handleOpenCloudModal('storage')} />

        {/* Banner Global de Alerta de Armazenamento se uso for alto ou atingir cota */}
        {!bannerDismissed && (storageQuotaExceeded || storageInfo?.status === 'critical' || (storageInfo?.status === 'warning' && storageInfo?.usedPercentage >= 75)) && (
          <div className={`storage-alert-banner ${storageQuotaExceeded || storageInfo?.status === 'critical' ? 'critical' : 'warning'}`}>
            <div className="storage-alert-content">
              <span className="storage-alert-icon">
                {storageQuotaExceeded || storageInfo?.status === 'critical' ? '🚨' : '⚠️'}
              </span>
              <div className="storage-alert-text">
                <span className="storage-alert-title">
                  {storageQuotaExceeded
                    ? 'Limite de armazenamento do navegador atingido!'
                    : storageInfo?.status === 'critical'
                      ? `Armazenamento crítico (${storageInfo?.usedPercentage}% ocupado)`
                      : `Armazenamento em atenção (${storageInfo?.usedPercentage}% ocupado)`}
                </span>
                <span className="storage-alert-desc">
                  {storageQuotaExceeded
                    ? 'O navegador não possui mais espaço para novos exames. É necessário arquivar registros antigos.'
                    : 'Recomendamos arquivar atendimentos antigos para liberar espaço e garantir o carregamento instantâneo.'}
                </span>
              </div>
            </div>
            <div className="storage-alert-actions">
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => handleOpenCloudModal('storage')}
              >
                Gerenciar & Arquivar
              </button>
              <button
                type="button"
                className="btn-close-banner"
                onClick={() => setBannerDismissed(true)}
                aria-label="Dispensar aviso"
                title="Dispensar aviso"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        <ErrorBoundary>
          <Suspense fallback={<PageLoadingFallback />}>
            {renderActivePage()}
          </Suspense>
        </ErrorBoundary>
      </main>

      <CloudSyncModal
        isOpen={cloudModalOpen}
        onClose={handleCloudModalClose}
        onDataUpdated={handleDataUpdated}
        initialTab={cloudModalTab}
      />

      <AuditLogModal
        isOpen={auditModalOpen}
        onClose={() => setAuditModalOpen(false)}
      />

      {/* Tela de Bloqueio por Inatividade (LGPD) */}
      <LockScreen isLocked={isLocked} onUnlock={unlock} />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <DataProvider>
            <AppContent />
          </DataProvider>
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
