import { getData, setData, addItem, updateItem, deleteItem, MODULES } from './core';
import { enqueueSyncOperation } from '../../services/syncQueue';

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
  return DEFAULT_SALAS.map((s) => ({ ...s }));
}

export function saveSalasConfig(salas) {
  const prevSalas = getData(MODULES.salasConfig) || [];
  const now = new Date().toISOString();
  const normalizedSalas = Array.isArray(salas)
    ? salas.map((s) => ({ ...s, updatedAt: now }))
    : [];

  setData(MODULES.salasConfig, normalizedSalas);

  const nextIds = new Set(normalizedSalas.map((s) => s.id).filter(Boolean));
  prevSalas.forEach((oldSala) => {
    if (oldSala?.id && !nextIds.has(oldSala.id)) {
      enqueueSyncOperation({
        module: MODULES.salasConfig,
        entityId: oldSala.id,
        type: 'DELETE',
        payload: { id: oldSala.id, _deleted: true, deletedAt: now, updatedAt: now },
      });
    }
  });

  normalizedSalas.forEach((s) => {
    if (s && s.id) {
      enqueueSyncOperation({
        module: MODULES.salasConfig,
        entityId: s.id,
        type: 'UPSERT',
        payload: s,
      });
    }
  });
}

export function getCronogramaList() {
  return getData(MODULES.cronogramaSalas) || [];
}

export function saveCronogramaSlot(slot) {
  if (!slot || !slot.data || !slot.salaId || !slot.turno) return null;
  const list = getData(MODULES.cronogramaSalas) || [];

  // Busca se já existe o slot por ID (quando presente) ou chave composta (data + salaId + turno)
  const existingIdx = list.findIndex(
    (item) =>
      (slot.id && item.id && String(item.id) === String(slot.id)) ||
      (item.data === slot.data && item.salaId === slot.salaId && item.turno === slot.turno)
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
