import type { Order } from '../../types';
import { Button } from '../ui/button';
import { formatDate, formatMoney, formatTime, num } from '../../lib/orderDisplay';

interface InvoiceProps {
  order: Order;
}

export function Invoice({ order }: InvoiceProps) {
  const handlePrint = () => window.print();

  const quantity = num(order.quantity_loaded ?? order.volume_requested);
  const unit = order.unit.toLowerCase();

  return (
    <div className="p-6 bg-white">
      <div className="max-w-2xl mx-auto border p-8 rounded-lg">
        <div className="border-b pb-4 mb-6">
          <h1 className="text-2xl font-bold mb-2">WAYBILL / INVOICE</h1>
          <div className="flex justify-between">
            <div>
              <p className="font-semibold">BOST — Bulk Oil Storage &amp; Transportation</p>
              <p className="text-sm text-gray-600">Tema Oil Depot</p>
              <p className="text-sm text-gray-600">Tema, Ghana</p>
            </div>
            <div className="text-right">
              <p className="font-semibold">{order.npa_reference_number}</p>
              {order.waybill_number && (
                <p className="text-sm text-gray-600">Waybill: {order.waybill_number}</p>
              )}
              {order.permit_id && (
                <p className="text-sm text-gray-600">Permit: {order.permit_id}</p>
              )}
              <p className="text-sm text-gray-600">
                Date: {formatDate(order.completed_at ?? order.updated_at)}
              </p>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <h2 className="font-semibold mb-2">Bill To:</h2>
          <p className="text-sm">{order.customer_company ?? '—'}</p>
          <p className="text-sm">{order.contact_name ?? '—'}</p>
          <p className="text-sm">{order.contact_email ?? '—'}</p>
          <p className="text-sm">{order.contact_phone ?? '—'}</p>
        </div>

        <div className="mb-6">
          <h2 className="font-semibold mb-2">Order Details:</h2>
          <div className="bg-gray-50 p-4 rounded">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Product:</p>
                <p className="font-medium">{order.product_type}</p>
              </div>
              <div>
                <p className="text-gray-600">Quantity loaded:</p>
                <p className="font-medium">{quantity.toLocaleString()} {unit}</p>
              </div>
              <div>
                <p className="text-gray-600">Delivery date:</p>
                <p className="font-medium">{formatDate(order.delivery_date)}</p>
              </div>
              <div>
                <p className="text-gray-600">Delivery time:</p>
                <p className="font-medium">{formatTime(order.delivery_time)}</p>
              </div>
              <div>
                <p className="text-gray-600">Vehicle:</p>
                <p className="font-medium">{order.truck_number ?? '—'}</p>
              </div>
              <div>
                <p className="text-gray-600">Driver:</p>
                <p className="font-medium">{order.driver_name ?? '—'}</p>
              </div>
              <div className="col-span-2">
                <p className="text-gray-600">Delivery location:</p>
                <p className="font-medium">{order.delivery_location ?? '—'}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Description</th>
                <th className="text-right py-2">Rate</th>
                <th className="text-right py-2">Quantity</th>
                <th className="text-right py-2">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="py-2">{order.product_type}</td>
                <td className="text-right py-2">{formatMoney(order.price_per_unit)}/{unit}</td>
                <td className="text-right py-2">{quantity.toLocaleString()}</td>
                <td className="text-right py-2">{formatMoney(order.total_price)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="border-t pt-4 flex justify-end">
          <p className="text-lg font-bold">Total: {formatMoney(order.total_price)}</p>
        </div>

        <div className="mt-8 pt-4 border-t text-center text-sm text-gray-600">
          <p>Thank you for your business.</p>
          <p>This document confirms the order was authorised, cleared and loaded.</p>
        </div>

        <div className="mt-6 flex justify-end">
          <Button onClick={handlePrint}>Print</Button>
        </div>
      </div>
    </div>
  );
}
