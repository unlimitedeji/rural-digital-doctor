import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, Button, Card } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useProfile } from '@/lib/profile';
import { supabase } from '@/lib/supabase';
import { colors, formatWhen, modeLabels, naira, radius, type VisitMode } from '@/lib/theme';

type NextVisit = {
  id: string;
  starts_at: string;
  mode: VisitMode;
  status: string;
  doctors: { display_name: string; specialty: string } | null;
};

type DoctorRow = { id: string; display_name: string; specialty: string; fee_video_kobo: number };

export default function Home() {
  const { session } = useAuth();
  const { profile } = useProfile();
  const router = useRouter();
  const [name, setName] = useState('');
  const [next, setNext] = useState<NextVisit | null>(null);
  const [online, setOnline] = useState<DoctorRow[]>([]);

  useFocusEffect(
    useCallback(() => {
      const userId = session?.user.id;
      if (!userId) return;
      let active = true;
      (async () => {
        const [profile, visit, doctors] = await Promise.all([
          supabase.from('profiles').select('full_name').eq('id', userId).maybeSingle(),
          supabase
            .from('appointments')
            .select('id, starts_at, mode, status, doctors(display_name, specialty)')
            .eq('patient_id', userId)
            .in('status', ['confirmed', 'in_progress'])
            .gte('starts_at', new Date().toISOString())
            .order('starts_at')
            .limit(1)
            .maybeSingle(),
          supabase
            .from('doctors')
            .select('id, display_name, specialty, fee_video_kobo')
            .eq('verified', true)
            .eq('accepting_now', true)
            .limit(3),
        ]);
        if (!active) return;
        setName(profile.data?.full_name ?? '');
        setNext((visit.data as unknown as NextVisit | null) ?? null);
        setOnline((doctors.data as DoctorRow[] | null) ?? []);
      })();
      return () => {
        active = false;
      };
    }, [session?.user.id]),
  );

  // Doctors have their own screens; send them to their queue.
  if (profile?.role === 'doctor') return <Redirect href="/queue" />;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.brand}>Rural Digital Doctor</Text>
            <Text style={styles.title}>{name || 'Welcome'}</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => supabase.auth.signOut()} style={styles.signOut}>
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        </View>

        {next ? (
          <View style={styles.nextCard}>
            <Text style={styles.nextLabel}>NEXT VISIT · {formatWhen(next.starts_at)}</Text>
            <Text style={styles.nextDoctor}>{next.doctors?.display_name ?? 'Your doctor'}</Text>
            <Text style={styles.nextMeta}>
              {next.doctors?.specialty ?? ''} · {modeLabels[next.mode].label} visit
            </Text>
          </View>
        ) : (
          <Card>
            <Text style={styles.cardTitle}>No visit booked</Text>
            <Text style={styles.cardText}>Find a doctor and choose a time that suits you.</Text>
          </Card>
        )}

        <Button label="Book a visit" onPress={() => router.push('/doctors')} />

        <Text style={styles.section}>Online now</Text>
        {online.length === 0 ? (
          <Card>
            <Text style={styles.cardText}>No doctor is online right now. You can still book a time.</Text>
          </Card>
        ) : (
          online.map((d) => (
            <Pressable
              key={d.id}
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/doctors/[id]', params: { id: d.id } })}
              style={styles.doctorRow}
            >
              <Avatar name={d.display_name} />
              <View style={{ flex: 1 }}>
                <Text style={styles.doctorName}>{d.display_name}</Text>
                <Text style={styles.cardText}>{d.specialty}</Text>
              </View>
              <Text style={styles.fee}>{naira(d.fee_video_kobo)}</Text>
            </Pressable>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  content: { padding: 20, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  brand: { fontSize: 13, fontWeight: '600', color: colors.brand },
  title: { fontSize: 26, fontWeight: '700', color: colors.ink },
  signOut: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  signOutText: { fontSize: 14, fontWeight: '600', color: colors.muted },
  nextCard: { backgroundColor: colors.brand, borderRadius: radius.lg, padding: 16, gap: 4 },
  nextLabel: { fontSize: 12, fontWeight: '600', color: '#CFE9E3' },
  nextDoctor: { fontSize: 18, fontWeight: '600', color: '#FFFFFF' },
  nextMeta: { fontSize: 13, color: '#CFE9E3' },
  cardTitle: { fontSize: 15, fontWeight: '600', color: colors.ink, marginBottom: 2 },
  cardText: { fontSize: 13, color: colors.muted, lineHeight: 19 },
  section: { fontSize: 17, fontWeight: '600', color: colors.ink },
  doctorRow: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  doctorName: { fontSize: 15, fontWeight: '600', color: colors.ink },
  fee: { fontSize: 14, fontWeight: '700', color: colors.ink },
});
