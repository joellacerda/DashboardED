import { getData, setData, addItem, updateItem, deleteItem, MODULES } from './core';
import { saveToCloud } from '../../services/firebase';

export const DEFAULT_SALAS = Object.freeze([
  { id: 'sala_c1', nome: 'Consultório 1', tipo: 'consultorio', cor: '#3b82f6', ativo: true, ordem: 1 },
  { id: 'sala_c2', nome: 'Consultório 2', tipo: 'consultorio', cor: '#0ea5e9', ativo: true, ordem: 2 },
  { id: 'sala_e1', nome: 'Sala 1 — Endoscopia', tipo: 'exame', cor: '#10b981', ativo: true, ordem: 3 },
  { id: 'sala_e2', nome: 'Sala 2 — Colonoscopia', tipo: 'exame', cor: '#8b5cf6', ativo: true, ordem: 4 },
  { id: 'sala_e3', nome: 'Sala 3 — Procedimentos / Eco', tipo: 'exame', cor: '#f59e0b', ativo: true, ordem: 5 },
]);

export function getSalasConfig() {
  const saved = getData(MODULES.salasConfig);
  if (saved && Array.isArray(saved) && saved.length > 0) {
    return [...saved].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
  }
  // Inicializa salas padrão se estiver vazio
  setData(MODULES.salasConfig, [...DEFAULT_SALAS]);
  return [...DEFAULT_SALAS];
}

export function saveSalasConfig(salas) {
  setData(MODULES.salasConfig, salas);
  if (Array.isArray(salas)) {
    salas.forEach((s) => saveToCloud(MODULES.salasConfig, s));
  }
}

export function getCronogramaList() {
  return getData(MODULES.cronogramaSalas) || [];
}

export function saveCronogramaSlot(slot) {
  if (!slot || !slot.data || !slot.salaId || !slot.turno) return null;
  const list = getData(MODULES.cronogramaSalas) || [];

  // Busca se já existe o slot por ID ou chave composta (data + salaId + turno)
  const existingIdx = list.findIndex(
    (item) => item.id === slot.id || (item.data === slot.data && item.salaId === slot.salaId && item.turno === slot.turno)
  );

  if (existingIdx !== -1) {
    const existingId = list[existingIdx].id;
    return updateItem(MODULES.cronogramaSalas, existingId, slot);
  } else {
    return addItem(MODULES.cronogramaSalas, slot);
  }
}

export function deleteCronogramaSlot(id) {
  return deleteItem(MODULES.cronogramaSalas, id);
}

/**
 * Replica todos os slots de uma semana para outra semana.
 */
export function replicateWeekSchedule(sourceDays, targetDays, overwrite = true) {
  if (!Array.isArray(sourceDays) || !Array.isArray(targetDays) || sourceDays.length !== 6 || targetDays.length !== 6) {
    return { replicated: 0, skipped: 0 };
  }
  const allSlots = getData(MODULES.cronogramaSalas) || [];
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
