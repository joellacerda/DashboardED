// Storage utility for Clínica Endodiagnose Dashboard
// Uses localStorage for persistence with optional Firebase Cloud Firestore synchronization
import { saveToCloud, deleteFromCloud } from '../services/firebase';

const STORAGE_KEYS = {
  exames: 'endodiagnose_exames',
  fluxoCaixa: 'endodiagnose_fluxo_caixa',
  detalhesExames: 'endodiagnose_detalhes_exames',
  folhaPagamento: 'endodiagnose_folha_pagamento',
  medicos: 'endodiagnose_medicos',
  repassesAjustes: 'endodiagnose_repasses_ajustes',
  examesConvenio: 'endodiagnose_exames_convenio',
  cronogramaSalas: 'endodiagnose_cronograma_salas',
  salasConfig: 'endodiagnose_salas_config',
};

// Automatic migration for legacy values in localStorage
function migrateLegacyData() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;

    // Migrate in medicos (convert doctor names to uppercase)
    const rawMedicos = localStorage.getItem(STORAGE_KEYS.medicos);
    if (rawMedicos) {
      const parsed = JSON.parse(rawMedicos);
      let changed = false;
      const updated = parsed.map((m) => {
        if (m.nome && m.nome !== m.nome.toUpperCase()) {
          changed = true;
          const up = { ...m, nome: m.nome.toUpperCase() };
          saveToCloud('medicos', up);
          return up;
        }
        return m;
      });
      if (changed) {
        localStorage.setItem(STORAGE_KEYS.medicos, JSON.stringify(updated));
      }
    }

    // Migrate in examesConvenio
    const rawConvenios = localStorage.getItem(STORAGE_KEYS.examesConvenio);
    if (rawConvenios) {
      const parsed = JSON.parse(rawConvenios);
      let changed = false;
      const PROC_COMPL_CONV = ['POLIPECTOMIA', 'MUCOSECTOMIA'];
      const updated = parsed.map((item) => {
        let itemChanged = false;
        let cItem = { ...item };
        if (cItem.convenio === 'BRADESCO 421715') {
          cItem.convenio = 'BRADESCO';
          itemChanged = true;
        }
        if (cItem.medico && cItem.medico !== cItem.medico.toUpperCase()) {
          cItem.medico = cItem.medico.toUpperCase();
          itemChanged = true;
        }
        if (cItem.paciente && cItem.paciente !== cItem.paciente.toUpperCase()) {
          cItem.paciente = cItem.paciente.toUpperCase();
          itemChanged = true;
        }
        // Clear exam type if it was a standalone complementary procedure
        if (cItem.exame && PROC_COMPL_CONV.includes(cItem.exame.trim().toUpperCase())) {
          cItem.exame = '';
          itemChanged = true;
        }
        if (itemChanged) {
          changed = true;
          saveToCloud('examesConvenio', cItem);
          return cItem;
        }
        return item;
      });
      if (changed) {
        localStorage.setItem(STORAGE_KEYS.examesConvenio, JSON.stringify(updated));
      }
    }

    // Migrate in fluxoCaixa
    const rawFluxo = localStorage.getItem(STORAGE_KEYS.fluxoCaixa);
    if (rawFluxo) {
      const parsed = JSON.parse(rawFluxo);
      let changed = false;
      const updated = parsed.map((item) => {
        let itemChanged = false;
        let cItem = { ...item };
        if (cItem.nome && cItem.nome.includes('BRADESCO 421715')) {
          cItem.nome = cItem.nome.replaceAll('BRADESCO 421715', 'BRADESCO');
          itemChanged = true;
        }
        // Normalize Taxa Clínica / Biópsia / Valor de Acessórios / Repasse Convênio to uppercase
        if (cItem.nome) {
          let newNome = cItem.nome;
          if (/^taxa\s+(de\s+)?cl[ií]nica\s*—\s*/i.test(newNome)) {
            newNome = newNome.replace(/^taxa\s+(de\s+)?cl[ií]nica\s*—\s*/i, 'TAXA DE CLÍNICA — ');
          }
          if (/^bi[oó]psia\s*—\s*/i.test(newNome)) {
            newNome = newNome.replace(/^bi[oó]psia\s*—\s*/i, 'BIÓPSIA — ');
          }
          if (/^valor\s+de\s+acess[oó]rios\s*—\s*/i.test(newNome)) {
            newNome = newNome.replace(/^valor\s+de\s+acess[oó]rios\s*—\s*/i, 'VALOR DE ACESSÓRIOS — ');
          }
          if (/^repasse\s+conv[eê]nio\s*/i.test(newNome)) {
            newNome = newNome.replace(/^repasse\s+conv[eê]nio\s*/i, 'REPASSE CONVÊNIO ');
          }
          if (newNome !== cItem.nome) {
            cItem.nome = newNome;
            itemChanged = true;
          }
        }
        if (itemChanged) {
          changed = true;
          saveToCloud('fluxoCaixa', cItem);
          return cItem;
        }
        return item;
      });
      if (changed) {
        localStorage.setItem(STORAGE_KEYS.fluxoCaixa, JSON.stringify(updated));
      }
    }

    // Migrate in exames — clear exam type for standalone POLIPECTOMIA/MUCOSECTOMIA
    const rawExames = localStorage.getItem(STORAGE_KEYS.exames);
    if (rawExames) {
      const parsed = JSON.parse(rawExames);
      let changed = false;
      const PROC_COMPLEMENTARES = ['POLIPECTOMIA', 'MUCOSECTOMIA'];
      const updated = parsed.map((item) => {
        let itemChanged = false;
        let cItem = { ...item };
        if (cItem.convenio === 'BRADESCO 421715') {
          cItem.convenio = 'BRADESCO';
          itemChanged = true;
        }
        if (cItem.medico && cItem.medico !== cItem.medico.toUpperCase()) {
          cItem.medico = cItem.medico.toUpperCase();
          itemChanged = true;
        }
        if (cItem.paciente && cItem.paciente !== cItem.paciente.toUpperCase()) {
          cItem.paciente = cItem.paciente.toUpperCase();
          itemChanged = true;
        }
        // Clear exam type if it was a standalone complementary procedure
        if (cItem.exame && PROC_COMPLEMENTARES.includes(cItem.exame.trim().toUpperCase())) {
          cItem.exame = '';
          itemChanged = true;
        }
        if (itemChanged) {
          changed = true;
          saveToCloud('exames', cItem);
          return cItem;
        }
        return item;
      });
      if (changed) {
        localStorage.setItem(STORAGE_KEYS.exames, JSON.stringify(updated));
      }
    }

    // Migrate in detalhesExames
    const rawDetalhes = localStorage.getItem(STORAGE_KEYS.detalhesExames);
    if (rawDetalhes) {
      const parsed = JSON.parse(rawDetalhes);
      let changed = false;
      const PROC_COMPL_DET = ['POLIPECTOMIA', 'MUCOSECTOMIA'];
      const updated = parsed.map((item) => {
        let itemChanged = false;
        let cItem = { ...item };
        if (cItem.medico && cItem.medico !== cItem.medico.toUpperCase()) {
          cItem.medico = cItem.medico.toUpperCase();
          itemChanged = true;
        }
        if (cItem.medico2 && cItem.medico2 !== cItem.medico2.toUpperCase()) {
          cItem.medico2 = cItem.medico2.toUpperCase();
          itemChanged = true;
        }
        if (cItem.paciente && cItem.paciente !== cItem.paciente.toUpperCase()) {
          cItem.paciente = cItem.paciente.toUpperCase();
          itemChanged = true;
        }
        // Clear exam type if it was a standalone complementary procedure
        if (cItem.tipoExame && PROC_COMPL_DET.includes(cItem.tipoExame.trim().toUpperCase())) {
          cItem.tipoExame = '';
          itemChanged = true;
        }
        if (itemChanged) {
          changed = true;
          saveToCloud('detalhesExames', cItem);
          return cItem;
        }
        return item;
      });
      if (changed) {
        localStorage.setItem(STORAGE_KEYS.detalhesExames, JSON.stringify(updated));
      }
    }
  } catch (err) {
    console.error('Migration error:', err);
  }
}

