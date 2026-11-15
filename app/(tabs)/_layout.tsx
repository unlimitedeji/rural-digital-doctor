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

  const role = profile?.role ?? 'patient';
  // A tab with href null is hidden. Each role sees only its own tabs; admins also use the patient tabs.
  const show = (roles: string[]) => (roles.includes(role) ? {} : { href: null });
  const patientTabs = ['patient', 'admin'];

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarIcon: () => null,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.line, height: 64 },
      }}
    >
      <Tabs.Screen name="index" options={{ tabBarLabel: label('Home'), ...show(patientTabs) }} />
      <Tabs.Screen name="visits" options={{ tabBarLabel: label('Visits'), ...show(patientTabs) }} />
      <Tabs.Screen name="records" options={{ tabBarLabel: label('Records'), ...show(patientTabs) }} />
      <Tabs.Screen name="wallet" options={{ tabBarLabel: label('Wallet'), ...show(patientTabs) }} />
      <Tabs.Screen name="review" options={{ tabBarLabel: label('Review'), ...show(['admin']) }} />
      <Tabs.Screen name="queue" options={{ tabBarLabel: label('Queue'), ...show(['doctor']) }} />
      <Tabs.Screen name="schedule" options={{ tabBarLabel: label('Schedule'), ...show(['doctor']) }} />
      <Tabs.Screen name="orders" options={{ tabBarLabel: label('Orders'), ...show(['partner']) }} />
    </Tabs>
  );
}
