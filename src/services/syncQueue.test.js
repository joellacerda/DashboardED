import { describe, it, expect, beforeEach } from 'vitest';
import {
  enqueueSyncOperation,
  getPendingQueue,
  clearPendingQueue,
  resolveConflict,
  mergeCloudDataWithLocal,
} from './syncQueue';

// Mock de localStorage em memória
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

describe('SyncQueue — Fase 5: Sincronização em Nuvem Confiável', () => {
  beforeEach(() => {
    mockStorage.clear();
    clearPendingQueue();
  });

  describe('5.1 — Fila de Operações Pendentes (enqueue & coalescing)', () => {
    it('enfileira uma operação UPSERT com payload e timestamp', () => {
      enqueueSyncOperation({
        module: 'pacientes',
        entityId: 'pac-1',
        type: 'UPSERT',
        payload: { nome: 'João da Silva', convenio: 'Unimed' },
      });

      const queue = getPendingQueue();
      expect(queue.length).toBe(1);
      expect(queue[0].module).toBe('pacientes');
      expect(queue[0].entityId).toBe('pac-1');
      expect(queue[0].type).toBe('UPSERT');
      expect(queue[0].payload.nome).toBe('João da Silva');
      expect(queue[0].payload.id).toBe('pac-1');
      expect(queue[0].attempts).toBe(0);
    });

    it('faz coalescing inteligente: substitui operação anterior do mesmo registro', () => {
      // 1ª operação
      enqueueSyncOperation({
        module: 'pacientes',
        entityId: 'pac-1',
        type: 'UPSERT',
        payload: { nome: 'João da Silva', status: 'pendente' },
      });

      // 2ª operação no mesmo id
      enqueueSyncOperation({
        module: 'pacientes',
        entityId: 'pac-1',
        type: 'UPSERT',
        payload: { nome: 'João Silva Santos', status: 'concluído' },
      });

      const queue = getPendingQueue();
      expect(queue.length).toBe(1);
      expect(queue[0].payload.nome).toBe('João Silva Santos');
      expect(queue[0].payload.status).toBe('concluído');
    });

    it('enfileira operação DELETE marcando tombstone com _deleted e deletedAt', () => {
      enqueueSyncOperation({
        module: 'consultas',
        entityId: 'cons-99',
        type: 'DELETE',
        payload: { id: 'cons-99' },
      });

      const queue = getPendingQueue();
      expect(queue.length).toBe(1);
      expect(queue[0].type).toBe('DELETE');
      expect(queue[0].payload._deleted).toBe(true);
      expect(queue[0].payload.deletedAt).toBeDefined();
    });

    it('limpa toda a fila com clearPendingQueue()', () => {
      enqueueSyncOperation({ module: 'exames', entityId: 'ex-1', type: 'UPSERT', payload: {} });
      enqueueSyncOperation({ module: 'exames', entityId: 'ex-2', type: 'UPSERT', payload: {} });

      expect(getPendingQueue().length).toBe(2);
      clearPendingQueue();
      expect(getPendingQueue().length).toBe(0);
    });
  });

  describe('5.2 — Resolução de Conflitos (LWW & Tombstones)', () => {
    it('retorna a versão mais recente com base no updatedAt (LWW)', () => {
      const localItem = {
        id: 'item-1',
        nome: 'Versão Local Antiga',
        updatedAt: '2026-01-01T10:00:00.000Z',
      };
      const cloudItem = {
        id: 'item-1',
        nome: 'Versão Cloud Recente',
        updatedAt: '2026-01-02T10:00:00.000Z',
      };

      const result = resolveConflict(localItem, cloudItem);
      expect(result.winner).toBe('cloud');
      expect(result.item.nome).toBe('Versão Cloud Recente');
      expect(result.isDeleted).toBe(false);
    });

    it('mantém a versão local se ela for mais recente que a da nuvem', () => {
      const localItem = {
        id: 'item-1',
        nome: 'Edição Offline Recente',
        updatedAt: '2026-02-01T12:00:00.000Z',
      };
      const cloudItem = {
        id: 'item-1',
        nome: 'Versão Cloud Antiga',
        updatedAt: '2026-01-15T08:00:00.000Z',
      };

      const result = resolveConflict(localItem, cloudItem);
      expect(result.winner).toBe('local');
      expect(result.item.nome).toBe('Edição Offline Recente');
      expect(result.isDeleted).toBe(false);
    });

    it('respeita tombstone mais recente e sinaliza isDeleted', () => {
      const localItem = {
        id: 'item-1',
        nome: 'Ativo Local',
        updatedAt: '2026-01-10T10:00:00.000Z',
      };
      const cloudItem = {
        id: 'item-1',
        _deleted: true,
        deletedAt: '2026-01-15T15:00:00.000Z',
        updatedAt: '2026-01-15T15:00:00.000Z',
      };

      const result = resolveConflict(localItem, cloudItem);
      expect(result.winner).toBe('cloud');
      expect(result.isDeleted).toBe(true);
    });
  });

  describe('5.3 — Mesclagem Bidirecional de Dados (mergeCloudDataWithLocal)', () => {
    it('adiciona novos registros vindos da nuvem que não existem localmente', () => {
      const localDataStore = {
        pacientes: [{ id: 'pac-1', nome: 'Paciente Local' }],
      };

      const getDataFn = (mod) => localDataStore[mod] || [];
      const setDataFn = (mod, data) => {
        localDataStore[mod] = data;
      };

      const cloudData = {
        pacientes: [
          { id: 'pac-2', nome: 'Paciente Novo da Nuvem', updatedAt: '2026-02-01T10:00:00.000Z' },
        ],
      };

      const stats = mergeCloudDataWithLocal(cloudData, getDataFn, setDataFn);
      expect(stats.added).toBe(1);
      expect(localDataStore.pacientes.length).toBe(2);
      expect(localDataStore.pacientes.find((p) => p.id === 'pac-2')).toBeDefined();
    });

    it('atualiza registro local se a nuvem tiver versão mais recente', () => {
      const localDataStore = {
        pacientes: [
          { id: 'pac-1', nome: 'Nome Antigo', updatedAt: '2026-01-01T10:00:00.000Z' },
        ],
      };

      const getDataFn = (mod) => localDataStore[mod] || [];
      const setDataFn = (mod, data) => {
        localDataStore[mod] = data;
      };

      const cloudData = {
        pacientes: [
          { id: 'pac-1', nome: 'Nome Atualizado na Nuvem', updatedAt: '2026-01-05T10:00:00.000Z' },
        ],
      };

      const stats = mergeCloudDataWithLocal(cloudData, getDataFn, setDataFn);
      expect(stats.updated).toBe(1);
      expect(localDataStore.pacientes[0].nome).toBe('Nome Atualizado na Nuvem');
    });

    it('exclui registro local se a nuvem tiver tombstone com timestamp mais recente', () => {
      const localDataStore = {
        exames: [
          { id: 'ex-1', paciente: 'Fulano', updatedAt: '2026-01-01T10:00:00.000Z' },
          { id: 'ex-2', paciente: 'Ciclano', updatedAt: '2026-01-01T10:00:00.000Z' },
        ],
      };

      const getDataFn = (mod) => localDataStore[mod] || [];
      const setDataFn = (mod, data) => {
        localDataStore[mod] = data;
      };

      const cloudData = {
        exames: [
          {
            id: 'ex-1',
            _deleted: true,
            deletedAt: '2026-01-02T10:00:00.000Z',
            updatedAt: '2026-01-02T10:00:00.000Z',
          },
        ],
      };

      const stats = mergeCloudDataWithLocal(cloudData, getDataFn, setDataFn);
      expect(stats.deleted).toBe(1);
      expect(localDataStore.exames.length).toBe(1);
      expect(localDataStore.exames[0].id).toBe('ex-2');
    });
  });
});
