import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Chip, Loading } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { colors, naira, radius } from '@/lib/theme';

// weekday: 0 = Sunday ... 6 = Saturday
const DAYS = [
  { weekday: 1, label: 'Mon' },
  { weekday: 2, label: 'Tue' },
  { weekday: 3, label: 'Wed' },
  { weekday: 4, label: 'Thu' },
  { weekday: 5, label: 'Fri' },
  { weekday: 6, label: 'Sat' },
  { weekday: 0, label: 'Sun' },
];
const DEFAULT_HOURS = { start_time: '09:00', end_time: '17:00' };
const LENGTHS = [15, 20, 30];

type Hours = { weekday: number; start_time: string; end_time: string };
type Fees = { fee_video_kobo: number; fee_audio_kobo: number; fee_clinic_kobo: number; slot_minutes: number };

export default function Schedule() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [hours, setHours] = useState<Hours[] | null>(null);
  const [fees, setFees] = useState<Fees | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      let active = true;
      (async () => {
        const [a, d] = await Promise.all([
          supabase.from('doctor_availability').select('weekday, start_time, end_time').eq('doctor_id', userId),
          supabase
            .from('doctors')
            .select('fee_video_kobo, fee_audio_kobo, fee_clinic_kobo, slot_minutes')
            .eq('id', userId)
            .maybeSingle(),
        ]);
        if (!active) return;
        setHours((a.data as Hours[] | null) ?? []);
        setFees((d.data as Fees | null) ?? null);
      })();
      return () => {
        active = false;
      };
    }, [userId]),
  );

  async function toggleDay(weekday: number, on: boolean) {
    if (!userId || !hours) return;
    setError(null);
    const before = hours;
    if (on) {
      setHours([...hours, { weekday, ...DEFAULT_HOURS }]);
      const { error: err } = await supabase.from('doctor_availability').insert({ doctor_id: userId, weekday, ...DEFAULT_HOURS });
      if (err) {
        setHours(before);
        setError('Could not save. Check your network and try again.');
      }
    } else {
      setHours(hours.filter((h) => h.weekday !== weekday));
      const { error: err } = await supabase.from('doctor_availability').delete().eq('doctor_id', userId).eq('weekday', weekday);
      if (err) {
        setHours(before);
        setError('Could not save. Check your network and try again.');
      }
    }
  }

  async function setLength(minutes: number) {
    if (!userId || !fees) return;
    const before = fees;
    setFees({ ...fees, slot_minutes: minutes });
    const { error: err } = await supabase.from('doctors').update({ slot_minutes: minutes }).eq('id', userId);
    if (err) {
      setFees(before);
      setError('Could not save. Check your network and try again.');
    }
  }

  if (!hours) return <Loading />;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>My schedule</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={styles.heading}>Days I am available</Text>
        <View style={styles.card}>
          {DAYS.map((d) => {
            const h = hours.find((x) => x.weekday === d.weekday);
            return (
              <View key={d.weekday} style={styles.dayRow}>
                <Text style={styles.dayLabel}>{d.label}</Text>
                <Text style={[styles.dayHours, !h && { color: colors.muted }]}>
                  {h ? `${h.start_time.slice(0, 5)} – ${h.end_time.slice(0, 5)}` : 'Day off'}
                </Text>
                <Switch
                  value={!!h}
                  onValueChange={(on) => toggleDay(d.weekday, on)}
                  accessibilityLabel={`Available on ${d.label}`}
                  trackColor={{ true: colors.brand, false: '#8A9A9C' }}
                  thumbColor="#FFFFFF"
                />
              </View>
            );
          })}
        </View>
        {/* TODO: let the doctor edit start and end times; new days start at 09:00 to 17:00. */}

        {fees ? (
          <>
            <Text style={styles.heading}>Length of each visit</Text>
            <View style={styles.row}>
              {LENGTHS.map((m) => (
                <View key={m} style={{ flex: 1 }}>
                  <Chip label={`${m} min`} selected={fees.slot_minutes === m} onPress={() => setLength(m)} />
                </View>
              ))}
            </View>

            <Text style={styles.heading}>My fees</Text>
            <View style={styles.row}>
              {[
                { label: 'Video', value: fees.fee_video_kobo },
                { label: 'Audio only', value: fees.fee_audio_kobo },
                { label: 'Clinic', value: fees.fee_clinic_kobo },
              ].map((f) => (
                <View key={f.label} style={styles.feeCard}>
                  <Text style={styles.feeLabel}>{f.label}</Text>
                  <Text style={styles.feeValue}>{naira(f.value)}</Text>
                </View>
              ))}
            </View>
          </>
        ) : (
          <Text style={styles.error}>Your doctor listing has not been set up yet.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  content: { padding: 20, gap: 12 },
  title: { fontSize: 26, fontWeight: '700', color: colors.ink },
  heading: { fontSize: 14, fontWeight: '600', color: colors.ink, marginTop: 4 },
  error: { fontSize: 14, color: colors.danger, lineHeight: 20 },
  card: { backgroundColor: colors.card, borderRadius: radius.md, paddingHorizontal: 14 },
  dayRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12 },
  dayLabel: { width: 44, fontSize: 14, fontWeight: '600', color: colors.ink },
  dayHours: { flex: 1, fontSize: 14, color: colors.ink },
  row: { flexDirection: 'row', gap: 8 },
  feeCard: { flex: 1, backgroundColor: colors.card, borderRadius: 14, padding: 12, gap: 2 },
  feeLabel: { fontSize: 12, color: colors.muted },
  feeValue: { fontSize: 15, fontWeight: '700', color: colors.ink },
});
