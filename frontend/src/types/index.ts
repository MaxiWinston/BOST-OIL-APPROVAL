// Domain types mirroring the Django API contract.
// Role and status strings are exactly what the backend sends.

export type UserRole =
  | 'MANAGER'
  | 'CUSTOMS_OFFICER'
  | 'DEPOT_OPERATOR'
  | 'ADMIN';

export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  name: string;
  role: UserRole;
  role_display: string;
  depot_id: string | null;
  phone_number: string | null;
  company_name: string | null;
  location: string | null;
  is_active: boolean;
  date_joined: string;
}

export type QuantityUnit = 'LITERS' | 'GALLONS';

/** Mirrors NPARequestStatus in apps/dispatch/models.py */
export type OrderStatus =
  | 'SUBMITTED'
  | 'MANAGER_APPROVED'
  | 'REJECTED'
  | 'CUSTOMS_APPROVED'
  | 'ON_HOLD'
  | 'LOT_CLEARED'
  | 'LOADING'
  | 'COMPLETED'
  | 'DENIED';

/** Workflow actions the current user may perform on an order right now.
 *  Computed server-side so the UI never duplicates the workflow rules. */
export type OrderAction =
  | 'approve_manager'
  | 'reject'
  | 'approve_customs'
  | 'hold'
  | 'clear_lot'
  | 'start_loading'
  | 'deny_entry'
  | 'complete_loading';

export interface Order {
  id: number;
  npa_reference_number: string;
  permit_id: string | null;

  product_type: string;
  volume_requested: string;
  unit: QuantityUnit;
  depot_id: string;

  status: OrderStatus;
  status_display: string;

  customer_company: string | null;
  delivery_date: string | null;
  delivery_time: string | null;
  delivery_location: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;

  truck_number: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  tanker: number | null;

  price_per_unit: string;
  total_price: string;

  created_by: User | null;
  created_at: string;
  updated_at: string;

  approved_by_manager: User | null;
  manager_approval_time: string | null;
  approved_by_customs: User | null;
  customs_approval_time: string | null;
  cleared_by_operator: User | null;
  lot_clearance_time: string | null;

  rejected_by: User | null;
  rejection_reason: string | null;
  held_by: User | null;
  hold_reason: string | null;
  hold_time: string | null;

  verified_truck_number: string | null;
  car_number_matches: boolean | null;
  loading_started_at: string | null;
  loaded_by: User | null;
  quantity_loaded: string | null;
  completed_at: string | null;

  denied_by: User | null;
  denial_reason: string | null;

  waybill_number: string | null;
  available_actions: OrderAction[];
}

/** Payload for submitting a new order. */
export interface CreateOrderPayload {
  product_type: string;
  volume_requested: number;
  unit: QuantityUnit;
  depot_id?: string;
  delivery_date?: string;
  delivery_time?: string;
  delivery_location?: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  truck_number?: string;
  driver_name?: string;
  driver_phone?: string;
}

export interface Paginated<T> {
  count: number;
  total_pages: number;
  current_page: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface OrderSummary {
  SUBMITTED: number;
  MANAGER_APPROVED: number;
  REJECTED: number;
  CUSTOMS_APPROVED: number;
  ON_HOLD: number;
  LOT_CLEARED: number;
  LOADING: number;
  COMPLETED: number;
  DENIED: number;
  TOTAL: number;
}

export interface AuditEntry {
  entity_type: string;
  entity_id: string;
  previous_state: string | null;
  new_state: string | null;
  user_id: number | null;
  user_role: string | null;
  notes: string | null;
  timestamp: string;
}

export interface TvBayOrder {
  id: number;
  npa_reference_number: string;
  truck_number: string;
  driver_name: string;
  customer_company: string;
  product_type: string;
  volume_requested: number;
  unit: string;
  status: OrderStatus;
  status_display: string;
  bay_state?: 'AUTHORIZED' | 'DISPENSING' | 'HOLD';
  flow_rate_lpm?: number;
  lot_clearance_time: string | null;
  loading_started_at: string | null;
}

export interface TvBaySlot {
  slot_number: number;
  bay_label: string;
  is_occupied: boolean;
  is_maintenance?: boolean;
  order: TvBayOrder | null;
}

export interface TvTelemetryStats {
  capacity_percent: number;
  current_flow_rate: string;
  operating_pressure_psi: string;
  terminal_status: string;
  weather: string;
}

export interface TvDisplayData {
  depot_name: string;
  server_time: string;
  total_active: number;
  queued_count?: number;
  telemetry?: TvTelemetryStats;
  bays: TvBaySlot[];
}

// --- Presentation helpers -------------------------------------------------

export const STATUS_LABELS: Record<OrderStatus, string> = {
  SUBMITTED: 'Submitted',
  MANAGER_APPROVED: 'Permit Issued',
  REJECTED: 'Rejected',
  CUSTOMS_APPROVED: 'Cleared by Customs',
  ON_HOLD: 'On Hold',
  LOT_CLEARED: 'Ready for Loading',
  LOADING: 'Loading',
  COMPLETED: 'Completed',
  DENIED: 'Entry Denied',
};

export const STATUS_COLORS: Record<OrderStatus, string> = {
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

export const ROLE_HOME: Record<UserRole, string> = {
  MANAGER: '/manager/orders',
  ADMIN: '/admin/dashboard',
  CUSTOMS_OFFICER: '/signoff/dashboard',
  DEPOT_OPERATOR: '/loadingdock/dashboard',
};
