import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Alert, SafeAreaView, ActivityIndicator,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import OfficialJudgments from './OfficialJudgments';
import { theme } from '../theme';

const STORE_KEY = 'legalpulse.judgments.v1';
const DIR = FileSystem.documentDirectory + 'judgments/';

function fmtSize(bytes) {
  if (!bytes) return '';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function fmtDate(ts) {
  try {
    return new Date(ts).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch {
    return '';
  }
}

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
}

export default function JudgmentsScreen() {
  const [judgments, setJudgments] = useState([]);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState('official'); // 'official' | 'uploads'

  const load = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STORE_KEY);
      setJudgments(raw ? JSON.parse(raw) : []);
    } catch {
      setJudgments([]);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const persist = async (list) => {
    setJudgments(list);
    await AsyncStorage.setItem(STORE_KEY, JSON.stringify(list));
  };

  const addJudgment = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];

      setBusy(true);
      await ensureDir();
      const safe = asset.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const dest = `${DIR}${Date.now()}_${safe}`;
      await FileSystem.copyAsync({ from: asset.uri, to: dest });

      const entry = {
        id: `${Date.now()}`,
        name: asset.name.replace(/\.pdf$/i, ''),
        uri: dest,
        size: asset.size,
        addedAt: Date.now(),
      };
      await persist([entry, ...judgments]);
    } catch (e) {
      Alert.alert('Upload failed', 'Could not add that file. Please try another PDF.');
    } finally {
      setBusy(false);
    }
  };

  const openJudgment = async (item) => {
    try {
      const info = await FileSystem.getInfoAsync(item.uri);
      if (!info.exists) {
        Alert.alert('File missing', 'This judgment file could not be found on the device.');
        return;
      }
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Preview unavailable', 'Sharing/preview is not available on this device.');
        return;
      }
      await Sharing.shareAsync(item.uri, {
        mimeType: 'application/pdf',
        dialogTitle: item.name,
        UTI: 'com.adobe.pdf',
      });
    } catch {
      Alert.alert('Could not open', 'There was a problem opening this judgment.');
    }
  };

  const removeJudgment = (item) => {
    Alert.alert('Delete judgment', `Remove “${item.name}”?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try { await FileSystem.deleteAsync(item.uri, { idempotent: true }); } catch {}
          await persist(judgments.filter((j) => j.id !== item.id));
        },
      },
    ]);
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.8}
      onPress={() => openJudgment(item)}
      onLongPress={() => removeJudgment(item)}
    >
      <View style={styles.pdfIcon}><Text style={styles.pdfIconText}>PDF</Text></View>
      <View style={styles.rowBody}>
        <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
        <Text style={styles.meta}>
          {fmtDate(item.addedAt)}{item.size ? ` · ${fmtSize(item.size)}` : ''}
        </Text>
      </View>
      <TouchableOpacity onPress={() => removeJudgment(item)} hitSlop={10} style={styles.del}>
        <Text style={styles.delText}>✕</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.brand}>Judgments</Text>
        <View style={styles.segment}>
          <TouchableOpacity
            style={[styles.segBtn, mode === 'official' && styles.segOn]}
            onPress={() => setMode('official')}
            activeOpacity={0.8}
          >
            <Text style={[styles.segText, mode === 'official' && styles.segTextOn]}>Official</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segBtn, mode === 'uploads' && styles.segOn]}
            onPress={() => setMode('uploads')}
            activeOpacity={0.8}
          >
            <Text style={[styles.segText, mode === 'uploads' && styles.segTextOn]}>My uploads</Text>
          </TouchableOpacity>
        </View>
      </View>

      {mode === 'official' ? (
        <OfficialJudgments />
      ) : (
        <>
          <TouchableOpacity style={styles.upload} onPress={addJudgment} disabled={busy} activeOpacity={0.85}>
            {busy ? (
              <ActivityIndicator color={theme.colors.bg} />
            ) : (
              <Text style={styles.uploadText}>＋  Upload judgment (PDF)</Text>
            )}
          </TouchableOpacity>

          {!ready ? (
            <View style={styles.center}><ActivityIndicator color={theme.colors.accent} /></View>
          ) : (
            <FlatList
              data={judgments}
              keyExtractor={(it) => it.id}
              renderItem={renderItem}
              contentContainerStyle={styles.list}
              ListEmptyComponent={
                <View style={styles.center}>
                  <Text style={styles.emptyBig}>No uploads yet</Text>
                  <Text style={styles.dim}>
                    Tap “Upload judgment” to add a PDF from your files, iCloud, or downloads.
                    Tap a judgment to preview it; long-press to delete.
                  </Text>
                </View>
              }
            />
          )}
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 },
  brand: { color: theme.colors.textOnDark, fontSize: 26, fontWeight: '800' },
  subtitle: { color: theme.colors.accent, fontSize: 13, fontWeight: '600', marginTop: 2 },
  segment: {
    flexDirection: 'row', marginTop: 12, backgroundColor: theme.colors.surface,
    borderRadius: 12, padding: 3,
  },
  segBtn: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center' },
  segOn: { backgroundColor: theme.colors.accent },
  segText: { color: theme.colors.tabInactive, fontWeight: '700', fontSize: 14 },
  segTextOn: { color: theme.colors.bg },
  upload: {
    backgroundColor: theme.colors.accent, marginHorizontal: 16, marginTop: 8, marginBottom: 6,
    borderRadius: theme.radius, paddingVertical: 15, alignItems: 'center', justifyContent: 'center',
  },
  uploadText: { color: theme.colors.bg, fontWeight: '800', fontSize: 15 },
  list: { padding: 16, paddingTop: 10, paddingBottom: 32 },
  row: {
    backgroundColor: theme.colors.card, borderRadius: theme.radius, padding: 14, marginBottom: 12,
    flexDirection: 'row', alignItems: 'center',
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 5, shadowOffset: { width: 0, height: 2 },
  },
  pdfIcon: {
    width: 46, height: 46, borderRadius: 10, backgroundColor: '#fdeceb',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  pdfIconText: { color: theme.colors.danger, fontWeight: '800', fontSize: 12 },
  rowBody: { flex: 1 },
  name: { color: theme.colors.text, fontSize: 15, fontWeight: '700', lineHeight: 20 },
  meta: { color: theme.colors.muted, fontSize: 12, marginTop: 4 },
  del: { padding: 6, marginLeft: 6 },
  delText: { color: theme.colors.muted, fontSize: 16, fontWeight: '700' },
  center: { alignItems: 'center', justifyContent: 'center', padding: 40, marginTop: 40 },
  emptyBig: { color: theme.colors.textOnDark, fontSize: 17, fontWeight: '700', marginBottom: 10 },
  dim: { color: theme.colors.tabInactive, textAlign: 'center', lineHeight: 21, fontSize: 14 },
});
