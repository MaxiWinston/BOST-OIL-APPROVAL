import { useState, useEffect, useRef, useCallback } from 'react';
import { orderApi } from '../../lib/api';
import type { TvDisplayData, TvBaySlot } from '../../types';

// Realistic Ghanaian Vehicle Number Plate Component
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
      className={`relative inline-flex items-center justify-between border-2 sm:border-[3px] border-black rounded-[5px] select-none ${
        isGiant
          ? 'h-24 sm:h-32 md:h-40 px-6 sm:px-10 max-w-4xl w-full shadow-2xl'
          : 'h-12 sm:h-14 md:h-15 px-3 sm:px-4 w-full max-w-[380px] shadow-lg'
      } ${isYellow ? 'number-plate-gh' : 'number-plate-white'}`}
    >
      {/* Screw Heads with 3D Depth */}
      <div className={`absolute top-1.5 left-2 rounded-full bg-neutral-900 border border-neutral-400 shadow-inner ${isGiant ? 'w-2.5 h-2.5' : 'w-1.5 h-1.5'}`} />
      <div className={`absolute top-1.5 right-2 rounded-full bg-neutral-900 border border-neutral-400 shadow-inner ${isGiant ? 'w-2.5 h-2.5' : 'w-1.5 h-1.5'}`} />
      <div className={`absolute bottom-1.5 left-2 rounded-full bg-neutral-900 border border-neutral-400 shadow-inner ${isGiant ? 'w-2.5 h-2.5' : 'w-1.5 h-1.5'}`} />
      <div className={`absolute bottom-1.5 right-2 rounded-full bg-neutral-900 border border-neutral-400 shadow-inner ${isGiant ? 'w-2.5 h-2.5' : 'w-1.5 h-1.5'}`} />

      {/* Ghana Flag Badge */}
      <div className={`flex flex-col items-center justify-center mr-2.5 sm:mr-3.5 px-1 py-0.5 bg-black/10 rounded border border-black/20 shrink-0 ${isGiant ? 'scale-125 sm:scale-150 mr-6 sm:mr-8' : 'scale-90 sm:scale-100'}`}>
        <div className="flex flex-col w-4 h-2.5 sm:w-5 sm:h-3 rounded-[1px] overflow-hidden border border-black/40 shadow-sm">
          <div className="h-1/3 bg-[#ce1126]" />
          <div className="h-1/3 bg-[#fcd116] flex items-center justify-center">
            <div className="w-1 h-1 bg-black rounded-full scale-75" />
          </div>
          <div className="h-1/3 bg-[#006b3f]" />
        </div>
        <span className="text-[8px] sm:text-[9px] font-black leading-tight text-black/90 font-sans mt-0.5">
          GH
        </span>
      </div>

      {/* Plate Registration Digits */}
      <div
        className={`flex-1 text-center font-mono font-black tracking-widest text-[#0a0a0a] drop-shadow-[0_1px_1px_rgba(255,255,255,0.75)] ${
          isGiant
            ? 'text-5xl sm:text-7xl md:text-8xl lg:text-9xl leading-none py-1'
            : 'text-2xl sm:text-3xl md:text-3xl lg:text-[2.5rem] leading-none'
        }`}
      >
        {formatted}
      </div>

      {/* Right spacer to balance badge */}
      <div className={isGiant ? 'w-6 sm:w-8 shrink-0' : 'w-3 sm:w-4 shrink-0'} />
    </div>
  );
}

