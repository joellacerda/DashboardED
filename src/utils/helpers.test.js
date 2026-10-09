import { describe, it, expect } from 'vitest';
import {
  getAcquisitionPeriod,
  navigateAcquisitionPeriod,
  getInstallmentPeriods,
  getHonorarioInPeriod,
  getHonorarioMedicoInPeriod,
  getMonthRange,
  getExamAllocationInPeriod,
  getHonorarioSchedule,
} from './helpers';

const d = (y, m, day) => new Date(y, m - 1, day);

describe('getAcquisitionPeriod (16 → 15)', () => {
  it('dia 15 pertence ao período que começa no dia 16 do mês anterior', () => {
    const p = getAcquisitionPeriod(d(2026, 3, 15));
    expect(p.start).toBe('2026-02-16');
    expect(p.end).toBe('2026-03-15');
  });

  it('dia 16 abre um novo período', () => {
    const p = getAcquisitionPeriod(d(2026, 3, 16));
    expect(p.start).toBe('2026-03-16');
    expect(p.end).toBe('2026-04-15');
  });

  it('vira o ano em dezembro', () => {
    const p = getAcquisitionPeriod(d(2026, 12, 20));
    expect(p.start).toBe('2026-12-16');
    expect(p.end).toBe('2027-01-15');
  });

  it('vira o ano em janeiro', () => {
    const p = getAcquisitionPeriod(d(2026, 1, 5));
    expect(p.start).toBe('2025-12-16');
    expect(p.end).toBe('2026-01-15');
  });

  it('navega para frente e para trás', () => {
    const p = getAcquisitionPeriod(d(2026, 3, 20));
    expect(navigateAcquisitionPeriod(p, 1).start).toBe('2026-04-16');
    expect(navigateAcquisitionPeriod(p, -1).start).toBe('2026-02-16');
  });
});

describe('getMonthRange', () => {
  it('preenche o dia com zero e respeita ano bissexto', () => {
    expect(getMonthRange(2024, 1)).toEqual({ start: '2024-02-01', end: '2024-02-29' });
    expect(getMonthRange(2026, 1).end).toBe('2026-02-28');
  });
});

describe('getInstallmentPeriods', () => {
  it('Pix: parcela única no período corrente', () => {
    const [p] = getInstallmentPeriods('2026-03-10', 1, 'Pix');
    expect(p.start).toBe('2026-02-16');
  });

  it('Crédito: primeira parcela cai no período seguinte', () => {
    const periods = getInstallmentPeriods('2026-03-10', 3, 'Cartão de Crédito');
    expect(periods.map((p) => p.start)).toEqual(['2026-03-16', '2026-04-16', '2026-05-16']);
  });

  it('dia 31 não vaza para o mês seguinte', () => {
    const periods = getInstallmentPeriods('2026-01-31', 3, 'Cartão de Crédito');
    expect(periods.map((p) => p.start)).toEqual(['2026-02-16', '2026-03-16', '2026-04-16']);
  });

  it('data inválida retorna lista vazia', () => {
    expect(getInstallmentPeriods('xx', 2, 'Pix')).toEqual([]);
    expect(getInstallmentPeriods('', 2, 'Pix')).toEqual([]);
  });
});

