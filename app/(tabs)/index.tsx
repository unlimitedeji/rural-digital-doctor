import { Ionicons } from '@expo/vector-icons';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState, type ComponentProps } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FingerprintRow } from '@/components/FingerprintRow';
import { Avatar } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useProfile } from '@/lib/profile';
import { supabase } from '@/lib/supabase';
import { colors, formatWhen, initials, modeLabels, naira, radius, type VisitMode } from '@/lib/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

type NextVisit = {
  id: string;
  starts_at: string;
  mode: VisitMode;
  doctors: { display_name: string; specialty: string } | null;
};
type DoctorRow = { id: string; display_name: string; specialty: string; fee_video_kobo: number };
type Medicine = { id: string; medicine: string; instructions: string; days: number | null; doctor: string };

// Nigeria's free national emergency number.
const EMERGENCY_NUMBER = '112';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function Home() {
  const { session } = useAuth();
  const { profile } = useProfile();
  const router = useRouter();
  const [next, setNext] = useState<NextVisit | null>(null);
  const [online, setOnline] = useState<DoctorRow[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [medicines, setMedicines] = useState<Medicine[]>([]);

  useFocusEffect(
    useCallback(() => {
      const userId = session?.user.id;
      if (!userId) return;
      let active = true;
      const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      (async () => {
        const [visit, doctors, wallet, rx] = await Promise.all([
          supabase
            .from('appointments')
            .select('id, starts_at, mode, doctors(display_name, specialty)')
            .eq('patient_id', userId)
            .in('status', ['confirmed', 'in_progress'])
            .gte('starts_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
            .order('starts_at')
            .limit(1)
            .maybeSingle(),
          supabase
            .from('doctors')
            .select('id, display_name, specialty, fee_video_kobo')
            .eq('verified', true)
            .eq('accepting_now', true)
            .limit(3),
          supabase.from('wallets').select('balance_kobo').eq('user_id', userId).maybeSingle(),
          supabase
            .from('prescriptions')
            .select('created_at, doctors(display_name), prescription_items(id, medicine, instructions, days)')
            .eq('patient_id', userId)
            .gte('created_at', monthAgo)
            .order('created_at', { ascending: false }),
        ]);
        if (!active) return;
        setNext((visit.data as unknown as NextVisit | null) ?? null);
        setOnline((doctors.data as DoctorRow[] | null) ?? []);
        setBalance(wallet.data?.balance_kobo ?? 0);
        type RxRow = {
          created_at: string;
          doctors: { display_name: string } | null;
          prescription_items: { id: string; medicine: string; instructions: string; days: number | null }[];
        };
        // Show a medicine while its course is still running (or for a week when no length was given).
        const now = Date.now();
        const current: Medicine[] = [];
        for (const p of (rx.data as unknown as RxRow[] | null) ?? []) {
          for (const item of p.prescription_items) {
            const days = item.days ?? 7;
            if (new Date(p.created_at).getTime() + days * 24 * 60 * 60 * 1000 >= now) {
              current.push({ ...item, doctor: p.doctors?.display_name ?? 'Your doctor' });
            }
          }
        }
        setMedicines(current);
      })();
      return () => {
        active = false;
      };
    }, [session?.user.id]),
  );

  // Health workers and partners have their own screens.
  if (profile?.role === 'doctor') return <Redirect href="/queue" />;
  if (profile?.role === 'partner') return <Redirect href="/orders" />;

  const firstName = (profile?.full_name ?? '').trim().split(/\s+/)[0] ?? '';

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Greeting */}
        <View style={styles.header}>
          <View style={styles.headerAvatar}>
            <Text style={styles.headerAvatarText}>{initials(profile?.full_name || 'You')}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>
              {greeting()}
              {firstName ? `, ${firstName}` : ''}
            </Text>
            <Text style={styles.question}>How do you feel today?</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Sign out" onPress={() => supabase.auth.signOut()} style={styles.iconButton}>
            <Ionicons name="log-out-outline" size={22} color={colors.muted} />
          </Pressable>
        </View>

        {/* Main call to action */}
        <View style={styles.hero}>
          <View style={styles.heroPattern} />
          <Text style={styles.heroTitle}>Need care today?</Text>
          <Text style={styles.heroText}>
            {online.length > 0
              ? `${online.length} ${online.length === 1 ? 'doctor is' : 'doctors are'} online now`
              : 'Book a licensed doctor for a time that suits you'}
          </Text>
          <Pressable accessibilityRole="button" onPress={() => router.push('/doctors')} style={styles.heroButton}>
            <Text style={styles.heroButtonText}>See a doctor</Text>
            <Ionicons name="arrow-forward" size={18} color={colors.ink} />
          </Pressable>
        </View>

        {/* Wallet */}
        <View style={styles.walletCard}>
          <View style={[styles.tileIcon, { backgroundColor: colors.brandTint }]}>
            <Ionicons name="wallet" size={26} color={colors.brand} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.muted}>Wallet</Text>
            <Text style={styles.walletAmount}>{balance == null ? '…' : naira(balance)}</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => router.push('/wallet')} style={styles.topUp}>
            <Text style={styles.topUpText}>Top up</Text>
          </Pressable>
        </View>

        {/* Quick actions */}
        <View style={styles.grid}>
          <Tile icon="calendar" label="Book a visit" onPress={() => router.push('/doctors')} />
          <Tile icon="call" label="Emergency call" danger onPress={() => Linking.openURL(`tel:${EMERGENCY_NUMBER}`)} />
          <Tile icon="cloud-upload" label="Upload test results" onPress={() => router.push('/records')} />
          <Tile icon="document-text" label="My visits" onPress={() => router.push('/visits')} />
        </View>

        {/* Upcoming visit */}
        <View style={styles.sectionRow}>
          <Text style={styles.section}>Upcoming visit</Text>
          <Pressable accessibilityRole="button" onPress={() => router.push('/visits')} style={styles.seeAll}>
            <Text style={styles.seeAllText}>See all</Text>
          </Pressable>
        </View>
        {next ? (
          <View style={styles.nextCard}>
            <Text style={styles.nextLabel}>{formatWhen(next.starts_at)}</Text>
            <View style={styles.row}>
              <View style={styles.nextAvatar}>
                <Text style={styles.nextAvatarText}>{initials(next.doctors?.display_name ?? 'Doctor')}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.nextDoctor}>{next.doctors?.display_name ?? 'Your doctor'}</Text>
                <Text style={styles.nextMeta}>
                  {next.doctors?.specialty ?? ''} · {modeLabels[next.mode].label} visit
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <EmptyCard icon="calendar-outline" text="You have no visits booked" />
        )}

        {/* Medicines */}
        <Text style={styles.section}>My medicines</Text>
        {medicines.length > 0 ? (
          medicines.map((m) => (
            <View key={m.id} style={styles.medCard}>
              <View style={[styles.tileIcon, { backgroundColor: colors.amberTint }]}>
                <Ionicons name="medkit" size={22} color={colors.amberText} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.medName}>{m.medicine}</Text>
                <Text style={styles.muted}>
                  {m.instructions}
                  {m.days ? ` · ${m.days} days` : ''}
                </Text>
                <Text style={styles.small}>From {m.doctor}</Text>
              </View>
            </View>
          ))
        ) : (
          <EmptyCard icon="medkit-outline" text="Medicines from your doctor will show here" />
        )}

        {/* Online now */}
        {online.length > 0 ? (
          <>
            <Text style={styles.section}>Online now</Text>
            {online.map((d) => (
              <Pressable
                key={d.id}
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/doctors/[id]', params: { id: d.id } })}
                style={styles.doctorRow}
              >
                <Avatar name={d.display_name} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.medName}>{d.display_name}</Text>
                  <Text style={styles.muted}>{d.specialty}</Text>
                </View>
                <Text style={styles.fee}>{naira(d.fee_video_kobo)}</Text>
              </Pressable>
            ))}
          </>
        ) : null}

        {profile?.role === 'patient' ? (
          <Pressable accessibilityRole="button" onPress={() => router.push('/join')} style={styles.doctorRow}>
            <View style={[styles.tileIcon, { backgroundColor: colors.brandTint }]}>
              <Ionicons name="medical" size={22} color={colors.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.medName}>Health worker, pharmacy or lab?</Text>
              <Text style={styles.muted}>Apply to join Rural Digital Doctor</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </Pressable>
        ) : null}

        <Text style={styles.section}>Security</Text>
        <FingerprintRow />
      </ScrollView>
    </SafeAreaView>
  );
}

