import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import {
  getAllData,
  getData,
  setData as storageSetData,
  addItem as storageAddItem,
  updateItem as storageUpdateItem,
  deleteItem as storageDeleteItem,
  syncConvenioToDetalhes as storageSyncConvenioToDetalhes,
  syncAllConveniosToDetalhes as storageSyncAllConveniosToDetalhes,
  removeConvenioFromDetalhes as storageRemoveConvenioFromDetalhes,
  syncConveniosFluxoConsolidado as storageSyncConveniosFluxoConsolidado,
  getSalasConfig,
  saveSalasConfig as storageSaveSalasConfig,
  saveCronogramaSlot as storageSaveCronogramaSlot,
  deleteCronogramaSlot as storageDeleteCronogramaSlot,
  replicateWeekSchedule as storageReplicateWeekSchedule,
  getStorageUsageInfo,
  previewArchiveData,
  archiveAndPurgeData,
  exportAllDataAsJSON,
  revertConvenioOverride as storageRevertConvenioOverride,
  addAuditLog as storageAddAuditLog,
  getAuditLogs as storageGetAuditLogs,
  clearAuditLogs as storageClearAuditLogs,
  MODULES,
} from '../utils/storage';
import { getActiveMedicosOptions } from '../utils/helpers';

// Contexto dedicado aos dados/estado reativo
export const DataStateContext = createContext(null);

// Contexto dedicado às ações/mutações estáveis (evita re-renders desnecessários)
export const DataActionsContext = createContext(null);

// Contexto combinado para compatibilidade total
export const DataContext = createContext(null);

