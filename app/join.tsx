import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Card, Chip, Loading } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { LANGUAGES, PARTNER_KINDS, PROVIDER_TYPES, type ProviderType } from '@/lib/catalog';
import { supabase } from '@/lib/supabase';
import { colors, radius } from '@/lib/theme';

type Kind = 'provider' | 'pharmacy' | 'lab';
type Existing = { status: 'pending' | 'approved' | 'rejected'; review_note: string | null; created_at: string };

function toKobo(naira: string): number | null {
  const n = Number(naira.replace(/[^0-9]/g, ''));
  return Number.isFinite(n) && naira.trim() ? n * 100 : null;
}

export default function Join() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [existing, setExisting] = useState<Existing | null | undefined>(undefined);
  const [kind, setKind] = useState<Kind>('provider');
  const [providerType, setProviderType] = useState<ProviderType>('doctor');
  const [fullName, setFullName] = useState('');
  const [organisation, setOrganisation] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [licence, setLicence] = useState('');
  const [years, setYears] = useState('');
  const [languages, setLanguages] = useState<string[]>(['English']);
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [town, setTown] = useState('');
  const [state, setState] = useState('');
  const [feeVideo, setFeeVideo] = useState('');
  const [feeAudio, setFeeAudio] = useState('');
  const [feeClinic, setFeeClinic] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from('provider_applications')
      .select('status, review_note, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setExisting((data as Existing | null) ?? null));
    supabase.rpc('my_invite').then(({ data }) => {
      const inv = (data as { full_name: string; phone: string | null; mdcn_number: string | null; specialty: string | null }[] | null)?.[0];
      if (!inv) return;
      setFullName((v) => v || inv.full_name.replace(/^Dr\.?\s+/i, ''));
      setPhone((v) => v || inv.phone || '');
      setLicence((v) => v || inv.mdcn_number || '');
      setSpecialty((v) => v || inv.specialty || '');
    });
  }, [userId]);

  const body =
    kind === 'provider'
      ? PROVIDER_TYPES.find((p) => p.id === providerType)!.body
      : PARTNER_KINDS.find((p) => p.id === kind)!.body;

  function toggleLanguage(l: string) {
    setLanguages(languages.includes(l) ? languages.filter((x) => x !== l) : [...languages, l]);
  }

  async function submit() {
    if (!userId) return;
    setError(null);
    if (!fullName.trim() || !licence.trim()) return setError('Enter your full name and licence number.');
    if (kind !== 'provider' && !organisation.trim()) return setError('Enter the name of your pharmacy or lab.');
    const fees = { video: toKobo(feeVideo), audio: toKobo(feeAudio), clinic: toKobo(feeClinic) };
    if (kind === 'provider' && (fees.video == null || fees.audio == null || fees.clinic == null)) {
      return setError('Enter your fee for each kind of visit, in naira.');
    }
    if (!consent) return setError('Tick the box to allow us to check your licence.');
    setBusy(true);
    const { error: err } = await supabase.from('provider_applications').insert({
      user_id: userId,
      kind,
      provider_type: kind === 'provider' ? providerType : null,
      full_name: fullName.trim(),
      organisation_name: kind === 'provider' ? null : organisation.trim(),
      specialty: kind === 'provider' ? specialty.trim() || null : null,
      licence_body: body,
      licence_number: licence.trim(),
      years_experience: years.trim() ? Number(years.replace(/[^0-9]/g, '')) : null,
      languages,
      phone: phone.trim() || null,
      address: address.trim() || null,
      town: town.trim() || null,
      state: state.trim() || null,
      fee_video_kobo: kind === 'provider' ? fees.video : null,
      fee_audio_kobo: kind === 'provider' ? fees.audio : null,
      fee_clinic_kobo: kind === 'provider' ? fees.clinic : null,
      consent_verification: true,
    });
    setBusy(false);
    if (err) {
      setError(err.code === '23505' ? 'You already have an application waiting for review.' : 'Could not send. Check your network and try again.');
      return;
    }
    setExisting({ status: 'pending', review_note: null, created_at: new Date().toISOString() });
  }

  if (existing === undefined) return <Loading />;

  if (existing && existing.status !== 'rejected') {
    return (
      <View style={styles.screen}>
        <View style={styles.content}>
          <Card style={{ gap: 6 }}>
            <Text style={styles.cardTitle}>
              {existing.status === 'pending' ? 'Application received' : 'Application approved'}
            </Text>
            <Text style={styles.meta}>
              {existing.status === 'pending'
                ? 'Our team is checking your licence. You will see your new screens here once you are approved. Close and reopen the app after approval.'
                : 'You are approved. Close and reopen the app to see your screens.'}
            </Text>
          </Card>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {existing?.status === 'rejected' ? (
        <Card style={{ gap: 4 }}>
          <Text style={styles.cardTitle}>Your last application was not approved</Text>
          {existing.review_note ? <Text style={styles.meta}>{existing.review_note}</Text> : null}
          <Text style={styles.meta}>You can correct your details and apply again below.</Text>
        </Card>
      ) : null}

      <Text style={styles.heading}>I am joining as</Text>
      <View style={styles.wrap}>
        <Chip label="Health worker" selected={kind === 'provider'} onPress={() => setKind('provider')} />
        {PARTNER_KINDS.map((p) => (
          <Chip key={p.id} label={p.label} selected={kind === p.id} onPress={() => setKind(p.id)} />
        ))}
      </View>

      {kind === 'provider' ? (
        <>
          <Text style={styles.heading}>Profession</Text>
          <View style={styles.wrap}>
            {PROVIDER_TYPES.map((p) => (
              <Chip key={p.id} label={p.label} selected={providerType === p.id} onPress={() => setProviderType(p.id)} />
            ))}
          </View>
        </>
      ) : null}

      <Field label="Your full name, as on your licence" value={fullName} onChange={setFullName} />
      {kind !== 'provider' ? (
        <Field label={kind === 'pharmacy' ? 'Pharmacy name' : 'Lab name'} value={organisation} onChange={setOrganisation} />
      ) : (
        <Field label="Specialty (optional)" value={specialty} onChange={setSpecialty} placeholder="For example General practice" />
      )}
      <Field label={`${body} licence number`} value={licence} onChange={setLicence} />
      {kind === 'provider' ? <Field label="Years of experience" value={years} onChange={setYears} keyboard="number-pad" /> : null}
      <Field label="Phone number" value={phone} onChange={setPhone} keyboard="phone-pad" />
      {kind !== 'provider' ? <Field label="Street address" value={address} onChange={setAddress} /> : null}
      <Field label="Town" value={town} onChange={setTown} />
      <Field label="State" value={state} onChange={setState} />

      {kind === 'provider' ? (
        <>
          <Text style={styles.heading}>Languages you consult in</Text>
          <View style={styles.wrap}>
            {LANGUAGES.map((l) => (
              <Chip key={l} label={l} selected={languages.includes(l)} onPress={() => toggleLanguage(l)} />
            ))}
          </View>
          <Text style={styles.heading}>Your fees, in naira</Text>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Field label="Video" value={feeVideo} onChange={setFeeVideo} keyboard="number-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Audio" value={feeAudio} onChange={setFeeAudio} keyboard="number-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Clinic" value={feeClinic} onChange={setFeeClinic} keyboard="number-pad" />
            </View>
          </View>
        </>
      ) : null}

      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: consent }}
        onPress={() => setConsent(!consent)}
        style={styles.checkRow}
      >
        <View style={[styles.box, consent && styles.boxOn]}>{consent ? <Text style={styles.tick}>✓</Text> : null}</View>
        <Text style={styles.checkText}>
          I confirm these details are true and allow LanDu to check my licence with the {body}.
        </Text>
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label="Send application" onPress={submit} busy={busy} />
    </ScrollView>
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
  keyboard?: 'phone-pad' | 'number-pad';
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
  content: { padding: 20, gap: 12 },
  heading: { fontSize: 14, fontWeight: '600', color: colors.ink, marginTop: 4 },
  label: { fontSize: 13, fontWeight: '600', color: colors.ink },
  cardTitle: { fontSize: 15, fontWeight: '600', color: colors.ink },
  meta: { fontSize: 13, color: colors.muted, lineHeight: 19 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: { flexDirection: 'row', gap: 8 },
  input: {
    height: 50,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    fontSize: 15,
    color: colors.ink,
  },
  checkRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', minHeight: 44, marginTop: 4 },
  box: { width: 26, height: 26, borderRadius: 6, borderWidth: 2, borderColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: colors.brand },
  tick: { color: '#FFFFFF', fontWeight: '700' },
  checkText: { flex: 1, fontSize: 14, lineHeight: 20, color: colors.ink },
  error: { fontSize: 14, color: colors.danger, lineHeight: 20 },
});
