import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, Loading } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { safeMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { colors, radius } from '@/lib/theme';

type Request = { id: string; status: 'pending' | 'done' | 'rejected'; created_at: string; review_note: string | null };

/** Patients ask for their account and personal details to be erased. An admin carries it out. */
export default function DeleteAccount() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [latest, setLatest] = useState<Request | null | undefined>(undefined);
  const [reason, setReason] = useState('');
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('deletion_requests')
      .select('id, status, created_at, review_note')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setLatest((data as Request | null) ?? null);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  async function send() {
    if (!userId) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.from('deletion_requests').insert({ user_id: userId, reason: reason.trim().slice(0, 500) || null });
    setBusy(false);
    if (err) setError(err.code === '23505' ? 'Your request is already being handled.' : safeMessage(err, 'Could not send. Check your network and try again.'));
    else load();
  }

  if (latest === undefined) return <Loading />;

  if (latest?.status === 'pending') {
    return (
      <SafeAreaView style={styles.screen} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Request received</Text>
          <Text style={styles.note}>
            We received your request on {new Date(latest.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'long' })}.
            We will erase your personal details within 30 days and let you know.
          </Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Delete my account</Text>
        <Card>
          <Text style={styles.point}>We erase your name, phone, address, date of birth, health details, vitals and identity photos.</Text>
          <Text style={styles.point}>
            Notes your doctors wrote, prescriptions and payment records may have to be kept for a period set by law. They stay
            locked and are not used for anything else.
          </Text>
          <Text style={styles.point}>Money left in your wallet cannot be returned after deletion. Contact us first if you have a balance.</Text>
        </Card>
        {latest?.status === 'rejected' && latest.review_note ? <Text style={styles.note}>Your last request was declined: {latest.review_note}</Text> : null}
        <Text style={styles.label}>Why are you leaving? (optional)</Text>
        <TextInput
          value={reason}
          onChangeText={setReason}
          maxLength={500}
          multiline
          style={styles.input}
          placeholder="Tell us if something went wrong"
          placeholderTextColor={colors.muted}
        />
        {sure ? (
          <Button label="Yes, delete my account" onPress={send} busy={busy} style={{ backgroundColor: colors.danger }} />
        ) : (
          <Button label="Delete my account" variant="outline" onPress={() => setSure(true)} />
        )}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  content: { padding: 20, gap: 14 },
  title: { fontSize: 24, fontWeight: '700', color: colors.ink },
  note: { fontSize: 15, color: colors.muted, lineHeight: 22 },
  point: { fontSize: 15, color: colors.ink, lineHeight: 22, marginBottom: 8 },
  label: { fontSize: 14, fontWeight: '600', color: colors.ink },
  input: {
    minHeight: 90,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.card,
    padding: 12,
    fontSize: 16,
    color: colors.ink,
    textAlignVertical: 'top',
  },
  error: { fontSize: 15, color: colors.danger },
});
