import { useState, useEffect, useRef, useCallback } from 'react';
import { orderApi } from '../../lib/api';
import type { TvDisplayData, TvBaySlot } from '../../types';

// Realistic Ghanaian / Industrial License Plate Component
function RealisticNumberPlate({ plateNumber, variant = 'yellow' }: { plateNumber: string; variant?: 'yellow' | 'white' }) {
  const isYellow = variant === 'yellow';
  
  // Format plate if standard (e.g. GN4921-22 -> GN 4921-22)
  const formatted = plateNumber.toUpperCase().trim();

  return (
    <div
      className={`relative inline-flex items-center justify-between border-2 border-black rounded-[4px] px-3 py-1.5 min-w-[240px] max-w-full select-none ${
        isYellow ? 'number-plate-gh' : 'number-plate-white'
      }`}
    >
      {/* Screw Heads */}
      <div className="absolute top-1 left-1.5 w-1.5 h-1.5 rounded-full bg-neutral-800 border border-neutral-400 shadow-inner" />
      <div className="absolute top-1 right-1.5 w-1.5 h-1.5 rounded-full bg-neutral-800 border border-neutral-400 shadow-inner" />
      <div className="absolute bottom-1 left-1.5 w-1.5 h-1.5 rounded-full bg-neutral-800 border border-neutral-400 shadow-inner" />
      <div className="absolute bottom-1 right-1.5 w-1.5 h-1.5 rounded-full bg-neutral-800 border border-neutral-400 shadow-inner" />

      {/* Ghana Flag Badge on Left */}
      <div className="flex flex-col items-center justify-center mr-2.5 px-1 py-0.5 bg-black/10 rounded border border-black/20 shrink-0">
        <div className="flex flex-col w-4 h-2.5 rounded-[1px] overflow-hidden border border-black/40 shadow-sm">
          <div className="h-1/3 bg-[#ce1126]" />
          <div className="h-1/3 bg-[#fcd116] flex items-center justify-center">
            <div className="w-1 h-1 bg-black rounded-full scale-75" />
          </div>
          <div className="h-1/3 bg-[#006b3f]" />
        </div>
        <span className="text-[9px] font-black leading-tight tracking-tighter text-black/80 font-sans">
          GH
        </span>
      </div>

      {/* Plate Registration Number */}
      <div className="flex-1 text-center font-mono font-black text-2xl sm:text-3xl md:text-3xl lg:text-4xl tracking-widest text-[#0c0c0c] drop-shadow-[0_1px_1px_rgba(255,255,255,0.7)]">
        {formatted}
      </div>

      {/* Right spacer to balance badge */}
      <div className="w-4 shrink-0" />
    </div>
  );
}

// Web Audio API chime synthesizer for crisp airport/depot announcement tones
function playBayChime() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    gain1.gain.setValueAtTime(0.18, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.45);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880.00, now + 0.18); // A5
    gain2.gain.setValueAtTime(0.22, now + 0.18);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.18);
    osc2.stop(now + 0.75);
  } catch {
    // Ignore audio permission errors
  }
}

