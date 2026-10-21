// Storage Module Index — Clínica Endodiagnose
// Reexporta todas as funções dos sub-módulos para manter compatibilidade total

export * from './core';
export * from './audit';
export * from './migrations';
export * from './convenios';
export * from './cronograma';
export * from './archive';

import { runDataMigrations as internalRunMigrations } from './migrations';
import { syncConveniosFluxoConsolidado, syncAllConveniosToDetalhes } from './convenios';

/**
 * Executa as migrações passando as funções de sincronização de convênios
 */
export function runDataMigrations() {
  return internalRunMigrations({
    syncConveniosFluxoConsolidado,
    syncAllConveniosToDetalhes,
  });
}
