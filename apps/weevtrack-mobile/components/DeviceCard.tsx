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

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.card, { borderLeftColor: cfg.color }, selected && styles.cardSelected]}
      activeOpacity={0.75}
    >
      {/* Ícone neutro — cor só quando selecionado */}
      <View style={[styles.iconBox, selected && styles.iconBoxSelected]}>
        <MaterialCommunityIcons
          name={iconName}
          size={22}
          color={selected ? colors.primary : colors.muted}
        />
      </View>

      <View style={styles.info}>
        {/* Nome + status */}
        <View style={styles.row}>
          <Text style={styles.name} numberOfLines={1}>{device.name}</Text>
          <Text style={[styles.statusLabel, { color: cfg.color }]}>{cfg.label}</Text>
        </View>

        {/* Velocidade / tempo */}
        <View style={styles.row}>
          <Text style={styles.meta}>
            {status === 'movendo'
              ? `${Math.round(speed)} km/h`
              : status === 'parado'
              ? 'Parado'
              : device.lastUpdate ? timeAgo(device.lastUpdate) : '—'}
          </Text>
          {status !== 'offline' && (
            <Text style={styles.meta}>{device.lastUpdate ? timeAgo(device.lastUpdate) : '—'}</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 13,
    paddingRight: 16,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    borderLeftWidth: 3,
    backgroundColor: colors.white,
    gap: 12,
  },
  cardSelected: {
    backgroundColor: '#F0F7FF',
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxSelected: {
    backgroundColor: '#E8F0FE',
    borderColor: colors.primary + '40',
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
  statusLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  meta: {
    fontSize: 11,
    color: colors.muted,
  },
});
