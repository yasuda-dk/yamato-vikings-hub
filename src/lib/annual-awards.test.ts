import { describe, expect, it } from 'vitest';
import { awardDeadlineInput, formatAwardDeadline } from './annual-awards';
describe('Award deadline display', () => {
  it('uses Copenhagen wall time regardless of the device timezone', () => {
    expect(awardDeadlineInput('2026-11-28T17:00:00Z')).toBe('2026-11-28T18:00');
    expect(formatAwardDeadline('2026-11-28T17:00:00Z')).toContain('18:00');
  });
});
