import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Image, SafeAreaView,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { fetchNews, SOURCES, JURISDICTIONS } from '../feeds';
import { theme } from '../theme';

const JUR_TABS = [
  { key: 'ALL', label: 'All' },
  { key: 'MY', label: '🇲🇾 Malaysia' },
  { key: 'UK', label: '🇬🇧 UK' },
];

function timeAgo(ts) {
  if (!ts) return '';
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export default function NewsScreen() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [legalOnly, setLegalOnly] = useState(true);
  const [jur, setJur] = useState('ALL');
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchNews(legalOnly, jur);
      setItems(data);
    } catch (e) {
      setError('Could not load news. Pull down to retry.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [legalOnly, jur]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const open = (url) => {
    if (url) WebBrowser.openBrowserAsync(url);
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.card} activeOpacity={0.8} onPress={() => open(item.link)}>
      {item.image ? <Image source={{ uri: item.image }} style={styles.thumb} /> : null}
      <View style={styles.cardBody}>
        <View style={styles.metaRow}>
          <Text style={styles.source} numberOfLines={1}>
            {JURISDICTIONS[item.jurisdiction]?.flag} {item.source}
          </Text>
          <Text style={styles.time}>{timeAgo(item.ts)}</Text>
        </View>
        <Text style={styles.title}>{item.title}</Text>
        {item.summary ? (
          <Text style={styles.summary} numberOfLines={3}>{item.summary}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>LegalPulse</Text>
          <Text style={styles.subtitle}>Malaysia & UK legal news</Text>
        </View>
        <View style={styles.toggle}>
          <TouchableOpacity
            style={[styles.toggleBtn, legalOnly && styles.toggleActive]}
            onPress={() => setLegalOnly(true)}
          >
            <Text style={[styles.toggleText, legalOnly && styles.toggleTextActive]}>Legal</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, !legalOnly && styles.toggleActive]}
            onPress={() => setLegalOnly(false)}
          >
            <Text style={[styles.toggleText, !legalOnly && styles.toggleTextActive]}>All</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.jurRow}>
        {JUR_TABS.map((j) => {
          const on = j.key === jur;
          return (
            <TouchableOpacity
              key={j.key}
              style={[styles.chip, on && styles.chipActive]}
              onPress={() => setJur(j.key)}
              activeOpacity={0.8}
            >
              <Text style={[styles.chipText, on && styles.chipTextActive]}>{j.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
          <Text style={styles.dim}>Fetching latest stories…</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.accent} />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.dim}>
                {error || (legalOnly
                  ? 'No legal stories right now. Tap “All”, or pull to refresh.'
                  : 'No stories found. Pull to refresh.')}
              </Text>
            </View>
          }
          ListFooterComponent={
            items.length ? (
              <Text style={styles.footer}>
                Sources: {SOURCES.map((s) => s.name).join(' · ')}
              </Text>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 14,
  },
  brand: { color: theme.colors.textOnDark, fontSize: 26, fontWeight: '800', letterSpacing: 0.3 },
  subtitle: { color: theme.colors.accent, fontSize: 13, fontWeight: '600', marginTop: 2 },
  toggle: {
    flexDirection: 'row', backgroundColor: theme.colors.surface, borderRadius: 20, padding: 3,
  },
  toggleBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 18 },
  toggleActive: { backgroundColor: theme.colors.accent },
  toggleText: { color: theme.colors.tabInactive, fontWeight: '700', fontSize: 13 },
  toggleTextActive: { color: theme.colors.bg },
  jurRow: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 6, gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: 'transparent',
  },
  chipActive: { borderColor: theme.colors.accent, backgroundColor: '#1c2f49' },
  chipText: { color: theme.colors.tabInactive, fontWeight: '700', fontSize: 13 },
  chipTextActive: { color: theme.colors.textOnDark },
  list: { padding: 16, paddingBottom: 32 },
  card: {
    backgroundColor: theme.colors.card, borderRadius: theme.radius, marginBottom: 14,
    overflow: 'hidden', elevation: 2, shadowColor: '#000', shadowOpacity: 0.15,
    shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  thumb: { width: '100%', height: 160, backgroundColor: theme.colors.line },
  cardBody: { padding: 14 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  source: { color: theme.colors.accentDark, fontWeight: '700', fontSize: 12, flexShrink: 1, marginRight: 8 },
  time: { color: theme.colors.muted, fontSize: 12 },
  title: { color: theme.colors.text, fontSize: 16, fontWeight: '700', lineHeight: 22 },
  summary: { color: theme.colors.muted, fontSize: 13, marginTop: 6, lineHeight: 19 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, minHeight: 300 },
  dim: { color: theme.colors.tabInactive, marginTop: 12, textAlign: 'center', lineHeight: 20 },
  footer: { color: theme.colors.tabInactive, fontSize: 11, textAlign: 'center', marginTop: 6 },
});
