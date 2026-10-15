import { describe, it, expect, beforeEach } from 'vitest';
import {
  normalizeConvenioName,
  getConvenioFluxoDestino,
  syncConveniosFluxoConsolidado,
  syncConvenioToDetalhes,
  setData,
  MODULES,
} from './storage';
import { getConsolidatedFinancialReport } from './relatorioConsolidado';
import { getAcquisitionPeriod } from './helpers';

// Simple in-memory localStorage shim if needed
const storageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => {
      store[key] = String(value);
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = storageMock;
}

describe('getConvenioFluxoDestino', () => {
  it('direciona Unimed e suas variações para a entrada consolidada "Unimed"', () => {
    expect(getConvenioFluxoDestino('UNIMED')).toEqual({
      key: 'UNIMED',
      display: 'Unimed',
      isUnimed: true,
      isCoopend: false,
      convenioOrigem: 'UNIMED',
    });
    expect(getConvenioFluxoDestino('Unimed')).toEqual({
      key: 'UNIMED',
      display: 'Unimed',
      isUnimed: true,
      isCoopend: false,
      convenioOrigem: 'Unimed',
    });
    expect(getConvenioFluxoDestino('UNIMED FORTALEZA')).toEqual({
      key: 'UNIMED',
      display: 'Unimed',
      isUnimed: true,
      isCoopend: false,
      convenioOrigem: 'UNIMED FORTALEZA',
    });
  });

  it('direciona qualquer convênio que não seja Unimed (como IPM, Bradesco, Cassi) para "Coopend"', () => {
    // IPM
    const ipm = getConvenioFluxoDestino('IPM');
    expect(ipm.key).toBe('COOPEND');
    expect(ipm.display).toBe('Coopend');
    expect(ipm.isUnimed).toBe(false);

    // Bradesco
    const bradesco = getConvenioFluxoDestino('Bradesco');
    expect(bradesco.key).toBe('COOPEND');
    expect(bradesco.display).toBe('Coopend');
    expect(bradesco.isUnimed).toBe(false);

    // Cassi
    const cassi = getConvenioFluxoDestino('CASSI');
    expect(cassi.key).toBe('COOPEND');
    expect(cassi.display).toBe('Coopend');
    expect(cassi.isUnimed).toBe(false);

    // Coopend
    const coopend = getConvenioFluxoDestino('Coopend');
    expect(coopend.key).toBe('COOPEND');
    expect(coopend.display).toBe('Coopend');
    expect(coopend.isUnimed).toBe(false);

    // Vazio/nulo
    expect(getConvenioFluxoDestino('')).toEqual({
      key: 'COOPEND',
      display: 'Coopend',
      isUnimed: false,
      isCoopend: true,
    });
    expect(getConvenioFluxoDestino(null)).toEqual({
      key: 'COOPEND',
      display: 'Coopend',
      isUnimed: false,
      isCoopend: true,
    });
  });
});

describe('normalizeConvenioName', () => {
  it('normaliza variações de UNIMED para chave UNIMED e display Unimed', () => {
    expect(normalizeConvenioName('UNIMED')).toEqual({ key: 'UNIMED', display: 'Unimed' });
    expect(normalizeConvenioName('Unimed')).toEqual({ key: 'UNIMED', display: 'Unimed' });
    expect(normalizeConvenioName('unimed')).toEqual({ key: 'UNIMED', display: 'Unimed' });
    expect(normalizeConvenioName('UNIMED FORTALEZA')).toEqual({ key: 'UNIMED', display: 'Unimed' });
  });

  it('normaliza variações de COOPEND para chave COOPEND e display Coopend', () => {
    expect(normalizeConvenioName('COOPEND')).toEqual({ key: 'COOPEND', display: 'Coopend' });
    expect(normalizeConvenioName('Coopend')).toEqual({ key: 'COOPEND', display: 'Coopend' });
    expect(normalizeConvenioName('coopend')).toEqual({ key: 'COOPEND', display: 'Coopend' });
  });

  it('mantém outros convênios com formatação adequada', () => {
    expect(normalizeConvenioName('BRADESCO')).toEqual({ key: 'BRADESCO', display: 'BRADESCO' });
    expect(normalizeConvenioName('Amil')).toEqual({ key: 'AMIL', display: 'Amil' });
  });

  it('trata valores nulos ou vazios', () => {
    expect(normalizeConvenioName('')).toEqual({ key: '', display: '' });
    expect(normalizeConvenioName(null)).toEqual({ key: '', display: '' });
  });
});

