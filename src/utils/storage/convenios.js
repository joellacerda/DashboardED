import {
  getData,
  setData,
  addItem,
  updateItem,
  deleteItem,
  notifyDataChanged,
  MODULES,
} from './core';
import { saveToCloud, deleteFromCloud } from '../../services/firebase';
import { getAcquisitionPeriod, isDateInPeriod, getTodayISO } from '../helpers';

/**
 * Normalizes convênio names, returning standard key and display name.
 * Formats Unimed as "UNIMED" and Coopend as "COOPEND" (caixa alta para fluxo de caixa).
 */
export function normalizeConvenioName(raw) {
  if (!raw) return { key: '', display: '' };
  const trimmed = raw.trim();
  const upper = trimmed.toUpperCase();
  if (upper === 'UNIMED' || upper.startsWith('UNIMED')) {
    return { key: 'UNIMED', display: 'UNIMED' };
  }
  if (upper === 'COOPEND' || upper.startsWith('COOPEND')) {
    return { key: 'COOPEND', display: 'COOPEND' };
  }
  return { key: upper, display: upper };
}

/**
 * Resolves the Fluxo de Caixa destination for any convênio exam payment.
 *
 * Business Rule:
 * - Unimed is a direct health plan accreditation and consolidates under "UNIMED".
 * - Coopend is NOT an individual health plan; it represents the medical clearing cooperative
 *   that pays the clinic for ALL health insurance plans that are NOT Unimed.
 */
export function getConvenioFluxoDestino(raw) {
  if (!raw || !raw.trim()) {
    return { key: 'COOPEND', display: 'COOPEND', isUnimed: false, isCoopend: true };
  }
  const trimmed = raw.trim();
  const upper = trimmed.toUpperCase();
  if (upper === 'UNIMED' || upper.startsWith('UNIMED')) {
    return { key: 'UNIMED', display: 'UNIMED', isUnimed: true, isCoopend: false, convenioOrigem: trimmed };
  }
  return { key: 'COOPEND', display: 'COOPEND', isUnimed: false, isCoopend: true, convenioOrigem: trimmed };
}

/**
 * Sincroniza um único exame de convênio com detalhesExames.
 *
 * REGRA DO ITEM 4.5:
 * Não apaga o detalhe existente sem confirmação explícita quando houver ajuste manual (manualOverride: true).
 */
