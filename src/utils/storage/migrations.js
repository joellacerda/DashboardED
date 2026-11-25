import { getData, setData, MODULES, getLocalStorage, generateId } from './core';
import { enqueueSyncOperation } from '../../services/syncQueue';
import { getAcquisitionPeriod, isDateInPeriod, PROCEDIMENTOS_COMPLEMENTARES } from '../helpers';

export const SCHEMA_VERSION_KEY = 'endodiagnose_schema_version';
export const CURRENT_SCHEMA_VERSION = 4;

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
    const now = new Date().toISOString();
    const updatedList = list.map((item) => {
      if (!item) return item;
      const transformed = transformFn({ ...item });
      if (JSON.stringify(transformed) !== JSON.stringify(item)) {
        changed = true;
        updatedCount++;
        const withTimestamp = { ...transformed, updatedAt: now };
        if (withTimestamp.id) {
          enqueueSyncOperation({
            module,
            entityId: withTimestamp.id,
            type: 'UPSERT',
            payload: withTimestamp,
          });
        }
        return withTimestamp;
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
      const PROC_COMPL = PROCEDIMENTOS_COMPLEMENTARES;
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

    // Migração V3: Assegurar medicoId em medicos e vincular medicoId/medico2Id nos exames existentes
    if (storedVersion < 3) {
      const doctorMap = {};
      migrate(MODULES.medicos, (m) => {
        const id = m.id || generateId();
        if (m.nome) {
          doctorMap[m.nome.trim().toUpperCase()] = id;
        }
        return m.id ? m : { ...m, id };
      });

      const assignDoctorIds = (item) => {
        let changed = false;
        const updated = { ...item };
        if (updated.medico && !updated.medicoId) {
          const mId = doctorMap[updated.medico.trim().toUpperCase()];
          if (mId) {
            updated.medicoId = mId;
            changed = true;
          }
        }
        if (updated.medico2 && !updated.medico2Id) {
          const m2Id = doctorMap[updated.medico2.trim().toUpperCase()];
          if (m2Id) {
            updated.medico2Id = m2Id;
            changed = true;
          }
        }
        return changed ? updated : item;
      };

      migrate(MODULES.exames, assignDoctorIds);
      migrate(MODULES.examesConvenio, assignDoctorIds);
      migrate(MODULES.detalhesExames, assignDoctorIds);
    }

    // Migração V4: Garantir consistência entre fluxoData e fluxoPeriodoStart em examesConvenio
    // sem sobrescrever datas legítimas de recebimento posterior de convênios.
    if (storedVersion < 4) {
      migrate(MODULES.examesConvenio, (cItem) => {
        if (!cItem) return cItem;
        const refDateStr = cItem.fluxoData || cItem.data;
        if (!refDateStr) return cItem;
        const parsed = new Date(String(refDateStr).slice(0, 10) + 'T00:00:00');
        if (Number.isNaN(parsed.getTime())) return cItem;

        const targetPeriod = getAcquisitionPeriod(parsed);
        if (!targetPeriod || !targetPeriod.start) return cItem;

        const needsPeriodFix =
          !cItem.fluxoPeriodoStart ||
          !cItem.fluxoPeriodoEnd ||
          !isDateInPeriod(String(refDateStr).slice(0, 10), {
            start: cItem.fluxoPeriodoStart,
            end: cItem.fluxoPeriodoEnd,
          });

        if (needsPeriodFix) {
          return {
            ...cItem,
            fluxoPeriodoStart: targetPeriod.start,
            fluxoPeriodoEnd: targetPeriod.end,
            fluxoPeriodoLabel: targetPeriod.label,
          };
        }
        return cItem;
      });

      if (typeof convenioSyncFns.syncAllConveniosToDetalhes === 'function') {
        convenioSyncFns.syncAllConveniosToDetalhes();
      }
      if (typeof convenioSyncFns.syncConveniosFluxoConsolidado === 'function') {
        convenioSyncFns.syncConveniosFluxoConsolidado();
      }
    }

    storage.setItem(SCHEMA_VERSION_KEY, String(CURRENT_SCHEMA_VERSION));
    _hasRunMigrations = true;
  } catch (err) {
    console.error('Migration error:', err);
  }
}
