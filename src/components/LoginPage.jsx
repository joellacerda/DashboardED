import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getAuthErrorMessage } from '../services/firebase';

export default function LoginPage({ onOpenConfigModal }) {
  const { login, register, loginGoogle, sendPasswordReset } = useAuth();

  const [mode, setMode] = useState('login'); // 'login' | 'register' | 'forgot'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (mode === 'forgot') {
      if (!email.trim()) {
        setErrorMsg('Informe seu e-mail para receber as instruções.');
        return;
      }
      setLoading(true);
      try {
        await sendPasswordReset(email);
        setSuccessMsg('E-mail de recuperação enviado! Verifique sua caixa de entrada e spam.');
        setLoading(false);
      } catch (err) {
        console.error('Password reset error:', err);
        setErrorMsg(getAuthErrorMessage(err));
        setLoading(false);
      }
      return;
    }

    if (mode === 'register') {
      if (password.length < 6) {
        setErrorMsg('A senha deve ter no mínimo 6 caracteres.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg('As senhas digitadas não coincidem.');
        return;
      }
      setLoading(true);
      try {
        await register(email, password);
      } catch (err) {
        console.error('Register error:', err);
        setErrorMsg(getAuthErrorMessage(err));
        setLoading(false);
      }
      return;
    }

    // Default mode: login
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      console.error('Login error:', err);
      setErrorMsg(getAuthErrorMessage(err));
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      await loginGoogle();
    } catch (err) {
      console.error('Google sign-in error:', err);
      setErrorMsg(getAuthErrorMessage(err));
      setLoading(false);
    }
  };

  return (
    <div className="login-screen-wrapper">
      <div className="login-card-container">
        {/* Brand Header */}
        <div className="login-brand-header">
          <div className="sidebar-logo login-logo-glow">ED</div>
          <h1 className="login-title">Endodiagnose</h1>
          <p className="login-subtitle">Acesso Seguro ao Dashboard Clínico</p>
        </div>

        {/* Tab Switcher (Login vs Cadastro) */}
        {mode !== 'forgot' && (
          <div className="login-tabs">
            <button
              type="button"
              id="tab-login"
              className={`login-tab-btn ${mode === 'login' ? 'active' : ''}`}
              onClick={() => {
                setMode('login');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
            >
              Entrar
            </button>
            <button
              type="button"
              id="tab-register"
              className={`login-tab-btn ${mode === 'register' ? 'active' : ''}`}
              onClick={() => {
                setMode('register');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
            >
              Criar Conta
            </button>
          </div>
        )}

        {/* Alerts */}
        {errorMsg && (
          <div className="login-alert error" role="alert">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="login-alert success" role="alert">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <span>{successMsg}</span>
          </div>
        )}

        {/* Main Form */}
        <form onSubmit={handleSubmit} className="login-form">
          <div className="input-group">
            <label className="input-label" htmlFor="auth-email">
              E-mail Profissional
            </label>
            <div className="login-input-wrapper">
              <span className="login-input-icon">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              </span>
              <input
                id="auth-email"
                type="email"
                required
                className="input-field with-icon"
                placeholder="exemplo@endodiagnose.com.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                autoComplete="email"
              />
            </div>
          </div>

          {mode !== 'forgot' && (
            <div className="input-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="input-label" htmlFor="auth-password">
                  Senha
                </label>
                {mode === 'login' && (
                  <button
                    type="button"
                    className="login-forgot-btn"
                    onClick={() => {
                      setMode('forgot');
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                  >
                    Esqueceu a senha?
                  </button>
                )}
              </div>
              <div className="login-input-wrapper">
                <span className="login-input-icon">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </span>
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="input-field with-icon with-action"
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                />
                <button
                  type="button"
                  className="login-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                  aria-label="Alternar visibilidade da senha"
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          )}

          {mode === 'register' && (
            <div className="input-group">
              <label className="input-label" htmlFor="auth-confirm-password">
                Confirmar Senha
              </label>
              <div className="login-input-wrapper">
                <span className="login-input-icon">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </span>
                <input
                  id="auth-confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="input-field with-icon"
                  placeholder="Repita a senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  autoComplete="new-password"
                />
              </div>
            </div>
          )}

          {mode === 'forgot' && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '-0.25rem' }}>
              <button
                type="button"
                className="login-forgot-btn"
                onClick={() => {
                  setMode('login');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
              >
                ← Voltar para o login
              </button>
            </div>
          )}

          <button
            type="submit"
            id="btn-auth-submit"
            className="btn btn-primary login-submit-btn"
            disabled={loading}
          >
            {loading ? (
              <span className="spinner-inline" />
            ) : mode === 'login' ? (
              'Entrar no Sistema'
            ) : mode === 'register' ? (
              'Criar Conta'
            ) : (
              'Enviar Link de Recuperação'
            )}
          </button>
        </form>

        {/* Google Sign In option */}
        {mode !== 'forgot' && (
          <>
            <div className="login-divider">
              <span>ou acesse com</span>
            </div>

            <button
              type="button"
              id="btn-google-auth"
              className="btn-google-signin"
              onClick={handleGoogleSignIn}
              disabled={loading}
            >
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continuar com o Google</span>
            </button>
          </>
        )}

        {/* Footer / Offline / Configuration Link */}
        {onOpenConfigModal && (
          <div className="login-footer-actions">
            <button
              type="button"
              className="login-config-link"
              onClick={onOpenConfigModal}
            >
              ⚙️ Configurações do Firebase / Nuvem
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
