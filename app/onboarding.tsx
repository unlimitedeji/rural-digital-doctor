import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Chip } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { CONSENT_VERSION, LANGUAGES } from '@/lib/catalog';
import { useProfile } from '@/lib/profile';
import { supabase } from '@/lib/supabase';
import { colors, radius } from '@/lib/theme';

/** Turns "25/12/1990" into "1990-12-25", or null if it is not a real past date. */
function parseDate(text: string): string | null {
  const m = text.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [day, month, year] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCDate() !== day || d.getUTCMonth() !== month - 1 || d > new Date() || year < 1900) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export default function Onboarding() {
  const { session } = useAuth();
  const { profile, reload } = useProfile();
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState('');
  const [sex, setSex] = useState<'female' | 'male' | null>(null);
  const [town, setTown] = useState('');
  const [state, setState] = useState('');
  const [allergies, setAllergies] = useState('');
  const [language, setLanguage] = useState('English');
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.full_name) setFullName(profile.full_name);
  }, [profile?.full_name]);

  async function save() {
    const userId = session?.user.id;
    if (!userId) return;
    setError(null);
    const birth = dob.trim() ? parseDate(dob) : null;
    if (!fullName.trim()) return setError('Enter your full name.');
    if (dob.trim() && !birth) return setError('Write your date of birth as day/month/year, for example 25/12/1990.');
    if (!agreed) return setError('Tick the box to agree to the privacy notice.');
    setBusy(true);
    const updated = await supabase
      .from('profiles')
      .update({
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        date_of_birth: birth,
        sex,
        town: town.trim() || null,
        state: state.trim() || null,
        allergies: allergies.trim() || null,
        language,
      })
      .eq('id', userId);
    const consent = updated.error ? updated : await supabase.rpc('record_consent', { p_version: CONSENT_VERSION });
    setBusy(false);
    if (consent.error) {
      setError('Could not save. Check your network and try again.');
      return;
    }
    await reload();
    router.replace('/');
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.brand}>Rural Digital Doctor</Text>
        <Text style={styles.title}>A few details first</Text>
        <Text style={styles.lead}>Your doctor sees these before your visit, so you don't have to repeat them.</Text>

        <Field label="Full name" value={fullName} onChange={setFullName} />
        <Field label="Phone number" value={phone} onChange={setPhone} keyboard="phone-pad" />
        <Field label="Date of birth (day/month/year)" value={dob} onChange={setDob} placeholder="25/12/1990" />

        <Text style={styles.label}>Sex</Text>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Chip label="Female" selected={sex === 'female'} onPress={() => setSex('female')} />
          </View>
          <View style={{ flex: 1 }}>
            <Chip label="Male" selected={sex === 'male'} onPress={() => setSex('male')} />
          </View>
        </View>

        <Field label="Town or village" value={town} onChange={setTown} />
        <Field label="State" value={state} onChange={setState} />
        <Field label="Allergies to medicine, if any" value={allergies} onChange={setAllergies} placeholder="For example penicillin" />

        <Text style={styles.label}>Language you prefer</Text>
        <View style={styles.wrap}>
          {LANGUAGES.map((l) => (
            <Chip key={l} label={l} selected={language === l} onPress={() => setLanguage(l)} />
          ))}
        </View>

        <View style={styles.privacyCard}>
          <Text style={styles.privacyTitle}>Your health information</Text>
          <Text style={styles.privacyText}>
            We keep your details and records private. A doctor sees them only when you book with them, and a result
            only when you share it. A pharmacy or lab sees only the order you send to it. Family who pay for your care
            see receipts, not your health details.
          </Text>
          <Pressable accessibilityRole="link" onPress={() => router.push('/privacy')} style={styles.linkRow}>
            <Text style={styles.link}>Read the full privacy notice</Text>
          </Pressable>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: agreed }}
            onPress={() => setAgreed(!agreed)}
            style={styles.checkRow}
          >
            <View style={[styles.box, agreed && styles.boxOn]}>{agreed ? <Text style={styles.tick}>✓</Text> : null}</View>
            <Text style={styles.checkText}>I agree to the privacy notice and to Rural Digital Doctor storing my health information.</Text>
          </Pressable>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button label="Continue" onPress={save} busy={busy} />
        <Pressable accessibilityRole="button" onPress={() => supabase.auth.signOut()} style={styles.linkRow}>
          <Text style={[styles.link, { color: colors.muted }]}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  keyboard,
}: {
  label: string;
  value: string;
  onChange: (t: string) => void;
  placeholder?: string;
  keyboard?: 'phone-pad';
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        keyboardType={keyboard}
        accessibilityLabel={label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  content: { padding: 24, gap: 12 },
  brand: { fontSize: 14, fontWeight: '700', color: colors.brand },
  title: { fontSize: 28, fontWeight: '700', color: colors.ink },
  lead: { fontSize: 15, color: colors.muted, lineHeight: 22, marginBottom: 4 },
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
  privacyCard: { backgroundColor: colors.card, borderRadius: radius.md, padding: 16, gap: 10, marginTop: 4 },
  privacyTitle: { fontSize: 15, fontWeight: '600', color: colors.ink },
  privacyText: { fontSize: 14, lineHeight: 21, color: colors.ink },
  linkRow: { minHeight: 44, justifyContent: 'center' },
  link: { fontSize: 14, fontWeight: '600', color: colors.brand },
  checkRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', minHeight: 44 },
  box: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: colors.brand },
  tick: { color: '#FFFFFF', fontWeight: '700' },
  checkText: { flex: 1, fontSize: 14, lineHeight: 20, color: colors.ink },
  error: { fontSize: 14, color: colors.danger, lineHeight: 20 },
});