export function syncConvenioToDetalhes(convenioItem, forceOverride = false) {
  if (!convenioItem || !convenioItem.id) return null;

  const hasDivisao =
    (convenioItem.valorClinica !== undefined && convenioItem.valorClinica !== '' && convenioItem.valorClinica !== null) ||
    (convenioItem.valorMedico !== undefined && convenioItem.valorMedico !== '' && convenioItem.valorMedico !== null) ||
    convenioItem.fluxoLancado ||
    (convenioItem.valorRepasse !== undefined && Number(convenioItem.valorRepasse) > 0);

  const detalhesList = getData(MODULES.detalhesExames) || [];
  const syncId = `conv_${convenioItem.id}`;
  const existingIdx = detalhesList.findIndex((d) => d.id === syncId || d.origemConvenioId === convenioItem.id);

  if (!hasDivisao) {
    if (existingIdx !== -1) {
      const existing = detalhesList[existingIdx];
      // Item 4.5: Se o detalhe possui ajuste manual e não foi forçado, NÃO apaga silenciosamente!
      if (existing.manualOverride && !forceOverride) {
        return existing;
      }
      deleteItem(MODULES.detalhesExames, existing.id);
    }
    return null;
  }

  const valClinicaNum = parseFloat(convenioItem.valorClinica) || 0;
  const valMedicoNum = parseFloat(convenioItem.valorMedico) || 0;
  const total = valClinicaNum + valMedicoNum;
  const pctMedicoTotal = convenioItem.percentualMedico !== undefined && convenioItem.percentualMedico !== null
    ? Number(convenioItem.percentualMedico)
    : 60;
  const pctClinica = Math.max(0, 100 - pctMedicoTotal);
  const totalHonorariosMedicos = convenioItem.direitoMedico !== undefined && Number(convenioItem.direitoMedico) >= 0
    ? Number(convenioItem.direitoMedico)
    : (total * pctMedicoTotal) / 100;
  const direitoClinica = convenioItem.direitoClinica !== undefined && Number(convenioItem.direitoClinica) >= 0
    ? Number(convenioItem.direitoClinica)
    : (total * pctClinica) / 100;

  const temDiv2 = !!(convenioItem.temDivisaoMedico2 && convenioItem.medico2);
  const pctMed1 = temDiv2 ? (Number(convenioItem.porcentagemMedico1) || 0) : 100;
  const pctMed2 = temDiv2 ? (Number(convenioItem.porcentagemMedico2) || 0) : 0;

  const direitoMed1 = (totalHonorariosMedicos * pctMed1) / 100;
  const direitoMed2 = temDiv2 ? (totalHonorariosMedicos * pctMed2) / 100 : 0;

  const difMed1 = Math.max(0, direitoMed1 - valMedicoNum);
  const difMed2 = direitoMed2;

  const repMed1 = convenioItem.valorRepasseMedico1 !== undefined && Number(convenioItem.valorRepasseMedico1) >= 0
    ? Number(convenioItem.valorRepasseMedico1)
    : difMed1;
  const repMed2 = convenioItem.valorRepasseMedico2 !== undefined && Number(convenioItem.valorRepasseMedico2) >= 0
    ? Number(convenioItem.valorRepasseMedico2)
    : difMed2;
  const repasseTotal = convenioItem.valorRepasse !== undefined && Number(convenioItem.valorRepasse) >= 0
    ? Number(convenioItem.valorRepasse)
    : (repMed1 + repMed2);

  const cNome = (convenioItem.convenio || '').trim().toUpperCase();
  const formaStr = cNome ? `Convênio (${cNome})` : 'Convênio';
  const effectiveData = convenioItem.fluxoData || convenioItem.data;

  // Se o exame já existe e possui manualOverride ativado (e não foi solicitada restauração forçada),
  // protegemos os campos financeiros customizados pelo usuário
  if (existingIdx !== -1) {
    const existing = detalhesList[existingIdx];
    if (existing.manualOverride && !forceOverride) {
      const preservedRecord = {
        ...existing,
        convenio: cNome,
        dataOriginalExame: convenioItem.data,
        paciente: (convenioItem.paciente || existing.paciente || '').trim().toUpperCase(),
        tipoExame: (convenioItem.exame || existing.tipoExame || '').trim().toUpperCase(),
        procedimentoComplementar: convenioItem.procedimentoComplementar || existing.procedimentoComplementar || '',
        medico: (convenioItem.medico || existing.medico || '').trim().toUpperCase(),
        medico2: temDiv2 && convenioItem.medico2 ? convenioItem.medico2.trim().toUpperCase() : (existing.medico2 || ''),
        temDivisao: temDiv2 || Boolean(existing.temDivisao),
        manualOverride: true,
        updatedAt: new Date().toISOString(),
      };
      updateItem(MODULES.detalhesExames, existing.id, preservedRecord);
      return preservedRecord;
    }
  }

  const detalheRecord = {
    id: syncId,
    origemConvenioId: convenioItem.id,
    isConvenio: true,
    manualOverride: false,
    convenio: cNome,
    data: effectiveData,
    dataOriginalExame: convenioItem.data,
    paciente: (convenioItem.paciente || '').trim().toUpperCase(),
    tipoExame: (convenioItem.exame || '').trim().toUpperCase(),
    procedimentoComplementar: convenioItem.procedimentoComplementar || '',
    medico: (convenioItem.medico || '').trim().toUpperCase(),
    temDivisao: temDiv2,
    medico2: temDiv2 && convenioItem.medico2 ? convenioItem.medico2.trim().toUpperCase() : '',
    divisaoTipo: 'valor',
    porcentagemMedico1: pctMed1,
    porcentagemMedico2: pctMed2,
    valorMedico1: Math.round(repMed1 * 100) / 100,
    valorMedico2: Math.round(repMed2 * 100) / 100,
    honorariosMedicos: Math.round(repasseTotal * 100) / 100,
    taxaClinica: Math.round(direitoClinica * 100) / 100,
    valorAcessorios: Math.round((Number(convenioItem.valorAcessorio) || 0) * 100) / 100,
    acessorioParaMedico: false,
    valorCompensacaoClinica: Math.round((Number(convenioItem.valorCompensacaoClinica) || 0) * 100) / 100,
    valorPagamento: Math.round((total > 0 ? total : valClinicaNum) * 100) / 100,
    numParcelas: '1',
    formaPagamento: formaStr,
    pagamentos: [
      {
        forma: formaStr,
        valor: Math.round((total > 0 ? total : valClinicaNum) * 100) / 100,
        parcelas: 1,
      },
    ],
    updatedAt: new Date().toISOString(),
  };

  if (existingIdx !== -1) {
    updateItem(MODULES.detalhesExames, detalhesList[existingIdx].id, detalheRecord);
  } else {
    addItem(MODULES.detalhesExames, detalheRecord);
  }
  return detalheRecord;
}

