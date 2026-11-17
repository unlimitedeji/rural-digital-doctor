import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, Chip, Loading, Message } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { callWindow, isCallVisit } from '@/lib/call';
import { supabase } from '@/lib/supabase';
import { colors, formatWhen, modeLabels, radius, type VisitMode } from '@/lib/theme';
import { formatVital, latestByKind, vitalInfo, type Vital } from '@/lib/vitals';

type Visit = {
  id: string;
  patient_id: string;
  starts_at: string;
  ends_at: string;
  mode: VisitMode;
  status: 'confirmed' | 'in_progress' | 'completed' | 'no_show' | 'cancelled' | 'pending_payment';
  reason: string | null;
  patient: {
    full_name: string;
    date_of_birth: string | null;
    sex: string | null;
    town: string | null;
    state: string | null;
    allergies: string | null;
    conditions: string | null;
    past_surgeries: string | null;
  } | null;
};
type SharedRecord = { id: string; title: string; kind: string; storage_paths: string[] };
type Item = { medicine: string; instructions: string; days: string };

const EMPTY_ITEM: Item = { medicine: '', instructions: '', days: '' };

export default function DoctorVisit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const router = useRouter();
  const [visit, setVisit] = useState<Visit | null>(null);
  const [records, setRecords] = useState<SharedRecord[]>([]);
  const [vitals, setVitals] = useState<Vital[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{ record: SharedRecord; url: string | null } | null>(null);
  const [finding, setFinding] = useState('');
  const [summary, setSummary] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [items, setItems] = useState<Item[]>([{ ...EMPTY_ITEM }]);
  const [labTests, setLabTests] = useState<string[]>(['']);
  const [referTo, setReferTo] = useState('');
  const [referReason, setReferReason] = useState('');
  const [urgency, setUrgency] = useState<'routine' | 'soon' | 'urgent'>('routine');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const v = await supabase
      .from('appointments')
      .select(
        'id, patient_id, starts_at, ends_at, mode, status, reason, patient:profiles!appointments_patient_id_fkey(full_name, date_of_birth, sex, town, state, allergies, conditions, past_surgeries)',
      )
      .eq('id', id)
      .maybeSingle();
    if (v.error || !v.data) {
      setLoadError('Could not open this visit.');
      return;
    }
    const data = v.data as unknown as Visit;
    setVisit(data);
    // Row level security returns only the results this patient has shared with this doctor.
    const r = await supabase.from('records').select('id, title, kind, storage_paths').eq('patient_id', data.patient_id);
    setRecords((r.data as SharedRecord[] | null) ?? []);
    const vit = await supabase
      .from('vitals')
      .select('id, kind, value_1, value_2, measured_at')
      .eq('patient_id', data.patient_id)
      .order('measured_at', { ascending: false })
      .limit(50);
    setVitals((vit.data as Vital[] | null) ?? []);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function openRecord(record: SharedRecord) {
    setFinding('');
    setViewer({ record, url: null });
    const path = record.storage_paths[0];
    if (!path) return;
    const signed = await supabase.storage.from('records').createSignedUrl(path, 300);
    setViewer({ record, url: signed.data?.signedUrl ?? null });
  }

  async function saveFinding() {
    const doctorId = session?.user.id;
    if (!viewer || !doctorId || !finding.trim()) return;
    const { error } = await supabase
      .from('record_findings')
      .insert({ record_id: viewer.record.id, doctor_id: doctorId, finding: finding.trim() });
    setViewer(null);
    setNotice(error ? { text: 'Could not save the finding.', error: true } : { text: 'Finding saved. The patient can see it.', error: false });
  }

  async function setStatus(status: 'in_progress' | 'completed' | 'no_show') {
    if (!visit) return;
    setBusy(true);
    const { error } = await supabase.rpc('doctor_update_visit', { p_appointment: visit.id, p_status: status });
    setBusy(false);
    if (error) setNotice({ text: 'Could not update the visit. Check your network and try again.', error: true });
    else await load();
  }

  async function sendToPatient() {
    const doctorId = session?.user.id;
    if (!visit || !doctorId) return;
    if (!summary.trim()) {
      setNotice({ text: 'Write the advice for the patient first.', error: true });
      return;
    }
    const filled = items.filter((i) => i.medicine.trim() && i.instructions.trim());
    const tests = labTests.map((t) => t.trim()).filter(Boolean);
    if (referTo.trim() && !referReason.trim()) {
      setNotice({ text: 'Write the reason for the referral.', error: true });
      return;
    }
    setBusy(true);
    setNotice(null);
    const s = await supabase.from('visit_summaries').upsert({ appointment_id: visit.id, patient_summary: summary.trim() });
    let failed = !!s.error;
    if (!failed && (diagnosis.trim() || filled.length > 0)) {
      const p = await supabase
        .from('prescriptions')
        .insert({
          appointment_id: visit.id,
          doctor_id: doctorId,
          patient_id: visit.patient_id,
          diagnosis: diagnosis.trim() || null,
          advice: summary.trim(),
        })
        .select('id')
        .single();
      failed = !!p.error;
      if (!failed && filled.length > 0) {
        const rows = filled.map((i) => ({
          prescription_id: p.data!.id as string,
          medicine: i.medicine.trim(),
          instructions: i.instructions.trim(),
          days: Number.parseInt(i.days, 10) > 0 ? Number.parseInt(i.days, 10) : null,
        }));
        failed = !!(await supabase.from('prescription_items').insert(rows)).error;
      }
    }
    if (!failed && tests.length > 0) {
      const rows = tests.map((test_name) => ({
        appointment_id: visit.id,
        doctor_id: doctorId,
        patient_id: visit.patient_id,
        test_name,
      }));
      failed = !!(await supabase.from('lab_orders').insert(rows)).error;
    }
    if (!failed && referTo.trim()) {
      failed = !!(
        await supabase.from('referrals').insert({
          appointment_id: visit.id,
          doctor_id: doctorId,
          patient_id: visit.patient_id,
          refer_to: referTo.trim(),
          reason: referReason.trim(),
          urgency,
        })
      ).error;
    }
    setBusy(false);
    if (!failed) setSent(true);
    setNotice(
      failed
        ? { text: 'Could not send. Check your network and try again.', error: true }
        : { text: 'Sent to the patient.', error: false },
    );
  }

  function updateItem(index: number, patch: Partial<Item>) {
    setItems(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  if (loadError) return <Message text={loadError} />;
  if (!visit) return <Loading />;

  const p = visit.patient;
  const age = p?.date_of_birth ? Math.floor((Date.now() - new Date(p.date_of_birth).getTime()) / 31557600000) : null;
  const facts = [age != null ? `${age} yrs` : null, p?.sex, [p?.town, p?.state].filter(Boolean).join(', ') || null]
    .filter(Boolean)
    .join(' · ');
  const isImage = viewer?.record.storage_paths[0] ? !/\.pdf$/i.test(viewer.record.storage_paths[0]) : false;

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card style={{ gap: 6 }}>
          <Text style={styles.name}>{p?.full_name || 'Patient'}</Text>
          {facts ? <Text style={styles.meta}>{facts}</Text> : null}
          <Text style={styles.meta}>
            {formatWhen(visit.starts_at)} · {modeLabels[visit.mode].label} visit
          </Text>
          {p?.allergies ? <Text style={styles.allergy}>Allergy: {p.allergies}</Text> : null}
          {p?.conditions ? <Text style={styles.meta}>Conditions: {p.conditions}</Text> : null}
          {p?.past_surgeries ? <Text style={styles.meta}>Past operations: {p.past_surgeries}</Text> : null}
          {visit.reason ? <Text style={styles.meta}>Reason: {visit.reason}</Text> : null}
        </Card>

        {latestByKind(vitals).length > 0 ? (
          <>
            <Text style={styles.heading}>Latest vitals</Text>
            <Card style={{ gap: 4 }}>
              {latestByKind(vitals).map((v) => (
                <Text key={v.id} style={styles.meta}>
                  {vitalInfo(v.kind).label}: {formatVital(v)} ·{' '}
                  {new Date(v.measured_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
                </Text>
              ))}
            </Card>
          </>
        ) : null}

        <Text style={styles.heading}>Shared results and scans</Text>
        {records.length === 0 ? (
          <Text style={styles.meta}>The patient has not shared anything with you.</Text>
        ) : (
          records.map((r) => (
            <Pressable key={r.id} accessibilityRole="button" onPress={() => openRecord(r)} style={styles.recordRow}>
              <Text style={styles.recordTitle}>{r.title}</Text>
              <Text style={styles.link}>View</Text>
            </Pressable>
          ))
        )}

        {isCallVisit(visit) && callWindow(visit) === 'open' ? (
          <Button
            label={visit.status === 'in_progress' ? 'Rejoin call' : visit.mode === 'video' ? 'Join video call' : 'Join audio call'}
            onPress={() => router.push({ pathname: '/call/[id]', params: { id: visit.id } })}
          />
        ) : null}
        {isCallVisit(visit) && callWindow(visit) === 'early' ? (
          <Text style={styles.meta}>The call opens 10 minutes before the visit time.</Text>
        ) : null}
        {visit.status === 'confirmed' ? (
          <View style={styles.row}>
            <Button
              label={isCallVisit(visit) ? 'Start without call' : 'Start visit'}
              variant={isCallVisit(visit) ? 'outline' : 'primary'}
              onPress={() => setStatus('in_progress')}
              busy={busy}
              style={{ flex: 1 }}
            />
            <Button label="Patient absent" variant="outline" onPress={() => setStatus('no_show')} disabled={busy} style={{ flex: 1 }} />
          </View>
        ) : null}

        <Text style={styles.heading}>Advice in plain words</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={summary}
          onChangeText={setSummary}
          multiline
          placeholder="What you found and what the patient should do"
          placeholderTextColor={colors.muted}
          accessibilityLabel="Advice for the patient"
        />

        <Text style={styles.heading}>Diagnosis</Text>
        <TextInput
          style={styles.input}
          value={diagnosis}
          onChangeText={setDiagnosis}
          placeholder="Optional"
          placeholderTextColor={colors.muted}
          accessibilityLabel="Diagnosis"
        />

        <Text style={styles.heading}>Medicines</Text>
        {items.map((item, i) => (
          <View key={i} style={styles.itemCard}>
            <TextInput
              style={styles.input}
              value={item.medicine}
              onChangeText={(t) => updateItem(i, { medicine: t })}
              placeholder="Medicine and strength"
              placeholderTextColor={colors.muted}
              accessibilityLabel={`Medicine ${i + 1}`}
            />
            <TextInput
              style={styles.input}
              value={item.instructions}
              onChangeText={(t) => updateItem(i, { instructions: t })}
              placeholder="How to take it"
              placeholderTextColor={colors.muted}
              accessibilityLabel={`Instructions for medicine ${i + 1}`}
            />
            <TextInput
              style={styles.input}
              value={item.days}
              onChangeText={(t) => updateItem(i, { days: t.replace(/[^0-9]/g, '') })}
              placeholder="Number of days"
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
              accessibilityLabel={`Days for medicine ${i + 1}`}
            />
          </View>
        ))}
        <Button label="Add medicine" variant="outline" onPress={() => setItems([...items, { ...EMPTY_ITEM }])} />

        <Text style={styles.heading}>Lab tests</Text>
        {labTests.map((t, i) => (
          <TextInput
            key={i}
            style={styles.input}
            value={t}
            onChangeText={(v) => setLabTests(labTests.map((x, j) => (j === i ? v : x)))}
            placeholder="Test name, for example Malaria RDT"
            placeholderTextColor={colors.muted}
            accessibilityLabel={`Lab test ${i + 1}`}
          />
        ))}
        <Button label="Add lab test" variant="outline" onPress={() => setLabTests([...labTests, ''])} />

        <Text style={styles.heading}>Referral</Text>
        <TextInput
          style={styles.input}
          value={referTo}
          onChangeText={setReferTo}
          placeholder="Refer to, for example General Hospital Ikire"
          placeholderTextColor={colors.muted}
          accessibilityLabel="Refer to"
        />
        {referTo.trim() ? (
          <>
            <TextInput
              style={styles.input}
              value={referReason}
              onChangeText={setReferReason}
              placeholder="Reason for referral"
              placeholderTextColor={colors.muted}
              accessibilityLabel="Reason for referral"
            />
            <View style={styles.row}>
              {(['routine', 'soon', 'urgent'] as const).map((u) => (
                <View key={u} style={{ flex: 1 }}>
                  <Chip
                    label={u === 'routine' ? 'Routine' : u === 'soon' ? 'Within days' : 'Urgent'}
                    selected={urgency === u}
                    onPress={() => setUrgency(u)}
                  />
                </View>
              ))}
            </View>
          </>
        ) : null}

        {notice ? <Text style={[styles.notice, { color: notice.error ? colors.danger : colors.brandDark }]}>{notice.text}</Text> : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button label={sent ? 'Sent' : 'Send to patient'} onPress={sendToPatient} busy={busy} disabled={sent} style={{ flex: 1 }} />
        {visit.status === 'in_progress' ? (
          <Button label="Complete visit" variant="outline" onPress={() => setStatus('completed')} disabled={busy} style={{ flex: 1 }} />
        ) : (
          <Button label="Back to queue" variant="outline" onPress={() => router.back()} style={{ flex: 1 }} />
        )}
      </View>

      <Modal visible={!!viewer} animationType="slide" onRequestClose={() => setViewer(null)}>
        <SafeAreaView style={styles.viewer}>
          <Text style={styles.viewerTitle}>{viewer?.record.title}</Text>
          <View style={styles.viewerImageBox}>
            {viewer?.url && isImage ? (
              <Image source={{ uri: viewer.url }} style={styles.viewerImage} resizeMode="contain" accessibilityLabel={viewer.record.title} />
            ) : (
              <Text style={styles.viewerNote}>
                {viewer?.url ? 'This file is a PDF. Viewing PDFs in the app is coming soon.' : 'Loading…'}
              </Text>
            )}
          </View>
          <TextInput
            style={[styles.input, styles.multiline, styles.viewerInput]}
            value={finding}
            onChangeText={setFinding}
            multiline
            placeholder="Your finding. The patient will see it."
            placeholderTextColor="#B8CCCB"
            accessibilityLabel="Your finding"
          />
          <View style={styles.row}>
            <Button label="Close" variant="outline" onPress={() => setViewer(null)} style={{ flex: 1 }} />
            <Button label="Save finding" onPress={saveFinding} disabled={!finding.trim()} style={{ flex: 1 }} />
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  content: { padding: 20, gap: 12 },
  name: { fontSize: 19, fontWeight: '600', color: colors.ink },
  meta: { fontSize: 13, color: colors.muted, lineHeight: 19 },
  allergy: {
    alignSelf: 'flex-start',
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    backgroundColor: colors.danger,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  heading: { fontSize: 14, fontWeight: '600', color: colors.ink, marginTop: 4 },
  recordRow: {
    minHeight: 52,
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  recordTitle: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.ink },
  link: { fontSize: 13, fontWeight: '600', color: colors.brand },
  row: { flexDirection: 'row', gap: 8 },
  input: {
    minHeight: 48,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    fontSize: 15,
    color: colors.ink,
  },
  multiline: { minHeight: 88, paddingTop: 12, textAlignVertical: 'top' },
  itemCard: { gap: 8 },
  notice: { fontSize: 14, lineHeight: 20 },
  footer: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  viewer: { flex: 1, backgroundColor: '#0A1F22', padding: 16, gap: 12 },
  viewerTitle: { fontSize: 18, fontWeight: '600', color: '#FFFFFF' },
  viewerImageBox: { flex: 1, borderRadius: radius.lg, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center' },
  viewerImage: { width: '100%', height: '100%' },
  viewerNote: { fontSize: 14, color: '#B8CCCB', textAlign: 'center', padding: 24 },
  viewerInput: { backgroundColor: '#143A3F', borderColor: '#3C6368', color: '#FFFFFF' },
});
