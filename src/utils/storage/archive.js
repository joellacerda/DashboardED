import {
  getData,
  setData,
  getAllData,
  MODULE_KEYS,
  STORAGE_KEYS,
  notifyDataChanged,
} from './core';
import { addAuditLog } from './audit';
import { deleteFromCloud } from '../../services/firebase';

export const ESTIMATED_LOCALSTORAGE_QUOTA_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Formata bytes em formato legível (B, KB, MB, GB).
 */
export function formatBytes(bytes, decimals = 1) {
  if (bytes === 0 || !bytes || isNaN(bytes)) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export const MODULE_LABELS = Object.freeze({
  exames: 'Exames Particulares',
  detalhesExames: 'Detalhes Financeiros',
  examesConvenio: 'Exames de Convênio',
  fluxoCaixa: 'Fluxo de Caixa',
  folhaPagamento: 'Folha de Pagamento',
  medicos: 'Cadastro de Médicos',
  repassesAjustes: 'Ajustes de Repasse',
  cronogramaSalas: 'Cronograma de Salas',
  salasConfig: 'Configurações de Salas',
  auditLogs: 'Histórico de Atividades',
});

/**
 * Calcula detalhadamente o uso do localStorage no domínio atual.
 */
export function getStorageUsageInfo() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return {
      totalBytes: 0,
      formattedTotal: '0 B',
      quotaBytes: ESTIMATED_LOCALSTORAGE_QUOTA_BYTES,
      formattedQuota: formatBytes(ESTIMATED_LOCALSTORAGE_QUOTA_BYTES),
      usedPercentage: 0,
      status: 'healthy',
      collections: [],
      totalRecords: 0,
    };
  }

  let totalBytes = 0;
  const moduleSizes = [];
  const recognizedKeys = new Set(Object.values(STORAGE_KEYS));

  // 1. Analisa cada coleção do sistema
  MODULE_KEYS.forEach((mod) => {
    const storageKey = STORAGE_KEYS[mod];
    const raw = localStorage.getItem(storageKey);
    let bytes = 0;
    let count = 0;

    if (raw !== null) {
      bytes = (storageKey.length + raw.length) * 2;
      totalBytes += bytes;
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          count = parsed.length;
        } else if (parsed && typeof parsed === 'object') {
          count = Object.keys(parsed).length;
        }
      } catch {
        count = 0;
      }
    }

    moduleSizes.push({
      module: mod,
      key: storageKey,
      name: MODULE_LABELS[mod] || mod,
      bytes,
      formattedSize: formatBytes(bytes),
      count,
      canArchive: ['exames', 'detalhesExames', 'examesConvenio', 'fluxoCaixa'].includes(mod),
    });
  });

  // 2. Chaves adicionais (ex.: config Firebase, flags de login ou cache)
  let otherBytes = 0;
  let otherKeysCount = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (!recognizedKeys.has(k)) {
        const v = localStorage.getItem(k) || '';
        const b = (k.length + v.length) * 2;
        otherBytes += b;
        totalBytes += b;
        otherKeysCount++;
      }
    }
  } catch {
    // ignora erros de acesso a chaves
  }

  if (otherBytes > 0) {
    moduleSizes.push({
      module: 'outros',
      key: 'outros',
      name: 'Configurações & Chaves de Nuvem',
      bytes: otherBytes,
      formattedSize: formatBytes(otherBytes),
      count: otherKeysCount,
      canArchive: false,
    });
  }

  moduleSizes.sort((a, b) => b.bytes - a.bytes);

  const quotaBytes = ESTIMATED_LOCALSTORAGE_QUOTA_BYTES;
  const usedPercentage = Math.min(100, (totalBytes / quotaBytes) * 100);

  let status = 'healthy';
  if (usedPercentage >= 85) {
    status = 'critical';
  } else if (usedPercentage >= 70) {
    status = 'warning';
  }

  return {
    totalBytes,
    formattedTotal: formatBytes(totalBytes),
    quotaBytes,
    formattedQuota: formatBytes(quotaBytes),
    usedPercentage: Number(usedPercentage.toFixed(1)),
    status,
    collections: moduleSizes,
    totalRecords: moduleSizes.reduce((s, m) => s + (m.count || 0), 0),
  };
}

/**
 * Pré-visualiza o impacto do arquivamento de registros anteriores a uma data de corte.
 */
export function previewArchiveData(cutoffDate) {
  if (!cutoffDate) return null;

  const targetModules = ['exames', 'detalhesExames', 'examesConvenio', 'fluxoCaixa'];
  const preview = {
    cutoffDate,
    totalArchived: 0,
    totalRemaining: 0,
    estimatedFreedBytes: 0,
    modules: {},
  };

  targetModules.forEach((mod) => {
    const list = getData(mod) || [];
    const toArchive = [];
    const toKeep = [];

    list.forEach((item) => {
      if (item && item.data && item.data < cutoffDate) {
        toArchive.push(item);
      } else {
        toKeep.push(item);
      }
    });

    const archivedBytes = toArchive.length > 0 ? JSON.stringify(toArchive).length * 2 : 0;

    preview.modules[mod] = {
      name: MODULE_LABELS[mod] || mod,
      totalCount: list.length,
      archiveCount: toArchive.length,
      keepCount: toKeep.length,
      archivedBytes,
      formattedArchivedBytes: formatBytes(archivedBytes),
    };

    preview.totalArchived += toArchive.length;
    preview.totalRemaining += toKeep.length;
    preview.estimatedFreedBytes += archivedBytes;
  });

  preview.formattedFreedBytes = formatBytes(preview.estimatedFreedBytes);
  return preview;
}

