import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Loading } from '@/components/ui';
import { AuthProvider, useAuth } from '@/lib/auth';
import { colors } from '@/lib/theme';

function Gate() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const onSignIn = segments[0] === 'sign-in';
    if (!session && !onSignIn) router.replace('/sign-in');
    if (session && onSignIn) router.replace('/');
  }, [session, loading, segments, router]);

  if (loading) return <Loading />;

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
      <StatusBar style="dark" />
      <Gate />
    </AuthProvider>
  );
}
