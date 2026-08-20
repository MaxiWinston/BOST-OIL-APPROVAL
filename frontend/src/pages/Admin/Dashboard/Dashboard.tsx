import React from "react"
import { AdminSidebar } from "@/components/AdminSidebar"
import { SalesChart } from "@/components/SalesChart"
import { OutlineTable } from "@/components/OutlineTable"
import { useOrders } from "@/context/OrderContext"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
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
  const { orders, summary, loading, error, refresh } = useOrders()

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
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <Button variant="outline" onClick={refresh} disabled={loading}>
              {loading ? 'Refreshing…' : 'Refresh'}
            </Button>
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
              <CardContent><div className="text-2xl font-bold">{stats.totalOrders}</div></CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Total Value</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatMoney(stats.totalValue)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Awaiting Your Decision</CardTitle>
              </CardHeader>
              <CardContent><div className="text-2xl font-bold">{stats.awaitingDecision}</div></CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Completed</CardTitle>
              </CardHeader>
              <CardContent><div className="text-2xl font-bold">{stats.completed}</div></CardContent>
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
