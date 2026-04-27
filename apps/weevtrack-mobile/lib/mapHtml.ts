export const LIVE_MAP_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { overflow: hidden; background: #f0f0f0; }
    #map { width: 100vw; height: 100vh; }
  </style>
</head>
<body>
<div id="map"></div>
<script>
  var map = L.map('map', { center: [-15.78, -47.93], zoom: 5, zoomControl: true });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap',
    maxZoom: 19
  }).addTo(map);

  var markers = {};
  var selectedId = null;

  function getColor(status, speedKmh) {
    if (status === 'offline' || status === 'unknown') return '#808080';
    return speedKmh > 2 ? '#34C759' : '#007AFF';
  }

  function getVehicleType(name) {
    var n = name.toLowerCase();
    if (/moto|scooter|cg\s|titan|bros|fazer|factor|biz|pop\s|nxr|xre|twister|lead|pcx|burgman/.test(n)) return 'moto';
    if (/caminhao|caminhão|truck|carreta|bitruck|scania|volvo fh|iveco|daf\s/.test(n)) return 'truck';
    if (/onibus|ônibus|\bbus\b|micro.?onibus|micro.?ônibus|sprinter|kombi/.test(n)) return 'bus';
    if (/pickup|caminhonete|hilux|ranger|\bs10\b|l200|triton|frontier|amarok|f-250|f250|\btoro\b|oroch/.test(n)) return 'pickup';
    if (/trator|agricola|agrícola|colheitadeira|plantadeira|pulverizador/.test(n)) return 'tractor';
    if (/retro|escavadeira|escavadora/.test(n)) return 'excavator';
    if (/barco|lancha|embarcacao|embarcação|ferry|bote|nautico|náutico/.test(n)) return 'boat';
    return 'car';
  }

  function getVehicleSvg(type) {
    var w = 'rgba(255,255,255,0.95)';
    var s = 'rgba(255,255,255,0.55)';
    switch (type) {
      case 'moto':
        return '<ellipse cx="22" cy="22" rx="4.5" ry="12" fill="' + w + '"/>'
             + '<circle cx="22" cy="11" r="3.5" fill="none" stroke="' + w + '" stroke-width="2.5"/>'
             + '<circle cx="22" cy="33" r="3.5" fill="none" stroke="' + w + '" stroke-width="2.5"/>'
             + '<ellipse cx="22" cy="20" rx="3" ry="2" fill="' + s + '"/>';
      case 'truck':
        return '<rect x="13" y="9" width="18" height="10" rx="2" fill="' + w + '"/>'
             + '<rect x="13" y="19" width="18" height="16" rx="1" fill="' + w + '" opacity="0.65"/>'
             + '<rect x="10" y="10" width="3.5" height="7" rx="1.5" fill="' + w + '" opacity="0.8"/>'
             + '<rect x="30.5" y="10" width="3.5" height="7" rx="1.5" fill="' + w + '" opacity="0.8"/>'
             + '<rect x="10" y="26" width="3.5" height="7" rx="1.5" fill="' + w + '" opacity="0.8"/>'
             + '<rect x="30.5" y="26" width="3.5" height="7" rx="1.5" fill="' + w + '" opacity="0.8"/>'
             + '<rect x="14" y="10" width="16" height="5" rx="1" fill="' + s + '"/>';
      case 'bus':
        return '<rect x="11" y="8" width="22" height="28" rx="4" fill="' + w + '"/>'
             + '<rect x="13" y="10" width="18" height="5" rx="1.5" fill="' + s + '"/>'
             + '<rect x="13" y="17" width="18" height="4" rx="1" fill="' + s + '"/>'
             + '<rect x="13" y="23" width="18" height="4" rx="1" fill="' + s + '"/>'
             + '<rect x="13" y="30" width="18" height="3" rx="1" fill="' + s + '"/>';
      case 'pickup':
        return '<rect x="13" y="12" width="18" height="12" rx="3.5" fill="' + w + '"/>'
             + '<rect x="13" y="23" width="18" height="9" rx="1" fill="' + w + '" opacity="0.65"/>'
             + '<rect x="10" y="13" width="3.5" height="8" rx="1.5" fill="' + w + '" opacity="0.8"/>'
             + '<rect x="30.5" y="13" width="3.5" height="8" rx="1.5" fill="' + w + '" opacity="0.8"/>'
             + '<rect x="10" y="24" width="3.5" height="6" rx="1.5" fill="' + w + '" opacity="0.8"/>'
             + '<rect x="30.5" y="24" width="3.5" height="6" rx="1.5" fill="' + w + '" opacity="0.8"/>'
             + '<rect x="14" y="13" width="16" height="5" rx="1" fill="' + s + '"/>';
      case 'tractor':
        return '<ellipse cx="22" cy="20" rx="5" ry="6" fill="' + w + '"/>'
             + '<circle cx="15.5" cy="28" r="6" fill="none" stroke="' + w + '" stroke-width="3"/>'
             + '<circle cx="28.5" cy="28" r="6" fill="none" stroke="' + w + '" stroke-width="3"/>'
             + '<circle cx="15.5" cy="13" r="3.5" fill="none" stroke="' + w + '" stroke-width="2"/>'
             + '<circle cx="28.5" cy="13" r="3.5" fill="none" stroke="' + w + '" stroke-width="2"/>';
      case 'excavator':
        return '<rect x="14" y="18" width="18" height="16" rx="2" fill="' + w + '"/>'
             + '<rect x="20" y="11" width="12" height="9" rx="1.5" fill="' + w + '" opacity="0.75"/>'
             + '<rect x="29" y="8" width="4" height="7" rx="1" fill="' + w + '" opacity="0.6"/>'
             + '<rect x="10" y="25" width="5" height="6" rx="1.5" fill="' + w + '" opacity="0.85"/>'
             + '<rect x="29" y="25" width="5" height="6" rx="1.5" fill="' + w + '" opacity="0.85"/>';
      case 'boat':
        return '<path d="M22 8 C22 8 33 22 32 30 Q22 36 12 30 C11 22 22 8 22 8Z" fill="' + w + '"/>'
             + '<ellipse cx="22" cy="27" rx="5" ry="2.5" fill="' + s + '"/>'
             + '<line x1="22" y1="10" x2="22" y2="24" stroke="' + s + '" stroke-width="1.5"/>';
      default: // car
        return '<rect x="14" y="11" width="16" height="22" rx="5" fill="' + w + '"/>'
             + '<rect x="15" y="13" width="14" height="5" rx="2" fill="' + s + '"/>'
             + '<rect x="15" y="27" width="14" height="4" rx="2" fill="' + s + '"/>'
             + '<rect x="11" y="13" width="3" height="7" rx="1.5" fill="' + w + '" opacity="0.8"/>'
             + '<rect x="30" y="13" width="3" height="7" rx="1.5" fill="' + w + '" opacity="0.8"/>'
             + '<rect x="11" y="24" width="3" height="7" rx="1.5" fill="' + w + '" opacity="0.8"/>'
             + '<rect x="30" y="24" width="3" height="7" rx="1.5" fill="' + w + '" opacity="0.8"/>';
    }
  }

  function makeIcon(color, selected, vehicleType) {
    var sz = selected ? 48 : 38;
    var shadow = selected
      ? 'filter:drop-shadow(0 4px 10px rgba(0,122,255,0.55))'
      : 'filter:drop-shadow(0 2px 5px rgba(0,0,0,0.25))';
    var ring = selected
      ? '<circle cx="22" cy="22" r="20" stroke="white" stroke-width="2.5" fill="none" opacity="0.9"/>'
      : '';
    var vtype = vehicleType || 'car';
    return L.divIcon({
      html: '<div style="width:' + sz + 'px;height:' + sz + 'px;' + shadow + '">'
        + '<svg width="' + sz + '" height="' + sz + '" viewBox="0 0 44 44" fill="none">'
        + '<circle cx="22" cy="22" r="22" fill="' + color + '" opacity="' + (selected ? 1 : 0.92) + '"/>'
        + ring
        + getVehicleSvg(vtype)
        + '</svg></div>',
      className: '',
      iconSize: [sz, sz],
      iconAnchor: [sz / 2, sz / 2]
    });
  }

  function updateData(devices, positions) {
    var posMap = {};
    positions.forEach(function(p) { posMap[p.deviceId] = p; });

    var seen = {};
    devices.forEach(function(device) {
      var pos = posMap[device.id];
      if (!pos || !pos.valid || (pos.latitude === 0 && pos.longitude === 0)) return;
      seen[device.id] = true;

      var speed = Math.round((pos.speed || 0) * 1.852);
      var color = getColor(device.status, speed);
      var isSelected = selectedId === device.id;
      var vehicleType = getVehicleType(device.name);
      var ignition = pos.attributes && pos.attributes.ignition;
      var fixTime = pos.fixTime ? new Date(pos.fixTime).toLocaleString('pt-BR') : '';

      var popup = '<div style="font-family:-apple-system,sans-serif;min-width:160px;padding:4px 2px;">'
        + '<div style="font-weight:700;font-size:14px;color:#1A1A1A;margin-bottom:6px;">' + device.name + '</div>'
        + '<div style="font-size:12px;color:#555;line-height:1.9;">'
        + '<b style="color:#1A1A1A;">Velocidade:</b> ' + speed + ' km/h<br>'
        + '<b style="color:#1A1A1A;">Igni&ccedil;&atilde;o:</b> ' + (ignition ? '&#10003; Ligada' : '&#8864; Desligada') + '<br>'
        + '<span style="color:#808080;font-size:11px;">' + fixTime + '</span>'
        + '</div></div>';

      if (markers[device.id]) {
        markers[device.id].setLatLng([pos.latitude, pos.longitude]);
        markers[device.id].setIcon(makeIcon(color, isSelected, vehicleType));
        var popup_obj = markers[device.id].getPopup();
        if (popup_obj) popup_obj.setContent(popup);
      } else {
        markers[device.id] = L.marker([pos.latitude, pos.longitude], { icon: makeIcon(color, isSelected, vehicleType) })
          .addTo(map)
          .bindPopup(popup, { maxWidth: 220 })
          .on('click', function() {
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'DEVICE_CLICK', deviceId: device.id }));
            }
          });
      }
    });

    Object.keys(markers).forEach(function(id) {
      if (!seen[Number(id)]) {
        map.removeLayer(markers[id]);
        delete markers[id];
      }
    });
  }

  function selectDevice(deviceId) {
    selectedId = deviceId;
    var marker = markers[deviceId];
    if (marker) {
      map.flyTo(marker.getLatLng(), 15, { duration: 1 });
      marker.openPopup();
    }
  }

  function handleMsg(raw) {
    try {
      var msg = JSON.parse(raw);
      if (msg.type === 'UPDATE_DATA') updateData(msg.devices, msg.positions);
      if (msg.type === 'SELECT_DEVICE') selectDevice(msg.deviceId);
    } catch(e) {}
  }

  window.addEventListener('message', function(e) { handleMsg(e.data); });
  document.addEventListener('message', function(e) { handleMsg(e.data); });
