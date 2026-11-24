import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Loading } from '@/components/ui';
import { AuthProvider, needsCode, useAuth } from '@/lib/auth';
import { LockProvider, useLock } from '@/lib/lock';
import { ProfileProvider, useProfile } from '@/lib/profile';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

function Gate() {
  const { session, loading, aal } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const lock = useLock();
  const segments = useSegments();
  const router = useRouter();
  const mustUnlock = !!session && lock.locked && segments[0] !== 'reset-password';

  // Ask for the fingerprint as soon as the lock screen appears.
  useEffect(() => {
    if (mustUnlock) lock.unlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mustUnlock]);

  useEffect(() => {
    if (loading) return;
    const onSignIn = segments[0] === 'sign-in';
    // The password reset link opens the app before there is a session.
    const onReset = segments[0] === 'reset-password';
    if (!session && !onSignIn && !onReset) router.replace('/sign-in');
    if (session && onSignIn) router.replace('/');
    // Accounts with two-step sign-in must enter a code before anything else.
    if (session && needsCode(aal) && segments[0] !== 'two-step') router.replace('/two-step');
  }, [session, loading, aal, segments, router]);

  // Everyone agrees to the privacy notice and fills in basic details once, before using the app.
  useEffect(() => {
    if (!session || profileLoading || !profile) return;
    const here = segments[0];
    const exempt = here === 'onboarding' || here === 'privacy' || here === 'reset-password' || here === 'two-step';
    if (!profile.consent_at && !exempt) router.replace('/onboarding');
  }, [session, profile, profileLoading, segments, router]);

  if (loading || !lock.ready) return <Loading />;

  if (mustUnlock) {
    return (
      <View style={lockStyles.screen}>
        <Text style={lockStyles.brand}>LanDu</Text>
        <Text style={lockStyles.title}>Locked</Text>
        <Text style={lockStyles.note}>Use your fingerprint to open your health records.</Text>
        <Button label="Unlock" onPress={() => lock.unlock()} style={{ alignSelf: 'stretch' }} />
        <Button label="Sign out" variant="outline" onPress={() => supabase.auth.signOut()} style={{ alignSelf: 'stretch' }} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.ground },
        headerShadowVisible: false,
        headerTintColor: colors.ink,
        headerTitleStyle: { fontWeight: '600' },
        contentStyle: { backgroundColor: colors.ground },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      <Stack.Screen name="auth-callback" options={{ headerShown: false }} />
      <Stack.Screen name="reset-password" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="privacy" options={{ title: 'Privacy notice' }} />
      <Stack.Screen name="two-step" options={{ title: 'Two-step sign-in' }} />
      <Stack.Screen name="invites" options={{ title: 'Invited doctors' }} />
      <Stack.Screen name="call/[id]" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="delete-account" options={{ title: 'Delete my account' }} />
      <Stack.Screen name="join" options={{ title: 'Join as a provider' }} />
      <Stack.Screen name="vitals" options={{ title: 'Vitals' }} />
      <Stack.Screen name="health-record" options={{ title: 'Health record' }} />
      <Stack.Screen name="verify" options={{ title: 'Verify your identity' }} />
      <Stack.Screen name="profile-edit" options={{ title: 'My details' }} />
      <Stack.Screen name="doctors/index" options={{ title: 'Find a doctor' }} />
      <Stack.Screen name="doctors/[id]" options={{ title: 'Book a visit' }} />
      <Stack.Screen name="pay/[appointmentId]" options={{ title: 'Pay for your visit' }} />
      <Stack.Screen name="visit/[id]" options={{ title: 'Visit summary' }} />
      <Stack.Screen name="doctor/visit/[id]" options={{ title: 'Patient visit' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <ProfileProvider>
        <LockProvider>
          <StatusBar style="dark" />
          <Gate />
        </LockProvider>
      </ProfileProvider>
    </AuthProvider>
  );
}

const lockStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  brand: { fontSize: 14, fontWeight: '700', color: colors.brand },
  title: { fontSize: 28, fontWeight: '700', color: colors.ink },
  note: { fontSize: 15, color: colors.muted, textAlign: 'center', lineHeight: 22, marginBottom: 12 },
});