export function DataProvider({ children }) {
  const [data, setDataState] = useState(() => {
    const initial = getAllData();
    initial.salasConfig = getSalasConfig();
    return initial;
  });

  const [storageInfo, setStorageInfo] = useState(() => getStorageUsageInfo());

  // Atualiza um módulo específico no estado React a partir do localStorage/cache
  const refreshModule = useCallback((module) => {
    if (!module) return;
    if (module === 'salasConfig') {
      const fresh = getSalasConfig();
      setDataState((prev) => ({ ...prev, salasConfig: fresh }));
    } else {
      const fresh = getData(module);
      setDataState((prev) => ({ ...prev, [module]: fresh }));
    }
  }, []);

  // Recarrega todos os módulos de dados no estado React
  const reloadAll = useCallback(() => {
    const freshAll = getAllData();
    freshAll.salasConfig = getSalasConfig();
    setDataState(freshAll);
  }, []);

  // Listener para sincronização reativa (mesma aba ou abas externas)
  useEffect(() => {
    const handleCustomUpdate = (e) => {
      const mod = e?.detail?.module;
      if (mod) {
        refreshModule(mod);
      } else {
        reloadAll();
      }
    };

    const handleStorageChange = (e) => {
      if (e && e.key && e.key.startsWith('endodiagnose_')) {
        reloadAll();
      }
    };

    window.addEventListener('endodiagnose:data-updated', handleCustomUpdate);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('endodiagnose:data-updated', handleCustomUpdate);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [refreshModule, reloadAll]);

  // Mutação reativa: Adicionar item
  const addItem = useCallback((module, item) => {
    const newItem = storageAddItem(module, item);
    const fresh = getData(module);
    setDataState((prev) => ({
      ...prev,
      [module]: fresh,
    }));
    return newItem;
  }, []);

  // Mutação reativa: Atualizar item
  const updateItem = useCallback((module, id, updates) => {
    const updated = storageUpdateItem(module, id, updates);
    if (!updated) return null;
    const fresh = getData(module);
    setDataState((prev) => ({
      ...prev,
      [module]: fresh,
    }));
    return updated;
  }, []);

  // Mutação reativa: Deletar item
  const deleteItem = useCallback((module, id) => {
    storageDeleteItem(module, id);
    const fresh = getData(module);
    setDataState((prev) => ({
      ...prev,
      [module]: fresh,
    }));
  }, []);

  // Mutação reativa: Substituir conjunto inteiro de um módulo
  const setData = useCallback((module, nextData) => {
    const currentModuleData = getData(module);
    const resolved = typeof nextData === 'function' ? nextData(currentModuleData) : nextData;
    storageSetData(module, resolved);
    setDataState((prev) => ({
      ...prev,
      [module]: resolved,
    }));
  }, []);

  // Sincronização de convênio com detalhes
  const syncConvenioToDetalhes = useCallback((convenioItem) => {
    const result = storageSyncConvenioToDetalhes(convenioItem);
    const freshDetalhes = getData(MODULES.detalhesExames);
    const freshConvenios = getData(MODULES.examesConvenio);
    setDataState((prev) => ({
      ...prev,
      detalhesExames: freshDetalhes,
      examesConvenio: freshConvenios,
    }));
    return result;
  }, []);

  // Sincronização geral de convênios para detalhes
  const syncAllConveniosToDetalhes = useCallback(() => {
    storageSyncAllConveniosToDetalhes();
    const freshDetalhes = getData(MODULES.detalhesExames);
    setDataState((prev) => ({
      ...prev,
      detalhesExames: freshDetalhes,
    }));
  }, []);

  // Remoção de convênio sincronizado em detalhes
  const removeConvenioFromDetalhes = useCallback((convenioId) => {
    storageRemoveConvenioFromDetalhes(convenioId);
    const freshDetalhes = getData(MODULES.detalhesExames);
    const freshFluxo = getData(MODULES.fluxoCaixa);
    setDataState((prev) => ({
      ...prev,
      detalhesExames: freshDetalhes,
      fluxoCaixa: freshFluxo,
    }));
  }, []);

  // Sincronização consolidada de convênios no fluxo de caixa
  const syncConveniosFluxoConsolidado = useCallback(() => {
    storageSyncConveniosFluxoConsolidado();
    const freshFluxo = getData(MODULES.fluxoCaixa);
    setDataState((prev) => ({
      ...prev,
      fluxoCaixa: freshFluxo,
    }));
  }, []);

  // Métodos de salas e cronograma
  const saveSalasConfig = useCallback((salas) => {
    storageSaveSalasConfig(salas);
    setDataState((prev) => ({
      ...prev,
      salasConfig: salas,
    }));
  }, []);

  const saveCronogramaSlot = useCallback((slot) => {
    const saved = storageSaveCronogramaSlot(slot);
    const freshSlots = getData(MODULES.cronogramaSalas);
    setDataState((prev) => ({
      ...prev,
      cronogramaSalas: freshSlots,
    }));
    return saved;
  }, []);

  const deleteCronogramaSlot = useCallback((id) => {
    storageDeleteCronogramaSlot(id);
    setDataState((prev) => {
      const current = prev.cronogramaSalas || [];
      return {
        ...prev,
        cronogramaSalas: current.filter((s) => String(s.id) !== String(id)),
      };
    });
  }, []);

  const replicateWeekSchedule = useCallback((sourceDays, targetDays, overwrite) => {
    const result = storageReplicateWeekSchedule(sourceDays, targetDays, overwrite);
    const freshSlots = getData(MODULES.cronogramaSalas);
    setDataState((prev) => ({
      ...prev,
      cronogramaSalas: freshSlots,
    }));
    return result;
  }, []);

  // Lista dinâmica e reativa de médicos ativos para seleção em exames e cronograma
  const activeMedicosOptions = useMemo(
    () =>
      getActiveMedicosOptions({
        medicos: data.medicos,
        exames: data.exames,
        detalhesExames: data.detalhesExames,
        examesConvenio: data.examesConvenio,
      }),
    [data.medicos, data.exames, data.detalhesExames, data.examesConvenio]
  );

  const refreshStorageInfo = useCallback(() => {
    setStorageInfo(getStorageUsageInfo());
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setStorageInfo(getStorageUsageInfo());
    }, 400);
    return () => clearTimeout(timer);
  }, [data]);

  const archiveAndPurge = useCallback(
    async (cutoffDate) => {
      const result = await archiveAndPurgeData(cutoffDate);
      reloadAll();
      setStorageInfo(getStorageUsageInfo());
      return result;
    },
    [reloadAll]
  );

  const revertConvenioOverride = useCallback(
    (detalhesId) => {
      const res = storageRevertConvenioOverride(detalhesId);
      refreshModule(MODULES.detalhesExames);
      return res;
    },
    [refreshModule]
  );

  const addAuditLog = useCallback(
    (entry) => {
      const res = storageAddAuditLog(entry);
      refreshModule(MODULES.auditLogs);
      return res;
    },
    [refreshModule]
  );

  const clearAuditLogs = useCallback(() => {
    storageClearAuditLogs();
    refreshModule(MODULES.auditLogs);
  }, [refreshModule]);

  // 1. Objeto de Estado (muda quando os dados mudam)
  const stateValue = useMemo(
    () => ({
      data,
      exames: data.exames || [],
      fluxoCaixa: data.fluxoCaixa || [],
      detalhesExames: data.detalhesExames || [],
      folhaPagamento: data.folhaPagamento || [],
      medicos: data.medicos || [],
      repassesAjustes: data.repassesAjustes || [],
      examesConvenio: data.examesConvenio || [],
      cronogramaSalas: data.cronogramaSalas || [],
      salasConfig: data.salasConfig || [],
      auditLogs: data.auditLogs || [],
      activeMedicosOptions,
      storageInfo,
    }),
    [data, activeMedicosOptions, storageInfo]
  );

  // 2. Objeto de Ações (estável, não recria a cada mutação de dados)
  const actionsValue = useMemo(
    () => ({
      refreshStorageInfo,
      archiveAndPurge,
      previewArchiveData,
      exportAllDataAsJSON,
      addItem,
      updateItem,
      deleteItem,
      setData,
      refreshModule,
      reloadAll,
      syncConvenioToDetalhes,
      syncAllConveniosToDetalhes,
      removeConvenioFromDetalhes,
      syncConveniosFluxoConsolidado,
      revertConvenioOverride,
      addAuditLog,
      getAuditLogs: storageGetAuditLogs,
      clearAuditLogs,
      saveSalasConfig,
      saveCronogramaSlot,
      deleteCronogramaSlot,
      replicateWeekSchedule,
    }),
    [
      refreshStorageInfo,
      archiveAndPurge,
      addItem,
      updateItem,
      deleteItem,
      setData,
      refreshModule,
      reloadAll,
      syncConvenioToDetalhes,
      syncAllConveniosToDetalhes,
      removeConvenioFromDetalhes,
      syncConveniosFluxoConsolidado,
      revertConvenioOverride,
      addAuditLog,
      clearAuditLogs,
      saveSalasConfig,
      saveCronogramaSlot,
      deleteCronogramaSlot,
      replicateWeekSchedule,
    ]
  );

  // 3. Objeto Combinado (para useData tradicional)
  const combinedValue = useMemo(
    () => ({
      ...stateValue,
      ...actionsValue,
    }),
    [stateValue, actionsValue]
  );

  return (
    <DataStateContext.Provider value={stateValue}>
      <DataActionsContext.Provider value={actionsValue}>
        <DataContext.Provider value={combinedValue}>
          {children}
        </DataContext.Provider>
      </DataActionsContext.Provider>
    </DataStateContext.Provider>
  );
}

/**
 * Hook para acessar somente os dados/estado.
 */
export function useDataState() {
  const context = useContext(DataStateContext);
  if (!context) {
    throw new Error('useDataState deve ser usado dentro de um DataProvider');
  }
  return context;
}

/**
 * Hook para acessar somente as ações/mutações (estáveis).
 */
export function useDataActions() {
  const context = useContext(DataActionsContext);
  if (!context) {
    throw new Error('useDataActions deve ser usado dentro de um DataProvider');
  }
  return context;
}

/**
 * Hook unificado para acessar dados e ações simultaneamente.
 */
export function useData() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData deve ser usado dentro de um DataProvider');
  }
  return context;
}
