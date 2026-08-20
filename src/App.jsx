import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ErrorBoundary from './components/ErrorBoundary';
import CloudSyncModal from './components/CloudSyncModal';
import { isCloudConfigured, initFirebase } from './services/firebase';
import OverviewPage from './pages/OverviewPage';
import ExamesPage from './pages/ExamesPage';
import FluxoCaixaPage from './pages/FluxoCaixaPage';
import DetalhesPage from './pages/DetalhesPage';
import RepassePage from './pages/RepassePage';
import FolhaPage from './pages/FolhaPage';
import ConveniosPage from './pages/ConveniosPage';

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [prefillDetalhe, setPrefillDetalhe] = useState(null);
  const [cloudModalOpen, setCloudModalOpen] = useState(false);
  const [cloudConnected, setCloudConnected] = useState(() => isCloudConfigured());
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    initFirebase();
    setCloudConnected(isCloudConfigured());
  }, []);

  const handleNavigateToDetalhes = (examData) => {
    setPrefillDetalhe(examData);
    setActiveTab('detalhes');
  };

  const handleClearPrefill = () => {
    setPrefillDetalhe(null);
  };

  const renderPage = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewPage />;
      case 'exames':
        return <ExamesPage onNavigateToDetalhes={handleNavigateToDetalhes} />;
      case 'convenios':
        return <ConveniosPage onNavigateToFluxo={() => setActiveTab('fluxo-caixa')} />;
      case 'fluxo-caixa':
        return <FluxoCaixaPage />;
      case 'detalhes':
        return (
          <DetalhesPage
            prefillData={prefillDetalhe}
            onClearPrefill={handleClearPrefill}
          />
        );
      case 'repasses':
        return <RepassePage />;
      case 'folha':
        return <FolhaPage />;
      default:
        return <OverviewPage />;
    }
  };

  return (
    <ErrorBoundary>
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
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: 'var(--text-xs)' }}
            onClick={() => setCloudModalOpen(true)}
            title="Nuvem & Backup"
          >
            <span>{cloudConnected ? '🟢' : '☁️'}</span>
            <span>{cloudConnected ? 'Nuvem' : 'Backup'}</span>
          </button>
        </header>

        <Sidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onOpenCloudModal={() => setCloudModalOpen(true)}
          isCloudConnected={cloudConnected}
        />
        <main className="main-content" key={`${activeTab}-${refreshKey}`}>
          <ErrorBoundary>
            {renderPage()}
          </ErrorBoundary>
        </main>

        <CloudSyncModal
          isOpen={cloudModalOpen}
          onClose={() => {
            setCloudModalOpen(false);
            setCloudConnected(isCloudConfigured());
          }}
          onDataUpdated={() => {
            setRefreshKey((k) => k + 1);
            setCloudConnected(isCloudConfigured());
          }}
        />
      </div>
    </ErrorBoundary>
  );
}
