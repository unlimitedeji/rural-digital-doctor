import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Avatar, Card, Loading, Message } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { colors, formatWhen, modeLabels, naira, type VisitMode } from '@/lib/theme';

type Detail = {
  id: string;
  starts_at: string;
  mode: VisitMode;
  status: string;
  fee_kobo: number;
  doctors: { display_name: string; specialty: string } | null;
  visit_summaries: { patient_summary: string } | { patient_summary: string }[] | null;
  prescriptions: {
    id: string;
    diagnosis: string | null;
    prescription_items: { id: string; medicine: string; instructions: string; days: number | null }[];
  }[];
};

export default function VisitDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [visit, setVisit] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    supabase
      .from('appointments')
      .select(
        'id, starts_at, mode, status, fee_kobo, doctors(display_name, specialty), visit_summaries(patient_summary), prescriptions(id, diagnosis, prescription_items(id, medicine, instructions, days))',
      )
      .eq('id', id)
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (err || !data) setError('Could not open this visit.');
        else setVisit(data as unknown as Detail);
      });
  }, [id]);

  if (error) return <Message text={error} />;
  if (!visit) return <Loading />;

  const doctorName = visit.doctors?.display_name ?? 'Your doctor';
  const summaryRow = Array.isArray(visit.visit_summaries) ? visit.visit_summaries[0] : visit.visit_summaries;

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

      {visit.prescriptions.map((p) => (
        <View key={p.id} style={{ gap: 12 }}>
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
        </View>
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
});