describe('getHonorarioInPeriod (rateio entre formas de pagamento)', () => {
  const exam = {
    data: '2026-03-10', // período corrente: 16/fev–15/mar
    honorariosMedicos: 400,
    pagamentos: [
      { forma: 'Pix', valor: 100, parcelas: 1 },
      { forma: 'Cartão de Crédito', valor: 300, parcelas: 3 },
    ],
  };
  const per = (start) => ({ start, end: getAcquisitionPeriod(new Date(start + 'T00:00:00')).end });

  it('Pix entra integral no período corrente (proporcional ao valor)', () => {
    expect(getHonorarioInPeriod(exam, per('2026-02-16'))).toBe(100);
  });

  it('cartão divide igualmente nas parcelas, a partir do período seguinte', () => {
    expect(getHonorarioInPeriod(exam, per('2026-03-16'))).toBe(100);
    expect(getHonorarioInPeriod(exam, per('2026-04-16'))).toBe(100);
    expect(getHonorarioInPeriod(exam, per('2026-05-16'))).toBe(100);
  });

  it('a soma de todos os períodos é igual ao honorário total', () => {
    const total = ['2026-02-16', '2026-03-16', '2026-04-16', '2026-05-16']
      .map((s) => getHonorarioInPeriod(exam, per(s)))
      .reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(400, 2);
  });

  it('sem valores informados, divide igualmente entre as formas', () => {
    const semValor = {
      ...exam,
      pagamentos: [
        { forma: 'Pix', valor: 0, parcelas: 1 },
        { forma: 'Cartão de Crédito', valor: 0, parcelas: 2 },
      ],
    };
    expect(getHonorarioInPeriod(semValor, per('2026-02-16'))).toBe(200);
    expect(getHonorarioInPeriod(semValor, per('2026-03-16'))).toBe(100);
  });

  it('exame legado (sem pagamentos[]) continua funcionando', () => {
    const legado = { data: '2026-03-10', honorariosMedicos: 300, formaPagamento: 'Cartão de Crédito', numParcelas: 3, valorPagamento: 900 };
    expect(getHonorarioInPeriod(legado, per('2026-03-16'))).toBe(100);
  });

  it('honorário zero retorna 0', () => {
    expect(getHonorarioInPeriod({ ...exam, honorariosMedicos: 0 }, per('2026-02-16'))).toBe(0);
  });
});

describe('getHonorarioMedicoInPeriod', () => {
  const periodo = { start: '2026-02-16', end: '2026-03-15' };
  const base = {
    data: '2026-03-10',
    honorariosMedicos: 1000,
    pagamentos: [{ forma: 'Pix', valor: 1000, parcelas: 1 }],
    medico: 'Ana',
    medico2: 'Bruno',
    temDivisao: true,
    divisaoTipo: 'porcentagem',
  };

  it('sem divisão: tudo para o médico principal', () => {
    const e = { ...base, temDivisao: false, medico2: '' };
    expect(getHonorarioMedicoInPeriod(e, 'ana', periodo)).toBe(1000);
    expect(getHonorarioMedicoInPeriod(e, 'Bruno', periodo)).toBe(0);
  });

  it('percentual informado é respeitado', () => {
    const e = { ...base, porcentagemMedico1: 70, porcentagemMedico2: 30 };
    expect(getHonorarioMedicoInPeriod(e, 'Ana', periodo)).toBe(700);
    expect(getHonorarioMedicoInPeriod(e, 'Bruno', periodo)).toBe(300);
  });

  it('percentual vazio usa 50% (e não 0%)', () => {
    for (const vazio of ['', null, undefined]) {
      const e = { ...base, porcentagemMedico1: vazio, porcentagemMedico2: vazio };
      expect(getHonorarioMedicoInPeriod(e, 'Ana', periodo)).toBe(500);
      expect(getHonorarioMedicoInPeriod(e, 'Bruno', periodo)).toBe(500);
    }
  });

  it('percentual 0 explícito é mantido', () => {
    const e = { ...base, porcentagemMedico1: 0, porcentagemMedico2: 100 };
    expect(getHonorarioMedicoInPeriod(e, 'Ana', periodo)).toBe(0);
    expect(getHonorarioMedicoInPeriod(e, 'Bruno', periodo)).toBe(1000);
  });

  it('divisão por valor', () => {
    const e = { ...base, divisaoTipo: 'valor', valorMedico1: 250, valorMedico2: 750 };
    expect(getHonorarioMedicoInPeriod(e, 'Ana', periodo)).toBe(250);
    expect(getHonorarioMedicoInPeriod(e, 'Bruno', periodo)).toBe(750);
  });
});

