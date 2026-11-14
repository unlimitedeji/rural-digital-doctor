import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui';
import { googleSignInAvailable, signInWithGoogle } from '@/lib/google';
import { supabase } from '@/lib/supabase';
import { colors, radius } from '@/lib/theme';

export default function SignIn() {
  const [creating, setCreating] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const [googleReady, setGoogleReady] = useState(false);

  useEffect(() => {
    googleSignInAvailable().then(setGoogleReady);
  }, []);

  async function forgot() {
    setNotice(null);
    if (!email.trim()) {
      setNotice({ text: 'Type your email above first, then tap Forgot password.', error: true });
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: Linking.createURL('reset-password'),
    });
    setBusy(false);
    setNotice(
      error
        ? { text: 'Could not send the reset email. Wait a few minutes and try again.', error: true }
        : { text: 'If that email has an account, a reset link is on its way. Open it on this phone.', error: false },
    );
  }

  async function google() {
    setNotice(null);
    setBusy(true);
    const error = await signInWithGoogle();
    setBusy(false);
    if (error) setNotice({ text: error, error: true });
  }

  async function submit() {
    setNotice(null);
    if (!email.trim() || password.length < 8 || (creating && !fullName.trim())) {
      setNotice({ text: 'Enter your details. The password needs at least 8 characters.', error: true });
      return;
    }
    setBusy(true);
    if (creating) {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: fullName.trim() } },
      });
      if (error) setNotice({ text: error.message, error: true });
      else if (data.user && data.user.identities?.length === 0) {
        // Supabase sends no email when the address already has an account.
        setCreating(false);
        setNotice({ text: 'This email already has an account. Sign in, or tap Forgot password.', error: true });
      } else if (!data.session) setNotice({ text: 'Check your email and tap the link to finish, then sign in.', error: false });
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        setNotice({
          text: error.message.includes('Invalid login')
            ? 'Wrong email or password. Tap Forgot password to choose a new one.'
            : error.message,
          error: true,
        });
      }
    }
    setBusy(false);
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.brand}>Rural Digital Doctor</Text>
          <Text style={styles.title}>{creating ? 'Create your account' : 'Welcome back'}</Text>
          <Text style={styles.lead}>See a licensed doctor from wherever you are.</Text>

          <View style={styles.form}>
            {creating ? (
              <View style={styles.field}>
                <Text style={styles.label}>Full name</Text>
                <TextInput
                  style={styles.input}
                  value={fullName}
                  onChangeText={setFullName}
                  autoCapitalize="words"
                  autoComplete="name"
                  accessibilityLabel="Full name"
                />
              </View>
            ) : null}
            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                accessibilityLabel="Email"
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                accessibilityLabel="Password"
              />
            </View>

            {notice ? (
              <Text style={[styles.notice, { color: notice.error ? colors.danger : colors.brandDark }]}>{notice.text}</Text>
            ) : null}

            <Button label={creating ? 'Create account' : 'Sign in'} onPress={submit} busy={busy} />
            {googleReady ? <Button label="Continue with Google" variant="outline" onPress={google} disabled={busy} /> : null}
            {!creating ? (
              <Pressable accessibilityRole="button" onPress={forgot} disabled={busy} style={styles.switch}>
                <Text style={styles.switchText}>Forgot password?</Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setCreating(!creating);
                setNotice(null);
              }}
              style={styles.switch}
            >
              <Text style={styles.switchText}>
                {creating ? 'I already have an account' : 'New here? Create an account'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  content: { padding: 24, paddingTop: 48, gap: 8 },
  brand: { fontSize: 14, fontWeight: '700', color: colors.brand },
  title: { fontSize: 28, fontWeight: '700', color: colors.ink },
  lead: { fontSize: 15, color: colors.muted, lineHeight: 22 },
  form: { marginTop: 24, gap: 16 },
  field: { gap: 6 },
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
  switch: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  switchText: { fontSize: 15, fontWeight: '600', color: colors.brand },
});
