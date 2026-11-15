import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Chip, Loading } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { LANGUAGES } from '@/lib/catalog';
import { useProfile } from '@/lib/profile';
import { supabase } from '@/lib/supabase';
import { colors, radius } from '@/lib/theme';

type Details = {
  full_name: string;
  phone: string;
  dob: string;
  sex: 'female' | 'male' | null;
  town: string;
  state: string;
  language: string;
};

function toDisplayDate(iso: string | null): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${Number(d)}/${Number(m)}/${y}`;
}

function parseDate(text: string): string | null {
  const m = text.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [day, month, year] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCDate() !== day || d.getUTCMonth() !== month - 1 || d > new Date() || year < 1900) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export default function ProfileEdit() {
  const { session } = useAuth();
  const { reload } = useProfile();
  const router = useRouter();
  const userId = session?.user.id;
  const [v, setV] = useState<Details | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from('profiles')
      .select('full_name, phone, date_of_birth, sex, town, state, language')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) =>
        setV({
          full_name: data?.full_name ?? '',
          phone: data?.phone ?? '',
          dob: toDisplayDate(data?.date_of_birth ?? null),
          sex: (data?.sex as Details['sex']) ?? null,
          town: data?.town ?? '',
          state: data?.state ?? '',
          language: data?.language ?? 'English',
        }),
      );
  }, [userId]);

  async function save() {
    if (!userId || !v) return;
    setError(null);
    const birth = v.dob.trim() ? parseDate(v.dob) : null;
    if (!v.full_name.trim()) return setError('Enter your full name.');
    if (v.dob.trim() && !birth) return setError('Write your date of birth as day/month/year, for example 25/12/1990.');
    setBusy(true);
    const { error: err } = await supabase
      .from('profiles')
      .update({
        full_name: v.full_name.trim(),
        phone: v.phone.trim() || null,
        date_of_birth: birth,
        sex: v.sex,
        town: v.town.trim() || null,
        state: v.state.trim() || null,
        language: v.language,
      })
      .eq('id', userId);
    setBusy(false);
    if (err) return setError('Could not save. Check your network and try again.');
    await reload();
    router.back();
  }

  if (!v) return <Loading />;
  const field = (key: 'full_name' | 'phone' | 'dob' | 'town' | 'state', label: string, extra?: object) => (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={v[key]}
        onChangeText={(t) => setV({ ...v, [key]: t })}
        placeholderTextColor={colors.muted}
        accessibilityLabel={label}
        {...extra}
      />
    </View>
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {field('full_name', 'Full name')}
      {field('phone', 'Phone number', { keyboardType: 'phone-pad' })}
      {field('dob', 'Date of birth (day/month/year)', { placeholder: '25/12/1990' })}
      <Text style={styles.label}>Sex</Text>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Chip label="Female" selected={v.sex === 'female'} onPress={() => setV({ ...v, sex: 'female' })} />
        </View>
        <View style={{ flex: 1 }}>
          <Chip label="Male" selected={v.sex === 'male'} onPress={() => setV({ ...v, sex: 'male' })} />
        </View>
      </View>
      {field('town', 'Town or village')}
      {field('state', 'State')}
      <Text style={styles.label}>Language you prefer</Text>
      <View style={styles.wrap}>
        {LANGUAGES.map((l) => (
          <Chip key={l} label={l} selected={v.language === l} onPress={() => setV({ ...v, language: l })} />
        ))}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label="Save" onPress={save} busy={busy} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  content: { padding: 20, gap: 12, paddingBottom: 32 },
  label: { fontSize: 14, fontWeight: '600', color: colors.ink },
  input: {
    height: 52,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    fontSize: 16,
    color: colors.ink,
  },
  row: { flexDirection: 'row', gap: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  error: { fontSize: 14, color: colors.danger },
});
