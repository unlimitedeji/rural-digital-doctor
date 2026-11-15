import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FingerprintRow } from '@/components/FingerprintRow';
import { Button, Loading } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { colors, radius } from '@/lib/theme';

type Partner = { id: string; kind: 'pharmacy' | 'lab'; name: string };
type Patient = { full_name: string; phone: string | null } | null;
type Rx = {
  id: string;
  created_at: string;
  fulfilment_status: 'sent' | 'ready' | 'dispensed' | 'not_sent';
  patient: Patient;
  prescription_items: { id: string; medicine: string; instructions: string; days: number | null }[];
};
type Lab = {
  id: string;
  created_at: string;
  test_name: string;
  notes: string | null;
  status: 'sent' | 'sample_taken' | 'result_ready' | 'ordered' | 'cancelled';
  patient: Patient;
};
type Order = { kind: 'prescription'; row: Rx } | { kind: 'lab'; row: Lab };

const NEXT: Record<string, { status: string; label: string }[]> = {
  sent_prescription: [
    { status: 'ready', label: 'Ready for pickup' },
    { status: 'dispensed', label: 'Collected' },
  ],
  ready_prescription: [{ status: 'dispensed', label: 'Collected' }],
  sent_lab: [
    { status: 'sample_taken', label: 'Sample taken' },
    { status: 'result_ready', label: 'Result ready' },
  ],
  sample_taken_lab: [{ status: 'result_ready', label: 'Result ready' }],
};

const STATUS_LABEL: Record<string, string> = {
  sent: 'New',
  ready: 'Ready for pickup',
  dispensed: 'Collected',
  sample_taken: 'Sample taken',
  result_ready: 'Result ready',
};

export default function Orders() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [partner, setPartner] = useState<Partner | null | undefined>(undefined);
  const [orders, setOrders] = useState<Order[]>([]);
  const [showDone, setShowDone] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloads, setReloads] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      let active = true;
      (async () => {
        const m = await supabase.from('partner_members').select('partners(id, kind, name)').eq('user_id', userId).limit(1).maybeSingle();
        const p = (m.data as unknown as { partners: Partner | null } | null)?.partners ?? null;
        if (!active) return;
        setPartner(p);
        if (!p) return;
        const patient = 'patient:profiles!prescriptions_patient_id_fkey(full_name, phone)';
        const [rx, lab] = await Promise.all([
          p.kind === 'pharmacy'
            ? supabase
                .from('prescriptions')
                .select(`id, created_at, fulfilment_status, ${patient}, prescription_items(id, medicine, instructions, days)`)
                .eq('partner_id', p.id)
                .order('created_at', { ascending: false })
            : Promise.resolve({ data: [] }),
          p.kind === 'lab'
            ? supabase
                .from('lab_orders')
                .select('id, created_at, test_name, notes, status, patient:profiles!lab_orders_patient_id_fkey(full_name, phone)')
                .eq('partner_id', p.id)
                .order('created_at', { ascending: false })
            : Promise.resolve({ data: [] }),
        ]);
        if (!active) return;
        setOrders([
          ...((rx.data as unknown as Rx[] | null) ?? []).map((row) => ({ kind: 'prescription' as const, row })),
          ...((lab.data as unknown as Lab[] | null) ?? []).map((row) => ({ kind: 'lab' as const, row })),
        ]);
      })();
      return () => {
        active = false;
      };
    }, [userId, reloads]),
  );

  async function move(kind: 'prescription' | 'lab', id: string, status: string) {
    setBusyId(id);
    setError(null);
    const { error: err } = await supabase.rpc('partner_update_order', { p_kind: kind, p_id: id, p_status: status });
    setBusyId(null);
    if (err) setError('Could not update. Check your network and try again.');
    else setReloads((n) => n + 1);
  }

  if (partner === undefined) return <Loading />;

  const status = (o: Order) => (o.kind === 'prescription' ? o.row.fulfilment_status : o.row.status);
  const done = (o: Order) => ['dispensed', 'result_ready'].includes(status(o));
  const shown = orders.filter((o) => showDone || !done(o));

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <FlatList
        data={shown}
        keyExtractor={(o) => o.row.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={{ gap: 12 }}>
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <Text style={styles.brand}>Rural Digital Doctor · partner</Text>
                <Text style={styles.title}>{partner?.name ?? 'Orders'}</Text>
              </View>
              <Pressable accessibilityRole="button" onPress={() => supabase.auth.signOut()} style={styles.signOut}>
                <Text style={styles.signOutText}>Sign out</Text>
              </Pressable>
            </View>
            {!partner ? <Text style={styles.meta}>Your account is not linked to a pharmacy or lab yet.</Text> : null}
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Button label="Open" variant={showDone ? 'outline' : 'primary'} onPress={() => setShowDone(false)} />
              </View>
              <View style={{ flex: 1 }}>
                <Button label="All" variant={showDone ? 'primary' : 'outline'} onPress={() => setShowDone(true)} />
              </View>
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        }
        ListEmptyComponent={partner ? <Text style={styles.empty}>No open orders.</Text> : undefined}
        ListFooterComponent={<FingerprintRow />}
        renderItem={({ item }) => {
          const s = status(item);
          const next = NEXT[`${s}_${item.kind}`] ?? [];
          const patient = item.row.patient;
          return (
            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.name}>{patient?.full_name || 'Patient'}</Text>
                <Text style={styles.status}>{STATUS_LABEL[s] ?? s}</Text>
              </View>
              {patient?.phone ? <Text style={styles.meta}>Phone: {patient.phone}</Text> : null}
              <Text style={styles.meta}>
                {new Date(item.row.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
              </Text>
              {item.kind === 'prescription' ? (
                item.row.prescription_items.map((i) => (
                  <Text key={i.id} style={styles.line}>
                    {i.medicine}: {i.instructions}
                    {i.days ? `, ${i.days} days` : ''}
                  </Text>
                ))
              ) : (
                <>
                  <Text style={styles.line}>{item.row.test_name}</Text>
                  {item.row.notes ? <Text style={styles.meta}>{item.row.notes}</Text> : null}
                </>
              )}
              {next.length > 0 ? (
                <View style={styles.row}>
                  {next.map((n) => (
                    <View key={n.status} style={{ flex: 1 }}>
                      <Button
                        label={n.label}
                        variant={n === next[0] ? 'primary' : 'outline'}
                        onPress={() => move(item.kind, item.row.id, n.status)}
                        busy={busyId === item.row.id && n === next[0]}
                        disabled={busyId === item.row.id}
                      />
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  list: { padding: 20, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  brand: { fontSize: 13, fontWeight: '600', color: colors.brand },
  title: { fontSize: 24, fontWeight: '700', color: colors.ink },
  signOut: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  signOutText: { fontSize: 14, fontWeight: '600', color: colors.muted },
  row: { flexDirection: 'row', gap: 8 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  meta: { fontSize: 13, color: colors.muted, lineHeight: 19 },
  error: { fontSize: 14, color: colors.danger },
  empty: { fontSize: 15, color: colors.muted, textAlign: 'center', marginTop: 24 },
  card: { backgroundColor: colors.card, borderRadius: radius.md, padding: 14, gap: 6 },
  name: { fontSize: 16, fontWeight: '600', color: colors.ink, flex: 1 },
  status: { fontSize: 12, fontWeight: '700', color: colors.brandDark, backgroundColor: colors.brandTint, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, overflow: 'hidden' },
  line: { fontSize: 14, color: colors.ink, lineHeight: 20 },
});