function Tile({ icon, label, onPress, danger }: { icon: IconName; label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.tile, danger && styles.tileDanger]}>
      <View style={[styles.tileIcon, { backgroundColor: danger ? '#FFFFFF' : colors.brandTint }]}>
        <Ionicons name={icon} size={24} color={danger ? colors.danger : colors.brand} />
      </View>
      <Text style={[styles.tileLabel, danger && { color: colors.danger }]}>{label}</Text>
    </Pressable>
  );
}

function EmptyCard({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={34} color="#9AABAD" />
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  content: { padding: 20, gap: 16, paddingBottom: 32 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerAvatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' },
  headerAvatarText: { fontSize: 18, fontWeight: '700', color: colors.brand },
  greeting: { fontSize: 15, color: colors.muted },
  question: { fontSize: 20, fontWeight: '700', color: colors.ink },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  hero: { backgroundColor: colors.brand, borderRadius: 24, padding: 20, gap: 8, overflow: 'hidden' },
  heroPattern: {
    position: 'absolute',
    right: -40,
    top: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 28,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  heroTitle: { fontSize: 24, fontWeight: '700', color: '#FFFFFF' },
  heroText: { fontSize: 14, color: '#CFE9E3', lineHeight: 20 },
  heroButton: {
    alignSelf: 'flex-start',
    marginTop: 8,
    minHeight: 48,
    paddingHorizontal: 20,
    borderRadius: 24,
    backgroundColor: colors.amber,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroButtonText: { fontSize: 16, fontWeight: '700', color: colors.ink },
  walletCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
  walletAmount: { fontSize: 24, fontWeight: '700', color: colors.ink },
  topUp: { minHeight: 44, paddingHorizontal: 18, borderRadius: 14, backgroundColor: colors.brand, justifyContent: 'center' },
  topUpText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 84,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tileDanger: { backgroundColor: '#FBECEB', borderWidth: 1.5, borderColor: '#F2C4C0' },
  tileIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  tileLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.ink, lineHeight: 20 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  section: { fontSize: 20, fontWeight: '700', color: colors.ink },
  seeAll: { minHeight: 44, justifyContent: 'center' },
  seeAllText: { fontSize: 15, fontWeight: '600', color: colors.brand },
  nextCard: { backgroundColor: colors.brand, borderRadius: radius.lg, padding: 16, gap: 10 },
  nextLabel: { fontSize: 13, fontWeight: '700', color: colors.amber },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nextAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  nextAvatarText: { fontSize: 15, fontWeight: '700', color: colors.brand },
  nextDoctor: { fontSize: 17, fontWeight: '600', color: '#FFFFFF' },
  nextMeta: { fontSize: 13, color: '#CFE9E3' },
  empty: { backgroundColor: '#E6ECEB', borderRadius: radius.lg, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 14 },
  emptyText: { flex: 1, fontSize: 15, color: colors.muted, lineHeight: 21 },
  medCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  medName: { fontSize: 15, fontWeight: '600', color: colors.ink },
  muted: { fontSize: 13, color: colors.muted, lineHeight: 19 },
  small: { fontSize: 12, color: colors.muted },
  doctorRow: { backgroundColor: colors.card, borderRadius: radius.md, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  fee: { fontSize: 14, fontWeight: '700', color: colors.ink },
});
