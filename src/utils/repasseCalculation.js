import {
  roundCurrency,
  isDateInPeriod,
  isDoctorMatch,
  isConvenioDetalhe,
  getHonorarioMedicoInPeriod,
  getDoctorCompensacaoInPeriod,
  isCompensacaoTargetDoctor,
} from './helpers';

/**
 * Retorna a lista unificada de todos os médicos cadastrados ou presentes nos registros.
 *
 * @param {object} data - Objeto contendo coleções { medicos, detalhesExames, examesConvenio, exames }
 * @returns {Array} Lista de médicos normalizada [{ id, nome, socio, ativo, auto }]
 */
export function getAllDoctors(data = {}) {
  const medicosList = data.medicos || [];
  const detalhesExames = data.detalhesExames || [];
  const examesConvenio = data.examesConvenio || [];
  const exames = data.exames || [];

  const list = medicosList.map((m) => ({
    ...m,
    id: m.id || (m.nome || '').trim().toUpperCase(),
    nome: (m.nome || '').trim().toUpperCase(),
    ativo: m.ativo !== false,
    socio: m.socio !== false,
  }));

  const registeredNames = new Set(list.map((m) => m.nome));

  const addIfMissing = (name, defaultSocio = false) => {
    if (!name) return;
    const clean = name.trim().toUpperCase();
    if (!clean || registeredNames.has(clean)) return;
    registeredNames.add(clean);
    list.push({
      id: `auto_${clean}`,
      nome: clean,
      socio: defaultSocio,
      ativo: true,
      auto: true,
    });
  };

  detalhesExames.forEach((e) => {
    addIfMissing(e.medico);
    addIfMissing(e.medico2);
  });

  examesConvenio.forEach((c) => {
    addIfMissing(c.medico);
    addIfMissing(c.medico2);
    if (Number(c.valorCompensacaoClinica) > 0 && !list.some((d) => isCompensacaoTargetDoctor(d))) {
      addIfMissing('DR. OLIVEIRA', false);
    }
  });

  exames.forEach((e) => {
    addIfMissing(e.medico);
  });

  return list.sort((a, b) => {
    const aActive = a.ativo !== false;
    const bActive = b.ativo !== false;
    if (aActive !== bActive) {
      return aActive ? -1 : 1;
    }
    const aOrd = Number(a.ordem);
    const bOrd = Number(b.ordem);
    const aHasOrd =
      a.ordem !== undefined && a.ordem !== null && a.ordem !== '' && Number.isFinite(aOrd);
    const bHasOrd =
      b.ordem !== undefined && b.ordem !== null && b.ordem !== '' && Number.isFinite(bOrd);
    if (aHasOrd && bHasOrd && aOrd !== bOrd) {
      return aOrd - bOrd;
    }
    if (aHasOrd !== bHasOrd) {
      return aHasOrd ? -1 : 1;
    }
    return a.nome.localeCompare(b.nome, 'pt-BR');
  });
}

/**
 * Calcula entradas, saídas e déficit operacional do Fluxo de Caixa no período.
 */
export function calculateClinicDeficitInPeriod(fluxoCaixa = [], period) {
  if (!period) {
    return { totalEntradasFluxo: 0, totalSaidasFluxo: 0, deficitClinica: 0 };
  }
  const periodFluxo = (fluxoCaixa || []).filter((f) => isDateInPeriod(f.data, period));
  const totalEntradasFluxo = periodFluxo
    .filter((f) => f.tipo === 'entrada')
    .reduce((s, f) => s + Number(f.valor || 0), 0);
  const totalSaidasFluxo = periodFluxo
    .filter((f) => f.tipo === 'saida')
    .reduce((s, f) => s + Number(f.valor || 0), 0);
  const deficitClinica = Math.max(0, totalSaidasFluxo - totalEntradasFluxo);

  return {
    totalEntradasFluxo: roundCurrency(totalEntradasFluxo),
    totalSaidasFluxo: roundCurrency(totalSaidasFluxo),
    deficitClinica: roundCurrency(deficitClinica),
  };
}

