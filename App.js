import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import NewsScreen from './src/screens/NewsScreen';
import JudgmentsScreen from './src/screens/JudgmentsScreen';
import { theme } from './src/theme';

const TABS = [
  { key: 'news', label: 'News', icon: '📰', Screen: NewsScreen },
  { key: 'judgments', label: 'Judgments', icon: '📂', Screen: JudgmentsScreen },
];

export default function App() {
  const [active, setActive] = useState('news');
  const Current = TABS.find((t) => t.key === active).Screen;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <View style={styles.screen}>
        <Current />
      </View>
      <View style={styles.tabBar}>
        {TABS.map((t) => {
          const on = t.key === active;
          return (
            <TouchableOpacity
              key={t.key}
              style={styles.tab}
              onPress={() => setActive(t.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.icon, { opacity: on ? 1 : 0.5 }]}>{t.icon}</Text>
              <Text style={[styles.tabLabel, on && styles.tabLabelActive]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  screen: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: theme.colors.tabBar,
    paddingBottom: 24,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#1e2c44',
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 22, marginBottom: 3 },
  tabLabel: { color: theme.colors.tabInactive, fontSize: 12, fontWeight: '600' },
  tabLabelActive: { color: theme.colors.accent, fontWeight: '800' },
});
