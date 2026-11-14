import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { Loading } from '@/components/ui';
import { useProfile } from '@/lib/profile';
import { colors } from '@/lib/theme';

function label(text: string) {
  return ({ focused }: { focused: boolean }) => (
    <Text style={{ fontSize: 13, fontWeight: focused ? '700' : '600', color: focused ? colors.brand : colors.muted }}>
      {text}
    </Text>
  );
}

export default function TabsLayout() {
  const { profile, loading } = useProfile();
  if (loading) return <Loading />;

  const isDoctor = profile?.role === 'doctor';
  // A tab with href null is hidden. Patients and doctors each see only their own tabs.
  const patientOnly = isDoctor ? { href: null } : {};
  const doctorOnly = isDoctor ? {} : { href: null };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarIcon: () => null,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.line, height: 64 },
      }}
    >
      <Tabs.Screen name="index" options={{ tabBarLabel: label('Home'), ...patientOnly }} />
      <Tabs.Screen name="visits" options={{ tabBarLabel: label('Visits'), ...patientOnly }} />
      <Tabs.Screen name="records" options={{ tabBarLabel: label('Records'), ...patientOnly }} />
      <Tabs.Screen name="wallet" options={{ tabBarLabel: label('Wallet'), ...patientOnly }} />
      <Tabs.Screen name="queue" options={{ tabBarLabel: label('Queue'), ...doctorOnly }} />
      <Tabs.Screen name="schedule" options={{ tabBarLabel: label('Schedule'), ...doctorOnly }} />
    </Tabs>
  );
}
