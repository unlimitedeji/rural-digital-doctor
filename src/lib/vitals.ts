export type VitalKind = 'blood_pressure' | 'blood_sugar' | 'weight' | 'temperature' | 'pulse';
export type Vital = { id: string; kind: VitalKind; value_1: number; value_2: number | null; measured_at: string };

export const VITALS: { id: VitalKind; label: string; unit: string; icon: string; hint: string }[] = [
  { id: 'blood_pressure', label: 'Blood pressure', unit: 'mmHg', icon: 'heart', hint: 'Top and bottom numbers, for example 120 / 80' },
  { id: 'blood_sugar', label: 'Blood sugar', unit: 'mmol/L', icon: 'water', hint: 'From a glucose meter, for example 5.4' },
  { id: 'weight', label: 'Weight', unit: 'kg', icon: 'barbell', hint: 'In kilograms, for example 70' },
  { id: 'temperature', label: 'Temperature', unit: '°C', icon: 'thermometer', hint: 'In degrees Celsius, for example 37.2' },
  { id: 'pulse', label: 'Pulse', unit: 'beats/min', icon: 'pulse', hint: 'Heartbeats in one minute, for example 72' },
];

export function vitalInfo(kind: VitalKind) {
  return VITALS.find((v) => v.id === kind)!;
}

export function formatVital(v: Pick<Vital, 'kind' | 'value_1' | 'value_2'>): string {
  const info = vitalInfo(v.kind);
  const value = v.kind === 'blood_pressure' ? `${v.value_1}/${v.value_2}` : `${v.value_1}`;
  return `${value} ${info.unit}`;
}

/** The newest reading of each kind, in the order of VITALS. */
export function latestByKind(rows: Vital[]): Vital[] {
  const seen = new Map<VitalKind, Vital>();
  for (const r of [...rows].sort((a, b) => b.measured_at.localeCompare(a.measured_at))) {
    if (!seen.has(r.kind)) seen.set(r.kind, r);
  }
  return VITALS.map((v) => seen.get(v.id)).filter((v): v is Vital => !!v);
}
