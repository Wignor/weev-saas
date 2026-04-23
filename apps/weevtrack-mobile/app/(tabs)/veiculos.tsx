import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { getSession, clearSession, getStoredUser } from '@/lib/storage';
import { fetchDevices, fetchPositions, ApiDevice, ApiPosition } from '@/lib/api';
import DeviceCard from '@/components/DeviceCard';
import { colors } from '@/constants/colors';

export default function VeiculosTab() {
  const router = useRouter();
  const [devices, setDevices] = useState<ApiDevice[]>([]);
  const [positions, setPositions] = useState<ApiPosition[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<string | null>(null);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    Promise.all([getSession(), getStoredUser()]).then(([sid, user]) => {
      if (!sid) { router.replace('/login'); return; }
      setSession(sid);
      if (user) setUserName(user.name);
    });
  }, []);

  const loadData = useCallback(async (sid: string) => {
    try {
      const [devs, pos] = await Promise.all([fetchDevices(sid), fetchPositions(sid)]);
      setDevices(devs);
      setPositions(pos);
    } catch (err) {
      if (err instanceof Error && err.message.includes('401')) {
        await clearSession();
        router.replace('/login');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (session) loadData(session);
    }, [session, loadData])
  );

  async function handleLogout() {
    Alert.alert('Sair', 'Deseja encerrar a sessão?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: async () => {
          await clearSession();
          router.replace('/login');
        },
      },
    ]);
  }

  const posMap = Object.fromEntries(positions.map((p) => [p.deviceId, p]));

  const filtered = devices.filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase())
  );

  const online = devices.filter((d) => d.status === 'online').length;

  return (
    <View style={styles.root}>
      {/* Navbar */}
      <View style={styles.navbar}>
        <View>
          <Text style={styles.navTitle}>Veículos</Text>
          {userName ? <Text style={styles.navSub}>Olá, {userName.split(' ')[0]}</Text> : null}
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Sair</Text>
        </TouchableOpacity>
      </View>

      {/* Resumo */}
      <View style={styles.summary}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{devices.length}</Text>
          <Text style={styles.summaryLabel}>Total</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: colors.success }]}>{online}</Text>
          <Text style={styles.summaryLabel}>Online</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: colors.muted }]}>{devices.length - online}</Text>
          <Text style={styles.summaryLabel}>Offline</Text>
        </View>
      </View>

      {/* Busca */}
      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar veículo..."
          placeholderTextColor={colors.muted}
          clearButtonMode="while-editing"
        />
      </View>

      {/* Lista */}
      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🚗</Text>
          <Text style={styles.emptyText}>Nenhum veículo encontrado</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(d) => String(d.id)}
          renderItem={({ item }) => (
            <DeviceCard
              device={item}
              position={posMap[item.id]}
              onPress={() => {
                router.push(`/(tabs)?select=${item.id}`);
              }}
            />
          )}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingTop: 52,
    paddingBottom: 14,
  },
  navTitle: { fontSize: 20, fontWeight: '800', color: colors.white },
  navSub: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  logoutBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  logoutText: { fontSize: 13, color: colors.white, fontWeight: '600' },
  summary: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: 22, fontWeight: '700', color: colors.dark },
  summaryLabel: { fontSize: 11, color: colors.muted, marginTop: 2 },
  divider: { width: 1, backgroundColor: colors.border },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    marginHorizontal: 12,
    marginVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchIcon: { fontSize: 15 },
  searchInput: { flex: 1, height: 42, fontSize: 14, color: colors.dark },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyIcon: { fontSize: 40 },
  emptyText: { fontSize: 14, color: colors.muted },
});