describe('syncConveniosFluxoConsolidado', () => {
  beforeEach(() => {
    setData(MODULES.examesConvenio, []);
    setData(MODULES.fluxoCaixa, []);
  });

  it('cria uma única entrada de "Unimed" no fluxo para o primeiro exame lançado', () => {
    const exame1 = {
      id: 'ex_1',
      convenio: 'UNIMED',
      paciente: 'JOAO SILVA',
      data: '2026-10-05',
      fluxoLancado: true,
      fluxoValorLancado: 300,
      fluxoData: '2026-10-05',
    };
    setData(MODULES.examesConvenio, [exame1]);

    const fluxo = syncConveniosFluxoConsolidado();
    const unimedEntries = fluxo.filter((f) => f.nome === 'Unimed');

    expect(unimedEntries.length).toBe(1);
    expect(unimedEntries[0].valor).toBe(300);
    expect(unimedEntries[0].isConvenioConsolidado).toBe(true);
    expect(unimedEntries[0].qtdExames).toBe(1);
  });

  it('incrementa o valor da entrada única de "Unimed" ao adicionar novos exames', () => {
    const exame1 = {
      id: 'ex_1',
      convenio: 'UNIMED',
      paciente: 'JOAO SILVA',
      data: '2026-10-05',
      fluxoLancado: true,
      fluxoValorLancado: 300,
      fluxoData: '2026-10-05',
    };
    const exame2 = {
      id: 'ex_2',
      convenio: 'UNIMED',
      paciente: 'MARIA SANTOS',
      data: '2026-10-08',
      fluxoLancado: true,
      fluxoValorLancado: 450,
      fluxoData: '2026-10-08',
    };
    const exame3 = {
      id: 'ex_3',
      convenio: 'UNIMED',
      paciente: 'CARLOS LIMA',
      data: '2026-10-10',
      fluxoLancado: true,
      fluxoValorLancado: 250,
      fluxoData: '2026-10-10',
    };

    setData(MODULES.examesConvenio, [exame1, exame2, exame3]);

    const fluxo = syncConveniosFluxoConsolidado();
    const unimedEntries = fluxo.filter((f) => f.nome === 'Unimed');

    // Continua sendo APENAS UMA entrada consolidada
    expect(unimedEntries.length).toBe(1);
    // Valor total incrementado: 300 + 450 + 250 = 1000
    expect(unimedEntries[0].valor).toBe(1000);
    expect(unimedEntries[0].qtdExames).toBe(3);
    expect(unimedEntries[0].data).toBe('2026-10-10'); // Data do recebimento mais recente
  });

  it('mantém entradas separadas e únicas para "Unimed" e "Coopend"', () => {
    const exameUnimed1 = {
      id: 'u_1',
      convenio: 'UNIMED',
      data: '2026-10-05',
      fluxoLancado: true,
      fluxoValorLancado: 300,
      fluxoData: '2026-10-05',
    };
    const exameUnimed2 = {
      id: 'u_2',
      convenio: 'UNIMED',
      data: '2026-10-06',
      fluxoLancado: true,
      fluxoValorLancado: 200,
      fluxoData: '2026-10-06',
    };
    const exameCoopend1 = {
      id: 'c_1',
      convenio: 'COOPEND',
      data: '2026-10-07',
      fluxoLancado: true,
      fluxoValorLancado: 500,
      fluxoData: '2026-10-07',
    };
    const exameCoopend2 = {
      id: 'c_2',
      convenio: 'COOPEND',
      data: '2026-10-09',
      fluxoLancado: true,
      fluxoValorLancado: 350,
      fluxoData: '2026-10-09',
    };

    setData(MODULES.examesConvenio, [exameUnimed1, exameUnimed2, exameCoopend1, exameCoopend2]);

    const fluxo = syncConveniosFluxoConsolidado();
    const unimedEntries = fluxo.filter((f) => f.nome === 'Unimed');
    const coopendEntries = fluxo.filter((f) => f.nome === 'Coopend');

    expect(unimedEntries.length).toBe(1);
    expect(unimedEntries[0].valor).toBe(500); // 300 + 200

    expect(coopendEntries.length).toBe(1);
    expect(coopendEntries[0].valor).toBe(850); // 500 + 350

    // No total de convênios há exatamente 2 lançamentos no caixa
    expect(fluxo.length).toBe(2);
  });

  it('consolida exames de IPM, Bradesco e outros convênios não-Unimed na entrada única de "Coopend"', () => {
    // Exame pelo IPM
    const exameIPM = {
      id: 'ex_ipm',
      convenio: 'IPM',
      paciente: 'MARIA ALVES',
      data: '2026-10-04',
      fluxoLancado: true,
      fluxoValorLancado: 350,
      fluxoData: '2026-10-04',
    };
    // Exame pelo Bradesco
    const exameBradesco = {
      id: 'ex_brad',
      convenio: 'BRADESCO SAUDE',
      paciente: 'FERNANDO DIAS',
      data: '2026-10-06',
      fluxoLancado: true,
      fluxoValorLancado: 450,
      fluxoData: '2026-10-06',
    };
    // Exame pela Cassi
    const exameCassi = {
      id: 'ex_cassi',
      convenio: 'CASSI',
      paciente: 'ANA PAULA',
      data: '2026-10-08',
      fluxoLancado: true,
      fluxoValorLancado: 200,
      fluxoData: '2026-10-08',
    };
    // Exame pela Unimed
    const exameUnimed = {
      id: 'ex_uni',
      convenio: 'UNIMED',
      paciente: 'ROBERTO COSTA',
      data: '2026-10-07',
      fluxoLancado: true,
      fluxoValorLancado: 600,
      fluxoData: '2026-10-07',
    };

    setData(MODULES.examesConvenio, [exameIPM, exameBradesco, exameCassi, exameUnimed]);

    const fluxo = syncConveniosFluxoConsolidado();

    // No fluxo de caixa só devem existir DUAS entradas de convênio: "Unimed" e "Coopend"
    expect(fluxo.length).toBe(2);

    const unimed = fluxo.find((f) => f.nome === 'Unimed');
    const coopend = fluxo.find((f) => f.nome === 'Coopend');

    expect(unimed).toBeDefined();
    expect(unimed.valor).toBe(600);
    expect(unimed.qtdExames).toBe(1);

    expect(coopend).toBeDefined();
    // IPM (350) + Bradesco (450) + Cassi (200) = 1000
    expect(coopend.valor).toBe(1000);
    expect(coopend.qtdExames).toBe(3);
    expect(coopend.isConvenioConsolidado).toBe(true);
    expect(coopend.convenioConsolidado).toBe('COOPEND');
    expect(coopend.examesIds).toEqual(['ex_ipm', 'ex_brad', 'ex_cassi']);

    // Nenhuma entrada individual com nome IPM, Bradesco ou Cassi existe no fluxo
    expect(fluxo.find((f) => f.nome === 'IPM')).toBeUndefined();
    expect(fluxo.find((f) => f.nome === 'BRADESCO SAUDE')).toBeUndefined();
    expect(fluxo.find((f) => f.nome === 'CASSI')).toBeUndefined();
  });

  it('atualiza o valor consolidado ao alterar ou remover um exame', () => {
    const exame1 = {
      id: 'ex_1',
      convenio: 'UNIMED',
      data: '2026-10-05',
      fluxoLancado: true,
      fluxoValorLancado: 300,
      fluxoData: '2026-10-05',
    };
    const exame2 = {
      id: 'ex_2',
      convenio: 'UNIMED',
      data: '2026-10-08',
      fluxoLancado: true,
      fluxoValorLancado: 450,
      fluxoData: '2026-10-08',
    };

    setData(MODULES.examesConvenio, [exame1, exame2]);
    let fluxo = syncConveniosFluxoConsolidado();
    expect(fluxo.find((f) => f.nome === 'Unimed').valor).toBe(750);

    // Atualiza exame 2 para R$ 550
    const exame2Atualizado = { ...exame2, fluxoValorLancado: 550 };
    setData(MODULES.examesConvenio, [exame1, exame2Atualizado]);
    fluxo = syncConveniosFluxoConsolidado();
    expect(fluxo.find((f) => f.nome === 'Unimed').valor).toBe(850);

    // Remove exame 2 (deixando apenas exame 1)
    setData(MODULES.examesConvenio, [exame1]);
    fluxo = syncConveniosFluxoConsolidado();
    expect(fluxo.find((f) => f.nome === 'Unimed').valor).toBe(300);

    // Remove todos os exames de Unimed
    setData(MODULES.examesConvenio, []);
    fluxo = syncConveniosFluxoConsolidado();
    expect(fluxo.filter((f) => f.nome === 'Unimed').length).toBe(0);
  });

  it('limpa entradas antigas fragmentadas de "REPASSE CONVÊNIO..." e consolida', () => {
    // Entradas legadas fragmentadas no fluxo
    const legacyFluxo = [
      { id: 'f_old_1', nome: 'REPASSE CONVÊNIO UNIMED — JOAO', valor: 300, convenioId: 'ex_1', data: '2026-10-05' },
      { id: 'f_old_2', nome: 'REPASSE CONVÊNIO UNIMED — MARIA', valor: 400, convenioId: 'ex_2', data: '2026-10-06' },
      { id: 'f_normal', nome: 'PAGAMENTO DIVERSO', valor: 150, tipo: 'entrada', data: '2026-10-05' },
    ];
    setData(MODULES.fluxoCaixa, legacyFluxo);

    const exame1 = { id: 'ex_1', convenio: 'UNIMED', data: '2026-10-05', fluxoLancado: true, fluxoValorLancado: 300 };
    const exame2 = { id: 'ex_2', convenio: 'UNIMED', data: '2026-10-06', fluxoLancado: true, fluxoValorLancado: 400 };
    setData(MODULES.examesConvenio, [exame1, exame2]);

    const fluxo = syncConveniosFluxoConsolidado();

    // Entradas antigas com REPASSE CONVÊNIO ou convenioId foram removidas
    expect(fluxo.find((f) => f.id === 'f_old_1')).toBeUndefined();
    expect(fluxo.find((f) => f.id === 'f_old_2')).toBeUndefined();
    // Entrada não relacionada foi preservada
    expect(fluxo.find((f) => f.id === 'f_normal')).toBeDefined();
    // Entrada única consolidada "Unimed" presente com a soma total
    const unimed = fluxo.find((f) => f.nome === 'Unimed');
    expect(unimed).toBeDefined();
    expect(unimed.valor).toBe(700);
  });
});

