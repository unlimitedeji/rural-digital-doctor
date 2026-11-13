import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, Button, Loading, Message } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { colors, formatWhen, modeLabels, naira, radius, type VisitMode } from '@/lib/theme';

type Visit = {
  id: string;
  starts_at: string;
  mode: VisitMode;
  status: 'pending_payment' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
  fee_kobo: number;
  doctors: { display_name: string; specialty: string } | null;
};

const statusLabels: Record<Visit['status'], string> = {
  pending_payment: 'Waiting for payment',
  confirmed: 'Confirmed',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'Missed',
};

export default function Visits() {
  const { session } = useAuth();
  const router = useRouter();
  const [visits, setVisits] = useState<Visit[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      const userId = session?.user.id;
      if (!userId) return;
      let active = true;
      supabase
        .from('appointments')
        .select('id, starts_at, mode, status, fee_kobo, doctors(display_name, specialty)')
        .eq('patient_id', userId)
        .order('starts_at', { ascending: false })
        .then(({ data, error: err }) => {
          if (!active) return;
          if (err) setError('Could not load your visits. Check your network and try again.');
          else setVisits((data as unknown as Visit[]) ?? []);
        });
      return () => {
        active = false;
      };
    }, [session?.user.id]),
  );

  if (error) return <Message text={error} />;
  if (!visits) return <Loading />;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Text style={styles.title}>My visits</Text>
      <FlatList
        data={visits}
        keyExtractor={(v) => v.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>You have no visits yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.when}>{formatWhen(item.starts_at)}</Text>
              <Text style={styles.status}>{statusLabels[item.status]}</Text>
            </View>
            <View style={styles.doctor}>
              <Avatar name={item.doctors?.display_name ?? 'Doctor'} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.doctors?.display_name ?? 'Doctor'}</Text>
                <Text style={styles.meta}>
                  {item.doctors?.specialty ?? ''} · {modeLabels[item.mode].label} · {naira(item.fee_kobo)}
                </Text>
              </View>
            </View>
            {item.status === 'pending_payment' ? (
              <Button
                label="Pay now"
                onPress={() => router.push({ pathname: '/pay/[appointmentId]', params: { appointmentId: item.id } })}
              />
            ) : null}
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  title: { fontSize: 26, fontWeight: '700', color: colors.ink, paddingHorizontal: 20, paddingTop: 20 },
  list: { padding: 20, gap: 12 },
  empty: { fontSize: 15, color: colors.muted, textAlign: 'center', marginTop: 40 },
  card: { backgroundColor: colors.card, borderRadius: radius.md, padding: 14, gap: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  when: { fontSize: 13, fontWeight: '700', color: colors.ink },
  status: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.brandDark,
    backgroundColor: colors.brandTint,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  doctor: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { fontSize: 15, fontWeight: '600', color: colors.ink },
  meta: { fontSize: 13, color: colors.muted },
});
