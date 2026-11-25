// Utilitários de Segurança e LGPD — Clínica Endodiagnose

const ALLOWED_EMAILS_KEY = 'endodiagnose_allowed_emails';
const INACTIVITY_TIMEOUT_KEY = 'endodiagnose_inactivity_timeout_mins';
const LOCK_PIN_HASH_KEY = 'endodiagnose_lock_pin_hash';
const LOCK_PIN_SALT_KEY = 'endodiagnose_lock_pin_salt';
const LOCK_PIN_ALGO_KEY = 'endodiagnose_lock_pin_algo';
const LOCK_PIN_ATTEMPTS_KEY = 'endodiagnose_lock_pin_attempts';
const LOCK_PIN_LOCKOUT_UNTIL_KEY = 'endodiagnose_lock_pin_lockout_until';
const LAST_BACKUP_DATE_KEY = 'endodiagnose_last_backup_date';

// Timeout padrão por inatividade: 15 minutos
export const DEFAULT_INACTIVITY_TIMEOUT_MINS = 15;
export const MAX_PIN_ATTEMPTS = 5;
export const PIN_LOCKOUT_DURATION_MS = 30 * 1000;
const PBKDF2_ITERATIONS = 100000;
const PIN_ALGO_PBKDF2 = 'pbkdf2-sha256-v1';

/**
 * Retorna se o cadastro público de novas contas está habilitado.
 * Por padrão de segurança clínica (LGPD), novas contas públicas são DESATIVADAS.
 * Controlado exclusivamente por variável de ambiente (não pode ser reabilitado via localStorage).
 */
export function isPublicRegistrationAllowed() {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_ALLOW_PUBLIC_REGISTRATION === 'true') {
    return true;
  }
  return false;
}

/**
 * Obtém a lista de e-mails ou domínios explicitamente autorizados.
 * Se VITE_AUTH_ALLOWED_EMAILS estiver configurada no ambiente, ela prevalece exclusivamente
 * (impedindo ampliação indevida via localStorage).
 */
export function getAllowedEmailsList() {
  const envAllowed = new Set();

  // 1. Variável de ambiente (ex: "admin@endodiagnose.com,medico@endodiagnose.com,@endodiagnose.com.br")
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_AUTH_ALLOWED_EMAILS) {
    import.meta.env.VITE_AUTH_ALLOWED_EMAILS.split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
      .forEach((e) => envAllowed.add(e));
  }

  if (envAllowed.size > 0) {
    return Array.from(envAllowed);
  }

  // 2. Fallback: Configuração local do navegador (quando não há política via env)
  const localAllowed = new Set();
  if (typeof localStorage !== 'undefined') {
    const raw = localStorage.getItem(ALLOWED_EMAILS_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed
            .map((e) => String(e).trim().toLowerCase())
            .filter(Boolean)
            .forEach((e) => localAllowed.add(e));
        }
      } catch {
        // Ignora JSON malformado
      }
    }
  }

  return Array.from(localAllowed);
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
  // Exige estrutura mínima de e-mail válido (parte local + @ + domínio)
  const atIdx = cleanEmail.indexOf('@');
  if (atIdx <= 0 || atIdx !== cleanEmail.lastIndexOf('@') || atIdx === cleanEmail.length - 1) {
    return false;
  }

  const allowedList = getAllowedEmailsList();

  // Se não houver restrição explícita configurada, permite o usuário autenticado
  if (allowedList.length === 0) {
    return true;
  }

  const emailDomain = cleanEmail.slice(atIdx); // ex: "@endodiagnose.com.br"

  return allowedList.some((pattern) => {
    if (pattern.startsWith('@')) {
      return emailDomain === pattern;
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
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_INACTIVITY_TIMEOUT_MINS;
  return parsed;
}

/**
 * Define o tempo de inatividade para bloqueio de tela (>= 0).
 */
export function setInactivityTimeoutMinutes(mins) {
  if (typeof localStorage === 'undefined') return;
  const parsed = parseInt(mins, 10);
  const safeMins = Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_INACTIVITY_TIMEOUT_MINS;
  localStorage.setItem(INACTIVITY_TIMEOUT_KEY, String(safeMins));
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('endodiagnose:inactivity-timeout-changed', { detail: { mins: safeMins } }));
  }
}

/**
 * Gera um hash SHA-256 de uma string (mantido para compatibilidade com hashes legados).
 */
export async function hashString(value) {
  if (!value) return '';
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const msgBuffer = new TextEncoder().encode(String(value));
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  throw new Error('Web Crypto API (crypto.subtle) indisponível neste contexto. Acesse via HTTPS ou localhost.');
}

/**
 * Deriva hash criptográfico forte com PBKDF2-SHA256 (100.000 iterações) para o PIN.
 */
async function derivePinHash(pin, salt) {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('Web Crypto API indisponível neste navegador/contexto. Use HTTPS ou localhost para configurar PIN.');
  }
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(String(pin)),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: encoder.encode(String(salt)),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  return Array.from(new Uint8Array(derivedBits))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
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
 * Define o PIN de desbloqueio rápido (de 4 a 8 dígitos numéricos) usando PBKDF2-SHA256 com salt.
 */
export async function setQuickLockPin(pin) {
  if (typeof localStorage === 'undefined') return false;
  if (!pin) {
    localStorage.removeItem(LOCK_PIN_HASH_KEY);
    localStorage.removeItem(LOCK_PIN_SALT_KEY);
    localStorage.removeItem(LOCK_PIN_ALGO_KEY);
    resetPinAttempts();
    return true;
  }
  const cleanPin = String(pin).trim();
  if (!/^\d{4,8}$/.test(cleanPin)) {
    throw new Error('O PIN deve conter entre 4 e 8 dígitos numéricos.');
  }
  const salt = generatePinSalt();
  const hashed = await derivePinHash(cleanPin, salt);
  localStorage.setItem(LOCK_PIN_SALT_KEY, salt);
  localStorage.setItem(LOCK_PIN_HASH_KEY, hashed);
  localStorage.setItem(LOCK_PIN_ALGO_KEY, PIN_ALGO_PBKDF2);
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
  localStorage.removeItem(LOCK_PIN_ALGO_KEY);
  resetPinAttempts();
}

/**
 * Valida o PIN inserido com o hash armazenado, respeitando rate-limit (backoff de 30s após 5 erros).
 * Migra automaticamente hashes SHA-256 legados para PBKDF2-SHA256 ao validar com sucesso.
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
  const storedAlgo = localStorage.getItem(LOCK_PIN_ALGO_KEY);

  let isMatch = false;
  if (storedSalt && storedAlgo === PIN_ALGO_PBKDF2) {
    const enteredHash = await derivePinHash(cleanPin, storedSalt);
    isMatch = storedHash === enteredHash;
  } else if (storedSalt) {
    // Compatibilidade com hash SHA-256 com salt legado: migra para PBKDF2 ao acertar
    const legacySaltedHash = await hashString(`${storedSalt}:${cleanPin}`);
    isMatch = storedHash === legacySaltedHash;
    if (isMatch) {
      await setQuickLockPin(cleanPin);
    }
  } else {
    // Compatibilidade com hash legado sem salt: migra automaticamente para PBKDF2 ao acertar
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
