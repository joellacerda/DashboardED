import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const DEFAULT_EXAMES = [
  'CONSULTA',
  'ENDOSCOPIA',
  'COLONOSCOPIA',
  'PLASMA DE ARGÔNIO',
  'ECOENDOSCOPIA',
  'ESD',
  'RETORNO',
];

// Exams that can have a complementary procedure (polipectomia/mucosectomia)
export const EXAMES_COM_COMPLEMENTAR = ['COLONOSCOPIA', 'ENDOSCOPIA'];
export const PROCEDIMENTOS_COMPLEMENTARES = ['POLIPECTOMIA', 'MUCOSECTOMIA'];

// Check if an exam type supports complementary procedures
export function examePermiteComplementar(tipoExame) {
  if (!tipoExame) return false;
  const clean = tipoExame.trim().toUpperCase();
  return (
    EXAMES_COM_COMPLEMENTAR.includes(clean) ||
    clean.includes('COLONOSCOPIA') ||
    clean.includes('ENDOSCOPIA')
  );
}

// Convert string or array of procedimentos into a normalized array: ['POLIPECTOMIA', 'MUCOSECTOMIA']
export function normalizeProcedimentosComplementares(val) {
  if (!val) return [];
  if (Array.isArray(val)) {
    return val
      .map((item) => String(item).trim().toUpperCase())
      .filter((p) => PROCEDIMENTOS_COMPLEMENTARES.includes(p));
  }
  const str = String(val).toUpperCase();
  const list = [];
  if (str.includes('POLIPECTOMIA')) list.push('POLIPECTOMIA');
  if (str.includes('MUCOSECTOMIA')) list.push('MUCOSECTOMIA');
  return list;
}

// Format procedimentos complementares for display / storage: 'POLIPECTOMIA + MUCOSECTOMIA'
export function formatProcedimentosComplementares(val) {
  const list = normalizeProcedimentosComplementares(val);
  return list.join(' + ');
}

