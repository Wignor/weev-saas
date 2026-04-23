import { Tabs } from 'expo-router';
import { colors } from '@/constants/colors';

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    index: '🗺️',
    veiculos: '🚗',
    historico: '📍',
  };
  return null; // icons handled via tabBarIcon below
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Mapa',
          tabBarIcon: ({ focused }) => (
            <TabIconEmoji emoji="🗺️" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="veiculos"
        options={{
          title: 'Veículos',
          tabBarIcon: ({ focused }) => (
            <TabIconEmoji emoji="🚗" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="historico"
        options={{
          title: 'Histórico',
          tabBarIcon: ({ focused }) => (
            <TabIconEmoji emoji="📍" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

function TabIconEmoji({ emoji, focused }: { emoji: string; focused: boolean }) {
  const { Text } = require('react-native');
  return (
    <Text style={{ fontSize: focused ? 22 : 20, opacity: focused ? 1 : 0.55 }}>
      {emoji}
    </Text>
  );
}
