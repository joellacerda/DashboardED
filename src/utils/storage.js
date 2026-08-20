// Storage utility for Clínica Endodiagnose Dashboard
// Uses localStorage for persistence

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

export function addItem(module, item) {
  const data = getData(module);
  const newItem = { ...item, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
  data.push(newItem);
  setData(module, data);
  return newItem;
}

export function updateItem(module, id, updates) {
  const data = getData(module);
  const index = data.findIndex((item) => item.id === id);
  if (index === -1) return null;
  data[index] = { ...data[index], ...updates, updatedAt: new Date().toISOString() };
  setData(module, data);
  return data[index];
}

export function deleteItem(module, id) {
  const data = getData(module);
  const filtered = data.filter((item) => item.id !== id);
  setData(module, filtered);
  return filtered;
}

export function getItem(module, id) {
  const data = getData(module);
  return data.find((item) => item.id === id) || null;
}