describe('cascata de deduções por período', () => {
  const per = (start) => ({ start, end: getAcquisitionPeriod(new Date(start + 'T00:00:00')).end });
  const CORRENTE = '2026-02-16';
  const CARTAO = ['2026-03-16', '2026-04-16', '2026-05-16'];
  const periodos = [CORRENTE, ...CARTAO];
  const base = { data: '2026-03-10' };

  it('taxa de cartão recai só nas parcelas do cartão; demais deduções caem no Pix', () => {
    const exam = {
      ...base,
      pagamentos: [
        { forma: 'Pix', valor: 1000, parcelas: 1 },
        { forma: 'Cartão de Crédito', valor: 600, parcelas: 3 },
      ],
      valorRetidoTaxas: 60,
      valorNotaFiscal: 100,
      honorariosMedicos: 1440,
    };
    const atual = getExamAllocationInPeriod(exam, per(CORRENTE));
    expect(atual.recebido).toBe(1000);
    expect(atual.taxaCartao).toBe(0);
    expect(atual.cats.nf).toBeCloseTo(100, 2);

    const p1 = getExamAllocationInPeriod(exam, per(CARTAO[0]));
    expect(p1.taxaCartao).toBeCloseTo(20, 2);
    expect(p1.cats.nf).toBeCloseTo(0, 2);

    expect(getHonorarioInPeriod(exam, per(CORRENTE))).toBe(900);
    expect(getHonorarioInPeriod(exam, per(CARTAO[0]))).toBe(180);
  });

  it('Pix insuficiente: o restante das deduções vai para as parcelas do cartão', () => {
    const exam = {
      ...base,
      pagamentos: [
        { forma: 'Pix', valor: 100, parcelas: 1 },
        { forma: 'Cartão de Crédito', valor: 300, parcelas: 3 },
      ],
      valorAnestesista: 250,
      honorariosMedicos: 150,
    };
    const atual = getExamAllocationInPeriod(exam, per(CORRENTE));
    expect(atual.cats.anestesista).toBeCloseTo(100, 2); // Pix todo consumido
    const p1 = getExamAllocationInPeriod(exam, per(CARTAO[0]));
    expect(p1.cats.anestesista).toBeCloseTo(50, 2); // (250 - 100) / 3

    expect(getHonorarioInPeriod(exam, per(CORRENTE))).toBe(0);
    CARTAO.forEach((s) => expect(getHonorarioInPeriod(exam, per(s))).toBe(50));
  });

  it('só cartão: taxa e deduções divididas igualmente pelas parcelas', () => {
    const exam = {
      ...base,
      pagamentos: [{ forma: 'Cartão de Crédito', valor: 300, parcelas: 3 }],
      valorRetidoTaxas: 30,
      valorBiopsia: 60,
      honorariosMedicos: 210,
    };
    const p = getExamAllocationInPeriod(exam, per(CARTAO[1]));
    expect(p.taxaCartao).toBeCloseTo(10, 2);
    expect(p.cats.biopsia).toBeCloseTo(20, 2);
    expect(getHonorarioInPeriod(exam, per(CORRENTE))).toBe(0);
    CARTAO.forEach((s) => expect(getHonorarioInPeriod(exam, per(s))).toBe(70));
  });

  it('só à vista: tudo (inclusive taxa) fica no período corrente', () => {
    const exam = {
      ...base,
      pagamentos: [{ forma: 'Pix', valor: 500, parcelas: 1 }],
      valorRetidoTaxas: 10,
      taxaClinica: 20,
      honorariosMedicos: 470,
    };
    const atual = getExamAllocationInPeriod(exam, per(CORRENTE));
    expect(atual.taxaCartao).toBeCloseTo(10, 2);
    expect(atual.cats.clinica).toBeCloseTo(20, 2);
    expect(getHonorarioInPeriod(exam, per(CORRENTE))).toBe(470);
  });

  it('acessório para o médico não é dedução', () => {
    const exam = {
      ...base,
      pagamentos: [{ forma: 'Pix', valor: 500, parcelas: 1 }],
      valorAcessorios: 80,
      acessorioParaMedico: true,
      honorariosMedicos: 500,
    };
    expect(getExamAllocationInPeriod(exam, per(CORRENTE)).cats.acessorios).toBe(0);
  });

  it('a soma dos honorários de todos os períodos é igual ao total gravado', () => {
    const exam = {
      ...base,
      pagamentos: [
        { forma: 'Pix', valor: 200, parcelas: 1 },
        { forma: 'Cartão de Crédito', valor: 900, parcelas: 3 },
      ],
      valorRetidoTaxas: 45,
      valorNotaFiscal: 66,
      taxaClinica: 120,
      honorariosMedicos: 869,
    };
    const soma = periodos.map((s) => getHonorarioInPeriod(exam, per(s))).reduce((a, b) => a + b, 0);
    expect(soma).toBeCloseTo(869, 1);
  });
});

