import { Fragment, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  CaretDownIcon,
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  FunnelSimpleIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  PackageIcon,
  PhoneIcon,
  TruckIcon,
  UserIcon,
} from '@phosphor-icons/react';
import { AdminSidebar } from '../../components/AdminSidebar';
import { useOrders } from '../../context/OrderContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '../../components/ui/dialog';
import type { Order, OrderStatus } from '../../types';
import {
  STATUS_DOT, STATUS_LABEL, PROGRESS_STAGES, progressStep, isHalted,
  formatDate, formatTime, formatQuantity, formatMoney, customerName, haltReason,
  formatProduct, formatProductGroup,
} from '../../lib/orderDisplay';
import { Invoice } from '../../components/invoice/Invoice';

const ALL_STATUSES = Object.keys(STATUS_LABEL) as OrderStatus[];

export function AdminOrders() {
  const { orders, loading, error, refresh, approveManager, reject } = useOrders();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all');
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectTarget, setRejectTarget] = useState<Order | null>(null);
  const [invoiceTarget, setInvoiceTarget] = useState<Order | null>(null);

  const filteredOrders = useMemo(() => {
    const search = query.trim().toLowerCase();
    return orders.filter((order) => {
      const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
      const matchesSearch =
        !search ||
        [
          order.npa_reference_number,
          order.product_type,
          customerName(order),
          order.delivery_location ?? '',
          order.truck_number ?? '',
        ].some((value) => value.toLowerCase().includes(search));
      return matchesStatus && matchesSearch;
    });
  }, [orders, query, statusFilter]);

  const handleApprove = async (order: Order) => {
    setBusyId(order.id);
    try {
      const updated = await approveManager(order.id);
      toast.success(`Authorised. Permit ${updated.permit_id} issued.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Approval failed.');
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async () => {
    if (!rejectTarget || !rejectReason.trim()) return;
    setBusyId(rejectTarget.id);
    try {
      await reject(rejectTarget.id, rejectReason.trim());
      toast.success('Order rejected.');
      setRejectTarget(null);
      setRejectReason('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Rejection failed.');
    } finally {
      setBusyId(null);
    }
  };

  const pendingReview = orders.filter(
    (o) => o.status === 'SUBMITTED' || o.status === 'ON_HOLD',
  ).length;

  return (
    <div className="flex min-h-screen bg-[#fcf8fa] text-[#102f71]">
      <AdminSidebar />
      <main className="min-w-0 flex-1 p-5 md:p-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-on-surface-variant">
                <PackageIcon className="size-4 text-[#7fb445]" weight="bold" />
                Depot manager
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-[#102f71]">Order Review</h1>
              <p className="mt-1 text-sm text-on-surface-variant">
                Review stock, credit and documents, then grant or refuse authorisation.
                {pendingReview > 0 && ` ${pendingReview} awaiting your decision.`}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={refresh} disabled={loading}>
                {loading ? 'Refreshing…' : 'Refresh'}
              </Button>
            </div>
          </div>


          {error && (
            <div className="mb-4 border-l-2 border-rose-500 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          <section className="overflow-hidden border border-outline-variant bg-white shadow-level-1">
            <div className="flex flex-col gap-4 border-b border-outline-variant bg-surface-container-low p-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="font-semibold text-[#102f71]">Orders</h2>
                <p className="mt-0.5 text-xs text-on-surface-variant">
                  Live view across the full approval pipeline.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative w-full sm:w-72">
                  <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant" />
                  <Input
                    className="h-9 bg-white pl-9 text-sm"
                    placeholder="Search reference, customer, plate…"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <FunnelSimpleIcon className="size-4 text-on-surface-variant" weight="bold" />
                  <label className="sr-only" htmlFor="order-status-filter">Filter by status</label>
                  <select
                    id="order-status-filter"
                    className="h-9 border border-outline-variant bg-white px-3 text-xs font-medium text-[#102f71] outline-none focus:border-[#7fb445]"
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value as 'all' | OrderStatus)}
                  >
                    <option value="all">All statuses</option>
                    {ALL_STATUSES.map((status) => (
                      <option key={status} value={status}>{STATUS_LABEL[status]}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] border-collapse text-left">
                <thead className="border-b border-outline-variant bg-surface-container-low">
                  <tr className="text-[11px] font-bold uppercase tracking-[0.1em] text-on-surface-variant">
                    <th className="px-5 py-3">Reference</th>
                    <th className="px-5 py-3">Product / Customer</th>
                    <th className="px-5 py-3">Quantity</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Vehicle</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {filteredOrders.map((order) => {
                    const isExpanded = expandedOrderId === order.id;
                    const currentStep = progressStep(order.status);
                    const halted = isHalted(order.status);
                    const canDecide =
                      (order.status === 'SUBMITTED' || order.status === 'ON_HOLD') &&
                      (order.available_actions?.length
                        ? order.available_actions.includes('approve_manager')
                        : true);
                    const reason = haltReason(order);

                    return (
                      <Fragment key={order.id}>
                        <tr
                          className={`group cursor-pointer transition-colors hover:bg-surface-container-low ${
                            isExpanded ? 'bg-surface-container-low' : ''
                          }`}
                          onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                        >
                          <td className="px-5 py-4">
                            <p className="font-mono text-sm font-bold text-[#7fb445]">
                              {order.npa_reference_number}
                            </p>
                            <p className="mt-1 text-xs text-on-surface-variant">
                              {order.permit_id ?? formatDate(order.created_at)}
                            </p>
                          </td>
                          <td className="px-5 py-4">
                            <p className="font-medium text-[#102f71]">
                              {order.product_display || formatProduct(order)}
                              <span className="ml-2 text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
                                {formatProductGroup(order)}
                              </span>
                            </p>
                            <p className="mt-1 text-xs text-on-surface-variant">
                              {customerName(order)} · {order.delivery_location ?? '—'}
                            </p>
                          </td>
                          <td className="px-5 py-4">
                            <p className="font-medium text-[#102f71]">{formatQuantity(order)}</p>
                            <p className="mt-1 text-xs text-on-surface-variant">
                              {formatMoney(order.total_price)}
                            </p>
                          </td>
                          <td className="px-5 py-4">
                            <span className="inline-flex items-center gap-2 font-mono text-xs font-medium uppercase tracking-wide text-on-surface">
                              <span className={`size-2 rounded-full ${STATUS_DOT[order.status]}`} />
                              {STATUS_LABEL[order.status]}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <p className="font-mono text-sm text-[#102f71]">{order.truck_number ?? '—'}</p>
                            <p className="mt-1 text-xs text-on-surface-variant">{order.driver_name ?? '—'}</p>
                          </td>
                          <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                            {canDecide ? (
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  disabled={busyId === order.id}
                                  className="bg-[#7fb445] text-xs text-white hover:bg-[#6f9e3d]"
                                  onClick={() => handleApprove(order)}
                                >
                                  Authorise
                                </Button>
                                <Dialog
                                  open={rejectTarget?.id === order.id}
                                  onOpenChange={(open) => {
                                    setRejectTarget(open ? order : null);
                                    if (!open) setRejectReason('');
                                  }}
                                >
                                  <DialogTrigger asChild>
                                    <Button variant="outline" size="sm" className="text-xs">
                                      Reject
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>
                                        Reject {order.npa_reference_number}
                                      </DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-4">
                                      <div className="space-y-2">
                                        <Label htmlFor="reject-reason">
                                          Rejection Reason
                                        </Label>
                                        <Input
                                          id="reject-reason"
                                          placeholder="e.g. Credit limit exceeded"
                                          value={rejectReason}
                                          onChange={(e) => setRejectReason(e.target.value)}
                                        />
                                      </div>
                                      <Button
                                        variant="destructive"
                                        className="w-full"
                                        disabled={!rejectReason.trim() || busyId === order.id}
                                        onClick={handleReject}
                                      >
                                        Reject Order
                                      </Button>
                                    </div>
                                  </DialogContent>
                                </Dialog>
                              </div>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                aria-expanded={isExpanded}
                                className="gap-1.5 text-[#102f71] hover:bg-surface-container-high"
                                onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                              >
                                {isExpanded ? 'Hide' : 'Details'}
                                <CaretDownIcon
                                  className={`size-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                  weight="bold"
                                />
                              </Button>
                            )}
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr className="bg-surface-container-low">
                            <td colSpan={6} className="p-0">
                              <div className="border-y border-outline-variant bg-white p-5 md:p-6">
                                <div className="mb-5 flex items-center justify-between gap-4 border-b border-outline-variant pb-4">
                                  <div>
                                    <p className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-[#7fb445]">
                                      {order.npa_reference_number}
                                    </p>
                                    <h3 className="mt-1 text-lg font-semibold text-[#102f71]">
                                      Order details
                                    </h3>
                                  </div>
                                  <span className="inline-flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wide text-on-surface">
                                    <span className={`size-2 rounded-full ${STATUS_DOT[order.status]}`} />
                                    {STATUS_LABEL[order.status]}
                                  </span>
                                </div>

                                <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(240px,0.9fr)]">
                                  <section>
                                    <h4 className="mb-5 text-sm font-semibold text-[#102f71]">
                                      Order Progression
                                    </h4>
                                    <div className="grid grid-cols-4 gap-2">
                                      {PROGRESS_STAGES.map((stage, index) => {
                                        const isComplete = index < currentStep && !halted;
                                        const isCurrent = index === currentStep && !halted;
                                        return (
                                          <div key={stage} className="relative min-w-0">
                                            {index < PROGRESS_STAGES.length - 1 && (
                                              <div
                                                className={`absolute left-1/2 right-0 top-4 h-px ${
                                                  index < currentStep && !halted
                                                    ? 'bg-[#7fb445]'
                                                    : 'bg-outline-variant'
                                                }`}
                                              />
                                            )}
                                            <div className="relative z-10 flex flex-col items-center text-center">
                                              <div
                                                className={`flex size-8 items-center justify-center border-2 border-white ${
                                                  isComplete
                                                    ? 'bg-[#7fb445] text-white'
                                                    : isCurrent
                                                      ? 'bg-[#102f71] text-white'
                                                      : 'bg-surface-container-high text-on-surface-variant'
                                                }`}
                                              >
                                                {isComplete ? (
                                                  <CheckIcon className="size-4" weight="bold" />
                                                ) : isCurrent ? (
                                                  <TruckIcon className="size-4" weight="bold" />
                                                ) : (
                                                  <ClockIcon className="size-4" />
                                                )}
                                              </div>
                                              <p
                                                className={`mt-2 text-[10px] font-bold uppercase tracking-wide ${
                                                  isCurrent ? 'text-[#102f71]' : 'text-on-surface-variant'
                                                }`}
                                              >
                                                {stage}
                                              </p>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>

                                    {reason && (
                                      <p className="mt-5 border-l-2 border-rose-500 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                                        <strong>{STATUS_LABEL[order.status]}:</strong> {reason}
                                      </p>
                                    )}
                                  </section>

                                  <section className="border-l border-outline-variant pl-6">
                                    <h4 className="mb-4 text-sm font-semibold text-[#102f71]">Summary</h4>
                                    <dl className="space-y-3 text-xs">
                                      <div className="flex gap-3">
                                        <PackageIcon className="size-4 shrink-0 text-[#7fb445]" weight="bold" />
                                        <div>
                                          <dt className="text-on-surface-variant">Product &amp; quantity</dt>
                                          <dd className="mt-0.5 font-medium text-[#102f71]">
                                            {order.product_display || formatProduct(order)} · {formatQuantity(order)}
                                            <span className="ml-2 text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
                                              {formatProductGroup(order)}
                                            </span>
                                          </dd>
                                          <p className="mt-0.5 text-[11px] text-slate-500">
                                            BRV Configuration: {order.compartments ?? 4} compartments
                                          </p>
                                        </div>
                                      </div>
                                      <div className="flex gap-3">
                                        <CalendarIcon className="size-4 shrink-0 text-[#7fb445]" weight="bold" />
                                        <div>
                                          <dt className="text-on-surface-variant">Scheduled delivery</dt>
                                          <dd className="mt-0.5 font-medium text-[#102f71]">
                                            {formatDate(order.delivery_date)} at {formatTime(order.delivery_time)}
                                          </dd>
                                        </div>
                                      </div>
                                      <div className="flex gap-3">
                                        <MapPinIcon className="size-4 shrink-0 text-[#7fb445]" weight="bold" />
                                        <div>
                                          <dt className="text-on-surface-variant">Delivery location</dt>
                                          <dd className="mt-0.5 font-medium text-[#102f71]">
                                            {order.delivery_location ?? '—'}
                                          </dd>
                                        </div>
                                      </div>
                                      <div className="flex gap-3">
                                        <TruckIcon className="size-4 shrink-0 text-[#7fb445]" weight="bold" />
                                        <div>
                                          <dt className="text-on-surface-variant">Vehicle &amp; driver</dt>
                                          <dd className="mt-0.5 font-medium text-[#102f71]">
                                            {order.truck_number ?? '—'} · {order.driver_name ?? '—'}
                                          </dd>
                                        </div>
                                      </div>
                                      <div className="flex gap-3">
                                        <UserIcon className="size-4 shrink-0 text-[#7fb445]" weight="bold" />
                                        <div>
                                          <dt className="text-on-surface-variant">Contact</dt>
                                          <dd className="mt-0.5 font-medium text-[#102f71]">
                                            {customerName(order)}
                                          </dd>
                                          <dd className="mt-0.5 flex items-center gap-1 text-on-surface-variant">
                                            <PhoneIcon className="size-3" />
                                            {order.contact_phone ?? '—'}
                                          </dd>
                                        </div>
                                      </div>
                                    </dl>
                                  </section>
                                </div>

                                {canDecide ? (
                                  <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 border border-[#7fb445]/30 bg-[#7fb445]/10 p-4">
                                    <div>
                                      <p className="font-semibold text-[#102f71] text-sm">Manager Decision Required</p>
                                      <p className="text-xs text-on-surface-variant">Review documents and pricing, then authorise to issue the permit or reject with a reason.</p>
                                    </div>
                                    <div className="flex gap-2">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="text-xs text-[#102f71] border-[#102f71]/30 hover:bg-[#102f71]/5"
                                        onClick={() => setInvoiceTarget(order)}
                                      >
                                        View Manifest / Receipt
                                      </Button>
                                      <Button
                                        size="sm"
                                        disabled={busyId === order.id}
                                        className="bg-[#7fb445] text-xs text-white hover:bg-[#6f9e3d]"
                                        onClick={() => handleApprove(order)}
                                      >
                                        <CheckIcon className="mr-1 size-3.5" weight="bold" />
                                        Authorise &amp; Issue Permit
                                      </Button>
                                      <Button
                                        variant="destructive"
                                        size="sm"
                                        className="text-xs"
                                        onClick={() => {
                                          setRejectTarget(order);
                                          setRejectReason('');
                                        }}
                                      >
                                        Reject Order
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="mt-6 flex justify-end">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-xs text-[#102f71] border-[#102f71]/30 hover:bg-[#102f71]/5"
                                      onClick={() => setInvoiceTarget(order)}
                                    >
                                      View Waybill / Receipt
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
              {filteredOrders.length === 0 && (
                <div className="p-12 text-center text-sm text-on-surface-variant">
                  {loading ? 'Loading orders…' : 'No orders match the current search and filter.'}
                </div>
              )}
            </div>

            <footer className="flex flex-col gap-2 border-t border-outline-variant bg-surface-container-low px-5 py-3 text-xs text-on-surface-variant sm:flex-row sm:items-center sm:justify-between">
              <span>Showing {filteredOrders.length} of {orders.length} orders</span>
              <span className="font-mono uppercase tracking-wide">Depot manager review queue</span>
            </footer>
          </section>

          {/* Official Waybill / Receipt Dialog */}
          <Dialog open={!!invoiceTarget} onOpenChange={(open) => !open && setInvoiceTarget(null)}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 border-none bg-transparent shadow-2xl">
              {invoiceTarget && (
                <Invoice order={invoiceTarget} onClose={() => setInvoiceTarget(null)} />
              )}
            </DialogContent>
          </Dialog>
        </div>
      </main>
    </div>
  );
}

export default AdminOrders;
