import { describe, it, expect, afterEach } from 'vitest';
import { withdrawalFeeTzs } from './fees';

const ENV_KEYS = ['WITHDRAWAL_FEE_PERCENT', 'WITHDRAWAL_FEE_FLAT_TZS'];

afterEach(() => {
  for (const k of ENV_KEYS) delete process.env[k];
});

describe('withdrawalFeeTzs', () => {
  it('defaults to 0 when nothing is configured', () => {
    expect(withdrawalFeeTzs(6000)).toBe(0);
  });

  it('applies a percentage fee, rounded up', () => {
    process.env.WITHDRAWAL_FEE_PERCENT = '1.5';
    expect(withdrawalFeeTzs(6000)).toBe(90); // 1.5% of 6000
    process.env.WITHDRAWAL_FEE_PERCENT = '1';
    expect(withdrawalFeeTzs(101)).toBe(2); // ceil(1.01)
  });

  it('applies a flat fee', () => {
    process.env.WITHDRAWAL_FEE_FLAT_TZS = '100';
    expect(withdrawalFeeTzs(6000)).toBe(100);
  });

  it('combines percentage and flat', () => {
    process.env.WITHDRAWAL_FEE_PERCENT = '1';
    process.env.WITHDRAWAL_FEE_FLAT_TZS = '50';
    expect(withdrawalFeeTzs(6000)).toBe(110); // 60 + 50
  });

  it('ignores invalid / negative config', () => {
    process.env.WITHDRAWAL_FEE_PERCENT = 'abc';
    process.env.WITHDRAWAL_FEE_FLAT_TZS = '-5';
    expect(withdrawalFeeTzs(6000)).toBe(0);
  });

  it('returns 0 for non-positive amounts', () => {
    process.env.WITHDRAWAL_FEE_PERCENT = '5';
    expect(withdrawalFeeTzs(0)).toBe(0);
    expect(withdrawalFeeTzs(-100)).toBe(0);
  });
});
