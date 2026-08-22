import { useState, useEffect, useRef, useCallback } from 'react';
import { orderApi } from '../../lib/api';
import type { TvDisplayData, TvBaySlot } from '../../types';

// Realistic Ghanaian / Industrial License Plate Component
function RealisticNumberPlate({
  plateNumber,
  variant = 'yellow',
  isGiant = false,
}: {
  plateNumber: string;
  variant?: 'yellow' | 'white';
  isGiant?: boolean;
}) {
  const isYellow = variant === 'yellow';
  const formatted = plateNumber.toUpperCase().trim();

  return (
    <div
      className={`relative inline-flex items-center justify-between border-2 border-black rounded-[6px] select-none ${
        isGiant
          ? 'px-6 py-3 min-w-[340px] md:min-w-[540px] shadow-[0_0_35px_rgba(245,158,11,0.4)]'
          : 'px-3 py-1.5 min-w-[240px]'
      } ${isYellow ? 'number-plate-gh' : 'number-plate-white'}`}
    >
      {/* Screw Heads with realistic 3D depth */}
      <div className={`absolute top-1.5 left-2 rounded-full bg-neutral-900 border border-neutral-400 shadow-inner ${isGiant ? 'w-2.5 h-2.5' : 'w-1.5 h-1.5'}`} />
      <div className={`absolute top-1.5 right-2 rounded-full bg-neutral-900 border border-neutral-400 shadow-inner ${isGiant ? 'w-2.5 h-2.5' : 'w-1.5 h-1.5'}`} />
      <div className={`absolute bottom-1.5 left-2 rounded-full bg-neutral-900 border border-neutral-400 shadow-inner ${isGiant ? 'w-2.5 h-2.5' : 'w-1.5 h-1.5'}`} />
      <div className={`absolute bottom-1.5 right-2 rounded-full bg-neutral-900 border border-neutral-400 shadow-inner ${isGiant ? 'w-2.5 h-2.5' : 'w-1.5 h-1.5'}`} />

      {/* Ghana Flag Badge on Left */}
      <div className={`flex flex-col items-center justify-center mr-3 px-1.5 py-1 bg-black/10 rounded border border-black/20 shrink-0 ${isGiant ? 'scale-125 mr-5' : ''}`}>
        <div className="flex flex-col w-5 h-3 rounded-[1px] overflow-hidden border border-black/50 shadow-sm">
          <div className="h-1/3 bg-[#ce1126]" />
          <div className="h-1/3 bg-[#fcd116] flex items-center justify-center">
            <div className="w-1.5 h-1.5 bg-black rounded-full scale-75" />
          </div>
          <div className="h-1/3 bg-[#006b3f]" />
        </div>
        <span className="text-[10px] font-black leading-tight tracking-tighter text-black/90 font-sans mt-0.5">
          GH
        </span>
      </div>

      {/* Plate Registration Number */}
      <div
        className={`flex-1 text-center font-mono font-black tracking-widest text-[#0a0a0a] drop-shadow-[0_1px_1px_rgba(255,255,255,0.7)] ${
          isGiant
            ? 'text-4xl sm:text-6xl md:text-7xl lg:text-8xl py-1'
            : 'text-2xl sm:text-3xl md:text-3xl lg:text-4xl'
        }`}
      >
        {formatted}
      </div>

      {/* Right spacer to balance badge */}
      <div className={isGiant ? 'w-8 shrink-0' : 'w-4 shrink-0'} />
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
  const [selectedBaySlot, setSelectedBaySlot] = useState<number | null>(null);
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

  // Keyboard navigation: ESC to close full-screen spotlight, Arrow keys to switch bays
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedBaySlot(null);
      } else if (e.key === 'ArrowRight' && selectedBaySlot !== null) {
        setSelectedBaySlot((prev) => (prev !== null ? (prev % 9) + 1 : 1));
      } else if (e.key === 'ArrowLeft' && selectedBaySlot !== null) {
        setSelectedBaySlot((prev) => (prev !== null ? (prev === 1 ? 9 : prev - 1) : 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedBaySlot]);

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

  const activeSpotlightBay = selectedBaySlot ? baySlots.find((b) => b.slot_number === selectedBaySlot) : null;

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
                  onClick={() => setSelectedBaySlot(bay.slot_number)}
                  className="flex flex-col justify-between p-3.5 rounded bg-[#090d18]/80 border border-slate-800/80 shadow-inner relative overflow-hidden group hover:border-slate-600 hover:bg-[#0c1222] transition-all cursor-pointer"
                >
                  {/* Bay Header */}
                  <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-600 shadow-sm" />
                      <span className="text-sm font-black text-slate-400 tracking-wider">
                        {bay.bay_label}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 bg-black/60 px-2 py-0.5 rounded border border-slate-800 group-hover:text-amber-400">
                      STANDBY &bull; CLICK TO EXPAND
                    </span>
                  </div>

                  {/* Center Radar / Standby Graphic */}
                  <div className="flex flex-col items-center justify-center my-auto text-center space-y-1">
                    <div className="relative flex items-center justify-center w-12 h-12 rounded-full border border-slate-800 bg-black/40">
                      <span className="text-xs font-mono font-bold text-slate-600">D-0{bay.slot_number}</span>
                      <span className="absolute inset-0 rounded-full border border-dashed border-slate-700 animate-[spin_20s_linear_infinite]" />
                    </div>
                    <p className="text-xl md:text-2xl font-black text-slate-600 tracking-widest uppercase font-mono group-hover:text-slate-400 transition-colors">
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
                onClick={() => setSelectedBaySlot(bay.slot_number)}
                className={`flex flex-col justify-between p-3.5 rounded shadow-2xl relative overflow-hidden transition-all duration-300 cursor-pointer group hover:scale-[1.01] ${
                  isNewlyAdded
                    ? 'ring-4 ring-amber-400 bg-gradient-to-br from-amber-950/70 via-[#0e1628] to-[#080d19] border-amber-400 animate-pulse'
                    : isLoading
                    ? 'bg-gradient-to-br from-emerald-950/50 via-[#0b1526] to-[#060b14] border-2 border-emerald-500/80 shadow-[0_0_20px_rgba(16,185,129,0.15)] hover:border-emerald-400'
                    : 'bg-gradient-to-br from-amber-950/40 via-[#0b1526] to-[#060b14] border-2 border-amber-500/80 shadow-[0_0_20px_rgba(245,158,11,0.15)] hover:border-amber-400'
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

                  <div className="flex items-center gap-2">
                    <span className="hidden sm:inline-block text-[9px] font-bold text-slate-400 opacity-60 group-hover:opacity-100 transition-opacity">
                      [CLICK FOR FULLSCREEN]
                    </span>
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
                </div>

                {/* Center: REALISTIC VEHICLE REGISTRATION PLATE */}
                <div className="my-auto py-1.5 flex flex-col items-center justify-center">
                  <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1 group-hover:text-amber-300 transition-colors">
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
                    onClick={() => setSelectedBaySlot(bay.slot_number)}
                    className="grid grid-cols-[1.2fr_1.8fr_1.8fr_1.2fr_1fr_1.5fr] gap-4 px-4 py-3.5 items-center text-sm text-slate-600 font-mono cursor-pointer hover:bg-slate-900/50 transition-colors"
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
                  onClick={() => setSelectedBaySlot(bay.slot_number)}
                  className={`grid grid-cols-[1.2fr_1.8fr_1.8fr_1.2fr_1fr_1.5fr] gap-4 px-4 py-3.5 items-center text-sm font-mono transition-colors cursor-pointer ${
                    isLoading ? 'bg-emerald-950/20 text-emerald-300' : 'bg-amber-950/20 text-amber-300'
                  } hover:bg-slate-800/60`}
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
            [DISPATCH] RELEASING THE WAYBILL AT THE LOADING DOCK AUTOMATICALLY CLEARS THE BAY ON THIS DISPLAY &nbsp;&bull;&nbsp;
            [TIP] CLICK ANY BAY TO EXPAND TO FULL SCREEN SPOTLIGHT CALLOUT
          </div>
        </div>
      </footer>

      {/* ========================================================================= */}
      {/* FULL-PAGE BAY SPOTLIGHT TAKEOVER (Covers the entire screen on click)     */}
      {/* ========================================================================= */}
      {selectedBaySlot !== null && activeSpotlightBay && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-[#050814]/98 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200"
          onClick={() => setSelectedBaySlot(null)}
        >
          {/* Scanline CRT overlay effect */}
          <div className="absolute inset-0 scanline-overlay z-30 pointer-events-none opacity-40" />

          {/* Fullpage Top Navigation Header */}
          <div
            className="flex items-center justify-between px-8 py-4 bg-[#0a0f24] border-b-4 border-amber-500 z-40 shrink-0 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-4">
              <span className="w-4 h-4 rounded-full bg-amber-400 animate-ping" />
              <div>
                <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-amber-400 uppercase tracking-widest glow-amber">
                  GANTRY BAY CALLOUT &bull; {activeSpotlightBay.bay_label}
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 font-sans">
                  HIGH PRIORITY DRIVER DISPATCH &bull; BOST TEMA CENTRAL TERMINAL
                </p>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3">
              {/* Prev Bay */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedBaySlot((prev) => (prev !== null ? (prev === 1 ? 9 : prev - 1) : 1));
                }}
                className="px-3 py-1.5 rounded bg-slate-900 border border-slate-700 text-xs font-bold text-slate-300 hover:bg-slate-800 hover:text-white"
              >
                ◀ Prev (Bay D-0{selectedBaySlot === 1 ? 9 : selectedBaySlot - 1})
              </button>

              {/* Next Bay */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedBaySlot((prev) => (prev !== null ? (prev % 9) + 1 : 1));
                }}
                className="px-3 py-1.5 rounded bg-slate-900 border border-slate-700 text-xs font-bold text-slate-300 hover:bg-slate-800 hover:text-white"
              >
                Next (Bay D-0{(selectedBaySlot % 9) + 1}) ▶
              </button>

              {/* Close / Return Button */}
              <button
                onClick={() => setSelectedBaySlot(null)}
                className="px-4 py-2 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-black tracking-wider uppercase transition-colors shadow-lg flex items-center gap-2"
              >
                <span>✕</span>
                <span>Return to 9-Bay Matrix (ESC)</span>
              </button>
            </div>
          </div>

          {/* Fullpage Content Body */}
          <div
            className="flex-1 flex flex-col justify-between p-6 sm:p-10 max-w-7xl w-full mx-auto z-40 scada-grid-bg my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {activeSpotlightBay.is_occupied && activeSpotlightBay.order ? (
              /* Occupied Full Screen Calling Gate */
              <div className="flex-1 flex flex-col justify-between space-y-6">
                {/* Calling Banner */}
                <div
                  className={`py-3 px-6 rounded-lg text-center font-black tracking-widest uppercase text-base sm:text-xl border-2 shadow-2xl flex items-center justify-center gap-3 ${
                    activeSpotlightBay.order.status === 'LOADING'
                      ? 'bg-emerald-950 text-emerald-200 border-emerald-500 animate-pulse'
                      : 'bg-amber-950 text-amber-200 border-amber-400 animate-bounce'
                  }`}
                >
                  <span className="text-2xl">{activeSpotlightBay.order.status === 'LOADING' ? '⛽' : '🚨'}</span>
                  <span>
                    {activeSpotlightBay.order.status === 'LOADING'
                      ? 'DISPENSING IN PROGRESS &bull; VEHICLE LOCKED IN BAY'
                      : `ATTENTION: PROCEED IMMEDIATELY TO ${activeSpotlightBay.bay_label}`}
                  </span>
                </div>

                {/* Main Plate Center Stage */}
                <div className="flex flex-col items-center justify-center text-center py-4 sm:py-6">
                  <p className="text-xs sm:text-sm font-bold uppercase tracking-[0.3em] text-slate-400 mb-3">
                    ASSIGNED TANKER REGISTRATION NUMBER
                  </p>

                  {/* Giant Embossed Plate */}
                  <RealisticNumberPlate
                    plateNumber={activeSpotlightBay.order.truck_number}
                    variant={activeSpotlightBay.order.status === 'LOADING' ? 'white' : 'yellow'}
                    isGiant={true}
                  />

                  {/* Assigned Bay Designation */}
                  <div className="mt-5 flex items-center gap-4">
                    <span className="text-xl sm:text-2xl font-bold text-slate-400">ASSIGNED TO:</span>
                    <span className="text-3xl sm:text-4xl md:text-5xl font-black text-amber-400 font-mono tracking-widest glow-amber">
                      {activeSpotlightBay.bay_label}
                    </span>
                  </div>
                </div>

                {/* Driver & Commercial Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-[#090e1f] p-5 rounded-xl border-2 border-slate-700 shadow-2xl">
                  {/* Driver */}
                  <div className="flex flex-col border-b sm:border-b-0 sm:border-r border-slate-800 pb-3 sm:pb-0 sm:pr-4">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Assigned Driver
                    </span>
                    <span className="text-lg sm:text-xl font-black text-white uppercase mt-1">
                      👤 {activeSpotlightBay.order.driver_name}
                    </span>
                    <span className="text-[11px] text-slate-500 mt-0.5">Verified Commercial Operator</span>
                  </div>

                  {/* Transporter / Customer */}
                  <div className="flex flex-col border-b sm:border-b-0 sm:border-r border-slate-800 pb-3 sm:pb-0 sm:pr-4">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Commercial Carrier / BDC
                    </span>
                    <span className="text-lg sm:text-xl font-black text-amber-300 uppercase mt-1 truncate">
                      🏢 {activeSpotlightBay.order.customer_company}
                    </span>
                    <span className="text-[11px] text-slate-500 mt-0.5">Permit Ref: {activeSpotlightBay.order.npa_reference_number}</span>
                  </div>

                  {/* Product & Volume */}
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Product &amp; Dispense Volume
                    </span>
                    <div className="flex items-baseline justify-between mt-1">
                      <span className="text-base sm:text-lg font-black text-cyan-300 uppercase">
                        {activeSpotlightBay.order.product_type}
                      </span>
                      <span className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">
                        {activeSpotlightBay.order.volume_requested.toLocaleString()} {activeSpotlightBay.order.unit}
                      </span>
                    </div>
                    <span className="text-[11px] text-emerald-500/90 font-mono mt-0.5">
                      Flow: 850 L/MIN &bull; Pressure: 68.4 PSI
                    </span>
                  </div>
                </div>

                {/* Safety Protocol Banner */}
                <div className="bg-amber-950/40 border border-amber-600/50 p-3 rounded text-center text-xs text-amber-200 font-sans tracking-wide">
                  ⚠️ <strong>SAFETY MANDATE:</strong> Chock wheels, connect earthing grounding clamp, shut off ignition, and confirm vapor recovery coupling before flow activation.
                </div>
              </div>
            ) : (
              /* Vacant Bay Full Screen View */
              <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 py-12">
                <div className="relative flex items-center justify-center w-24 h-24 rounded-full border-2 border-slate-700 bg-black/60">
                  <span className="text-2xl font-mono font-bold text-slate-500">D-0{selectedBaySlot}</span>
                  <span className="absolute inset-0 rounded-full border-2 border-dashed border-slate-600 animate-[spin_15s_linear_infinite]" />
                </div>
                <div>
                  <h3 className="text-4xl sm:text-5xl font-black text-slate-400 font-mono tracking-widest uppercase">
                    {activeSpotlightBay.bay_label} IS VACANT
                  </h3>
                  <p className="text-base sm:text-lg text-slate-500 font-sans mt-2">
                    All dispensing pumps are idle and armed &bull; Ready for next authorized dispatch
                  </p>
                </div>
                <div className="pt-4">
                  <button
                    onClick={() => setSelectedBaySlot(null)}
                    className="px-6 py-2.5 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm tracking-wider uppercase border border-slate-600"
                  >
                    Return to 9-Bay Matrix
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Fullpage Footer */}
          <div className="px-8 py-3 bg-[#0a0f24] border-t-2 border-slate-800 flex items-center justify-between text-xs text-slate-400 z-40">
            <span>BOST CENTRAL GANTRY TELEMETRY &bull; REAL-TIME YARD BROADCAST</span>
            <span className="text-amber-400 font-mono font-bold">CLICK ANYWHERE OR PRESS ESC TO RETURN</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default TvDisplay;
