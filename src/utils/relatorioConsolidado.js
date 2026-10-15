import {
  formatCurrency,
  roundCurrency,
  isDateInPeriod,
  getHonorarioInPeriod,
  getHonorarioMedicoInPeriod,
  migrateLegacyPayment,
  getInstallmentPeriods,
  getExamAllocationInPeriod,
  downloadBlob,
} from './helpers';

/**
 * Consolidates full financial statements (DRE, Revenue, Deductions, Medical Repasses, Operational Expenses)
 * for a specific acquisition period.
 *
 * @param {object} data - Object containing collections: { exames, examesConvenio, fluxoCaixa, detalhesExames, folhaPagamento, medicos, repassesAjustes }
 * @param {object} period - The acquisition period { start, end, label }
 * @returns {object} Consolidated financial report
 */
export function getConsolidatedFinancialReport(data = {}, period) {
  if (!period) return null;

  const exames = data.exames || [];
  const examesConvenio = data.examesConvenio || [];
  const fluxoCaixa = data.fluxoCaixa || [];
  const detalhesExames = data.detalhesExames || [];
  const folhaPagamento = data.folhaPagamento || [];
  const medicos = data.medicos || [];
  const repassesAjustes = data.repassesAjustes || [];

  // 1. Exames Particulares
  const examesParticularesRealizados = exames.filter((e) => isDateInPeriod(e.data, period));

  let faturamentoParticulares = 0;
  let deducoesTaxasCartao = 0;
  let deducoesImpostosNF = 0;
  let custosBiopsias = 0;
  let custosAcessorios = 0;
  let custosAnestesistas = 0;
  let honorariosParticulares = 0;
  let receitaClinicaParticulares = 0;

  const meiosDePagamento = {
    credito: { label: 'Cartão de Crédito', valor: 0, transacoes: 0 },
    debito: { label: 'Cartão de Débito', valor: 0, transacoes: 0 },
    pix: { label: 'PIX', valor: 0, transacoes: 0 },
    dinheiro: { label: 'Dinheiro', valor: 0, transacoes: 0 },
    transferencia: { label: 'Transferência Bancária', valor: 0, transacoes: 0 },
    outros: { label: 'Outros Meios', valor: 0, transacoes: 0 },
  };

  detalhesExames.forEach((exam) => {
    // Skip if it is a synchronized convenio record (convenios are handled in the convenio section)
    if (exam.isConvenio) return;

    const pagamentos = migrateLegacyPayment(exam);

    let parcelasNoPeriodo = 0;
    let valorRecebidoNoPeriodo = 0;

    for (const pag of pagamentos) {
      const n = Math.max(1, Number(pag.parcelas) || 1);
      const periods = getInstallmentPeriods(exam.data, n, pag.forma);
      for (const p of periods) {
        if (p.start === period.start && p.end === period.end) {
          parcelasNoPeriodo++;
          const valParcela = (Number(pag.valor) || 0) / n;
          valorRecebidoNoPeriodo += valParcela;

          // Track payment method distribution
          const formaLower = (pag.forma || '').toLowerCase();
          if (formaLower.includes('crédito') || formaLower.includes('credito')) {
            meiosDePagamento.credito.valor += valParcela;
            meiosDePagamento.credito.transacoes++;
          } else if (formaLower.includes('débito') || formaLower.includes('debito')) {
            meiosDePagamento.debito.valor += valParcela;
            meiosDePagamento.debito.transacoes++;
          } else if (formaLower.includes('pix')) {
            meiosDePagamento.pix.valor += valParcela;
            meiosDePagamento.pix.transacoes++;
          } else if (formaLower.includes('dinheiro') || formaLower.includes('espécie')) {
            meiosDePagamento.dinheiro.valor += valParcela;
            meiosDePagamento.dinheiro.transacoes++;
          } else if (formaLower.includes('transferência') || formaLower.includes('ted') || formaLower.includes('doc')) {
            meiosDePagamento.transferencia.valor += valParcela;
            meiosDePagamento.transferencia.transacoes++;
          } else {
            meiosDePagamento.outros.valor += valParcela;
            meiosDePagamento.outros.transacoes++;
          }
        }
      }
    }

    if (parcelasNoPeriodo > 0) {
      // Deduções alocadas por cascata: o que entra à vista absorve primeiro; taxa de cartão
      // só nas parcelas do cartão; o excedente é dividido igualmente entre as parcelas.
      const alloc = getExamAllocationInPeriod(exam, period);
      faturamentoParticulares += valorRecebidoNoPeriodo;
      deducoesTaxasCartao += alloc.taxaCartao;
      deducoesImpostosNF += alloc.cats.nf;
      custosBiopsias += alloc.cats.biopsia;
      custosAcessorios += alloc.cats.acessorios;
      custosAnestesistas += alloc.cats.anestesista;
      honorariosParticulares += getHonorarioInPeriod(exam, period);
    }

    // Taxa de clínica: para fins de fluxo de caixa, entra integralmente no período do exame
    // (nos honorários ela é diluída nas parcelas — ver getExamParcelAllocations).
    if (isDateInPeriod(exam.data, period)) {
      receitaClinicaParticulares += Number(exam.taxaClinica) || 0;
    }
  });

  // 2. Exames de Convênio
  const conveniosRealizados = examesConvenio.filter((c) => isDateInPeriod(c.data, period));
  const conveniosFaturados = examesConvenio.filter(
    (c) => c.fluxoLancado && isDateInPeriod(c.fluxoData || c.data, period)
  );

  let faturamentoConvenios = 0;
  let honorariosConvenios = 0;
  let receitaClinicaConvenios = 0;

  conveniosFaturados.forEach((c) => {
    const valFaturado = Number(c.fluxoValorLancado) || (Number(c.valorClinica || 0) + Number(c.valorMedico || 0));
    const repasseTotal =
      c.valorRepasse !== undefined && Number(c.valorRepasse) >= 0
        ? Number(c.valorRepasse)
        : (Number(c.valorRepasseMedico1 || 0) + Number(c.valorRepasseMedico2 || 0));

    faturamentoConvenios += valFaturado;
    honorariosConvenios += repasseTotal;
    receitaClinicaConvenios += Math.max(0, valFaturado - repasseTotal);
  });

  // 3. Outras Entradas do Fluxo de Caixa (não vinculadas a exames particulares ou convênios)
  const fluxoNoPeriodo = fluxoCaixa.filter((f) => isDateInPeriod(f.data, period));
  const entradasGerais = fluxoNoPeriodo.filter((f) => {
    if (f.tipo !== 'entrada') return false;
    // Exclude linked entries from exam split or convenios to prevent double counting
    if (f.detalheId || f.convenioId || f.isConvenioConsolidado || f.convenioConsolidado) return false;
    const nomeUpper = (f.nome || '').trim().toUpperCase();
    if (
      nomeUpper.startsWith('TAXA DE CLÍNICA') ||
      nomeUpper.startsWith('REPASSE CONVÊNIO') ||
      nomeUpper.startsWith('BIÓPSIA') ||
      nomeUpper === 'UNIMED' ||
      nomeUpper === 'COOPEND'
    ) {
      return false;
    }
    return true;
  });

  const faturamentoOutrasEntradas = entradasGerais.reduce((s, f) => s + (Number(f.valor) || 0), 0);

  // 4. Receita Bruta Consolidada
  const faturamentoBrutoTotal = faturamentoParticulares + faturamentoConvenios + faturamentoOutrasEntradas;

  // 5. Total de Deduções da Receita & Custos Diretos
  const totalDeducoesReceita =
    deducoesTaxasCartao + deducoesImpostosNF + custosBiopsias + custosAcessorios + custosAnestesistas;

  // 6. Receita Operacional Líquida (após deduções fiscais e taxas de cartão)
  const receitaOperacionalLiquida = Math.max(0, faturamentoBrutoTotal - totalDeducoesReceita);

  // 7. Despesas Operacionais (Saídas do Fluxo de Caixa)
  const categoriasDespesas = {
    'Folha de Pagamento / Pessoal': 0,
    'Material Médico / Insumos': 0,
    'Equipamentos / Manutenção': 0,
    'Aluguel / Condomínio': 0,
    'Contas (Água, Luz, Internet)': 0,
    'Impostos / Taxas': 0,
    'Serviços Terceirizados': 0,
    'Marketing / Administrativo': 0,
    'Outras Saídas': 0,
  };

  let totalDespesasOperacionais = 0;

  fluxoNoPeriodo.forEach((f) => {
    if (f.tipo === 'saida') {
      const valor = Number(f.valor) || 0;
      totalDespesasOperacionais += valor;
      const cat = f.categoria && categoriasDespesas[f.categoria] !== undefined ? f.categoria : 'Outras Saídas';
      categoriasDespesas[cat] += valor;
    }
  });

  // 8. Folha de Pagamento Resumo
  let totalFolhaLiquida = 0;
  let totalSalariosBase = 0;
  let totalBeneficios = 0;
  let totalVariaveis = 0;
  let totalDescontosFolha = 0;
  let colaboradoresCount = 0;

  folhaPagamento.forEach((emp) => {
    if (emp.ativo === false && !emp.periodos?.[period.start]) return;
    colaboradoresCount++;
    const pData = emp.periodos?.[period.start] || emp;
    const base = Number(pData.salarioBase || 0);
    const va = Number(pData.valeAlimentacao || 0);
    const vt = Number(pData.valeTransporte || 0);
    const ext = Number(pData.extras || 0);
    const prod = Number(pData.produtividade || 0);
    const desc = Number(pData.descontos || 0);
    const liq = base + va + vt + ext + prod - desc;

    totalSalariosBase += base;
    totalBeneficios += va + vt;
    totalVariaveis += ext + prod;
    totalDescontosFolha += desc;
    totalFolhaLiquida += liq;
  });

  // 9. Quadro de Médicos e Repasses
  const allDoctorNames = new Set();
  medicos.forEach((m) => {
    if (m.nome && m.nome.trim()) allDoctorNames.add(m.nome.trim().toUpperCase());
  });
  detalhesExames.forEach((d) => {
    if (d.medico) allDoctorNames.add(d.medico.trim().toUpperCase());
    if (d.medico2) allDoctorNames.add(d.medico2.trim().toUpperCase());
  });
  examesConvenio.forEach((c) => {
    if (c.medico) allDoctorNames.add(c.medico.trim().toUpperCase());
    if (c.medico2) allDoctorNames.add(c.medico2.trim().toUpperCase());
  });

  const doctorsList = Array.from(allDoctorNames).sort((a, b) => a.localeCompare(b));

  // Determine Clinic Operating Deficit for partner contribution calculation
  // Total entradas reais vs saídas reais do fluxo de caixa no período
  const totalEntradasFluxo = fluxoNoPeriodo
    .filter((f) => f.tipo === 'entrada')
    .reduce((s, f) => s + Number(f.valor || 0), 0);
  const totalSaidasFluxo = totalDespesasOperacionais;
  const deficitClinica = Math.max(0, totalSaidasFluxo - totalEntradasFluxo);

  const medicosRegistered = medicos.map((m) => ({
    ...m,
    nome: (m.nome || '').trim().toUpperCase(),
    ativo: m.ativo !== false,
    socio: m.socio !== false,
  }));

  const countSociosAtivos = doctorsList.filter((docName) => {
    const reg = medicosRegistered.find((m) => m.nome === docName);
    return reg ? reg.socio && reg.ativo : true;
  }).length;

  const cotaDeficitPorSocio = countSociosAtivos > 0 && deficitClinica > 0 ? deficitClinica / countSociosAtivos : 0;

  let totalHonorariosMedicosGeral = 0;
  let totalRepassesLiquidosGeral = 0;
  let totalAjustesCreditos = 0;
  let totalAjustesDebitos = 0;

  const repassesPorMedico = doctorsList.map((docName) => {
    const reg = medicosRegistered.find((m) => m.nome === docName);
    const isSocio = reg ? reg.socio : true;
    const isAtivo = reg ? reg.ativo : true;

    // Honorários particulares
    const honParticular = detalhesExames.reduce((sum, exam) => {
      if (exam.isConvenio) return sum;
      return sum + getHonorarioMedicoInPeriod(exam, docName, period);
    }, 0);

    // Honorários convênios
    let honConvenio = 0;
    conveniosFaturados.forEach((c) => {
      const doc1 = (c.medico || '').trim().toUpperCase();
      const doc2 = (c.medico2 || '').trim().toUpperCase();
      if (doc1 === docName) {
        honConvenio += Number(c.valorRepasseMedico1 || (c.temDivisaoMedico2 ? 0 : c.valorRepasse || 0));
      }
      if (doc2 === docName) {
        honConvenio += Number(c.valorRepasseMedico2 || 0);
      }
    });

    const honTotal = honParticular + honConvenio;

    // Ajustes
    const ajusteKey = `${docName.toLowerCase()}_${period.start}`;
    const ajuste = repassesAjustes.find((a) => a.key === ajusteKey);

    const creditos = Number(ajuste?.creditos || 0);
    const debitos = Number(ajuste?.debitos || 0);
    const bnb = Number(ajuste?.bnb || 0);
    const obs = ajuste?.obs || '';

    const cotaDeficit = isSocio && isAtivo && deficitClinica > 0 ? cotaDeficitPorSocio : 0;
    const repasseLiquido = Math.max(0, honTotal + creditos - debitos - bnb - cotaDeficit);

    totalHonorariosMedicosGeral += honTotal;
    totalRepassesLiquidosGeral += repasseLiquido;
    totalAjustesCreditos += creditos;
    totalAjustesDebitos += debitos + bnb;

    return {
      nome: docName,
      isSocio,
      isAtivo,
      honParticular: roundCurrency(honParticular),
      honConvenio: roundCurrency(honConvenio),
      honTotal: roundCurrency(honTotal),
      creditos: roundCurrency(creditos),
      debitos: roundCurrency(debitos + bnb),
      cotaDeficit: roundCurrency(cotaDeficit),
      repasseLiquido: roundCurrency(repasseLiquido),
      obs,
    };
  });

  // Filter only doctors with movement or active doctors
  const repassesRelevantes = repassesPorMedico.filter(
    (m) => m.honTotal > 0 || m.creditos > 0 || m.debitos > 0 || m.cotaDeficit > 0 || m.isAtivo
  );

  // 10. Resultado Líquido Final da Clínica (DRE)
  // Receita Líquida - Total de Repasses aos Médicos - Total de Despesas Operacionais
  const resultadoLiquidoClinica =
    receitaOperacionalLiquida - totalRepassesLiquidosGeral - totalDespesasOperacionais;

  const margemLiquidaPercent =
    faturamentoBrutoTotal > 0 ? (resultadoLiquidoClinica / faturamentoBrutoTotal) * 100 : 0;

  return {
    period,
    // Faturamento
    faturamentoParticulares: roundCurrency(faturamentoParticulares),
    faturamentoConvenios: roundCurrency(faturamentoConvenios),
    faturamentoOutrasEntradas: roundCurrency(faturamentoOutrasEntradas),
    faturamentoBrutoTotal: roundCurrency(faturamentoBrutoTotal),
    // Volumes de atendimento
    totalExamesParticulares: examesParticularesRealizados.length,
    totalExamesConvenio: conveniosRealizados.length,
    totalConveniosFaturados: conveniosFaturados.length,
    totalAtendimentos: examesParticularesRealizados.length + conveniosRealizados.length,
    // Deduções
    deducoesTaxasCartao: roundCurrency(deducoesTaxasCartao),
    deducoesImpostosNF: roundCurrency(deducoesImpostosNF),
    custosBiopsias: roundCurrency(custosBiopsias),
    custosAcessorios: roundCurrency(custosAcessorios),
    custosAnestesistas: roundCurrency(custosAnestesistas),
    totalDeducoesReceita: roundCurrency(totalDeducoesReceita),
    // Receita Líquida
    receitaOperacionalLiquida: roundCurrency(receitaOperacionalLiquida),
    // Receita da clínica (taxa de clínica dos particulares: integral no período do exame;
    // convênios: parte da clínica no faturamento lançado)
    receitaClinicaParticulares: roundCurrency(receitaClinicaParticulares),
    receitaClinicaConvenios: roundCurrency(receitaClinicaConvenios),
    // Repasses Médicos
    honorariosParticulares: roundCurrency(honorariosParticulares),
    honorariosConvenios: roundCurrency(honorariosConvenios),
    totalHonorariosMedicos: roundCurrency(totalHonorariosMedicosGeral),
    totalRepassesLiquidos: roundCurrency(totalRepassesLiquidosGeral),
    totalAjustesCreditos: roundCurrency(totalAjustesCreditos),
    totalAjustesDebitos: roundCurrency(totalAjustesDebitos),
    repassesPorMedico: repassesRelevantes,
    // Despesas Operacionais
    totalDespesasOperacionais: roundCurrency(totalDespesasOperacionais),
    categoriasDespesas,
    // Folha de Pagamento
    folhaResumo: {
      colaboradoresCount,
      totalSalariosBase: roundCurrency(totalSalariosBase),
      totalBeneficios: roundCurrency(totalBeneficios),
      totalVariaveis: roundCurrency(totalVariaveis),
      totalDescontosFolha: roundCurrency(totalDescontosFolha),
      totalFolhaLiquida: roundCurrency(totalFolhaLiquida),
    },
    // Meios de Pagamento
    meiosDePagamento,
    // Resultado Líquido & Margens
    deficitClinica: roundCurrency(deficitClinica),
    cotaDeficitPorSocio: roundCurrency(cotaDeficitPorSocio),
    resultadoLiquidoClinica: roundCurrency(resultadoLiquidoClinica),
    margemLiquidaPercent: Math.round(margemLiquidaPercent * 10) / 10,
    isSuperavit: resultadoLiquidoClinica >= 0,
  };
}