/**
 * Calcula de forma unificada o repasse de um médico específico em um período aquisitivo.
 * Usado por useRepasseData, medicoAnalytics e relatorioConsolidado para garantir 100% de consistência.
 *
 * @param {object|string} doctorOrName - Objeto do médico ou nome
 * @param {object} period - Período aquisitivo { start, end, label }
 * @param {object} data - Coleções { medicos, detalhesExames, examesConvenio, fluxoCaixa, repassesAjustes, exames }
 * @param {object} [precomputed] - Contexto pré-calculado opcional { allDoctors, deficitClinica, countSocios, cotaPorSocio }
 */
export function calculateDoctorRepasseInPeriod(doctorOrName, period, data = {}, precomputed = null) {
  if (!doctorOrName || !period) return null;

  const allDoctors = precomputed?.allDoctors || getAllDoctors(data);
  const targetName =
    typeof doctorOrName === 'string'
      ? doctorOrName.trim().toUpperCase()
      : (doctorOrName.nome || '').trim().toUpperCase();

  const doctor =
    (typeof doctorOrName === 'object' && doctorOrName.nome
      ? {
        ...doctorOrName,
        nome: targetName,
        socio: doctorOrName.socio !== false,
        ativo: doctorOrName.ativo !== false,
      }
      : allDoctors.find((d) => isDoctorMatch(doctorOrName, d.nome, d.id))) || {
    id: `auto_${targetName}`,
    nome: targetName,
    socio: false,
    ativo: true,
    auto: true,
  };

  const isSocio = doctor.socio !== false;
  const isAtivo = doctor.ativo !== false;

  const detalhesExames = data.detalhesExames || [];
  const examesConvenio = data.examesConvenio || [];
  const repassesAjustes = data.repassesAjustes || [];

  // 1. Honorários Particulares (via detalhesExames não-convênio)
  let honParticular = 0;
  // 2. Honorários de Convênio (prioriza detalhesExames sincronizados para respeitar manualOverride,
  //    com fallback para examesConvenio caso ainda não sincronizados)
  let honConvenio = 0;
  const syncedConvenioIds = new Set();

  detalhesExames.forEach((exam) => {
    if (!exam) return;
    const isConv = isConvenioDetalhe(exam);
    if (isConv) {
      const originId = exam.origemConvenioId || String(exam.id || '').replace(/^conv_/, '');
      if (originId) syncedConvenioIds.add(String(originId));
      honConvenio += getHonorarioMedicoInPeriod(exam, doctor, period);
    } else {
      honParticular += getHonorarioMedicoInPeriod(exam, doctor, period);
    }
  });

  // Fallback para convênios que não estejam espelhados em detalhesExames
  examesConvenio.forEach((c) => {
    if (!c) return;
    if (c.id && syncedConvenioIds.has(String(c.id))) return;

    const dataRef = c.fluxoData || c.data;
    if (!isDateInPeriod(dataRef, period)) return;

    const isDoc1 = isDoctorMatch(doctor, c.medico, c.medicoId);
    const isDoc2 = isDoctorMatch(doctor, c.medico2, c.medico2Id);
    if (!isDoc1 && !isDoc2) return;

    if (isDoc1) {
      honConvenio += Number(c.valorRepasseMedico1 ?? (c.temDivisaoMedico2 ? 0 : c.valorRepasse || 0));
    }
    if (isDoc2) {
      honConvenio += Number(c.valorRepasseMedico2 || 0);
    }
  });

  const honTotal = honParticular + honConvenio;

  // 3. Compensações de materiais/alças/polipectomia devidas à clínica
  const compensacaoInfo = getDoctorCompensacaoInPeriod(doctor, period, examesConvenio);
  const compensacaoConvenios = compensacaoInfo.total;

  // 4. Ajustes manuais do período (busca por chave exata, medicoId ou nome normalizado sem acentos)
  const key = `${doctor.nome.toLowerCase()}_${period.start}`;
  const ajuste =
    repassesAjustes.find(
      (a) =>
        a &&
        (a.key === key ||
          (a.periodStart === period.start &&
            ((doctor.id && !doctor.auto && a.medicoId && String(a.medicoId) === String(doctor.id)) ||
              isDoctorMatch(doctor, a.medicoNome, a.medicoId))))
    ) || {};

  const creditos = Number(ajuste.creditos) || 0;
  const debitos = Number(ajuste.debitos) || 0;
  const bnb = Number(ajuste.bnb) || 0;
  const obs = ajuste.obs || '';

  // 5. Déficit operacional da clínica e cota por sócio ativo
  let cotaPorSocio = precomputed?.cotaPorSocio;
  if (cotaPorSocio === undefined) {
    const { deficitClinica } = calculateClinicDeficitInPeriod(data.fluxoCaixa || [], period);
    const countSocios = allDoctors.filter((m) => m.socio !== false && m.ativo !== false).length;
    cotaPorSocio = countSocios > 0 && deficitClinica > 0 ? deficitClinica / countSocios : 0;
  }

  const cotaClinica = isSocio && isAtivo ? cotaPorSocio : 0;
  const ajustesLiquidos = creditos - debitos - bnb - compensacaoConvenios;
  const saldoBrutoFinal = honTotal + ajustesLiquidos - cotaClinica;
  const repasseLiquido = saldoBrutoFinal;

  return {
    doctor,
    medico: doctor,
    nome: doctor.nome,
    isSocio,
    isActive: isAtivo,
    isAtivo,
    honParticular: roundCurrency(honParticular),
    honorariosParticulares: roundCurrency(honParticular),
    honConvenio: roundCurrency(honConvenio),
    honorariosConvenio: roundCurrency(honConvenio),
    honTotal: roundCurrency(honTotal),
    honorarios: roundCurrency(honTotal),
    totalHonorariosBruto: roundCurrency(honTotal),
    creditos: roundCurrency(creditos),
    debitos: roundCurrency(debitos),
    bnb: roundCurrency(bnb),
    debitosComBnb: roundCurrency(debitos + bnb),
    compensacaoConvenio: roundCurrency(compensacaoConvenios),
    compensacaoConvenios: roundCurrency(compensacaoConvenios),
    compensacaoCount: compensacaoInfo.count,
    compensacaoItems: compensacaoInfo.items,
    ajustesLiquidos: roundCurrency(ajustesLiquidos),
    cotaClinica: roundCurrency(cotaClinica),
    cotaDeficit: roundCurrency(cotaClinica),
    totalAjustesLiquidosComCota: roundCurrency(ajustesLiquidos - cotaClinica),
    total: roundCurrency(repasseLiquido),
    repasseLiquido: roundCurrency(repasseLiquido),
    saldoBrutoFinal: roundCurrency(saldoBrutoFinal),
    obs,
    ajusteId: ajuste.id,
    key,
  };
}

/**
 * Calcula o fechamento de repasses de todos os médicos para o período.
 */
export function calculateAllDoctorsRepasseInPeriod(period, data = {}) {
  const allDoctors = getAllDoctors(data);
  const { totalEntradasFluxo, totalSaidasFluxo, deficitClinica } = calculateClinicDeficitInPeriod(
    data.fluxoCaixa || [],
    period
  );
  const countSocios = allDoctors.filter((m) => m.socio !== false && m.ativo !== false).length;
  const cotaPorSocio = countSocios > 0 && deficitClinica > 0 ? deficitClinica / countSocios : 0;

  const precomputed = {
    allDoctors,
    totalEntradasFluxo,
    totalSaidasFluxo,
    deficitClinica,
    countSocios,
    cotaPorSocio,
  };

  const rows = allDoctors.map((doc) =>
    calculateDoctorRepasseInPeriod(doc, period, data, precomputed)
  );

  return {
    allDoctors,
    totalEntradasFluxo,
    totalSaidasFluxo,
    deficitClinica,
    countSocios,
    cotaPorSocio: roundCurrency(cotaPorSocio),
    rows,
  };
}