describe('relatório consolidado com entradas Unimed e Coopend', () => {
  it('não duplica faturamento quando Unimed e Coopend estão consolidados no fluxo', () => {
    const period = getAcquisitionPeriod(new Date('2026-10-01T00:00:00'));

    const examesConvenio = [
      {
        id: 'u1',
        convenio: 'UNIMED',
        data: '2026-10-05',
        fluxoLancado: true,
        fluxoValorLancado: 500,
        fluxoData: '2026-10-05',
        valorClinica: 500,
        valorMedico: 0,
      },
      {
        id: 'c1',
        convenio: 'COOPEND',
        data: '2026-10-08',
        fluxoLancado: true,
        fluxoValorLancado: 800,
        fluxoData: '2026-10-08',
        valorClinica: 800,
        valorMedico: 0,
      },
    ];

    const fluxoCaixa = [
      {
        id: 'conv_cons_unimed_20260916',
        nome: 'Unimed',
        tipo: 'entrada',
        valor: 500,
        data: '2026-10-05',
        isConvenioConsolidado: true,
        convenioConsolidado: 'UNIMED',
      },
      {
        id: 'conv_cons_coopend_20260916',
        nome: 'Coopend',
        tipo: 'entrada',
        valor: 800,
        data: '2026-10-08',
        isConvenioConsolidado: true,
        convenioConsolidado: 'COOPEND',
      },
      {
        id: 'outra_entrada',
        nome: 'CONSULTORIA',
        tipo: 'entrada',
        valor: 200,
        data: '2026-10-02',
      },
    ];

    const report = getConsolidatedFinancialReport(
      { examesConvenio, fluxoCaixa, detalhesExames: [] },
      period
    );

    // Faturamento de convênios = 500 + 800 = 1300
    expect(report.faturamentoConvenios).toBe(1300);
    // Outras entradas do fluxo = apenas 200 (Unimed e Coopend não são contados em duplicidade)
    expect(report.faturamentoOutrasEntradas).toBe(200);
    // Total bruto = 1300 + 200 = 1500
    expect(report.faturamentoBrutoTotal).toBe(1500);
  });
});

