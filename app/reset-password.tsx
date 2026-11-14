import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { colors, radius } from '@/lib/theme';

// The password reset email opens the app here. The link carries a one-time session after the '#'.
export default function ResetPassword() {
  const url = Linking.useURL();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);

  useEffect(() => {
    if (!url || ready) return;
    const fragment = url.split('#')[1] ?? '';
    const params = new URLSearchParams(fragment);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    if (!accessToken || !refreshToken) {
      setNotice({ text: params.get('error_description') ?? 'This reset link is not valid. Ask for a new one.', error: true });
      return;
    }
    supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).then(({ error }) => {
      if (error) setNotice({ text: 'This reset link has expired. Ask for a new one.', error: true });
      else setReady(true);
    });
  }, [url, ready]);

  async function save() {
    if (password.length < 8) {
      setNotice({ text: 'The password needs at least 8 characters.', error: true });
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) setNotice({ text: 'Could not save the new password. Please try again.', error: true });
    else router.replace('/');
  }

  return (
    <SafeAreaView style={styles.screen}>
      <Text style={styles.brand}>Rural Digital Doctor</Text>
      <Text style={styles.title}>Choose a new password</Text>
      {ready ? (
        <View style={styles.form}>
          <Text style={styles.label}>New password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            accessibilityLabel="New password"
          />
          <Button label="Save password" onPress={save} busy={busy} />
        </View>
      ) : null}
      {notice ? <Text style={[styles.notice, { color: notice.error ? colors.danger : colors.brandDark }]}>{notice.text}</Text> : null}
      {!ready ? <Button label="Back to sign in" variant="outline" onPress={() => router.replace('/sign-in')} /> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground, padding: 24, paddingTop: 48, gap: 12 },
  brand: { fontSize: 14, fontWeight: '700', color: colors.brand },
  title: { fontSize: 28, fontWeight: '700', color: colors.ink },
  form: { gap: 10, marginTop: 12 },
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
  notice: { fontSize: 14, lineHeight: 20 },
});
