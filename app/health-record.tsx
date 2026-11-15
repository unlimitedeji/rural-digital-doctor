import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Loading } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { colors, radius } from '@/lib/theme';

const FIELDS = [
  { key: 'allergies', label: 'Allergies', hint: 'Medicines or foods that cause a reaction, for example penicillin' },
  { key: 'conditions', label: 'Long-term conditions', hint: 'For example high blood pressure, diabetes, sickle cell, asthma' },
  { key: 'past_surgeries', label: 'Past operations', hint: 'For example caesarean section 2019, appendix removed' },
] as const;
type Key = (typeof FIELDS)[number]['key'];

export default function HealthRecord() {
  const { session } = useAuth();
  const router = useRouter();
  const userId = session?.user.id;
  const [values, setValues] = useState<Record<Key, string> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from('profiles')
      .select('allergies, conditions, past_surgeries')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) =>
        setValues({
          allergies: data?.allergies ?? '',
          conditions: data?.conditions ?? '',
          past_surgeries: data?.past_surgeries ?? '',
        }),
      );
  }, [userId]);

  async function save() {
    if (!userId || !values) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase
      .from('profiles')
      .update({
        allergies: values.allergies.trim() || null,
        conditions: values.conditions.trim() || null,
        past_surgeries: values.past_surgeries.trim() || null,
      })
      .eq('id', userId);
    setBusy(false);
    if (err) setError('Could not save. Check your network and try again.');
    else router.back();
  }

  if (!values) return <Loading />;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.lead}>Your doctors see this before each visit, so you don't have to repeat it.</Text>
      {FIELDS.map((f) => (
        <View key={f.key} style={{ gap: 6 }}>
          <Text style={styles.label}>{f.label}</Text>
          <TextInput
            style={styles.input}
            value={values[f.key]}
            onChangeText={(t) => setValues({ ...values, [f.key]: t })}
            placeholder="None"
            placeholderTextColor={colors.muted}
            multiline
            accessibilityLabel={f.label}
          />
          <Text style={styles.hint}>{f.hint}</Text>
        </View>
      ))}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label="Save" onPress={save} busy={busy} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  content: { padding: 20, gap: 16 },
  lead: { fontSize: 15, color: colors.muted, lineHeight: 22 },
  label: { fontSize: 15, fontWeight: '600', color: colors.ink },
  input: {
    minHeight: 64,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.card,
    padding: 14,
    fontSize: 15,
    color: colors.ink,
    textAlignVertical: 'top',
  },
  hint: { fontSize: 12, color: colors.muted },
  error: { fontSize: 14, color: colors.danger },
});
