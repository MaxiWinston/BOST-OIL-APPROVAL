import React from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { AdminSidebar } from "@/components/AdminSidebar"
import { SalesChart } from "@/components/SalesChart"
import { OutlineTable } from "@/components/OutlineTable"
import { useOrders } from "@/context/OrderContext"
import { useAuth } from "@/context/AuthContext"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowRightIcon, LightningIcon } from "@phosphor-icons/react"
import { formatMoney, num, STATUS_LABEL, STATUS_DOT } from "@/lib/orderDisplay"
import type { OrderStatus } from "@/types"

const PIPELINE: OrderStatus[] = [
  'SUBMITTED',
  'MANAGER_APPROVED',
  'CUSTOMS_APPROVED',
  'LOT_CLEARED',
  'LOADING',
  'COMPLETED',
]

const EXCEPTIONS: OrderStatus[] = ['ON_HOLD', 'REJECTED', 'DENIED']

export default function Page() {
  const { orders, summary, loading, error, refresh, sendNPABatch } = useOrders()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [generating, setGenerating] = React.useState(false)

  const ordersPath = user?.role === 'MANAGER' ? '/manager/orders' : '/admin/orders'

  const handleGenerateBatch = async () => {
    setGenerating(true)
    try {
      const res = await sendNPABatch({ count: 10 })
      toast.success(res.message || '10 new NPA orders generated successfully.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to receive NPA batch.')
    } finally {
      setGenerating(false)
    }
  }

  const stats = React.useMemo(() => {
    const totalValue = orders.reduce((sum, order) => sum + num(order.total_price), 0)
    const awaitingDecision = orders.filter(
      (o) => o.status === 'SUBMITTED' || o.status === 'ON_HOLD',
    ).length
    return {
      totalOrders: summary?.TOTAL ?? orders.length,
      totalValue,
      awaitingDecision,
      completed: summary?.COMPLETED ?? orders.filter((o) => o.status === 'COMPLETED').length,
    }
  }, [orders, summary])

  const count = (status: OrderStatus) =>
    summary?.[status] ?? orders.filter((o) => o.status === status).length

  return (
    <div className="flex">
      <AdminSidebar />
      <main className="flex-1 min-h-screen bg-gray-50 p-8 [&_*]:!rounded-none">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-[#102f71]">Dashboard</h1>
              <p className="text-sm text-gray-500 mt-1">Operational metrics and approval workflow overview.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="bg-white border-amber-500/50 text-amber-900 hover:bg-amber-50"
                onClick={handleGenerateBatch}
                disabled={generating || loading}
              >
                <LightningIcon className="mr-1.5 size-4 text-amber-600" weight="fill" />
                {generating ? 'Receiving Batch…' : 'Receive NPA Batch (+10)'}
              </Button>
              <Button
                variant="outline"
                className="bg-white border-gray-300"
                onClick={refresh}
                disabled={loading}
              >
                {loading ? 'Refreshing…' : 'Refresh'}
              </Button>
              <Button
                className="bg-[#7fb445] text-white hover:bg-[#6f9e3d]"
                onClick={() => navigate(ordersPath)}
              >
                Review Orders
                <ArrowRightIcon className="ml-1.5 size-4" weight="bold" />
              </Button>
            </div>
          </div>

          {error && (
            <div className="mb-4 border-l-2 border-rose-500 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Total Orders</CardTitle>
              </CardHeader>
              <CardContent><div className="text-2xl font-bold text-[#102f71]">{stats.totalOrders}</div></CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Total Value</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-[#102f71]">{formatMoney(stats.totalValue)}</div>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer border-[#7fb445]/40 bg-[#7fb445]/5 transition hover:shadow-md"
              onClick={() => navigate(ordersPath)}
            >
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium text-[#102f71]">Awaiting Decision</CardTitle>
                <span className="text-xs text-[#7fb445] font-semibold">Review &rarr;</span>
              </CardHeader>
              <CardContent><div className="text-2xl font-bold text-[#7fb445]">{stats.awaitingDecision}</div></CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Completed</CardTitle>
              </CardHeader>
              <CardContent><div className="text-2xl font-bold text-[#102f71]">{stats.completed}</div></CardContent>
            </Card>
          </div>

          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-base">Approval pipeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
                {PIPELINE.map((status) => (
                  <div key={status} className="border-l-2 border-gray-200 pl-3">
                    <p className="flex items-center gap-2 text-xs font-medium text-gray-600">
                      <span className={`size-2 rounded-full ${STATUS_DOT[status]}`} />
                      {STATUS_LABEL[status]}
                    </p>
                    <p className="mt-1 text-2xl font-bold">{count(status)}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 grid grid-cols-3 gap-4 border-t pt-4">
                {EXCEPTIONS.map((status) => (
                  <div key={status}>
                    <p className="flex items-center gap-2 text-xs font-medium text-gray-600">
                      <span className={`size-2 rounded-full ${STATUS_DOT[status]}`} />
                      {STATUS_LABEL[status]}
                    </p>
                    <p className="mt-1 text-xl font-bold">{count(status)}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <SalesChart />
          <OutlineTable />
        </div>
      </main>
    </div>
  )
}
