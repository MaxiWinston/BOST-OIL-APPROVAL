import { useMemo, useState } from 'react';
import { toast } from 'sonner';
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
  STATUS_BADGE, STATUS_LABEL, formatDate, formatQuantity, formatCompact,
  customerName,
} from '../../lib/orderDisplay';

export function SignOffDashboard() {
  const { user, logout } = useAuth();
  const { orders, summary, loading, refresh, approveCustoms, hold } = useOrders();
  const [queryReason, setQueryReason] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [openOrderId, setOpenOrderId] = useState<number | null>(null);

  // Customs acts on orders the manager has approved and issued a permit for.
  const awaitingSignOff = useMemo(
    () => orders.filter((order) => order.status === 'MANAGER_APPROVED'),
    [orders],
  );
  const clearedOrders = useMemo(
    () => orders.filter((order) => order.status === 'CUSTOMS_APPROVED'),
    [orders],
  );
  const onHold = useMemo(
    () => orders.filter((order) => order.status === 'ON_HOLD'),
    [orders],
  );

  const handleSignOff = async (order: Order) => {
    setBusyId(order.id);
    try {
      await approveCustoms(order.id);
      toast.success(`${order.npa_reference_number} signed off and cleared.`);
      setOpenOrderId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sign-off failed.');
    } finally {
      setBusyId(null);
    }
  };

  const handleRaiseQuery = async (order: Order) => {
    if (!queryReason.trim()) return;
    setBusyId(order.id);
    try {
      await hold(order.id, queryReason.trim());
      toast.success('Query raised. The order has gone back to the depot manager.');
      setQueryReason('');
      setOpenOrderId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not raise the query.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-[#102f71]">
      <header className="border-b border-slate-200 bg-white/90 px-8 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#102f71]">Customs</p>
            <h1 className="text-2xl font-bold tracking-tight">Sign-off Dashboard</h1>
            <p className="text-sm text-[#102f71]">Welcome, {user?.name}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={refresh} disabled={loading}>
              {loading ? 'Refreshing…' : 'Refresh'}
            </Button>
            <Button
              variant="outline"
              className="border-[#7fb445] text-[#7fb445] hover:bg-[#7fb445]/10 hover:text-[#7fb445]"
              onClick={logout}
            >
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl p-8">
        <div className="mb-8 grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Awaiting Sign-off</CardTitle>
            </CardHeader>
            <CardContent><p className="text-3xl font-bold">{awaitingSignOff.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Cleared</CardTitle>
            </CardHeader>
            <CardContent><p className="text-3xl font-bold">{clearedOrders.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">On Hold</CardTitle>
            </CardHeader>
            <CardContent><p className="text-3xl font-bold">{onHold.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            </CardHeader>
            <CardContent><p className="text-3xl font-bold">{summary?.TOTAL ?? orders.length}</p></CardContent>
          </Card>
        </div>

        <div className="mb-4">
          <h2 className="text-xl font-semibold tracking-tight">Permits Awaiting Verification</h2>
          <p className="text-sm text-slate-600">
            Verify the permit and documents, then sign off or raise a query back to the manager.
          </p>
        </div>

        {awaitingSignOff.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-[#102f71]">
                {loading ? 'Loading…' : 'No orders awaiting sign-off'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="overflow-hidden border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    {['Reference', 'Permit', 'Customer', 'Product', 'Quantity', 'Value', 'Status', 'Action'].map((heading) => (
                      <th
                        key={heading}
                        className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#102f71]"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {awaitingSignOff.map((order) => (
                    <tr key={order.id} className="transition-colors hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-sm">{order.npa_reference_number}</td>
                      <td className="px-4 py-3 font-mono text-xs">{order.permit_id ?? '—'}</td>
                      <td className="px-4 py-3 text-sm">{customerName(order)}</td>
                      <td className="px-4 py-3 text-sm">{order.product_type}</td>
                      <td className="px-4 py-3 text-right font-mono text-sm">{formatQuantity(order)}</td>
                      <td className="px-4 py-3 text-right font-mono text-sm">
                        {formatCompact(order.total_price)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          className={`inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.12em] ${STATUS_BADGE[order.status]}`}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          {STATUS_LABEL[order.status]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            disabled={busyId === order.id}
                            className="bg-[#7fb445] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-white hover:bg-[#6f9e3d]"
                            onClick={() => handleSignOff(order)}
                          >
                            Sign Off
                          </Button>

                          <Dialog
                            open={openOrderId === order.id}
                            onOpenChange={(open) => {
                              setOpenOrderId(open ? order.id : null);
                              if (!open) setQueryReason('');
                            }}
                          >
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                className="border-[#7fb445] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[#7fb445] hover:bg-[#7fb445]/10 hover:text-[#7fb445]"
                              >
                                Review
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>Verify permit &amp; documents</DialogTitle>
                                <DialogDescription>{order.npa_reference_number}</DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                  <div>
                                    <p className="font-medium">Permit ID</p>
                                    <p className="font-mono text-xs">{order.permit_id ?? '—'}</p>
                                  </div>
                                  <div>
                                    <p className="font-medium">Approved by</p>
                                    <p>{order.approved_by_manager?.name ?? '—'}</p>
                                  </div>
                                  <div>
                                    <p className="font-medium">Customer</p>
                                    <p>{customerName(order)}</p>
                                  </div>
                                  <div>
                                    <p className="font-medium">Delivery date</p>
                                    <p>{formatDate(order.delivery_date)}</p>
                                  </div>
                                  <div>
                                    <p className="font-medium">Product</p>
                                    <p>{order.product_type}</p>
                                  </div>
                                  <div>
                                    <p className="font-medium">Quantity</p>
                                    <p>{formatQuantity(order)}</p>
                                  </div>
                                  <div>
                                    <p className="font-medium">Vehicle</p>
                                    <p className="font-mono">{order.truck_number ?? '—'}</p>
                                  </div>
                                  <div>
                                    <p className="font-medium">Driver</p>
                                    <p>{order.driver_name ?? '—'}</p>
                                  </div>
                                  <div className="col-span-2">
                                    <p className="font-medium">Delivery location</p>
                                    <p>{order.delivery_location ?? '—'}</p>
                                  </div>
                                </div>

                                <div className="space-y-2 border-t pt-4">
                                  <Label htmlFor={`query-${order.id}`}>
                                    Query reason (required to place on hold)
                                  </Label>
                                  <Input
                                    id={`query-${order.id}`}
                                    placeholder="e.g. Import declaration number does not match the permit"
                                    value={queryReason}
                                    onChange={(e) => setQueryReason(e.target.value)}
                                  />
                                  <p className="text-xs text-slate-500">
                                    Raising a query sets the order to ON HOLD and returns it to the depot manager.
                                  </p>
                                </div>

                                <div className="flex gap-2 pt-2">
                                  <Button
                                    disabled={busyId === order.id}
                                    onClick={() => handleSignOff(order)}
                                    className="flex-1 bg-[#7fb445] text-white hover:bg-[#6f9e3d]"
                                  >
                                    Sign Off &amp; Clear
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    className="flex-1"
                                    disabled={!queryReason.trim() || busyId === order.id}
                                    onClick={() => handleRaiseQuery(order)}
                                  >
                                    Raise Query
                                  </Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {onHold.length > 0 && (
          <div className="mt-8">
            <h2 className="mb-3 text-lg font-semibold">Queries you raised</h2>
            <div className="grid gap-3">
              {onHold.map((order) => (
                <Card key={order.id}>
                  <CardContent className="flex items-start justify-between gap-4 p-4">
                    <div>
                      <p className="font-mono text-sm font-semibold">{order.npa_reference_number}</p>
                      <p className="mt-1 text-xs text-slate-600">{order.hold_reason}</p>
                    </div>
                    <Badge className={`border ${STATUS_BADGE.ON_HOLD}`}>Awaiting manager</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {clearedOrders.length > 0 && (
          <p className="mt-6 text-sm text-[#102f71]">
            Recently cleared: {clearedOrders.slice(0, 3).map((o) => o.npa_reference_number).join(', ')}
          </p>
        )}
      </div>
    </div>
  );
}

export default SignOffDashboard;
