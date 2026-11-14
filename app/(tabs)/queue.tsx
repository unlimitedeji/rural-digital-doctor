import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FingerprintRow } from '@/components/FingerprintRow';
import { Avatar, Loading } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { colors, formatWhen, modeLabels, radius, type VisitMode } from '@/lib/theme';

type QueueItem = {
  id: string;
  starts_at: string;
  mode: VisitMode;
  status: 'confirmed' | 'in_progress';
  reason: string | null;
  patient: { full_name: string } | null;
};

export default function Queue() {
  const { session } = useAuth();
  const router = useRouter();
  const userId = session?.user.id;
  const [items, setItems] = useState<QueueItem[] | null>(null);
  const [name, setName] = useState('');
  const [accepting, setAccepting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      let active = true;
      (async () => {
        const [doctor, visits] = await Promise.all([
          supabase.from('doctors').select('display_name, accepting_now').eq('id', userId).maybeSingle(),
          supabase
            .from('appointments')
            .select('id, starts_at, mode, status, reason, patient:profiles!appointments_patient_id_fkey(full_name)')
            .eq('doctor_id', userId)
            .in('status', ['confirmed', 'in_progress'])
            .order('starts_at'),
        ]);
        if (!active) return;
        setName(doctor.data?.display_name ?? '');
        setAccepting(doctor.data?.accepting_now ?? false);
        setItems((visits.data as unknown as QueueItem[] | null) ?? []);
      })();
      return () => {
        active = false;
      };
    }, [userId]),
  );

  async function toggleAccepting(value: boolean) {
    if (!userId) return;
    setAccepting(value);
    const { error } = await supabase.from('doctors').update({ accepting_now: value }).eq('id', userId);
    if (error) setAccepting(!value);
  }

  if (!items) return <Loading />;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={{ gap: 12 }}>
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <Text style={styles.brand}>Rural Digital Doctor · for doctors</Text>
                <Text style={styles.title}>{name || 'Doctor'}</Text>
              </View>
              <Pressable accessibilityRole="button" onPress={() => supabase.auth.signOut()} style={styles.signOut}>
                <Text style={styles.signOutText}>Sign out</Text>
              </Pressable>
            </View>
            <View style={[styles.onlineCard, accepting && styles.onlineCardOn]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.onlineLabel, accepting && { color: '#FFFFFF' }]}>
                  {accepting ? 'Taking patients now' : 'Not taking patients'}
                </Text>
                <Text style={[styles.onlineNote, accepting && { color: '#CFE9E3' }]}>
                  {accepting ? 'You show as online to patients' : 'Booked visits still go ahead'}
                </Text>
              </View>
              <Switch
                value={accepting}
                onValueChange={toggleAccepting}
                accessibilityLabel="Taking patients now"
                trackColor={{ true: colors.amber, false: '#8A9A9C' }}
                thumbColor="#FFFFFF"
              />
            </View>
            <Text style={styles.section}>Booked visits</Text>
          </View>
        }
        ListEmptyComponent={<Text style={styles.empty}>No paid visits waiting.</Text>}
        ListFooterComponent={<FingerprintRow />}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/doctor/visit/[id]', params: { id: item.id } })}
            style={styles.card}
          >
            <Avatar name={item.patient?.full_name || 'Patient'} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.patient?.full_name || 'Patient'}</Text>
              <Text style={styles.meta}>
                {formatWhen(item.starts_at)} · {modeLabels[item.mode].label}
              </Text>
              {item.reason ? <Text style={styles.meta}>{item.reason}</Text> : null}
            </View>
            <Text style={styles.status}>{item.status === 'in_progress' ? 'In progress' : 'Open'}</Text>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  list: { padding: 20, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  brand: { fontSize: 13, fontWeight: '600', color: colors.brand },
  title: { fontSize: 26, fontWeight: '700', color: colors.ink },
  signOut: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  signOutText: { fontSize: 14, fontWeight: '600', color: colors.muted },
  onlineCard: {
    backgroundColor: '#E3EAE8',
    borderRadius: radius.md,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  onlineCardOn: { backgroundColor: colors.brand },
  onlineLabel: { fontSize: 15, fontWeight: '600', color: colors.ink },
  onlineNote: { fontSize: 12, color: colors.muted },
  section: { fontSize: 17, fontWeight: '600', color: colors.ink },
  empty: { fontSize: 15, color: colors.muted, textAlign: 'center', marginTop: 24 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  name: { fontSize: 15, fontWeight: '600', color: colors.ink },
  meta: { fontSize: 13, color: colors.muted },
  status: { fontSize: 13, fontWeight: '700', color: colors.brand },
});
