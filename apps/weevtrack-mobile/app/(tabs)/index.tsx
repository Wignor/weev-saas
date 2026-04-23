import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, Animated,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { getSession, clearSession } from '@/lib/storage';
import { fetchDevices, fetchPositions, ApiDevice, ApiPosition, knotsToKmh } from '@/lib/api';
import { LIVE_MAP_HTML } from '@/lib/mapHtml';
import { colors } from '@/constants/colors';

export default function MapTab() {
  const router = useRouter();
  const params = useLocalSearchParams<{ select?: string }>();
  const webViewRef = useRef<WebView>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [devices, setDevices] = useState<ApiDevice[]>([]);
  const [positions, setPositions] = useState<ApiPosition[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [showList, setShowList] = useState(false);
  const [session, setSession] = useState<string | null>(null);

  useEffect(() => {
    getSession().then((s) => {
      if (!s) { router.replace('/login'); return; }
      setSession(s);
    });
  }, []);

  const loadData = useCallback(async (sid: string) => {
    try {
      const [devs, pos] = await Promise.all([fetchDevices(sid), fetchPositions(sid)]);
      setDevices(devs);
      setPositions(pos);
      webViewRef.current?.injectJavaScript(
        `handleMsg(${JSON.stringify(JSON.stringify({ type: 'UPDATE_DATA', devices: devs, positions: pos }))});true;`
      );
    } catch (err) {
      if (err instanceof Error && err.message.includes('401')) {
        await clearSession();
        router.replace('/login');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    loadData(session);
    intervalRef.current = setInterval(() => loadData(session), 10000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [session, loadData]);

  // Handle device selection coming from other tabs
  useFocusEffect(
    useCallback(() => {
      if (params.select) {
        const id = Number(params.select);
        selectDevice(id);
      }
    }, [params.select])
  );

  function selectDevice(id: number) {
    setSelectedId(id);
    webViewRef.current?.injectJavaScript(
      `handleMsg(${JSON.stringify(JSON.stringify({ type: 'SELECT_DEVICE', deviceId: id }))});true;`
    );
    setShowList(false);
  }

  function handleWebViewMessage(event: { nativeEvent: { data: string } }) {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'DEVICE_CLICK') setSelectedId(msg.deviceId);
    } catch {}
  }

  const onlineCount = devices.filter((d) => d.status === 'online').length;
  const posMap = Object.fromEntries(positions.map((p) => [p.deviceId, p]));

  return (
    <View style={styles.root}>
      {/* Navbar */}
      <View style={styles.navbar}>
        <Text style={styles.navTitle}>WeevTrack</Text>
        <View style={styles.navRight}>
          <View style={styles.onlineBadge}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineText}>{onlineCount} online</Text>
          </View>
          <TouchableOpacity onPress={() => setShowList((v) => !v)} style={styles.listBtn}>
            <Text style={styles.listBtnText}>{showList ? '✕' : '☰'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Mapa */}
      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loaderText}>Carregando mapa...</Text>
        </View>
      ) : (
        <WebView
          ref={webViewRef}
          source={{ html: LIVE_MAP_HTML }}
          style={styles.map}
          onMessage={handleWebViewMessage}
          originWhitelist={['*']}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          mixedContentMode="always"
        />
      )}

      {/* Lista de veículos (overlay) */}
      {showList && (
        <View style={styles.listOverlay}>
          <FlatList
            data={devices}
            keyExtractor={(d) => String(d.id)}
            renderItem={({ item }) => {
              const pos = posMap[item.id];
              const speed = pos ? knotsToKmh(pos.speed) : 0;
              const isOnline = item.status === 'online';
              const isMoving = isOnline && speed > 2;
              const statusColor = !isOnline ? colors.muted : isMoving ? colors.success : colors.warning;

              return (
                <TouchableOpacity
                  style={[styles.listItem, selectedId === item.id && styles.listItemSelected]}
                  onPress={() => selectDevice(item.id)}
                >
                  <View style={[styles.listDot, { backgroundColor: statusColor }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.listName}>{item.name}</Text>
                    <Text style={styles.listMeta}>
                      {!isOnline ? 'Offline' : isMoving ? `${speed} km/h` : 'Parado'}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.dark },
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingTop: 52,
    paddingBottom: 12,
  },
  navTitle: { fontSize: 20, fontWeight: '800', color: colors.white },
  navRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  onlineBadge: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success },
  onlineText: { fontSize: 13, color: 'rgba(255,255,255,0.9)' },
  listBtn: { padding: 4 },
  listBtnText: { fontSize: 20, color: colors.white },
  map: { flex: 1 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loaderText: { color: colors.muted, fontSize: 14 },
  listOverlay: {
    position: 'absolute',
    top: 112,
    right: 0,
    width: 220,
    maxHeight: 340,
    backgroundColor: colors.white,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 10,
  },
  listItemSelected: { backgroundColor: '#F0F7FF' },
  listDot: { width: 10, height: 10, borderRadius: 5 },
  listName: { fontSize: 13, fontWeight: '600', color: colors.dark },
  listMeta: { fontSize: 11, color: colors.muted, marginTop: 2 },
});
