import {
  formatCurrency,
  roundCurrency,
  isDateInPeriod,
  getHonorarioMedicoInPeriod,
  getDoctorCompensacaoInPeriod,
  navigateAcquisitionPeriod,
  downloadBlob,
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
    id: m.id || m.nome,
    nome: (m.nome || '').trim().toUpperCase(),
    ativo: m.ativo !== false,
    socio: m.socio !== false,
  }));

  const registeredNames = new Set(list.map((m) => m.nome));

  const addIfMissing = (name) => {
    if (!name) return;
    const clean = name.trim().toUpperCase();
    if (!clean || registeredNames.has(clean)) return;
    registeredNames.add(clean);
    list.push({
      id: `auto_${clean}`,
      nome: clean,
      socio: true,
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
  });

  exames.forEach((e) => {
    addIfMissing(e.medico);
  });

  return list.sort((a, b) => a.nome.localeCompare(b.nome));
}

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

  const targetName = doctorName.trim().toUpperCase();
  const allDoctors = getAllDoctors(data);
  const doctor = allDoctors.find((d) => d.nome === targetName) || {
    id: targetName,
    nome: targetName,
    socio: true,
    ativo: true,
  };

  const detalhesExames = data.detalhesExames || [];
  const examesConvenio = data.examesConvenio || [];
  const fluxoCaixa = data.fluxoCaixa || [];
  const repassesAjustes = data.repassesAjustes || [];

  // --- 1. Procedimentos Particulares ---
  const procedimentosParticulares = [];
  let totalHonorariosParticulares = 0;
  let totalFaturamentoParticulares = 0;

  detalhesExames.forEach((exam) => {
    // Pula convênios espelhados em detalhes (serão computados na seção de convênios)
    if (exam.isConvenio) return;

    const honNoPeriodo = getHonorarioMedicoInPeriod(exam, targetName, period);
    const doc1 = (exam.medico || '').trim().toUpperCase();
    const doc2 = (exam.medico2 || '').trim().toUpperCase();

    const isMedicoNesteExame = doc1 === targetName || doc2 === targetName;
    const isNoPeriodo = isDateInPeriod(exam.data, period) || honNoPeriodo > 0;

    if (isMedicoNesteExame && isNoPeriodo) {
      const isSplit = !!(exam.temDivisao || exam.medico2);
      const outroMedico = doc1 === targetName ? doc2 : doc1;

      procedimentosParticulares.push({
        id: exam.id || `${exam.data}_${exam.paciente}`,
        data: exam.data,
        paciente: exam.paciente || 'Paciente Não Identificado',
        exame: exam.tipoExame || exam.exame || 'Exame Particular',
        tipo: 'Particular',
        convenioNome: null,
        valorTotal: Number(exam.valorPagamento ?? exam.valorTotal) || 0,
        honorarioMedico: honNoPeriodo,
        isSplit,
        outroMedico: isSplit ? outroMedico : null,
      });

      totalHonorariosParticulares += honNoPeriodo;
      totalFaturamentoParticulares += Number(exam.valorPagamento ?? exam.valorTotal) || 0;
    }
  });

  // --- 2. Procedimentos de Convênio ---
  const procedimentosConvenios = [];
  let totalHonorariosConvenios = 0;
  let totalFaturamentoConvenios = 0;

  examesConvenio.forEach((c) => {
    const doc1 = (c.medico || '').trim().toUpperCase();
    const doc2 = (c.medico2 || '').trim().toUpperCase();
    const isDoc1 = doc1 === targetName;
    const isDoc2 = doc2 === targetName;

    if (!isDoc1 && !isDoc2) return;

    // Considera o exame se realizado ou faturado na competência
    const dataRef = c.fluxoData || c.data;
    if (!isDateInPeriod(dataRef, period)) return;

    let honMedico = 0;
    if (isDoc1) {
      honMedico = Number(c.valorRepasseMedico1 || (c.temDivisaoMedico2 ? 0 : c.valorRepasse || 0));
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
    });

    totalHonorariosConvenios += honMedico;
    totalFaturamentoConvenios += valFaturado;
  });

  // --- 3. Extrato Unificado de Procedimentos (ordenado por data mais recente) ---
  const todosProcedimentos = [...procedimentosParticulares, ...procedimentosConvenios].sort(
    (a, b) => new Date(b.data || 0) - new Date(a.data || 0)
  );

  const totalProcedimentos = todosProcedimentos.length;
  const totalHonorariosBrutos = totalHonorariosParticulares + totalHonorariosConvenios;
  const ticketMedioHonorario =
    totalProcedimentos > 0 ? totalHonorariosBrutos / totalProcedimentos : 0;

  // --- 4. Distribuição por Tipo de Exame Realizado ---
  const procedimentosPorTipoMap = {};
  todosProcedimentos.forEach((p) => {
    const tipo = (p.exame || 'Outros').trim();
    if (!procedimentosPorTipoMap[tipo]) {
      procedimentosPorTipoMap[tipo] = { nome: tipo, quantidade: 0, honorarios: 0 };
    }
    procedimentosPorTipoMap[tipo].quantidade += 1;
    procedimentosPorTipoMap[tipo].honorarios += p.honorarioMedico;
  });

  const rankingProcedimentos = Object.values(procedimentosPorTipoMap).sort(
    (a, b) => b.quantidade - a.quantidade || b.honorarios - a.honorarios
  );

  // --- 5. Ajustes, Cota de Déficit e Repasse Líquido ---
  const ajusteKey = `${targetName.toLowerCase()}_${period.start}`;
  const ajuste = repassesAjustes.find((a) => a.key === ajusteKey) || {};

  const creditos = Number(ajuste.creditos) || 0;
  const debitos = Number(ajuste.debitos) || 0;
  const bnb = Number(ajuste.bnb) || 0;
  const obs = ajuste.obs || '';

  // Compensação de convênios/materiais devida à clínica
  const compensacaoInfo = getDoctorCompensacaoInPeriod(targetName, period, examesConvenio);
  const compensacaoConvenios = compensacaoInfo.total;

  // Cálculo de déficit da clínica para apuração da cota de sócio
  const fluxoNoPeriodo = fluxoCaixa.filter((f) => isDateInPeriod(f.data, period));
  const totalEntradasFluxo = fluxoNoPeriodo
    .filter((f) => f.tipo === 'entrada')
    .reduce((s, f) => s + Number(f.valor || 0), 0);
  const totalSaidasFluxo = fluxoNoPeriodo
    .filter((f) => f.tipo === 'saida')
    .reduce((s, f) => s + Number(f.valor || 0), 0);
  const deficitClinica = Math.max(0, totalSaidasFluxo - totalEntradasFluxo);

  const countSociosAtivos = allDoctors.filter((d) => d.socio && d.ativo).length;
  const cotaPorSocio =
    countSociosAtivos > 0 && deficitClinica > 0 ? deficitClinica / countSociosAtivos : 0;

  const cotaClinica = doctor.socio && doctor.ativo ? cotaPorSocio : 0;
  const totalAjustesLiquidos = creditos - debitos - compensacaoConvenios - bnb - cotaClinica;
  const repasseLiquido = Math.max(0, totalHonorariosBrutos + totalAjustesLiquidos);

  // --- 6. Participação do médico no volume total da clínica ---
  const totalExamesClinica =
    (data.exames || []).filter((e) => isDateInPeriod(e.data, period)).length +
    (data.examesConvenio || []).filter((c) => isDateInPeriod(c.data, period)).length;

  const participacaoVolume =
    totalExamesClinica > 0 ? (totalProcedimentos / totalExamesClinica) * 100 : 0;

  return {
    doctor,
    nome: targetName,
    isSocio: doctor.socio,
    isAtivo: doctor.ativo,
    period,
    totalProcedimentos,
    participacaoVolume: Math.round(participacaoVolume * 10) / 10,
    // Particulares
    totalParticulares: procedimentosParticulares.length,
    totalHonorariosParticulares: roundCurrency(totalHonorariosParticulares),
    totalFaturamentoParticulares: roundCurrency(totalFaturamentoParticulares),
    // Convênios
    totalConvenios: procedimentosConvenios.length,
    totalHonorariosConvenios: roundCurrency(totalHonorariosConvenios),
    totalFaturamentoConvenios: roundCurrency(totalFaturamentoConvenios),
    // Totais e Médias
    totalHonorariosBrutos: roundCurrency(totalHonorariosBrutos),
    ticketMedioHonorario: roundCurrency(ticketMedioHonorario),
    // Ajustes
    creditos: roundCurrency(creditos),
    debitos: roundCurrency(debitos),
    compensacaoConvenios: roundCurrency(compensacaoConvenios),
    compensacaoItems: compensacaoInfo.items,
    bnb: roundCurrency(bnb),
    cotaClinica: roundCurrency(cotaClinica),
    totalAjustesLiquidos: roundCurrency(totalAjustesLiquidos),
    obs,
    // Repasse Líquido
    repasseLiquido: roundCurrency(repasseLiquido),
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
    lines.push(
      row
        .map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`)
        .join(';')
    );

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
