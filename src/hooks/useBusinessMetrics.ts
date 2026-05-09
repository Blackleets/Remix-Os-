/**
 * Aggregated business metrics hook. Subscribes to the company's collections,
 * memoizes the computed metrics, and exposes both the metrics and the raw
 * arrays so callers can run their own derived queries without re-subscribing.
 *
 * Opt-in: pages still using their own onSnapshot keep working — this hook does
 * not replace them, it gives Dashboard / Copilot / future surfaces a single
 * source of truth.
 */
import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import {
  computeSalesMetrics,
  computePOSMetrics,
  computeInventoryMetrics,
  computeCustomerMetrics,
  computeProductMetrics,
  OrderLike,
  ProductLike,
  CustomerLike,
  CashSessionLike,
  InventoryMovementLike,
  SalesMetrics,
  POSMetrics,
  InventoryMetrics,
  CustomerMetrics,
  ProductMetrics,
} from '../lib/businessMetrics';

export type BusinessMetricsKey = 'sales' | 'pos' | 'inventory' | 'customers' | 'products';

export interface UseBusinessMetricsOptions {
  include?: BusinessMetricsKey[];
}

export interface BusinessMetricsRaw {
  orders: OrderLike[];
  products: ProductLike[];
  customers: CustomerLike[];
  cashSessions: CashSessionLike[];
  movements: InventoryMovementLike[];
  activeCashSession: CashSessionLike | null;
}

export interface UseBusinessMetricsResult {
  sales: SalesMetrics | null;
  pos: POSMetrics | null;
  inventory: InventoryMetrics | null;
  customers: CustomerMetrics | null;
  products: ProductMetrics | null;
  isLoading: boolean;
  error: Error | null;
  raw: BusinessMetricsRaw;
}

const ALL_KEYS: BusinessMetricsKey[] = ['sales', 'pos', 'inventory', 'customers', 'products'];

const EMPTY_RAW: BusinessMetricsRaw = {
  orders: [],
  products: [],
  customers: [],
  cashSessions: [],
  movements: [],
  activeCashSession: null,
};

export function useBusinessMetrics(
  options: UseBusinessMetricsOptions = {}
): UseBusinessMetricsResult {
  const { company } = useAuth();
  const include = options.include ?? ALL_KEYS;

  // Decide which collections we actually need.
  const needsOrders = include.some((k) => k === 'sales' || k === 'pos' || k === 'products' || k === 'customers');
  const needsProducts = include.some((k) => k === 'inventory' || k === 'products');
  const needsCustomers = include.includes('customers');
  const needsCashSessions = include.includes('pos');
  const needsMovements = include.includes('inventory');

  const [orders, setOrders] = useState<OrderLike[]>([]);
  const [products, setProducts] = useState<ProductLike[]>([]);
  const [customers, setCustomers] = useState<CustomerLike[]>([]);
  const [cashSessions, setCashSessions] = useState<CashSessionLike[]>([]);
  const [movements, setMovements] = useState<InventoryMovementLike[]>([]);
  const [error, setError] = useState<Error | null>(null);

  // We set isLoading=true while at least one needed source has not arrived yet.
  const [loadedFlags, setLoadedFlags] = useState({
    orders: false,
    products: false,
    customers: false,
    cashSessions: false,
    movements: false,
  });

  useEffect(() => {
    if (!company?.id) return undefined;
    setError(null);
    setLoadedFlags({
      orders: !needsOrders,
      products: !needsProducts,
      customers: !needsCustomers,
      cashSessions: !needsCashSessions,
      movements: !needsMovements,
    });

    const unsubs: Array<() => void> = [];
    const handle =
      <T extends { id: string }>(key: keyof typeof loadedFlags, setter: (rows: T[]) => void) =>
      (snapshot: any) => {
        setter(snapshot.docs.map((entry: any) => ({ id: entry.id, ...entry.data() })));
        setLoadedFlags((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
      };
    const handleError = (key: keyof typeof loadedFlags) => (err: any) => {
      console.warn(`[useBusinessMetrics] ${key} subscription failed`, err);
      setError(err instanceof Error ? err : new Error(String(err)));
      setLoadedFlags((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
    };

    if (needsOrders) {
      unsubs.push(
        onSnapshot(
          query(collection(db, 'orders'), where('companyId', '==', company.id)),
          handle<OrderLike>('orders', setOrders),
          handleError('orders')
        )
      );
    }
    if (needsProducts) {
      unsubs.push(
        onSnapshot(
          query(collection(db, 'products'), where('companyId', '==', company.id)),
          handle<ProductLike>('products', setProducts),
          handleError('products')
        )
      );
    }
    if (needsCustomers) {
      unsubs.push(
        onSnapshot(
          query(collection(db, 'customers'), where('companyId', '==', company.id)),
          handle<CustomerLike>('customers', setCustomers),
          handleError('customers')
        )
      );
    }
    if (needsCashSessions) {
      unsubs.push(
        onSnapshot(
          query(collection(db, 'cashSessions'), where('companyId', '==', company.id)),
          handle<CashSessionLike>('cashSessions', setCashSessions),
          handleError('cashSessions')
        )
      );
    }
    if (needsMovements) {
      unsubs.push(
        onSnapshot(
          query(collection(db, 'inventoryMovements'), where('companyId', '==', company.id)),
          handle<InventoryMovementLike>('movements', setMovements),
          handleError('movements')
        )
      );
    }

    return () => {
      for (const u of unsubs) u();
    };
  }, [company?.id, needsOrders, needsProducts, needsCustomers, needsCashSessions, needsMovements]);

  const isLoading = !Object.values(loadedFlags).every(Boolean);

  const activeCashSession = useMemo(
    () => cashSessions.find((s) => s.status === 'open') || null,
    [cashSessions]
  );

  const raw: BusinessMetricsRaw = useMemo(
    () => ({ orders, products, customers, cashSessions, movements, activeCashSession }),
    [orders, products, customers, cashSessions, movements, activeCashSession]
  );

  const result = useMemo<UseBusinessMetricsResult>(() => {
    const out: UseBusinessMetricsResult = {
      sales: null,
      pos: null,
      inventory: null,
      customers: null,
      products: null,
      isLoading,
      error,
      raw: company?.id ? raw : EMPTY_RAW,
    };
    if (!company?.id) return out;

    if (include.includes('sales')) out.sales = computeSalesMetrics(orders);
    if (include.includes('pos')) out.pos = computePOSMetrics(orders, activeCashSession);
    if (include.includes('inventory')) out.inventory = computeInventoryMetrics(products, movements);
    if (include.includes('customers')) out.customers = computeCustomerMetrics(customers, orders);
    if (include.includes('products')) out.products = computeProductMetrics(products, orders);

    return out;
  }, [company?.id, include, orders, products, customers, movements, activeCashSession, isLoading, error, raw]);

  return result;
}