export function TvDisplay() {
  const [data, setData] = useState<TvDisplayData | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [timeString, setTimeString] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [newlyAddedPlates, setNewlyAddedPlates] = useState<Set<string>>(new Set());

  const previousPlatesRef = useRef<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  // Live Digital Clock (UTC Zulu time matching SCADA monitors)
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const uHours = String(now.getUTCHours()).padStart(2, '0');
      const uMinutes = String(now.getUTCMinutes()).padStart(2, '0');
      const uSeconds = String(now.getUTCSeconds()).padStart(2, '0');
      setTimeString(`${uHours}:${uMinutes}:${uSeconds}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch telemetry data from backend
  const fetchTelemetry = useCallback(async () => {
    try {
      const res = await orderApi.getTvDisplay();
      setData(res);
      setLastUpdated(new Date());

      // Track newly authorized plates for visual pulse & audio chime
      const currentPlates = new Set<string>();
      res.bays.forEach((b) => {
        if (b.order?.truck_number) {
          currentPlates.add(b.order.truck_number);
        }
      });

      const brandNew = new Set<string>();
      currentPlates.forEach((plate) => {
        if (!previousPlatesRef.current.has(plate) && previousPlatesRef.current.size > 0) {
          brandNew.add(plate);
        }
      });

      if (brandNew.size > 0) {
        setNewlyAddedPlates(brandNew);
        if (isAudioEnabled) {
          playBayChime();
        }
        setTimeout(() => {
          setNewlyAddedPlates(new Set());
        }, 9000);
      }

      previousPlatesRef.current = currentPlates;
    } catch (err) {
      console.warn('Failed to fetch telemetry data:', err);
    }
  }, [isAudioEnabled]);

  // Auto-polling every 3.5 seconds
  useEffect(() => {
    fetchTelemetry();
    const timer = setInterval(fetchTelemetry, 3500);
    return () => clearInterval(timer);
  }, [fetchTelemetry]);

  // Fullscreen toggle handler
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => undefined);
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => undefined);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // 9 Bay Slots (BAY D-01 to BAY D-09)
  const baySlots: TvBaySlot[] = data?.bays || Array.from({ length: 9 }, (_, i) => ({
    slot_number: i + 1,
    bay_label: `BAY D-${(i + 1).toString().padStart(2, '0')}`,
    is_occupied: false,
    order: null,
  }));

  const occupiedCount = baySlots.filter((b) => b.is_occupied).length;
  const loadingCount = baySlots.filter((b) => b.order?.status === 'LOADING').length;
  const readyCount = occupiedCount - loadingCount;
  const telemetry = data?.telemetry || {
    capacity_percent: minCapacity(occupiedCount),
    current_flow_rate: `${occupiedCount * 480 + 1200} BBL/HR`,
    operating_pressure_psi: '68.4 PSI',
    terminal_status: 'OPERATIONAL / NOMINAL',
    weather: 'CLEAR 29°C / WINDS 6 KTS NW',
  };

  function minCapacity(occ: number) {
    return Math.min(98, Math.max(45, occ * 11 + 42));
  }

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-screen w-screen bg-[#070a12] text-slate-100 font-mono select-none overflow-hidden relative"
    >
      {/* Scanline CRT overlay effect for authentic telemetry feel */}
      <div className="absolute inset-0 scanline-overlay z-30 pointer-events-none opacity-40" />

      {/* Top SCADA / Telemetry Header */}
      <header className="flex items-center justify-between px-5 py-2.5 bg-[#0a0f1d] border-b-2 border-amber-500/40 shrink-0 shadow-2xl z-20">
        {/* Facility Identity & Status */}
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center p-2 rounded bg-amber-500/10 border border-amber-500/30">
            <span className="text-xl">⛽</span>
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-base sm:text-lg font-black tracking-widest text-amber-400 uppercase drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]">
                BOST OIL DEPOT &bull; GANTRY TELEMETRY &amp; DISPATCH
              </h1>
              <span className="px-2 py-0.5 text-[10px] font-black bg-emerald-950 text-emerald-300 border border-emerald-500/60 rounded animate-pulse">
                SCADA ONLINE
              </span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-slate-400 font-sans tracking-wide">
              <span>{data?.depot_name || 'TEMA CENTRAL GANTRY TERMINAL — BAYS D-01 TO D-09'}</span>
              <span>&bull;</span>
              <span className="text-amber-300/80 font-mono">FLOW: {telemetry.current_flow_rate}</span>
              <span>&bull;</span>
              <span className="text-cyan-300 font-mono">CAPACITY: {telemetry.capacity_percent}%</span>
              <span>&bull;</span>
              <span className="text-emerald-400/80 font-mono">SYNC: {lastUpdated.toLocaleTimeString()}</span>
            </div>
          </div>
        </div>

        {/* Center: Live Bay Metric Badges */}
        <div className="hidden lg:flex items-center gap-3 bg-[#060913] px-4 py-1.5 rounded border border-slate-800 shadow-inner">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400 font-semibold uppercase">Bay Load:</span>
            <span className="text-sm font-black text-amber-400 bg-amber-950/60 px-2.5 py-0.5 rounded border border-amber-800/60 font-mono">
              {occupiedCount} / 9 ACTIVE
            </span>
          </div>
          <span className="text-slate-700">|</span>
          <div className="flex items-center gap-1.5 text-xs text-amber-300">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="font-bold">{readyCount} AUTHORIZED</span>
          </div>
          <span className="text-slate-700">|</span>
          <div className="flex items-center gap-1.5 text-xs text-emerald-400">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            <span className="font-bold">{loadingCount} DISPENSING</span>
          </div>
        </div>

        {/* Right: Digital UTC Zulu Clock & Controls */}
        <div className="flex items-center gap-3">
          {/* UTC Zulu Clock */}
          <div className="flex items-center gap-2 bg-[#04060d] px-3.5 py-1.5 rounded border border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.15)]">
            <span className="text-xs text-slate-400 font-bold">UTC:</span>
            <span
              id="digital-clock"
              className="text-lg md:text-xl font-black text-amber-400 tracking-widest font-mono glow-amber"
            >
              {timeString || '00:00:00'}
            </span>
            <span className="text-amber-500 font-black text-sm animate-pulse">Z</span>
          </div>

          {/* View Toggle (Grid / Manifest Table) */}
          <button
            onClick={() => setViewMode(viewMode === 'grid' ? 'table' : 'grid')}
            title="Toggle 9-Squared Grid / Flight Manifest Table"
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-xs text-slate-300 hover:text-white transition-colors"
          >
            <span>{viewMode === 'grid' ? '📋 Table View' : '🔲 9-Bay Grid'}</span>
          </button>

          {/* Audio Chime Toggle */}
          <button
            onClick={() => setIsAudioEnabled(!isAudioEnabled)}
            title={isAudioEnabled ? 'Mute Alert Chime' : 'Unmute Alert Chime'}
            className={`p-2 rounded border transition-colors ${
              isAudioEnabled
                ? 'bg-amber-950/60 border-amber-600 text-amber-400 hover:bg-amber-900/60'
                : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
            }`}
          >
            {isAudioEnabled ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            )}
          </button>

          {/* Fullscreen TV Kiosk Trigger */}
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter TV Kiosk Mode'}
            className="p-2 rounded border bg-slate-900 border-slate-700 text-slate-300 hover:text-white transition-colors"
          >
            {isFullscreen ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* Main Display Area */}
      {viewMode === 'grid' ? (
        /* ================= 9-SQUARED (3x3) SECTIONED GRID ================= */
        <main className="flex-1 grid grid-cols-1 md:grid-cols-3 grid-rows-3 gap-2.5 p-3 bg-[#050810] scada-grid-bg overflow-hidden">
          {baySlots.map((bay) => {
            const isOccupied = bay.is_occupied && bay.order;
            const order = bay.order;
            const isLoading = order?.status === 'LOADING';
            const isNewlyAdded = order?.truck_number ? newlyAddedPlates.has(order.truck_number) : false;

            if (!isOccupied || !order) {
              // --- VACANT / STANDBY BAY MODULE ---
              return (
                <div
                  key={bay.slot_number}
                  className="flex flex-col justify-between p-3.5 rounded bg-[#090d18]/80 border border-slate-800/80 shadow-inner relative overflow-hidden group hover:border-slate-700 transition-colors"
                >
                  {/* Bay Header */}
                  <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-600 shadow-sm" />
                      <span className="text-sm font-black text-slate-400 tracking-wider">
                        {bay.bay_label}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 bg-black/60 px-2 py-0.5 rounded border border-slate-800">
                      STANDBY &bull; ARMED
                    </span>
                  </div>

                  {/* Center Radar / Standby Graphic */}
                  <div className="flex flex-col items-center justify-center my-auto text-center space-y-1">
                    <div className="relative flex items-center justify-center w-12 h-12 rounded-full border border-slate-800 bg-black/40">
                      <span className="text-xs font-mono font-bold text-slate-600">D-0{bay.slot_number}</span>
                      <span className="absolute inset-0 rounded-full border border-dashed border-slate-700 animate-[spin_20s_linear_infinite]" />
                    </div>
                    <p className="text-xl md:text-2xl font-black text-slate-600 tracking-widest uppercase font-mono">
                      BAY VACANT
                    </p>
                    <p className="text-[11px] text-slate-500 font-sans">
                      Pumps Idle &bull; Ready for Next Tanker
                    </p>
                  </div>

                  {/* Module Footer */}
                  <div className="flex items-center justify-between text-[10px] text-slate-600 border-t border-slate-800/60 pt-1">
                    <span>GANTRY GATE #{bay.slot_number}</span>
                    <span className="text-emerald-500/70 font-semibold">&bull; SENSORS NOMINAL</span>
                  </div>
                </div>
              );
            }

            // --- OCCUPIED / AUTHORIZED BAY MODULE ---
            return (
              <div
                key={bay.slot_number}
                className={`flex flex-col justify-between p-3.5 rounded shadow-2xl relative overflow-hidden transition-all duration-500 ${
                  isNewlyAdded
                    ? 'ring-4 ring-amber-400 bg-gradient-to-br from-amber-950/70 via-[#0e1628] to-[#080d19] border-amber-400 animate-pulse'
                    : isLoading
                    ? 'bg-gradient-to-br from-emerald-950/50 via-[#0b1526] to-[#060b14] border-2 border-emerald-500/80 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                    : 'bg-gradient-to-br from-amber-950/40 via-[#0b1526] to-[#060b14] border-2 border-amber-500/80 shadow-[0_0_20px_rgba(245,158,11,0.15)]'
                }`}
              >
                {/* Bay Header & Status Badge */}
                <div className="flex items-center justify-between border-b border-slate-700/60 pb-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-3 h-3 rounded-full ${
                        isLoading ? 'bg-emerald-400 animate-ping' : 'bg-amber-400 animate-pulse'
                      }`}
                    />
                    <span
                      className={`text-base font-black tracking-widest font-mono ${
                        isLoading ? 'text-emerald-400 glow-emerald' : 'text-amber-400 glow-amber'
                      }`}
                    >
                      {bay.bay_label}
                    </span>
                  </div>

                  <div
                    className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-black uppercase tracking-wider border shadow ${
                      isLoading
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-500 animate-pulse'
                        : 'bg-amber-950 text-amber-300 border-amber-500 animate-bounce'
                    }`}
                  >
                    <span>{isLoading ? '⛽' : '⚡'}</span>
                    <span>{isLoading ? 'DISPENSING IN PROGRESS' : 'AUTHORIZED &bull; PROCEED TO BAY'}</span>
                  </div>
                </div>

                {/* Center: REALISTIC VEHICLE REGISTRATION PLATE */}
                <div className="my-auto py-1.5 flex flex-col items-center justify-center">
                  <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">
                    ASSIGNED VEHICLE REGISTRATION
                  </p>

                  {/* Embossed Ghanaian / Industrial Vehicle Plate */}
                  <RealisticNumberPlate
                    plateNumber={order.truck_number}
                    variant={isLoading ? 'white' : 'yellow'}
                  />

                  {/* Driver & Carrier Designation */}
                  <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 text-xs text-slate-300 font-medium">
                    <span className="font-bold text-white uppercase">
                      👤 {order.driver_name || 'DRIVER'}
                    </span>
                    <span className="text-slate-600">&bull;</span>
                    <span className="text-amber-300 uppercase font-bold truncate max-w-[180px]">
                      🏢 {order.customer_company || 'CARRIER'}
                    </span>
                  </div>
                </div>

                {/* Bottom Product & Flow Rate Bar */}
                <div className="flex flex-col gap-1 bg-black/60 p-2 rounded border border-slate-800">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="text-slate-400 font-semibold text-[11px]">PROD:</span>
                      <span className="font-black text-amber-300 uppercase truncate">
                        {order.product_type}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-slate-400 font-semibold text-[11px]">VOLUME:</span>
                      <span className="font-mono font-black text-emerald-400 text-sm">
                        {order.volume_requested.toLocaleString()} {order.unit}
                      </span>
                    </div>
                  </div>

                  {/* Dispensing Flow Bar Indicator */}
                  {isLoading && (
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden flex">
                      <div className="bg-emerald-400 h-full w-2/3 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </main>
      ) : (
        /* ================= SCADA FLIGHT MANIFEST TABLE VIEW ================= */
        <main className="flex-1 flex flex-col p-4 bg-[#050810] scada-grid-bg overflow-y-auto">
          {/* Column Header */}
          <div className="grid grid-cols-[1.2fr_1.8fr_1.8fr_1.2fr_1fr_1.5fr] gap-4 px-4 py-3 bg-[#0a0f1d] border-b-2 border-amber-500/40 text-xs font-bold text-amber-400 uppercase tracking-widest">
            <div>Plate / Vehicle ID</div>
            <div>Carrier / Customer</div>
            <div>Product Specification</div>
            <div className="text-right">Volume ({baySlots[0]?.order?.unit || 'L'})</div>
            <div className="text-center">Bay Station</div>
            <div>Gantry Status</div>
          </div>

          {/* Active Rows */}
          <div className="divide-y divide-slate-800/80 bg-[#070b14]/90 rounded border border-slate-800">
            {baySlots.map((bay) => {
              const isOccupied = bay.is_occupied && bay.order;
              const order = bay.order;
              const isLoading = order?.status === 'LOADING';

              if (!isOccupied || !order) {
                return (
                  <div
                    key={bay.slot_number}
                    className="grid grid-cols-[1.2fr_1.8fr_1.8fr_1.2fr_1fr_1.5fr] gap-4 px-4 py-3.5 items-center text-sm text-slate-600 font-mono"
                  >
                    <div className="text-slate-600 font-bold">---</div>
                    <div className="text-slate-600 uppercase font-semibold">NO ACTIVE VEHICLE</div>
                    <div className="text-slate-600 font-sans text-xs">PUMPS STANDBY</div>
                    <div className="text-right text-slate-600 font-bold">0</div>
                    <div className="text-center font-bold text-slate-600">{bay.bay_label}</div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-700" />
                      <span className="text-xs font-bold tracking-wider text-slate-600">BAY VACANT</span>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={bay.slot_number}
                  className={`grid grid-cols-[1.2fr_1.8fr_1.8fr_1.2fr_1fr_1.5fr] gap-4 px-4 py-3.5 items-center text-sm font-mono transition-colors ${
                    isLoading ? 'bg-emerald-950/20 text-emerald-300' : 'bg-amber-950/20 text-amber-300'
                  } hover:bg-slate-800/50`}
                >
                  {/* Plate */}
                  <div className="font-black text-base tracking-wider text-amber-400 glow-amber">
                    {order.truck_number}
                  </div>

                  {/* Carrier */}
                  <div className="font-bold text-slate-200 uppercase truncate">
                    {order.customer_company}
                  </div>

                  {/* Product */}
                  <div className="font-medium text-slate-300 truncate">{order.product_type}</div>

                  {/* Volume */}
                  <div className="text-right font-black text-base text-emerald-400 tracking-tight">
                    {order.volume_requested.toLocaleString()}
                  </div>

                  {/* Bay */}
                  <div
                    className={`text-center font-black text-base ${
                      isLoading ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {bay.bay_label}
                  </div>

                  {/* Status */}
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-3 h-3 rounded-full ${
                        isLoading ? 'bg-emerald-400 animate-ping' : 'bg-amber-400 animate-pulse'
                      }`}
                    />
                    <span
                      className={`text-xs font-black tracking-wider ${
                        isLoading ? 'text-emerald-400' : 'text-amber-400 animate-pulse'
                      }`}
                    >
                      {isLoading ? 'DISPENSING IN PROGRESS' : 'AUTHORIZED &bull; PROCEED TO BAY'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      )}

      {/* Footer Ticker — Matching Terminal SCADA specifications */}
      <footer className="bg-[#090e1c] border-t-2 border-slate-800 h-11 shrink-0 flex items-center px-4 overflow-hidden relative shadow-2xl z-20">
        {/* Static SYS MSG Label */}
        <div className="bg-[#f59e0b] text-slate-950 text-xs font-black px-3 py-1 rounded shadow-md z-10 whitespace-nowrap flex items-center gap-1.5 absolute left-3">
          <span className="h-2 w-2 rounded-full bg-slate-950 animate-ping" />
          SYS MSG:
        </div>

        {/* Scrolling Ticker Container */}
        <div className="ml-32 w-full overflow-hidden whitespace-nowrap flex items-center">
          <div className="inline-block animate-marquee text-xs text-amber-300 tracking-widest font-mono drop-shadow-[0_0_6px_rgba(245,158,11,0.6)]">
            [INFO] WEATHER: {telemetry.weather} &nbsp;&bull;&nbsp;
            [OPERATIONS] TERMINAL CAPACITY: {telemetry.capacity_percent}% - OPERATIONS NOMINAL &nbsp;&bull;&nbsp;
            [TELEMETRY] CURRENT FLOW RATE: {telemetry.current_flow_rate} &nbsp;&bull;&nbsp;
            [NOTICE] VEHICLES WITH DISPLAYED NUMBER PLATES PROCEED DIRECTLY TO DESIGNATED BAYS D-01 TO D-09 &nbsp;&bull;&nbsp;
            [SAFETY] MANDATORY PPE, GROUNDING CLAMP &amp; ENGINE SHUTOFF BEFORE DISPENSING &nbsp;&bull;&nbsp;
            [DISPATCH] RELEASING THE WAYBILL AT THE LOADING DOCK AUTOMATICALLY CLEARS THE BAY ON THIS DISPLAY
          </div>
        </div>
      </footer>
    </div>
  );
}

export default TvDisplay;
