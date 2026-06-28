import { describe, expect, it } from 'vitest';
import { requireEnv } from './env';

describe('environment validation', () => {
  it('returns valid string values', () => {
    expect(requireEnv('TEST_VALUE', 'present')).toBe('present');
  });

  it('rejects missing values without exposing secret contents', () => {
    expect(() => requireEnv('TEST_SECRET', '')).toThrow('TEST_SECRET is required');
  });
});
