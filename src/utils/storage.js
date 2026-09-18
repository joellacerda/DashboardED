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

export function setData(module, data) {
  localStorage.setItem(STORAGE_KEYS[module], JSON.stringify(data));
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
  MODULE_KEYS.forEach((m) => {
    if (Array.isArray(allData[m])) {
      setData(m, allData[m]);
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
  const index = data.findIndex((item) => item.id === id);
  if (index === -1) return null;
  data[index] = { ...data[index], ...updates, updatedAt: new Date().toISOString() };
  setData(module, data);
  saveToCloud(module, data[index]);
  return data[index];
}

export function deleteItem(module, id) {
  const data = getData(module);
  const filtered = data.filter((item) => item.id !== id);
  setData(module, filtered);
  deleteFromCloud(module, id);
  return filtered;
}

export function getItem(module, id) {
  const data = getData(module);
  return data.find((item) => item.id === id) || null;
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

