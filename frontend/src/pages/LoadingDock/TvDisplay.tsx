import { useState, useEffect, useRef, useCallback } from 'react';
import { orderApi } from '../../lib/api';
import type { TvDisplayData, TvBaySlot } from '../../types';

// Clean Ghanaian License Plate
function NumberPlate({
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
      className={`inline-flex items-center justify-between border-2 sm:border-[3px] border-black rounded-[4px] select-none ${
        isGiant
          ? 'h-28 sm:h-36 md:h-44 px-6 sm:px-12 w-full max-w-5xl shadow-2xl'
          : 'h-12 sm:h-14 md:h-16 px-3 sm:px-5 w-full max-w-[380px] shadow-lg'
      } ${isYellow ? 'number-plate-gh' : 'number-plate-white'}`}
    >
      {/* Ghana Flag Badge */}
      <div className={`flex flex-col items-center justify-center mr-3 px-1 py-0.5 bg-black/10 rounded border border-black/20 shrink-0 ${isGiant ? 'scale-150 mr-8' : 'scale-100'}`}>
        <div className="flex flex-col w-5 h-3 rounded-[1px] overflow-hidden border border-black/40">
          <div className="h-1/3 bg-[#ce1126]" />
          <div className="h-1/3 bg-[#fcd116] flex items-center justify-center">
            <div className="w-1 h-1 bg-black rounded-full scale-75" />
          </div>
          <div className="h-1/3 bg-[#006b3f]" />
        </div>
        <span className="text-[9px] font-black leading-tight text-black/90 font-sans mt-0.5">
          GH
        </span>
      </div>

      {/* Plate Digits */}
      <div
        className={`flex-1 text-center font-mono font-black tracking-widest text-[#0a0a0a] ${
          isGiant
            ? 'text-6xl sm:text-8xl md:text-9xl lg:text-[7rem]'
            : 'text-2xl sm:text-3xl md:text-4xl'
        }`}
      >
        {formatted}
      </div>

      <div className={isGiant ? 'w-8 shrink-0' : 'w-4 shrink-0'} />
    </div>
  );
}

