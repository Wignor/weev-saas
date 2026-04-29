'use client';

import { useState, useEffect } from 'react';
import BottomNav from '@/components/BottomNav';
import DesktopNav from '@/components/DesktopNav';
import { knotsToKmh } from '@/lib/traccar';

interface Device { id: number; name: string; }

interface TripEntry {
  deviceId: number;
  startTime: string;
  endTime: string;
  distance: number;
  averageSpeed: number;
  maxSpeed: number;
  startAddress?: string;
  endAddress?: string;
}

interface StopEntry {
  deviceId: number;
  startTime: string;
  endTime: string;
  duration: number;
  lat: number;
  lon: number;
  address?: string;
}

interface SummaryEntry {
  deviceId: number;
  distance: number;
  averageSpeed: number;
  maxSpeed: number;
  engineHours: number;
}

type ReportType = 'trips' | 'stops' | 'summary';

function fmtDuration(ms: number) {
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function fmtDist(meters: number) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}

function todayRange() {
  const now = new Date();
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  return { from: start.toISOString().slice(0, 16), to: now.toISOString().slice(0, 16) };
}

const REPORT_TYPES: { key: ReportType; label: string; icon: string; desc: string }[] = [
  { key: 'summary',  label: 'Resumo',   icon: '📊', desc: 'Distância total, velocidade média e horas de motor' },
  { key: 'trips',    label: 'Trajetos',  icon: '🛣️', desc: 'Lista de todas as viagens no período' },
  { key: 'stops',    label: 'Paradas',   icon: '🅿️', desc: 'Onde e por quanto tempo o veículo ficou parado' },
];

