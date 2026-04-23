import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { ApiDevice, ApiPosition, knotsToKmh, timeAgo } from '@/lib/api';
import { colors } from '@/constants/colors';

interface Props {
  device: ApiDevice;
  position?: ApiPosition;
  selected?: boolean;
  onPress: () => void;
}

function getStatus(device: ApiDevice, position?: ApiPosition) {
  if (device.status === 'offline' || device.status === 'unknown') return 'offline' as const;
  if (position && knotsToKmh(position.speed) > 2) return 'movendo' as const;
  return 'parado' as const;
}

const statusMap = {
  movendo: { color: colors.success, label: 'Movendo' },
  parado:  { color: colors.warning,  label: 'Parado'  },
  offline: { color: colors.muted,    label: 'Offline' },
};

export default function DeviceCard({ device, position, selected, onPress }: Props) {
  const status = getStatus(device, position);
  const cfg = statusMap[status];
  const speed = position ? knotsToKmh(position.speed) : 0;

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.card, selected && styles.cardSelected]}
      activeOpacity={0.7}
    >
      <View style={[styles.iconBox, selected && styles.iconBoxSelected]}>
        <Text style={[styles.iconText, { color: selected ? colors.primary : colors.muted }]}>🚗</Text>
      </View>

      <View style={styles.info}>
        <View style={styles.row}>
          <Text style={styles.name} numberOfLines={1}>{device.name}</Text>
          <View style={styles.statusBadge}>
            <View style={[styles.dot, { backgroundColor: cfg.color }]} />
            <Text style={[styles.statusLabel, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        </View>
        <View style={styles.row}>
          {status !== 'offline' && (
            <Text style={styles.meta}>{speed > 2 ? `${speed} km/h` : 'Parado'}</Text>
          )}
          <Text style={styles.meta}>
            {device.lastUpdate ? timeAgo(device.lastUpdate) : '—'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.white,
    gap: 12,
  },
  cardSelected: {
    backgroundColor: '#F0F7FF',
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxSelected: {
    backgroundColor: '#DDEEFF',
  },
  iconText: {
    fontSize: 18,
  },
  info: {
    flex: 1,
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.dark,
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  meta: {
    fontSize: 12,
    color: colors.muted,
  },
});
