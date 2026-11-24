import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Loading } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { colors, radius } from '@/lib/theme';

type Progress = 'invited' | 'signed_up' | 'applied' | 'approved';
type Invite = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  mdcn_number: string | null;
  specialty: string | null;
  note: string | null;
  progress: Progress;
};
type Draft = Pick<Invite, 'full_name' | 'phone' | 'email' | 'mdcn_number' | 'specialty' | 'note'>;

const PROGRESS: Record<Progress, { label: string; bg: string; fg: string }> = {
  invited: { label: 'Invited', bg: colors.line, fg: colors.muted },
  signed_up: { label: 'Signed up', bg: colors.amberTint, fg: colors.amberText },
  applied: { label: 'Applied: review it', bg: colors.amberTint, fg: colors.amberText },
  approved: { label: 'Approved', bg: colors.brandTint, fg: colors.brandDark },
};
const EMPTY: Draft = { full_name: '', phone: '', email: '', mdcn_number: '', specialty: '', note: '' };

/**
 * Admin-only list of doctors LanDu has invited. Their phone, email and licence number are visible
 * to the admin only; progress fills in by itself once a doctor signs up with the same email.
 */
export default function Invites() {
  const { aal } = useAuth();
  const [items, setItems] = useState<Invite[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.rpc('list_provider_invites');
    if (err) setError('Could not load the list. Check your network and try again.');
    setItems((data as Invite[] | null) ?? []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (aal.current === 'aal2') load();
    }, [aal, load]),
  );

  function edit(item: Invite | null) {
    setError(null);
    if (!item) {
      setOpen('new');
      setDraft(EMPTY);
      return;
    }
    setOpen(open === item.id ? null : item.id);
    setDraft({
      full_name: item.full_name,
      phone: item.phone ?? '',
      email: item.email ?? '',
      mdcn_number: item.mdcn_number ?? '',
      specialty: item.specialty ?? '',
      note: item.note ?? '',
    });
  }

  async function save() {
    const clean = {
      full_name: draft.full_name.trim(),
      phone: draft.phone?.trim() || null,
      email: draft.email?.trim().toLowerCase() || null,
      mdcn_number: draft.mdcn_number?.trim() || null,
      specialty: draft.specialty?.trim() || null,
      note: draft.note?.trim() || null,
    };
    if (clean.full_name.length < 2) {
      setError('Enter the doctor’s name.');
      return;
    }
    if (clean.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean.email)) {
      setError('That email address does not look right.');
      return;
    }
    setBusy(true);
    setError(null);
    const res =
      open === 'new'
        ? await supabase.from('provider_invites').insert(clean)
        : await supabase.from('provider_invites').update({ ...clean, updated_at: new Date().toISOString() }).eq('id', open!);
    setBusy(false);
    if (res.error) {
      setError(res.error.code === '23505' ? 'Another doctor on the list already has that email.' : 'Could not save. Check your network and try again.');
      return;
    }
    setOpen(null);
    load();
  }

  async function remove(id: string) {
    setBusy(true);
    const { error: err } = await supabase.from('provider_invites').delete().eq('id', id);
    setBusy(false);
    if (err) setError('Could not remove. Try again.');
    else {
      setOpen(null);
      load();
    }
  }

  if (aal.current !== 'aal2') {
    return (
      <View style={styles.center}>
        <Text style={styles.meta}>Open the Review tab and enter your two-step code first.</Text>
      </View>
    );
  }
  if (!items) return <Loading />;

  const counts = items.reduce((c, i) => ({ ...c, [i.progress]: (c[i.progress] ?? 0) + 1 }), {} as Record<string, number>);

  const form = (
    <View style={styles.form}>
      <Field label="Name" value={draft.full_name} onChange={(v) => setDraft({ ...draft, full_name: v })} />
      <Field label="Phone" value={draft.phone ?? ''} onChange={(v) => setDraft({ ...draft, phone: v })} keyboard="phone-pad" />
      <Field
        label="Email (the one they will sign up with)"
        value={draft.email ?? ''}
        onChange={(v) => setDraft({ ...draft, email: v })}
        keyboard="email-address"
      />
      <Field label="MDCN number" value={draft.mdcn_number ?? ''} onChange={(v) => setDraft({ ...draft, mdcn_number: v })} />
      <Field label="Specialty" value={draft.specialty ?? ''} onChange={(v) => setDraft({ ...draft, specialty: v })} />
      <Field label="Note (only you see this)" value={draft.note ?? ''} onChange={(v) => setDraft({ ...draft, note: v })} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.row}>
        <Button label="Save" onPress={save} busy={busy} style={{ flex: 1 }} />
        <Button label="Close" variant="outline" onPress={() => setOpen(null)} disabled={busy} style={{ flex: 1 }} />
      </View>
      {open !== 'new' ? (
        <Pressable accessibilityRole="button" onPress={() => remove(open!)} style={{ alignSelf: 'center', padding: 8 }}>
          <Text style={styles.removeText}>Remove from list</Text>
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={{ gap: 10 }}>
            <Text style={styles.meta}>
              {items.length} doctors · {counts.approved ?? 0} approved · {counts.applied ?? 0} waiting for your review. Only you
              can see phone numbers, emails and licence numbers here.
            </Text>
            <Text style={styles.meta}>
              Add each doctor's email: when they sign up with it, their application is pre-filled and their progress updates here.
            </Text>
            {open === 'new' ? form : <Button label="Add a doctor" variant="outline" onPress={() => edit(null)} />}
          </View>
        }
        renderItem={({ item }) => {
          const p = PROGRESS[item.progress];
          const missing = [!item.phone && 'phone', !item.email && 'email', !item.mdcn_number && 'MDCN number'].filter(Boolean);
          return (
            <View style={styles.card}>
              <Pressable accessibilityRole="button" onPress={() => edit(item)} style={styles.cardHead}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.name}>{item.full_name}</Text>
                  {item.specialty ? <Text style={styles.meta}>{item.specialty}</Text> : null}
                  {item.mdcn_number ? <Text style={styles.meta}>MDCN {item.mdcn_number}</Text> : null}
                  {missing.length ? <Text style={styles.missing}>Still needed: {missing.join(', ')}</Text> : null}
                </View>
                <Text style={[styles.badge, { backgroundColor: p.bg, color: p.fg }]}>{p.label}</Text>
              </Pressable>
              {open === item.id ? (
                form
              ) : item.phone ? (
                <View style={styles.row}>
                  <Button label="Call" variant="outline" onPress={() => Linking.openURL(`tel:${item.phone}`)} style={{ flex: 1 }} />
                  <Button
                    label="WhatsApp"
                    variant="outline"
                    onPress={() => Linking.openURL(`https://wa.me/${toWhatsApp(item.phone!)}`)}
                    style={{ flex: 1 }}
                  />
                </View>
              ) : null}
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

/** Nigerian numbers like 0806… become 234806… for WhatsApp links. */
function toWhatsApp(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.startsWith('0') ? `234${digits.slice(1)}` : digits;
}

function Field({
  label,
  value,
  onChange,
  keyboard,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  keyboard?: 'phone-pad' | 'email-address';
}) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType={keyboard ?? 'default'}
        autoCapitalize={keyboard === 'email-address' ? 'none' : 'words'}
        style={styles.input}
        accessibilityLabel={label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  list: { padding: 16, gap: 12 },
  card: { backgroundColor: colors.card, borderRadius: radius.md, padding: 14, gap: 12, borderWidth: 1, borderColor: colors.line },
  cardHead: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  name: { fontSize: 17, fontWeight: '700', color: colors.ink },
  meta: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  missing: { fontSize: 13, color: colors.amberText },
  badge: { fontSize: 12, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, overflow: 'hidden' },
  row: { flexDirection: 'row', gap: 10 },
  form: { gap: 10 },
  label: { fontSize: 13, fontWeight: '600', color: colors.ink },
  input: {
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.sm,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.ink,
  },
  error: { color: colors.danger, fontSize: 14 },
  removeText: { color: colors.danger, fontSize: 14, fontWeight: '600' },
});
