import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { Text } from 'react-native';
import { Loading } from '@/components/ui';
import { useProfile } from '@/lib/profile';
import { colors } from '@/lib/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

function icon(name: string) {
  return ({ focused }: { focused: boolean }) => (
    <Ionicons
      name={(focused ? name : `${name}-outline`) as IconName}
      size={24}
      color={focused ? colors.brand : colors.muted}
    />
  );
}

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
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.line, height: 72, paddingTop: 6 },
      }}
    >
      <Tabs.Screen name="index" options={{ tabBarIcon: icon('home'), tabBarLabel: label('Home'), ...show(patientTabs) }} />
      <Tabs.Screen name="visits" options={{ tabBarIcon: icon('calendar'), tabBarLabel: label('Visits'), ...show(patientTabs) }} />
      <Tabs.Screen name="records" options={{ tabBarIcon: icon('document-text'), tabBarLabel: label('Records'), ...show(patientTabs) }} />
      <Tabs.Screen name="wallet" options={{ tabBarIcon: icon('wallet'), tabBarLabel: label('Wallet'), ...show(patientTabs) }} />
      <Tabs.Screen name="review" options={{ tabBarIcon: icon('shield-checkmark'), tabBarLabel: label('Review'), ...show(['admin']) }} />
      <Tabs.Screen name="queue" options={{ tabBarIcon: icon('people'), tabBarLabel: label('Queue'), ...show(['doctor']) }} />
      <Tabs.Screen name="schedule" options={{ tabBarIcon: icon('time'), tabBarLabel: label('Schedule'), ...show(['doctor']) }} />
      <Tabs.Screen name="orders" options={{ tabBarIcon: icon('receipt'), tabBarLabel: label('Orders'), ...show(['partner']) }} />
    </Tabs>
  );
}