describe('partilha de endoscopia com polipectomia e acessório/alça', () => {
  beforeEach(() => {
    setData(MODULES.examesConvenio, []);
    setData(MODULES.detalhesExames, []);
    setData(MODULES.fluxoCaixa, []);
  });

  it('calcula e sincroniza a partilha correta de polipectomia (50/50) e alça descartável (100% clínica)', () => {
    // Cenário descrito pelo usuário:
    // Convênio paga taxa de sala (R$ 150) para a clínica
    // Convênio repassa honorários (R$ 200) + polipectomia (R$ 300) + alça (R$ 250) ao médico
    const taxaSala = 150;
    const honorarios = 200;
    const polipectomia = 300;
    const alca = 250;

    const direitoClinica = taxaSala + (polipectomia * 0.5) + alca; // 150 + 150 + 250 = 550
    const direitoMedico = honorarios + (polipectomia * 0.5); // 200 + 150 = 350
    const recebidoMedico = honorarios + polipectomia + alca; // 750
    const compensacaoClinica = recebidoMedico - direitoMedico; // 400

    expect(direitoClinica).toBe(550);
    expect(direitoMedico).toBe(350);
    expect(compensacaoClinica).toBe(400);

    const exame = {
      id: 'ex_polip_1',
      convenio: 'IPM',
      paciente: 'SEBASTIAO GOMES',
      medico: 'DR. JOEL',
      exame: 'ENDOSCOPIA DIGESTIVA ALTA',
      procedimentoComplementar: 'POLIPECTOMIA',
      data: '2026-10-09',
      modoPartilha: 'polipectomia',
      valorTaxaSala: taxaSala,
      valorHonorariosBase: honorarios,
      valorPolipectomia: polipectomia,
      valorAcessorio: alca,
      valorClinica: taxaSala,
      valorMedico: recebidoMedico,
      direitoClinica,
      direitoMedico,
      valorCompensacaoClinica: compensacaoClinica,
      fluxoLancado: true,
      fluxoValorLancado: direitoClinica, // R$ 550 consolidado no caixa
      fluxoData: '2026-10-09',
    };

    setData(MODULES.examesConvenio, [exame]);

    // 1. Sincroniza com detalhesExames
    const detalhe = syncConvenioToDetalhes(exame);
    expect(detalhe).toBeDefined();
    expect(detalhe.taxaClinica).toBe(550);
    expect(detalhe.valorAcessorios).toBe(250);
    expect(detalhe.acessorioParaMedico).toBe(false);

    // 2. Sincroniza com Fluxo de Caixa
    const fluxo = syncConveniosFluxoConsolidado();
    expect(fluxo.length).toBe(1);
    expect(fluxo[0].nome).toBe('Coopend'); // IPM roteia para Coopend
    expect(fluxo[0].valor).toBe(550);
  });
});