export function roundCurrency(value) {
  const num = Number(value) || 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

export function formatCurrency(value) {
  const num = roundCurrency(value);
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('pt-BR');
}

export function formatDateISO(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTodayISO() {
  return formatDateISO(new Date());
}

/**
 * Returns the current acquisition period (período aquisitivo).
 * Runs from the 16th of one month to the 15th of the next month.
 * @param {Date} [refDate] Reference date (defaults to today)
 * @returns {{ start: string, end: string, label: string }}
 */
export function getAcquisitionPeriod(refDate = new Date()) {
  const day = refDate.getDate();
  let startMonth, startYear, endMonth, endYear;

  if (day >= 16) {
    // Period: 16 of current month to 15 of next month
    startMonth = refDate.getMonth();
    startYear = refDate.getFullYear();
    endMonth = startMonth + 1;
    endYear = startYear;
    if (endMonth > 11) {
      endMonth = 0;
      endYear++;
    }
  } else {
    // Period: 16 of previous month to 15 of current month
    endMonth = refDate.getMonth();
    endYear = refDate.getFullYear();
    startMonth = endMonth - 1;
    startYear = endYear;
    if (startMonth < 0) {
      startMonth = 11;
      startYear--;
    }
  }

  const start = `${startYear}-${String(startMonth + 1).padStart(2, '0')}-16`;
  const end = `${endYear}-${String(endMonth + 1).padStart(2, '0')}-15`;

  const months = [
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
  ];

  const label = `16/${months[startMonth]}/${startYear} — 15/${months[endMonth]}/${endYear}`;

  return { start, end, label, startMonth, startYear, endMonth, endYear };
}

/**
 * Navigate acquisition periods forward or backward
 * @param {object} currentPeriod - Current period object from getAcquisitionPeriod
 * @param {number} direction - 1 for next, -1 for previous
 * @returns {{ start: string, end: string, label: string }}
 */
export function navigateAcquisitionPeriod(currentPeriod, direction) {
  if (!currentPeriod || typeof currentPeriod.startMonth !== 'number' || typeof currentPeriod.startYear !== 'number') {
    currentPeriod = getAcquisitionPeriod();
  }
  let { startMonth, startYear } = currentPeriod;
  startMonth += direction;
  if (startMonth > 11) {
    startMonth = 0;
    startYear++;
  } else if (startMonth < 0) {
    startMonth = 11;
    startYear--;
  }

  const refDate = new Date(startYear, startMonth, 16);
  return getAcquisitionPeriod(refDate);
}

/**
 * Check if a date string falls within a period
 */
export function isDateInPeriod(dateStr, period) {
  if (!dateStr || !period || !period.start || !period.end) return false;
  return dateStr >= period.start && dateStr <= period.end;
}

/**
 * Get month/year filter range
 */
export function getMonthRange(year, month) {
  const start = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const end = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
}

/**
 * Helper to check if payment method is Credit Card (cartão de crédito).
 * If no explicit payment method is set, assume credit card if parcelas > 1.
 */
export function isCreditCardPayment(formaPagamento, numParcelas) {
  if (typeof formaPagamento === 'object' && formaPagamento !== null && !Array.isArray(formaPagamento)) {
    const exam = formaPagamento;
    return isCreditCardPayment(exam.formaPagamento, exam.numParcelas);
  }
  const fp = (formaPagamento || '').toLowerCase().trim();
  if (fp.includes('crédito') || fp.includes('credito') || fp === 'cartão' || fp === 'cartao') {
    return true;
  }
  if (!formaPagamento && Number(numParcelas) > 1) {
    return true;
  }
  return false;
}

/**
 * Pagamento em cartão de débito (entra no período corrente, mas paga taxa de cartão).
 */
export function isDebitCardPayment(formaPagamento) {
  const fp = String(formaPagamento || '').toLowerCase();
  return fp.includes('débito') || fp.includes('debito');
}

/**
 * Migrate a legacy exam (single formaPagamento/numParcelas) to the new
 * pagamentos[] array format. Returns the array of payment objects.
 * @param {object} exam - The exam record
 * @returns {Array<{forma: string, valor: number, parcelas: number}>}
 */
export function migrateLegacyPayment(exam) {
  if (exam.pagamentos && Array.isArray(exam.pagamentos) && exam.pagamentos.length > 0) {
    return exam.pagamentos;
  }
  return [{
    forma: exam.formaPagamento || 'Cartão de Crédito',
    valor: Number(exam.valorPagamento) || 0,
    parcelas: Math.max(1, Number(exam.numParcelas) || 1),
  }];
}

/**
 * Generate the acquisition periods for each installment of a SINGLE payment method.
 * - Cartão de Crédito: 1ª parcela cai no PERÍODO SEGUINTE (month + 1).
 * - Pix, Espécie, Débito: 1ª parcela cai no PERÍODO CORRENTE (month + 0).
 * @param {string} examDate - ISO date string (YYYY-MM-DD)
 * @param {number} numParcelas - Number of installments
 * @param {string|object} [formaPagamento] - Payment method string or exam object
 * @returns {Array<{start, end, label, startMonth, startYear, endMonth, endYear}>}
 */
export function getInstallmentPeriods(examDate, numParcelas, formaPagamento) {
  if (!examDate) return [];
  const n = Math.max(1, Number(numParcelas) || 1);
  const isCredit = isCreditCardPayment(formaPagamento || examDate, numParcelas);
  const periods = [];
  const baseDate = new Date(examDate + 'T00:00:00');
  if (isNaN(baseDate.getTime())) return [];
  const monthOffset = isCredit ? 1 : 0;

  for (let i = 0; i < n; i++) {
    const targetMonth = baseDate.getMonth() + monthOffset + i;
    // Limita o dia ao último dia do mês de destino (ex.: 31/jan + 1 mês => 28/fev, sem overflow para março)
    const lastDayOfTarget = new Date(baseDate.getFullYear(), targetMonth + 1, 0).getDate();
    const refDate = new Date(
      baseDate.getFullYear(),
      targetMonth,
      Math.min(baseDate.getDate(), lastDayOfTarget)
    );
    periods.push(getAcquisitionPeriod(refDate));
  }
  return periods;
}

/**
 * Get ALL installment periods across all payment methods of an exam.
 * @param {object} exam - The exam detail record
 * @returns {Array<{start, end, ...}>}
 */
export function getAllInstallmentPeriods(exam) {
  const pagamentos = migrateLegacyPayment(exam);
  const allPeriods = [];
  for (const pag of pagamentos) {
    const periods = getInstallmentPeriods(exam.data, pag.parcelas, pag.forma);
    allPeriods.push(...periods);
  }
  return allPeriods;
}

/**
 * Distribui recebimentos e deduções de um exame pelas parcelas/períodos.
 *
 * Regras:
 *  - Taxa de cartão (valorRetidoTaxas) recai apenas sobre o valor pago no cartão
 *    (crédito e débito), proporcional ao valor de cada parcela. A taxa do crédito
 *    acompanha as parcelas; a do débito fica no período corrente. Se não houver
 *    cartão, a taxa entra no período corrente.
 *  - As demais deduções (nota fiscal, biópsia, acessórios, anestesista, taxa de clínica)
 *    caem primeiro sobre os pagamentos que entram no período corrente (Pix, débito,
 *    espécie...), já líquidos da taxa de débito. O que esses pagamentos não cobrirem é
 *    dividido igualmente entre as parcelas do crédito. Sem crédito, tudo fica no
 *    período corrente.
 *  - A taxa de clínica entra na cascata apenas para fins de honorários; no fluxo de caixa
 *    ela é integral no período do exame (ver relatório consolidado).
 *
 * @param {object} exam - The exam detail record
 * @returns {Array<{start:string,end:string,label:string,recebido:number,taxaCartao:number,deducoes:number,cats:object}>}
 *   um item por parcela. `cats` traz a parte de cada categoria de dedução (nf, biopsia,
 *   acessorios, anestesista, clinica) alocada naquela parcela.
 */
export function getExamParcelAllocations(exam) {
  const pagamentos = migrateLegacyPayment(exam);
  const parcelas = [];
  for (const pag of pagamentos) {
    const n = Math.max(1, Number(pag.parcelas) || 1);
    const credit = isCreditCardPayment(pag.forma, n);
    const debit = !credit && isDebitCardPayment(pag.forma);
    const periods = getInstallmentPeriods(exam.data, n, pag.forma);
    const valParcela = (Number(pag.valor) || 0) / n;
    for (const p of periods) {
      parcelas.push({ start: p.start, end: p.end, label: p.label, credit, debit, recebido: valParcela });
    }
  }
  if (parcelas.length === 0) return [];

  const credit = parcelas.filter((p) => p.credit);
  const imediatas = parcelas.filter((p) => !p.credit);
  const cartao = parcelas.filter((p) => p.credit || p.debit);
  const cartaoTotal = cartao.reduce((s, p) => s + p.recebido, 0);
  const imediatoTotal = imediatas.reduce((s, p) => s + p.recebido, 0);

  const taxaCartao = Number(exam.valorRetidoTaxas) || 0;
  const cats = {
    nf: Number(exam.valorNotaFiscal) || 0,
    biopsia: Number(exam.valorBiopsia) || 0,
    acessorios: exam.acessorioParaMedico ? 0 : Number(exam.valorAcessorios) || 0,
    anestesista: Number(exam.valorAnestesista) || 0,
    clinica: Number(exam.taxaClinica) || 0,
  };
  const totalDeducoes = Object.values(cats).reduce((s, v) => s + v, 0);

  parcelas.forEach((p) => {
    p.taxaCartao = 0;
    p.deducoes = 0;
  });

  // Taxa de cartão: apenas sobre o valor pago no cartão (crédito e débito), proporcional
  // ao valor. Sem cartão, entra no período corrente (pagamentos à vista).
  const taxaAlvo = cartao.length > 0 ? cartao : imediatas;
  const taxaAlvoTotal = cartao.length > 0 ? cartaoTotal : imediatoTotal;
  taxaAlvo.forEach((p) => {
    const peso = taxaAlvoTotal > 0 ? p.recebido / taxaAlvoTotal : 1 / taxaAlvo.length;
    p.taxaCartao = taxaCartao * peso;
  });

  // Demais deduções: cascata (à vista primeiro, já líquido da taxa de débito;
  // o restante é dividido igualmente entre as parcelas do crédito)
  const taxaNoImediato = imediatas.reduce((s, p) => s + p.taxaCartao, 0);
  const capacidade = Math.max(0, imediatoTotal - taxaNoImediato);
  const absorvido = credit.length === 0 ? totalDeducoes : Math.min(totalDeducoes, capacidade);
  const restante = totalDeducoes - absorvido;

  imediatas.forEach((p) => {
    const peso = imediatoTotal > 0 ? p.recebido / imediatoTotal : 1 / imediatas.length;
    p.deducoes = absorvido * peso;
  });
  if (credit.length > 0) {
    // Se não há pagamento à vista, nada foi absorvido e `restante` = totalDeducoes
    credit.forEach((p) => {
      p.deducoes = restante / credit.length;
    });
  }

  return parcelas.map((p) => {
    const fator = totalDeducoes > 0 ? p.deducoes / totalDeducoes : 0;
    return {
      start: p.start,
      end: p.end,
      label: p.label,
      recebido: p.recebido,
      taxaCartao: p.taxaCartao,
      deducoes: p.deducoes,
      cats: {
        nf: cats.nf * fator,
        biopsia: cats.biopsia * fator,
        acessorios: cats.acessorios * fator,
        anestesista: cats.anestesista * fator,
        clinica: cats.clinica * fator,
      },
    };
  });
}

/**
 * Totais de um exame que caem em um determinado período de apuração
 * (recebido, taxa de cartão e cada categoria de dedução).
 * @returns {{parcelas:number,recebido:number,taxaCartao:number,deducoes:number,cats:object}}
 */
export function getExamAllocationInPeriod(exam, targetPeriod) {
  const result = {
    parcelas: 0,
    recebido: 0,
    taxaCartao: 0,
    deducoes: 0,
    cats: { nf: 0, biopsia: 0, acessorios: 0, anestesista: 0, clinica: 0 },
  };
  for (const p of getExamParcelAllocations(exam)) {
    if (p.start !== targetPeriod.start || p.end !== targetPeriod.end) continue;
    result.parcelas += 1;
    result.recebido += p.recebido;
    result.taxaCartao += p.taxaCartao;
    result.deducoes += p.deducoes;
    for (const k of Object.keys(result.cats)) result.cats[k] += p.cats[k];
  }
  return result;
}

/**
 * Cronograma de honorários de um exame: um item por período de apuração em que haja
 * recebimento, em ordem cronológica.
 *
 * O honorário de cada período é o que sobra do que foi recebido nele depois de
 * aplicadas as deduções alocadas (ver {@link getExamParcelAllocations}). O valor
 * gravado em `honorariosMedicos` continua sendo o total: o cálculo apenas define
 * a proporção de cada período, de modo que a soma de todos os períodos é sempre
 * igual ao total. Períodos negativos são zerados.
 *
 * Fallback (sem valores de pagamento informados): divide igualmente entre as
 * formas de pagamento e, dentro de cada uma, igualmente entre as parcelas.
 * @param {object} exam - The exam detail record
 * @returns {Array<{start:string,end:string,label:string,honorario:number}>}
 */
export function getHonorarioSchedule(exam) {
  const totalHonorarios = Number(exam.honorariosMedicos) || 0;
  const parcelas = getExamParcelAllocations(exam);
  if (parcelas.length === 0) return [];

  const byPeriod = new Map();
  for (const p of parcelas) {
    const entry = byPeriod.get(p.start) || { start: p.start, end: p.end, label: p.label, net: 0, fallback: 0 };
    entry.net += p.recebido - p.taxaCartao - p.deducoes;
    byPeriod.set(p.start, entry);
  }
  const entries = Array.from(byPeriod.values()).sort((a, b) => a.start.localeCompare(b.start));
  const totalNet = entries.reduce((s, e) => s + Math.max(0, e.net), 0);

  if (totalNet > 0) {
    entries.forEach((e) => {
      e.honorario = roundCurrency((totalHonorarios * Math.max(0, e.net)) / totalNet);
    });
  } else {
    // Fallback: sem valores informados
    const pagamentos = migrateLegacyPayment(exam);
    for (const pag of pagamentos) {
      const n = Math.max(1, Number(pag.parcelas) || 1);
      const porParcela = totalHonorarios / pagamentos.length / n;
      for (const period of getInstallmentPeriods(exam.data, n, pag.forma)) {
        const e = byPeriod.get(period.start);
        if (e) e.fallback += porParcela;
      }
    }
    entries.forEach((e) => {
      e.honorario = roundCurrency(e.fallback);
    });
  }

  // Ajusta centavos de arredondamento no último período com honorário
  const soma = entries.reduce((s, e) => s + e.honorario, 0);
  const diff = roundCurrency(totalHonorarios - soma);
  if (diff !== 0 && Math.abs(diff) < 0.1 * entries.length + 0.01) {
    for (let i = entries.length - 1; i >= 0; i--) {
      if (entries[i].honorario > 0) {
        entries[i].honorario = roundCurrency(entries[i].honorario + diff);
        break;
      }
    }
  }

  return entries.map(({ start, end, label, honorario }) => ({ start, end, label, honorario }));
}

/**
 * Calculate how much of an exam's honorário falls in a given acquisition period.
 * Ver {@link getHonorarioSchedule} para a regra.
 * @param {object} exam - The exam detail record
 * @param {object} targetPeriod - The acquisition period to check against
 * @returns {number} The honorário amount attributable to this period
 */
export function getHonorarioInPeriod(exam, targetPeriod) {
  if (!(Number(exam.honorariosMedicos) || 0)) return 0;
  const entry = getHonorarioSchedule(exam).find((e) => e.start === targetPeriod.start);
  return entry ? entry.honorario : 0;
}

/**
 * Check if an exam has any installment falling in a given period.
 * Checks ALL payment methods.
 * @param {object} exam - The exam detail record
 * @param {object} targetPeriod - The acquisition period to check against
 * @returns {boolean}
 */
export function examHasInstallmentInPeriod(exam, targetPeriod) {
  const allPeriods = getAllInstallmentPeriods(exam);
  return allPeriods.some((p) => p.start === targetPeriod.start && p.end === targetPeriod.end);
}

// Converte para número; valores vazios/inválidos (null, undefined, '', 'abc') usam o padrão.
export function parsePercentOrDefault(value, fallback) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Calculate how much of an exam's honorário belongs to a specific doctor in a target period,
 * considering split honorários (divisão de honorários) and installment distribution.
 * @param {object} exam - The exam detail record
 * @param {string} doctorName - The name of the doctor
 * @param {object} targetPeriod - The acquisition period
 * @returns {number}
 */
export function getHonorarioMedicoInPeriod(exam, doctorName, targetPeriod) {
  if (!doctorName) return 0;
  const periodHonorario = getHonorarioInPeriod(exam, targetPeriod);
  if (periodHonorario <= 0) return 0;

  const doc1 = (exam.medico || '').trim().toLowerCase();
  const doc2 = (exam.medico2 || '').trim().toLowerCase();
  const target = doctorName.trim().toLowerCase();

  const totalHonorarios = Number(exam.honorariosMedicos) || 0;

  // Check if exam has split honorários
  const isSplit = !!(exam.temDivisao || exam.medico2);

  if (!isSplit) {
    return doc1 === target ? roundCurrency(periodHonorario) : 0;
  }

  if (doc1 === target) {
    if (exam.divisaoTipo === 'valor') {
      const val1 = Number(exam.valorMedico1) || 0;
      return roundCurrency(totalHonorarios > 0 ? (periodHonorario * val1) / totalHonorarios : periodHonorario * 0.5);
    }
    const pct1 = parsePercentOrDefault(exam.porcentagemMedico1, 50);
    return roundCurrency((periodHonorario * pct1) / 100);
  }

  if (doc2 === target) {
    if (exam.divisaoTipo === 'valor') {
      const val2 = Number(exam.valorMedico2) || 0;
      return roundCurrency(totalHonorarios > 0 ? (periodHonorario * val2) / totalHonorarios : periodHonorario * 0.5);
    }
    const pct2 = parsePercentOrDefault(exam.porcentagemMedico2, 50);
    return roundCurrency((periodHonorario * pct2) / 100);
  }

  return 0;
}

/**
 * Check if an exam involves a specific doctor and falls in the given period.
 */
export function examHasDoctorInPeriod(exam, doctorName, targetPeriod) {
  if (!doctorName) return false;
  const doc1 = (exam.medico || '').trim().toLowerCase();
  const doc2 = (exam.medico2 || '').trim().toLowerCase();
  const target = doctorName.trim().toLowerCase();

  if (doc1 !== target && doc2 !== target) return false;
  return examHasInstallmentInPeriod(exam, targetPeriod);
}

/**
 * Generate a human-readable label for the installment span.
 * e.g. "Set/26 → Nov/26" for 3 parcelas on Credit Card starting in September
 */
/**
 * Generate a human-readable label for installment periods.
 * Supports both legacy single-payment and new multi-payment exams.
 * @param {string} examDate - ISO date string
 * @param {number|Array} numParcelasOrPagamentos - Number of installments or pagamentos array
 * @param {string} [formaPagamento] - Single payment method (legacy)
 * @returns {string}
 */
export function getInstallmentLabels(examDate, numParcelasOrPagamentos, formaPagamento) {
  const months = [
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
  ];

  const formatPeriodRange = (periods, parcelas) => {
    if (periods.length === 0) return '—';
    const firstP = periods[0];
    const lastP = periods[periods.length - 1];
    const startLabel = `${months[firstP.startMonth]}/${String(firstP.startYear).slice(-2)}`;
    if (parcelas <= 1) return startLabel;
    const endLabel = `${months[lastP.startMonth]}/${String(lastP.startYear).slice(-2)}`;
    return `${startLabel} → ${endLabel}`;
  };

  // Multi-payment: receives pagamentos array directly
  if (Array.isArray(numParcelasOrPagamentos) && numParcelasOrPagamentos.length > 0) {
    return numParcelasOrPagamentos.map((pag) => {
      const n = Math.max(1, Number(pag.parcelas) || 1);
      const periods = getInstallmentPeriods(examDate, n, pag.forma);
      const range = formatPeriodRange(periods, n);
      return `${pag.forma}: ${n}x ${range}`;
    });
  }

  // Legacy single-payment
  const n = Math.max(1, Number(numParcelasOrPagamentos) || 1);
  const isCredit = isCreditCardPayment(formaPagamento, n);
  if (n <= 1 && !isCredit) return ['—'];

  const periods = getInstallmentPeriods(examDate, n, formaPagamento);
  return [formatPeriodRange(periods, n)];
}

export function getInstallmentLabel(examDate, numParcelasOrPagamentos, formaPagamento) {
  const labels = getInstallmentLabels(examDate, numParcelasOrPagamentos, formaPagamento);
  return labels.join(' | ');
}

/**
 * Export data to CSV
 */
export function exportCSV(data, columns, filename) {
  const header = columns.map((c) => c.label).join(',');
  const rows = data.map((item) =>
    columns
      .map((c) => {
        let val = c.accessor ? c.accessor(item) : item[c.key] || '';
        val = String(val).replace(/"/g, '""');
        return `"${val}"`;
      })
      .join(',')
  );
  const csv = [header, ...rows].join('\n');
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `${filename}.csv`);
}

/**
 * Fallback HTML print generator if jsPDF fails
 */
function fallbackHtmlPrint(data, columns, title) {
  const tableRows = data
    .map(
      (item) =>
        '<tr>' +
        columns
          .map((c) => {
            const val = c.accessor ? c.accessor(item) : item[c.key] || '';
            return `<td style="padding:6px 10px;border:1px solid #ddd;font-size:11px">${val}</td>`;
          })
          .join('') +
        '</tr>'
    )
    .join('');

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8"/>
  <title>${title} - Clínica Endodiagnose</title>
  <style>
    body{font-family:Arial,sans-serif;padding:30px;color:#333}
    h1{font-size:18px;margin-bottom:4px;color:#1a1a2e}
    h2{font-size:13px;color:#666;margin-bottom:20px;font-weight:normal}
    table{border-collapse:collapse;width:100%}
    th{padding:8px 10px;border:1px solid #ccc;background:#f4f4f4;font-size:11px;text-align:left;font-weight:bold}
    td{padding:6px 10px;border:1px solid #ddd;font-size:11px}
    tr:nth-child(even){background:#fafafa}
    .footer{margin-top:20px;font-size:10px;color:#999;text-align:center}
  </style>
</head>
<body>
  <h1>${title}</h1>
  <h2>Clínica Endodiagnose — Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</h2>
  <table>
    <thead><tr>${columns.map((c) => `<th>${c.label}</th>`).join('')}</tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
  <p class="footer">Documento gerado automaticamente pelo Dashboard Clínica Endodiagnose</p>
</body>
</html>`;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);
  }
}

/**
 * Export data to a styled, native PDF file using jsPDF and jspdf-autotable
 */
export function exportPDF(data, columns, title) {
  try {
    const isLandscape = columns.length > 5;
    const doc = new jsPDF({
      orientation: isLandscape ? 'landscape' : 'portrait',
      unit: 'pt',
      format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const cleanTitle = title || 'Relatório';

    // Header bar
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, pageWidth, 54, 'F');

    // Accent line
    doc.setFillColor(14, 165, 233); // sky-500
    doc.rect(0, 52, pageWidth, 2.5, 'F');

    // Brand title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(255, 255, 255);
    doc.text('CLÍNICA ENDODIAGNOSE', 40, 27);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(203, 213, 225);
    doc.text('Dashboard de Gestão Clínica & Financeira', 40, 42);

    // Section Title & Timestamp
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(30, 41, 59);
    doc.text(cleanTitle, 40, 78);

    const now = new Date();
    const dataStr = now.toLocaleDateString('pt-BR');
    const horaStr = now.toLocaleTimeString('pt-BR');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Gerado em ${dataStr} às ${horaStr} • ${data.length} ${data.length === 1 ? 'registro' : 'registros'}`,
      40,
      93
    );

    // Prepare table headers and body
    const head = [columns.map((c) => c.label)];
    const body = data.map((item) =>
      columns.map((c) => {
        const val = c.accessor ? c.accessor(item) : item[c.key] ?? '';
        return val !== null && val !== undefined ? String(val) : '';
      })
    );

    autoTable(doc, {
      startY: 108,
      head,
      body,
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: columns.length > 7 ? 8 : 8.5,
        cellPadding: 5,
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
        lineWidth: 0.5,
      },
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: columns.length > 7 ? 8 : 8.5,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      margin: { left: 40, right: 40, bottom: 40 },
      didDrawPage: (dataHook) => {
        const pageCount = doc.internal.getNumberOfPages();
        const currentPage = dataHook.pageNumber;
        const pageHeight = doc.internal.pageSize.getHeight();

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Clínica Endodiagnose — Documento gerado automaticamente • Página ${currentPage} de ${pageCount}`,
          40,
          pageHeight - 20
        );
      },
    });

    const safeFilename = `${cleanTitle
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9_-]/g, '_')}_${now.toISOString().slice(0, 10)}.pdf`;

    doc.save(safeFilename);
  } catch (err) {
    console.error('Erro ao gerar PDF nativo:', err);
    fallbackHtmlPrint(data, columns, title);
  }
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const DIAS_SEMANA = [
  { id: 'seg', label: 'Segunda-feira', short: 'Segunda' },
  { id: 'ter', label: 'Terça-feira', short: 'Terça' },
  { id: 'qua', label: 'Quarta-feira', short: 'Quarta' },
  { id: 'qui', label: 'Quinta-feira', short: 'Quinta' },
  { id: 'sex', label: 'Sexta-feira', short: 'Sexta' },
  { id: 'sab', label: 'Sábado', short: 'Sábado' },
];

export function normalizeDiaId(val) {
  if (!val) return null;
  const str = String(val).toLowerCase();
  if (['seg', 'ter', 'qua', 'qui', 'sex', 'sab'].includes(str)) return str;
  if (str.startsWith('seg')) return 'seg';
  if (str.startsWith('ter')) return 'ter';
  if (str.startsWith('qua')) return 'qua';
  if (str.startsWith('qui')) return 'qui';
  if (str.startsWith('sex')) return 'sex';
  if (str.startsWith('sab') || str.startsWith('sáb')) return 'sab';
  if (str.includes('-')) {
    const d = new Date(str + 'T00:00:00');
    const day = d.getDay();
    const map = { 1: 'seg', 2: 'ter', 3: 'qua', 4: 'qui', 5: 'sex', 6: 'sab' };
    return map[day] || null;
  }
  return null;
}

export const TURNOS = [
  { id: 'manha', label: 'Manhã', short: 'MAN', horarioPadrao: '07:30 – 12:30', icon: '☀️' },
  { id: 'tarde', label: 'Tarde', short: 'TAR', horarioPadrao: '13:00 – 18:00', icon: '🌤️' },
];

export const MOTIVOS_TRANCA = [
  'Sem Expediente',
  'Manutenção Preventiva',
  'Higienização / Limpeza Técnica',
  'Feriado / Recesso',
  'Reforma / Reparo',
  'Treinamento de Equipe',
  'Outro',
];

export const PROCEDIMENTOS_SUGESTOES = [
  'Consultas',
  'Endoscopia Digestiva Alta',
  'Colonoscopia',
  'Polipectomia / Mucosectomia',
  'Ecoendoscopia',
  'Plasma de Argônio',
  'Retorno',
  'Geral / Misto',
];

/**
 * Parses a date or date string into local Date at 00:00:00 without UTC timezone shifts.
 */
function parseLocalDate(val) {
  if (!val) return new Date();
  if (val instanceof Date) return new Date(val.getFullYear(), val.getMonth(), val.getDate());
  if (typeof val === 'string' && val.includes('-')) {
    const [y, m, d] = val.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(val);
}

/**
 * Returns Monday to Saturday (6 days) for any given reference date.
 * @param {Date|string} [refDate]
 * @returns {{ mondayISO: string, saturdayISO: string, label: string, days: Array }}
 */
export function getWeekMondayToSaturday(refDate = new Date()) {
  const localD = parseLocalDate(refDate);
  const dayOfWeek = localD.getDay(); // 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sab
  
  // Distance to Monday (Segunda-feira)
  // If today is Sunday (0), distance to Monday of upcoming week is +1, or previous Monday -6.
  // Standard in clinics: if Sunday, view upcoming week (1).
  const distanceToMonday = dayOfWeek === 0 ? 1 : 1 - dayOfWeek;
  
  const monday = new Date(localD.getFullYear(), localD.getMonth(), localD.getDate() + distanceToMonday);

  const dayNames = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  const dayShortNames = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const todayISO = getTodayISO();

  const days = [];
  for (let i = 0; i < 6; i++) {
    const cur = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    const iso = formatDateISO(cur);
    days.push({
      date: iso,
      dateObj: cur,
      dayName: dayNames[i],
      shortName: dayShortNames[i],
      dayNumber: cur.getDate(),
      month: cur.getMonth() + 1,
      monthName: months[cur.getMonth()],
      formattedDate: `${String(cur.getDate()).padStart(2, '0')}/${String(cur.getMonth() + 1).padStart(2, '0')}`,
      isToday: iso === todayISO,
    });
  }

  const startD = days[0].dateObj;
  const endD = days[5].dateObj;
  const label = `${startD.getDate()} de ${months[startD.getMonth()]} a ${endD.getDate()} de ${months[endD.getMonth()]}, ${endD.getFullYear()}`;

  return {
    mondayISO: days[0].date,
    saturdayISO: days[5].date,
    label,
    days,
  };
}

/**
 * Navigate weeks forward or backward
 * @param {string} currentMondayISO
 * @param {number} weeksDelta
 */
export function navigateWeek(currentMondayISO, weeksDelta) {
  const base = parseLocalDate(currentMondayISO);
  base.setDate(base.getDate() + (weeksDelta * 7));
  return getWeekMondayToSaturday(base);
}

