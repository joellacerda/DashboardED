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
  recordBackupDone,
  getLastBackupDate,
  getDaysSinceLastBackup,
} from './security';

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

    it('rejeita PINs com tamanho menor que 4 dígitos', async () => {
      await expect(setQuickLockPin('12')).rejects.toThrow();
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
