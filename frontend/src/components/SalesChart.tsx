import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { useOrders } from "@/context/OrderContext"
import { num } from "@/lib/orderDisplay"

const chartConfig = {
  sales: {
    label: "Order value (GHS)",
    color: "#7fb445",
  },
} satisfies ChartConfig

export function SalesChart() {
  const { orders } = useOrders();

  // Aggregate order value by day.
  const dailySales = React.useMemo(() => {
    const salesByDay: Record<string, number> = {};

    orders.forEach((order) => {
      const date = new Date(order.created_at);
      if (Number.isNaN(date.getTime())) return;
      const dayKey = date.toISOString().split('T')[0];
      salesByDay[dayKey] = (salesByDay[dayKey] ?? 0) + num(order.total_price);
    });

    // Sort on the raw ISO key, then format for display. Sorting on the
    // formatted label loses the year and misorders across month boundaries.
    return Object.entries(salesByDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => ({
        date: new Date(key).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' }),
        sales: Math.round(value),
      }));
  }, [orders]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Order Value</CardTitle>
        <CardDescription>Total order value per day</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[250px] w-full">
          <AreaChart data={dailySales.length > 0 ? dailySales : [{ date: 'No Data', sales: 0 }]}>
            <defs>
              <linearGradient id="fillSales" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-sales)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-sales)"
                  stopOpacity={0.1}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => `GHS ${value}`}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="dashed" />}
            />
            <Area
              dataKey="sales"
              type="monotone"
              fill="url(#fillSales)"
              stroke="var(--color-sales)"
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
