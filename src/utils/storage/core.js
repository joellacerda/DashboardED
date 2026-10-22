import { enqueueSyncOperation } from '../../services/syncQueue';

// Nomes dos módulos de dados — use MODULES.x em vez de strings soltas
export const MODULES = Object.freeze({
  exames: 'exames',
  fluxoCaixa: 'fluxoCaixa',
  detalhesExames: 'detalhesExames',
  folhaPagamento: 'folhaPagamento',
  medicos: 'medicos',
  repassesAjustes: 'repassesAjustes',
  examesConvenio: 'examesConvenio',
  cronogramaSalas: 'cronogramaSalas',
  salasConfig: 'salasConfig',
  auditLogs: 'auditLogs',
});

export const STORAGE_KEYS = Object.freeze({
  exames: 'endodiagnose_exames',
  fluxoCaixa: 'endodiagnose_fluxo_caixa',
  detalhesExames: 'endodiagnose_detalhes_exames',
  folhaPagamento: 'endodiagnose_folha_pagamento',
  medicos: 'endodiagnose_medicos',
  repassesAjustes: 'endodiagnose_repasses_ajustes',
  examesConvenio: 'endodiagnose_exames_convenio',
  cronogramaSalas: 'endodiagnose_cronograma_salas',
  salasConfig: 'endodiagnose_salas_config',
  auditLogs: 'endodiagnose_audit_logs',
});

export const MODULE_KEYS = Object.freeze(Object.keys(STORAGE_KEYS));

// Usuário atual usado nos registros de auditoria
let _auditUser = 'Usuário Local';

export function setAuditUser(name) {
  _auditUser = name || 'Usuário Local';
}

export function getAuditUser() {
  return _auditUser;
}

// ==========================================
// CACHE EM MEMÓRIA (Item 4.2)
// Evita JSON.parse redundante a cada leitura
// ==========================================
const memoryCache = new Map();

/**
 * Limpa o cache em memória de um módulo específico ou de todos.
 */
export function clearMemoryCache(module) {
  if (module) {
    memoryCache.delete(module);
  } else {
    memoryCache.clear();
  }
}

// Invalidação reativa quando o storage é alterado por outra aba
if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('storage', (e) => {
    if (e && e.key) {
      const matchedMod = Object.keys(STORAGE_KEYS).find((m) => STORAGE_KEYS[m] === e.key);
      if (matchedMod) {
        memoryCache.delete(matchedMod);
      } else if (e.key.startsWith('endodiagnose_')) {
        memoryCache.clear();
      }
    }
  });
}

/**
 * Dispara evento CustomEvent no window para sincronização entre componentes.
 */
export function notifyDataChanged(module) {
  if (typeof window !== 'undefined' && window.dispatchEvent) {
    try {
      window.dispatchEvent(new CustomEvent('endodiagnose:data-updated', { detail: { module } }));
    } catch {
      // ignore
    }
  }
}

export function getLocalStorage() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
      return globalThis.localStorage;
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Obtém os dados de um módulo, utilizando cache em memória para máxima performance.
 */
export function getData(module) {
  if (memoryCache.has(module)) {
    const cached = memoryCache.get(module);
    return Array.isArray(cached) ? [...cached] : cached;
  }

  try {
    const storage = getLocalStorage();
    if (!storage) return [];
    const storageKey = STORAGE_KEYS[module];
    if (!storageKey) return [];
    const raw = storage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : [];
    const result = Array.isArray(parsed) ? parsed : [];
    memoryCache.set(module, result);
    return Array.isArray(result) ? [...result] : result;
  } catch {
    return [];
  }
}

/**
 * Grava dados de um módulo no localStorage e sincroniza o cache em memória.
 */
export function setData(module, data) {
  try {
    const normalized = Array.isArray(data) ? [...data] : data;
    memoryCache.set(module, normalized);

    const storage = getLocalStorage();
    if (storage) {
      const storageKey = STORAGE_KEYS[module];
      if (storageKey) {
        storage.setItem(storageKey, JSON.stringify(normalized));
      }
    }
    notifyDataChanged(module);
  } catch (err) {
    if (
      err &&
      (err.name === 'QuotaExceededError' ||
        err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
        err.code === 22 ||
        err.code === 1014)
    ) {
      console.error(`[Storage] Limite de armazenamento atingido ao salvar '${module}':`, err);
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        window.dispatchEvent(
          new CustomEvent('endodiagnose:storage-quota-exceeded', {
            detail: { module, error: err },
          })
        );
      }
    }
    throw err;
  }
}

