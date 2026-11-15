import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState, type ComponentProps } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Chip, Loading } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { colors, radius } from '@/lib/theme';
import { formatVital, VITALS, vitalInfo, type Vital, type VitalKind } from '@/lib/vitals';

type IconName = ComponentProps<typeof Ionicons>['name'];

function toNumber(text: string): number | null {
  const n = Number(text.replace(',', '.').trim());
  return text.trim() && Number.isFinite(n) && n > 0 && n < 1000 ? n : null;
}

export default function Vitals() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [rows, setRows] = useState<Vital[] | null>(null);
  const [kind, setKind] = useState<VitalKind>('blood_pressure');
  const [first, setFirst] = useState('');
  const [second, setSecond] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('vitals')
      .select('id, kind, value_1, value_2, measured_at')
      .eq('patient_id', userId)
      .order('measured_at', { ascending: false })
      .limit(60);
    setRows((data as Vital[] | null) ?? []);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    if (!userId) return;
    setNotice(null);
    const a = toNumber(first);
    const b = kind === 'blood_pressure' ? toNumber(second) : null;
    if (a == null || (kind === 'blood_pressure' && b == null)) {
      setNotice({ text: vitalInfo(kind).hint, error: true });
      return;
    }
    setBusy(true);
    const { error } = await supabase.from('vitals').insert({ patient_id: userId, kind, value_1: a, value_2: b });
    setBusy(false);
    if (error) {
      setNotice({ text: 'Could not save. Check your network and try again.', error: true });
      return;
    }
    setFirst('');
    setSecond('');
    setNotice({ text: 'Saved. Your doctors can see it.', error: false });
    load();
  }

  if (!rows) return <Loading />;
  const info = vitalInfo(kind);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <Text style={styles.heading}>Add a reading</Text>
        <View style={styles.wrap}>
          {VITALS.map((v) => (
            <Chip
              key={v.id}
              label={v.label}
              selected={kind === v.id}
              onPress={() => {
                setKind(v.id);
                setNotice(null);
              }}
            />
          ))}
        </View>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={first}
            onChangeText={setFirst}
            keyboardType="decimal-pad"
            placeholder={kind === 'blood_pressure' ? 'Top' : info.label}
            placeholderTextColor={colors.muted}
            accessibilityLabel={kind === 'blood_pressure' ? 'Top number' : info.label}
          />
          {kind === 'blood_pressure' ? (
            <>
              <Text style={styles.slash}>/</Text>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={second}
                onChangeText={setSecond}
                keyboardType="decimal-pad"
                placeholder="Bottom"
                placeholderTextColor={colors.muted}
                accessibilityLabel="Bottom number"
              />
            </>
          ) : null}
          <Text style={styles.unit}>{info.unit}</Text>
        </View>
        <Text style={styles.hint}>{info.hint}</Text>
        {notice ? <Text style={[styles.notice, { color: notice.error ? colors.danger : colors.brandDark }]}>{notice.text}</Text> : null}
        <Button label="Save reading" onPress={save} busy={busy} />
      </View>

      <Text style={styles.heading}>History</Text>
      {rows.length === 0 ? <Text style={styles.empty}>No readings yet.</Text> : null}
      {rows.map((r) => (
        <View key={r.id} style={styles.rowCard}>
          <View style={styles.icon}>
            <Ionicons name={vitalInfo(r.kind).icon as IconName} size={20} color={colors.brand} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>{vitalInfo(r.kind).label}</Text>
            <Text style={styles.small}>
              {new Date(r.measured_at).toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
            </Text>
          </View>
          <Text style={styles.value}>{formatVital(r)}</Text>
        </View>
      ))}
      <Text style={styles.small}>
        These readings help your doctor. If a reading worries you, book a visit or use Emergency call on the home screen.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  content: { padding: 20, gap: 12, paddingBottom: 32 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 16, gap: 12 },
  heading: { fontSize: 17, fontWeight: '700', color: colors.ink },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    height: 52,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.line,
    paddingHorizontal: 14,
    fontSize: 18,
    color: colors.ink,
    backgroundColor: colors.ground,
  },
  slash: { fontSize: 22, color: colors.muted },
  unit: { fontSize: 14, color: colors.muted, minWidth: 56 },
  hint: { fontSize: 13, color: colors.muted },
  notice: { fontSize: 14, lineHeight: 20 },
  empty: { fontSize: 15, color: colors.muted },
  rowCard: { backgroundColor: colors.card, borderRadius: radius.md, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 15, fontWeight: '600', color: colors.ink },
  small: { fontSize: 12, color: colors.muted, lineHeight: 17 },
  value: { fontSize: 15, fontWeight: '700', color: colors.ink },
});
