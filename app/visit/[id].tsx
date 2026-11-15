import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Avatar, Button, Card, Loading, Message } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { colors, formatWhen, modeLabels, naira, radius, type VisitMode } from '@/lib/theme';

type PartnerRef = { id: string; name: string; town: string | null; address: string | null; phone: string | null };
type Prescription = {
  id: string;
  diagnosis: string | null;
  fulfilment_status: 'not_sent' | 'sent' | 'ready' | 'dispensed';
  partners: PartnerRef | null;
  prescription_items: { id: string; medicine: string; instructions: string; days: number | null }[];
};
type LabOrder = {
  id: string;
  test_name: string;
  status: 'ordered' | 'sent' | 'sample_taken' | 'result_ready' | 'cancelled';
  partners: PartnerRef | null;
};
type Referral = { id: string; refer_to: string; reason: string; urgency: 'routine' | 'soon' | 'urgent' };
type Detail = {
  id: string;
  starts_at: string;
  mode: VisitMode;
  status: string;
  fee_kobo: number;
  doctors: { display_name: string; specialty: string } | null;
  visit_summaries: { patient_summary: string } | { patient_summary: string }[] | null;
  prescriptions: Prescription[];
  lab_orders: LabOrder[];
  referrals: Referral[];
};
type Partner = PartnerRef & { kind: 'pharmacy' | 'lab'; state: string | null };

const RX_STATUS: Record<Prescription['fulfilment_status'], string> = {
  not_sent: 'Not sent to a pharmacy yet',
  sent: 'Sent. Waiting for the pharmacy',
  ready: 'Ready for pickup',
  dispensed: 'Collected',
};
const LAB_STATUS: Record<LabOrder['status'], string> = {
  ordered: 'Not sent to a lab yet',
  sent: 'Sent. Visit the lab for your test',
  sample_taken: 'Sample taken',
  result_ready: 'Result ready. Collect it and upload it under Records',
  cancelled: 'Cancelled',
};
const URGENCY: Record<Referral['urgency'], string> = { routine: 'Routine', soon: 'Go within days', urgent: 'Go now' };

const PARTNER_FIELDS = 'partners(id, name, town, address, phone)';

