import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Linking, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Loading } from '@/components/ui';
import { PARTNER_KINDS, providerLabel } from '@/lib/catalog';
import { supabase } from '@/lib/supabase';
import { colors, naira, radius } from '@/lib/theme';

type IdentityCheck = {
  id: string;
  address: string;
  proof_path: string;
  selfie_path: string;
  created_at: string;
  person: { full_name: string; phone: string | null } | null;
};

type Application = {
  id: string;
  kind: 'provider' | 'pharmacy' | 'lab';
  provider_type: string | null;
  full_name: string;
  organisation_name: string | null;
  specialty: string | null;
  licence_body: string;
  licence_number: string;
  years_experience: number | null;
  languages: string[];
  phone: string | null;
  address: string | null;
  town: string | null;
  state: string | null;
  fee_video_kobo: number | null;
  fee_audio_kobo: number | null;
  fee_clinic_kobo: number | null;
  created_at: string;
};

export default function Review() {
  const [items, setItems] = useState<Application[] | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloads, setReloads] = useState(0);
  const [checks, setChecks] = useState<IdentityCheck[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      supabase
        .from('provider_applications')
        .select('*')
        .eq('status', 'pending')
        .order('created_at')
        .then(({ data }) => {
          if (active) setItems((data as Application[] | null) ?? []);
        });
      supabase
        .from('identity_verifications')
        .select('id, address, proof_path, selfie_path, created_at, person:profiles!identity_verifications_user_id_fkey(full_name, phone)')
        .eq('status', 'pending')
        .order('created_at')
        .then(({ data }) => {
          if (active) setChecks((data as unknown as IdentityCheck[] | null) ?? []);
        });
      return () => {
        active = false;
      };
    }, [reloads]),
  );

  async function decide(id: string, approve: boolean) {
    setBusyId(id);
    setError(null);
    const { error: err } = await supabase.rpc('review_application', {
      p_application: id,
      p_approve: approve,
      p_note: notes[id]?.trim() || null,
    });
    setBusyId(null);
    if (err) setError('Could not save the decision. Check your network and try again.');
    else setReloads((n) => n + 1);
  }

  async function openFile(path: string) {
    const signed = await supabase.storage.from('identity').createSignedUrl(path, 120);
    if (signed.data?.signedUrl) Linking.openURL(signed.data.signedUrl);
    else setError('Could not open the file.');
  }

  async function decideIdentity(id: string, approve: boolean) {
    setBusyId(id);
    setError(null);
    const { error: err } = await supabase.rpc('review_identity', {
      p_id: id,
      p_approve: approve,
      p_note: notes[id]?.trim() || null,
    });
    setBusyId(null);
    if (err) setError('Could not save the decision. Check your network and try again.');
    else setReloads((n) => n + 1);
  }

  if (!items) return <Loading />;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <FlatList
        data={items}
        keyExtractor={(a) => a.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={{ gap: 6 }}>
            <Text style={styles.title}>Applications</Text>
            <Text style={styles.meta}>
              Check each licence with the licensing body before approving. Approved health workers appear to patients
              as verified.
            </Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        }
        ListEmptyComponent={<Text style={styles.empty}>No applications waiting.</Text>}
        ListFooterComponent={
          <View style={{ gap: 12, marginTop: 12 }}>
            <Text style={styles.title}>Identity checks</Text>
            <Text style={styles.meta}>Check that the selfie, name and proof of address match before approving.</Text>
            {checks.length === 0 ? <Text style={styles.empty}>No identity checks waiting.</Text> : null}
            {checks.map((c) => (
              <View key={c.id} style={styles.card}>
                <Text style={styles.name}>{c.person?.full_name || 'Patient'}</Text>
                {c.person?.phone ? <Text style={styles.meta}>Phone: {c.person.phone}</Text> : null}
                <Text style={styles.meta}>Address: {c.address}</Text>
                <View style={styles.row}>
                  <Button label="View proof" variant="outline" onPress={() => openFile(c.proof_path)} style={{ flex: 1 }} />
                  <Button label="View selfie" variant="outline" onPress={() => openFile(c.selfie_path)} style={{ flex: 1 }} />
                </View>
                <TextInput
                  style={styles.input}
                  value={notes[c.id] ?? ''}
                  onChangeText={(t) => setNotes({ ...notes, [c.id]: t })}
                  placeholder="Note to the person (shown if not approved)"
                  placeholderTextColor={colors.muted}
                  accessibilityLabel="Note to the person"
                />
                <View style={styles.row}>
                  <Button label="Approve" onPress={() => decideIdentity(c.id, true)} busy={busyId === c.id} style={{ flex: 1 }} />
                  <Button
                    label="Not approved"
                    variant="outline"
                    onPress={() => decideIdentity(c.id, false)}
                    disabled={busyId === c.id}
                    style={{ flex: 1 }}
                  />
                </View>
              </View>
            ))}
          </View>
        }
        renderItem={({ item }) => {
          const what =
            item.kind === 'provider'
              ? providerLabel(item.provider_type)
              : PARTNER_KINDS.find((p) => p.id === item.kind)?.label ?? item.kind;
          const place = [item.address, item.town, item.state].filter(Boolean).join(', ');
          return (
            <View style={styles.card}>
              <Text style={styles.kind}>{what}</Text>
              <Text style={styles.name}>{item.organisation_name ?? item.full_name}</Text>
              {item.organisation_name ? <Text style={styles.meta}>Owner: {item.full_name}</Text> : null}
              <Text style={styles.licence}>
                {item.licence_body} licence: {item.licence_number}
              </Text>
              {item.specialty ? <Text style={styles.meta}>Specialty: {item.specialty}</Text> : null}
              {item.years_experience != null ? <Text style={styles.meta}>{item.years_experience} years' experience</Text> : null}
              {item.kind === 'provider' && item.languages.length > 0 ? (
                <Text style={styles.meta}>Speaks {item.languages.join(', ')}</Text>
              ) : null}
              {place ? <Text style={styles.meta}>{place}</Text> : null}
              {item.phone ? <Text style={styles.meta}>Phone: {item.phone}</Text> : null}
              {item.kind === 'provider' ? (
                <Text style={styles.meta}>
                  Fees: video {naira(item.fee_video_kobo ?? 0)} · audio {naira(item.fee_audio_kobo ?? 0)} · clinic{' '}
                  {naira(item.fee_clinic_kobo ?? 0)}
                </Text>
              ) : null}
              <TextInput
                style={styles.input}
                value={notes[item.id] ?? ''}
                onChangeText={(t) => setNotes({ ...notes, [item.id]: t })}
                placeholder="Note to applicant (shown if not approved)"
                placeholderTextColor={colors.muted}
                accessibilityLabel="Note to applicant"
              />
              <View style={styles.row}>
                <Button label="Approve" onPress={() => decide(item.id, true)} busy={busyId === item.id} style={{ flex: 1 }} />
                <Button
                  label="Not approved"
                  variant="outline"
                  onPress={() => decide(item.id, false)}
                  disabled={busyId === item.id}
                  style={{ flex: 1 }}
                />
              </View>
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
  title: { fontSize: 26, fontWeight: '700', color: colors.ink },
  meta: { fontSize: 13, color: colors.muted, lineHeight: 19 },
  error: { fontSize: 14, color: colors.danger },
  empty: { fontSize: 15, color: colors.muted, textAlign: 'center', marginTop: 24 },
  card: { backgroundColor: colors.card, borderRadius: radius.md, padding: 14, gap: 4 },
  kind: { fontSize: 12, fontWeight: '700', color: colors.brand },
  name: { fontSize: 17, fontWeight: '600', color: colors.ink },
  licence: { fontSize: 14, fontWeight: '600', color: colors.ink, marginVertical: 2 },
  input: {
    minHeight: 46,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.line,
    paddingHorizontal: 12,
    fontSize: 14,
    color: colors.ink,
    marginTop: 8,
  },
  row: { flexDirection: 'row', gap: 8, marginTop: 8 },
});
