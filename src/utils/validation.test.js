import { describe, it, expect } from 'vitest';
import { validatePercentageSum } from './validation';

describe('validatePercentageSum', () => {
  it('aceita divisão inteira 50% / 50%', () => {
    expect(validatePercentageSum(50, 50)).toBeNull();
  });

  it('aceita divisão com 1 casa decimal 87.5% / 12.5%', () => {
    expect(validatePercentageSum(87.5, 12.5)).toBeNull();
  });

  it('aceita divisão com 2 casas decimais 87.75% / 12.25%', () => {
    expect(validatePercentageSum(87.75, 12.25)).toBeNull();
  });

  it('aceita valores passados como string "87.75" / "12.25"', () => {
    expect(validatePercentageSum('87.75', '12.25')).toBeNull();
  });

  it('rejeita soma diferente de 100% (ex: 87.75% e 12.3%)', () => {
    const err = validatePercentageSum(87.75, 12.3);
    expect(err).toContain('100.05%');
  });

  it('rejeita soma incompleta (ex: 80% e 10%)', () => {
    const err = validatePercentageSum(80, 10);
    expect(err).toContain('90%');
  });
});
