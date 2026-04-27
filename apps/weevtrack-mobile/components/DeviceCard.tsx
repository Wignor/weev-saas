import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ApiDevice, ApiPosition, knotsToKmh, timeAgo } from '@/lib/api';
import { colors } from '@/constants/colors';

interface Props {
  device: ApiDevice;
  position?: ApiPosition;
  selected?: boolean;
  onPress: () => void;
}

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

function getVehicleIcon(name: string): IconName {
  const n = name.toLowerCase();
  if (/moto|scooter|cg |titan|bros|fazer|factor|biz|pop |nxr|xre|twister|lead|pcx|burgman/.test(n)) return 'motorbike';
  if (/caminhão|caminhao|truck|carreta|bi[ck]|bitruck|mercedes|volvo 760|volvo fh|iveco|scania|daf /.test(n)) return 'truck';
  if (/\bonibus\b|ônibus|bus|micro.?ônibus|micro.?onibus|van|van-|sprinter|kombi/.test(n)) return 'bus';
  if (/pickup|caminhonete|hilux|ranger|s10|l200|triton|frontier|amarok|f-250|f250|toro|oroch/.test(n)) return 'car-pickup';
  if (/trator|agrícola|agricola|colheitadeira|plantadeira|pulverizador/.test(n)) return 'tractor';
  if (/retro|escavadeira|escavadora|escavação|excavadora/.test(n)) return 'excavator';
  if (/barco|lancha|embarcação|embarcacao|ferry|bote|náutico|nautico/.test(n)) return 'ferry';
  return 'car-side';
}

function getStatus(device: ApiDevice, position?: ApiPosition) {
  if (device.status === 'offline' || device.status === 'unknown') return 'offline' as const;
  if (position && knotsToKmh(position.speed) > 2) return 'movendo' as const;
  return 'parado' as const;
}

const statusMap = {
  movendo: { color: colors.success, label: 'Movendo' },
  parado:  { color: colors.primary, label: 'Parado'  },
  offline: { color: colors.muted,   label: 'Offline' },
};

export default function DeviceCard({ device, position, selected, onPress }: Props) {
  const status = getStatus(device, position);
  const cfg = statusMap[status];
  const speed = position ? knotsToKmh(position.speed) : 0;
  const iconName = getVehicleIcon(device.name);
  const iconColor = selected ? colors.primary : status === 'movendo' ? colors.success : status === 'parado' ? colors.warning : colors.muted;

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.card, selected && styles.cardSelected]}
      activeOpacity={0.7}
    >
      <View style={[styles.iconBox, selected && styles.iconBoxSelected, { borderColor: iconColor + '40' }]}>
        <MaterialCommunityIcons name={iconName} size={22} color={iconColor} />
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
            <Text style={styles.meta}>{speed > 2 ? `${Math.round(speed)} km/h` : 'Parado'}</Text>
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
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxSelected: {
    backgroundColor: '#DDEEFF',
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