describe('débito e cronograma de honorários', () => {
  const per = (start) => ({ start, end: getAcquisitionPeriod(new Date(start + 'T00:00:00')).end });
  const base = { data: '2026-03-10' };

  it('débito paga taxa de cartão, mas no período corrente', () => {
    const exam = {
      ...base,
      pagamentos: [
        { forma: 'Cartão de Débito', valor: 100, parcelas: 1 },
        { forma: 'Cartão de Crédito', valor: 300, parcelas: 3 },
      ],
      valorRetidoTaxas: 40, // 25% no débito (10), 75% no crédito (30 → 10 por parcela)
      honorariosMedicos: 360,
    };
    const atual = getExamAllocationInPeriod(exam, per('2026-02-16'));
    expect(atual.taxaCartao).toBeCloseTo(10, 2);
    const p1 = getExamAllocationInPeriod(exam, per('2026-03-16'));
    expect(p1.taxaCartao).toBeCloseTo(10, 2);
  });

  it('taxa do débito reduz o que o à vista consegue absorver', () => {
    const exam = {
      ...base,
      pagamentos: [
        { forma: 'Cartão de Débito', valor: 100, parcelas: 1 },
        { forma: 'Cartão de Crédito', valor: 300, parcelas: 3 },
      ],
      valorRetidoTaxas: 40,
      valorAnestesista: 150,
      honorariosMedicos: 210,
    };
    // débito líquido = 100 - 10 = 90 absorve 90; restante 60 / 3 = 20 por parcela
    expect(getExamAllocationInPeriod(exam, per('2026-02-16')).cats.anestesista).toBeCloseTo(90, 2);
    expect(getExamAllocationInPeriod(exam, per('2026-03-16')).cats.anestesista).toBeCloseTo(20, 2);
  });

  it('cronograma: um item por período, em ordem, somando o total', () => {
    const exam = {
      ...base,
      pagamentos: [
        { forma: 'Pix', valor: 200, parcelas: 1 },
        { forma: 'Cartão de Crédito', valor: 900, parcelas: 3 },
      ],
      valorRetidoTaxas: 45,
      taxaClinica: 120,
      honorariosMedicos: 935,
    };
    const rows = getHonorarioSchedule(exam);
    expect(rows.map((r) => r.start)).toEqual(['2026-02-16', '2026-03-16', '2026-04-16', '2026-05-16']);
    expect(rows.every((r) => r.label)).toBe(true);
    expect(rows.reduce((s, r) => s + r.honorario, 0)).toBeCloseTo(935, 2);
  });
});

describe('robustez com dados de formulário (strings / campos vazios)', () => {
  it('formulário sem data ou sem valores não quebra', () => {
    expect(getHonorarioSchedule({ data: '', pagamentos: [{ forma: 'Pix', valor: '', parcelas: '1' }], honorariosMedicos: '' })).toEqual([]);
    const rows = getHonorarioSchedule({
      data: '2026-03-10',
      pagamentos: [{ forma: 'Cartão de Crédito', valor: '', parcelas: '2' }],
      honorariosMedicos: '100',
    });
    expect(rows.reduce((s, r) => s + r.honorario, 0)).toBeCloseTo(100, 2);
  });

  it('valores como string são aceitos', () => {
    const e = {
      data: '2026-03-10',
      pagamentos: [{ forma: 'Pix', valor: '500', parcelas: '1' }],
      valorRetidoTaxas: '',
      valorAnestesista: '50',
      honorariosMedicos: '450',
    };
    const [row] = getHonorarioSchedule(e);
    expect(row.honorario).toBe(450);
  });

  it('honorário cuja dedução excede tudo ainda soma o total sem valores negativos', () => {
    const e = {
      data: '2026-03-10',
      pagamentos: [{ forma: 'Cartão de Crédito', valor: 100, parcelas: 2 }],
      valorAnestesista: 500,
      honorariosMedicos: 80,
    };
    const rows = getHonorarioSchedule(e);
    expect(rows.every((r) => r.honorario >= 0)).toBe(true);
  });
});
