import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { TelevisionIcon } from '@phosphor-icons/react';
import { useAuth } from '../../context/AuthContext';
import { useOrders } from '../../context/OrderContext';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import type { Order } from '../../types';
import {
  STATUS_BADGE, STATUS_LABEL, formatDate, formatQuantity, num, customerName,
} from '../../lib/orderDisplay';

/** Same normalisation the backend uses, so the preview matches the verdict. */
const normalisePlate = (value: string) =>
  value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

export function LoadingDockDashboard() {
  const { user, logout } = useAuth();
  const {
    orders, summary, loading, refresh,
    clearLot, startLoading, denyEntry, completeLoading,
  } = useOrders();

  const [busyId, setBusyId] = useState<number | null>(null);
  const [openOrderId, setOpenOrderId] = useState<number | null>(null);
  const [observedPlate, setObservedPlate] = useState('');
  const [denyReason, setDenyReason] = useState('');
  const [quantity, setQuantity] = useState('');

  // Customs-cleared orders still need the lot authorised for filling.
  const awaitingClearance = useMemo(
    () => orders.filter((o) => o.status === 'CUSTOMS_APPROVED'),
    [orders],
  );
  const readyForLoading = useMemo(
    () => orders.filter((o) => o.status === 'LOT_CLEARED'),
    [orders],
  );
  const currentlyLoading = useMemo(
    () => orders.filter((o) => o.status === 'LOADING'),
    [orders],
  );
  const completed = useMemo(
    () => orders.filter((o) => o.status === 'COMPLETED'),
    [orders],
  );

  const resetDialog = () => {
    setOpenOrderId(null);
    setObservedPlate('');
    setDenyReason('');
    setQuantity('');
  };

  const run = async (order: Order, fn: () => Promise<unknown>, success: string) => {
    setBusyId(order.id);
    try {
      await fn();
      toast.success(success);
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed.');
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const handleClearLot = (order: Order) =>
    run(order, () => clearLot(order.id), `${order.npa_reference_number} authorised for filling.`);

  const handleStartLoading = async (order: Order) => {
    const ok = await run(
      order,
      () => startLoading(order.id, observedPlate.trim()),
      'Car number verified. Vehicle may load.',
    );
    if (ok) resetDialog();
  };

  const handleDeny = async (order: Order) => {
    if (!denyReason.trim()) return;
    const ok = await run(
      order,
      () => denyEntry(order.id, denyReason.trim(), observedPlate.trim() || undefined),
      'Entry denied. The depot manager has been alerted.',
    );
    if (ok) resetDialog();
  };

  const handleComplete = async (order: Order) => {
    const parsed = parseFloat(quantity);
    if (!parsed || parsed <= 0) {
      toast.error('Enter the quantity actually loaded.');
      return;
    }
    const ok = await run(
      order,
      () => completeLoading(order.id, parsed),
      `Loading recorded for ${order.npa_reference_number}. Bay cleared from TV display.`,
    );
    if (ok) resetDialog();
  };

  const handleFastComplete = async (order: Order) => {
    const vol = num(order.volume_requested);
    if (!vol || vol <= 0) {
      toast.error('Invalid order volume.');
      return;
    }
    await run(
      order,
      () => completeLoading(order.id, vol),
      `Full loading completed (${vol.toLocaleString()} ${order.unit}). Bay cleared from TV display.`,
    );
  };

  // Live preview of the gate check while the operator types.
  const plateVerdict = (order: Order) => {
    if (!observedPlate.trim() || !order.truck_number) return null;
    return normalisePlate(observedPlate) === normalisePlate(order.truck_number);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white px-8 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#102f71]">Loading bay</p>
            <h1 className="text-2xl font-bold">Loading Bay Dashboard</h1>
            <p className="text-sm text-gray-600">Welcome, {user?.name}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/tv-display"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md bg-[#102f71] px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-900 transition-colors shadow-sm"
            >
              <span className="h-2 w-2 rounded-full bg-[#7fb445] animate-ping" />
              <TelevisionIcon className="h-4 w-4" />
              Open TV Bay Display
            </a>
            <Button variant="outline" onClick={refresh} disabled={loading}>
              {loading ? 'Refreshing…' : 'Refresh'}
            </Button>
            <Button variant="outline" onClick={logout}>Logout</Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl p-8">
        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Awaiting Lot Clearance</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold">{awaitingClearance.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Ready for Loading</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold">{readyForLoading.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Loading Now</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold">{currentlyLoading.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Completed</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold">{summary?.COMPLETED ?? completed.length}</p></CardContent>
          </Card>
        </div>

        {/* --- Step 1: authorise the lot ------------------------------- */}
        {awaitingClearance.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-1 text-xl font-semibold">Customs-cleared, awaiting lot clearance</h2>
            <p className="mb-4 text-sm text-gray-600">
              Authorise the lot for filling before the vehicle is checked in.
            </p>
            <div className="grid gap-3">
              {awaitingClearance.map((order) => (
                <Card key={order.id}>
                  <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
                    <div>
                      <p className="font-mono text-sm font-semibold">{order.npa_reference_number}</p>
                      <p className="mt-1 text-xs text-gray-600">
                        {order.product_type} · {formatQuantity(order)} · {order.truck_number ?? '—'}
                      </p>
                    </div>
                    <Button
                      disabled={busyId === order.id}
                      onClick={() => handleClearLot(order)}
                    >
                      Authorise for filling
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* --- Step 2: gate check + loading ---------------------------- */}
        <section className="mb-8">
          <h2 className="mb-1 text-xl font-semibold">Vehicles at the gate</h2>
          <p className="mb-4 text-sm text-gray-600">
            Confirm the car number matches the order before allowing the vehicle to load.
          </p>

          {readyForLoading.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <p className="text-gray-500">
                  {loading ? 'Loading…' : 'No vehicles waiting at the gate'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {readyForLoading.map((order) => {
                const verdict = openOrderId === order.id ? plateVerdict(order) : null;

                return (
                  <Card key={order.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{order.npa_reference_number}</CardTitle>
                          <p className="text-sm text-gray-500">
                            Cleared {formatDate(order.lot_clearance_time)}
                          </p>
                        </div>
                        <Badge className={`border ${STATUS_BADGE[order.status]}`}>
                          {STATUS_LABEL[order.status]}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="mb-4 grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                        <div>
                          <p className="font-medium">Product</p>
                          <p className="text-gray-600">{order.product_type}</p>
                        </div>
                        <div>
                          <p className="font-medium">Approved quantity</p>
                          <p className="text-gray-600">{formatQuantity(order)}</p>
                        </div>
                        <div>
                          <p className="font-medium">Expected car number</p>
                          <p className="font-mono text-gray-600">{order.truck_number ?? '—'}</p>
                        </div>
                        <div>
                          <p className="font-medium">Driver</p>
                          <p className="text-gray-600">{order.driver_name ?? '—'}</p>
                        </div>
                      </div>

                      <Dialog
                        open={openOrderId === order.id}
                        onOpenChange={(open) => (open ? setOpenOrderId(order.id) : resetDialog())}
                      >
                        <DialogTrigger asChild>
                          <Button>Check in vehicle</Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Gate check</DialogTitle>
                            <DialogDescription>{order.npa_reference_number}</DialogDescription>
                          </DialogHeader>

                          <div className="space-y-4">
                            <div className="rounded border bg-gray-50 p-3 text-sm">
                              <p className="text-gray-600">Order declares car number</p>
                              <p className="font-mono text-lg font-semibold">{order.truck_number ?? '—'}</p>
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor={`plate-${order.id}`}>Car number observed at the gate</Label>
                              <Input
                                id={`plate-${order.id}`}
                                placeholder="Type the plate on the vehicle"
                                value={observedPlate}
                                onChange={(e) => setObservedPlate(e.target.value)}
                                autoComplete="off"
                              />
                              {verdict === true && (
                                <p className="text-sm font-medium text-green-700">
                                  Match — the vehicle may load.
                                </p>
                              )}
                              {verdict === false && (
                                <p className="text-sm font-medium text-red-700">
                                  Mismatch — deny entry and flag the discrepancy.
                                </p>
                              )}
                            </div>

                            <div className="flex gap-2">
                              <Button
                                className="flex-1"
                                disabled={verdict !== true || busyId === order.id}
                                onClick={() => handleStartLoading(order)}
                              >
                                Allow vehicle to load
                              </Button>
                              <Button
                                variant="destructive"
                                className="flex-1"
                                disabled={!denyReason.trim() || busyId === order.id}
                                onClick={() => handleDeny(order)}
                              >
                                Deny entry
                              </Button>
                            </div>

                            <div className="space-y-2 border-t pt-4">
                              <Label htmlFor={`deny-${order.id}`}>
                                Discrepancy reason (required to deny)
                              </Label>
                              <Input
                                id={`deny-${order.id}`}
                                placeholder="e.g. Plate does not match the permit"
                                value={denyReason}
                                onChange={(e) => setDenyReason(e.target.value)}
                              />
                              <p className="text-xs text-gray-500">
                                Denying entry alerts the depot manager.
                              </p>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        {/* --- Step 3: record quantity + issue waybill ----------------- */}
        {currentlyLoading.length > 0 && (
          <section>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-xl font-semibold">Currently loading in bays</h2>
                <p className="text-sm text-gray-600">
                  When a vehicle finishes dispensing and departs, complete the order to immediately release the bay on the TV board.
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 border border-emerald-300">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                {currentlyLoading.length} Occupying TV Bays
              </span>
            </div>
            <div className="grid gap-4">
              {currentlyLoading.map((order) => (
                <Card key={order.id} className="border-emerald-200 bg-gradient-to-r from-emerald-50/40 to-white shadow-sm">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-lg">{order.npa_reference_number}</CardTitle>
                          <span className="inline-flex items-center gap-1 rounded bg-slate-900 px-2 py-0.5 font-mono text-xs font-bold text-amber-400">
                            📺 TV Bay Active
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          {customerName(order)} · <span className="font-mono font-bold text-gray-900">{order.verified_truck_number ?? order.truck_number}</span> · {order.product_type} ({formatQuantity(order)})
                        </p>
                      </div>
                      <Badge className={`border ${STATUS_BADGE[order.status]}`}>
                        {STATUS_LABEL[order.status]}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-wrap items-center justify-end gap-3 pt-0">
                    <Button
                      variant="default"
                      className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold flex items-center gap-1.5"
                      disabled={busyId === order.id}
                      onClick={() => handleFastComplete(order)}
                    >
                      <span>⚡</span>
                      <span>Fast Complete &amp; Clear TV Bay ({formatQuantity(order)})</span>
                    </Button>

                    <Dialog
                      open={openOrderId === order.id}
                      onOpenChange={(open) => (open ? setOpenOrderId(order.id) : resetDialog())}
                    >
                      <DialogTrigger asChild>
                        <Button variant="outline">Custom Quantity…</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Complete loading &amp; issue waybill</DialogTitle>
                          <DialogDescription>{order.npa_reference_number}</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="rounded border bg-gray-50 p-3 text-sm">
                            <p className="text-gray-600">Approved volume</p>
                            <p className="text-lg font-semibold">{formatQuantity(order)}</p>
                            <p className="text-xs text-gray-500 mt-1">Vehicle plate: {order.verified_truck_number ?? order.truck_number}</p>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`qty-${order.id}`}>
                              Quantity loaded ({order.unit.toLowerCase()})
                            </Label>
                            <Input
                              id={`qty-${order.id}`}
                              type="number"
                              min="1"
                              max={num(order.volume_requested)}
                              placeholder="Actual quantity dispensed"
                              value={quantity}
                              onChange={(e) => setQuantity(e.target.value)}
                            />
                            <p className="text-xs text-gray-500">
                              Completing this order issues the waybill and frees the bay on the TV screen.
                            </p>
                          </div>
                          <Button
                            className="w-full"
                            disabled={!quantity || busyId === order.id}
                            onClick={() => handleComplete(order)}
                          >
                            Complete &amp; Clear TV Bay
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export default LoadingDockDashboard;
