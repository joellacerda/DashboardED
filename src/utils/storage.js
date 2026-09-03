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

    // Migrate in exames
    const rawExames = localStorage.getItem(STORAGE_KEYS.exames);
    if (rawExames) {
      const parsed = JSON.parse(rawExames);
      let changed = false;
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
  migrateLegacyData();
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
  const newItem = { ...item, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
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
