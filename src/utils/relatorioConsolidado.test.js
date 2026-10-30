import { describe, it, expect } from 'vitest';
import { getConsolidatedFinancialReport } from './relatorioConsolidado';
import { getAcquisitionPeriod, getHonorarioInPeriod } from './helpers';

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
});
