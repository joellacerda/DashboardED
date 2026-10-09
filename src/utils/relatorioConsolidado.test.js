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