// Web Audio API chime for bay dispatch callouts
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
    gain1.gain.setValueAtTime(0.16, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.45);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880.00, now + 0.18); // A5
    gain2.gain.setValueAtTime(0.2, now + 0.18);
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
  const [timeString, setTimeString] = useState<string>('');
  const [selectedBaySlot, setSelectedBaySlot] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [newlyAddedPlates, setNewlyAddedPlates] = useState<Set<string>>(new Set());

  const previousPlatesRef = useRef<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  // Live UTC Zulu Clock
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

  // Fetch telemetry
  const fetchTelemetry = useCallback(async () => {
    try {
      const res = await orderApi.getTvDisplay();
      setData(res);

      // Track new plates to chime & pulse
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
        playBayChime();
        setTimeout(() => setNewlyAddedPlates(new Set()), 8000);
      }

      previousPlatesRef.current = currentPlates;
    } catch (err) {
      console.warn('Telemetry fetch error:', err);
    }
  }, []);

  useEffect(() => {
    fetchTelemetry();
    const timer = setInterval(fetchTelemetry, 3000);
    return () => clearInterval(timer);
  }, [fetchTelemetry]);

  // Keyboard navigation
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

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => undefined);
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => undefined);
    }
  };

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // 9 Bay Slots (BAY 01 to BAY 09)
  const baySlots: TvBaySlot[] = data?.bays || Array.from({ length: 9 }, (_, i) => ({
    slot_number: i + 1,
    bay_label: `BAY ${(i + 1).toString().padStart(2, '0')}`,
    is_occupied: false,
    order: null,
  }));

  const occupiedCount = baySlots.filter((b) => b.is_occupied).length;
  const loadingCount = baySlots.filter((b) => b.order?.status === 'LOADING').length;
  const readyCount = occupiedCount - loadingCount;
  const activeSpotlightBay = selectedBaySlot ? baySlots.find((b) => b.slot_number === selectedBaySlot) : null;

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-screen w-screen bg-[#070b14] text-slate-100 font-mono select-none overflow-hidden"
    >
      {/* Top Header */}
      <header className="flex items-center justify-between px-5 py-2.5 bg-[#0c1322] border-b-2 border-amber-500/40 shrink-0 shadow-lg z-20">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center p-1.5 rounded bg-amber-500/10 border border-amber-500/30">
            <span className="text-lg">⛽</span>
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black tracking-widest text-amber-400 uppercase font-mono">
              BOST OIL DEPOT &bull; GANTRY LOADING BAYS
            </h1>
            <p className="text-[11px] text-slate-400 font-sans tracking-wide">
              {data?.depot_name || 'TEMA CENTRAL GANTRY TERMINAL — BAYS 01 TO 09'}
            </p>
          </div>
        </div>

        {/* Live Badges & Clock */}
        <div className="flex items-center gap-3.5">
          <div className="hidden sm:flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded border border-slate-800 text-xs">
            <span className="text-slate-400 font-semibold">ACTIVE BAYS:</span>
            <span className="text-amber-400 font-black font-mono">{occupiedCount} / 9</span>
            <span className="text-slate-700">|</span>
            <span className="text-amber-300 font-bold">{readyCount} AUTHORIZED</span>
            <span className="text-slate-700">|</span>
            <span className="text-emerald-400 font-bold">{loadingCount} LOADING</span>
          </div>

          <div className="flex items-center gap-1.5 bg-[#04060d] px-3 py-1.5 rounded border border-amber-500/40 shadow-inner">
            <span className="text-xs text-slate-400 font-bold">UTC:</span>
            <span className="text-base font-black text-amber-400 tracking-wider font-mono glow-amber">
              {timeString || '--:--:--'}
            </span>
            <span className="text-xs text-amber-500 font-black animate-pulse">Z</span>
          </div>

          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            className="p-2 rounded bg-slate-900 border border-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </button>
        </div>
      </header>

      {/* ================= 9-SQUARED (3x3) SECTIONED GRID ================= */}
      <main className="flex-1 grid grid-cols-1 md:grid-cols-3 grid-rows-3 gap-2.5 p-2.5 bg-[#050811] scada-grid-bg overflow-hidden">
        {baySlots.map((bay) => {
          const isOccupied = bay.is_occupied && bay.order;
          const order = bay.order;
          const isLoading = order?.status === 'LOADING';
          const isNewlyAdded = order?.truck_number ? newlyAddedPlates.has(order.truck_number) : false;

          if (!isOccupied || !order) {
            // --- VACANT / STANDBY SQUARE ---
            return (
              <div
                key={bay.slot_number}
                onClick={() => setSelectedBaySlot(bay.slot_number)}
                className="flex flex-col justify-between p-3.5 rounded-lg bg-[#0a0f1c]/70 border border-slate-800/80 cursor-pointer hover:border-slate-700 transition-colors group"
              >
                {/* Header Row */}
                <div className="flex items-center justify-between border-b border-slate-800/60 pb-1.5">
                  <span className="text-base sm:text-lg font-black text-slate-500 tracking-wider">
                    {bay.bay_label}
                  </span>
                  <span className="text-[11px] font-bold text-slate-600 uppercase bg-black/40 px-2 py-0.5 rounded border border-slate-800">
                    STANDBY
                  </span>
                </div>

                {/* Center */}
                <div className="my-auto text-center py-2">
                  <p className="text-2xl sm:text-3xl font-black text-slate-700/80 tracking-widest uppercase font-mono">
                    BAY VACANT
                  </p>
                  <p className="text-[11px] text-slate-600 font-sans mt-0.5">
                    Ready for Next Tanker
                  </p>
                </div>

                {/* Bottom Row */}
                <div className="text-[11px] text-slate-600 border-t border-slate-800/40 pt-1 flex justify-between">
                  <span>GANTRY GATE #{bay.slot_number}</span>
                  <span className="text-emerald-500/70 font-semibold">&bull; ARMED</span>
                </div>
              </div>
            );
          }

          // --- OCCUPIED / AUTHORIZED SQUARE ---
          return (
            <div
              key={bay.slot_number}
              onClick={() => setSelectedBaySlot(bay.slot_number)}
              className={`flex flex-col justify-between p-3 rounded-lg shadow-xl cursor-pointer transition-all duration-300 ${
                isNewlyAdded
                  ? 'ring-4 ring-amber-400 bg-[#121828] border-2 border-amber-400 animate-pulse'
                  : isLoading
                  ? 'bg-gradient-to-b from-[#091522] to-[#060e18] border-2 border-emerald-500/80 hover:border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                  : 'bg-gradient-to-b from-[#14141d] to-[#090b14] border-2 border-amber-500/80 hover:border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.15)]'
              }`}
            >
              {/* Header Row: Bay Label & Status Badge */}
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-3 h-3 rounded-full ${
                      isLoading ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-ping'
                    }`}
                  />
                  <span
                    className={`text-base sm:text-lg font-black tracking-wider ${
                      isLoading ? 'text-emerald-400 glow-emerald' : 'text-amber-400 glow-amber'
                    }`}
                  >
                    {bay.bay_label}
                  </span>
                </div>

                <span
                  className={`px-2.5 py-0.5 rounded text-[11px] font-black uppercase tracking-wider ${
                    isLoading
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-600'
                      : 'bg-amber-950 text-amber-300 border border-amber-600 animate-pulse'
                  }`}
                >
                  {isLoading ? '⛽ DISPENSING' : '⚡ PROCEED TO BAY'}
                </span>
              </div>

              {/* Center: Vehicle Number Plate */}
              <div className="my-auto py-1 flex items-center justify-center">
                <RealisticNumberPlate
                  plateNumber={order.truck_number}
                  variant={isLoading ? 'white' : 'yellow'}
                />
              </div>

              {/* Driver & Carrier Subtitle */}
              <div className="flex items-center justify-between text-xs px-1 text-slate-300 font-medium">
                <span className="font-bold text-white uppercase truncate max-w-[140px]">
                  👤 {order.driver_name || 'DRIVER'}
                </span>
                <span className="text-amber-300 uppercase font-semibold truncate max-w-[140px]">
                  🏢 {order.customer_company || 'CARRIER'}
                </span>
              </div>

              {/* Bottom Row: Product & Volume Bar */}
              <div className="flex items-center justify-between bg-black/60 px-3 py-1 rounded border border-slate-800/80 text-xs mt-1">
                <span className="font-bold text-cyan-300 uppercase truncate">
                  {order.product_type}
                </span>
                <span className="font-mono font-black text-emerald-400 text-xs sm:text-sm pl-2">
                  {order.volume_requested.toLocaleString()} {order.unit}
                </span>
              </div>
            </div>
          );
        })}
      </main>

      {/* Footer Ticker */}
      <footer className="bg-[#0c1322] border-t-2 border-slate-800 h-8 shrink-0 flex items-center px-4 overflow-hidden relative shadow-lg z-20">
        <div className="bg-amber-500 text-slate-950 text-[11px] font-black px-2.5 py-0.5 rounded shadow z-10 whitespace-nowrap flex items-center gap-1 absolute left-3">
          <span className="h-1.5 w-1.5 rounded-full bg-slate-950 animate-ping" />
          SYS MSG:
        </div>

        <div className="ml-24 w-full overflow-hidden whitespace-nowrap flex items-center">
          <div className="inline-block animate-marquee text-xs text-amber-300 tracking-wider font-mono">
            [NOTICE] DRIVERS WITH DISPLAYED NUMBER PLATES PROCEED DIRECTLY TO DESIGNATED GANTRY BAY &nbsp;&bull;&nbsp;
            [SAFETY] MANDATORY PPE, GROUNDING CLAMP &amp; ENGINE SHUTOFF BEFORE DISPENSING &nbsp;&bull;&nbsp;
            [DISPATCH] RELEASING THE WAYBILL AT THE LOADING DOCK AUTOMATICALLY CLEARS THE BAY ON THIS SCREEN &nbsp;&bull;&nbsp;
            [TIP] CLICK ANY BAY SQUARE TO EXPAND FULL SCREEN
          </div>
        </div>
      </footer>

      {/* ========================================================================= */}
      {/* FULL-PAGE BAY SPOTLIGHT TAKEOVER (When clicking any bay)                  */}
      {/* ========================================================================= */}
      {selectedBaySlot !== null && activeSpotlightBay && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-[#050814]/98 backdrop-blur-md animate-in fade-in duration-150 p-6 md:p-10 justify-between"
          onClick={() => setSelectedBaySlot(null)}
        >
          {/* Top Bar */}
          <div
            className="flex items-center justify-between border-b-2 border-slate-800 pb-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <span className="w-3.5 h-3.5 rounded-full bg-amber-400 animate-ping" />
              <h2 className="text-2xl sm:text-3xl font-black text-amber-400 uppercase tracking-widest font-mono glow-amber">
                {activeSpotlightBay.bay_label} SPOTLIGHT
              </h2>
            </div>

            <button
              onClick={() => setSelectedBaySlot(null)}
              className="px-4 py-2 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black tracking-wider uppercase transition-colors flex items-center gap-2"
            >
              <span>✕</span>
              <span>CLOSE (ESC)</span>
            </button>
          </div>

          {/* Center Body */}
          <div
            className="flex flex-col items-center justify-center text-center my-auto space-y-6"
            onClick={(e) => e.stopPropagation()}
          >
            {activeSpotlightBay.is_occupied && activeSpotlightBay.order ? (
              <>
                {/* Calling Status Banner */}
                <div
                  className={`px-8 py-2.5 rounded-full text-center font-black tracking-widest uppercase text-base sm:text-xl border-2 ${
                    activeSpotlightBay.order.status === 'LOADING'
                      ? 'bg-emerald-950 text-emerald-200 border-emerald-500'
                      : 'bg-amber-950 text-amber-200 border-amber-400 animate-pulse'
                  }`}
                >
                  {activeSpotlightBay.order.status === 'LOADING'
                    ? '⛽ DISPENSING IN PROGRESS'
                    : `⚡ PROCEED IMMEDIATELY TO ${activeSpotlightBay.bay_label}`}
                </div>

                {/* Giant Horizontal License Plate */}
                <div className="py-2 w-full flex justify-center">
                  <RealisticNumberPlate
                    plateNumber={activeSpotlightBay.order.truck_number}
                    variant={activeSpotlightBay.order.status === 'LOADING' ? 'white' : 'yellow'}
                    isGiant={true}
                  />
                </div>

                {/* Driver & Commercial Details Bar */}
                <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-8 text-lg sm:text-xl text-slate-200 font-bold bg-black/50 px-8 py-3 rounded-lg border border-slate-800 shadow-2xl">
                  <span>👤 DRIVER: {activeSpotlightBay.order.driver_name}</span>
                  <span className="text-slate-600">&bull;</span>
                  <span className="text-amber-300">🏢 CARRIER: {activeSpotlightBay.order.customer_company}</span>
                  <span className="text-slate-600">&bull;</span>
                  <span className="text-cyan-300">⛽ PROD: {activeSpotlightBay.order.product_type}</span>
                  <span className="text-slate-600">&bull;</span>
                  <span className="text-emerald-400 font-mono">
                    📦 VOLUME: {activeSpotlightBay.order.volume_requested.toLocaleString()} {activeSpotlightBay.order.unit}
                  </span>
                </div>
              </>
            ) : (
              <div className="space-y-3 py-8">
                <h3 className="text-5xl font-black text-slate-600 font-mono tracking-widest uppercase">
                  {activeSpotlightBay.bay_label} IS VACANT
                </h3>
                <p className="text-lg text-slate-500">Ready for next authorized vehicle</p>
              </div>
            )}
          </div>

          {/* Footer Navigation */}
          <div
            className="flex items-center justify-between text-xs text-slate-500 border-t border-slate-800/80 pt-3"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedBaySlot((prev) => (prev !== null ? (prev === 1 ? 9 : prev - 1) : 1))}
              className="hover:text-white transition-colors"
            >
              ◀ Previous Bay
            </button>
            <span className="text-slate-600">CLICK ANYWHERE OR PRESS ESC TO RETURN</span>
            <button
              onClick={() => setSelectedBaySlot((prev) => (prev !== null ? (prev % 9) + 1 : 1))}
              className="hover:text-white transition-colors"
            >
              Next Bay ▶
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default TvDisplay;