/**
 * Export consolidated financial statement to formatted CSV (Excel-compatible with BOM and semicolon delimiter)
 *
 * @param {object} report - Return value from getConsolidatedFinancialReport
 * @param {object} period - The acquisition period object { label, start, end }
 */
export function exportConsolidatedReportCSV(report, period) {
  if (!report || !period) return;
  const lines = [];
  const addLine = (row = []) =>
    lines.push(
      row
        .map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`)
        .join(';')
    );

  // 1. Header
  addLine(['CLÍNICA ENDODIAGNOSE — RELATÓRIO FINANCEIRO CONSOLIDADO']);
  addLine(['Período de Competência', period.label, `De ${period.start} até ${period.end}`]);
  addLine(['Data de Extração', new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR')]);
  addLine([]);

  // 2. Resumo Executivo
  addLine(['INDICADORES EXECUTIVOS (KPIS)']);
  addLine(['Indicador', 'Valor']);
  addLine(['Faturamento Bruto Consolidado', formatCurrency(report.faturamentoBrutoTotal)]);
  addLine(['Total de Custos Diretos & Deduções', formatCurrency(report.totalDeducoesReceita)]);
  addLine(['Total de Repasses Médicos Líquidos', formatCurrency(report.totalRepassesLiquidos)]);
  addLine(['Despesas Operacionais do Caixa', formatCurrency(report.totalDespesasOperacionais)]);
  addLine(['Resultado Líquido da Clínica', formatCurrency(report.resultadoLiquidoClinica)]);
  addLine(['Margem Líquida (%)', `${report.margemLiquidaPercent}%`]);
  addLine(['Status Operacional', report.isSuperavit ? 'SUPERÁVIT' : 'DÉFICIT']);
  addLine([]);

  // 3. Demonstrativo de Resultado (DRE Gerencial)
  addLine(['DEMONSTRATIVO DE RESULTADO DO EXERCÍCIO (DRE GERENCIAL)']);
  addLine(['Conta / Nível Operacional', 'Valor (R$)', '% Faturamento Bruto']);
  addLine(['1. RECEITA OPERACIONAL BRUTA', formatCurrency(report.faturamentoBrutoTotal), '100,0%']);
  addLine(['   1.1 Exames Particulares', formatCurrency(report.faturamentoParticulares), `${((report.faturamentoParticulares / (report.faturamentoBrutoTotal || 1)) * 100).toFixed(1)}%`]);
  addLine(['   1.2 Exames de Convênio', formatCurrency(report.faturamentoConvenios), `${((report.faturamentoConvenios / (report.faturamentoBrutoTotal || 1)) * 100).toFixed(1)}%`]);
  if (report.faturamentoOutrasEntradas > 0) {
    addLine(['   1.3 Outras Entradas do Caixa', formatCurrency(report.faturamentoOutrasEntradas), `${((report.faturamentoOutrasEntradas / (report.faturamentoBrutoTotal || 1)) * 100).toFixed(1)}%`]);
  }
  addLine(['2. DEDUÇÕES DA RECEITA E CUSTOS DIRETOS', `-${formatCurrency(report.totalDeducoesReceita)}`, `${((report.totalDeducoesReceita / (report.faturamentoBrutoTotal || 1)) * 100).toFixed(1)}%`]);
  addLine(['   2.1 Impostos & Notas Fiscais (Particulares)', `-${formatCurrency(report.deducoesImpostosNF)}`, `${((report.deducoesImpostosNF / (report.faturamentoBrutoTotal || 1)) * 100).toFixed(1)}%`]);
  addLine(['   2.2 Taxas de Cartão & Maquininhas', `-${formatCurrency(report.deducoesTaxasCartao)}`, `${((report.deducoesTaxasCartao / (report.faturamentoBrutoTotal || 1)) * 100).toFixed(1)}%`]);
  addLine(['   2.3 Custos Diretos com Biópsias', `-${formatCurrency(report.custosBiopsias)}`, `${((report.custosBiopsias / (report.faturamentoBrutoTotal || 1)) * 100).toFixed(1)}%`]);
  addLine(['   2.4 Custos com Acessórios', `-${formatCurrency(report.custosAcessorios)}`, `${((report.custosAcessorios / (report.faturamentoBrutoTotal || 1)) * 100).toFixed(1)}%`]);
  addLine(['   2.5 Honorários de Anestesistas', `-${formatCurrency(report.custosAnestesistas)}`, `${((report.custosAnestesistas / (report.faturamentoBrutoTotal || 1)) * 100).toFixed(1)}%`]);
  addLine(['3. RECEITA OPERACIONAL LÍQUIDA', formatCurrency(report.receitaOperacionalLiquida), `${((report.receitaOperacionalLiquida / (report.faturamentoBrutoTotal || 1)) * 100).toFixed(1)}%`]);
  addLine(['4. REPASSES & HONORÁRIOS MÉDICOS TOTAIS', `-${formatCurrency(report.totalRepassesLiquidos)}`, `${((report.totalRepassesLiquidos / (report.faturamentoBrutoTotal || 1)) * 100).toFixed(1)}%`]);
  addLine(['   4.1 Honorários de Exames Particulares', `-${formatCurrency(report.honorariosParticulares)}`, `${((report.honorariosParticulares / (report.faturamentoBrutoTotal || 1)) * 100).toFixed(1)}%`]);
  addLine(['   4.2 Honorários de Exames de Convênios', `-${formatCurrency(report.honorariosConvenios)}`, `${((report.honorariosConvenios / (report.faturamentoBrutoTotal || 1)) * 100).toFixed(1)}%`]);
  if (report.totalAjustesDebitos > 0 || report.totalAjustesCreditos > 0) {
    addLine(['   4.3 Ajustes Líquidos de Repasses', formatCurrency(report.totalAjustesCreditos - report.totalAjustesDebitos), '']);
  }
  addLine(['5. DESPESAS OPERACIONAIS DO CAIXA', `-${formatCurrency(report.totalDespesasOperacionais)}`, `${((report.totalDespesasOperacionais / (report.faturamentoBrutoTotal || 1)) * 100).toFixed(1)}%`]);
  Object.entries(report.categoriasDespesas || {}).forEach(([cat, val]) => {
    if (val > 0) {
      addLine([`   5.x ${cat}`, `-${formatCurrency(val)}`, `${((val / (report.faturamentoBrutoTotal || 1)) * 100).toFixed(1)}%`]);
    }
  });
  addLine(['6. RESULTADO LÍQUIDO FINAL DA CLÍNICA', formatCurrency(report.resultadoLiquidoClinica), `${report.margemLiquidaPercent}%`]);
  addLine([]);

  // 4. Repasses por Médico
  addLine(['QUADRO DE REPASSES POR PROFISSIONAL']);
  addLine(['Médico', 'Vínculo', 'Particulares (R$)', 'Convênios (R$)', 'Total Bruto (R$)', 'Ajustes Líquidos (R$)', 'Cota Déficit (R$)', 'Repasse Líquido (R$)']);
  (report.repassesPorMedico || []).forEach((r) => {
    addLine([
      r.nome,
      r.isSocio ? 'Sócio' : 'Prestador',
      formatCurrency(r.honorariosParticulares),
      formatCurrency(r.honorariosConvenio),
      formatCurrency(r.totalHonorariosBruto),
      formatCurrency(r.ajustesLiquidos),
      r.cotaDeficit > 0 ? `-${formatCurrency(r.cotaDeficit)}` : 'R$ 0,00',
      formatCurrency(r.repasseLiquido),
    ]);
  });
  addLine([]);

  // 5. Meios de Pagamento
  addLine(['DISTRIBUIÇÃO POR MEIO DE PAGAMENTO (PARTICULARES)']);
  addLine(['Meio de Pagamento', 'Transações', 'Valor Recebido (R$)', 'Participação (%)']);
  const totalMeios = Object.values(report.meiosDePagamento || {}).reduce((s, m) => s + m.valor, 0) || 1;
  Object.values(report.meiosDePagamento || {}).forEach((m) => {
    if (m.valor > 0 || m.transacoes > 0) {
      addLine([m.label, m.transacoes, formatCurrency(m.valor), `${((m.valor / totalMeios) * 100).toFixed(1)}%`]);
    }
  });
  addLine([]);

  // 6. Folha de Pagamento
  addLine(['RESUMO DA FOLHA DE PAGAMENTO (COMPETÊNCIA)']);
  addLine(['Colaboradores Cadastrados', report.folhaResumo.colaboradoresCount]);
  addLine(['Salários Base Totais', formatCurrency(report.folhaResumo.totalSalariosBase)]);
  addLine(['Benefícios Totais (VT, VR, etc.)', formatCurrency(report.folhaResumo.totalBeneficios)]);
  addLine(['Valores Variáveis / Adicionais', formatCurrency(report.folhaResumo.totalVariaveis)]);
  addLine(['Descontos em Folha', `-${formatCurrency(report.folhaResumo.totalDescontosFolha)}`]);
  addLine(['Total Líquido da Folha', formatCurrency(report.folhaResumo.totalFolhaLiquida)]);

  const BOM = '\uFEFF';
  const csvContent = BOM + lines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `relatorio_consolidado_${period.start}_${period.end}.csv`);
}

