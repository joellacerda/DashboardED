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
];

export default function Sidebar({ activeTab, onTabChange, isOpen, onClose, onOpenCloudModal, isCloudConnected }) {
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
            <button
              key={item.id}
              className={`nav-item${activeTab === item.id ? ' active' : ''}`}
              onClick={() => handleItemClick(item.id)}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--border-subtle)' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{
              width: '100%',
              justifyContent: 'center',
              gap: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              background: isCloudConnected ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-surface-elevated)',
              borderColor: isCloudConnected ? 'rgba(16, 185, 129, 0.4)' : 'var(--border-subtle)',
              color: isCloudConnected ? 'var(--accent-emerald)' : 'var(--text-primary)',
            }}
            onClick={() => {
              if (onClose) onClose();
              if (onOpenCloudModal) onOpenCloudModal();
            }}
          >
            <span>{isCloudConnected ? '🟢' : '☁️'}</span>
            <span>{isCloudConnected ? 'Nuvem Conectada' : 'Salvar na Nuvem'}</span>
          </button>
        </div>

        <div className="sidebar-footer">
          Clínica Endodiagnose © {new Date().getFullYear()}
        </div>
      </aside>
    </>
  );
}
