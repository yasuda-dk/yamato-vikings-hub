import { describe, expect, it } from 'vitest';
import { getPracticeVenueCost } from './practice-payments';

describe('practice venue cost', () => {
  it('uses 400 kr for 4 vs 4', () => {
    expect(getPracticeVenueCost('4 vs 4')).toBe(400);
  });

  it('preserves the existing rounded prepaid rate for standard pitches and older API data', () => {
    expect(getPracticeVenueCost('7 aside half indoor')).toBe(691);
    expect(getPracticeVenueCost()).toBe(691);
  });
});