export default function RelatoriosPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<number | null>(null);
  const [reportType, setReportType] = useState<ReportType>('summary');
  const { from: f0, to: t0 } = todayRange();
  const [from, setFrom] = useState(f0);
  const [to, setTo] = useState(t0);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [trips, setTrips] = useState<TripEntry[]>([]);
  const [stops, setStops] = useState<StopEntry[]>([]);
  const [summary, setSummary] = useState<SummaryEntry[]>([]);
  const [hasResult, setHasResult] = useState(false);

  useEffect(() => {
    fetch('/api/devices').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setDevices(d);
    }).catch(() => {});
  }, []);

  async function generate() {
    if (!selectedDevice) return;
    setLoading(true);
    setHasResult(false);
    setTrips([]); setStops([]); setSummary([]);

    const fromIso = new Date(from).toISOString();
    const toIso = new Date(to).toISOString();

    try {
      if (reportType === 'trips') {
        const res = await fetch(`/api/relatorios/trips?deviceId=${selectedDevice}&from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`);
        const data = await res.json();
        setTrips(Array.isArray(data) ? data : []);
      } else if (reportType === 'stops') {
        const res = await fetch(`/api/relatorios/stops?deviceId=${selectedDevice}&from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`);
        const data = await res.json();
        setStops(Array.isArray(data) ? data : []);
      } else {
        const res = await fetch(`/api/relatorios/summary?deviceId=${selectedDevice}&from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`);
        const data = await res.json();
        setSummary(Array.isArray(data) ? data : []);
      }
      setHasResult(true);
    } catch { /* silencioso */ }
    setLoading(false);
  }

  async function exportExcel() {
    if (!hasResult) return;
    setExporting(true);
    const deviceName = devices.find(d => d.id === selectedDevice)?.name || 'Veículo';
    try {
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet(REPORT_TYPES.find(r => r.key === reportType)?.label || 'Relatório');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hdrFill: any = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E2030' } };
      const hdrFont = { bold: true, color: { argb: 'FFF0F0F5' }, size: 11 };

      if (reportType === 'trips') {
        ws.columns = [
          { header: 'Início', key: 'start', width: 20 },
          { header: 'Fim', key: 'end', width: 20 },
          { header: 'Distância', key: 'dist', width: 14 },
          { header: 'Vel. Média (km/h)', key: 'avg', width: 18 },
          { header: 'Vel. Máx (km/h)', key: 'max', width: 18 },
        ];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ws.getRow(1).eachCell((cell: any) => { cell.fill = hdrFill; cell.font = hdrFont; });
        trips.forEach(t => ws.addRow({
          start: fmtTime(t.startTime),
          end: fmtTime(t.endTime),
          dist: fmtDist(t.distance),
          avg: Math.round(knotsToKmh(t.averageSpeed)),
          max: Math.round(knotsToKmh(t.maxSpeed)),
        }));
      } else if (reportType === 'stops') {
        ws.columns = [
          { header: 'Início da parada', key: 'start', width: 20 },
          { header: 'Fim da parada', key: 'end', width: 20 },
          { header: 'Duração', key: 'dur', width: 14 },
          { header: 'Endereço', key: 'addr', width: 40 },
        ];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ws.getRow(1).eachCell((cell: any) => { cell.fill = hdrFill; cell.font = hdrFont; });
        stops.forEach(s => ws.addRow({
          start: fmtTime(s.startTime),
          end: fmtTime(s.endTime),
          dur: fmtDuration(s.duration),
          addr: s.address || `${s.lat.toFixed(5)}, ${s.lon.toFixed(5)}`,
        }));
      } else {
        ws.columns = [
          { header: 'Distância Total', key: 'dist', width: 18 },
          { header: 'Vel. Média (km/h)', key: 'avg', width: 18 },
          { header: 'Vel. Máx (km/h)', key: 'max', width: 18 },
          { header: 'Horas Motor', key: 'eng', width: 16 },
        ];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ws.getRow(1).eachCell((cell: any) => { cell.fill = hdrFill; cell.font = hdrFont; });
        summary.forEach(s => ws.addRow({
          dist: fmtDist(s.distance),
          avg: Math.round(knotsToKmh(s.averageSpeed)),
          max: Math.round(knotsToKmh(s.maxSpeed)),
          eng: fmtDuration(s.engineHours * 1000),
        }));
      }

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${deviceName}_${reportType}_${from.slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* silencioso */ }
    setExporting(false);
  }

  const deviceName = devices.find(d => d.id === selectedDevice)?.name;

  return (
    <div className="flex flex-col sidebar-offset" style={{ minHeight: '100dvh', background: 'var(--bg-page)' }}>
      <DesktopNav />

      {/* Header */}
      <header className="flex-shrink-0 flex items-center px-4 h-14 gap-3"
        style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--bg-border)' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2" strokeLinecap="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
          <polyline points="10 9 9 9 8 9"/>
        </svg>
        <h1 className="font-bold t-text-hi">Relatórios</h1>
      </header>

      <div className="flex-1 overflow-y-auto pb-24">

        {/* Report type selector */}
        <div className="px-4 pt-4 pb-2">
          <p className="text-xs font-semibold t-text-lo uppercase tracking-wider mb-2">Tipo de relatório</p>
          <div className="grid grid-cols-3 gap-2">
            {REPORT_TYPES.map(r => (
              <button key={r.key} onClick={() => { setReportType(r.key); setHasResult(false); }}
                style={{
                  borderRadius: 12, padding: '10px 8px',
                  background: reportType === r.key ? 'rgba(0,122,255,0.14)' : 'var(--bg-card)',
                  border: `1px solid ${reportType === r.key ? 'rgba(0,122,255,0.4)' : 'var(--bg-border)'}`,
                  cursor: 'pointer', transition: 'all 0.15s',
                }}>
                <div style={{ fontSize: 22, marginBottom: 4 }}>{r.icon}</div>
                <p style={{ fontSize: 12, fontWeight: 700, color: reportType === r.key ? '#007AFF' : 'var(--text-hi)', margin: 0 }}>{r.label}</p>
                <p style={{ fontSize: 10, color: 'var(--text-lo)', marginTop: 2, lineHeight: 1.3 }}>{r.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="px-4 pb-3">
          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--bg-border)' }}>
            {/* Device */}
            <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--bg-border)' }}>
              <label className="block text-xs font-semibold t-text-lo mb-1.5">Veículo</label>
              <select
                value={selectedDevice ?? ''}
                onChange={e => { setSelectedDevice(e.target.value ? Number(e.target.value) : null); setHasResult(false); }}
                style={{ width: '100%', background: 'var(--bg-input)', color: 'var(--text-hi)', border: '1px solid var(--bg-border)', borderRadius: 10, padding: '8px 12px', fontSize: 13, outline: 'none' }}
              >
                <option value="">Selecione um veículo…</option>
                {devices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>

            {/* Date range */}
            <div className="grid grid-cols-2 divide-x" style={{ borderBottom: '1px solid var(--bg-border)' }}>
              {[
                { label: 'De', value: from, setter: setFrom },
                { label: 'Até', value: to, setter: setTo },
              ].map(f => (
                <div key={f.label} className="px-4 py-3">
                  <label className="block text-xs font-semibold t-text-lo mb-1.5">{f.label}</label>
                  <input type="datetime-local" value={f.value} onChange={e => { f.setter(e.target.value); setHasResult(false); }}
                    style={{ width: '100%', background: 'var(--bg-input)', color: 'var(--text-hi)', border: '1px solid var(--bg-border)', borderRadius: 8, padding: '6px 8px', fontSize: 12, outline: 'none' }}
                  />
                </div>
              ))}
            </div>

            {/* Generate button */}
            <div className="px-4 py-3 flex gap-2">
              <button onClick={generate} disabled={!selectedDevice || loading}
                className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                style={{ background: '#007AFF', color: 'white' }}>
                {loading ? 'Gerando…' : 'Gerar relatório'}
              </button>
              {hasResult && (
                <button onClick={exportExcel} disabled={exporting}
                  className="py-3 px-4 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 flex items-center gap-2"
                  style={{ background: 'rgba(52,199,89,0.12)', color: '#34C759', border: '1px solid rgba(52,199,89,0.2)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  {exporting ? '…' : 'Excel'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Results */}
        {loading && (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {hasResult && !loading && (
          <div className="px-4">
            <p className="text-xs font-semibold t-text-lo uppercase tracking-wider mb-2">
              {REPORT_TYPES.find(r => r.key === reportType)?.label} — {deviceName}
            </p>

            {/* Summary */}
            {reportType === 'summary' && (
              summary.length === 0 ? (
                <div className="rounded-2xl py-10 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--bg-border)' }}>
                  <p className="text-sm t-text-lo">Nenhum dado para o período selecionado</p>
                </div>
              ) : summary.map((s, i) => (
                <div key={i} className="rounded-2xl overflow-hidden mb-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--bg-border)' }}>
                  {[
                    { label: 'Distância total', value: fmtDist(s.distance) },
                    { label: 'Velocidade média', value: `${Math.round(knotsToKmh(s.averageSpeed))} km/h` },
                    { label: 'Velocidade máxima', value: `${Math.round(knotsToKmh(s.maxSpeed))} km/h` },
                    { label: 'Horas de motor', value: fmtDuration(s.engineHours * 1000) },
                  ].map((row, j, arr) => (
                    <div key={row.label} className="flex items-center justify-between px-4 py-3"
                      style={{ borderBottom: j < arr.length - 1 ? '1px solid var(--bg-border)' : 'none' }}>
                      <span className="text-sm t-text-lo">{row.label}</span>
                      <span className="text-sm font-semibold t-text-hi">{row.value}</span>
                    </div>
                  ))}
                </div>
              ))
            )}

            {/* Trips */}
            {reportType === 'trips' && (
              trips.length === 0 ? (
                <div className="rounded-2xl py-10 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--bg-border)' }}>
                  <p className="text-sm t-text-lo">Nenhum trajeto no período selecionado</p>
                </div>
              ) : trips.map((t, i) => (
                <div key={i} className="rounded-2xl mb-3 px-4 py-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--bg-border)' }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs t-text-lo">{fmtTime(t.startTime)} → {fmtTime(t.endTime)}</span>
                    <span className="text-xs font-bold" style={{ color: '#007AFF' }}>{fmtDist(t.distance)}</span>
                  </div>
                  <div className="flex gap-4 mt-1">
                    <span className="text-xs t-text-lo">Média: <strong className="t-text-hi">{Math.round(knotsToKmh(t.averageSpeed))} km/h</strong></span>
                    <span className="text-xs t-text-lo">Máx: <strong className="t-text-hi">{Math.round(knotsToKmh(t.maxSpeed))} km/h</strong></span>
                  </div>
                </div>
              ))
            )}

            {/* Stops */}
            {reportType === 'stops' && (
              stops.length === 0 ? (
                <div className="rounded-2xl py-10 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--bg-border)' }}>
                  <p className="text-sm t-text-lo">Nenhuma parada no período selecionado</p>
                </div>
              ) : stops.map((s, i) => (
                <div key={i} className="rounded-2xl mb-3 px-4 py-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--bg-border)' }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs t-text-lo">{fmtTime(s.startTime)} → {fmtTime(s.endTime)}</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,149,0,0.12)', color: '#FF9500' }}>{fmtDuration(s.duration)}</span>
                  </div>
                  {s.address && <p className="text-xs t-text-lo mt-1 leading-tight">{s.address}</p>}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
