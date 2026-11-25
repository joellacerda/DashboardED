import { describe, it, expect, beforeEach } from 'vitest';
import {
  isPublicRegistrationAllowed,
  getAllowedEmailsList,
  setAllowedEmailsList,
  isEmailAllowed,
  getInactivityTimeoutMinutes,
  setInactivityTimeoutMinutes,
  DEFAULT_INACTIVITY_TIMEOUT_MINS,
  setQuickLockPin,
  hasQuickLockPin,
  clearQuickLockPin,
  verifyQuickLockPin,
  hashString,
  getPinLockoutStatus,
  MAX_PIN_ATTEMPTS,
  PIN_LOCKOUT_DURATION_MS,
  recordBackupDone,
  getLastBackupDate,
  getDaysSinceLastBackup,
} from './security';
import { escapeHtml } from './helpers';

const mockStorage = (() => {
  let store = {};
  return {
    getItem: (key) => (Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null),
    setItem: (key, value) => {
      store[key] = String(value);
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

globalThis.localStorage = mockStorage;

describe('Security & LGPD — Fase 6', () => {
  beforeEach(() => {
    mockStorage.clear();
  });

  describe('6.2 — Controle de Cadastro e Allowlist', () => {
    it('desativa cadastro público por padrão', () => {
      expect(isPublicRegistrationAllowed()).toBe(false);
    });

    it('permite qualquer e-mail se nenhuma allowlist estiver definida', () => {
      expect(isEmailAllowed('doutor@clinica.com')).toBe(true);
    });

    it('restringe e-mails específicos quando allowlist é definida', () => {
      setAllowedEmailsList(['admin@endodiagnose.com', 'medico@endodiagnose.com']);
      expect(getAllowedEmailsList()).toEqual(['admin@endodiagnose.com', 'medico@endodiagnose.com']);
      expect(isEmailAllowed('admin@endodiagnose.com')).toBe(true);
      expect(isEmailAllowed('MEDICO@endodiagnose.com')).toBe(true); // Case-insensitive
      expect(isEmailAllowed('invasor@externo.com')).toBe(false);
    });

    it('permite restrição por domínio (ex: @endodiagnose.com.br)', () => {
      setAllowedEmailsList(['@endodiagnose.com.br']);
      expect(isEmailAllowed('dra.ana@endodiagnose.com.br')).toBe(true);
      expect(isEmailAllowed('recepcao@endodiagnose.com.br')).toBe(true);
      expect(isEmailAllowed('alguem@gmail.com')).toBe(false);
    });
  });

  describe('6.4 — Bloqueio por Inatividade e PIN', () => {
    it('retorna timeout padrão de 15 minutos', () => {
      expect(getInactivityTimeoutMinutes()).toBe(DEFAULT_INACTIVITY_TIMEOUT_MINS);
    });

    it('permite alterar o timeout de inatividade', () => {
      setInactivityTimeoutMinutes(5);
      expect(getInactivityTimeoutMinutes()).toBe(5);
    });

    it('configura, verifica e limpa PIN numérico com hash seguro', async () => {
      expect(hasQuickLockPin()).toBe(false);

      await setQuickLockPin('1234');
      expect(hasQuickLockPin()).toBe(true);

      const isValid = await verifyQuickLockPin('1234');
      expect(isValid).toBe(true);

      const isWrong = await verifyQuickLockPin('9999');
      expect(isWrong).toBe(false);

      clearQuickLockPin();
      expect(hasQuickLockPin()).toBe(false);
    });

    it('rejeita PINs com tamanho menor que 4 dígitos ou caracteres não numéricos', async () => {
      await expect(setQuickLockPin('12')).rejects.toThrow();
      await expect(setQuickLockPin('12ab')).rejects.toThrow();
      await expect(setQuickLockPin('12 34')).rejects.toThrow();
    });

    it('rejeita domínio malformado na allowlist e ignora timeout negativo', () => {
      setAllowedEmailsList(['@endodiagnose.com.br']);
      expect(isEmailAllowed('@endodiagnose.com.br')).toBe(false);
      expect(isEmailAllowed('fake@sub.endodiagnose.com.br')).toBe(false);
      setInactivityTimeoutMinutes(-10);
      expect(getInactivityTimeoutMinutes()).toBe(DEFAULT_INACTIVITY_TIMEOUT_MINS);
    });

    it('gera hashes diferentes com salt para o mesmo PIN e migra hash legado sem salt', async () => {
      await setQuickLockPin('1234');
      const rawHash = await hashString('1234');
      expect(localStorage.getItem('endodiagnose_lock_pin_hash')).not.toBe(rawHash);
      expect(localStorage.getItem('endodiagnose_lock_pin_salt')).toBeTruthy();

      // Simula hash legado sem salt salvo anteriormente
      localStorage.removeItem('endodiagnose_lock_pin_salt');
      localStorage.setItem('endodiagnose_lock_pin_hash', rawHash);

      const isLegacyValid = await verifyQuickLockPin('1234');
      expect(isLegacyValid).toBe(true);
      // Deve ter migrado automaticamente para hash com salt
      expect(localStorage.getItem('endodiagnose_lock_pin_salt')).toBeTruthy();
      expect(localStorage.getItem('endodiagnose_lock_pin_hash')).not.toBe(rawHash);
    });

    it('aplica bloqueio temporário de 30s após 5 tentativas incorretas de PIN', async () => {
      await setQuickLockPin('4321');

      for (let i = 1; i < MAX_PIN_ATTEMPTS; i++) {
        const ok = await verifyQuickLockPin('0000');
        expect(ok).toBe(false);
        expect(getPinLockoutStatus().isLockedOut).toBe(false);
        expect(getPinLockoutStatus().attempts).toBe(i);
      }

      // 5ª tentativa incorreta aciona o lockout
      const fifthTry = await verifyQuickLockPin('0000');
      expect(fifthTry).toBe(false);

      const status = getPinLockoutStatus();
      expect(status.isLockedOut).toBe(true);
      expect(status.remainingSeconds).toBeGreaterThan(0);
      expect(status.remainingSeconds).toBeLessThanOrEqual(PIN_LOCKOUT_DURATION_MS / 1000);

      // Mesmo digitando o PIN correto durante o bloqueio, deve rejeitar
      const validDuringLockout = await verifyQuickLockPin('4321');
      expect(validDuringLockout).toBe(false);

      // Após expirar o tempo de bloqueio, aceita novamente o PIN correto
      const afterExpiry = getPinLockoutStatus(Date.now() + PIN_LOCKOUT_DURATION_MS + 1000);
      expect(afterExpiry.isLockedOut).toBe(false);
      expect(await verifyQuickLockPin('4321')).toBe(true);
    });
  });

  describe('5.3 — Sanitização contra HTML Injection / XSS (escapeHtml)', () => {
    it('escapa caracteres especiais de HTML em títulos e células de impressão', () => {
      const malicious = `<img src=x onerror="alert('xss')"> & 'teste'`;
      const escaped = escapeHtml(malicious);
      expect(escaped).toBe(
        '&lt;img src=x onerror=&quot;alert(&#39;xss&#39;)&quot;&gt; &amp; &#39;teste&#39;'
      );
      expect(escapeHtml(null)).toBe('');
      expect(escapeHtml(undefined)).toBe('');
    });
  });

  describe('6.5 — Lembrete e Rastreamento de Backup', () => {
    it('retorna null quando nenhum backup foi registrado', () => {
      expect(getLastBackupDate()).toBeNull();
      expect(getDaysSinceLastBackup()).toBeNull();
    });

    it('registra e calcula corretamente os dias desde o último backup', () => {
      const now = new Date();
      recordBackupDone(now.toISOString());
      expect(getLastBackupDate()).toBe(now.toISOString());
      expect(getDaysSinceLastBackup()).toBe(0);

      // Simula backup feito há 8 dias
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 8);
      recordBackupDone(pastDate.toISOString());
      expect(getDaysSinceLastBackup()).toBe(8);
    });
  });
});
