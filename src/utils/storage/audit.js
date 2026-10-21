import {
  getData,
  setData,
  notifyDataChanged,
  getAuditUser,
  registerAuditLogger,
} from './core';

/**
 * Adiciona um registro de auditoria no log do sistema.
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
 * Limpa todos os logs de auditoria.
 */
export function clearAuditLogs() {
  try {
    setData('auditLogs', []);
    notifyDataChanged('auditLogs');
  } catch (e) {
    console.error('Clear audit logs error:', e);
  }
}
