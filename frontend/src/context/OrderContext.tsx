import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { Order, OrderStatus, CreateOrderPayload, OrderSummary } from '../types';
import { orderApi } from '../lib/api';
import { useAuth } from './AuthContext';

interface OrderContextType {
  orders: Order[];
  summary: OrderSummary | null;
  loading: boolean;
  error: string | null;

  refresh: () => Promise<void>;
  addOrder: (payload: CreateOrderPayload) => Promise<Order>;
  getOrdersByStatus: (...statuses: OrderStatus[]) => Order[];

  // Workflow transitions. Each resolves with the updated order, or throws
  // an Error whose message is safe to show the user.
  approveManager: (id: number) => Promise<Order>;
  reject: (id: number, reason: string) => Promise<Order>;
  approveCustoms: (id: number) => Promise<Order>;
  hold: (id: number, reason: string) => Promise<Order>;
  clearLot: (id: number) => Promise<Order>;
  startLoading: (id: number, observedTruckNumber: string) => Promise<Order>;
  denyEntry: (id: number, reason: string, observedTruckNumber?: string) => Promise<Order>;
  completeLoading: (id: number, quantityLoaded: number) => Promise<Order>;
  sendNPABatch: (params?: { count?: number; depot_id?: string }) => Promise<{
    message: string;
    batch_id: string;
    count: number;
    total_volume: string;
    total_value: string;
  }>;
}

const OrderContext = createContext<OrderContextType | undefined>(undefined);

export function OrderProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [summary, setSummary] = useState<OrderSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (isBackground = false) => {
    if (!isAuthenticated) {
      setOrders([]);
      setSummary(null);
      return;
    }

    if (!isBackground) {
      setLoading(true);
      setError(null);
    }
    try {
      const [page, counts] = await Promise.all([orderApi.list(), orderApi.summary()]);
      setOrders(page.results);
      setSummary(counts);
    } catch (err) {
      if (!isBackground) {
        setError(err instanceof Error ? err.message : 'Failed to load orders');
      }
    } finally {
      if (!isBackground) {
        setLoading(false);
      }
    }
  }, [isAuthenticated]);

  // Load whenever the session changes & automatically poll for new daily orders
  useEffect(() => {
    refresh();
    if (!isAuthenticated) return;

    const interval = setInterval(() => {
      refresh(true);
    }, 30000);

    return () => clearInterval(interval);
  }, [refresh, isAuthenticated]);

  /** Splice an updated order back into local state without a full refetch. */
  const applyUpdate = useCallback((updated: Order) => {
    setOrders((prev) => prev.map((order) => (order.id === updated.id ? updated : order)));
    // Status counts changed, so pull fresh totals in the background.
    orderApi.summary().then(setSummary).catch(() => undefined);
    return updated;
  }, []);

  const addOrder = useCallback(async (payload: CreateOrderPayload) => {
    const created = await orderApi.create(payload);
    setOrders((prev) => [created, ...prev]);
    orderApi.summary().then(setSummary).catch(() => undefined);
    return created;
  }, []);

  const sendNPABatch = useCallback(async (params?: { count?: number; depot_id?: string }) => {
    const res = await orderApi.sendNPABatch(params);
    await refresh();
    return res;
  }, [refresh]);

  const getOrdersByStatus = useCallback(
    (...statuses: OrderStatus[]) => orders.filter((order) => statuses.includes(order.status)),
    [orders],
  );

  const value: OrderContextType = {
    orders,
    summary,
    loading,
    error,
    refresh,
    addOrder,
    sendNPABatch,
    getOrdersByStatus,

    approveManager: (id) => orderApi.approveManager(id).then(applyUpdate),
    reject: (id, reason) => orderApi.reject(id, reason).then(applyUpdate),
    approveCustoms: (id) => orderApi.approveCustoms(id).then(applyUpdate),
    hold: (id, reason) => orderApi.hold(id, reason).then(applyUpdate),
    clearLot: (id) => orderApi.clearLot(id).then(applyUpdate),
    startLoading: (id, truck) => orderApi.startLoading(id, truck).then(applyUpdate),
    denyEntry: (id, reason, truck) => orderApi.denyEntry(id, reason, truck).then(applyUpdate),
    completeLoading: (id, qty) => orderApi.completeLoading(id, qty).then(applyUpdate),
  };

  return <OrderContext.Provider value={value}>{children}</OrderContext.Provider>;
}

export function useOrders() {
  const context = useContext(OrderContext);
  if (context === undefined) {
    throw new Error('useOrders must be used within an OrderProvider');
  }
  return context;
}
