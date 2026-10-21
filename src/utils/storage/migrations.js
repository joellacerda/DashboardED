import { getData, setData, MODULES, getLocalStorage } from './core';
import { saveToCloud } from '../../services/firebase';

export const SCHEMA_VERSION_KEY = 'endodiagnose_schema_version';
export const CURRENT_SCHEMA_VERSION = 2;

let _hasRunMigrations = false;

export function resetMigrationStatus() {
  _hasRunMigrations = false;
}

/**
 * Função genérica para migração de dados de um módulo com envio à nuvem.
 * Executa uma função pura de transformação em cada registro.
 *
 * @param {string} module - Nome do módulo (ex: MODULES.medicos)
 * @param {function} transformFn - Função (item) => novoItem ou item
 * @returns {{ changed: boolean, updatedCount: number }}
 */
export function migrate(module, transformFn) {
  if (typeof transformFn !== 'function') {
    return { changed: false, updatedCount: 0 };
  }

  try {
    const list = getData(module);
    if (!Array.isArray(list) || list.length === 0) {
      return { changed: false, updatedCount: 0 };
    }

    let changed = false;
    let updatedCount = 0;
    const updatedList = list.map((item) => {
      if (!item) return item;
      const transformed = transformFn({ ...item });
      if (JSON.stringify(transformed) !== JSON.stringify(item)) {
        changed = true;
        updatedCount++;
        saveToCloud(module, transformed);
        return transformed;
      }
      return item;
    });

    if (changed) {
      setData(module, updatedList);
    }

    return { changed, updatedCount };
  } catch (err) {
    console.error(`Erro ao executar migração no módulo '${module}':`, err);
    return { changed: false, updatedCount: 0 };
  }
}

/**
 * Executa as migrações controladas do schema no localStorage e na nuvem.
 */
export function runDataMigrations(convenioSyncFns = {}) {
  if (_hasRunMigrations) return;
  _hasRunMigrations = true;

  try {
    const storage = getLocalStorage();
    if (!storage) return;

    const storedVersionStr = storage.getItem(SCHEMA_VERSION_KEY);
    const storedVersion = storedVersionStr ? parseInt(storedVersionStr, 10) : 0;

    // Migração V1: Normalização de dados legados, maiúsculas e tipos de exames
    if (storedVersion < 1) {
      // 1. Médicos em maiúsculas
      migrate(MODULES.medicos, (m) => {
        if (m.nome && m.nome !== m.nome.toUpperCase()) {
          return { ...m, nome: m.nome.toUpperCase() };
        }
        return m;
      });

      // 2. Convênios
      const PROC_COMPL = ['POLIPECTOMIA', 'MUCOSECTOMIA'];
      migrate(MODULES.examesConvenio, (cItem) => {
        const item = { ...cItem };
        if (item.convenio === 'BRADESCO 421715') {
          item.convenio = 'BRADESCO';
        }
        if (item.medico && item.medico !== item.medico.toUpperCase()) {
          item.medico = item.medico.toUpperCase();
        }
        if (item.paciente && item.paciente !== item.paciente.toUpperCase()) {
          item.paciente = item.paciente.toUpperCase();
        }
        if (item.exame && PROC_COMPL.includes(item.exame.trim().toUpperCase())) {
          item.exame = '';
        }
        return item;
      });

      // 3. Fluxo de caixa: padronização de nomes
      migrate(MODULES.fluxoCaixa, (fItem) => {
        const item = { ...fItem };
        if (item.nome && item.nome.includes('BRADESCO 421715')) {
          item.nome = item.nome.replaceAll('BRADESCO 421715', 'BRADESCO');
        }
        if (item.nome) {
          let newNome = item.nome;
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
          item.nome = newNome;
        }
        return item;
      });

      // 4. Exames particulares
      migrate(MODULES.exames, (eItem) => {
        const item = { ...eItem };
        if (item.convenio === 'BRADESCO 421715') {
          item.convenio = 'BRADESCO';
        }
        if (item.medico && item.medico !== item.medico.toUpperCase()) {
          item.medico = item.medico.toUpperCase();
        }
        if (item.paciente && item.paciente !== item.paciente.toUpperCase()) {
          item.paciente = item.paciente.toUpperCase();
        }
        if (item.exame && PROC_COMPL.includes(item.exame.trim().toUpperCase())) {
          item.exame = '';
        }
        return item;
      });

      // 5. Detalhes de exames
      migrate(MODULES.detalhesExames, (dItem) => {
        const item = { ...dItem };
        if (item.medico && item.medico !== item.medico.toUpperCase()) {
          item.medico = item.medico.toUpperCase();
        }
        if (item.medico2 && item.medico2 !== item.medico2.toUpperCase()) {
          item.medico2 = item.medico2.toUpperCase();
        }
        if (item.paciente && item.paciente !== item.paciente.toUpperCase()) {
          item.paciente = item.paciente.toUpperCase();
        }
        if (item.tipoExame && PROC_COMPL.includes(item.tipoExame.trim().toUpperCase())) {
          item.tipoExame = '';
        }
        return item;
      });
    }

    // Migração V2: Sincronização inicial de convênios e fluxo consolidado
    if (storedVersion < 2) {
      if (typeof convenioSyncFns.syncConveniosFluxoConsolidado === 'function') {
        convenioSyncFns.syncConveniosFluxoConsolidado();
      }
      if (typeof convenioSyncFns.syncAllConveniosToDetalhes === 'function') {
        convenioSyncFns.syncAllConveniosToDetalhes();
      }
    }

    storage.setItem(SCHEMA_VERSION_KEY, String(CURRENT_SCHEMA_VERSION));
  } catch (err) {
    console.error('Migration error:', err);
  }
}
