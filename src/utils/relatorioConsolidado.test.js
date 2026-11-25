import { describe, it, expect } from 'vitest';
import { getConsolidatedFinancialReport } from './relatorioConsolidado';
import { getAcquisitionPeriod, getHonorarioInPeriod } from './helpers';
import { calculateDoctorRepasseInPeriod, getAllDoctors } from './repasseCalculation';
import { getDoctorPeriodMetrics } from './medicoAnalytics';
import { syncConvenioToDetalhes, getData, setData, MODULES } from './storage';

const period = (start) => getAcquisitionPeriod(new Date(start + 'T00:00:00'));
const PERIODOS = ['2026-02-16', '2026-03-16', '2026-04-16', '2026-05-16'].map(period);

// Exame misto: Pix + débito + crédito 3x, com várias deduções
const exame = {
  id: 'x1',
  data: '2026-03-10',
  medico: 'ANA',
  pagamentos: [
    { forma: 'Pix', valor: 300, parcelas: 1 },
    { forma: 'Cartão de Débito', valor: 200, parcelas: 1 },
    { forma: 'Cartão de Crédito', valor: 900, parcelas: 3 },
  ],
  valorRetidoTaxas: 70,
  valorNotaFiscal: 84,
  valorBiopsia: 50,
  valorAnestesista: 100,
  taxaClinica: 150,
  honorariosMedicos: 946,
};

describe('relatório consolidado × alocação por período', () => {
  const reports = PERIODOS.map((p) => getConsolidatedFinancialReport({ detalhesExames: [exame] }, p));

  const soma = (campo) => reports.reduce((s, r) => s + r[campo], 0);

  it('faturamento somado nos períodos = total pago', () => {
    expect(soma('faturamentoParticulares')).toBeCloseTo(1400, 1);
  });

  it('deduções somadas nos períodos = valores informados (nada perdido nem duplicado)', () => {
    expect(soma('deducoesTaxasCartao')).toBeCloseTo(70, 1);
    expect(soma('deducoesImpostosNF')).toBeCloseTo(84, 1);
    expect(soma('custosAnestesistas')).toBeCloseTo(100, 1);
  });

  it('honorários somados nos períodos = total gravado', () => {
    expect(soma('honorariosParticulares')).toBeCloseTo(946, 1);
  });

  it('honorário do relatório coincide com getHonorarioInPeriod em cada período', () => {
    PERIODOS.forEach((p, i) => {
      expect(reports[i].honorariosParticulares).toBeCloseTo(getHonorarioInPeriod(exame, p), 1);
    });
  });
});

