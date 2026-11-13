import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, Button, Card, Chip, Loading, Message } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { colors, formatWhen, modeLabels, naira, type VisitMode } from '@/lib/theme';

type Appointment = {
  id: string;
  starts_at: string;
  mode: VisitMode;
  fee_kobo: number;
  status: string;
  doctors: { display_name: string } | null;
};

const METHODS = [
  { id: 'wallet', label: 'Family wallet', note: 'Pay from your balance' },
  { id: 'transfer', label: 'Bank transfer', note: 'We give you an account number' },
  { id: 'ussd', label: 'USSD code', note: 'Dial from any phone. No data needed' },
  { id: 'card', label: 'Debit card', note: 'Verve, Mastercard or Visa' },
  { id: 'agent', label: 'Cash at an agent', note: 'Pay a POS agent or chemist near you' },
  { id: 'sponsor', label: 'Ask family to pay', note: 'Send a pay link to someone' },
] as const;

export default function Pay() {
  const { appointmentId } = useLocalSearchParams<{ appointmentId: string }>();
  const router = useRouter();
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [method, setMethod] = useState<(typeof METHODS)[number]['id']>('wallet');

  useEffect(() => {
    if (!appointmentId) return;
    supabase
      .from('appointments')
      .select('id, starts_at, mode, fee_kobo, status, doctors(display_name)')
      .eq('id', appointmentId)
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (err || !data) setError('Could not find this visit.');
        else setAppointment(data as unknown as Appointment);
      });
  }, [appointmentId]);

  if (error) return <Message text={error} />;
  if (!appointment) return <Loading />;

  const doctorName = appointment.doctors?.display_name ?? 'Your doctor';

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.summary}>
          <Avatar name={doctorName} size={48} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{doctorName}</Text>
            <Text style={styles.meta}>
              {modeLabels[appointment.mode].label} visit · {formatWhen(appointment.starts_at)}
            </Text>
          </View>
          <Text style={styles.fee}>{naira(appointment.fee_kobo)}</Text>
        </Card>

        <Text style={styles.heading}>Choose how to pay</Text>
        <View style={{ gap: 8 }}>
          {METHODS.map((m) => (
            <Chip key={m.id} label={m.label} note={m.note} selected={m.id === method} onPress={() => setMethod(m.id)} />
          ))}
        </View>

        <View style={styles.safe}>
          <Text style={styles.safeText}>
            Your money is held safely until the visit happens. If the doctor does not show, you get all of it back.
          </Text>
        </View>

        {/* TODO: connect the payment provider. Payment is confirmed on the server by the provider's webhook, never by the app. */}
        <Text style={styles.pending}>
          Payments are not switched on yet. Your time is held and shows under My visits as waiting for payment.
        </Text>
      </ScrollView>

      <View style={styles.footer}>
        <Button label="Go to my visits" variant="outline" onPress={() => router.replace('/visits')} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  content: { padding: 20, gap: 14 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { fontSize: 15, fontWeight: '600', color: colors.ink },
  meta: { fontSize: 13, color: colors.muted },
  fee: { fontSize: 18, fontWeight: '700', color: colors.ink },
  heading: { fontSize: 14, fontWeight: '600', color: colors.ink },
  safe: { backgroundColor: colors.brandTint, borderRadius: 14, padding: 12 },
  safeText: { fontSize: 13, lineHeight: 18, color: colors.brandDark },
  pending: { fontSize: 13, lineHeight: 19, color: colors.amberText, backgroundColor: colors.amberTint, borderRadius: 14, padding: 12 },
  footer: { paddingHorizontal: 20, paddingVertical: 12, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.line },
});
