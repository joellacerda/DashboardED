import {
  formatCurrency,
  roundCurrency,
  isDateInPeriod,
  isDoctorMatch,
  isConvenioDetalhe,
  matchParticularExamToDetalhe,
  getHonorarioMedicoInPeriod,
  navigateAcquisitionPeriod,
  sanitizeCsvCell,
  downloadBlob,
} from './helpers';
import {
  getAllDoctors as getAllDoctorsUnified,
  calculateDoctorRepasseInPeriod,
} from './repasseCalculation';

export const getAllDoctors = getAllDoctorsUnified;

/**
 * Calcula métricas detalhadas, atendimentos e fechamento de repasse para um médico específico em um período.
 *
 * @param {string} doctorName - Nome do médico
 * @param {object} period - Período aquisitivo { start, end, label }
 * @param {object} data - Objeto de dados globais
 * @returns {object|null} Métricas e extrato do médico
 */
export function getDoctorPeriodMetrics(doctorName, period, data = {}) {
  if (!doctorName || !period) return null;

  const repasseInfo = calculateDoctorRepasseInPeriod(doctorName, period, data);
  if (!repasseInfo) return null;

  const { doctor, nome: targetName } = repasseInfo;
  const detalhesExames = data.detalhesExames || [];
  const examesConvenio = data.examesConvenio || [];

  // --- 1. Procedimentos Particulares ---
  const procedimentosParticulares = [];
  let totalFaturamentoParticulares = 0;
  const examesList = data.exames || [];

  detalhesExames.forEach((exam) => {
    if (isConvenioDetalhe(exam)) {
      return;
    }

    const honNoPeriodo = getHonorarioMedicoInPeriod(exam, doctor, period);
    const doc1 = (exam.medico || '').trim().toUpperCase();
    const doc2 = (exam.medico2 || '').trim().toUpperCase();
    const isDoc1 = isDoctorMatch(doctor, exam.medico, exam.medicoId);
    const isDoc2 = isDoctorMatch(doctor, exam.medico2, exam.medico2Id);

    const isMedicoNesteExame = isDoc1 || isDoc2;
    const realizadoNoPeriodo = isDateInPeriod(exam.data, period);
    const isNoPeriodo = realizadoNoPeriodo || honNoPeriodo > 0;

    if (isMedicoNesteExame && isNoPeriodo) {
      const isSplit = !!(exam.temDivisao || exam.medico2);
      const outroMedico = isDoc1 ? doc2 : doc1;
      const valExam = Number(exam.valorPagamento ?? exam.valorTotal) || 0;

      procedimentosParticulares.push({
        id: exam.id || `${exam.data}_${exam.paciente}`,
        data: exam.data,
        paciente: exam.paciente || 'Paciente Não Identificado',
        exame: exam.tipoExame || exam.exame || 'Exame Particular',
        tipo: 'Particular',
        convenioNome: null,
        valorTotal: valExam,
        honorarioMedico: honNoPeriodo,
        isSplit,
        outroMedico: isSplit ? outroMedico : null,
        isMainDoctor: isDoc1,
        realizadoNoPeriodo,
      });

      // Só soma faturamento integral no período em que o exame foi realizado (evita inflação em parcelamentos)
      if (realizadoNoPeriodo) {
        totalFaturamentoParticulares += valExam;
      }
    }
  });

  // Inclui também exames particulares cadastrados em `exames` que ainda não possuem registro em `detalhesExames`
  examesList.forEach((exam) => {
    if (!exam || !isDateInPeriod(exam.data, period)) return;
    if (detalhesExames.some((d) => matchParticularExamToDetalhe(exam, d))) return;

    const doc1Name = (exam.medico || '').trim().toUpperCase();
    const doc2Name = (exam.medico2 || '').trim().toUpperCase();
    const isDoc1 = isDoctorMatch(doctor, exam.medico, exam.medicoId);
    const isDoc2 = isDoctorMatch(doctor, exam.medico2, exam.medico2Id);
    if (!isDoc1 && !isDoc2) return;

    const isSplit = !!(exam.temDivisao || exam.medico2);
    const outroMedico = isDoc1 ? doc2Name : doc1Name;

    procedimentosParticulares.push({
      id: exam.id || `${exam.data}_${exam.paciente}`,
      data: exam.data,
      paciente: exam.paciente || 'Paciente Não Identificado',
      exame: exam.exame || exam.tipoExame || 'Exame Particular',
      tipo: 'Particular',
      convenioNome: null,
      valorTotal: 0,
      honorarioMedico: 0,
      isSplit,
      outroMedico: isSplit ? outroMedico : null,
      isMainDoctor: isDoc1,
      realizadoNoPeriodo: true,
    });
  });

  // --- 2. Procedimentos de Convênio ---
  const procedimentosConvenios = [];
  let totalFaturamentoConvenios = 0;

  examesConvenio.forEach((c) => {
    const doc1 = (c.medico || '').trim().toUpperCase();
    const doc2 = (c.medico2 || '').trim().toUpperCase();
    const isDoc1 = isDoctorMatch(doctor, c.medico, c.medicoId);
    const isDoc2 = isDoctorMatch(doctor, c.medico2, c.medico2Id);

    if (!isDoc1 && !isDoc2) return;

    const syncedDet = detalhesExames.find(
      (d) => d.origemConvenioId === c.id || d.id === `conv_${c.id}`
    );

    const honMedicoSynced = syncedDet ? getHonorarioMedicoInPeriod(syncedDet, doctor, period) : 0;
    const dataRef = syncedDet?.data || c.fluxoData || c.data;
    const inPeriodByDate = isDateInPeriod(dataRef, period);
    if (!inPeriodByDate && honMedicoSynced <= 0) return;

    let honMedico = 0;
    if (syncedDet) {
      honMedico = honMedicoSynced;
    } else if (isDoc1) {
      honMedico = Number(c.valorRepasseMedico1 ?? (c.temDivisaoMedico2 ? 0 : c.valorRepasse || 0));
    } else if (isDoc2) {
      honMedico = Number(c.valorRepasseMedico2 || 0);
    }

    const valFaturado =
      Number(c.fluxoValorLancado) || (Number(c.valorClinica || 0) + Number(c.valorMedico || 0));

    procedimentosConvenios.push({
      id: c.id || `${c.data}_${c.paciente}`,
      data: c.data,
      paciente: c.paciente || 'Paciente Não Identificado',
      exame: c.exame || 'Exame de Convênio',
      tipo: 'Convênio',
      convenioNome: c.convenio || 'Convênio',
      valorTotal: valFaturado,
      honorarioMedico: honMedico,
      isSplit: !!(c.temDivisaoMedico2 || c.medico2),
      outroMedico: isDoc1 ? doc2 : doc1,
      isMainDoctor: isDoc1,
      realizadoNoPeriodo: isDateInPeriod(c.data, period),
    });

    totalFaturamentoConvenios += valFaturado;
  });

  // --- 3. Extrato Unificado de Procedimentos (ordenado por data ISO mais recente) ---
  const todosProcedimentos = [...procedimentosParticulares, ...procedimentosConvenios].sort(
    (a, b) => String(b.data || '').localeCompare(String(a.data || ''))
  );

  const countParticularesRealizados = procedimentosParticulares.filter(
    (p) => p.isMainDoctor !== false && p.realizadoNoPeriodo !== false
  ).length;
  const countConveniosRealizados = procedimentosConvenios.filter(
    (p) => p.isMainDoctor !== false && p.realizadoNoPeriodo !== false
  ).length;
  const totalProcedimentos = countParticularesRealizados + countConveniosRealizados;
  const totalHonorariosParticulares = repasseInfo.honParticular;
  const totalHonorariosConvenios = repasseInfo.honConvenio;
  const totalHonorariosBrutos = repasseInfo.honTotal;
  const ticketMedioHonorario =
    totalProcedimentos > 0 ? totalHonorariosBrutos / totalProcedimentos : 0;

  // --- 4. Distribuição por Tipo de Exame Realizado ---
  const procedimentosPorTipoMap = {};
  todosProcedimentos.forEach((p) => {
    if (p.isMainDoctor === false) return;
    const tipo = (p.exame || 'Outros').trim();
    if (!procedimentosPorTipoMap[tipo]) {
      procedimentosPorTipoMap[tipo] = { nome: tipo, quantidade: 0, honorarios: 0 };
    }
    if (p.realizadoNoPeriodo !== false) {
      procedimentosPorTipoMap[tipo].quantidade += 1;
    }
    procedimentosPorTipoMap[tipo].honorarios = roundCurrency(
      procedimentosPorTipoMap[tipo].honorarios + p.honorarioMedico
    );
  });

  const rankingProcedimentos = Object.values(procedimentosPorTipoMap)
    .filter((item) => item.quantidade > 0 || item.honorarios > 0)
    .sort((a, b) => b.quantidade - a.quantidade || b.honorarios - a.honorarios);

  // --- 6. Participação do médico no volume total da clínica ---
  const examesParticularesClinica = examesList.filter((e) => isDateInPeriod(e.data, period));
  const standaloneDetalhesClinica = detalhesExames.filter(
    (d) =>
      !isConvenioDetalhe(d) &&
      isDateInPeriod(d.data, period) &&
      !examesParticularesClinica.some((e) => matchParticularExamToDetalhe(e, d))
  );
  const totalExamesClinica =
    examesParticularesClinica.length +
    standaloneDetalhesClinica.length +
    (data.examesConvenio || []).filter((c) => isDateInPeriod(c.data, period)).length;

  const participacaoVolume =
    totalExamesClinica > 0 ? (totalProcedimentos / totalExamesClinica) * 100 : 0;

  return {
    doctor,
    nome: targetName,
    isSocio: repasseInfo.isSocio,
    isAtivo: repasseInfo.isAtivo,
    period,
    totalProcedimentos,
    participacaoVolume: Math.round(participacaoVolume * 10) / 10,
    // Particulares
    totalParticulares: countParticularesRealizados,
    totalHonorariosParticulares: roundCurrency(totalHonorariosParticulares),
    totalFaturamentoParticulares: roundCurrency(totalFaturamentoParticulares),
    // Convênios
    totalConvenios: countConveniosRealizados,
    totalHonorariosConvenios: roundCurrency(totalHonorariosConvenios),
    totalFaturamentoConvenios: roundCurrency(totalFaturamentoConvenios),
    // Totais e Médias
    totalHonorariosBrutos: roundCurrency(totalHonorariosBrutos),
    ticketMedioHonorario: roundCurrency(ticketMedioHonorario),
    // Ajustes
    creditos: repasseInfo.creditos,
    debitos: repasseInfo.debitos,
    compensacaoConvenios: repasseInfo.compensacaoConvenios,
    compensacaoItems: repasseInfo.compensacaoItems,
    bnb: repasseInfo.bnb,
    cotaClinica: repasseInfo.cotaClinica,
    totalAjustesLiquidos: repasseInfo.totalAjustesLiquidosComCota,
    obs: repasseInfo.obs,
    // Repasse Líquido
    repasseLiquido: repasseInfo.repasseLiquido,
    // Listas e Rankings
    procedimentos: todosProcedimentos,
    rankingProcedimentos,
  };
}

