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

    // Migrate in examesConvenio
    const rawConvenios = localStorage.getItem(STORAGE_KEYS.examesConvenio);
    if (rawConvenios && rawConvenios.includes('BRADESCO 421715')) {
      const parsed = JSON.parse(rawConvenios);
      let changed = false;
      const updated = parsed.map((item) => {
        if (item.convenio === 'BRADESCO 421715') {
          changed = true;
          return { ...item, convenio: 'BRADESCO' };
        }
        return item;
      });
      if (changed) {
        localStorage.setItem(STORAGE_KEYS.examesConvenio, JSON.stringify(updated));
      }
    }

    // Migrate in fluxoCaixa
    const rawFluxo = localStorage.getItem(STORAGE_KEYS.fluxoCaixa);
    if (rawFluxo && rawFluxo.includes('BRADESCO 421715')) {
      const parsed = JSON.parse(rawFluxo);
      let changed = false;
      const updated = parsed.map((item) => {
        if (item.nome && item.nome.includes('BRADESCO 421715')) {
          changed = true;
          return { ...item, nome: item.nome.replaceAll('BRADESCO 421715', 'BRADESCO') };
        }
        return item;
      });
      if (changed) {
        localStorage.setItem(STORAGE_KEYS.fluxoCaixa, JSON.stringify(updated));
      }
    }

    // Migrate in exames / detalhesExames if applicable
    const rawExames = localStorage.getItem(STORAGE_KEYS.exames);
    if (rawExames && rawExames.includes('BRADESCO 421715')) {
      const parsed = JSON.parse(rawExames);
      let changed = false;
      const updated = parsed.map((item) => {
        if (item.convenio === 'BRADESCO 421715') {
          changed = true;
          return { ...item, convenio: 'BRADESCO' };
        }
        return item;
      });
      if (changed) {
        localStorage.setItem(STORAGE_KEYS.exames, JSON.stringify(updated));
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