/**
 * Reverte o ajuste manual para um item sincronizado de convênio, restaurando o cálculo padrão.
 */
export function revertConvenioOverride(detalhesId) {
  try {
    const detalhes = getData(MODULES.detalhesExames) || [];
    const item = detalhes.find((d) => d.id === detalhesId);
    if (!item || !item.origemConvenioId) return null;
    const convenios = getData(MODULES.examesConvenio) || [];
    const conv = convenios.find((c) => c.id === item.origemConvenioId);
    if (!conv) return null;
    return syncConvenioToDetalhes(conv, true);
  } catch (err) {
    console.error('Error reverting convenio override:', err);
    return null;
  }
}

/**
 * Sincroniza todos os examesConvenio com detalhesExames.
 */
export function syncAllConveniosToDetalhes() {
  try {
    const convenios = getData(MODULES.examesConvenio) || [];
    const validConvenioIds = new Set(convenios.map((c) => c.id));
    const detalhesList = getData(MODULES.detalhesExames) || [];

    // Remove registros órfãos cujo convênio de origem foi excluído, exceto se tiver ajuste manual
    detalhesList.forEach((d) => {
      if (d.origemConvenioId && !validConvenioIds.has(d.origemConvenioId)) {
        if (!d.manualOverride) {
          deleteItem(MODULES.detalhesExames, d.id);
        }
      }
    });

    convenios.forEach((c) => {
      syncConvenioToDetalhes(c);
    });
  } catch (err) {
    console.error('Error syncing convenios to detalhes:', err);
  }
}

/**
 * Remove ou desvincula o registro sincronizado em detalhesExames ao excluir um convênio.
 * Se houver ajuste manual (manualOverride: true) e force !== true, desvincula mas preserva o registro.
 */
export function removeConvenioFromDetalhes(convenioId, force = false) {
  try {
    const detalhesList = getData(MODULES.detalhesExames) || [];
    const syncId = `conv_${convenioId}`;
    const found = detalhesList.find((d) => d.id === syncId || d.origemConvenioId === convenioId);
    if (found) {
      if (found.manualOverride && !force) {
        // Item 4.5: Preserva o registro desvinculando-o do convênio excluído
        updateItem(MODULES.detalhesExames, found.id, {
          origemConvenioId: null,
          isConvenio: false,
          observacao: 'Item mantido após exclusão do convênio de origem devido a ajustes manuais',
        });
      } else {
        deleteItem(MODULES.detalhesExames, found.id);
      }
    }
    syncConveniosFluxoConsolidado();
  } catch (err) {
    console.error('Error removing convenio from detalhes:', err);
  }
}

/**
 * Sincroniza exames de convênio lançados em entradas consolidadas no Fluxo de Caixa ("UNIMED" e "COOPEND").
 */
