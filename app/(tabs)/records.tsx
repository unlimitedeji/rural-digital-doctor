import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Chip, Loading } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { colors, radius } from '@/lib/theme';

type Kind = 'lab' | 'xray' | 'ultrasound' | 'ct' | 'other';
type RecordRow = {
  id: string;
  kind: Kind;
  title: string;
  created_at: string;
  record_shares: { doctor_id: string }[];
  record_findings: { finding: string }[];
};
type DoctorOption = { id: string; display_name: string };
type Picked = { uri: string; name: string; mimeType: string };

const KINDS: { id: Kind; label: string }[] = [
  { id: 'lab', label: 'Lab test' },
  { id: 'xray', label: 'X-ray' },
  { id: 'ultrasound', label: 'Ultrasound' },
  { id: 'ct', label: 'CT scan' },
  { id: 'other', label: 'Other' },
];

function safeName(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]/g, '_').slice(-60);
}

export default function Records() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [records, setRecords] = useState<RecordRow[] | null>(null);
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<Kind>('lab');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [reloads, setReloads] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      let active = true;
      (async () => {
        const [recs, visits] = await Promise.all([
          supabase
            .from('records')
            .select('id, kind, title, created_at, record_shares(doctor_id), record_findings(finding)')
            .eq('patient_id', userId)
            .order('created_at', { ascending: false }),
          // A result can be shared with any doctor the patient has a visit with.
          supabase.from('appointments').select('doctors(id, display_name)').eq('patient_id', userId),
        ]);
        if (!active) return;
        setRecords((recs.data as unknown as RecordRow[] | null) ?? []);
        const seen = new Map<string, DoctorOption>();
        for (const row of (visits.data as unknown as { doctors: DoctorOption | null }[] | null) ?? []) {
          if (row.doctors) seen.set(row.doctors.id, row.doctors);
        }
        setDoctors([...seen.values()]);
      })();
      return () => {
        active = false;
      };
    }, [userId, reloads]),
  );

  async function upload(file: Picked) {
    if (!userId) return;
    setBusy(true);
    setNotice(null);
    try {
      // Create the record first so the file can be stored under its id, then attach the file path.
      const created = await supabase
        .from('records')
        .insert({ patient_id: userId, kind, title: title.trim() || KINDS.find((k) => k.id === kind)!.label })
        .select('id')
        .single();
      if (created.error) throw created.error;
      const recordId = created.data.id as string;
      const path = `${userId}/${recordId}/${safeName(file.name)}`;
      const body = await (await fetch(file.uri)).arrayBuffer();
      const stored = await supabase.storage.from('records').upload(path, body, { contentType: file.mimeType });
      if (stored.error) {
        await supabase.from('records').delete().eq('id', recordId);
        throw stored.error;
      }
      const saved = await supabase.from('records').update({ storage_paths: [path] }).eq('id', recordId);
      if (saved.error) throw saved.error;
      setTitle('');
      setNotice('Saved. Share it with your doctor so they can see it.');
      setReloads((n) => n + 1);
    } catch {
      // TODO: keep failed uploads on the phone and retry when the network returns.
      setNotice('Could not upload. Check your network and try again.');
    }
    setBusy(false);
  }

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setNotice('Allow camera access to take a photo of your result.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    const asset = result.canceled ? null : result.assets[0];
    if (asset) await upload({ uri: asset.uri, name: asset.fileName ?? 'photo.jpg', mimeType: asset.mimeType ?? 'image/jpeg' });
  }

  async function chooseFile() {
    const result = await DocumentPicker.getDocumentAsync({ type: ['image/*', 'application/pdf'], copyToCacheDirectory: true });
    const asset = result.canceled ? null : result.assets[0];
    if (asset) await upload({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? 'application/octet-stream' });
  }

  async function share(recordId: string, doctorId: string) {
    const { error } = await supabase.from('record_shares').insert({ record_id: recordId, doctor_id: doctorId });
    setSharingId(null);
    if (error && error.code !== '23505') setNotice('Could not share. Check your network and try again.');
    else setReloads((n) => n + 1);
  }

  if (!records) return <Loading />;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <FlatList
        data={records}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={{ gap: 12 }}>
            <Text style={styles.title}>Test results</Text>
            <View style={styles.addCard}>
              <Text style={styles.cardTitle}>Add a result or scan</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="Name, for example Malaria test"
                placeholderTextColor={colors.muted}
                accessibilityLabel="Name of the result"
              />
              <View style={styles.kinds}>
                {KINDS.map((k) => (
                  <Chip key={k.id} label={k.label} selected={k.id === kind} onPress={() => setKind(k.id)} />
                ))}
              </View>
              <View style={styles.buttons}>
                <Button label="Snap a photo" onPress={takePhoto} busy={busy} style={{ flex: 1 }} />
                <Button label="Choose file" variant="outline" onPress={chooseFile} disabled={busy} style={{ flex: 1 }} />
              </View>
              {notice ? <Text style={styles.notice}>{notice}</Text> : null}
            </View>
            <Text style={styles.section}>My results</Text>
          </View>
        }
        ListEmptyComponent={<Text style={styles.empty}>Nothing uploaded yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.meta}>
              {KINDS.find((k) => k.id === item.kind)?.label} ·{' '}
              {new Date(item.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })} ·{' '}
              {item.record_shares.length > 0 ? 'Shared with your doctor' : 'Not shared yet'}
            </Text>
            {item.record_findings.map((f, i) => (
              <Text key={i} style={styles.finding}>
                Doctor: {f.finding}
              </Text>
            ))}
            {sharingId === item.id ? (
              doctors.length === 0 ? (
                <Text style={styles.meta}>Book a visit first, then you can share this with that doctor.</Text>
              ) : (
                <View style={{ gap: 8 }}>
                  {doctors.map((d) => (
                    <Pressable key={d.id} accessibilityRole="button" onPress={() => share(item.id, d.id)} style={styles.doctorPick}>
                      <Text style={styles.doctorPickText}>{d.display_name}</Text>
                    </Pressable>
                  ))}
                </View>
              )
            ) : (
              <Button label="Share with a doctor" variant="outline" onPress={() => setSharingId(item.id)} />
            )}
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  list: { padding: 20, gap: 12 },
  title: { fontSize: 26, fontWeight: '700', color: colors.ink },
  section: { fontSize: 17, fontWeight: '600', color: colors.ink },
  addCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.brand,
    padding: 16,
    gap: 12,
  },
  card: { backgroundColor: colors.card, borderRadius: radius.md, padding: 14, gap: 10 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: colors.ink },
  meta: { fontSize: 13, color: colors.muted, lineHeight: 19 },
  input: {
    height: 48,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.line,
    paddingHorizontal: 14,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: colors.ground,
  },
  kinds: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  buttons: { flexDirection: 'row', gap: 8 },
  notice: { fontSize: 13, color: colors.brandDark, lineHeight: 19 },
  empty: { fontSize: 15, color: colors.muted, textAlign: 'center', marginTop: 16 },
  finding: { fontSize: 13, lineHeight: 19, color: colors.ink, backgroundColor: colors.ground, borderRadius: 12, padding: 10 },
  doctorPick: {
    minHeight: 48,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  doctorPickText: { fontSize: 14, fontWeight: '600', color: colors.brand },
});
