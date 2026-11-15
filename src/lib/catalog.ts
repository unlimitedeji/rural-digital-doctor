// Shared lists used across sign-up, onboarding and the doctor screens.

export const LANGUAGES = ['English', 'Pidgin', 'Yorùbá', 'Hausa', 'Igbo', 'Fulfulde', 'Ibibio'];

export type ProviderType =
  | 'doctor'
  | 'pharmacist'
  | 'nurse'
  | 'lab_scientist'
  | 'physiotherapist'
  | 'psychologist'
  | 'community_health_worker';

/** Each health worker type and the Nigerian body that licenses it. */
export const PROVIDER_TYPES: { id: ProviderType; label: string; body: string }[] = [
  { id: 'doctor', label: 'Doctor', body: 'MDCN' },
  { id: 'nurse', label: 'Nurse or midwife', body: 'NMCN' },
  { id: 'pharmacist', label: 'Pharmacist', body: 'PCN' },
  { id: 'lab_scientist', label: 'Lab scientist', body: 'MLSCN' },
  { id: 'physiotherapist', label: 'Physiotherapist', body: 'MRTBN' },
  { id: 'psychologist', label: 'Clinical psychologist', body: 'NPA' },
  { id: 'community_health_worker', label: 'Community health worker', body: 'CHPRBN' },
];

export function providerLabel(type: string | null | undefined): string {
  return PROVIDER_TYPES.find((p) => p.id === type)?.label ?? 'Doctor';
}

/** The partner kinds a business can register as, and their licensing body. */
export const PARTNER_KINDS = [
  { id: 'pharmacy' as const, label: 'Pharmacy or chemist', body: 'PCN' },
  { id: 'lab' as const, label: 'Diagnostic lab', body: 'MLSCN' },
];

export const CONSENT_VERSION = '2026-11-15';