/**
 * Realiza o arquivamento seguro e expurgo de dados anteriores a uma data de corte.
 */
export async function archiveAndPurgeData(cutoffDate) {
  if (!cutoffDate) {
    throw new Error('Data de corte é obrigatória para o arquivamento.');
  }

  const targetModules = ['exames', 'detalhesExames', 'examesConvenio', 'fluxoCaixa'];
  const archivedRecords = {};
  const remainingRecords = {};
  const idsToDeleteFromCloud = {};
  let totalArchivedCount = 0;

  targetModules.forEach((mod) => {
    const list = getData(mod) || [];
    const toArchive = [];
    const toKeep = [];

    list.forEach((item) => {
      if (item && item.data && item.data < cutoffDate) {
        toArchive.push(item);
      } else {
        toKeep.push(item);
      }
    });

    archivedRecords[mod] = toArchive;
    remainingRecords[mod] = toKeep;
    idsToDeleteFromCloud[mod] = toArchive.map((item) => item.id).filter(Boolean);
    totalArchivedCount += toArchive.length;
  });

  if (totalArchivedCount === 0) {
    return {
      success: true,
      message: 'Nenhum registro anterior à data especificada foi encontrado para arquivamento.',
      totalArchived: 0,
      freedBytes: 0,
      formattedFreedBytes: '0 B',
    };
  }

  // 1. Download do backup de segurança obrigatório
  const fullBackup = getAllData();
  const backupPayload = {
    tipo: 'backup_endodiagnose_pre_expurgo',
    versao: '1.0',
    dataExecucao: new Date().toISOString(),
    dataCorte: cutoffDate,
    aviso: `Arquivo de segurança gerado automaticamente antes do expurgo de registros anteriores a ${cutoffDate}.`,
    resumoExpurgo: {
      totalRegistrosArquivados: totalArchivedCount,
      porModulo: Object.fromEntries(
        Object.entries(archivedRecords).map(([k, v]) => [k, v.length])
      ),
    },
    dadosArquivados: archivedRecords,
    backupCompletoDeTodasAsColecoes: fullBackup,
  };

  const backupJsonString = JSON.stringify(backupPayload, null, 2);
  const freedBytes = JSON.stringify(archivedRecords).length * 2;
  const cleanCutoff = String(cutoffDate).replace(/[^0-9]/g, '');
  const backupFileName = `backup_endodiagnose_pre_expurgo_${cleanCutoff}_${Date.now()}.json`;

  try {
    const blob = new Blob([backupJsonString], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', backupFileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (downloadErr) {
    console.error('Falha ao disparar download do backup pré-expurgo:', downloadErr);
    throw new Error('Não foi possível gerar e baixar o arquivo de backup de segurança. O expurgo foi cancelado para evitar perda de dados.');
  }

  // 2. Salvar dados filtrados no localStorage
  targetModules.forEach((mod) => {
    setData(mod, remainingRecords[mod]);
  });

  // 3. Excluir da nuvem se conectado
  try {
    for (const mod of targetModules) {
      const ids = idsToDeleteFromCloud[mod];
      for (const id of ids) {
        deleteFromCloud(mod, id);
      }
    }
  } catch (cloudErr) {
    console.warn('Aviso: erro ao sincronizar deleção na nuvem:', cloudErr);
  }

  // 4. Log de auditoria e notificação
  addAuditLog({
    acao: 'ARQUIVAR',
    modulo: 'sistema',
    descricao: `Expurgo executado: ${totalArchivedCount} registros anteriores a ${cutoffDate} foram arquivados com backup`,
    detalhes: { cutoffDate, totalArchived: totalArchivedCount, backupFileName },
  });

  notifyDataChanged();

  return {
    success: true,
    totalArchived: totalArchivedCount,
    freedBytes,
    formattedFreedBytes: formatBytes(freedBytes),
    backupFileName,
    archivedByModule: Object.fromEntries(
      Object.entries(archivedRecords).map(([k, v]) => [k, v.length])
    ),
  };
}

/**
 * Exporta todos os dados do sistema em formato JSON para download manual.
 */
export function exportAllDataAsJSON() {
  const all = getAllData();
  const payload = {
    tipo: 'backup_endodiagnose_completo',
    dataExportacao: new Date().toISOString(),
    dados: all,
  };
  const str = JSON.stringify(payload, null, 2);
  const blob = new Blob([str], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `backup_endodiagnose_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
