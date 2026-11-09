// Utilitários de Segurança e LGPD — Clínica Endodiagnose

const ALLOWED_EMAILS_KEY = 'endodiagnose_allowed_emails';
const INACTIVITY_TIMEOUT_KEY = 'endodiagnose_inactivity_timeout_mins';
const LOCK_PIN_HASH_KEY = 'endodiagnose_lock_pin_hash';
const LOCK_PIN_SALT_KEY = 'endodiagnose_lock_pin_salt';
const LOCK_PIN_ATTEMPTS_KEY = 'endodiagnose_lock_pin_attempts';
const LOCK_PIN_LOCKOUT_UNTIL_KEY = 'endodiagnose_lock_pin_lockout_until';
const LAST_BACKUP_DATE_KEY = 'endodiagnose_last_backup_date';

// Timeout padrão por inatividade: 15 minutos
export const DEFAULT_INACTIVITY_TIMEOUT_MINS = 15;
export const MAX_PIN_ATTEMPTS = 5;
export const PIN_LOCKOUT_DURATION_MS = 30 * 1000;

/**
 * Retorna se o cadastro público de novas contas está habilitado.
 * Por padrão de segurança clínica (LGPD), novas contas públicas são DESATIVADAS.
 */
export function isPublicRegistrationAllowed() {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_ALLOW_PUBLIC_REGISTRATION === 'true') {
    return true;
  }
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem('endodiagnose_allow_public_registration') === 'true';
  }
  return false;
}

/**
 * Obtém a lista de e-mails ou domínios explicitamente autorizados.
 */
export function getAllowedEmailsList() {
  const allowed = new Set();

  // 1. Variável de ambiente (ex: "admin@endodiagnose.com,medico@endodiagnose.com,@endodiagnose.com.br")
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_AUTH_ALLOWED_EMAILS) {
    import.meta.env.VITE_AUTH_ALLOWED_EMAILS.split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
      .forEach((e) => allowed.add(e));
  }

  // 2. Configuração local do navegador
  if (typeof localStorage !== 'undefined') {
    const raw = localStorage.getItem(ALLOWED_EMAILS_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed
            .map((e) => String(e).trim().toLowerCase())
            .filter(Boolean)
            .forEach((e) => allowed.add(e));
        }
      } catch {
        // Ignora JSON malformado
      }
    }
  }

  return Array.from(allowed);
}

/**
 * Salva a lista de e-mails autorizados no localStorage.
 */
export function setAllowedEmailsList(emails) {
  if (typeof localStorage === 'undefined') return;
  const list = Array.isArray(emails) ? emails.map((e) => String(e).trim().toLowerCase()).filter(Boolean) : [];
  localStorage.setItem(ALLOWED_EMAILS_KEY, JSON.stringify(list));
}

/**
 * Valida se um e-mail possui permissão de acesso segundo as regras da clínica.
 */
export function isEmailAllowed(email) {
  if (!email) return false;
  const cleanEmail = String(email).trim().toLowerCase();
  const allowedList = getAllowedEmailsList();

  // Se não houver restrição explícita configurada, permite o usuário autenticado
  if (allowedList.length === 0) {
    return true;
  }

  return allowedList.some((pattern) => {
    if (pattern.startsWith('@')) {
      return cleanEmail.endsWith(pattern);
    }
    return cleanEmail === pattern;
  });
}

/**
 * Obtém o tempo de inatividade em minutos para bloqueio de tela.
 * Retorna 0 se desativado.
 */
export function getInactivityTimeoutMinutes() {
  if (typeof localStorage === 'undefined') return DEFAULT_INACTIVITY_TIMEOUT_MINS;
  const saved = localStorage.getItem(INACTIVITY_TIMEOUT_KEY);
  if (saved === null) return DEFAULT_INACTIVITY_TIMEOUT_MINS;
  const parsed = parseInt(saved, 10);
  return Number.isFinite(parsed) ? parsed : DEFAULT_INACTIVITY_TIMEOUT_MINS;
}

/**
 * Define o tempo de inatividade para bloqueio de tela.
 */
export function setInactivityTimeoutMinutes(mins) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(INACTIVITY_TIMEOUT_KEY, String(mins));
}

/**
 * Gera um hash SHA-256 de uma string para não persistir o PIN puro.
 */
export async function hashString(value) {
  if (!value) return '';
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const msgBuffer = new TextEncoder().encode(String(value));
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback simples para ambientes sem Web Crypto
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return `fallback_${hash}`;
}

