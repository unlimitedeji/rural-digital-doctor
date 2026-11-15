import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Card, Loading } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { colors, radius } from '@/lib/theme';
import { safeFileName, uploadFile } from '@/lib/upload';

type Picked = { uri: string; name: string; mimeType: string };
type Existing = { status: 'pending' | 'approved' | 'rejected'; review_note: string | null };

export default function Verify() {
  const { session } = useAuth();
  const router = useRouter();
  const userId = session?.user.id;
  const [existing, setExisting] = useState<Existing | null | undefined>(undefined);
  const [address, setAddress] = useState('');
  const [proof, setProof] = useState<Picked | null>(null);
  const [selfie, setSelfie] = useState<Picked | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from('identity_verifications')
      .select('status, review_note')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setExisting((data as Existing | null) ?? null));
  }, [userId]);

  async function pickProof() {
    const result = await DocumentPicker.getDocumentAsync({ type: ['image/*', 'application/pdf'], copyToCacheDirectory: true });
    const a = result.canceled ? null : result.assets[0];
    if (a) setProof({ uri: a.uri, name: a.name, mimeType: a.mimeType ?? 'application/octet-stream' });
  }

  async function takeSelfie() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError('Allow camera access to take your selfie.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.6, cameraType: ImagePicker.CameraType.front });
    const a = result.canceled ? null : result.assets[0];
    if (a) setSelfie({ uri: a.uri, name: a.fileName ?? 'selfie.jpg', mimeType: a.mimeType ?? 'image/jpeg' });
  }

  async function submit() {
    if (!userId || !proof || !selfie || !address.trim()) return;
    setBusy(true);
    setError(null);
    const stamp = Date.now();
    const proofPath = `${userId}/${stamp}-proof-${safeFileName(proof.name)}`;
    const selfiePath = `${userId}/${stamp}-selfie-${safeFileName(selfie.name)}`;
    const failed =
      (await uploadFile('identity', proofPath, proof.uri, proof.mimeType)) ??
      (await uploadFile('identity', selfiePath, selfie.uri, selfie.mimeType));
    if (failed) {
      setBusy(false);
      setError(failed);
      return;
    }
    const { error: err } = await supabase
      .from('identity_verifications')
      .insert({ user_id: userId, address: address.trim(), proof_path: proofPath, selfie_path: selfiePath });
    setBusy(false);
    if (err) {
      setError(err.code === '23505' ? 'You already have a check waiting for review.' : 'Could not send. Check your network and try again.');
      return;
    }
    setExisting({ status: 'pending', review_note: null });
  }

  if (existing === undefined) return <Loading />;

  if (existing && existing.status !== 'rejected') {
    return (
      <View style={styles.screen}>
        <View style={styles.content}>
          <Card style={{ gap: 6 }}>
            <Text style={styles.cardTitle}>{existing.status === 'pending' ? 'Sent for review' : 'You are verified'}</Text>
            <Text style={styles.meta}>
              {existing.status === 'pending'
                ? 'Our team will check your details soon. Your profile will show Verified once approved.'
                : 'Thank you. Your identity has been checked.'}
            </Text>
          </Card>
          <Button label="Back" variant="outline" onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.lead}>
        This is optional, but it helps keep your care safe. Add your address, a proof of address and a clear selfie.
      </Text>
      {existing?.status === 'rejected' ? (
        <Card style={{ gap: 4 }}>
          <Text style={styles.cardTitle}>Your last check was not approved</Text>
          {existing.review_note ? <Text style={styles.meta}>{existing.review_note}</Text> : null}
        </Card>
      ) : null}

      <Text style={styles.label}>Your address</Text>
      <TextInput
        style={styles.input}
        value={address}
        onChangeText={setAddress}
        placeholder="House number, street, town"
        placeholderTextColor={colors.muted}
        accessibilityLabel="Your address"
      />

      <Text style={styles.label}>Proof of address</Text>
      <Pressable accessibilityRole="button" onPress={pickProof} style={styles.drop}>
        <Text style={styles.dropText}>
          {proof ? `Chosen: ${proof.name}` : 'Tap to choose a utility bill, bank statement or community letter'}
        </Text>
      </Pressable>

      <Text style={styles.label}>Clear selfie</Text>
      <Pressable accessibilityRole="button" onPress={takeSelfie} style={styles.drop}>
        <Text style={styles.dropText}>{selfie ? 'Selfie taken. Tap to retake' : 'Tap to take a photo'}</Text>
      </Pressable>

      <Text style={styles.meta}>Only our verification team can see these documents.</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label="Submit for review" onPress={submit} busy={busy} disabled={!address.trim() || !proof || !selfie} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  content: { padding: 20, gap: 12 },
  lead: { fontSize: 15, color: colors.muted, lineHeight: 22 },
  label: { fontSize: 15, fontWeight: '600', color: colors.ink, marginTop: 4 },
  input: {
    height: 52,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    fontSize: 15,
    color: colors.ink,
  },
  drop: {
    minHeight: 96,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  dropText: { fontSize: 15, fontWeight: '600', color: colors.brand, textAlign: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '600', color: colors.ink },
  meta: { fontSize: 13, color: colors.muted, lineHeight: 19 },
  error: { fontSize: 14, color: colors.danger },
});
