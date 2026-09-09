// Shared presentation helpers so every dashboard renders orders consistently.

import type { Order, OrderStatus } from '../types';

export const STATUS_DOT: Record<OrderStatus, string> = {
  SUBMITTED: 'bg-amber-500',
  MANAGER_APPROVED: 'bg-sky-500',
  REJECTED: 'bg-rose-500',
  CUSTOMS_APPROVED: 'bg-emerald-500',
  ON_HOLD: 'bg-orange-500',
  LOT_CLEARED: 'bg-violet-500',
  LOADING: 'bg-blue-500',
  COMPLETED: 'bg-[#7fb445]',
  DENIED: 'bg-red-600',
};

export const STATUS_LABEL: Record<OrderStatus, string> = {
  SUBMITTED: 'Submitted',
  MANAGER_APPROVED: 'Permit issued',
  REJECTED: 'Rejected',
  CUSTOMS_APPROVED: 'Customs cleared',
  ON_HOLD: 'On hold',
  LOT_CLEARED: 'Ready for loading',
  LOADING: 'Loading',
  COMPLETED: 'Completed',
  DENIED: 'Entry denied',
};

export const STATUS_BADGE: Record<OrderStatus, string> = {
  SUBMITTED: 'bg-amber-100 text-amber-800 border-amber-200',
  MANAGER_APPROVED: 'bg-sky-100 text-sky-800 border-sky-200',
  REJECTED: 'bg-rose-100 text-rose-800 border-rose-200',
  CUSTOMS_APPROVED: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  ON_HOLD: 'bg-orange-100 text-orange-800 border-orange-200',
  LOT_CLEARED: 'bg-violet-100 text-violet-800 border-violet-200',
  LOADING: 'bg-blue-100 text-blue-800 border-blue-200',
  COMPLETED: 'bg-green-100 text-green-800 border-green-200',
  DENIED: 'bg-red-100 text-red-800 border-red-200',
};

/** The four stages of the flowchart, for progress indicators. */
export const PROGRESS_STAGES = ['Order placed', 'Manager approval', 'Customs sign-off', 'Loading'];

const PROGRESS_INDEX: Record<OrderStatus, number> = {
  SUBMITTED: 0,
  REJECTED: 0,
  MANAGER_APPROVED: 1,
  ON_HOLD: 1,
  CUSTOMS_APPROVED: 2,
  LOT_CLEARED: 3,
  LOADING: 3,
  DENIED: 3,
  COMPLETED: 4,
};

export const progressStep = (status: OrderStatus) => PROGRESS_INDEX[status] ?? 0;

/** Statuses where the flow stopped rather than progressed. */
export const isHalted = (status: OrderStatus) =>
  status === 'REJECTED' || status === 'DENIED' || status === 'ON_HOLD';

// --- Formatting -----------------------------------------------------------

export const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value.length <= 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

export const formatTime = (value?: string | null) => {
  if (!value) return '—';
  const [hour, minute] = value.split(':').map(Number);
  if (Number.isNaN(hour)) return value;
  return new Intl.DateTimeFormat('en-GB', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(2000, 0, 1, hour, minute || 0));
};

export const num = (value: string | number | null | undefined) => {
  const parsed = typeof value === 'number' ? value : parseFloat(value ?? '0');
  return Number.isNaN(parsed) ? 0 : parsed;
};

export const formatQuantity = (order: Order) =>
  `${num(order.volume_requested).toLocaleString()} ${order.unit.toLowerCase()}`;

export const formatMoney = (value: string | number | null | undefined) =>
  `GHS ${num(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

/** Compact value for dense table cells: 1.2M / 27.6K / 940.00 */
export const formatCompact = (value: string | number | null | undefined) => {
  const amount = num(value);
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)}K`;
  return amount.toFixed(2);
};

export const customerName = (order: Order) =>
  order.contact_name || order.created_by?.name || order.customer_company || 'Unknown';

/** Short reference for display: NPA-DEMO-001 */
export const orderRef = (order: Order) => order.npa_reference_number;

/** The reason an order is halted, whichever field holds it. */
export const haltReason = (order: Order) =>
  order.rejection_reason || order.hold_reason || order.denial_reason || null;

/** Official Ghanaian NPA Product Mapping Table */
export const PRODUCT_OFFICIAL_CODES = {
  AGO: {
    code: 'AGO',
    commercial: 'Diesel',
    fullName: 'Automotive Gas Oil (Diesel)',
    officialLabel: 'AGO (Automotive Gas Oil)',
    group: 'WHITE PRODUCT',
    useCase: 'Retail / Transport',
  },
  PMS: {
    code: 'PMS',
    commercial: 'Petrol',
    fullName: 'Premium Motor Spirit (Petrol)',
    officialLabel: 'PMS (Premium Motor Spirit)',
    group: 'WHITE PRODUCT',
    useCase: 'Retail / Transport',
  },
  DPK: {
    code: 'DPK',
    commercial: 'Kerosene',
    fullName: 'Dual Purpose Kerosene (Kerosene)',
    officialLabel: 'DPK (Dual Purpose Kerosene)',
    group: 'WHITE PRODUCT',
    useCase: 'Retail / Domestic',
  },
} as const;

export const formatProduct = (order: Order) => {
  if (order.product_display) return order.product_display;
  const info = PRODUCT_OFFICIAL_CODES[order.product_type as keyof typeof PRODUCT_OFFICIAL_CODES];
  if (info) return `${info.code} (${info.commercial})`;
  return order.product_type;
};

export const formatProductGroup = (order: Order) => {
  return order.product_group || 'WHITE PRODUCT';
};