export default function VisitDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [visit, setVisit] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [picking, setPicking] = useState<{ kind: 'prescription' | 'lab'; id: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const { data, error: err } = await supabase
      .from('appointments')
      .select(
        `id, starts_at, mode, status, fee_kobo, doctors(display_name, specialty), visit_summaries(patient_summary),
         prescriptions(id, diagnosis, fulfilment_status, ${PARTNER_FIELDS}, prescription_items(id, medicine, instructions, days)),
         lab_orders(id, test_name, status, ${PARTNER_FIELDS}),
         referrals(id, refer_to, reason, urgency)`,
      )
      .eq('id', id)
      .maybeSingle();
    if (err || !data) setError('Could not open this visit.');
    else setVisit(data as unknown as Detail);
  }, [id]);

  useEffect(() => {
    load();
    supabase
      .from('partners')
      .select('id, kind, name, town, state, address, phone')
      .eq('active', true)
      .order('name')
      .then(({ data }) => setPartners((data as Partner[] | null) ?? []));
  }, [load]);

  async function send(partnerId: string) {
    if (!picking) return;
    setBusy(true);
    setNotice(null);
    const { error: err } = await supabase.rpc('send_to_partner', { p_kind: picking.kind, p_id: picking.id, p_partner: partnerId });
    setBusy(false);
    setPicking(null);
    if (err) setNotice('Could not send. Check your network and try again.');
    else await load();
  }

  if (error) return <Message text={error} />;
  if (!visit) return <Loading />;

  const doctorName = visit.doctors?.display_name ?? 'Your doctor';
  const summaryRow = Array.isArray(visit.visit_summaries) ? visit.visit_summaries[0] : visit.visit_summaries;
  const options = partners.filter((p) => p.kind === (picking?.kind === 'lab' ? 'lab' : 'pharmacy'));

  function PartnerLine({ p }: { p: PartnerRef | null }) {
    if (!p) return null;
    const where = [p.address, p.town].filter(Boolean).join(', ');
    return (
      <Text style={styles.meta}>
        {p.name}
        {where ? ` · ${where}` : ''}
        {p.phone ? ` · ${p.phone}` : ''}
      </Text>
    );
  }

  function Picker({ kind, orderId, canChange }: { kind: 'prescription' | 'lab'; orderId: string; canChange: boolean }) {
    if (!canChange) return null;
    if (picking?.id !== orderId) {
      return (
        <Button
          label={kind === 'lab' ? 'Choose a lab' : 'Choose a pharmacy'}
          variant="outline"
          onPress={() => setPicking({ kind, id: orderId })}
        />
      );
    }
    return (
      <View style={{ gap: 8 }}>
        {options.length === 0 ? (
          <Text style={styles.meta}>
            No partner {kind === 'lab' ? 'labs' : 'pharmacies'} have joined yet. You can still take this to any {kind === 'lab' ? 'lab' : 'pharmacy'}.
          </Text>
        ) : (
          options.map((p) => (
            <Pressable key={p.id} accessibilityRole="button" disabled={busy} onPress={() => send(p.id)} style={styles.option}>
              <Text style={styles.optionName}>{p.name}</Text>
              <Text style={styles.meta}>{[p.address, p.town, p.state].filter(Boolean).join(', ')}</Text>
            </Pressable>
          ))
        )}
        <Button label="Cancel" variant="outline" onPress={() => setPicking(null)} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card style={styles.header}>
        <Avatar name={doctorName} size={48} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{doctorName}</Text>
          <Text style={styles.meta}>
            {visit.doctors?.specialty ?? ''} · {modeLabels[visit.mode].label} · {naira(visit.fee_kobo)}
          </Text>
          <Text style={styles.meta}>{formatWhen(visit.starts_at)}</Text>
        </View>
      </Card>

      <Text style={styles.heading}>What the doctor said</Text>
      <Card>
        <Text style={styles.body}>
          {summaryRow?.patient_summary ?? 'Your doctor has not written a summary yet. It appears here after the visit.'}
        </Text>
      </Card>

      {notice ? <Text style={styles.error}>{notice}</Text> : null}

      {visit.referrals.map((r) => (
        <View key={r.id} style={{ gap: 8 }}>
          <Text style={styles.heading}>Referral</Text>
          <Card style={{ gap: 4 }}>
            <Text style={[styles.urgency, r.urgency === 'urgent' && styles.urgent]}>{URGENCY[r.urgency]}</Text>
            <Text style={styles.name}>{r.refer_to}</Text>
            <Text style={styles.meta}>{r.reason}</Text>
          </Card>
        </View>
      ))}

      {visit.prescriptions.map((p) => (
        <View key={p.id} style={{ gap: 8 }}>
          <Text style={styles.heading}>Your medicine</Text>
          {p.diagnosis ? <Text style={styles.meta}>Diagnosis: {p.diagnosis}</Text> : null}
          {p.prescription_items.map((item) => (
            <Card key={item.id} style={{ gap: 2 }}>
              <Text style={styles.name}>{item.medicine}</Text>
              <Text style={styles.meta}>
                {item.instructions}
                {item.days ? ` · ${item.days} days` : ''}
              </Text>
            </Card>
          ))}
          {p.prescription_items.length > 0 ? (
            <Card style={{ gap: 8 }}>
              <Text style={styles.status}>{RX_STATUS[p.fulfilment_status]}</Text>
              <PartnerLine p={p.partners} />
              <Picker kind="prescription" orderId={p.id} canChange={p.fulfilment_status === 'not_sent' || p.fulfilment_status === 'sent'} />
            </Card>
          ) : null}
        </View>
      ))}

      {visit.lab_orders.length > 0 ? <Text style={styles.heading}>Lab tests</Text> : null}
      {visit.lab_orders.map((l) => (
        <Card key={l.id} style={{ gap: 8 }}>
          <Text style={styles.name}>{l.test_name}</Text>
          <Text style={styles.status}>{LAB_STATUS[l.status]}</Text>
          <PartnerLine p={l.partners} />
          <Picker kind="lab" orderId={l.id} canChange={l.status === 'ordered' || l.status === 'sent'} />
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  content: { padding: 20, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { fontSize: 15, fontWeight: '600', color: colors.ink },
  meta: { fontSize: 13, color: colors.muted, lineHeight: 19 },
  heading: { fontSize: 15, fontWeight: '600', color: colors.ink, marginTop: 4 },
  body: { fontSize: 14, lineHeight: 21, color: colors.ink },
  error: { fontSize: 14, color: colors.danger },
  status: { fontSize: 13, fontWeight: '600', color: colors.brandDark },
  urgency: { fontSize: 12, fontWeight: '700', color: colors.brandDark },
  urgent: { color: colors.danger },
  option: { borderWidth: 1.5, borderColor: colors.brand, borderRadius: radius.sm, padding: 12, gap: 2, minHeight: 48 },
  optionName: { fontSize: 14, fontWeight: '600', color: colors.brand },
});
