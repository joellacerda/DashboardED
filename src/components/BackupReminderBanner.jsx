import { useState, useEffect, useCallback } from 'react';
import { getDaysSinceLastBackup } from '../utils/security';
import { exportAllDataAsJSON } from '../utils/storage';
import { useToast } from '../contexts/ToastContext';

export default function BackupReminderBanner({ onOpenBackupModal }) {
  const toast = useToast();
  const [daysSince, setDaysSince] = useState(() => getDaysSinceLastBackup());
  const [isDismissed, setIsDismissed] = useState(false);

  const checkBackupStatus = useCallback(() => {
    setDaysSince(getDaysSinceLastBackup());
  }, []);

  useEffect(() => {
    checkBackupStatus();
    window.addEventListener('endodiagnose_backup_status_changed', checkBackupStatus);
    return () => {
      window.removeEventListener('endodiagnose_backup_status_changed', checkBackupStatus);
    };
  }, [checkBackupStatus]);

  // Exibe se nunca foi feito backup (null) ou se faz 7 dias ou mais
  const needsBackup = daysSince === null || daysSince >= 7;

  if (!needsBackup || isDismissed) {
    return null;
  }

  const handleQuickDownload = () => {
    try {
      exportAllDataAsJSON();
      toast.success('Backup baixado com sucesso! Cópia de segurança gerada.');
    } catch (err) {
      toast.error('Erro ao gerar arquivo de backup: ' + err.message);
    }
  };

  const messageText =
    daysSince === null
      ? 'Nenhum backup de segurança foi registrado neste navegador.'
      : `O último backup de segurança foi realizado há ${daysSince} dia${daysSince > 1 ? 's' : ''}.`;

  return (
    <div
      className="backup-reminder-banner"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem',
        background: 'linear-gradient(90deg, rgba(245, 158, 11, 0.15), rgba(217, 119, 6, 0.08))',
        border: '1px solid rgba(245, 158, 11, 0.35)',
        borderRadius: '0.75rem',
        padding: '0.65rem 1rem',
        margin: '0.75rem 1.25rem 0',
        fontSize: '0.85rem',
        color: '#fef3c7',
        boxShadow: '0 4px 12px rgba(245, 158, 11, 0.08)',
        animation: 'slideDown 0.3s ease-out',
      }}
      role="status"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <span style={{ fontSize: '1.25rem' }}>⚠️</span>
        <div>
          <strong style={{ color: '#fbbf24' }}>Lembrete de Segurança (LGPD):</strong>{' '}
          <span>{messageText} Recomendamos gerar cópias periódicas dos dados clínicos.</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <button
          type="button"
          onClick={handleQuickDownload}
          style={{
            background: '#d97706',
            color: '#ffffff',
            border: 'none',
            borderRadius: '0.5rem',
            padding: '0.35rem 0.75rem',
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            transition: 'background 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#b45309')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#d97706')}
        >
          📥 Baixar Backup JSON
        </button>

        {onOpenBackupModal && (
          <button
            type="button"
            onClick={onOpenBackupModal}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              color: '#fef3c7',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '0.5rem',
              padding: '0.35rem 0.75rem',
              fontSize: '0.8rem',
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.18)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)')}
          >
            ☁️ Nuvem &amp; Histórico
          </button>
        )}

        <button
          type="button"
          onClick={() => setIsDismissed(true)}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#cbd5e1',
            fontSize: '1.1rem',
            lineHeight: 1,
            cursor: 'pointer',
            padding: '0.2rem 0.4rem',
            marginLeft: '0.25rem',
            opacity: 0.7,
            transition: 'opacity 0.2s',
          }}
          title="Fechar aviso temporariamente"
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.7')}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
