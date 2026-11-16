import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PasswordInput } from '@/components/PasswordInput';
import { Button } from '@/components/ui';
import { googleSignInAvailable, signInWithGoogle } from '@/lib/google';
import { authMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { colors, radius } from '@/lib/theme';

export default function SignIn() {
  const [creating, setCreating] = useState(false);
  // Health workers, pharmacies and labs go straight to the application after their first sign-in.
  const [asProvider, setAsProvider] = useState(false);
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
    if (creating) await AsyncStorage.setItem(JOIN_FLAG, asProvider ? 'yes' : 'no');
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
      if (error) {
        setNotice({ text: authMessage(error, true), error: true });
      } else if (!data.session) {
        // Same answer whether or not the email already has an account, so nobody can find out who uses Landu.
        setNotice({ text: 'Check your email for our link, then sign in. Already have an account? Sign in, or tap Forgot password.', error: false });
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        setNotice({ text: authMessage(error, false), error: true });
      }
    }
    setBusy(false);
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.brand}>Rural Digital Doctor</Text>
          <Text style={styles.title}>
            {creating ? (asProvider ? 'Join as a health worker' : 'Create your account') : 'Welcome back'}
          </Text>
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
              <PasswordInput value={password} onChangeText={setPassword} label="Password" />
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

          <View style={styles.providerCard}>
            <Text style={styles.providerTitle}>Doctor, nurse, pharmacy or lab?</Text>
            <Text style={styles.providerText}>
              Create your account here, then send your licence details. We check them before you can see patients.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setCreating(true);
                setAsProvider(true);
                setNotice(null);
              }}
              style={styles.providerButton}
            >
              <Text style={styles.providerButtonText}>Join as a health worker or partner</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export const JOIN_FLAG = 'rdd.joinAfterSignup';

const styles = StyleSheet.create({
  providerCard: { marginTop: 24, backgroundColor: colors.card, borderRadius: 18, padding: 16, gap: 8 },
  providerTitle: { fontSize: 16, fontWeight: '700', color: colors.ink },
  providerText: { fontSize: 14, lineHeight: 20, color: colors.muted },
  providerButton: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    marginTop: 4,
  },
  providerButtonText: { fontSize: 15, fontWeight: '600', color: colors.brand },
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
