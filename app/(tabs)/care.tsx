import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState, type ComponentProps, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Loading } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { providerLabel } from '@/lib/catalog';
import { supabase } from '@/lib/supabase';
import { colors, radius } from '@/lib/theme';
import { formatVital, latestByKind, vitalInfo, type Vital } from '@/lib/vitals';

type IconName = ComponentProps<typeof Ionicons>['name'];
type Record = { allergies: string | null; conditions: string | null; past_surgeries: string | null };
type TeamMember = { id: string; display_name: string; specialty: string; provider_type: string; last: string };
type Referral = { id: string; refer_to: string; urgency: string };

export default function Care() {
  const { session } = useAuth();
  const router = useRouter();
  const userId = session?.user.id;
  const [record, setRecord] = useState<Record | null>(null);
  const [vitals, setVitals] = useState<Vital[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [counts, setCounts] = useState({ visits: 0, results: 0 });

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      let active = true;
      (async () => {
        const [p, v, a, ref, rec] = await Promise.all([
          supabase.from('profiles').select('allergies, conditions, past_surgeries').eq('id', userId).maybeSingle(),
          supabase.from('vitals').select('id, kind, value_1, value_2, measured_at').eq('patient_id', userId).order('measured_at', { ascending: false }).limit(50),
          supabase
            .from('appointments')
            .select('starts_at, status, doctors(id, display_name, specialty, provider_type)')
            .eq('patient_id', userId)
            .in('status', ['confirmed', 'in_progress', 'completed'])
            .order('starts_at', { ascending: false }),
          supabase.from('referrals').select('id, refer_to, urgency').eq('patient_id', userId).order('created_at', { ascending: false }).limit(3),
          supabase.from('records').select('id', { count: 'exact', head: true }).eq('patient_id', userId),
        ]);
        if (!active) return;
        setRecord((p.data as Record | null) ?? { allergies: null, conditions: null, past_surgeries: null });
        setVitals((v.data as Vital[] | null) ?? []);
        type Row = { starts_at: string; doctors: Omit<TeamMember, 'last'> | null };
        const rows = (a.data as unknown as Row[] | null) ?? [];
        const members = new Map<string, TeamMember>();
        for (const row of rows) {
          if (row.doctors && !members.has(row.doctors.id)) members.set(row.doctors.id, { ...row.doctors, last: row.starts_at });
        }
        setTeam([...members.values()].slice(0, 4));
        setReferrals((ref.data as Referral[] | null) ?? []);
        setCounts({ visits: rows.length, results: rec.count ?? 0 });
      })();
      return () => {
        active = false;
      };
    }, [userId]),
  );

  if (!record) return <Loading />;
  const latest = latestByKind(vitals);
  const notRecorded = 'Not recorded';

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Your care</Text>

        <Group>
          <Header icon="folder-open" title="Health record" note="Allergies, conditions and operations" onPress={() => router.push('/health-record')} />
          <Item icon="alert-circle" label="Allergies" value={record.allergies || notRecorded} />
          <Item icon="fitness" label="Conditions" value={record.conditions || notRecorded} />
          <Item icon="bandage" label="Past operations" value={record.past_surgeries || notRecorded} last />
        </Group>

        <Group>
          <Header icon="pulse" title="Vitals" note="Readings your doctors can see" onPress={() => router.push('/vitals')} />
          {latest.length === 0 ? (
            <Text style={styles.groupNote}>No readings yet. Tap Vitals to add your blood pressure, sugar or weight.</Text>
          ) : (
            latest.map((v, i) => (
              <Item
                key={v.id}
                icon={vitalInfo(v.kind).icon as IconName}
                label={vitalInfo(v.kind).label}
                value={`${formatVital(v)} · ${new Date(v.measured_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}`}
                last={i === latest.length - 1}
              />
            ))
          )}
        </Group>

        <Group>
          <Header icon="document-text" title="Test results and scans" note={`${counts.results} saved`} onPress={() => router.push('/records')} />
          <Header icon="calendar" title="Visit history" note={`${counts.visits} visits`} onPress={() => router.push('/visits')} flat />
        </Group>

        <Group>
          <Header icon="people" title="Care team" note="Health workers you have seen" />
          {team.length === 0 ? (
            <Text style={styles.groupNote}>Your doctors will appear here after your first visit.</Text>
          ) : (
            team.map((m, i) => (
              <Item
                key={m.id}
                icon="medkit"
                label={i === 0 ? 'Most recent' : providerLabel(m.provider_type)}
                value={`${m.display_name} · ${m.specialty}`}
                last={i === team.length - 1 && referrals.length === 0}
              />
            ))
          )}
          {referrals.map((r, i) => (
            <Item key={r.id} icon="business" label="Referred to" value={r.refer_to} last={i === referrals.length - 1} />
          ))}
        </Group>
      </ScrollView>
    </SafeAreaView>
  );
}

function Group({ children }: { children: ReactNode }) {
  return <View style={styles.group}>{children}</View>;
}

function Header({ icon, title, note, onPress, flat }: { icon: IconName; title: string; note: string; onPress?: () => void; flat?: boolean }) {
  const body = (
    <>
      <View style={styles.headerIcon}>
        <Ionicons name={icon} size={26} color={colors.brand} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.headerTitle}>{title}</Text>
        <Text style={styles.headerNote}>{note}</Text>
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={20} color={colors.muted} /> : null}
    </>
  );
  const style = [styles.header, flat && { marginTop: 10 }];
  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress} style={style}>
      {body}
    </Pressable>
  ) : (
    <View style={style}>{body}</View>
  );
}

function Item({ icon, label, value, last }: { icon: IconName; label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.item, !last && styles.itemLine]}>
      <View style={styles.itemIcon}>
        <Ionicons name={icon} size={20} color={colors.brand} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.itemLabel}>{label}</Text>
        <Text style={styles.itemValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  content: { padding: 20, gap: 16, paddingBottom: 32 },
  title: { fontSize: 28, fontWeight: '700', color: colors.ink },
  group: { backgroundColor: '#E6ECEB', borderRadius: 24, padding: 12 },
  groupNote: { fontSize: 14, color: colors.muted, lineHeight: 20, padding: 12 },
  header: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 14 },
  headerIcon: { width: 52, height: 52, borderRadius: 14, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.ink },
  headerNote: { fontSize: 13, color: colors.muted },
  item: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 8, paddingVertical: 12 },
  itemLine: { borderBottomWidth: 1, borderBottomColor: '#D7E0DE' },
  itemIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  itemLabel: { fontSize: 12, color: colors.muted },
  itemValue: { fontSize: 15, fontWeight: '600', color: colors.ink },
});
