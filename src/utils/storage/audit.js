import {
  getData,
  setData,
  notifyDataChanged,
  getAuditUser,
  registerAuditLogger,
} from './core';
import { enqueueSyncOperation } from '../../services/syncQueue';

/**
 * Adiciona um registro de auditoria no log do sistema (local e nuvem).
 * Conformidade LGPD: Append-only imutável.
 */
export function addAuditLog(entry) {
  try {
    const logs = getData('auditLogs') || [];
    const newEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      acao: entry.acao || 'MODIFICAÇÃO',
      modulo: entry.modulo || 'geral',
      descricao: entry.descricao || '',
      detalhes: entry.detalhes || null,
      usuario: entry.usuario || getAuditUser(),
    };
    logs.unshift(newEntry);
    if (logs.length > 500) {
      logs.length = 500;
    }
    setData('auditLogs', logs);

    // Envia cópia para a coleção de auditoria na nuvem de forma append-only
    try {
      enqueueSyncOperation({
        module: 'auditLogs',
        entityId: newEntry.id,
        type: 'UPSERT',
        payload: newEntry,
      });
    } catch {
      // Ignora falha de enfileiramento se estiver em ambiente isolado
    }

    return newEntry;
  } catch (e) {
    console.error('Audit log error:', e);
    return null;
  }
}

// Registra a função no core para que operações CRUD utilizem auditoria automaticamente
registerAuditLogger(addAuditLog);

/**
 * Obtém todos os registros de auditoria ordenados do mais recente para o mais antigo.
 */
export function getAuditLogs() {
  try {
    return getData('auditLogs') || [];
  } catch {
    return [];
  }
}

/**
 * Limpa o cache local de visualização de logs no navegador.
 * Os logs imutáveis na nuvem permanecem preservados para fins de conformidade LGPD.
 */
export function clearAuditLogs() {
  try {
    const resetEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      acao: 'LIMPEZA_CACHE_LOCAL',
      modulo: 'auditLogs',
      descricao: 'Cache local de visualização de auditoria limpo no navegador.',
      usuario: getAuditUser(),
    };
    setData('auditLogs', [resetEntry]);
    notifyDataChanged('auditLogs');

    try {
      enqueueSyncOperation({
        module: 'auditLogs',
        entityId: resetEntry.id,
        type: 'UPSERT',
        payload: resetEntry,
      });
    } catch {
      // Ignora falha em ambiente isolado
    }
  } catch (e) {
    console.error('Clear audit logs error:', e);
  }
}