function generatePinSalt() {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return `ed_salt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Retorna o status atual de bloqueio temporário por excesso de tentativas de PIN.
 */
export function getPinLockoutStatus(now = Date.now()) {
  if (typeof localStorage === 'undefined') {
    return { isLockedOut: false, remainingSeconds: 0, attempts: 0, lockedUntil: 0 };
  }
  const attempts = parseInt(localStorage.getItem(LOCK_PIN_ATTEMPTS_KEY) || '0', 10) || 0;
  const lockedUntil = parseInt(localStorage.getItem(LOCK_PIN_LOCKOUT_UNTIL_KEY) || '0', 10) || 0;

  if (lockedUntil > now) {
    const remainingSeconds = Math.ceil((lockedUntil - now) / 1000);
    return { isLockedOut: true, remainingSeconds, attempts, lockedUntil };
  }

  // Se o período de bloqueio já expirou, limpa o bloqueio e zera o contador
  if (lockedUntil > 0 && lockedUntil <= now) {
    localStorage.removeItem(LOCK_PIN_LOCKOUT_UNTIL_KEY);
    localStorage.removeItem(LOCK_PIN_ATTEMPTS_KEY);
    return { isLockedOut: false, remainingSeconds: 0, attempts: 0, lockedUntil: 0 };
  }

  return { isLockedOut: false, remainingSeconds: 0, attempts, lockedUntil: 0 };
}

/**
 * Zera o contador de tentativas incorretas de PIN.
 */
export function resetPinAttempts() {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(LOCK_PIN_ATTEMPTS_KEY);
  localStorage.removeItem(LOCK_PIN_LOCKOUT_UNTIL_KEY);
}

/**
 * Registra uma tentativa falha de PIN e aplica lockout de 30s ao atingir MAX_PIN_ATTEMPTS.
 */
export function recordFailedPinAttempt(now = Date.now()) {
  if (typeof localStorage === 'undefined') {
    return { isLockedOut: false, remainingSeconds: 0, attempts: 1, lockedUntil: 0 };
  }
  const currentStatus = getPinLockoutStatus(now);
  if (currentStatus.isLockedOut) return currentStatus;

  const nextAttempts = currentStatus.attempts + 1;
  localStorage.setItem(LOCK_PIN_ATTEMPTS_KEY, String(nextAttempts));

  if (nextAttempts >= MAX_PIN_ATTEMPTS) {
    const lockedUntil = now + PIN_LOCKOUT_DURATION_MS;
    localStorage.setItem(LOCK_PIN_LOCKOUT_UNTIL_KEY, String(lockedUntil));
    return {
      isLockedOut: true,
      remainingSeconds: Math.ceil(PIN_LOCKOUT_DURATION_MS / 1000),
      attempts: nextAttempts,
      lockedUntil,
    };
  }

  return {
    isLockedOut: false,
    remainingSeconds: 0,
    attempts: nextAttempts,
    lockedUntil: 0,
  };
}

/**
 * Define o PIN de desbloqueio rápido (de 4 a 8 dígitos) com salt criptográfico.
 */
export async function setQuickLockPin(pin) {
  if (typeof localStorage === 'undefined') return false;
  if (!pin) {
    localStorage.removeItem(LOCK_PIN_HASH_KEY);
    localStorage.removeItem(LOCK_PIN_SALT_KEY);
    resetPinAttempts();
    return true;
  }
  const cleanPin = String(pin).trim();
  if (cleanPin.length < 4 || cleanPin.length > 8) {
    throw new Error('O PIN deve conter entre 4 e 8 dígitos.');
  }
  const salt = generatePinSalt();
  const hashed = await hashString(`${salt}:${cleanPin}`);
  localStorage.setItem(LOCK_PIN_SALT_KEY, salt);
  localStorage.setItem(LOCK_PIN_HASH_KEY, hashed);
  resetPinAttempts();
  return true;
}

/**
 * Verifica se um PIN configurado existe.
 */
export function hasQuickLockPin() {
  if (typeof localStorage === 'undefined') return false;
  return Boolean(localStorage.getItem(LOCK_PIN_HASH_KEY));
}

/**
 * Remove o PIN configurado.
 */
export function clearQuickLockPin() {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(LOCK_PIN_HASH_KEY);
  localStorage.removeItem(LOCK_PIN_SALT_KEY);
  resetPinAttempts();
}

/**
 * Valida o PIN inserido com o hash armazenado, respeitando rate-limit (backoff de 30s após 5 erros).
 */
export async function verifyQuickLockPin(enteredPin) {
  if (typeof localStorage === 'undefined') return false;
  const lockout = getPinLockoutStatus();
  if (lockout.isLockedOut) {
    return false;
  }

  const storedHash = localStorage.getItem(LOCK_PIN_HASH_KEY);
  if (!storedHash) return false;

  const cleanPin = String(enteredPin).trim();
  const storedSalt = localStorage.getItem(LOCK_PIN_SALT_KEY);

  let isMatch = false;
  if (storedSalt) {
    const enteredHash = await hashString(`${storedSalt}:${cleanPin}`);
    isMatch = storedHash === enteredHash;
  } else {
    // Compatibilidade com hash legado sem salt: migra automaticamente ao acertar
    const legacyHash = await hashString(cleanPin);
    isMatch = storedHash === legacyHash;
    if (isMatch) {
      await setQuickLockPin(cleanPin);
    }
  }

  if (isMatch) {
    resetPinAttempts();
    return true;
  }

  recordFailedPinAttempt();
  return false;
}

/**
 * Registra a data/hora do último backup realizado (manual, pré-expurgo ou nuvem).
 */
export function recordBackupDone(dateIso = new Date().toISOString()) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(LAST_BACKUP_DATE_KEY, dateIso);
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new Event('endodiagnose_backup_status_changed'));
  }
}

/**
 * Retorna a data ISO do último backup realizado.
 */
export function getLastBackupDate() {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(LAST_BACKUP_DATE_KEY);
}

/**
 * Calcula a quantidade de dias desde o último backup.
 * Retorna null se nunca foi realizado um backup.
 */
export function getDaysSinceLastBackup() {
  const lastIso = getLastBackupDate();
  if (!lastIso) return null;
  const lastTime = new Date(lastIso).getTime();
  if (Number.isNaN(lastTime)) return null;
  const now = Date.now();
  const diffDays = Math.floor((now - lastTime) / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}
