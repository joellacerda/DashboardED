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
  getSalasConfig,
  saveSalasConfig as storageSaveSalasConfig,
  saveCronogramaSlot as storageSaveCronogramaSlot,
  deleteCronogramaSlot as storageDeleteCronogramaSlot,
  replicateWeekSchedule as storageReplicateWeekSchedule,
} from '../utils/storage';

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const [data, setDataState] = useState(() => {
    const initial = getAllData();
    initial.salasConfig = getSalasConfig();
    return initial;
  });

  // Atualiza um módulo específico no estado React a partir do localStorage
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
      // Quando outra aba altera o localStorage
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
    setDataState((prev) => {
      const currentList = prev[module] || [];
      return {
        ...prev,
        [module]: [...currentList, newItem],
      };
    });
    return newItem;
  }, []);

  // Mutação reativa: Atualizar item
  const updateItem = useCallback((module, id, updates) => {
    const updated = storageUpdateItem(module, id, updates);
    if (!updated) return null;
    setDataState((prev) => {
      const currentList = prev[module] || [];
      return {
        ...prev,
        [module]: currentList.map((item) => (String(item.id) === String(id) ? updated : item)),
      };
    });
    return updated;
  }, []);

  // Mutação reativa: Deletar item
  const deleteItem = useCallback((module, id) => {
    storageDeleteItem(module, id);
    setDataState((prev) => {
      const currentList = prev[module] || [];
      return {
        ...prev,
        [module]: currentList.filter((item) => String(item.id) !== String(id)),
      };
    });
  }, []);

  // Mutação reativa: Substituir conjunto inteiro de um módulo
  const setData = useCallback((module, nextData) => {
    setDataState((prev) => {
      const currentModuleData = prev[module] || [];
      const resolved = typeof nextData === 'function' ? nextData(currentModuleData) : nextData;
      storageSetData(module, resolved);
      return {
        ...prev,
        [module]: resolved,
      };
    });
  }, []);

  // Sincronização de convênio com detalhes
  const syncConvenioToDetalhes = useCallback((convenioItem) => {
    const result = storageSyncConvenioToDetalhes(convenioItem);
    // Atualiza imediatamente detalhesExames e examesConvenio no estado
    const freshDetalhes = getData('detalhesExames');
    const freshConvenios = getData('examesConvenio');
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
    const freshDetalhes = getData('detalhesExames');
    setDataState((prev) => ({
      ...prev,
      detalhesExames: freshDetalhes,
    }));
  }, []);

  // Remoção de convênio sincronizado em detalhes
  const removeConvenioFromDetalhes = useCallback((convenioId) => {
    storageRemoveConvenioFromDetalhes(convenioId);
    const freshDetalhes = getData('detalhesExames');
    setDataState((prev) => ({
      ...prev,
      detalhesExames: freshDetalhes,
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
    const freshSlots = getData('cronogramaSalas');
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
    const freshSlots = getData('cronogramaSalas');
    setDataState((prev) => ({
      ...prev,
      cronogramaSalas: freshSlots,
    }));
    return result;
  }, []);

  // Lista dinâmica e reativa de médicos ativos para seleção em exames e cronograma
  const activeMedicosOptions = useMemo(() => {
    const list = data.medicos || [];
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

    const examesList = data.exames || [];
    const detalhesList = data.detalhesExames || [];
    const convsList = data.examesConvenio || [];

    examesList.forEach((e) => {
      if (e.medico && e.medico.trim()) {
        const name = e.medico.trim().toUpperCase();
        if (!inactiveNames.has(name)) activeSet.add(name);
      }
    });

    detalhesList.forEach((d) => {
      if (d.medico && d.medico.trim()) {
        const name = d.medico.trim().toUpperCase();
        if (!inactiveNames.has(name)) activeSet.add(name);
      }
      if (d.medico2 && d.medico2.trim()) {
        const name = d.medico2.trim().toUpperCase();
        if (!inactiveNames.has(name)) activeSet.add(name);
      }
    });

    convsList.forEach((c) => {
      if (c.medico && c.medico.trim()) {
        const name = c.medico.trim().toUpperCase();
        if (!inactiveNames.has(name)) activeSet.add(name);
      }
    });

    return Array.from(activeSet).sort((a, b) => a.localeCompare(b));
  }, [data.medicos, data.exames, data.detalhesExames, data.examesConvenio]);

  const value = useMemo(
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
      activeMedicosOptions,
      addItem,
      updateItem,
      deleteItem,
      setData,
      refreshModule,
      reloadAll,
      syncConvenioToDetalhes,
      syncAllConveniosToDetalhes,
      removeConvenioFromDetalhes,
      saveSalasConfig,
      saveCronogramaSlot,
      deleteCronogramaSlot,
      replicateWeekSchedule,
    }),
    [
      data,
      activeMedicosOptions,
      addItem,
      updateItem,
      deleteItem,
      setData,
      refreshModule,
      reloadAll,
      syncConvenioToDetalhes,
      syncAllConveniosToDetalhes,
      removeConvenioFromDetalhes,
      saveSalasConfig,
      saveCronogramaSlot,
      deleteCronogramaSlot,
      replicateWeekSchedule,
    ]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData deve ser usado dentro de um DataProvider');
  }
  return context;
}
