import type { Order } from '../../types';
import { Button } from '../ui/button';
import { formatDate, formatMoney, formatTime, formatProduct, num } from '../../lib/orderDisplay';
import { PrinterIcon, CheckCircleIcon, ShieldCheckIcon } from '@phosphor-icons/react';

interface InvoiceProps {
  order: Order;
  onClose?: () => void;
}

export function Invoice({ order, onClose }: InvoiceProps) {
  const handlePrint = () => window.print();

  const quantity = num(order.quantity_loaded ?? order.volume_requested);
  const unit = order.unit ? order.unit.toUpperCase() : 'LITERS';
  const compartments = order.compartments ?? 4;
  const productGroup = order.product_group ?? 'WHITE PRODUCT';

  return (
    <div className="p-4 md:p-6 bg-white text-slate-900 print:p-0 print:m-0 font-sans">
      <div className="max-w-3xl mx-auto border border-slate-300 shadow-sm print:shadow-none print:border-none p-6 md:p-8 rounded-lg">
        {/* Top Header */}
        <div className="border-b-2 border-slate-900 pb-5 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-[#102f71] text-white px-2 py-0.5 text-xs font-bold uppercase tracking-wider rounded">
                  BOST GHANA
                </span>
                <span className="bg-[#7fb445] text-white px-2 py-0.5 text-xs font-bold uppercase tracking-wider rounded">
                  NPA COMPLIANT
                </span>
              </div>
              <h1 className="text-xl md:text-2xl font-black mt-2 tracking-tight text-[#102f71]">
                BULK OIL STORAGE &amp; TRANSPORTATION
              </h1>
              <p className="text-xs text-slate-600 font-medium">
                National Petroleum Authority (NPA) Official Petroleum Manifest &amp; Waybill
              </p>
              <p className="text-xs text-slate-500">Tema Central Depot · P.O. Box 470, Tema, Ghana</p>
            </div>

            <div className="text-left sm:text-right font-mono">
              <p className="text-xs text-slate-500 uppercase font-semibold">Order Reference</p>
              <p className="text-sm font-bold text-[#7fb445]">{order.npa_reference_number}</p>
              {order.waybill_number && (
                <p className="text-xs font-bold text-slate-800 mt-1">Waybill: {order.waybill_number}</p>
              )}
              {order.permit_id && (
                <p className="text-xs text-slate-600">Permit: {order.permit_id}</p>
              )}
              <p className="text-xs text-slate-500 mt-1">
                Date: {formatDate(order.completed_at ?? order.created_at)}
              </p>
            </div>
          </div>
        </div>

        {/* NPA Purchase Order & Product Specification Banner */}
        <div className="mb-6 bg-slate-50 border border-slate-200 rounded p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-slate-500 font-medium uppercase block">Product Group</span>
              <span className="font-bold text-slate-900 text-sm">{productGroup}</span>
            </div>
            <div>
              <span className="text-slate-500 font-medium uppercase block">Official Code</span>
              <span className="font-bold text-[#102f71] text-sm">{order.product_type}</span>
            </div>
            <div>
              <span className="text-slate-500 font-medium uppercase block">Commercial Name</span>
              <span className="font-bold text-slate-900 text-sm">
                {order.product_name || formatProduct(order)}
              </span>
            </div>
            <div>
              <span className="text-slate-500 font-medium uppercase block">BRV Configuration</span>
              <span className="font-bold text-slate-900 text-sm">
                {compartments} Compartments
              </span>
            </div>
          </div>
        </div>

        {/* Customer / Consignee & Delivery Point */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
          <div className="border border-slate-200 rounded p-4">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Consignee / Customer OMC
            </h2>
            <p className="text-base font-bold text-[#102f71]">{order.customer_company ?? 'Commercial OMC'}</p>
            <p className="text-xs text-slate-600 mt-1">Contact: {order.contact_name ?? 'Operations Officer'}</p>
            <p className="text-xs text-slate-600">Phone: {order.contact_phone ?? '—'}</p>
            <p className="text-xs text-slate-600">Email: {order.contact_email ?? '—'}</p>
          </div>

          <div className="border border-slate-200 rounded p-4">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Designated Delivery Point
            </h2>
            <p className="text-base font-bold text-slate-900">
              {order.delivery_location || 'Razs Oil Sorkpeyiri SS'}
            </p>
            <div className="mt-2 text-xs text-slate-600 grid grid-cols-2 gap-2">
              <div>
                <span className="text-slate-500 block">Scheduled Date:</span>
                <span className="font-medium">{formatDate(order.delivery_date)}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Dispatch Time:</span>
                <span className="font-medium">{formatTime(order.delivery_time)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Transport & Vehicle Details */}
        <div className="border border-slate-200 rounded p-4 mb-6">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            Haulage &amp; Bulk Road Vehicle (BRV) Transport Details
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-slate-500 block">Truck / BRV Plate</span>
              <span className="font-mono font-bold text-slate-900 text-sm">
                {order.verified_truck_number || order.truck_number || '—'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Authorized Driver</span>
              <span className="font-medium text-slate-900">{order.driver_name ?? '—'}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Driver Phone</span>
              <span className="font-medium text-slate-900">{order.driver_phone ?? '—'}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Depot Gantry</span>
              <span className="font-medium text-slate-900">{order.depot_id || 'DEPOT-TEMA-01'}</span>
            </div>
          </div>
        </div>

        {/* Product Breakdown & Quantity Table */}
        <div className="mb-6">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-y-2 border-slate-800 bg-slate-100 font-bold text-slate-700 uppercase">
                <th className="text-left py-2.5 px-3">Product Description</th>
                <th className="text-left py-2.5 px-3">Group</th>
                <th className="text-right py-2.5 px-3">Volume Dispensed</th>
                <th className="text-right py-2.5 px-3">Rate (GHS/{unit})</th>
                <th className="text-right py-2.5 px-3">Total Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr>
                <td className="py-3 px-3">
                  <p className="font-bold text-slate-900">
                    {order.product_display || `${order.product_type} (${order.product_name || 'Fuel'})`}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Retail Outlets Standard Distribution · {compartments} BRV Compartments
                  </p>
                </td>
                <td className="py-3 px-3 font-medium text-slate-700">{productGroup}</td>
                <td className="py-3 px-3 text-right font-mono font-semibold text-slate-900">
                  {quantity.toLocaleString()} {unit}
                </td>
                <td className="py-3 px-3 text-right font-mono text-slate-700">
                  {formatMoney(order.price_per_unit)}
                </td>
                <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                  {formatMoney(order.total_price)}
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-800 font-bold">
                <td colSpan={3} className="py-3 px-3 text-right text-slate-700 uppercase">
                  Grand Total
                </td>
                <td colSpan={2} className="py-3 px-3 text-right font-mono text-base text-[#102f71]">
                  {formatMoney(order.total_price)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Multi-Stage Sign-off & Stamps */}
        <div className="border border-slate-200 rounded p-4 mb-6 bg-slate-50/50">
          <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3">
            Official Approvals &amp; Manifest Verification
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="border border-dashed border-slate-300 rounded p-3 bg-white">
              <div className="flex items-center gap-1.5 text-emerald-700 font-bold mb-1">
                <CheckCircleIcon className="size-4 shrink-0" weight="fill" />
                <span>BOST Depot Manager</span>
              </div>
              <p className="text-slate-600 text-[11px]">Permit Granted: {order.permit_id ?? 'ISSUED'}</p>
              <p className="text-slate-400 text-[10px] mt-2">
                {order.approved_by_manager?.name ?? 'Ama Boateng (Manager)'}
              </p>
            </div>

            <div className="border border-dashed border-slate-300 rounded p-3 bg-white">
              <div className="flex items-center gap-1.5 text-emerald-700 font-bold mb-1">
                <ShieldCheckIcon className="size-4 shrink-0" weight="fill" />
                <span>Customs Officer Sign-off</span>
              </div>
              <p className="text-slate-600 text-[11px]">Excise Duty Cleared &amp; Certified</p>
              <p className="text-slate-400 text-[10px] mt-2">
                {order.approved_by_customs?.name ?? 'Kofi Anane (Customs)'}
              </p>
            </div>

            <div className="border border-dashed border-slate-300 rounded p-3 bg-white">
              <div className="flex items-center gap-1.5 text-emerald-700 font-bold mb-1">
                <CheckCircleIcon className="size-4 shrink-0" weight="fill" />
                <span>Loading Bay Gantry</span>
              </div>
              <p className="text-slate-600 text-[11px]">Metered &amp; Sealed to BRV</p>
              <p className="text-slate-400 text-[10px] mt-2">
                {order.loaded_by?.name ?? 'Yaw Owusu (Operator)'}
              </p>
            </div>
          </div>
        </div>

        {/* Footer & Print Button */}
        <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-slate-500">
          <p>This is a computer-generated official Ghanaian National Petroleum Authority (NPA) manifest.</p>
          <div className="flex items-center gap-2 print:hidden">
            {onClose && (
              <Button variant="outline" size="sm" onClick={onClose}>
                Close
              </Button>
            )}
            <Button size="sm" className="bg-[#102f71] text-white hover:bg-[#0c2456] gap-1.5" onClick={handlePrint}>
              <PrinterIcon className="size-4" weight="bold" />
              Print Receipt
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
