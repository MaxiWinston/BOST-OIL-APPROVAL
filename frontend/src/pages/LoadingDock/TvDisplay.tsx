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
  const formatted = (plateNumber || '').toUpperCase().trim();

  return (
    <div
      className={`relative inline-flex items-center justify-between border-2 sm:border-[2.5px] border-black rounded-[4px] select-none ${
        isGiant
          ? 'h-24 sm:h-32 md:h-36 px-6 sm:px-10 max-w-4xl w-full shadow-2xl'
          : 'h-12 sm:h-13 md:h-14 px-3 sm:px-4 w-full max-w-[360px] shadow-md'
      } ${isYellow ? 'number-plate-gh' : 'number-plate-white'}`}
    >
      {/* Ghana Flag Badge */}
      <div className={`flex flex-col items-center justify-center mr-2.5 sm:mr-3.5 px-1 py-0.5 bg-black/10 rounded border border-black/30 shrink-0 ${isGiant ? 'scale-125 sm:scale-150 mr-6 sm:mr-8' : 'scale-90 sm:scale-100'}`}>
        <div className="flex flex-col w-4 h-2.5 sm:w-5 sm:h-3 rounded-[1px] overflow-hidden border border-black/40 shadow-sm">
          <div className="h-1/3 bg-[#ce1126]" />
          <div className="h-1/3 bg-[#fcd116] flex items-center justify-center">
            <div className="w-1 h-1 bg-black rounded-full scale-75" />
          </div>
          <div className="h-1/3 bg-[#006b3f]" />
        </div>
        <span className="text-[8px] sm:text-[9px] font-black leading-tight text-black font-sans mt-0.5">
          GH
        </span>
      </div>

      {/* Plate Registration Digits — Solid Black, Crisp, High Contrast */}
      <div
        className={`flex-1 text-center font-mono font-black tracking-widest text-black whitespace-nowrap overflow-hidden ${
          isGiant
            ? 'text-5xl sm:text-7xl md:text-8xl lg:text-[5.5rem] leading-none py-1'
            : 'text-2xl sm:text-3xl md:text-3xl lg:text-[2.2rem] leading-none'
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
      className="flex flex-col h-screen w-screen bg-[#f8fafc] text-[#102f71] font-sans select-none overflow-hidden"
    >
      {/* Top Header — Clean Brand Dark Blue & White */}
      <header className="flex items-center justify-between px-6 py-3.5 bg-[#102f71] text-white shadow-md shrink-0 z-20">
        <div className="flex items-center gap-3.5">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-white/10 border border-white/20 shadow-inner">
            <span className="text-xl">⛽</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-[#7fb445] text-white rounded">
                LIVE
              </span>
              <h1 className="text-base sm:text-lg md:text-xl font-bold tracking-tight text-white uppercase font-sans">
                BOST OIL DEPOT &bull; GANTRY LOADING BAYS
              </h1>
            </div>
            <p className="text-xs text-blue-100/80 font-normal tracking-wide">
              {data?.depot_name || 'Tema Central Gantry Terminal — Dispatch Bay Monitor'}
            </p>
          </div>
        </div>

        {/* Live Badges & UTC Clock */}
        <div className="flex items-center gap-3">
          {/* Active Bays Count Pill */}
          <div className="hidden sm:flex items-center gap-2.5 bg-white/10 px-3.5 py-1.5 rounded-lg border border-white/15 text-xs text-white">
            <span className="text-blue-200 font-medium">Active Bays:</span>
            <span className="font-bold text-white font-mono bg-white/20 px-1.5 py-0.5 rounded">
              {occupiedCount} / 9
            </span>
            <span className="text-white/30">|</span>
            <span className="text-amber-300 font-semibold">{readyCount} Authorized</span>
            <span className="text-white/30">|</span>
            <span className="text-emerald-300 font-semibold">{loadingCount} Dispensing</span>
          </div>

          {/* UTC Clock */}
          <div className="flex items-center gap-2 bg-[#0c2457] px-3.5 py-1.5 rounded-lg border border-white/20 shadow-inner">
            <span className="text-[11px] text-blue-200 font-semibold uppercase tracking-wider">UTC</span>
            <span className="text-base font-bold text-white tracking-widest font-mono">
              {timeString || '--:--:--'}
            </span>
            <span className="h-2 w-2 rounded-full bg-[#7fb445] animate-pulse" />
          </div>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            className="p-2 rounded-lg bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </button>
        </div>
      </header>

      {/* ================= 9-SQUARED (3x3) SECTIONED GRID ================= */}
      <main className="flex-1 grid grid-cols-1 md:grid-cols-3 grid-rows-3 gap-3 p-3 bg-slate-100 overflow-hidden">
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
                className="flex flex-col justify-between p-3.5 rounded-xl bg-white/90 border border-slate-200 shadow-sm cursor-pointer hover:border-slate-300 hover:shadow-md transition-all group"
              >
                {/* Header Row */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                    <span className="text-base font-bold text-slate-500 font-mono tracking-wider">
                      {bay.bay_label}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                    Standby
                  </span>
                </div>

                {/* Center */}
                <div className="my-auto text-center py-2">
                  <p className="text-xl sm:text-2xl font-bold text-slate-300 tracking-wider uppercase font-sans">
                    Bay Vacant
                  </p>
                  <p className="text-xs text-slate-400 font-sans mt-0.5">
                    Ready for next authorized tanker
                  </p>
                </div>

                {/* Bottom Row */}
                <div className="text-[11px] text-slate-400 border-t border-slate-100 pt-1.5 flex justify-between">
                  <span className="font-mono">Gantry Gate #{bay.slot_number}</span>
                  <span className="text-emerald-600 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Armed
                  </span>
                </div>
              </div>
            );
          }

          // --- OCCUPIED / AUTHORIZED SQUARE ---
          return (
            <div
              key={bay.slot_number}
              onClick={() => setSelectedBaySlot(bay.slot_number)}
              className={`flex flex-col justify-between p-3.5 rounded-xl shadow-md cursor-pointer transition-all duration-300 bg-white ${
                isNewlyAdded
                  ? 'ring-4 ring-amber-400 border-2 border-amber-500 animate-pulse shadow-xl'
                  : isLoading
                  ? 'border-2 border-emerald-500 hover:border-emerald-600 hover:shadow-lg'
                  : 'border-2 border-[#102f71] hover:border-blue-700 hover:shadow-lg'
              }`}
            >
              {/* Header Row: Bay Label & Status Badge */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      isLoading ? 'bg-emerald-500 animate-pulse' : 'bg-[#102f71] animate-ping'
                    }`}
                  />
                  <span className="text-base font-bold tracking-tight text-[#102f71] font-mono">
                    {bay.bay_label}
                  </span>
                </div>

                <span
                  className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wide border flex items-center gap-1.5 ${
                    isLoading
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-blue-50 text-[#102f71] border-blue-200 animate-pulse'
                  }`}
                >
                  <span>{isLoading ? '⛽' : '⚡'}</span>
                  <span>{isLoading ? 'Dispensing' : 'Proceed to Bay'}</span>
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
              <div className="flex items-center justify-between text-xs px-1 text-slate-600 font-medium">
                <span className="font-bold text-[#102f71] uppercase truncate max-w-[140px]">
                  👤 {order.driver_name || 'Driver'}
                </span>
                <span className="text-slate-600 font-semibold uppercase truncate max-w-[140px]">
                  🏢 {order.customer_company || 'Carrier'}
                </span>
              </div>

              {/* Bottom Row: Product & Volume Bar */}
              <div className="flex items-center justify-between bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200/80 text-xs mt-1.5">
                <span className="font-bold text-[#102f71] uppercase truncate">
                  {order.product_type}
                </span>
                <span className="font-mono font-bold text-emerald-700 text-xs sm:text-sm pl-2">
                  {order.volume_requested.toLocaleString()} {order.unit}
                </span>
              </div>
            </div>
          );
        })}
      </main>

      {/* Footer Ticker — Dark Blue Background with Crisp White & Lime Accents */}
      <footer className="bg-[#102f71] border-t border-white/20 h-9 shrink-0 flex items-center px-4 overflow-hidden relative shadow-md z-20 text-white">
        <div className="bg-[#7fb445] text-white text-[11px] font-bold px-2.5 py-0.5 rounded shadow z-10 whitespace-nowrap flex items-center gap-1.5 absolute left-3">
          <span className="h-2 w-2 rounded-full bg-white animate-ping" />
          NOTICE:
        </div>

        <div className="ml-24 w-full overflow-hidden whitespace-nowrap flex items-center">
          <div className="inline-block animate-marquee text-xs text-blue-100 font-medium tracking-wide font-sans">
            Drivers with displayed number plates proceed directly to designated gantry bay &nbsp;&bull;&nbsp;
            Mandatory PPE, grounding clamp &amp; engine shutoff before dispensing &nbsp;&bull;&nbsp;
            Waybill clearance at the loading dock automatically releases bay assignment &nbsp;&bull;&nbsp;
            Click any bay square to expand spotlight view
          </div>
        </div>
      </footer>

      {/* ========================================================================= */}
      {/* FULL-PAGE BAY SPOTLIGHT TAKEOVER (When clicking any bay)                  */}
      {/* ========================================================================= */}
      {selectedBaySlot !== null && activeSpotlightBay && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-[#102f71]/95 backdrop-blur-md animate-in fade-in duration-150 p-6 md:p-10 justify-between text-white"
          onClick={() => setSelectedBaySlot(null)}
        >
          {/* Top Bar */}
          <div
            className="flex items-center justify-between border-b border-white/20 pb-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <span className="w-3.5 h-3.5 rounded-full bg-[#7fb445] animate-ping" />
              <h2 className="text-2xl sm:text-3xl font-bold text-white uppercase tracking-tight font-sans">
                {activeSpotlightBay.bay_label} Spotlight
              </h2>
            </div>

            <button
              onClick={() => setSelectedBaySlot(null)}
              className="px-4 py-2 rounded-lg bg-white text-[#102f71] hover:bg-blue-50 text-xs font-bold tracking-wider uppercase transition-colors flex items-center gap-2 shadow"
            >
              <span>✕</span>
              <span>Close (ESC)</span>
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
                  className={`px-8 py-2.5 rounded-full text-center font-bold tracking-wide uppercase text-base sm:text-xl border shadow-lg ${
                    activeSpotlightBay.order.status === 'LOADING'
                      ? 'bg-emerald-500 text-white border-emerald-400'
                      : 'bg-white text-[#102f71] border-white animate-pulse'
                  }`}
                >
                  {activeSpotlightBay.order.status === 'LOADING'
                    ? '⛽ Dispensing In Progress'
                    : `⚡ Proceed Immediately to ${activeSpotlightBay.bay_label}`}
                </div>

                {/* Giant Horizontal License Plate */}
                <div className="py-4 w-full flex justify-center">
                  <RealisticNumberPlate
                    plateNumber={activeSpotlightBay.order.truck_number}
                    variant={activeSpotlightBay.order.status === 'LOADING' ? 'white' : 'yellow'}
                    isGiant={true}
                  />
                </div>

                {/* Driver & Commercial Details Bar */}
                <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-8 text-base sm:text-lg text-[#102f71] font-bold bg-white px-8 py-4 rounded-xl border border-slate-200 shadow-2xl">
                  <span>👤 Driver: {activeSpotlightBay.order.driver_name}</span>
                  <span className="text-slate-300">&bull;</span>
                  <span className="text-slate-700">🏢 Carrier: {activeSpotlightBay.order.customer_company}</span>
                  <span className="text-slate-300">&bull;</span>
                  <span className="text-[#102f71]">⛽ Product: {activeSpotlightBay.order.product_type}</span>
                  <span className="text-slate-300">&bull;</span>
                  <span className="text-emerald-600 font-mono">
                    📦 Volume: {activeSpotlightBay.order.volume_requested.toLocaleString()} {activeSpotlightBay.order.unit}
                  </span>
                </div>
              </>
            ) : (
              <div className="space-y-3 py-8 text-white">
                <h3 className="text-4xl sm:text-5xl font-bold font-sans tracking-tight uppercase">
                  {activeSpotlightBay.bay_label} is Vacant
                </h3>
                <p className="text-lg text-blue-100">Ready for next authorized vehicle</p>
              </div>
            )}
          </div>

          {/* Footer Navigation */}
          <div
            className="flex items-center justify-between text-xs text-blue-100 border-t border-white/20 pt-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedBaySlot((prev) => (prev !== null ? (prev === 1 ? 9 : prev - 1) : 1))}
              className="hover:text-white transition-colors flex items-center gap-1 font-semibold"
            >
              ◀ Previous Bay
            </button>
            <span className="text-blue-200">Click anywhere or press ESC to return</span>
            <button
              onClick={() => setSelectedBaySlot((prev) => (prev !== null ? (prev % 9) + 1 : 1))}
              className="hover:text-white transition-colors flex items-center gap-1 font-semibold"
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
