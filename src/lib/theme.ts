export const colors = {
  ground: '#F3F6F5',
  card: '#FFFFFF',
  ink: '#0F2A2E',
  muted: '#55676A',
  line: '#DCE4E2',
  brand: '#0B6B5C',
  brandTint: '#DDEFEA',
  brandDark: '#084F44',
  amber: '#F2A63B',
  amberTint: '#FCE9C8',
  amberText: '#7A4A00',
  danger: '#B3261E',
};

export const radius = { sm: 12, md: 16, lg: 20 };

export type VisitMode = 'video' | 'audio' | 'clinic';

export const modeLabels: Record<VisitMode, { label: string; note: string }> = {
  video: { label: 'Video', note: 'Face to face' },
  audio: { label: 'Audio', note: 'Low data' },
  clinic: { label: 'Clinic', note: 'In person' },
};

/** Money is stored in kobo. 500000 kobo is shown as ₦5,000. */
export function naira(kobo: number): string {
  return '₦' + Math.round(kobo / 100).toLocaleString('en-NG');
}

export function initials(name: string): string {
  return name
    .replace(/^Dr\.?\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');
}

export function formatWhen(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit' });
  return `${day} · ${time}`;
}
