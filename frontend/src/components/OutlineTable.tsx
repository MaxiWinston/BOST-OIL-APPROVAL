import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { CheckIcon, MagnifyingGlassIcon } from "@phosphor-icons/react"
import { useOrders } from "@/context/OrderContext"
import { useAuth } from "@/context/AuthContext"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { Order } from "@/types"
import {
  STATUS_DOT,
  STATUS_LABEL,
  formatDate,
  formatTime,
  formatQuantity,
  customerName,
} from "@/lib/orderDisplay"

export function OutlineTable() {
  const { orders, approveManager } = useOrders()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [query, setQuery] = useState("")
  const [busyId, setBusyId] = useState<number | null>(null)

  const isManagerOrAdmin = user?.role === 'MANAGER' || user?.role === 'ADMIN'
  const ordersPath = user?.role === 'MANAGER' ? '/manager/orders' : '/admin/orders'

  const visibleOrders = useMemo(() => {
    const search = query.trim().toLowerCase()
    if (!search) return orders
    return orders.filter((order) =>
      [
        order.npa_reference_number,
        order.product_type,
        customerName(order),
        order.delivery_location ?? "",
      ].some((value) => value.toLowerCase().includes(search)),
    )
  }, [orders, query])

  const handleApprove = async (order: Order) => {
    setBusyId(order.id)
    try {
      const updated = await approveManager(order.id)
      toast.success(`Authorised. Permit ${updated.permit_id} issued.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Approval failed.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Card className="mt-6 overflow-hidden border-outline-variant bg-surface-container-lowest shadow-level-1">
      <CardContent className="p-0">
        <div className="flex flex-col gap-4 border-b border-outline-variant bg-surface-container-low p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#102f71]">Order History</h2>
            <p className="mt-0.5 text-xs text-on-surface-variant">Latest procurement and fulfillment activity.</p>
          </div>
          <div className="relative w-full sm:w-80">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant" />
            <Input className="h-9 bg-white pl-9 text-sm" placeholder="Search order ID, customer, terminal..." value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead className="border-b border-outline-variant bg-surface-container-low">
              <tr className="text-[11px] font-bold uppercase tracking-[0.1em] text-on-surface-variant">
                <th className="px-6 py-4">Order ID</th>
                <th className="px-6 py-4">Product</th>
                <th className="px-6 py-4">Quantity</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">ETD / Delivered</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {visibleOrders.map((order) => {
                const canApprove = isManagerOrAdmin && (order.status === 'SUBMITTED' || order.status === 'ON_HOLD')
                return (
                  <tr key={order.id} className="group transition-colors hover:bg-surface-container-low">
                    <td className="px-6 py-5 font-mono text-sm font-bold text-[#7fb445]">{order.npa_reference_number}</td>
                    <td className="px-6 py-5"><p className="font-medium text-[#102f71]">{order.product_type}</p><p className="mt-1 text-xs text-on-surface-variant">{customerName(order)} · {order.delivery_location ?? "—"}</p></td>
                    <td className="px-6 py-5 font-medium text-[#102f71]">{formatQuantity(order)}</td>
                    <td className="px-6 py-5"><span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-on-surface"><span className={`size-2 ${STATUS_DOT[order.status]}`} />{STATUS_LABEL[order.status]}</span></td>
                    <td className="px-6 py-5 text-sm text-on-surface-variant">{formatDate(order.delivery_date)}, {formatTime(order.delivery_time)}</td>
                    <td className="px-6 py-5 text-right">
                      {canApprove ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            disabled={busyId === order.id}
                            className="bg-[#7fb445] text-xs text-white hover:bg-[#6f9e3d]"
                            onClick={() => handleApprove(order)}
                          >
                            <CheckIcon className="mr-1 size-3.5" weight="bold" />
                            Authorise
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs"
                            onClick={() => navigate(ordersPath)}
                          >
                            Review
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs text-[#102f71] hover:bg-surface-container-high"
                          onClick={() => navigate(ordersPath)}
                        >
                          View
                        </Button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {visibleOrders.length === 0 && <div className="p-10 text-center text-sm text-on-surface-variant">No orders match your search.</div>}
        </div>

        <div className="flex flex-col gap-3 border-t border-outline-variant bg-surface-container-low px-6 py-4 text-xs text-on-surface-variant sm:flex-row sm:items-center sm:justify-between">
          <span>Showing {visibleOrders.length} of {orders.length} entries</span>
          <div className="flex gap-2"><Button variant="outline" size="sm" disabled>Prev</Button><Button size="sm" className="bg-[#102f71] text-white hover:bg-[#102f71]">1</Button><Button variant="outline" size="sm" disabled>Next</Button></div>
        </div>
      </CardContent>
    </Card>
  )
}
