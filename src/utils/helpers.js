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
  const end = `${year}-${String(month + 1).padStart(2, '0')}-${lastDay}`;
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
    const refDate = new Date(
      baseDate.getFullYear(),
      baseDate.getMonth() + monthOffset + i,
      baseDate.getDate() || 16
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
 * Calculate how much of an exam's honorário falls in a given acquisition period.
 * Honorários are evenly distributed across installment periods.
 * @param {object} exam - The exam detail record
 * @param {object} targetPeriod - The acquisition period to check against
 * @returns {number} The honorário amount attributable to this period
 */
export function getHonorarioInPeriod(exam, targetPeriod) {
  const totalHonorarios = Number(exam.honorariosMedicos) || 0;
  if (totalHonorarios === 0) return 0;

  const pagamentos = migrateLegacyPayment(exam);
  const totalParcelas = pagamentos.reduce((s, p) => s + Math.max(1, Number(p.parcelas) || 1), 0);
  const honorarioPorParcela = totalHonorarios / totalParcelas;

  let total = 0;
  for (const pag of pagamentos) {
    const periods = getInstallmentPeriods(exam.data, pag.parcelas, pag.forma);
    for (const period of periods) {
      if (period.start === targetPeriod.start && period.end === targetPeriod.end) {
        total += honorarioPorParcela;
      }
    }
  }
  return roundCurrency(total);
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
    const pct1 = Number(exam.porcentagemMedico1) ?? 50;
    return roundCurrency((periodHonorario * pct1) / 100);
  }

  if (doc2 === target) {
    if (exam.divisaoTipo === 'valor') {
      const val2 = Number(exam.valorMedico2) || 0;
      return roundCurrency(totalHonorarios > 0 ? (periodHonorario * val2) / totalHonorarios : periodHonorario * 0.5);
    }
    const pct2 = Number(exam.porcentagemMedico2) ?? 50;
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
 * Export data to PDF (simple HTML-to-print approach)
 */
export function exportPDF(data, columns, title) {
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
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 300);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
