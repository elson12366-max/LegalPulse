import { useState, useMemo, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import bundledManifest from '../data/judgments.json';
import { REMOTE_MANIFEST_URL } from '../config';
import { theme } from '../theme';

const COURTS = {
  FC: { label: 'Federal Court', short: 'FC', color: theme.colors.accent },
  COA: { label: 'Court of Appeal', short: 'COA', color: '#378add' },
  HC: { label: 'High Court', short: 'HC', color: '#1d9e75' },
};

const FILTERS = [
  { key: 'ALL', label: 'All' },
  { key: 'FC', label: 'Federal' },
  { key: 'COA', label: 'Appeal' },
  { key: 'HC', label: 'High Court' },
];

function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d} ${months[Number(m) - 1]} ${y}`;
}

function updatedAgo(iso) {
  if (!iso) return '';
  const hrs = Math.round((Date.now() - Date.parse(iso)) / 3600000);
  if (hrs < 1) return 'updated just now';
  if (hrs < 24) return `updated ${hrs}h ago`;
  return `updated ${Math.round(hrs / 24)}d ago`;
}

export default function OfficialJudgments() {
  const [filter, setFilter] = useState('ALL');
  const [manifest, setManifest] = useState(bundledManifest);

  // On mount, try to pull the freshest list from the hosted URL (if configured).
  // Falls back silently to the bundled copy on any failure / when offline.
  useEffect(() => {
    if (!REMOTE_MANIFEST_URL) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`${REMOTE_MANIFEST_URL}?t=${Date.now()}`);
        if (!res.ok) return;
        const data = await res.json();
        if (alive && data?.judgments?.length) setManifest(data);
      } catch (e) {
        /* keep bundled data */
      }
    })();
    return () => { alive = false; };
  }, []);

  const items = useMemo(() => {
    const all = manifest.judgments || [];
    return filter === 'ALL' ? all : all.filter((j) => j.jurisdiction === filter);
  }, [filter, manifest]);

  const open = (j) => {
    const url = j.docs?.[0]?.pdfUrl;
    if (url) WebBrowser.openBrowserAsync(url);
  };

  const renderItem = ({ item }) => {
    const c = COURTS[item.jurisdiction] || { label: item.court, short: item.jurisdiction, color: theme.colors.muted };
    const hasPdf = item.docs && item.docs.length > 0;
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={hasPdf ? 0.8 : 1}
        onPress={() => hasPdf && open(item)}
      >
        <View style={styles.topRow}>
          <View style={[styles.badge, { backgroundColor: c.color }]}>
            <Text style={styles.badgeText}>{c.short}</Text>
          </View>
          <Text style={styles.date}>{fmtDate(item.dateOfResult)}</Text>
        </View>
        <Text style={styles.caseNo}>{item.caseNo}</Text>
        <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
        {item.catchwords ? (
          <Text style={styles.catchwords} numberOfLines={3}>{item.catchwords}</Text>
        ) : null}
        <View style={styles.footerRow}>
          {item.judge ? <Text style={styles.judge} numberOfLines={1}>⚖  {item.judge}</Text> : <View />}
          {hasPdf ? (
            <Text style={styles.pdfTag}>📄 PDF</Text>
          ) : (
            <Text style={styles.noPdf}>grounds pending</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.filterRow}>
        {FILTERS.map((f) => {
          const on = f.key === filter;
          return (
            <TouchableOpacity
              key={f.key}
              style={[styles.chip, on && styles.chipOn]}
              onPress={() => setFilter(f.key)}
              activeOpacity={0.8}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Text style={styles.sourceNote}>
            Latest from the Malaysian E-Judgment portal · {updatedAgo(manifest.updatedAt)}
          </Text>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.dim}>No judgments for this court yet.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  filterRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  chip: {
    paddingHorizontal: 13, paddingVertical: 7, borderRadius: 18,
    backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: 'transparent',
  },
  chipOn: { borderColor: theme.colors.accent, backgroundColor: '#1c2f49' },
  chipText: { color: theme.colors.tabInactive, fontWeight: '700', fontSize: 12 },
  chipTextOn: { color: theme.colors.textOnDark },
  list: { padding: 16, paddingTop: 4, paddingBottom: 32 },
  sourceNote: { color: theme.colors.tabInactive, fontSize: 12, marginBottom: 12, lineHeight: 17 },
  card: {
    backgroundColor: theme.colors.card, borderRadius: theme.radius, padding: 14, marginBottom: 12,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 5, shadowOffset: { width: 0, height: 2 },
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  badge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 6 },
  badgeText: { color: '#0f1b2d', fontWeight: '800', fontSize: 11 },
  date: { color: theme.colors.muted, fontSize: 12, fontWeight: '600' },
  caseNo: { color: theme.colors.accentDark, fontSize: 12, fontWeight: '700', marginBottom: 3 },
  title: { color: theme.colors.text, fontSize: 15, fontWeight: '700', lineHeight: 20 },
  catchwords: { color: theme.colors.muted, fontSize: 12.5, marginTop: 6, lineHeight: 18 },
  footerRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.line, paddingTop: 8,
  },
  judge: { color: theme.colors.muted, fontSize: 12, flexShrink: 1, marginRight: 8 },
  pdfTag: { color: theme.colors.danger, fontSize: 12, fontWeight: '700' },
  noPdf: { color: theme.colors.tabInactive, fontSize: 11, fontStyle: 'italic' },
  empty: { alignItems: 'center', padding: 40 },
  dim: { color: theme.colors.tabInactive },
});