</script>
</body>
</html>`;

export function buildHistoryHtml(
  coords: [number, number][],
  totalKm: number,
  maxSpeedKmh: number
): string {
  const start = coords[0] || [-15.78, -47.93];
  const end = coords[coords.length - 1] || start;
  const center = coords.length > 0 ? start : [-15.78, -47.93];

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { overflow: hidden; }
    #map { width: 100vw; height: 100vh; }
  </style>
</head>
<body>
<div id="map"></div>
<script>
  var map = L.map('map', { center: ${JSON.stringify(center)}, zoom: 13 });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap',
    maxZoom: 19
  }).addTo(map);

  var coords = ${JSON.stringify(coords)};

  if (coords.length > 0) {
    var line = L.polyline(coords, { color: '#007AFF', weight: 4, opacity: 0.85 }).addTo(map);
    map.fitBounds(line.getBounds(), { padding: [40, 40] });

    var startIcon = L.divIcon({
      html: '<div style="width:16px;height:16px;border-radius:50%;background:#34C759;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>',
      className: '',
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    });
    var endIcon = L.divIcon({
      html: '<div style="width:16px;height:16px;border-radius:50%;background:#FF3B30;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>',
      className: '',
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    });

    L.marker(${JSON.stringify(start)}, { icon: startIcon }).addTo(map).bindPopup('Partida');
    L.marker(${JSON.stringify(end)}, { icon: endIcon }).addTo(map).bindPopup('Chegada');
  }
</script>
</body>
</html>`;
}