describe('receita da clínica (fluxo de caixa × honorários)', () => {
  it('taxa de clínica entra integral no período do exame, mesmo com pagamento no cartão', () => {
    const e = {
      id: 'x2',
      data: '2026-03-10', // período do exame: 16/fev–15/mar
      medico: 'ANA',
      pagamentos: [{ forma: 'Cartão de Crédito', valor: 600, parcelas: 3 }],
      taxaClinica: 120,
      honorariosMedicos: 480,
    };
    const rs = PERIODOS.map((p) => getConsolidatedFinancialReport({ detalhesExames: [e] }, p));
    expect(rs[0].receitaClinicaParticulares).toBe(120); // período do exame
    expect(rs.slice(1).every((r) => r.receitaClinicaParticulares === 0)).toBe(true);
    // honorários, porém, só começam nas parcelas (crédito entra no período seguinte)
    expect(rs[0].honorariosParticulares).toBe(0);
    expect(rs[1].honorariosParticulares).toBeGreaterThan(0);
  });

  it('padroniza campos de repassesPorMedico para tabela e exportação CSV', () => {
    const data = {
      medicos: [{ id: 'm1', nome: 'Dr. Roberto', socio: true, ativo: true }],
      detalhesExames: [
        {
          id: 'det1',
          data: '2026-03-20',
          medico: 'Dr. Roberto',
          pagamentos: [{ forma: 'Pix', valor: 500, parcelas: 1 }],
          honorariosMedicos: 350,
        },
      ],
      repassesAjustes: [
        {
          key: 'dr. roberto_2026-03-16',
          creditos: 100,
          debitos: 30,
          bnb: 20,
        },
      ],
    };
    const report = getConsolidatedFinancialReport(data, period('2026-03-16'));
    const repasseDoc = report.repassesPorMedico.find((r) => r.nome === 'DR. ROBERTO');

    expect(repasseDoc).toBeDefined();
    expect(repasseDoc.honorariosParticulares).toBe(350);
    expect(repasseDoc.honParticular).toBe(350);
    expect(repasseDoc.honorariosConvenio).toBe(0);
    expect(repasseDoc.totalHonorariosBruto).toBe(350);
    // ajustesLiquidos = creditos (100) - debitos (30) - bnb (20) - compensacao (0) = 50
    expect(repasseDoc.ajustesLiquidos).toBe(50);
    expect(repasseDoc.repasseLiquido).toBe(400); // 350 + 50
  });

  it('mantém consistência exata entre calculateDoctorRepasseInPeriod, getDoctorPeriodMetrics e getConsolidatedFinancialReport (incluindo manualOverride de convênio)', () => {
    const p = period('2026-03-16');
    const data = {
      medicos: [{ id: 'm1', nome: 'DRA. CAMILA', socio: true, ativo: true }],
      examesConvenio: [
        {
          id: 'c1',
          data: '2026-03-01',
          medico: 'DRA. CAMILA',
          convenio: 'UNIMED',
          fluxoLancado: true,
          fluxoData: '2026-03-22',
          fluxoValorLancado: 400,
          valorHonorarioCalculado: 320,
        },
      ],
      detalhesExames: [
        {
          id: 'conv_c1',
          origemConvenioId: 'c1',
          isConvenio: true,
          manualOverride: true,
          data: '2026-03-22',
          fluxoLancado: true,
          fluxoData: '2026-03-22',
          formaPagamento: 'Convênio (UNIMED)',
          pagamentos: [{ forma: 'Convênio (UNIMED)', valor: 400, parcelas: 1 }],
          medico: 'DRA. CAMILA',
          convenio: 'UNIMED',
          valorPago: 400,
          honorariosMedicos: 360, // manualOverride editado de 320 para 360
        },
        {
          id: 'part1',
          data: '2026-03-25',
          medico: 'DRA. CAMILA',
          pagamentos: [{ forma: 'Pix', valor: 500, parcelas: 1 }],
          honorariosMedicos: 400,
        },
      ],
      repassesAjustes: [
        {
          key: 'dra. camila_2026-03-16',
          creditos: 50,
          debitos: 10,
          bnb: 5,
        },
      ],
      fluxoCaixa: [],
    };

    const directRepasse = calculateDoctorRepasseInPeriod('DRA. CAMILA', p, data);
    const analyticsMetrics = getDoctorPeriodMetrics('DRA. CAMILA', p, data);
    const consolidatedReport = getConsolidatedFinancialReport(data, p);
    const reportRow = consolidatedReport.repassesPorMedico.find((r) => r.nome === 'DRA. CAMILA');

    expect(directRepasse.honConvenio).toBe(360);
    expect(directRepasse.honParticular).toBe(400);
    expect(directRepasse.honTotal).toBe(760);
    expect(directRepasse.repasseLiquido).toBe(795); // 760 + 50 - 10 - 5

    expect(analyticsMetrics.totalHonorariosConvenios).toBe(directRepasse.honConvenio);
    expect(analyticsMetrics.totalHonorariosParticulares).toBe(directRepasse.honParticular);
    expect(analyticsMetrics.repasseLiquido).toBe(directRepasse.repasseLiquido);

    expect(reportRow.honorariosConvenio).toBe(directRepasse.honConvenio);
    expect(reportRow.honorariosParticulares).toBe(directRepasse.honParticular);
    expect(reportRow.repasseLiquido).toBe(directRepasse.repasseLiquido);
    expect(consolidatedReport.honorariosConvenios).toBe(directRepasse.honConvenio);
    expect(consolidatedReport.honorariosParticulares).toBe(directRepasse.honParticular);
    expect(consolidatedReport.totalHonorariosMedicos).toBe(directRepasse.honTotal);
    expect(consolidatedReport.totalAjustesLiquidos).toBe(directRepasse.ajustesLiquidos);
  });

  it('inclui compensações de convênio em totalAjustesLiquidos e cota de déficit em totalCotaDeficit no relatório consolidado', () => {
    const p = period('2026-03-16');
    const data = {
      medicos: [{ id: 'm1', nome: 'DR. OLIVEIRA', socio: true, ativo: true }],
      examesConvenio: [
        {
          id: 'c_comp',
          data: '2026-03-20',
          medico: 'DR. OLIVEIRA',
          convenio: 'UNIMED',
          fluxoLancado: true,
          fluxoData: '2026-03-20',
          valorCompensacaoClinica: 150,
          valorRepasse: 600,
          valorRepasseMedico1: 600,
        },
      ],
      repassesAjustes: [
        {
          key: 'dr. oliveira_2026-03-16',
          creditos: 80,
          debitos: 20,
          bnb: 10,
        },
      ],
      fluxoCaixa: [
        { id: 'f_out', data: '2026-03-20', tipo: 'saida', categoria: 'Aluguel / Condomínio', valor: 500 },
      ],
    };

    const report = getConsolidatedFinancialReport(data, p);
    // ajustesLiquidos = creditos (80) - debitos (20) - bnb (10) - compensacao (150) = -100
    expect(report.totalCompensacoesConvenio).toBe(150);
    expect(report.totalAjustesLiquidos).toBe(-100);
    expect(report.totalCotaDeficit).toBe(500);
  });

  it('syncConvenioToDetalhes não sincroniza consulta recém-cadastrada sem valores preenchidos nem lançada no caixa', () => {
    setData(MODULES.detalhesExames, []);
    const pendingConsulta = {
      id: 'cons_pendente_1',
      data: '2026-03-20',
      paciente: 'PACIENTE CONSULTA',
      medico: 'DR. OLIVEIRA',
      convenio: 'UNIMED',
      exame: 'CONSULTA',
      valorClinica: 0,
      valorMedico: '',
      percentualMedico: 100,
      fluxoLancado: false,
    };

    const res = syncConvenioToDetalhes(pendingConsulta);
    expect(res).toBeNull();
    expect(getData(MODULES.detalhesExames)).toHaveLength(0);
  });

  it('sinaliza folhaNaoLancadaNoCaixa quando há folha líquida calculada mas sem despesa no Fluxo de Caixa', () => {
    const p = period('2026-03-16');
    const dataSemLancamento = {
      folhaPagamento: [
        {
          id: 'f1',
          nome: 'MARIA',
          salarioBase: 2500,
          periodos: {
            [p.start]: { salarioBase: 2500, valeAlimentacao: 0, valeTransporte: 0, extras: 0, produtividade: 0, descontos: 0 },
          },
        },
      ],
      fluxoCaixa: [],
    };

    const reportPendente = getConsolidatedFinancialReport(dataSemLancamento, p);
    expect(reportPendente.folhaResumo.totalFolhaLiquida).toBeGreaterThan(0);
    expect(reportPendente.folhaNaoLancadaNoCaixa).toBe(true);
    expect(reportPendente.folhaResumo.folhaNaoLancadaNoCaixa).toBe(true);

    const dataComLancamento = {
      ...dataSemLancamento,
      fluxoCaixa: [
        {
          id: 'fc_folha',
          tipo: 'saida',
          categoria: 'Folha de Pagamento / Pessoal',
          valor: reportPendente.folhaResumo.totalFolhaLiquida,
          data: p.end,
        },
      ],
    };

    const reportLancado = getConsolidatedFinancialReport(dataComLancamento, p);
    expect(reportLancado.folhaNaoLancadaNoCaixa).toBe(false);
    expect(reportLancado.folhaResumo.folhaNaoLancadaNoCaixa).toBe(false);
  });

  it('syncConvenioToDetalhes não gera escrita redundante em auditLogs quando nenhum campo mudou', () => {
    setData(MODULES.detalhesExames, []);
    setData(MODULES.auditLogs, []);

    const conv = {
      id: 'c_idem_1',
      data: '2026-03-18',
      paciente: 'PACIENTE TESTE',
      medico: 'DR. JOAO',
      convenio: 'UNIMED',
      exames: [{ nome: 'ENDOSCOPIA' }],
      fluxoLancado: true,
      fluxoValorLancado: 300,
      fluxoData: '2026-03-18',
      valorHonorarioCalculado: 240,
    };

    syncConvenioToDetalhes(conv);
    const logsAfterCreate = getData(MODULES.auditLogs).length;
    expect(logsAfterCreate).toBe(1);

    // Chamar novamente com os mesmos dados não deve gerar novo auditLog
    syncConvenioToDetalhes(conv);
    const logsAfterRepeat = getData(MODULES.auditLogs).length;
    expect(logsAfterRepeat).toBe(1);
  });

  it('retorna total e repasseLiquido negativos quando os descontos/compensações/cota superam os honorários e créditos', () => {
    const p = period('2026-03-16');
    const data = {
      medicos: [{ id: 'm_neg', nome: 'DR. OLIVEIRA', socio: true, ativo: true }],
      detalhesExames: [
        {
          id: 'part_neg',
          data: '2026-03-20',
          medico: 'DR. OLIVEIRA',
          pagamentos: [{ forma: 'Pix', valor: 1000, parcelas: 1 }],
          honorariosMedicos: 515.65,
        },
      ],
      examesConvenio: [
        {
          id: 'conv_neg',
          data: '2026-03-20',
          medico: 'DR. OLIVEIRA',
          convenio: 'UNIMED',
          fluxoLancado: true,
          fluxoData: '2026-03-20',
          valorCompensacaoClinica: 1038.25,
        },
      ],
      repassesAjustes: [],
      fluxoCaixa: [],
    };

    const repasse = calculateDoctorRepasseInPeriod('DR. OLIVEIRA', p, data);
    expect(repasse.honorarios).toBe(515.65);
    expect(repasse.compensacaoConvenios).toBe(1038.25);
    expect(repasse.total).toBe(-522.6);
    expect(repasse.repasseLiquido).toBe(-522.6);
  });

  it('getAllDoctors posiciona médicos ativos no topo e respeita a ordem personalizada', () => {
    const doctors = getAllDoctors({
      medicos: [
        { id: '1', nome: 'DR. ALBERTO', ativo: false, socio: false, ordem: 1 },
        { id: '2', nome: 'DR. LEVI', ativo: true, socio: false, ordem: 2 },
        { id: '3', nome: 'DR. OLIVEIRA', ativo: true, socio: true, ordem: 1 },
        { id: '4', nome: 'DR. RAPHAEL', ativo: false, socio: false, ordem: 2 },
      ],
    });

    expect(doctors.map((d) => d.nome)).toEqual([
      'DR. OLIVEIRA',
      'DR. LEVI',
      'DR. ALBERTO',
      'DR. RAPHAEL',
    ]);
  });

  it('médicos auto-descobertos não entram como sócios (evita diluir cota de déficit dos sócios)', () => {
    const p = period('2026-03-16');
    const data = {
      medicos: [{ id: 'm1', nome: 'DR. SOCIO', socio: true, ativo: true }],
      detalhesExames: [
        {
          id: 'd1',
          data: '2026-03-20',
          medico: 'DR. CONVIDADO NAO CADASTRADO',
          pagamentos: [{ forma: 'Pix', valor: 500, parcelas: 1 }],
          honorariosMedicos: 300,
        },
      ],
      fluxoCaixa: [
        { id: 'f1', data: '2026-03-20', tipo: 'saida', categoria: 'Aluguel / Condomínio', valor: 1000 },
      ],
    };
    const report = getConsolidatedFinancialReport(data, p);
    expect(report.cotaDeficitPorSocio).toBe(1000);
    const guest = report.repassesPorMedico.find((r) => r.nome === 'DR. CONVIDADO NAO CADASTRADO');
    expect(guest.isSocio).toBe(false);
    expect(guest.cotaDeficit).toBe(0);
  });

  it('DRE não infla resultado operacional com cota de déficit dos sócios', () => {
    const p = period('2026-03-16');
    const data = {
      medicos: [{ id: 'm1', nome: 'DR. SOCIO', socio: true, ativo: true }],
      detalhesExames: [
        {
          id: 'd1',
          data: '2026-03-20',
          medico: 'DR. SOCIO',
          pagamentos: [{ forma: 'Pix', valor: 1000, parcelas: 1 }],
          honorariosMedicos: 400,
        },
      ],
      fluxoCaixa: [
        { id: 'f1', data: '2026-03-20', tipo: 'saida', categoria: 'Aluguel / Condomínio', valor: 2000 },
      ],
    };
    const report = getConsolidatedFinancialReport(data, p);
    // Receita líquida (1000) - honorários (400) - despesas (2000) = -1400 (não somado à cotaDeficit de 2000)
    expect(report.resultadoLiquidoClinica).toBe(-1400);
    expect(report.resultadoAposAporteSocios).toBe(600);
  });
});
