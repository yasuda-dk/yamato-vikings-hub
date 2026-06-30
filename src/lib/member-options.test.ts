import { describe, expect, it } from 'vitest';
import { normalizeFirstName, validateRegistration, type MemberProfile, type MemberRegistrationInput } from './member-options';

const baseInput: MemberRegistrationInput = {
  firstName: 'Takashi',
  ageGroup: '35–39',
  footballLevel: 3,
  primaryPosition: 'MF',
  secondaryPosition: 'None',
  residenceType: 'Local resident',
  gender: 'Male',
};

const existingMember: MemberProfile = {
  id: 'member-1',
  first_name: ' Takashi ',
  age_group: '35–39',
  football_level: 3,
  primary_position: 'MF',
  secondary_position: null,
  residence_type: 'Local resident',
  gender: 'Male',
  membership_status: 'Active',
  application_role: 'Player',
  created_at: '2026-01-01T00:00:00.000Z',
};

describe('member profile validation', () => {
  it('normalizes first names for duplicate checks', () => {
    expect(normalizeFirstName('  TaKaShi   Yamato ')).toBe('takashi yamato');
  });

  it('rejects duplicate first names after normalization', () => {
    expect(validateRegistration(baseInput, [existingMember]).firstName).toBe('This name is already in use. Please choose another name or nickname.');
  });

  it('rejects matching primary and secondary positions', () => {
    expect(validateRegistration({ ...baseInput, secondaryPosition: 'MF' }, []).secondaryPosition).toBe('Secondary position must be different from primary position.');
  });

  it('accepts a valid profile', () => {
    expect(validateRegistration(baseInput, [])).toEqual({});
  });
});
