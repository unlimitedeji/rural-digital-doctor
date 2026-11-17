import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, Loading } from '@/components/ui';
import { needsCode, useAuth } from '@/lib/auth';
import { useProfile } from '@/lib/profile';
import { supabase } from '@/lib/supabase';
import { colors, radius } from '@/lib/theme';

type Factor = { id: string; status: string; factor_type: string };
type Setup = { factorId: string; secret: string; uri: string };

/**
 * Two-step sign-in with an authenticator app (Google Authenticator, Microsoft Authenticator, Authy).
 * - Set up: shows a key for the authenticator app, then checks the first code.
 * - Enter code: asked after the password on accounts that have it on.
 * Admin accounts cannot turn it off; the database refuses admin actions without it.
 */
export default function TwoStep() {
  const router = useRouter();
  const { aal } = useAuth();
  const { profile } = useProfile();
  const [factor, setFactor] = useState<Factor | null | undefined>(undefined);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.auth.mfa.listFactors();
    const verified = (data?.totp ?? [])[0] as Factor | undefined;
    setFactor(verified ?? null);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function startSetup() {
    setBusy(true);
    setNotice(null);
    // Remove any half-finished setup first, so a fresh key can be made.
    const { data: list } = await supabase.auth.mfa.listFactors();
    for (const f of (list?.all ?? []) as Factor[]) {
      if (f.factor_type === 'totp' && f.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Authenticator app' });
    setBusy(false);
    if (error || !data) {
      setNotice({ text: 'Could not start set-up. Check your network and try again.', error: true });
      return;
    }
    setSetup({ factorId: data.id, secret: data.totp.secret, uri: data.totp.uri });
  }

  async function check(factorId: string) {
    const clean = code.replace(/\D/g, '');
    if (clean.length !== 6) {
      setNotice({ text: 'Enter the 6-digit code from your authenticator app.', error: true });
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: clean });
    setBusy(false);
    if (error) {
      setNotice({ text: 'That code is not right, or it has expired. Try the newest code.', error: true });
      return;
    }
    setCode('');
    setSetup(null);
    await load();
    setNotice({ text: 'Done. Two-step sign-in is on for this account.', error: false });
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  async function turnOff() {
    if (!factor) return;
    setBusy(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
    setBusy(false);
    if (error) setNotice({ text: 'Could not turn it off. Enter a code first, then try again.', error: true });
    else {
      await supabase.auth.refreshSession();
      await load();
      setNotice({ text: 'Two-step sign-in is off.', error: false });
    }
  }

  if (factor === undefined) return <Loading />;
  const asking = !!factor && needsCode(aal);
  const isAdmin = profile?.role === 'admin';

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {asking ? (
          <>
            <Text style={styles.title}>Enter your code</Text>
            <Text style={styles.note}>Open your authenticator app and type the 6-digit code for LanDu.</Text>
            <CodeInput value={code} onChange={setCode} />
            <Button label="Continue" onPress={() => check(factor!.id)} busy={busy} />
            <Button label="Sign out" variant="outline" onPress={() => supabase.auth.signOut()} />
          </>
        ) : setup ? (
          <>
            <Text style={styles.title}>Link your authenticator app</Text>
            <Text style={styles.note}>
              1. Install Google Authenticator or Microsoft Authenticator if you do not have one.{'\n'}
              2. Tap "Open authenticator app", or add an account in it and type this key:
            </Text>
            <Card>
              <Text selectable style={styles.secret}>{setup.secret.replace(/(.{4})/g, '$1 ').trim()}</Text>
              <View style={styles.row}>
                <Button label="Copy key" variant="outline" style={{ flex: 1 }} onPress={() => Clipboard.setStringAsync(setup.secret)} />
                <Button
                  label="Open authenticator app"
                  style={{ flex: 1.4 }}
                  onPress={() =>
                    Linking.openURL(setup.uri).catch(() =>
                      setNotice({ text: 'No authenticator app found. Install one, or type the key by hand.', error: true }),
                    )
                  }
                />
              </View>
            </Card>
            <Text style={styles.note}>3. Type the 6-digit code the app shows:</Text>
            <CodeInput value={code} onChange={setCode} />
            <Button label="Turn on two-step sign-in" onPress={() => check(setup.factorId)} busy={busy} />
          </>
        ) : factor ? (
          <>
            <Text style={styles.title}>Two-step sign-in is on</Text>
            <Text style={styles.note}>When you sign in on a new phone, we ask for a code from your authenticator app as well as your password.</Text>
            {isAdmin ? (
              <Text style={styles.note}>Admin accounts must keep it on.</Text>
            ) : (
              <Button label="Turn it off" variant="outline" onPress={turnOff} busy={busy} />
            )}
          </>
        ) : (
          <>
            <Text style={styles.title}>Two-step sign-in</Text>
            <Text style={styles.note}>
              Protect your account with a code from an authenticator app as well as your password. Someone who learns your
              password still cannot get in.
            </Text>
            {isAdmin ? <Text style={[styles.note, { color: colors.amberText }]}>Required for admin accounts before you can review applications.</Text> : null}
            <Button label="Set it up" onPress={startSetup} busy={busy} />
          </>
        )}
        {notice ? <Text style={[styles.notice, { color: notice.error ? colors.danger : colors.brandDark }]}>{notice.text}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function CodeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <TextInput
      value={value}
      onChangeText={(v) => onChange(v.replace(/\D/g, '').slice(0, 6))}
      keyboardType="number-pad"
      textContentType="oneTimeCode"
      autoComplete="one-time-code"
      maxLength={6}
      placeholder="123456"
      placeholderTextColor={colors.muted}
      style={styles.code}
      accessibilityLabel="6-digit code"
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  content: { padding: 20, gap: 14 },
  title: { fontSize: 24, fontWeight: '700', color: colors.ink },
  note: { fontSize: 15, color: colors.muted, lineHeight: 22 },
  secret: { fontSize: 18, fontWeight: '700', color: colors.ink, letterSpacing: 1, textAlign: 'center', marginBottom: 12 },
  row: { flexDirection: 'row', gap: 10 },
  code: {
    height: 60,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.card,
    fontSize: 28,
    letterSpacing: 8,
    textAlign: 'center',
    color: colors.ink,
  },
  notice: { fontSize: 15, lineHeight: 21 },
});
