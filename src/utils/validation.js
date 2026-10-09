/**
 * Utility functions for form validations and feedback (Item 3.2)
 */

export function isValidDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return false;
  // Match YYYY-MM-DD
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  if (year < 1990 || year > 2099) return false;
  if (month < 1 || month > 12) return false;

  const daysInMonth = new Date(year, month, 0).getDate();
  return day >= 1 && day <= daysInMonth;
}

export function validateDate(dateStr, fieldName = 'Data') {
  if (!dateStr || String(dateStr).trim() === '') {
    return `${fieldName} é obrigatória.`;
  }
  if (!isValidDate(dateStr)) {
    return `${fieldName} inválida. Use o formato DD/MM/AAAA.`;
  }
  return null;
}

export function validateRequired(val, fieldName = 'Este campo') {
  if (val === null || val === undefined) {
    return `${fieldName} é obrigatório(a).`;
  }
  if (typeof val === 'string' && val.trim() === '') {
    return `${fieldName} é obrigatório(a).`;
  }
  if (Array.isArray(val) && val.length === 0) {
    return `${fieldName} é obrigatório(a).`;
  }
  return null;
}

export function validatePositiveNumber(val, fieldName = 'Valor', allowZero = false) {
  if (val === '' || val === null || val === undefined) {
    return `${fieldName} é obrigatório.`;
  }
  const num = Number(val);
  if (isNaN(num)) {
    return `${fieldName} deve ser um número válido.`;
  }
  if (allowZero) {
    if (num < 0) return `${fieldName} não pode ser negativo.`;
  } else {
    if (num <= 0) return `${fieldName} deve ser maior que zero.`;
  }
  return null;
}

export function validatePercentageSum(pct1, pct2) {
  const p1 = Number(pct1) || 0;
  const p2 = Number(pct2) || 0;
  const sum = Math.round((p1 + p2) * 100) / 100;
  if (sum !== 100) {
    return `A soma dos percentuais (${sum}%) deve totalizar exatamente 100%.`;
  }
  return null;
}
