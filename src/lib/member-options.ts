export const DEFAULT_TEAM_ID = '00000000-0000-0000-0000-000000000001';

export const ageGroups = ['Under 25', '25–29', '30–34', '35–39', '40+', 'Not specified'] as const;
export const residenceTypes = ['Local resident', 'Expat', 'Student', 'Working holiday', 'Other', 'Not specified'] as const;
export const positions = ['FW', 'MF', 'DF'] as const;
export const footballLevels = [1, 2, 3, 4, 5] as const;

export type AgeGroup = (typeof ageGroups)[number];
export type ResidenceType = (typeof residenceTypes)[number];
export type Position = (typeof positions)[number];
export type FootballLevel = (typeof footballLevels)[number];
export type SecondaryPosition = Position | 'None';

export type MemberProfile = {
  id: string;
  first_name: string;
  age_group: AgeGroup;
  football_level: FootballLevel;
  primary_position: Position;
  secondary_position: Position | null;
  residence_type: ResidenceType;
  membership_status: 'Active' | 'Inactive';
  application_role: 'Player' | 'Admin';
  created_at: string;
};

export type MemberRegistrationInput = {
  firstName: string;
  ageGroup: AgeGroup;
  footballLevel: FootballLevel;
  primaryPosition: Position;
  secondaryPosition: SecondaryPosition;
  residenceType: ResidenceType;
};

export function normalizeFirstName(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function isAgeGroup(value: string): value is AgeGroup {
  return ageGroups.includes(value as AgeGroup);
}

export function isResidenceType(value: string): value is ResidenceType {
  return residenceTypes.includes(value as ResidenceType);
}

export function isPosition(value: string): value is Position {
  return positions.includes(value as Position);
}

export function isFootballLevel(value: number): value is FootballLevel {
  return footballLevels.includes(value as FootballLevel);
}

export function validateRegistration(input: MemberRegistrationInput, existingMembers: MemberProfile[]) {
  const errors: Partial<Record<keyof MemberRegistrationInput, string>> = {};
  const normalizedName = normalizeFirstName(input.firstName);

  if (!normalizedName) {
    errors.firstName = 'First name is required.';
  } else if (existingMembers.some((member) => normalizeFirstName(member.first_name) === normalizedName)) {
    errors.firstName = 'This name is already in use. Please choose another name or nickname.';
  }

  if (!isAgeGroup(input.ageGroup)) errors.ageGroup = 'Select an age group.';
  if (!isFootballLevel(input.footballLevel)) errors.footballLevel = 'Select a football level.';
  if (!isPosition(input.primaryPosition)) errors.primaryPosition = 'Select a primary position.';
  if (input.secondaryPosition !== 'None' && !isPosition(input.secondaryPosition)) {
    errors.secondaryPosition = 'Select a secondary position.';
  }
  if (input.secondaryPosition !== 'None' && input.secondaryPosition === input.primaryPosition) {
    errors.secondaryPosition = 'Secondary position must be different from primary position.';
  }
  if (!isResidenceType(input.residenceType)) errors.residenceType = 'Select a residence type.';

  return errors;
}