export function TvDisplay() {
  const [data, setData] = useState<TvDisplayData | null>(null);
  const [timeString, setTimeString] = useState<string>('');
  const [selectedBaySlot, setSelectedBaySlot] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // UTC Clock
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
    } catch (err) {
      console.warn('Telemetry fetch error:', err);
    }
  }, []);

  useEffect(() => {
    fetchTelemetry();
    const timer = setInterval(fetchTelemetry, 3000);
    return () => clearInterval(timer);
  }, [fetchTelemetry]);

  // Keyboard navigation (ESC to close)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedBaySlot(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 9 Bay Slots (BAY 01 to BAY 09)
  const baySlots: TvBaySlot[] = data?.bays || Array.from({ length: 9 }, (_, i) => ({
    slot_number: i + 1,
    bay_label: `BAY ${(i + 1).toString().padStart(2, '0')}`,
    is_occupied: false,
    order: null,
  }));

  const activeSpotlightBay = selectedBaySlot ? baySlots.find((b) => b.slot_number === selectedBaySlot) : null;

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-screen w-screen bg-[#070b14] text-slate-100 font-mono select-none overflow-hidden"
    >
      {/* Clean Minimal Header */}
      <header className="flex items-center justify-between px-6 py-3 bg-[#0c1322] border-b border-slate-800 shrink-0">
        <h1 className="text-lg md:text-xl font-black tracking-widest text-slate-100 uppercase font-mono">
          BOST OIL DEPOT &bull; LOADING BAYS
        </h1>

        <div className="flex items-center gap-2 bg-black/60 px-3 py-1 rounded border border-slate-800">
          <span className="text-xs text-slate-400 font-bold">UTC</span>
          <span className="text-base font-bold text-amber-400 tracking-wider font-mono">
            {timeString || '--:--:--'}
          </span>
          <span className="text-xs text-amber-500 font-black">Z</span>
        </div>
      </header>

      {/* 9-SQUARED (3x3) SECTIONED GRID */}
      <main className="flex-1 grid grid-cols-1 md:grid-cols-3 grid-rows-3 gap-3 p-3 bg-[#050811] overflow-hidden">
        {baySlots.map((bay) => {
          const isOccupied = bay.is_occupied && bay.order;
          const order = bay.order;
          const isLoading = order?.status === 'LOADING';

          if (!isOccupied || !order) {
            // VACANT SQUARE
            return (
              <div
                key={bay.slot_number}
                onClick={() => setSelectedBaySlot(bay.slot_number)}
                className="flex flex-col justify-between p-4 rounded-lg bg-[#0a0f1c]/70 border border-slate-800/80 cursor-pointer hover:border-slate-700 transition-colors"
              >
                <span className="text-lg font-black text-slate-500 tracking-wider">
                  {bay.bay_label}
                </span>

                <div className="my-auto text-center">
                  <p className="text-3xl md:text-4xl font-black text-slate-700 tracking-widest uppercase font-mono">
                    VACANT
                  </p>
                </div>

                <div className="h-4" />
              </div>
            );
          }

          // OCCUPIED / ACTIVE SQUARE
          return (
            <div
              key={bay.slot_number}
              onClick={() => setSelectedBaySlot(bay.slot_number)}
              className={`flex flex-col justify-between p-4 rounded-lg shadow-xl cursor-pointer transition-all duration-200 ${
                isLoading
                  ? 'bg-gradient-to-b from-[#091522] to-[#060e18] border-2 border-emerald-500/80 hover:border-emerald-400'
                  : 'bg-gradient-to-b from-[#14141d] to-[#090b14] border-2 border-amber-500/80 hover:border-amber-400'
              }`}
            >
              {/* Bay Number & Status */}
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <span
                  className={`text-xl font-black tracking-wider ${
                    isLoading ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {bay.bay_label}
                </span>

                <span
                  className={`px-2.5 py-0.5 rounded text-xs font-black uppercase tracking-wider ${
                    isLoading
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-600'
                      : 'bg-amber-950 text-amber-300 border border-amber-600'
                  }`}
                >
                  {isLoading ? '⛽ LOADING' : '⚡ PROCEED TO BAY'}
                </span>
              </div>

              {/* Vehicle Number Plate */}
              <div className="my-auto py-2 flex items-center justify-center">
                <NumberPlate
                  plateNumber={order.truck_number}
                  variant={isLoading ? 'white' : 'yellow'}
                />
              </div>

              <div className="h-2" />
            </div>
          );
        })}
      </main>

      {/* FULL-PAGE BAY TAKEOVER ON CLICK */}
      {selectedBaySlot !== null && activeSpotlightBay && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-[#050814]/98 backdrop-blur-md animate-in fade-in duration-150 p-8 md:p-14 justify-between"
          onClick={() => setSelectedBaySlot(null)}
        >
          {/* Top Bar */}
          <div
            className="flex items-center justify-between border-b-2 border-slate-800 pb-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-3xl sm:text-4xl font-black text-amber-400 uppercase tracking-widest font-mono">
              {activeSpotlightBay.bay_label}
            </h2>

            <button
              onClick={() => setSelectedBaySlot(null)}
              className="px-5 py-2.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-black tracking-wider uppercase transition-colors"
            >
              ✕ CLOSE (ESC)
            </button>
          </div>

          {/* Center */}
          <div
            className="flex flex-col items-center justify-center text-center my-auto space-y-8"
            onClick={(e) => e.stopPropagation()}
          >
            {activeSpotlightBay.is_occupied && activeSpotlightBay.order ? (
              <>
                <div
                  className={`px-10 py-3 rounded-full text-center font-black tracking-widest uppercase text-xl sm:text-2xl border-2 ${
                    activeSpotlightBay.order.status === 'LOADING'
                      ? 'bg-emerald-950 text-emerald-200 border-emerald-500'
                      : 'bg-amber-950 text-amber-200 border-amber-400 animate-pulse'
                  }`}
                >
                  {activeSpotlightBay.order.status === 'LOADING'
                    ? '⛽ LOADING IN PROGRESS'
                    : `⚡ PROCEED TO ${activeSpotlightBay.bay_label}`}
                </div>

                <div className="py-4 w-full flex justify-center">
                  <NumberPlate
                    plateNumber={activeSpotlightBay.order.truck_number}
                    variant={activeSpotlightBay.order.status === 'LOADING' ? 'white' : 'yellow'}
                    isGiant={true}
                  />
                </div>
              </>
            ) : (
              <div className="space-y-4 py-8">
                <h3 className="text-6xl font-black text-slate-600 font-mono tracking-widest uppercase">
                  {activeSpotlightBay.bay_label} IS VACANT
                </h3>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="text-center text-xs text-slate-600">
            CLICK ANYWHERE OR PRESS ESC TO RETURN
          </div>
        </div>
      )}
    </div>
  );
}

export default TvDisplay;