/**
 * Retorna todos os dados de todos os módulos.
 */
export function getAllData() {
  const result = {};
  MODULE_KEYS.forEach((m) => {
    result[m] = getData(m);
  });
  return result;
}

/**
 * Busca um registro pelo id.
 */
export function getItem(module, id) {
  const data = getData(module);
  return data.find((item) => String(item.id) === String(id)) || null;
}

// Injeção de dependência flexível para evitar dependência circular com audit.js
let _auditLogger = null;
export function registerAuditLogger(fn) {
  _auditLogger = fn;
}

function internalAudit(entry) {
  if (typeof _auditLogger === 'function') {
    try {
      _auditLogger(entry);
    } catch {
      // ignore
    }
  }
}

/**
 * Cria um novo registro em um módulo, salva no cloud e registra auditoria.
 */
export function addItem(module, item) {
  const data = getData(module);
  const now = new Date().toISOString();
  const newItem = {
    ...item,
    id: item.id || crypto.randomUUID(),
    createdAt: item.createdAt || now,
    updatedAt: item.updatedAt || now,
  };
  data.push(newItem);
  setData(module, data);
  enqueueSyncOperation({ module, entityId: newItem.id, type: 'UPSERT', payload: newItem });

  if (module !== 'auditLogs') {
    const desc = newItem.paciente
      ? `Paciente: ${newItem.paciente} (${newItem.exame || newItem.tipoExame || module})`
      : newItem.nome
        ? `${newItem.nome}`
        : `Registro ${newItem.id}`;
    internalAudit({
      acao: 'CRIAR',
      modulo: module,
      descricao: `Adicionado em ${module}: ${desc}`,
      detalhes: { id: newItem.id },
      usuario: _auditUser,
    });
  }
  return newItem;
}

/**
 * Atualiza um registro existente, salva no cloud e registra auditoria.
 */
export function updateItem(module, id, updates) {
  const data = getData(module);
  const index = data.findIndex((item) => String(item.id) === String(id));
  if (index === -1) return null;
  const oldItem = data[index];
  const now = new Date().toISOString();
  data[index] = { ...oldItem, ...updates, updatedAt: now };
  setData(module, data);
  enqueueSyncOperation({ module, entityId: id, type: 'UPSERT', payload: data[index] });

  if (module !== 'auditLogs') {
    const desc = oldItem.paciente
      ? `Paciente: ${oldItem.paciente}`
      : oldItem.nome
        ? `${oldItem.nome}`
        : `ID: ${id}`;
    internalAudit({
      acao: 'EDITAR',
      modulo: module,
      descricao: `Atualizado em ${module}: ${desc}`,
      detalhes: { id, updates: Object.keys(updates) },
      usuario: _auditUser,
    });
  }
  return data[index];
}

/**
 * Exclui um registro existente, remove do cloud e registra auditoria.
 */
export function deleteItem(module, id) {
  const data = getData(module);
  const oldItem = data.find((item) => String(item.id) === String(id));
  const filtered = data.filter((item) => String(item.id) !== String(id));
  const now = new Date().toISOString();
  const tombstone = {
    id,
    _deleted: true,
    deletedAt: now,
    updatedAt: now,
  };
  setData(module, filtered);
  enqueueSyncOperation({ module, entityId: id, type: 'DELETE', payload: tombstone });

  if (module !== 'auditLogs') {
    const desc = oldItem?.paciente
      ? `Paciente: ${oldItem.paciente}`
      : oldItem?.nome
        ? `${oldItem.nome}`
        : `ID: ${id}`;
    internalAudit({
      acao: 'EXCLUIR',
      modulo: module,
      descricao: `Excluído de ${module}: ${desc}`,
      detalhes: { id },
      usuario: _auditUser,
    });
  }
  return filtered;
}

/**
 * Restaura todos os dados de um objeto de backup.
 */
export function restoreAllData(allData) {
  if (!allData || typeof allData !== 'object') return;
  const payload = allData.backupCompletoDeTodasAsColecoes || allData.dados || allData;
  MODULE_KEYS.forEach((m) => {
    if (Array.isArray(payload[m])) {
      setData(m, payload[m]);
    }
  });
  internalAudit({
    acao: 'RESTAURAR',
    modulo: 'sistema',
    descricao: 'Restauração de backup completo executada com sucesso',
    detalhes: { data: new Date().toISOString() },
    usuario: _auditUser,
  });
}