/**
 * Retorna a evolução histórica dos últimos N períodos do médico para renderização de gráficos e tendências.
 *
 * @param {string} doctorName - Nome do médico
 * @param {object} currentPeriod - Período atual de referência
 * @param {object} data - Objeto de dados globais
 * @param {number} numPeriods - Quantidade de períodos retroativos (padrão: 6)
 * @returns {Array} Array de métricas históricas ordenadas cronologicamente
 */
export function getDoctorHistoricalEvolution(
  doctorName,
  currentPeriod,
  data = {},
  numPeriods = 6
) {
  if (!doctorName || !currentPeriod) return [];

  const periods = [];
  let curr = currentPeriod;
  for (let i = 0; i < numPeriods; i++) {
    periods.unshift(curr);
    curr = navigateAcquisitionPeriod(curr, -1);
  }

  return periods.map((p) => {
    const metrics = getDoctorPeriodMetrics(doctorName, p, data);
    return {
      period: p,
      label: p.label,
      start: p.start,
      end: p.end,
      totalProcedimentos: metrics?.totalProcedimentos || 0,
      totalParticulares: metrics?.totalParticulares || 0,
      totalConvenios: metrics?.totalConvenios || 0,
      honorariosParticulares: metrics?.totalHonorariosParticulares || 0,
      honorariosConvenios: metrics?.totalHonorariosConvenios || 0,
      totalHonorariosBrutos: metrics?.totalHonorariosBrutos || 0,
      repasseLiquido: metrics?.repasseLiquido || 0,
    };
  });
}

