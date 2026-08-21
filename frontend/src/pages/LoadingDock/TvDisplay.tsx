import { useState, useEffect, useRef, useCallback } from 'react';
import { orderApi } from '../../lib/api';
import type { TvDisplayData, TvBaySlot } from '../../types';

// Web Audio API chime synthesizer for crisp airport/depot notification tones
function playBayChime() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    const now = ctx.currentTime;
    // High note
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    gain1.gain.setValueAtTime(0.15, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.5);

    // Resolving chime note
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880.00, now + 0.2); // A5
    gain2.gain.setValueAtTime(0.2, now + 0.2);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.2);
    osc2.stop(now + 0.8);
  } catch {
    // Ignore audio permission errors
  }
}

export function TvDisplay() {
  const [data, setData] = useState<TvDisplayData | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [timeString, setTimeString] = useState<string>('');
  const [localTimeString, setLocalTimeString] = useState<string>('');
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [newlyAddedPlates, setNewlyAddedPlates] = useState<Set<string>>(new Set());

  const previousPlatesRef = useRef<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  // Live Digital Clock (UTC and Local)
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const uHours = String(now.getUTCHours()).padStart(2, '0');
      const uMinutes = String(now.getUTCMinutes()).padStart(2, '0');
      const uSeconds = String(now.getUTCSeconds()).padStart(2, '0');
      setTimeString(`${uHours}:${uMinutes}:${uSeconds}`);

      const lHours = String(now.getHours()).padStart(2, '0');
      const lMinutes = String(now.getMinutes()).padStart(2, '0');
      const lSeconds = String(now.getSeconds()).padStart(2, '0');
      setLocalTimeString(`${lHours}:${lMinutes}:${lSeconds}`);
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

      // Track newly authorized plates for visual pulse & audio notification
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
        // Remove pulse after 8 seconds
        setTimeout(() => {
          setNewlyAddedPlates(new Set());
        }, 8000);
      }

      previousPlatesRef.current = currentPlates;
    } catch (err) {
      console.warn('Failed to fetch telemetry data:', err);
    }
  }, [isAudioEnabled]);

  // Polling every 3.5 seconds
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

  // Default fallback 9 slots if loading or empty
  const baySlots: TvBaySlot[] = data?.bays || Array.from({ length: 9 }, (_, i) => ({
    slot_number: i + 1,
    bay_label: `BAY ${(i + 1).toString().padStart(2, '0')}`,
    is_occupied: false,
    order: null,
  }));

  const occupiedCount = baySlots.filter((b) => b.is_occupied).length;
  const loadingCount = baySlots.filter((b) => b.order?.status === 'LOADING').length;
  const readyCount = occupiedCount - loadingCount;

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-screen w-screen bg-[#070b14] text-slate-100 font-mono select-none overflow-hidden"
    >
      {/* Top Telemetry Header */}
      <header className="flex items-center justify-between px-6 py-2.5 bg-[#0d1527] border-b border-cyan-900/40 shrink-0 shadow-lg z-20">
        {/* Left: Terminal Brand & Active Status */}
        <div className="flex items-center gap-4">
          <div className="relative flex items-center justify-center">
            <span className="h-3.5 w-3.5 rounded-full bg-emerald-500 animate-ping absolute" />
            <span className="h-3.5 w-3.5 rounded-full bg-emerald-500" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base md:text-lg font-black tracking-wider text-cyan-400 uppercase">
                BOST OIL DEPOT &bull; LOADING BAYS MONITOR
              </h1>
              <span className="hidden lg:inline-block px-2 py-0.5 text-[10px] font-bold bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 rounded">
                LIVE STAGING FEED
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-sans tracking-wide">
              {data?.depot_name || 'TEMA CENTRAL TERMINAL — GATES 01-09'}
            </p>
          </div>
        </div>

        {/* Center: Live Bay Metric Badges */}
        <div className="hidden md:flex items-center gap-3 bg-[#080d1a] px-4 py-1.5 rounded-md border border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-semibold uppercase">Active Bays:</span>
            <span className="text-sm font-bold text-cyan-300 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800/50">
              {occupiedCount} / 9
            </span>
          </div>
          <span className="text-slate-700">|</span>
          <div className="flex items-center gap-1.5 text-xs text-amber-400">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="font-bold">{readyCount} Ready / Cleared</span>
          </div>
          <span className="text-slate-700">|</span>
          <div className="flex items-center gap-1.5 text-xs text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="font-bold">{loadingCount} Loading</span>
          </div>
        </div>

        {/* Right: Digital Clocks & Kiosk Controls */}
        <div className="flex items-center gap-3">
          {/* UTC Clock */}
          <div className="flex items-center gap-1.5 bg-[#050811] px-3 py-1 rounded border border-cyan-900/60 shadow-inner">
            <span className="text-[11px] text-slate-400 font-bold">UTC:</span>
            <span className="text-base md:text-lg font-black text-amber-400 tracking-widest font-mono">
              {timeString || '--:--:--'}
            </span>
            <span className="text-xs text-amber-500 font-black animate-pulse">Z</span>
          </div>

          {/* Local Clock */}
          <div className="hidden sm:flex items-center gap-1.5 bg-[#050811] px-3 py-1 rounded border border-slate-800">
            <span className="text-[11px] text-slate-400 font-bold">LOCAL:</span>
            <span className="text-sm md:text-base font-bold text-slate-200 tracking-wider font-mono">
              {localTimeString || '--:--:--'}
            </span>
          </div>

          {/* Sound Toggle */}
          <button
            onClick={() => setIsAudioEnabled(!isAudioEnabled)}
            title={isAudioEnabled ? 'Mute Alert Chime' : 'Unmute Alert Chime'}
            className={`p-2 rounded border transition-colors ${
              isAudioEnabled
                ? 'bg-cyan-950/60 border-cyan-700 text-cyan-300 hover:bg-cyan-900/60'
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

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen TV Mode'}
            className="p-2 rounded border bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 transition-colors"
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

      {/* Main 9-Squared (3x3) Grid */}
      <main className="flex-1 grid grid-cols-1 md:grid-cols-3 grid-rows-3 gap-3 p-3.5 bg-[#050811] overflow-hidden">
        {baySlots.map((bay) => {
          const isOccupied = bay.is_occupied && bay.order;
          const order = bay.order;
          const isLoading = order?.status === 'LOADING';
          const isNewlyAdded = order?.truck_number ? newlyAddedPlates.has(order.truck_number) : false;

          if (!isOccupied || !order) {
            // VACANT / STANDBY SQUARE
            return (
              <div
                key={bay.slot_number}
                className="flex flex-col justify-between p-4 rounded-lg bg-[#0b1120]/70 border border-slate-800/80 shadow-inner relative overflow-hidden transition-all duration-300 group hover:border-slate-700"
              >
                {/* Bay Header */}
                <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-600/60" />
                    <span className="text-sm font-black text-slate-400 tracking-wider">
                      {bay.bay_label}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 bg-slate-900/80 px-2 py-0.5 rounded border border-slate-800">
                    STANDBY
                  </span>
                </div>

                {/* Center: Vacant Indicator */}
                <div className="flex flex-col items-center justify-center my-auto text-center space-y-1">
                  <div className="w-10 h-10 rounded-full border border-dashed border-slate-700 flex items-center justify-center text-slate-600 mb-1">
                    <span className="text-xl font-bold font-mono">0{bay.slot_number}</span>
                  </div>
                  <p className="text-xl md:text-2xl font-black text-slate-600/90 tracking-widest uppercase font-mono">
                    VACANT
                  </p>
                  <p className="text-xs text-slate-500 font-sans">
                    Bay ready for next authorized vehicle
                  </p>
                </div>

                {/* Footer slot marker */}
                <div className="flex items-center justify-between text-[11px] text-slate-600 border-t border-slate-800/40 pt-1.5">
                  <span>SLOT #{bay.slot_number}</span>
                  <span>NO ACTIVE DISPATCH</span>
                </div>
              </div>
            );
          }

          // OCCUPIED / AUTHORIZED SQUARE
          return (
            <div
              key={bay.slot_number}
              className={`flex flex-col justify-between p-4 rounded-lg shadow-2xl relative overflow-hidden transition-all duration-500 ${
                isNewlyAdded
                  ? 'ring-4 ring-amber-400 bg-gradient-to-br from-amber-950/50 via-[#0e172a] to-[#090f1d] border-amber-400 animate-pulse'
                  : isLoading
                  ? 'bg-gradient-to-br from-emerald-950/40 via-[#0c182c] to-[#070e1c] border-2 border-emerald-500/70'
                  : 'bg-gradient-to-br from-amber-950/30 via-[#0c182c] to-[#070e1c] border-2 border-amber-500/70'
              }`}
            >
              {/* Top Row: Bay Identifier & Status Tag */}
              <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-3 h-3 rounded-full ${
                      isLoading ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-ping'
                    }`}
                  />
                  <span
                    className={`text-base font-black tracking-widest font-mono ${
                      isLoading ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {bay.bay_label}
                  </span>
                </div>

                <div
                  className={`flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-black uppercase tracking-wider border shadow-sm ${
                    isLoading
                      ? 'bg-emerald-900/80 text-emerald-200 border-emerald-500 animate-pulse'
                      : 'bg-amber-900/80 text-amber-200 border-amber-400 animate-bounce'
                  }`}
                >
                  <span>{isLoading ? '⛽' : '⚡'}</span>
                  <span>{order.status_display || (isLoading ? 'FILLING NOW' : 'AUTHORIZED')}</span>
                </div>
              </div>

              {/* Center: BOLD DRIVER NUMBER PLATE */}
              <div className="my-auto py-2 text-center flex flex-col items-center justify-center">
                <p className="text-[10px] md:text-xs uppercase tracking-widest font-bold text-slate-400 mb-1">
                  AUTHORIZED VEHICLE NUMBER PLATE
                </p>

                {/* Giant Digital Registration Plate */}
                <div className="w-full bg-black/90 border-2 border-amber-400/90 rounded-md py-2.5 px-3 shadow-[0_0_25px_rgba(245,158,11,0.25)] flex items-center justify-center">
                  <span className="text-3xl sm:text-4xl md:text-4xl lg:text-5xl font-black text-amber-300 tracking-widest font-mono drop-shadow-[0_0_12px_rgba(252,211,77,0.8)]">
                    {order.truck_number}
                  </span>
                </div>

                {/* Driver & Carrier info */}
                <div className="mt-2.5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-slate-300 font-medium">
                  <span className="font-semibold text-white">
                    👤 {order.driver_name || 'Driver Assigned'}
                  </span>
                  <span className="text-slate-500">&bull;</span>
                  <span className="text-cyan-300 truncate max-w-[200px]">
                    🏢 {order.customer_company || 'Customer'}
                  </span>
                </div>
              </div>

              {/* Bottom Row: Product & Volume Specification */}
              <div className="flex items-center justify-between bg-black/50 px-3 py-2 rounded border border-slate-800 text-xs">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="text-slate-400 font-semibold">PRODUCT:</span>
                  <span className="font-bold text-slate-100 uppercase truncate">
                    {order.product_type}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-slate-400 font-semibold">VOL:</span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">
                    {order.volume_requested.toLocaleString()} {order.unit}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </main>

      {/* Footer Status Ticker */}
      <footer className="bg-[#090e1c] border-t border-cyan-900/40 h-10 shrink-0 flex items-center px-4 overflow-hidden relative shadow-lg z-20">
        {/* Static Badge */}
        <div className="bg-amber-500 text-slate-950 text-xs font-black px-2.5 py-1 rounded shadow z-10 whitespace-nowrap flex items-center gap-1.5 absolute left-3">
          <span className="h-2 w-2 rounded-full bg-slate-950 animate-ping" />
          DEPOT NOTICE
        </div>

        {/* Continuous Scrolling Marquee */}
        <div className="ml-36 w-full overflow-hidden whitespace-nowrap flex items-center">
          <div className="inline-block animate-marquee text-xs text-amber-300/90 font-mono tracking-wider">
            [NOTICE] ALL DRIVERS WITH DISPLAYED NUMBER PLATES PROCEED DIRECTLY TO ASSIGNED BAYS 01-09 &nbsp;&bull;&nbsp;
            [SAFETY] MANDATORY PPE, GROUNDING CLAMPS &amp; WHEEL CHOCKS REQUIRED BEFORE DISPENSING &nbsp;&bull;&nbsp;
            [CAPACITY] FLOW RATE: 4,200 BBL/HR &bull; TERMINAL ACTIVE BAYS: {occupiedCount}/9 &bull; LAST REFRESH:{' '}
            {lastUpdated.toLocaleTimeString()} &nbsp;&bull;&nbsp;
            [DISPATCH] VEHICLES DEPARTING THE BAY ARE CLEARED AUTOMATICALLY UPON WAYBILL SIGN-OFF
          </div>
        </div>
      </footer>
    </div>
  );
}

export default TvDisplay;
