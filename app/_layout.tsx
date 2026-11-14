import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Loading } from '@/components/ui';
import { AuthProvider, useAuth } from '@/lib/auth';
import { LockProvider, useLock } from '@/lib/lock';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

function Gate() {
  const { session, loading } = useAuth();
  const lock = useLock();
  const segments = useSegments();
  const router = useRouter();
  const mustUnlock = !!session && lock.locked;

  // Ask for the fingerprint as soon as the lock screen appears.
  useEffect(() => {
    if (mustUnlock) lock.unlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mustUnlock]);

  useEffect(() => {
    if (loading) return;
    const onSignIn = segments[0] === 'sign-in';
    if (!session && !onSignIn) router.replace('/sign-in');
    if (session && onSignIn) router.replace('/');
  }, [session, loading, segments, router]);

  if (loading || !lock.ready) return <Loading />;

  if (mustUnlock) {
    return (
      <View style={lockStyles.screen}>
        <Text style={lockStyles.brand}>Rural Digital Doctor</Text>
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
      <LockProvider>
        <StatusBar style="dark" />
        <Gate />
      </LockProvider>
    </AuthProvider>
  );
}

const lockStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  brand: { fontSize: 14, fontWeight: '700', color: colors.brand },
  title: { fontSize: 28, fontWeight: '700', color: colors.ink },
  note: { fontSize: 15, color: colors.muted, textAlign: 'center', lineHeight: 22, marginBottom: 12 },
});
