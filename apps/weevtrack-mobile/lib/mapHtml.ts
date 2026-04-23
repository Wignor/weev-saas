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
    return speedKmh > 2 ? '#34C759' : '#FF9500';
  }

  function makeIcon(color, selected) {
    var s = selected ? 44 : 36;
    var shadow = selected
      ? 'filter:drop-shadow(0 4px 8px rgba(0,122,255,0.5))'
      : 'filter:drop-shadow(0 2px 4px rgba(0,0,0,0.2))';
    var ring = selected
      ? '<circle cx="22" cy="22" r="20" stroke="white" stroke-width="2" fill="none"/>'
      : '';
    return L.divIcon({
      html: '<div style="width:' + s + 'px;height:' + s + 'px;' + shadow + '">'
        + '<svg width="' + s + '" height="' + s + '" viewBox="0 0 44 44" fill="none">'
        + '<circle cx="22" cy="22" r="22" fill="' + color + '" opacity="' + (selected ? 1 : 0.9) + '"/>'
        + ring
        + '<path d="M13 26L14.5 20H29.5L31 26H13Z" fill="white"/>'
        + '<path d="M14.5 20L16 15H28L29.5 20" fill="white" opacity="0.7"/>'
        + '<circle cx="17" cy="27" r="2" fill="' + color + '" stroke="white" stroke-width="1.5"/>'
        + '<circle cx="27" cy="27" r="2" fill="' + color + '" stroke="white" stroke-width="1.5"/>'
        + '</svg></div>',
      className: '',
      iconSize: [s, s],
      iconAnchor: [s / 2, s / 2]
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
        markers[device.id].setIcon(makeIcon(color, isSelected));
        var popup_obj = markers[device.id].getPopup();
        if (popup_obj) popup_obj.setContent(popup);
      } else {
        markers[device.id] = L.marker([pos.latitude, pos.longitude], { icon: makeIcon(color, isSelected) })
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
