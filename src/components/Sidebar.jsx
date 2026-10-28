import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import SyncStatusBadge from './SyncStatusBadge';

const navItems = [
  {
    id: 'overview',
    label: 'Visão Geral',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    id: 'cronograma',
    label: 'Cronograma de Salas',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <path d="M8 14h.01" />
        <path d="M12 14h.01" />
        <path d="M16 14h.01" />
        <path d="M8 18h.01" />
        <path d="M12 18h.01" />
      </svg>
    ),
  },
  {
    id: 'exames',
    label: 'Exames Particulares',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    ),
  },
  {
    id: 'convenios',
    label: 'Exames de Convênio',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
        <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" />
      </svg>
    ),
  },
  {
    id: 'fluxo-caixa',
    label: 'Fluxo de Caixa',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
      </svg>
    ),
  },
  {
    id: 'detalhes',
    label: 'Detalhes de Exames',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14,2 14,8 20,8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10,9 9,9 8,9" />
      </svg>
    ),
  },
  {
    id: 'repasses',
    label: 'Repasse Médico',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 11l-3 3-2-2" />
        <path d="M19 8v6" />
      </svg>
    ),
  },
  {
    id: 'medicos',
    label: 'Dashboard por Médico',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M19 8v6m-3-3h6" />
      </svg>
    ),
  },
  {
    id: 'folha',
    label: 'Folha de Pagamento',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87" />
        <path d="M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
  },
  {
    id: 'relatorio',
    label: 'Relatório Consolidado',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
        <line x1="2" y1="20" x2="22" y2="20" />
      </svg>
    ),
  },
];

export default function Sidebar({
  activeTab,
  onTabChange,
  isOpen,
  onClose,
  onOpenCloudModal,
  onOpenAuditModal,
  onLockScreen,
}) {
  const { user, logout, isConfigured } = useAuth();
  const [avatarError, setAvatarError] = useState(false);

  useEffect(() => {
    setAvatarError(false);
  }, [user?.photoURL]);

  const getInitials = (name, email) => {
    if (name && name.trim()) {
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return name.slice(0, 2).toUpperCase();
    }
    if (email) {
      return email.slice(0, 2).toUpperCase();
    }
    return 'ED';
  };

  const handleItemClick = (id) => {
    onTabChange(id);
    if (onClose) onClose();
  };

  return (
    <>
      {isOpen && (
        <div
          className="sidebar-backdrop"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside className={`sidebar${isOpen ? ' open' : ''}`}>
        <div className="sidebar-brand">
          <div className="sidebar-logo">ED</div>
          <div className="sidebar-brand-text">
            <span className="sidebar-brand-name">Endodiagnose</span>
            <span className="sidebar-brand-sub">Dashboard Clínico</span>
          </div>
          <button
            className="sidebar-close-btn"
            onClick={onClose}
            aria-label="Fechar Menu"
            title="Fechar Menu"
          >
            ✕
          </button>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <a
              key={item.id}
              href={`#/${item.id}`}
              className={`nav-item${activeTab === item.id ? ' active' : ''}`}
              aria-current={activeTab === item.id ? 'page' : undefined}
              onClick={(e) => {
                if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
                  e.preventDefault();
                  handleItemClick(item.id);
                }
              }}
            >
              {item.icon}
              {item.label}
            </a>
          ))}
        </nav>

        <div className="sidebar-bottom-actions">
          {/* Cloud Sync Status Indicator */}
          <SyncStatusBadge
            variant="sidebar"
            onOpenModal={(tab) => {
              if (onClose) onClose();
              if (onOpenCloudModal) onOpenCloudModal(tab);
            }}
          />

          <button
            type="button"
            className="btn btn-secondary btn-sm sidebar-cloud-btn"
            style={{
              width: '100%',
              justifyContent: 'center',
              gap: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              marginTop: '0.4rem',
              fontSize: 'var(--text-xs)',
              background: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-secondary)',
            }}
            onClick={() => {
              if (onClose) onClose();
              if (onOpenAuditModal) onOpenAuditModal();
            }}
            title="Ver histórico de atividades e auditoria de ações"
          >
            <span>📋</span>
            <span>Auditoria & Logs</span>
          </button>

          {/* User Profile Card if logged in */}
          {user ? (
            <div className="sidebar-user-card">
              <div className="sidebar-user-avatar">
                {user.photoURL && !avatarError ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'Avatar'}
                    className="sidebar-user-img"
                    referrerPolicy="no-referrer"
                    onError={() => setAvatarError(true)}
                  />
                ) : (
                  <span>{getInitials(user.displayName, user.email)}</span>
                )}
              </div>
              <div className="sidebar-user-info">
                <span className="sidebar-user-name" title={user.displayName || user.email}>
                  {user.displayName || user.email?.split('@')[0]}
                </span>
                <span className="sidebar-user-email" title={user.email}>
                  {user.email}
                </span>
              </div>
              {onLockScreen && (
                <button
                  type="button"
                  className="sidebar-user-logout-btn"
                  onClick={() => {
                    if (onClose) onClose();
                    onLockScreen();
                  }}
                  title="Bloquear Tela (Inatividade / LGPD)"
                  aria-label="Bloquear Tela"
                  style={{ marginRight: '0.25rem' }}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </button>
              )}
              <button
                type="button"
                className="sidebar-user-logout-btn"
                onClick={logout}
                title="Sair do sistema (Logout)"
                aria-label="Sair do sistema"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            </div>
          ) : !isConfigured ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', width: '100%' }}>
              <div className="sidebar-offline-pill" style={{ margin: 0, flex: 1 }}>
                <span className="sidebar-offline-dot" />
                <span>Modo Local (Offline)</span>
              </div>
              {onLockScreen && (
                <button
                  type="button"
                  className="sidebar-user-logout-btn"
                  onClick={() => {
                    if (onClose) onClose();
                    onLockScreen();
                  }}
                  title="Bloquear Tela (LGPD)"
                  aria-label="Bloquear Tela"
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </button>
              )}
            </div>
          ) : null}
        </div>

        <div className="sidebar-footer">
          Clínica Endodiagnose © {new Date().getFullYear()}
        </div>
      </aside>
    </>
  );
}