export function syncConveniosFluxoConsolidado() {
  try {
    const convenios = getData(MODULES.examesConvenio) || [];
    const fluxoList = getData(MODULES.fluxoCaixa) || [];

    // Agrupa exames de convênio lançados por (convenioKey, periodStart)
    const groups = new Map();

    convenios.forEach((item) => {
      if (!item || !item.id) return;
      const isLancado = Boolean(
        item.fluxoLancado ||
        (item.fluxoValorLancado !== undefined && Number(item.fluxoValorLancado) > 0) ||
        (item.valorClinica !== undefined && item.valorClinica !== '' && Number(item.valorClinica) > 0)
      );
      if (!isLancado) return;

      const valorLancado = Number(item.fluxoValorLancado) > 0
        ? Number(item.fluxoValorLancado)
        : Number(item.valorClinica) || 0;
      if (valorLancado <= 0) return;

      const destino = getConvenioFluxoDestino(item.convenio);
      if (!destino.key) return;

      const paymentDate = item.fluxoData || item.data || getTodayISO();
      let pStart = item.fluxoPeriodoStart;
      let pEnd = item.fluxoPeriodoEnd;
      let pLabel = item.fluxoPeriodoLabel;

      if (!pStart || !pEnd) {
        try {
          const p = getAcquisitionPeriod(new Date(paymentDate.replace(/-/g, '/')));
          pStart = p.start;
          pEnd = p.end;
          pLabel = p.label;
        } catch {
          const p = getAcquisitionPeriod();
          pStart = p.start;
          pEnd = p.end;
          pLabel = p.label;
        }
      }

      const groupKey = `${destino.key}_${pStart}`;
      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          convenioKey: destino.key,
          displayNome: destino.display,
          periodStart: pStart,
          periodEnd: pEnd,
          periodLabel: pLabel,
          totalValor: 0,
          latestDate: paymentDate,
          examIds: [],
        });
      }

      const grp = groups.get(groupKey);
      grp.totalValor += valorLancado;
      grp.examIds.push(item.id);
      if (paymentDate > grp.latestDate) {
        grp.latestDate = paymentDate;
      }
    });

    let fluxoChanged = false;
    let nextFluxo = [...fluxoList];

    // 1. Remove entradas individuais legadas
    const filteredFluxo = nextFluxo.filter((f) => {
      if (f.convenioId) {
        fluxoChanged = true;
        deleteFromCloud(MODULES.fluxoCaixa, f.id);
        return false;
      }
      const upper = (f.nome || '').toUpperCase();
      if (upper.startsWith('REPASSE CONVÊNIO') || upper.startsWith('REPASSE CONVENIO')) {
        fluxoChanged = true;
        deleteFromCloud(MODULES.fluxoCaixa, f.id);
        return false;
      }
      return true;
    });
    nextFluxo = filteredFluxo;

    // 2. Chaves ativas consolidadas
    const activeConsolidatedKeys = new Set(groups.keys());

    // 3. Cria ou atualiza as entradas consolidadas por grupo
    groups.forEach((grp) => {
      const syncId = `conv_cons_${grp.convenioKey.toLowerCase()}_${grp.periodStart.replace(/-/g, '')}`;

      const existingIdx = nextFluxo.findIndex((f) => {
        if (f.id === syncId) return true;
        if (
          f.isConvenioConsolidado &&
          f.convenioConsolidado === grp.convenioKey &&
          (f.periodoStart === grp.periodStart || f.periodStart === grp.periodStart)
        ) {
          return true;
        }
        const fUpper = (f.nome || '').trim().toUpperCase();
        if (
          (fUpper === grp.convenioKey || fUpper === grp.displayNome.toUpperCase()) &&
          isDateInPeriod(f.data, { start: grp.periodStart, end: grp.periodEnd })
        ) {
          return true;
        }
        return false;
      });

      const roundedValor = Math.round(grp.totalValor * 100) / 100;
      const targetDate = grp.latestDate || grp.periodStart;

      const consolidatedRecord = {
        id: syncId,
        nome: grp.displayNome,
        tipo: 'entrada',
        categoria: 'Convênios / Repasses',
        valor: roundedValor,
        data: targetDate,
        isConvenioConsolidado: true,
        convenioConsolidado: grp.convenioKey,
        periodoStart: grp.periodStart,
        periodoEnd: grp.periodEnd,
        periodoLabel: grp.periodLabel,
        qtdExames: grp.examIds.length,
        examesIds: grp.examIds,
        updatedAt: new Date().toISOString(),
      };

      if (existingIdx !== -1) {
        const existing = nextFluxo[existingIdx];
        if (
          existing.valor !== roundedValor ||
          existing.nome !== grp.displayNome ||
          existing.data !== targetDate ||
          existing.qtdExames !== grp.examIds.length
        ) {
          const merged = { ...existing, ...consolidatedRecord };
          nextFluxo[existingIdx] = merged;
          saveToCloud(MODULES.fluxoCaixa, merged);
          fluxoChanged = true;
        }
      } else {
        const newItem = {
          ...consolidatedRecord,
          createdAt: new Date().toISOString(),
        };
        nextFluxo.push(newItem);
        saveToCloud(MODULES.fluxoCaixa, newItem);
        fluxoChanged = true;
      }
    });

    // 4. Remove entradas consolidadas antigas sem exames ativos
    const finalFluxo = nextFluxo.filter((f) => {
      if (f.isConvenioConsolidado || (f.id && String(f.id).startsWith('conv_cons_'))) {
        const upperNome = (f.nome || '').trim().toUpperCase();
        if (upperNome !== 'UNIMED' && upperNome !== 'COOPEND') {
          fluxoChanged = true;
          deleteFromCloud(MODULES.fluxoCaixa, f.id);
          return false;
        }
        const convK = f.convenioConsolidado || (upperNome === 'UNIMED' ? 'UNIMED' : 'COOPEND');
        const pK = f.periodoStart || f.periodStart;
        const fKey = `${convK}_${pK}`;
        if (!activeConsolidatedKeys.has(fKey)) {
          fluxoChanged = true;
          deleteFromCloud(MODULES.fluxoCaixa, f.id);
          return false;
        }
      }
      return true;
    });

    if (fluxoChanged) {
      setData(MODULES.fluxoCaixa, finalFluxo);
      notifyDataChanged(MODULES.fluxoCaixa);
    }

    return finalFluxo;
  } catch (err) {
    console.error('Error syncing convenios fluxo consolidado:', err);
    return null;
  }
}
