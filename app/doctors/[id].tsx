import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, Button, Card, Chip, Loading, Message } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { colors, modeLabels, naira, type VisitMode } from '@/lib/theme';

type Doctor = {
  id: string;
  display_name: string;
  specialty: string;
  bio: string | null;
  languages: string[];
  years_experience: number | null;
  fee_video_kobo: number;
  fee_audio_kobo: number;
  fee_clinic_kobo: number;
  slot_minutes: number;
};

// weekday: 0 = Sunday ... 6 = Saturday, the same as JavaScript's Date.getDay()
type Availability = { weekday: number; start_time: string; end_time: string };

const MODES: VisitMode[] = ['video', 'audio', 'clinic'];
const DAYS_AHEAD = 5;

function minutesOf(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function nextDays(): Date[] {
  const days: Date[] = [];
  for (let i = 0; i < DAYS_AHEAD; i += 1) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  return days;
}

export default function BookDoctor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const router = useRouter();
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<VisitMode>('video');
  const [dayIndex, setDayIndex] = useState(0);
  const [slot, setSlot] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [bookError, setBookError] = useState<string | null>(null);
  const [taken, setTaken] = useState<Set<number>>(new Set());

  const days = useMemo(nextDays, []);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      supabase
        .from('doctors')
        .select(
          'id, display_name, specialty, bio, languages, years_experience, fee_video_kobo, fee_audio_kobo, fee_clinic_kobo, slot_minutes',
        )
        .eq('id', id)
        .maybeSingle(),
      supabase.from('doctor_availability').select('weekday, start_time, end_time').eq('doctor_id', id),
    ]).then(([d, a]) => {
      if (d.error || !d.data) setLoadError('This doctor is not available right now.');
      else setDoctor(d.data as Doctor);
      setAvailability((a.data as Availability[] | null) ?? []);
    });
    // Times already taken with this doctor (no patient details are returned).
    const from = new Date();
    const to = new Date(from.getTime() + (DAYS_AHEAD + 1) * 24 * 60 * 60 * 1000);
    supabase
      .rpc('booked_slots', { p_doctor: id, p_from: from.toISOString(), p_to: to.toISOString() })
      .then(({ data }) => {
        const times = ((data as string[] | null) ?? []).map((iso) => new Date(iso).getTime());
        setTaken(new Set(times));
      });
  }, [id]);

  // Start times, in minutes after midnight, for the chosen day.
  const slots = useMemo(() => {
    if (!doctor) return [];
    const day = days[dayIndex]!;
    const hours = availability.find((a) => a.weekday === day.getDay());
    if (!hours) return [];
    const now = new Date();
    const isToday = day.toDateString() === now.toDateString();
    const earliest = isToday ? now.getHours() * 60 + now.getMinutes() + 15 : 0;
    const out: number[] = [];
    for (let t = minutesOf(hours.start_time); t + doctor.slot_minutes <= minutesOf(hours.end_time); t += doctor.slot_minutes) {
      const start = new Date(day);
      start.setMinutes(t);
      if (t >= earliest && !taken.has(start.getTime())) out.push(t);
    }
    return out;
  }, [doctor, availability, days, dayIndex, taken]);

  if (loadError) return <Message text={loadError} />;
  if (!doctor) return <Loading />;

  const fee = mode === 'video' ? doctor.fee_video_kobo : mode === 'audio' ? doctor.fee_audio_kobo : doctor.fee_clinic_kobo;

  function slotLabel(minutes: number): string {
    const d = new Date(days[dayIndex]!);
    d.setMinutes(minutes);
    return d.toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit' });
  }

  async function book() {
    const userId = session?.user.id;
    if (!userId || slot == null || !doctor) return;
    setBusy(true);
    setBookError(null);
    const startsAt = new Date(days[dayIndex]!);
    startsAt.setMinutes(slot);
    // The server sets the fee, end time and status; the app only says who, when and how.
    const { data, error } = await supabase
      .from('appointments')
      .insert({ patient_id: userId, doctor_id: doctor.id, mode, starts_at: startsAt.toISOString() })
      .select('id')
      .single();
    setBusy(false);
    if (error) {
      setBookError(
        error.code === '23505'
          ? 'Someone just took that time. Please choose another.'
          : 'Could not book this visit. Check your network and try again.',
      );
      return;
    }
    router.replace({ pathname: '/pay/[appointmentId]', params: { appointmentId: data.id } });
  }

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={{ gap: 12 }}>
          <View style={styles.doctor}>
            <Avatar name={doctor.display_name} size={60} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{doctor.display_name}</Text>
              <Text style={styles.meta}>
                {doctor.specialty}
                {doctor.years_experience != null ? ` · ${doctor.years_experience} years` : ''}
              </Text>
              <Text style={styles.verified}>Licence verified by MDCN</Text>
            </View>
          </View>
          {doctor.bio ? <Text style={styles.meta}>{doctor.bio}</Text> : null}
          <Text style={styles.meta}>Speaks {doctor.languages.join(', ')}</Text>
        </Card>

        <Text style={styles.heading}>How do you want to talk?</Text>
        <View style={styles.rowWrap}>
          {MODES.map((m) => (
            <View key={m} style={styles.third}>
              <Chip label={modeLabels[m].label} note={modeLabels[m].note} selected={m === mode} onPress={() => setMode(m)} />
            </View>
          ))}
        </View>

        <Text style={styles.heading}>Day</Text>
        <View style={styles.rowWrap}>
          {days.map((d, i) => (
            <View key={d.toISOString()} style={styles.fifth}>
              <Chip
                label={String(d.getDate())}
                note={d.toLocaleDateString('en-NG', { weekday: 'short' })}
                selected={i === dayIndex}
                onPress={() => {
                  setDayIndex(i);
                  setSlot(null);
                }}
              />
            </View>
          ))}
        </View>

        <Text style={styles.heading}>Open times</Text>
        {slots.length === 0 ? (
          <Text style={styles.meta}>No times on this day. Try another day.</Text>
        ) : (
          <View style={styles.rowWrap}>
            {slots.map((t) => (
              <View key={t} style={styles.quarter}>
                <Chip label={slotLabel(t)} selected={t === slot} onPress={() => setSlot(t)} />
              </View>
            ))}
          </View>
        )}

        {bookError ? <Text style={styles.error}>{bookError}</Text> : null}
      </ScrollView>

      <View style={styles.footer}>
        <View>
          <Text style={styles.small}>{modeLabels[mode].label} visit</Text>
          <Text style={styles.fee}>{naira(fee)}</Text>
        </View>
        <Button label="Continue to pay" onPress={book} disabled={slot == null} busy={busy} style={{ flex: 1 }} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  content: { padding: 20, gap: 12 },
  doctor: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  name: { fontSize: 19, fontWeight: '600', color: colors.ink },
  meta: { fontSize: 13, color: colors.muted, lineHeight: 19 },
  verified: { fontSize: 12, fontWeight: '600', color: colors.brand, marginTop: 2 },
  heading: { fontSize: 14, fontWeight: '600', color: colors.ink, marginTop: 4 },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4, rowGap: 8 },
  third: { width: '33.333%', paddingHorizontal: 4 },
  quarter: { width: '25%', paddingHorizontal: 4 },
  fifth: { width: '20%', paddingHorizontal: 4 },
  error: { fontSize: 14, color: colors.danger, lineHeight: 20 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  small: { fontSize: 12, color: colors.muted },
  fee: { fontSize: 20, fontWeight: '700', color: colors.ink },
});
