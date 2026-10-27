import { getLocalStorage } from '../utils/storage/core';
import { isCloudConfigured, initFirebase, sanitizeForFirestore } from './firebase';

export const PENDING_SYNC_KEY = 'endodiagnose_pending_sync';
export const LAST_SYNC_KEY = 'endodiagnose_last_sync_timestamp';

let isProcessing = false;
let currentSyncPromise = null;
let heartbeatInterval = null;

/**
 * Lê a fila de sincronização pendente do storage local.
 * @returns {Array} Lista de operações pendentes
 */
export function getPendingQueue() {
  const storage = getLocalStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(PENDING_SYNC_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Salva a fila no storage local e emite evento de alteração.
 */
export function savePendingQueue(queue) {
  const storage = getLocalStorage();
  if (!storage) return;
  try {
    storage.setItem(PENDING_SYNC_KEY, JSON.stringify(queue));
    notifySyncStatusChanged();
  } catch (err) {
    console.error('Erro ao salvar fila de pendências de sincronização:', err);
  }
}

/**
 * Emite evento no window para atualização reativa dos badges e componentes.
 */
export function notifySyncStatusChanged() {
  if (typeof window !== 'undefined' && window.dispatchEvent) {
    try {
      window.dispatchEvent(
        new CustomEvent('endodiagnose:sync-status-changed', {
          detail: getSyncStatus(),
        })
      );
    } catch {
      // ignore
    }
  }
}

/**
 * Retorna o status atual de sincronização e rede.
 */
export function getSyncStatus() {
  const isOnline = typeof navigator !== 'undefined' ? Boolean(navigator.onLine) : true;
  const configured = isCloudConfigured();
  const queue = getPendingQueue();
  const storage = getLocalStorage();
  const lastSyncTime = storage ? storage.getItem(LAST_SYNC_KEY) : null;
  const lastError = queue.find((op) => op?.error)?.error || null;

  return {
    isOnline,
    isConfigured: configured,
    isSyncing: isProcessing,
    pendingCount: queue.length,
    pendingItems: queue,
    lastSyncTime,
    lastError,
  };
}

/**
 * Enfileira uma operação de mutação (UPSERT ou DELETE).
 * Aplica coalescência inteligente para o mesmo (module, entityId).
 *
 * @param {object} param
 * @param {string} param.module - Módulo (ex: 'exames', 'fluxoCaixa')
 * @param {string} param.entityId - ID do registro
 * @param {'UPSERT'|'DELETE'} param.type - Tipo de operação
 * @param {object} param.payload - Dados do registro (com updatedAt ou deletedAt)
 */
export function enqueueSyncOperation({ module, entityId, type, payload }) {
  if (!module || !entityId) return;

  const queue = getPendingQueue();
  const nowISO = new Date().toISOString();

  // Verifica se já existe operação pendente para este item
  const existingIdx = queue.findIndex(
    (op) => op.module === module && String(op.entityId) === String(entityId)
  );

  const operation = {
    id: crypto.randomUUID(),
    module,
    entityId: String(entityId),
    type: type || 'UPSERT',
    payload: {
      ...payload,
      id: String(entityId),
      updatedAt: payload?.updatedAt || nowISO,
    },
    timestamp: nowISO,
    attempts: 0,
    lastAttempt: null,
    error: null,
  };

  if (type === 'DELETE') {
    operation.payload._deleted = true;
    operation.payload.deletedAt = payload?.deletedAt || nowISO;
  }

  if (existingIdx !== -1) {
    const existing = queue[existingIdx];
    // Se era UPSERT e agora é DELETE de um item criado offline sem ter ido à nuvem
    operation.attempts = existing.attempts || 0;
    queue[existingIdx] = operation;
  } else {
    queue.push(operation);
  }

  savePendingQueue(queue);

  // Se estiver online e com Firebase ativo, tenta drenar a fila imediatamente
  if (isCloudConfigured() && (typeof navigator === 'undefined' || navigator.onLine)) {
    processPendingQueue().catch(() => {});
  }
}

/**
 * Resolve conflitos de timestamp entre duas versões do mesmo registro.
 *
 * @param {object} localItem - Registro local
 * @param {object} cloudItem - Registro da nuvem
 * @returns {{ winner: 'local'|'cloud', item: object, isDeleted: boolean }}
 */
export function resolveConflict(localItem, cloudItem) {
  if (!localItem && !cloudItem) return { winner: 'local', item: null, isDeleted: false };
  if (!localItem) {
    const isDel = Boolean(cloudItem._deleted || cloudItem.deletedAt);
    return { winner: 'cloud', item: cloudItem, isDeleted: isDel };
  }
  if (!cloudItem) {
    const isDel = Boolean(localItem._deleted || localItem.deletedAt);
    return { winner: 'local', item: localItem, isDeleted: isDel };
  }

  // Verifica tombstones
  const localDeletedTime = localItem.deletedAt ? new Date(localItem.deletedAt).getTime() : 0;
  const cloudDeletedTime = cloudItem.deletedAt ? new Date(cloudItem.deletedAt).getTime() : 0;

  const localUpdatedTime = new Date(localItem.updatedAt || localItem.createdAt || 0).getTime();
  const cloudUpdatedTime = new Date(cloudItem.updatedAt || cloudItem.createdAt || 0).getTime();

  const maxLocalTime = Math.max(localDeletedTime, localUpdatedTime);
  const maxCloudTime = Math.max(cloudDeletedTime, cloudUpdatedTime);

  if (maxLocalTime > maxCloudTime) {
    const isDel = Boolean(localItem._deleted || localItem.deletedAt);
    return { winner: 'local', item: localItem, isDeleted: isDel };
  } else {
    const isDel = Boolean(cloudItem._deleted || cloudItem.deletedAt);
    return { winner: 'cloud', item: cloudItem, isDeleted: isDel };
  }
}

/**
 * Processa as pendências da fila com retry e backoff exponencial.
 * @param {object} [options]
 * @param {boolean} [options.force=false] Se true, ignora o delay de backoff e tenta enviar imediatamente
 * @returns {Promise<{ total: number, processed: number, remaining: number, lastError: string|null }>}
 */
export async function processPendingQueue(options = {}) {
  const { force = false } = options;
  if (!isCloudConfigured()) return { total: 0, processed: 0, remaining: getPendingQueue().length, lastError: null };
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { total: 0, processed: 0, remaining: getPendingQueue().length, lastError: 'Dispositivo offline' };
  }

  // Se já houver sincronização em andamento, aguarda a sua conclusão
  if (currentSyncPromise) {
    return currentSyncPromise;
  }

  currentSyncPromise = (async () => {
    isProcessing = true;
    notifySyncStatusChanged();

    try {
      const instance = await initFirebase();
      if (!instance || !instance.db) {
        return { total: 0, processed: 0, remaining: getPendingQueue().length, lastError: 'Banco Firestore não inicializado' };
      }

      const { db, sdk } = instance;
      const { doc, setDoc, getDoc } = sdk.firestoreMod;

      const queue = getPendingQueue();
      if (queue.length === 0) {
        return { total: 0, processed: 0, remaining: 0, lastError: null };
      }

      const remainingQueue = [];
      const now = Date.now();
      let processedCount = 0;

      for (let i = 0; i < queue.length; i++) {
        const op = queue[i];

        // Se não for forçado, respeita o backoff exponencial
        if (!force && op.lastAttempt && op.attempts > 0) {
          const delay = Math.min(60000, Math.pow(2, op.attempts) * 1000);
          const elapsed = now - new Date(op.lastAttempt).getTime();
          if (elapsed < delay) {
            remainingQueue.push(op);
            continue;
          }
        }

        if (!op.entityId || !op.module) {
          // Entrada corrompida ou sem ID/módulo: descarta para não bloquear a fila indefinidamente
          continue;
        }

        try {
          const docRef = doc(db, op.module, String(op.entityId));

          if (op.type === 'DELETE') {
            const tombstone = sanitizeForFirestore(
              op.payload || { id: String(op.entityId), _deleted: true, deletedAt: new Date().toISOString() }
            );
            await setDoc(docRef, tombstone, { merge: true });
          } else {
            // Verifica versão na nuvem para resolução de conflito
            const cloudSnap = await getDoc(docRef);
            const cloudData = cloudSnap.exists() ? cloudSnap.data() : null;

            if (cloudData) {
              const conflict = resolveConflict(op.payload, cloudData);
              if (conflict.winner === 'cloud') {
                console.warn(
                  `[SyncQueue] Conflito resolvido em favor da nuvem para ${op.module}/${op.entityId}`
                );
                processedCount++;
                continue;
              }
            }

            // Sanitiza para garantir que campos com valor `undefined` não causem erro no Firestore
            const cleanPayload = sanitizeForFirestore(op.payload) || {};
            await setDoc(docRef, cleanPayload, { merge: true });
          }

          processedCount++;
          // Operação bem-sucedida! Não vai para remainingQueue.

          // Notifica progresso a cada 20 itens para a UI atualizar o contador em tempo real
          if (processedCount % 20 === 0) {
            const currentRemaining = [...remainingQueue, ...queue.slice(i + 1)];
            savePendingQueue(currentRemaining);
          }
        } catch (err) {
          console.warn(`[SyncQueue] Falha ao sincronizar ${op.module}/${op.entityId}:`, err);
          op.attempts = (op.attempts || 0) + 1;
          op.lastAttempt = new Date().toISOString();
          op.error = err?.message || String(err);
          remainingQueue.push(op);
        }
      }

      savePendingQueue(remainingQueue);

      // Se a fila esvaziou ou teve progresso, atualiza o timestamp de última sincronização
      const storage = getLocalStorage();
      if (storage) {
        storage.setItem(LAST_SYNC_KEY, new Date().toISOString());
      }

      const lastError = remainingQueue.find((item) => item.error)?.error || null;
      return {
        total: queue.length,
        processed: processedCount,
        remaining: remainingQueue.length,
        lastError,
      };
    } catch (globalErr) {
      console.error('[SyncQueue] Erro global durante processamento da fila:', globalErr);
      return {
        total: 0,
        processed: 0,
        remaining: getPendingQueue().length,
        lastError: globalErr?.message || String(globalErr),
      };
    } finally {
      isProcessing = false;
      currentSyncPromise = null;
      notifySyncStatusChanged();
    }
  })();

  return currentSyncPromise;
}

/**
 * Inicia os listeners automáticos de reconexão e timer de heartbeat.
 */
export function initSyncQueueListeners() {
  if (typeof window === 'undefined') return;

  const handleOnline = () => {
    notifySyncStatusChanged();
    processPendingQueue().catch(() => {});
  };

  const handleOffline = () => {
    notifySyncStatusChanged();
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Heartbeat a cada 30 segundos para drenar pendências com backoff
  if (!heartbeatInterval) {
    heartbeatInterval = setInterval(() => {
      if (typeof navigator !== 'undefined' && navigator.onLine && isCloudConfigured()) {
        const queue = getPendingQueue();
        if (queue.length > 0 && !isProcessing) {
          processPendingQueue().catch(() => {});
        }
      }
    }, 30000);
  }

  // Executa uma tentativa inicial
  if (typeof navigator !== 'undefined' && navigator.onLine && isCloudConfigured()) {
    processPendingQueue().catch(() => {});
  }

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
  };
}

/**
 * Limpa toda a fila de pendências (útil para resets ou descarte manual).
 */
export function clearPendingQueue() {
  const storage = getLocalStorage();
  if (storage) {
    storage.removeItem(PENDING_SYNC_KEY);
    notifySyncStatusChanged();
  }
}

/**
 * Mescla dados baixados da nuvem com os dados locais aplicando resolução de conflito e tombstones.
 *
 * @param {object} cloudData - Objeto { [modulo]: [itens] }
 * @param {function} getDataFn - Função (module) => listaLocal
 * @param {function} setDataFn - Função (module, lista) => void
 * @returns {object} Estatísticas da mesclagem
 */
export function mergeCloudDataWithLocal(cloudData, getDataFn, setDataFn) {
  if (!cloudData || typeof cloudData !== 'object') {
    return { updated: 0, added: 0, deleted: 0, localKept: 0 };
  }

  const stats = { updated: 0, added: 0, deleted: 0, localKept: 0 };

  for (const [module, cloudItems] of Object.entries(cloudData)) {
    if (!Array.isArray(cloudItems)) continue;

    const currentLocal = typeof getDataFn === 'function' ? getDataFn(module) : [];
    const localMap = new Map((currentLocal || []).map((item) => [String(item.id), item]));

    for (const cloudItem of cloudItems) {
      if (!cloudItem || !cloudItem.id) continue;
      const id = String(cloudItem.id);
      const localItem = localMap.get(id);

      const conflict = resolveConflict(localItem, cloudItem);

      if (conflict.isDeleted) {
        if (localMap.has(id)) {
          localMap.delete(id);
          stats.deleted++;
        }
      } else if (conflict.winner === 'cloud') {
        if (localMap.has(id)) {
          stats.updated++;
        } else {
          stats.added++;
        }
        localMap.set(id, conflict.item);
      } else {
        // winner === 'local'
        stats.localKept++;
      }
    }

    if (typeof setDataFn === 'function') {
      setDataFn(module, Array.from(localMap.values()));
    }
  }

  return stats;
}