/**
 * Exporta o extrato individual do médico para CSV formatado para Excel com delimitador ponto e vírgula e BOM UTF-8.
 *
 * @param {object} metrics - Retorno de getDoctorPeriodMetrics
 * @param {object} period - Período aquisitivo
 */
export function exportDoctorStatementCSV(metrics, period) {
  if (!metrics || !period) return;

  const lines = [];
  const addLine = (row = []) =>
    lines.push(row.map((cell) => sanitizeCsvCell(cell)).join(';'));

  // 1. Cabeçalho
  addLine(['CLÍNICA ENDODIAGNOSE — EXTRATO INDIVIDUAL DE REPASSE MÉDICO']);
  addLine(['Médico', metrics.nome, metrics.isSocio ? 'Sócio da Clínica' : 'Médico Prestador']);
  addLine(['Competência', period.label, `De ${period.start} até ${period.end}`]);
  addLine([
    'Emissão',
    new Date().toLocaleDateString('pt-BR') + ' às ' + new Date().toLocaleTimeString('pt-BR'),
  ]);
  addLine([]);

  // 2. Indicadores Principais
  addLine(['RESUMO DO PERÍODO']);
  addLine(['Total de Procedimentos Realizados', metrics.totalProcedimentos]);
  addLine(['   Exames Particulares', metrics.totalParticulares]);
  addLine(['   Exames de Convênio', metrics.totalConvenios]);
  addLine(['Honorários Brutos de Particulares', formatCurrency(metrics.totalHonorariosParticulares)]);
  addLine(['Honorários Brutos de Convênios', formatCurrency(metrics.totalHonorariosConvenios)]);
  addLine(['Total de Honorários Brutos', formatCurrency(metrics.totalHonorariosBrutos)]);
  addLine(['Ticket Médio por Procedimento', formatCurrency(metrics.ticketMedioHonorario)]);
  addLine([]);

  // 3. Demonstrativo de Fechamento de Repasse
  addLine(['FECHAMENTO E AJUSTES DE REPASSE']);
  addLine(['(+) Total de Honorários Brutos', formatCurrency(metrics.totalHonorariosBrutos)]);
  if (metrics.creditos > 0) {
    addLine(['(+) Créditos Adicionais', formatCurrency(metrics.creditos)]);
  }
  if (metrics.debitos > 0) {
    addLine(['(-) Débitos Operacionais', `-${formatCurrency(metrics.debitos)}`]);
  }
  if (metrics.compensacaoConvenios > 0) {
    addLine(['(-) Compensação Materiais/Convênios (Alças/Polipectomias)', `-${formatCurrency(metrics.compensacaoConvenios)}`]);
  }
  if (metrics.bnb > 0) {
    addLine(['(-) Retenção BNB', `-${formatCurrency(metrics.bnb)}`]);
  }
  if (metrics.cotaClinica > 0) {
    addLine(['(-) Cota de Déficit Clínico (Sócio)', `-${formatCurrency(metrics.cotaClinica)}`]);
  }
  addLine(['(=) REPASSE LÍQUIDO FINAL A RECEBER', formatCurrency(metrics.repasseLiquido)]);
  if (metrics.obs) {
    addLine(['Observações do Fechamento', metrics.obs]);
  }
  addLine([]);

  // 4. Detalhamento de Procedimentos
  addLine(['EXTRATO DETALHADO DE ATENDIMENTOS']);
  addLine([
    'Data',
    'Paciente',
    'Procedimento / Exame',
    'Origem',
    'Convênio',
    'Valor do Exame (R$)',
    'Honorário do Médico (R$)',
    'Divisão',
  ]);

  (metrics.procedimentos || []).forEach((p) => {
    addLine([
      p.data,
      p.paciente,
      p.exame,
      p.tipo,
      p.convenioNome || '—',
      formatCurrency(p.valorTotal),
      formatCurrency(p.honorarioMedico),
      p.isSplit ? `Dividido com ${p.outroMedico}` : 'Individual',
    ]);
  });

  const BOM = '\uFEFF';
  const csvContent = BOM + lines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const filenameSafe = metrics.nome.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  downloadBlob(blob, `extrato_medico_${filenameSafe}_${period.start}_${period.end}.csv`);
}
