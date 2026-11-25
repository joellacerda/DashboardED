import { useState, useEffect, useRef } from 'react';
import {
  hasQuickLockPin,
  verifyQuickLockPin,
  getPinLockoutStatus,
  MAX_PIN_ATTEMPTS,
} from '../utils/security';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

export default function LockScreen({ isLocked, onUnlock }) {
  const { user, isConfigured, logout } = useAuth();
  const toast = useToast();

  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [hasPin, setHasPin] = useState(() => hasQuickLockPin());
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const inputRef = useRef(null);
  const dialogRef = useRef(null);

  useEffect(() => {
    if (isLocked) {
      const pinExists = hasQuickLockPin();
      const status = getPinLockoutStatus();
      setPin('');
      setErrorMsg('');
      setHasPin(pinExists);
      setLockoutSeconds(status.isLockedOut ? status.remainingSeconds : 0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
    }
  }, [isLocked]);

  useEffect(() => {
    if (!isLocked || lockoutSeconds <= 0) return undefined;
    const timer = setInterval(() => {
      const status = getPinLockoutStatus();
      if (status.isLockedOut) {
        setLockoutSeconds(status.remainingSeconds);
      } else {
        setLockoutSeconds(0);
        setErrorMsg('');
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [isLocked, lockoutSeconds]);

  // Focus trap para impedir navegação via Tab nos elementos atrás do bloqueio
  useEffect(() => {
    if (!isLocked) return undefined;

    const handleKeyDown = (e) => {
      if (e.key !== 'Tab') return;
      const container = dialogRef.current;
      if (!container) return;
      const focusable = Array.from(
        container.querySelectorAll('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])')
      ).filter((el) => el.offsetParent !== null);

      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first || !container.contains(document.activeElement)) {
          e.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last || !container.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isLocked]);

  if (!isLocked) return null;

  const handlePinSubmit = async (e) => {
    e?.preventDefault();
    setErrorMsg('');

    const currentLockout = getPinLockoutStatus();
    if (currentLockout.isLockedOut) {
      setLockoutSeconds(currentLockout.remainingSeconds);
      setErrorMsg(
        `Muitas tentativas incorretas. Aguarde ${currentLockout.remainingSeconds}s para tentar novamente.`
      );
      return;
    }

    if (!pin.trim()) {
      setErrorMsg('Digite seu PIN de 4 a 8 dígitos.');
      return;
    }

    const valid = await verifyQuickLockPin(pin);
    if (valid) {
      setPin('');
      setLockoutSeconds(0);
      toast.success('Sessão desbloqueada!');
      onUnlock();
    } else {
      const afterStatus = getPinLockoutStatus();
      setPin('');
      if (afterStatus.isLockedOut) {
        setLockoutSeconds(afterStatus.remainingSeconds);
        setErrorMsg(
          `Limite de ${MAX_PIN_ATTEMPTS} tentativas excedido. Bloqueado temporariamente por ${afterStatus.remainingSeconds}s.`
        );
      } else {
        const remainingTries = Math.max(0, MAX_PIN_ATTEMPTS - afterStatus.attempts);
        setErrorMsg(
          `PIN incorreto. Tente novamente (${remainingTries} tentativa${remainingTries === 1 ? '' : 's'} restante${remainingTries === 1 ? '' : 's'}).`
        );
        inputRef.current?.focus();
      }
    }
  };

  const handleLogout = async () => {
    if (!isConfigured || !user) return;
    try {
      await logout();
      onUnlock();
    } catch (err) {
      console.error('Logout error:', err);
      toast.error('Erro ao encerrar sessão.');
    }
  };

  return (
    <div
      ref={dialogRef}
      className="lock-screen-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Sessão Bloqueada por Inatividade"
    >
      <div className="lock-screen-card">
        {/* Ícone de Cadeado de Segurança */}
        <div className="lock-screen-icon">
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

        <h2 className="lock-screen-title">Sessão Bloqueada</h2>

        <p className="lock-screen-desc">
          Por motivos de segurança e conformidade <strong>LGPD</strong>, os dados de pacientes foram ocultados após um período de inatividade.
        </p>

        {user?.email && (
          <div className="lock-screen-user-pill">
            <span className="lock-screen-user-dot" />
            <span>{user.email}</span>
          </div>
        )}

        {/* Mensagens de Erro */}
        {errorMsg && (
          <div className="lock-screen-error" role="alert">
            ⚠️ {errorMsg}
          </div>
        )}

        {/* Formulário de Desbloqueio com PIN existente */}
        {hasPin ? (
          <form onSubmit={handlePinSubmit} className="lock-screen-form">
            <div>
              <label htmlFor="lock-pin-input" className="lock-screen-label">
                Insira o seu PIN de Acesso Rápido
              </label>
              <input
                ref={inputRef}
                id="lock-pin-input"
                type="password"
                inputMode="numeric"
                maxLength={8}
                disabled={lockoutSeconds > 0}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                className="lock-screen-pin-input"
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary lock-screen-submit"
              disabled={lockoutSeconds > 0}
            >
              {lockoutSeconds > 0
                ? `⏳ Aguarde ${lockoutSeconds}s...`
                : '🔓 Desbloquear Painel'}
            </button>
          </form>
        ) : isConfigured && user ? (
          <div className="lock-screen-form">
            <p className="lock-screen-desc" style={{ marginBottom: '0.5rem' }}>
              Nenhum PIN rápido foi pré-cadastrado neste dispositivo. Para sua segurança, faça login novamente ou configure um PIN na aba <strong>Segurança &amp; LGPD</strong> após entrar.
            </p>
            <button
              type="button"
              className="btn btn-primary lock-screen-submit"
              onClick={handleLogout}
            >
              🔑 Fazer Login Novamente
            </button>
          </div>
        ) : (
          <div className="lock-screen-form">
            <p className="lock-screen-desc" style={{ marginBottom: '0.5rem' }}>
              Modo local sem PIN cadastrado. Recomendamos cadastrar um PIN numérico em <strong>Nuvem &amp; Segurança → Segurança &amp; LGPD</strong> para proteger os dados clínicos.
            </p>
            <button
              type="button"
              className="btn btn-primary lock-screen-submit"
              onClick={onUnlock}
            >
              🔓 Retomar Sessão Local
            </button>
          </div>
        )}

        {/* Rodapé com Logout — exibido somente quando autenticado no Firebase */}
        {isConfigured && user && (
          <div className="lock-screen-footer">
            <button type="button" onClick={handleLogout} className="lock-screen-logout-btn">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Sair e trocar de conta
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
