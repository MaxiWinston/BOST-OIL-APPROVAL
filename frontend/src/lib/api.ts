// Typed API client for the BOST Django backend.
//
// Handles JWT storage, automatic access-token refresh on 401, and unwrapping
// the backend's custom error envelope into a plain Error message.

import type {
  User,
  Order,
  CreateOrderPayload,
  Paginated,
  OrderSummary,
  AuditEntry,
  TvDisplayData,
} from '../types';

const BASE_URL = (
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8000'
).replace(/\/$/, '');

const API = `${BASE_URL}/api/v1`;

const ACCESS_KEY = 'bost.access';
const REFRESH_KEY = 'bost.refresh';

// --- Token storage --------------------------------------------------------

export const tokens = {
  get access() {
    return localStorage.getItem(ACCESS_KEY);
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY);
  },
  set(access: string, refresh?: string) {
    localStorage.setItem(ACCESS_KEY, access);
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

// --- Error handling -------------------------------------------------------

export class ApiError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

/** The backend wraps errors as { error: { message, details, ... } }.
 *  DRF field errors arrive as { field: [msg] }. Flatten both to one string. */
function extractMessage(body: any, fallback: string): string {
  if (!body) return fallback;

  const envelope = body.error ?? body;

  const fromDetail = envelope.details?.detail ?? envelope.detail;
  if (Array.isArray(fromDetail) && fromDetail.length) return String(fromDetail[0]);
  if (typeof fromDetail === 'string' && fromDetail !== 'Validation error occurred') {
    return fromDetail;
  }

  if (envelope.details && typeof envelope.details === 'object') {
    const parts: string[] = [];
    for (const [field, value] of Object.entries(envelope.details)) {
      const text = Array.isArray(value) ? value.join(' ') : String(value);
      parts.push(field === 'detail' || field === 'non_field_errors' ? text : `${field}: ${text}`);
    }
    if (parts.length) return parts.join('\n');
  }

  if (typeof envelope.message === 'string') return envelope.message;
  return fallback;
}

// --- Core request ---------------------------------------------------------

let refreshInFlight: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (!tokens.refresh) return false;

  // Collapse concurrent 401s into a single refresh call.
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const response = await fetch(`${API}/auth/refresh/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh: tokens.refresh }),
        });
        if (!response.ok) return false;
        const data = await response.json();
        tokens.set(data.access, data.refresh);
        return true;
      } catch {
        return false;
      } finally {
        // Release the lock on the next tick so waiters read the fresh token.
        setTimeout(() => {
          refreshInFlight = null;
        }, 0);
      }
    })();
  }

  return refreshInFlight;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...((options.headers as Record<string, string>) ?? {}),
  };

  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  if (tokens.access) {
    headers.Authorization = `Bearer ${tokens.access}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API}${path}`, { ...options, headers });
  } catch {
    throw new ApiError(
      'Cannot reach the API. Is the Django server running on ' + BASE_URL + '?',
      0,
    );
  }

  if (response.status === 401 && retry && tokens.refresh) {
    if (await tryRefresh()) {
      return request<T>(path, options, false);
    }
    tokens.clear();
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new ApiError(
      extractMessage(body, `Request failed (${response.status})`),
      response.status,
      body,
    );
  }

  return body as T;
}

const post = <T>(path: string, payload?: unknown) =>
  request<T>(path, { method: 'POST', body: payload ? JSON.stringify(payload) : undefined });

// --- Auth -----------------------------------------------------------------

export const authApi = {
  async login(username: string, password: string): Promise<User> {
    const data = await post<{ access: string; refresh: string; user: User }>(
      '/auth/login/',
      { username, password },
    );
    tokens.set(data.access, data.refresh);
    return data.user;
  },

  logout() {
    tokens.clear();
  },

  me: () => request<User>('/auth/me/'),

  updateMe: (changes: Partial<User>) =>
    request<User>('/auth/me/', { method: 'PATCH', body: JSON.stringify(changes) }),

  listUsers: () => request<Paginated<User>>('/auth/users/'),

  createUser: (payload: Partial<User> & { password: string }) =>
    post<User>('/auth/users/', payload),

  roles: () => request<{ roles: { value: string; label: string }[] }>('/auth/roles/'),
};

// --- Orders ---------------------------------------------------------------

export const orderApi = {
  list(params: { status?: string; search?: string; page?: number; page_size?: number } = {}) {
    const query = new URLSearchParams();
    if (params.status) query.set('status', params.status);
    if (params.search) query.set('search', params.search);
    query.set('page', String(params.page ?? 1));
    query.set('page_size', String(params.page_size ?? 100));
    return request<Paginated<Order>>(`/npa-requests/?${query.toString()}`);
  },

  get: (id: number) => request<Order>(`/npa-requests/${id}/`),

  create: (payload: CreateOrderPayload) => post<Order>('/npa-requests/', payload),

  summary: () => request<OrderSummary>('/npa-requests/summary/'),

  auditTrail: (id: number) =>
    request<{ audit_trail: AuditEntry[]; current_status: string }>(
      `/npa-requests/${id}/audit-trail/`,
    ),

  // --- Workflow transitions (mirror the flowchart) ---

  /** Manager grants authorisation; a permit ID is issued. */
  approveManager: (id: number) => post<Order>(`/npa-requests/${id}/approve_manager/`),

  /** Manager rejects with a reason; the customer amends and resubmits. */
  reject: (id: number, reason: string) => post<Order>(`/npa-requests/${id}/reject/`, { reason }),

  /** Customs signs off; the order becomes CLEARED. */
  approveCustoms: (id: number) => post<Order>(`/npa-requests/${id}/approve_customs/`),

  /** Customs raises a query; the order goes ON HOLD back to the manager. */
  hold: (id: number, reason: string) => post<Order>(`/npa-requests/${id}/hold/`, { reason }),

  /** Depot operator authorises the lot for filling. */
  clearLot: (id: number) => post<Order>(`/npa-requests/${id}/clear_lot/`),

  /** Loading bay gate check. Throws ApiError(400) when the car number differs. */
  startLoading: (id: number, observedTruckNumber: string) =>
    post<Order>(`/npa-requests/${id}/start_loading/`, {
      observed_truck_number: observedTruckNumber,
    }),

  /** Loading bay denies entry and flags the discrepancy to the manager. */
  denyEntry: (id: number, reason: string, observedTruckNumber?: string) =>
    post<Order>(`/npa-requests/${id}/deny_entry/`, {
      reason,
      observed_truck_number: observedTruckNumber ?? '',
    }),

  /** Record the quantity loaded and issue the waybill. */
  completeLoading: (
    id: number,
    quantityLoaded: number,
    extra: { destination?: string; transporter_name?: string } = {},
  ) =>
    post<Order>(`/npa-requests/${id}/complete_loading/`, {
      quantity_loaded: quantityLoaded,
      ...extra,
    }),

  /** Send a batch of NPA orders (50-100 orders per day by default). */
  sendNPABatch: (params?: { count?: number; depot_id?: string }) =>
    post<{
      message: string;
      batch_id: string;
      count: number;
      depot_id: string;
      target_date: string;
      total_volume: string;
      total_value: string;
      order_references: string[];
    }>('/npa-requests/send-npa-batch/', params),

  /** Real-time telemetry feed for yard TV displays (9-squared grid). */
  getTvDisplay: () => request<TvDisplayData>('/npa-requests/tv-display/'),
};

export const tankerApi = {
  list: () => request<Paginated<any>>('/tankers/'),
};

export const waybillApi = {
  list: () => request<Paginated<any>>('/waybills/'),
};

export { BASE_URL, API };