migrateLegacyData();

export function getData(module) {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS[module]);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function notifyDataChanged(module) {
  if (typeof window !== 'undefined' && window.dispatchEvent) {
    try {
      window.dispatchEvent(new CustomEvent('endodiagnose:data-updated', { detail: { module } }));
    } catch {
      // ignore
    }
  }
}

export function setData(module, data) {
  try {
    localStorage.setItem(STORAGE_KEYS[module], JSON.stringify(data));
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

export const MODULE_KEYS = Object.keys(STORAGE_KEYS);

export function getAllData() {
  const result = {};
  MODULE_KEYS.forEach((m) => {
    result[m] = getData(m);
  });
  return result;
}

export function restoreAllData(allData) {
  if (!allData || typeof allData !== 'object') return;
  const payload = allData.backupCompletoDeTodasAsColecoes || allData.dados || allData;
  MODULE_KEYS.forEach((m) => {
    if (Array.isArray(payload[m])) {
      setData(m, payload[m]);
    }
  });
}

export function addItem(module, item) {
  const data = getData(module);
  const newItem = {
    ...item,
    id: item.id || crypto.randomUUID(),
    createdAt: item.createdAt || new Date().toISOString(),
  };
  data.push(newItem);
  setData(module, data);
  saveToCloud(module, newItem);
  return newItem;
}

export function updateItem(module, id, updates) {
  const data = getData(module);
  const index = data.findIndex((item) => String(item.id) === String(id));
  if (index === -1) return null;
  data[index] = { ...data[index], ...updates, updatedAt: new Date().toISOString() };
  setData(module, data);
  saveToCloud(module, data[index]);
  return data[index];
}

export function deleteItem(module, id) {
  const data = getData(module);
  const filtered = data.filter((item) => String(item.id) !== String(id));
  setData(module, filtered);
  deleteFromCloud(module, id);
  return filtered;
}

export function getItem(module, id) {
  const data = getData(module);
  return data.find((item) => String(item.id) === String(id)) || null;
}

/**
 * Returns sorted list of active doctor names for selectors when adding exams.
 * Doctors marked with ativo === false are excluded, even if they have historical records.
 */
export function getActiveMedicosOptions() {
  const list = getData('medicos') || [];
  const inactiveNames = new Set(
    list
      .filter((m) => m.ativo === false)
      .map((m) => m.nome.trim().toUpperCase())
  );
  const activeSet = new Set(
    list
      .filter((m) => m.ativo !== false)
      .map((m) => m.nome.trim().toUpperCase())
  );

  const exames = getData('exames') || [];
  const detalhes = getData('detalhesExames') || [];
  const convs = getData('examesConvenio') || [];

  exames.forEach((e) => {
    if (e.medico && e.medico.trim()) {
      const name = e.medico.trim().toUpperCase();
      if (!inactiveNames.has(name)) activeSet.add(name);
    }
  });

  detalhes.forEach((d) => {
    if (d.medico && d.medico.trim()) {
      const name = d.medico.trim().toUpperCase();
      if (!inactiveNames.has(name)) activeSet.add(name);
    }
    if (d.medico2 && d.medico2.trim()) {
      const name = d.medico2.trim().toUpperCase();
      if (!inactiveNames.has(name)) activeSet.add(name);
    }
  });

  convs.forEach((c) => {
    if (c.medico && c.medico.trim()) {
      const name = c.medico.trim().toUpperCase();
      if (!inactiveNames.has(name)) activeSet.add(name);
    }
  });

  return Array.from(activeSet).sort((a, b) => a.localeCompare(b));
}

/**
 * Synchronize a single examesConvenio record with detalhesExames
 */
export function syncConvenioToDetalhes(convenioItem) {
  if (!convenioItem || !convenioItem.id) return null;

  const hasDivisao =
    (convenioItem.valorClinica !== undefined && convenioItem.valorClinica !== '' && convenioItem.valorClinica !== null) ||
    (convenioItem.valorMedico !== undefined && convenioItem.valorMedico !== '' && convenioItem.valorMedico !== null) ||
    convenioItem.fluxoLancado ||
    (convenioItem.valorRepasse !== undefined && Number(convenioItem.valorRepasse) > 0);

  const detalhesList = getData('detalhesExames') || [];
  const syncId = `conv_${convenioItem.id}`;
  const existingIdx = detalhesList.findIndex((d) => d.id === syncId || d.origemConvenioId === convenioItem.id);

  if (!hasDivisao) {
    if (existingIdx !== -1) {
      deleteItem('detalhesExames', detalhesList[existingIdx].id);
    }
    return null;
  }

  const valClinicaNum = parseFloat(convenioItem.valorClinica) || 0;
  const valMedicoNum = parseFloat(convenioItem.valorMedico) || 0;
  const total = valClinicaNum + valMedicoNum;
  const pctMedicoTotal = convenioItem.percentualMedico !== undefined && convenioItem.percentualMedico !== null
    ? Number(convenioItem.percentualMedico)
    : 60;
  const pctClinica = Math.max(0, 100 - pctMedicoTotal);
  const totalHonorariosMedicos = (total * pctMedicoTotal) / 100;
  const direitoClinica = (total * pctClinica) / 100;

  const temDiv2 = !!(convenioItem.temDivisaoMedico2 && convenioItem.medico2);
  const pctMed1 = temDiv2 ? (Number(convenioItem.porcentagemMedico1) || 0) : 100;
  const pctMed2 = temDiv2 ? (Number(convenioItem.porcentagemMedico2) || 0) : 0;

  const direitoMed1 = (totalHonorariosMedicos * pctMed1) / 100;
  const direitoMed2 = temDiv2 ? (totalHonorariosMedicos * pctMed2) / 100 : 0;

  const difMed1 = Math.max(0, direitoMed1 - valMedicoNum);
  const difMed2 = direitoMed2;

  const repMed1 = convenioItem.valorRepasseMedico1 !== undefined && Number(convenioItem.valorRepasseMedico1) >= 0
    ? Number(convenioItem.valorRepasseMedico1)
    : difMed1;
  const repMed2 = convenioItem.valorRepasseMedico2 !== undefined && Number(convenioItem.valorRepasseMedico2) >= 0
    ? Number(convenioItem.valorRepasseMedico2)
    : difMed2;
  const repasseTotal = convenioItem.valorRepasse !== undefined && Number(convenioItem.valorRepasse) >= 0
    ? Number(convenioItem.valorRepasse)
    : (repMed1 + repMed2);

  const cNome = (convenioItem.convenio || '').trim().toUpperCase();
  const formaStr = cNome ? `Convênio (${cNome})` : 'Convênio';
  const effectiveData = convenioItem.fluxoData || convenioItem.data;

  const detalheRecord = {
    id: syncId,
    origemConvenioId: convenioItem.id,
    isConvenio: true,
    convenio: cNome,
    data: effectiveData,
    dataOriginalExame: convenioItem.data,
    paciente: (convenioItem.paciente || '').trim().toUpperCase(),
    tipoExame: (convenioItem.exame || '').trim().toUpperCase(),
    procedimentoComplementar: convenioItem.procedimentoComplementar || '',
    medico: (convenioItem.medico || '').trim().toUpperCase(),
    temDivisao: temDiv2,
    medico2: temDiv2 && convenioItem.medico2 ? convenioItem.medico2.trim().toUpperCase() : '',
    divisaoTipo: 'valor',
    porcentagemMedico1: pctMed1,
    porcentagemMedico2: pctMed2,
    valorMedico1: Math.round(repMed1 * 100) / 100,
    valorMedico2: Math.round(repMed2 * 100) / 100,
    honorariosMedicos: Math.round(repasseTotal * 100) / 100,
    taxaClinica: Math.round(direitoClinica * 100) / 100,
    valorPagamento: Math.round((total > 0 ? total : valClinicaNum) * 100) / 100,
    numParcelas: '1',
    formaPagamento: formaStr,
    pagamentos: [
      {
        forma: formaStr,
        valor: Math.round((total > 0 ? total : valClinicaNum) * 100) / 100,
        parcelas: 1,
      },
    ],
    updatedAt: new Date().toISOString(),
  };

  if (existingIdx !== -1) {
    updateItem('detalhesExames', detalhesList[existingIdx].id, detalheRecord);
  } else {
    addItem('detalhesExames', detalheRecord);
  }
  return detalheRecord;
}

/**
 * Synchronize all examesConvenio with detalhesExames
 */
export function syncAllConveniosToDetalhes() {
  try {
    const convenios = getData('examesConvenio') || [];
    const validConvenioIds = new Set(convenios.map((c) => c.id));
    const detalhesList = getData('detalhesExames') || [];

    // Remove orphaned synced records whose source convenio was deleted
    detalhesList.forEach((d) => {
      if (d.origemConvenioId && !validConvenioIds.has(d.origemConvenioId)) {
        deleteItem('detalhesExames', d.id);
      }
    });

    convenios.forEach((c) => {
      syncConvenioToDetalhes(c);
    });
  } catch (err) {
    console.error('Error syncing convenios to detalhes:', err);
  }
}

/**
 * Remove synced detalhesExames record when a convenio exam is deleted
 */
export function removeConvenioFromDetalhes(convenioId) {
  try {
    const detalhesList = getData('detalhesExames') || [];
    const syncId = `conv_${convenioId}`;
    const found = detalhesList.find((d) => d.id === syncId || d.origemConvenioId === convenioId);
    if (found) {
      deleteItem('detalhesExames', found.id);
    }
  } catch (err) {
    console.error('Error removing convenio from detalhes:', err);
  }
}

// Initial sync on startup
try {
  syncAllConveniosToDetalhes();
} catch (e) {
  // ignore during initial bundle load
}

export const DEFAULT_SALAS = [
  { id: 'sala_c1', nome: 'Consultório 1', tipo: 'consultorio', cor: '#3b82f6', ativo: true, ordem: 1 },
  { id: 'sala_c2', nome: 'Consultório 2', tipo: 'consultorio', cor: '#0ea5e9', ativo: true, ordem: 2 },
  { id: 'sala_e1', nome: 'Sala 1 — Endoscopia', tipo: 'exame', cor: '#10b981', ativo: true, ordem: 3 },
  { id: 'sala_e2', nome: 'Sala 2 — Colonoscopia', tipo: 'exame', cor: '#8b5cf6', ativo: true, ordem: 4 },
  { id: 'sala_e3', nome: 'Sala 3 — Procedimentos / Eco', tipo: 'exame', cor: '#f59e0b', ativo: true, ordem: 5 },
];

export function getSalasConfig() {
  const saved = getData('salasConfig');
  if (saved && Array.isArray(saved) && saved.length > 0) {
    return [...saved].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
  }
  // Initialize default rooms in localStorage if empty
  setData('salasConfig', DEFAULT_SALAS);
  return DEFAULT_SALAS;
}

export function saveSalasConfig(salas) {
  setData('salasConfig', salas);
  if (Array.isArray(salas)) {
    salas.forEach((s) => saveToCloud('salasConfig', s));
  }
}

export function getCronogramaList() {
  return getData('cronogramaSalas') || [];
}

export function saveCronogramaSlot(slot) {
  if (!slot || !slot.data || !slot.salaId || !slot.turno) return null;
  const list = getData('cronogramaSalas') || [];
  
  // Find if slot exists by ID or by composite key (data + salaId + turno)
  const existingIdx = list.findIndex(
    (item) => item.id === slot.id || (item.data === slot.data && item.salaId === slot.salaId && item.turno === slot.turno)
  );

  if (existingIdx !== -1) {
    const existingId = list[existingIdx].id;
    return updateItem('cronogramaSalas', existingId, slot);
  } else {
    return addItem('cronogramaSalas', slot);
  }
}

export function deleteCronogramaSlot(id) {
  return deleteItem('cronogramaSalas', id);
}

/**
 * Replicates all slots from one week (Monday-Saturday) to another week.
 * @param {string[]} sourceDays - Array of 6 ISO date strings (Monday to Saturday)
 * @param {string[]} targetDays - Array of 6 target ISO date strings
 * @param {boolean} overwrite - Whether to overwrite existing slots in target days
 */
export function replicateWeekSchedule(sourceDays, targetDays, overwrite = true) {
  if (!Array.isArray(sourceDays) || !Array.isArray(targetDays) || sourceDays.length !== 6 || targetDays.length !== 6) {
    return { replicated: 0, skipped: 0 };
  }
  const allSlots = getData('cronogramaSalas') || [];
  let replicated = 0;
  let skipped = 0;

  for (let i = 0; i < 6; i++) {
    const srcDate = sourceDays[i];
    const tgtDate = targetDays[i];
    const srcSlots = allSlots.filter((s) => s.data === srcDate);

    for (const src of srcSlots) {
      const existingInTarget = allSlots.find(
        (s) => s.data === tgtDate && s.salaId === src.salaId && s.turno === src.turno
      );

      if (existingInTarget && !overwrite) {
        skipped++;
        continue;
      }

      const newSlot = {
        ...src,
        id: existingInTarget ? existingInTarget.id : crypto.randomUUID(),
        data: tgtDate,
        updatedAt: new Date().toISOString(),
      };

      saveCronogramaSlot(newSlot);
      replicated++;
    }
  }

  return { replicated, skipped };
}

// ==========================================
// MONITOR DE USO DO LOCALSTORAGE & ARQUIVAMENTO
// ==========================================

export const ESTIMATED_LOCALSTORAGE_QUOTA_BYTES = 5 * 1024 * 1024; // 5 MB (padrão de navegadores modernos)

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

const MODULE_LABELS = {
  exames: 'Exames Particulares',
  detalhesExames: 'Detalhes Financeiros',
  examesConvenio: 'Exames de Convênio',
  fluxoCaixa: 'Fluxo de Caixa',
  folhaPagamento: 'Folha de Pagamento',
  medicos: 'Cadastro de Médicos',
  repassesAjustes: 'Ajustes de Repasse',
  cronogramaSalas: 'Cronograma de Salas',
  salasConfig: 'Configurações de Salas',
};

/**
 * Calcula detalhadamente o uso do localStorage no domínio atual.
 * Mede tamanho em bytes das chaves do sistema e de terceiros.
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
      // No localStorage os caracteres em UTF-16 consomem 2 bytes cada
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

  // Ordena coleções por consumo de espaço decrescente
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
    status, // 'healthy' | 'warning' | 'critical'
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
 *
 * REGRA CRÍTICA DE SEGURANÇA:
 * 1. OBRIGATÓRIO: Gera e faz o download automático de um arquivo JSON completo contendo
 *    todos os dados da aplicação e os registros arquivados ANTES de qualquer remoção.
 * 2. Em seguida, remove os registros antigos das coleções locais.
 * 3. Se conectado ao Firebase, remove os IDs arquivados para evitar ressincronização.
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

  // 1. GERAÇÃO E DOWNLOAD DO BACKUP COMPLETO DE SEGURANÇA (OBRIGATÓRIO ANTES DO EXPURGO)
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

  // 2. SALVAR OS DADOS FILTRADOS NO LOCALSTORAGE
  targetModules.forEach((mod) => {
    setData(mod, remainingRecords[mod]);
  });

  // 3. EXCLUIR REGISTROS DA NUVEM SE FIREBASE ESTIVER CONECTADO
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

  // 4. NOTIFICAR ATUALIZAÇÃO GERAL
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



