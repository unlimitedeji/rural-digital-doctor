import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { colors } from '@/lib/theme';

function TabLabel({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: 13, fontWeight: focused ? '700' : '600', color: focused ? colors.brand : colors.muted }}>
      {label}
    </Text>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarIcon: () => null,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.line, height: 64 },
      }}
    >
      <Tabs.Screen name="index" options={{ tabBarLabel: ({ focused }) => <TabLabel label="Home" focused={focused} /> }} />
      <Tabs.Screen name="visits" options={{ tabBarLabel: ({ focused }) => <TabLabel label="Visits" focused={focused} /> }} />
    </Tabs>
  );
}
