import { useState, useEffect, useRef, useCallback } from 'react';
import { orderApi } from '../../lib/api';
import type { TvDisplayData, TvBaySlot } from '../../types';

// Clean, High-Legibility Ghanaian License Plate
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
      className={`relative inline-flex items-center justify-between border-2 sm:border-[3px] border-black rounded-[6px] select-none ${
        isGiant
          ? 'px-8 py-5 min-w-[360px] md:min-w-[720px] max-w-full shadow-2xl'
          : 'px-3 sm:px-5 py-2.5 sm:py-3.5 w-full max-w-[440px] shadow-lg'
      } ${isYellow ? 'number-plate-gh' : 'number-plate-white'}`}
    >
      {/* Ghana Flag Badge */}
      <div className={`flex flex-col items-center justify-center mr-3 sm:mr-4 px-1.5 py-0.5 bg-black/10 rounded border border-black/20 shrink-0 ${isGiant ? 'scale-150 mr-8' : 'scale-110'}`}>
        <div className="flex flex-col w-5 h-3.5 rounded-[1px] overflow-hidden border border-black/40 shadow-sm">
          <div className="h-1/3 bg-[#ce1126]" />
          <div className="h-1/3 bg-[#fcd116] flex items-center justify-center">
            <div className="w-1.5 h-1.5 bg-black rounded-full scale-75" />
          </div>
          <div className="h-1/3 bg-[#006b3f]" />
        </div>
        <span className="text-[10px] font-black leading-tight text-black/90 font-sans mt-0.5">
          GH
        </span>
      </div>

      {/* Plate Digits (Extra Large) */}
      <div
        className={`flex-1 text-center font-mono font-black tracking-widest text-[#0a0a0a] drop-shadow-[0_2px_2px_rgba(255,255,255,0.7)] ${
          isGiant
            ? 'text-6xl sm:text-8xl md:text-9xl lg:text-[9.5rem] leading-none py-2'
            : 'text-3xl sm:text-4xl md:text-5xl lg:text-[3.2rem] leading-none'
        }`}
      >
        {formatted}
      </div>

      {/* Spacer to balance badge */}
      <div className={isGiant ? 'w-8 shrink-0' : 'w-4 shrink-0'} />
    </div>
  );
}

