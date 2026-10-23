import { useState, useEffect, useRef } from 'react';
import {
  hasQuickLockPin,
  verifyQuickLockPin,
  setQuickLockPin,
} from '../utils/security';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

export default function LockScreen({ isLocked, onUnlock }) {
  const { user, logout } = useAuth();
  const toast = useToast();

  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [hasPin, setHasPin] = useState(() => hasQuickLockPin());
  const [isSettingPin, setIsSettingPin] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (isLocked) {
      setPin('');
      setErrorMsg('');
      setHasPin(hasQuickLockPin());
      setIsSettingPin(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
    }
  }, [isLocked]);

  if (!isLocked) return null;

  const handlePinSubmit = async (e) => {
    e?.preventDefault();
    setErrorMsg('');

    if (hasPin) {
      if (!pin) {
        setErrorMsg('Digite seu PIN de 4 a 8 dígitos.');
        return;
      }
      const valid = await verifyQuickLockPin(pin);
      if (valid) {
        setPin('');
        toast.success('Sessão desbloqueada!');
        onUnlock();
      } else {
        setErrorMsg('PIN incorreto. Tente novamente.');
        setPin('');
        inputRef.current?.focus();
      }
    } else {
      // Se não tem PIN configurado, desbloqueia diretamente
      toast.success('Sessão desbloqueada!');
      onUnlock();
    }
  };

  const handleSaveNewPin = async (e) => {
    e?.preventDefault();
    setErrorMsg('');
    if (newPin.length < 4 || newPin.length > 8) {
      setErrorMsg('O PIN deve conter entre 4 e 8 dígitos numéricos.');
      return;
    }
    if (newPin !== confirmNewPin) {
      setErrorMsg('Os PINs digitados não conferem.');
      return;
    }
    try {
      await setQuickLockPin(newPin);
      setHasPin(true);
      setIsSettingPin(false);
      setNewPin('');
      setConfirmNewPin('');
      toast.success('PIN configurado com sucesso! Sessão desbloqueada.');
      onUnlock();
    } catch (err) {
      setErrorMsg(err.message || 'Erro ao salvar o PIN.');
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      onUnlock();
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  return (
    <div
      className="lock-screen-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(10, 15, 29, 0.94)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Sessão Bloqueada por Inatividade"
    >
      <div
        className="lock-screen-card"
        style={{
          width: '100%',
          maxWidth: '420px',
          background: 'var(--card-bg, #1e293b)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '1.25rem',
          padding: '2.5rem 2rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(59, 130, 246, 0.15)',
          textAlign: 'center',
          animation: 'fadeInScale 0.25s ease-out',
        }}
      >
        {/* Ícone de Cadeado de Segurança */}
        <div
          style={{
            width: '64px',
            height: '64px',
            margin: '0 auto 1.25rem',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(37, 99, 235, 0.4))',
            border: '2px solid rgba(96, 165, 250, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 20px rgba(59, 130, 246, 0.3)',
          }}
        >
          <svg
            viewBox="0 0 24 24"
            width="32"
            height="32"
            fill="none"
            stroke="#60a5fa"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>

        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.5rem', color: '#f8fafc' }}>
          Sessão Bloqueada
        </h2>

        <p style={{ fontSize: '0.875rem', color: '#94a3b8', margin: '0 0 1.5rem', lineHeight: 1.5 }}>
          Por motivos de segurança e conformidade <strong>LGPD</strong>, os dados de pacientes foram ocultados após um período de inatividade.
        </p>

        {user?.email && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '2rem',
              padding: '0.35rem 0.85rem',
              fontSize: '0.8rem',
              color: '#cbd5e1',
              marginBottom: '1.5rem',
            }}
          >
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
            <span>{user.email}</span>
          </div>
        )}

        {/* Mensagens de Erro */}
        {errorMsg && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '0.5rem',
              padding: '0.6rem 0.85rem',
              fontSize: '0.85rem',
              color: '#fca5a5',
              marginBottom: '1rem',
              textAlign: 'left',
            }}
          >
            ⚠️ {errorMsg}
          </div>
        )}

        {/* Formulário de Desbloqueio com PIN existente */}
        {!isSettingPin && hasPin && (
          <form onSubmit={handlePinSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label
                htmlFor="lock-pin-input"
                style={{
                  display: 'block',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#94a3b8',
                  marginBottom: '0.5rem',
                }}
              >
                Insira o seu PIN de Acesso Rápido
              </label>
              <input
                ref={inputRef}
                id="lock-pin-input"
                type="password"
                inputMode="numeric"
                maxLength={8}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="••••"
                style={{
                  width: '100%',
                  textAlign: 'center',
                  fontSize: '1.75rem',
                  letterSpacing: '0.4em',
                  padding: '0.65rem',
                  borderRadius: '0.75rem',
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#ffffff',
                  outline: 'none',
                }}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{
                width: '100%',
                padding: '0.75rem',
                fontSize: '0.95rem',
                fontWeight: 600,
                borderRadius: '0.75rem',
                marginTop: '0.25rem',
              }}
            >
              🔓 Desbloquear Painel
            </button>
          </form>
        )}

        {/* Modo Sem PIN Configurado */}
        {!isSettingPin && !hasPin && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={onUnlock}
              style={{
                width: '100%',
                padding: '0.75rem',
                fontSize: '0.95rem',
                fontWeight: 600,
                borderRadius: '0.75rem',
              }}
            >
              🔓 Continuar Trabalhando
            </button>

            <button
              type="button"
              onClick={() => setIsSettingPin(true)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#60a5fa',
                fontSize: '0.85rem',
                cursor: 'pointer',
                padding: '0.5rem',
                textDecoration: 'underline',
              }}
            >
              ⚙️ Cadastrar um PIN de bloqueio rápido
            </button>
          </div>
        )}

        {/* Formulário para Cadastrar Novo PIN */}
        {isSettingPin && (
          <form onSubmit={handleSaveNewPin} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', textAlign: 'left' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.25rem' }}>
                Novo PIN (4 a 8 números):
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={8}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                placeholder="Ex: 1234"
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '0.5rem',
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#ffffff',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.25rem' }}>
                Confirmar Novo PIN:
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={8}
                value={confirmNewPin}
                onChange={(e) => setConfirmNewPin(e.target.value)}
                placeholder="Repita o PIN"
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '0.5rem',
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#ffffff',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => {
                  setIsSettingPin(false);
                  setErrorMsg('');
                }}
                style={{
                  flex: 1,
                  padding: '0.6rem',
                  borderRadius: '0.5rem',
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: 'none',
                  color: '#e2e8f0',
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{
                  flex: 1,
                  padding: '0.6rem',
                  borderRadius: '0.5rem',
                  fontWeight: 600,
                }}
              >
                Salvar PIN
              </button>
            </div>
          </form>
        )}

        {/* Rodapé com Logout */}
        <div style={{ marginTop: '1.75rem', paddingTop: '1.25rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <button
            type="button"
            onClick={handleLogout}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#f87171',
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sair e trocar de conta
          </button>
        </div>
      </div>
    </div>
  );
}
