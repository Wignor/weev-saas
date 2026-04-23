import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  Modal, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useFocusEffect, useRouter } from 'expo-router';
import { getSession, clearSession } from '@/lib/storage';
import { fetchDevices, fetchHistory, ApiDevice, ApiPosition, knotsToKmh } from '@/lib/api';
import { buildHistoryHtml } from '@/lib/mapHtml';
import { colors } from '@/constants/colors';

function todayRange(): { from: string; to: string } {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return { from: start.toISOString(), to: now.toISOString() };
}

function rangeLabel(hours: number): string {
  if (hours === 24) return 'Hoje';
  if (hours === 48) return 'Ontem';
  if (hours === 168) return '7 dias';
  return `${hours}h`;
}

function buildRange(hours: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - hours * 60 * 60 * 1000);
  if (hours === 48) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const end = new Date(yesterday);
    end.setHours(23, 59, 59, 999);
    return { from: yesterday.toISOString(), to: end.toISOString() };
  }
  return { from: from.toISOString(), to: to.toISOString() };
}

const PERIOD_OPTIONS = [24, 48, 72, 168];

export default function HistoricoTab() {
  const router = useRouter();
  const [devices, setDevices] = useState<ApiDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<ApiDevice | null>(null);
  const [periodHours, setPeriodHours] = useState(24);
  const [positions, setPositions] = useState<ApiPosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<string | null>(null);
  const [showDevicePicker, setShowDevicePicker] = useState(false);
  const [mapHtml, setMapHtml] = useState<string | null>(null);

  useEffect(() => {
    getSession().then((sid) => {
      if (!sid) { router.replace('/login'); return; }
      setSession(sid);
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!session) return;
      fetchDevices(session)
        .then(setDevices)
        .catch(async (err) => {
          if (err instanceof Error && err.message.includes('401')) {
            await clearSession();
            router.replace('/login');
          }
        });
    }, [session])
  );

  async function handleSearch() {
    if (!selectedDevice) {
      Alert.alert('Atenção', 'Selecione um veículo primeiro.');
      return;
    }
    if (!session) return;

    setLoading(true);
    setMapHtml(null);
    setPositions([]);

    try {
      const { from, to } = buildRange(periodHours);
      const pos = await fetchHistory(session, selectedDevice.id, from, to);
      setPositions(pos);

      const validCoords: [number, number][] = pos
        .filter((p) => p.valid && (p.latitude !== 0 || p.longitude !== 0))
        .map((p) => [p.latitude, p.longitude]);

      const maxSpeed = pos.reduce((m, p) => Math.max(m, knotsToKmh(p.speed)), 0);
      const totalKm = validCoords.length > 1
        ? validCoords.reduce((acc, coord, i) => {
            if (i === 0) return 0;
            const prev = validCoords[i - 1];
            const R = 6371;
            const dLat = ((coord[0] - prev[0]) * Math.PI) / 180;
            const dLon = ((coord[1] - prev[1]) * Math.PI) / 180;
            const a = Math.sin(dLat / 2) ** 2
              + Math.cos((prev[0] * Math.PI) / 180)
                * Math.cos((coord[0] * Math.PI) / 180)
                * Math.sin(dLon / 2) ** 2;
            return acc + R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          }, 0)
        : 0;

      setMapHtml(buildHistoryHtml(validCoords, Math.round(totalKm * 10) / 10, maxSpeed));
    } catch (err) {
      if (err instanceof Error && err.message.includes('401')) {
        await clearSession();
        router.replace('/login');
      } else {
        Alert.alert('Erro', 'Não foi possível carregar o histórico.');
      }
    } finally {
      setLoading(false);
    }
  }

  const validPositions = positions.filter((p) => p.valid);
  const maxSpeed = validPositions.reduce((m, p) => Math.max(m, knotsToKmh(p.speed)), 0);

  return (
    <View style={styles.root}>
      {/* Navbar */}
      <View style={styles.navbar}>
        <Text style={styles.navTitle}>Histórico</Text>
      </View>

      {/* Controles */}
      <View style={styles.controls}>
        {/* Seletor de veículo */}
        <TouchableOpacity
          style={styles.pickerBtn}
          onPress={() => setShowDevicePicker(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.pickerIcon}>🚗</Text>
          <Text style={[styles.pickerText, !selectedDevice && styles.pickerPlaceholder]}>
            {selectedDevice ? selectedDevice.name : 'Selecionar veículo'}
          </Text>
          <Text style={styles.pickerChevron}>▾</Text>
        </TouchableOpacity>

        {/* Período */}
        <View style={styles.periodRow}>
          {PERIOD_OPTIONS.map((h) => (
            <TouchableOpacity
              key={h}
              style={[styles.periodBtn, periodHours === h && styles.periodBtnActive]}
              onPress={() => setPeriodHours(h)}
            >
              <Text style={[styles.periodText, periodHours === h && styles.periodTextActive]}>
                {rangeLabel(h)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.searchBtn} onPress={handleSearch} activeOpacity={0.85}>
          <Text style={styles.searchBtnText}>Buscar percurso</Text>
        </TouchableOpacity>
      </View>

      {/* Resultado */}
      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loaderText}>Buscando percurso...</Text>
        </View>
      ) : mapHtml ? (
        <View style={styles.mapContainer}>
          {/* Stats bar */}
          <View style={styles.statsBar}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{validPositions.length}</Text>
              <Text style={styles.statLabel}>Pontos</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{maxSpeed}</Text>
              <Text style={styles.statLabel}>Vel. máx (km/h)</Text>
            </View>
          </View>
          <WebView
            source={{ html: mapHtml }}
            style={styles.map}
            originWhitelist={['*']}
            javaScriptEnabled
            domStorageEnabled
            mixedContentMode="always"
          />
        </View>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📍</Text>
          <Text style={styles.emptyTitle}>Buscar percurso</Text>
          <Text style={styles.emptyText}>
            Selecione um veículo e período,{'\n'}depois toque em "Buscar percurso"
          </Text>
        </View>
      )}

      {/* Modal seletor de veículo */}
      <Modal
        visible={showDevicePicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowDevicePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Selecionar veículo</Text>
            <FlatList
              data={devices}
              keyExtractor={(d) => String(d.id)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.modalItem,
                    selectedDevice?.id === item.id && styles.modalItemActive,
                  ]}
                  onPress={() => {
                    setSelectedDevice(item);
                    setShowDevicePicker(false);
                    setMapHtml(null);
                    setPositions([]);
                  }}
                >
                  <Text style={styles.modalItemText}>{item.name}</Text>
                  <View style={[
                    styles.modalDot,
                    { backgroundColor: item.status === 'online' ? colors.success : colors.muted },
                  ]} />
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setShowDevicePicker(false)}
            >
              <Text style={styles.modalCloseText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  navbar: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingTop: 52,
    paddingBottom: 14,
  },
  navTitle: { fontSize: 20, fontWeight: '800', color: colors.white },
  controls: {
    backgroundColor: colors.white,
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    backgroundColor: colors.surface,
  },
  pickerIcon: { fontSize: 16 },
  pickerText: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.dark },
  pickerPlaceholder: { color: colors.muted, fontWeight: '400' },
  pickerChevron: { fontSize: 14, color: colors.muted },
  periodRow: { flexDirection: 'row', gap: 8 },
  periodBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  periodBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  periodText: { fontSize: 13, fontWeight: '600', color: colors.muted },
  periodTextActive: { color: colors.white },
  searchBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  searchBtnText: { color: colors.white, fontSize: 15, fontWeight: '700' },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loaderText: { color: colors.muted, fontSize: 14 },
  mapContainer: { flex: 1 },
  statsBar: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 10,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '700', color: colors.dark },
  statLabel: { fontSize: 11, color: colors.muted, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: colors.border },
  map: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 32 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.dark },
  emptyText: { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 22 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    paddingBottom: 32,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.dark,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalItemActive: { backgroundColor: '#F0F7FF' },
  modalItemText: { fontSize: 15, color: colors.dark, fontWeight: '500' },
  modalDot: { width: 10, height: 10, borderRadius: 5 },
  modalClose: {
    marginHorizontal: 20,
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  modalCloseText: { fontSize: 15, color: colors.muted, fontWeight: '600' },
});