// Web Audio API chime
function playBayChime() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.15, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.4);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880.00, now + 0.15);
    gain2.gain.setValueAtTime(0.2, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.7);
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

  // Live UTC Clock
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
    const timer = setInterval(fetchTelemetry, 3500);
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
  const activeSpotlightBay = selectedBaySlot ? baySlots.find((b) => b.slot_number === selectedBaySlot) : null;

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-screen w-screen bg-[#070b14] text-slate-100 font-mono select-none overflow-hidden"
    >
      {/* Top Header - Clean, Focused, Readable */}
      <header className="flex items-center justify-between px-6 py-3 bg-[#0c1322] border-b border-slate-800 shrink-0 shadow-lg z-20">
        <div className="flex items-center gap-3">
          <span className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
          <h1 className="text-lg md:text-xl font-black tracking-widest text-slate-100 uppercase font-mono">
            BOST OIL DEPOT &bull; LOADING BAYS MONITOR
          </h1>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-xs font-bold text-slate-400 bg-slate-900 px-3 py-1.5 rounded border border-slate-800">
            ACTIVE BAYS: <span className="text-amber-400 font-mono">{occupiedCount} / 9</span>
          </div>

          <div className="flex items-center gap-1.5 bg-black/60 px-3 py-1 rounded border border-slate-700">
            <span className="text-xs text-slate-400 font-bold">UTC:</span>
            <span className="text-base font-bold text-amber-400 tracking-wider font-mono">
              {timeString || '--:--:--'}
            </span>
            <span className="text-xs text-amber-500 font-black animate-pulse">Z</span>
          </div>

          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            className="p-1.5 rounded bg-slate-900 border border-slate-700 text-slate-400 hover:text-white"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </button>
        </div>
      </header>

      {/* ================= 9-SQUARED (3x3) SECTIONED GRID ================= */}
      <main className="flex-1 grid grid-cols-1 md:grid-cols-3 grid-rows-3 gap-3 p-3 bg-[#050811] overflow-hidden">
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
                className="flex flex-col justify-between p-4 rounded-lg bg-[#0a0f1c]/70 border border-slate-800/80 cursor-pointer hover:border-slate-700 transition-colors group"
              >
                <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                  <span className="text-xl sm:text-2xl font-black text-slate-500 tracking-wider">
                    {bay.bay_label}
                  </span>
                  <span className="text-xs font-bold text-slate-600 uppercase">
                    STANDBY
                  </span>
                </div>

                <div className="my-auto text-center py-4">
                  <p className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-700/80 tracking-widest uppercase font-mono">
                    VACANT
                  </p>
                </div>

                <div className="text-xs text-slate-600 border-t border-slate-800/40 pt-1.5 flex justify-between">
                  <span>BAY {bay.slot_number}</span>
                  <span>READY</span>
                </div>
              </div>
            );
          }

          // --- OCCUPIED / AUTHORIZED SQUARE ---
          return (
            <div
              key={bay.slot_number}
              onClick={() => setSelectedBaySlot(bay.slot_number)}
              className={`flex flex-col justify-between p-4 rounded-lg shadow-xl cursor-pointer transition-all duration-300 ${
                isNewlyAdded
                  ? 'ring-4 ring-amber-400 bg-[#121828] border-2 border-amber-400 animate-pulse'
                  : isLoading
                  ? 'bg-gradient-to-b from-[#091522] to-[#060e18] border-2 border-emerald-500/80 hover:border-emerald-400'
                  : 'bg-gradient-to-b from-[#14141d] to-[#090b14] border-2 border-amber-500/80 hover:border-amber-400'
              }`}
            >
              {/* Header: Bay Label & Status */}
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-3.5 h-3.5 rounded-full ${
                      isLoading ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-ping'
                    }`}
                  />
                  <span
                    className={`text-xl sm:text-2xl md:text-3xl font-black tracking-wider ${
                      isLoading ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {bay.bay_label}
                  </span>
                </div>

                <span
                  className={`px-3 py-1 rounded text-xs sm:text-sm font-black uppercase tracking-wider ${
                    isLoading
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-600'
                      : 'bg-amber-950 text-amber-300 border border-amber-600'
                  }`}
                >
                  {isLoading ? '⛽ LOADING' : '⚡ PROCEED TO BAY'}
                </span>
              </div>

              {/* Center: BIG BOLD LICENSE PLATE */}
              <div className="my-auto py-2 flex flex-col items-center justify-center">
                <RealisticNumberPlate
                  plateNumber={order.truck_number}
                  variant={isLoading ? 'white' : 'yellow'}
                />

                {order.driver_name && (
                  <p className="mt-2.5 text-xs sm:text-sm text-slate-300 font-bold uppercase tracking-wide">
                    👤 {order.driver_name}
                  </p>
                )}
              </div>

              {/* Bottom: Product & Volume */}
              <div className="flex items-center justify-between bg-black/60 px-3.5 py-2 rounded border border-slate-800/80 text-xs sm:text-sm">
                <span className="font-bold text-slate-200 uppercase truncate">
                  {order.product_type}
                </span>
                <span className="font-mono font-black text-emerald-400 text-sm sm:text-base">
                  {order.volume_requested.toLocaleString()} {order.unit}
                </span>
              </div>
            </div>
          );
        })}
      </main>

      {/* Footer Ticker - Clean & Single-Line */}
      <footer className="bg-[#0c1322] border-t border-slate-800 h-9 shrink-0 flex items-center px-4 overflow-hidden relative shadow-lg z-20">
        <div className="bg-amber-500 text-slate-950 text-[11px] font-black px-2 py-0.5 rounded shadow z-10 whitespace-nowrap absolute left-3">
          SYS MSG:
        </div>

        <div className="ml-24 w-full overflow-hidden whitespace-nowrap flex items-center">
          <div className="inline-block animate-marquee text-xs text-amber-300 tracking-wider font-mono">
            [NOTICE] VEHICLES WITH DISPLAYED PLATES PROCEED DIRECTLY TO ASSIGNED BAYS 01-09 &nbsp;&bull;&nbsp;
            [STATUS] TERMINAL OPERATIONS NORMAL &bull; FLOW RATE: 4,200 BBL/HR &nbsp;&bull;&nbsp;
            [CLICK ANY BAY TO EXPAND FULL SCREEN]
          </div>
        </div>
      </footer>

      {/* ========================================================================= */}
      {/* FULL-PAGE BAY SPOTLIGHT TAKEOVER (Clean, Massive, Uncluttered)            */}
      {/* ========================================================================= */}
      {selectedBaySlot !== null && activeSpotlightBay && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-[#050814]/98 backdrop-blur-md animate-in fade-in duration-150 p-6 md:p-12 justify-between"
          onClick={() => setSelectedBaySlot(null)}
        >
          {/* Top Bar */}
          <div
            className="flex items-center justify-between border-b-2 border-slate-800 pb-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <span className="w-3.5 h-3.5 rounded-full bg-amber-400 animate-ping" />
              <h2 className="text-2xl sm:text-3xl font-black text-amber-400 uppercase tracking-widest font-mono">
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
                    ? '⛽ LOADING IN PROGRESS'
                    : `⚡ PROCEED IMMEDIATELY TO ${activeSpotlightBay.bay_label}`}
                </div>

                {/* Giant License Plate */}
                <div className="py-4">
                  <RealisticNumberPlate
                    plateNumber={activeSpotlightBay.order.truck_number}
                    variant={activeSpotlightBay.order.status === 'LOADING' ? 'white' : 'yellow'}
                    isGiant={true}
                  />
                </div>

                {/* Clean Product & Driver Info */}
                <div className="flex flex-wrap items-center justify-center gap-6 text-base sm:text-xl text-slate-200 font-bold">
                  <span>👤 {activeSpotlightBay.order.driver_name}</span>
                  <span className="text-slate-600">&bull;</span>
                  <span className="text-cyan-300">{activeSpotlightBay.order.product_type}</span>
                  <span className="text-slate-600">&bull;</span>
                  <span className="text-emerald-400 font-mono">
                    {activeSpotlightBay.order.volume_requested.toLocaleString()} {activeSpotlightBay.order.unit}
                  </span>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <h3 className="text-5xl font-black text-slate-600 font-mono tracking-widest uppercase">
                  {activeSpotlightBay.bay_label} IS VACANT
                </h3>
                <p className="text-base text-slate-500">Ready for next authorized vehicle</p>
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
