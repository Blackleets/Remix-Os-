/**
 * Pure business-metric calculators. No Firebase, no React, no side effects.
 * Inputs are arrays of plain objects mirroring the Firestore docs.
 *
 * Schemas mirrored from src/services/sales.ts and src/pages/POS.tsx.
 */
import {
  toMoney,
  safeDivide,
  growthPercent,
  sumBy,
  clampPositive,
} from './moneyUtils';
import { getDateRanges, isInRange, tsToDate, daysBetween } from './dateMetrics';

export interface OrderItemSnapshot {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  sku?: string;
}

export interface OrderLike {
  id: string;
  companyId?: string;
  customerId?: string;
  customerName?: string;
  paymentMethod?: string;
  status?: 'pending' | 'completed' | 'cancelled' | string;
  subtotal?: number;
  discount?: number;
  tax?: number;
  total?: number;
  totalAmount?: number;
  channel?: string;
  cashSessionId?: string;
  itemCount?: number;
  itemsSnapshot?: OrderItemSnapshot[];
  createdAt?: any;
}

export interface ProductLike {
  id: string;
  name?: string;
  price?: number;
  stockLevel?: number;
  sku?: string;
  category?: string;
  status?: 'active' | 'draft' | 'archived' | string;
  costPrice?: number;
  imageURL?: string;
  createdAt?: any;
}

export interface CustomerLike {
  id: string;
  name?: string;
  totalSpent?: number;
  totalOrders?: number;
  lastOrderAt?: any;
  createdAt?: any;
  segment?: string;
}

export interface CashSessionLike {
  id: string;
  status?: 'open' | 'closed';
  openingCash?: number;
  closedAt?: any;
  closingCash?: number;
  expectedCash?: number;
  difference?: number;
}

export interface InventoryMovementLike {
  id: string;
  productId: string;
  productName?: string;
  type: 'in' | 'out' | string;
  quantity: number;
  reason?: string;
  createdAt?: any;
}

const LOW_STOCK_THRESHOLD = 10;
const AT_RISK_DAYS = 60;

function orderRevenue(order: OrderLike): number {
  const value = order.total ?? order.totalAmount ?? 0;
  return Number.isFinite(value) ? value : 0;
}

function isCompleted(order: OrderLike): boolean {
  return !order.status || order.status === 'completed';
}

// ─── Sales ───────────────────────────────────────────────────────────────────

export interface SalesMetrics {
  totalRevenue: number;
  netRevenue: number;
  grossRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  revenueToday: number;
  revenueThisWeek: number;
  revenueThisMonth: number;
  revenueGrowthPercent: number | null;
  orderGrowthPercent: number | null;
}

export function computeSalesMetrics(orders: OrderLike[], now: Date = new Date()): SalesMetrics {
  const ranges = getDateRanges(now);
  const completed = orders.filter(isCompleted);

  const totalRevenue = sumBy(completed, orderRevenue);
  const grossRevenue = sumBy(orders, orderRevenue);
  const totalDiscount = sumBy(completed, (o) => o.discount || 0);
  const netRevenue = toMoney(totalRevenue - totalDiscount);

  const totalOrders = completed.length;
  const averageOrderValue = toMoney(safeDivide(totalRevenue, totalOrders, 0));

  const revenueToday = sumBy(
    completed.filter((o) => isInRange(o.createdAt, ranges.today)),
    orderRevenue
  );
  const revenueThisWeek = sumBy(
    completed.filter((o) => isInRange(o.createdAt, ranges.thisWeek)),
    orderRevenue
  );
  const revenueThisMonth = sumBy(
    completed.filter((o) => isInRange(o.createdAt, ranges.thisMonth)),
    orderRevenue
  );

  const revenueLast30 = sumBy(
    completed.filter((o) => isInRange(o.createdAt, ranges.last30Days)),
    orderRevenue
  );
  const revenuePrev30 = sumBy(
    completed.filter((o) => isInRange(o.createdAt, ranges.prev30Days)),
    orderRevenue
  );
  const ordersLast30 = completed.filter((o) => isInRange(o.createdAt, ranges.last30Days)).length;
  const ordersPrev30 = completed.filter((o) => isInRange(o.createdAt, ranges.prev30Days)).length;

  return {
    totalRevenue,
    netRevenue,
    grossRevenue,
    totalOrders,
    averageOrderValue,
    revenueToday,
    revenueThisWeek,
    revenueThisMonth,
    revenueGrowthPercent: growthPercent(revenueLast30, revenuePrev30),
    orderGrowthPercent: growthPercent(ordersLast30, ordersPrev30),
  };
}

// ─── POS ─────────────────────────────────────────────────────────────────────

export interface POSMetrics {
  posRevenue: number;
  posOrders: number;
  cashRevenue: number;
  cardRevenue: number;
  transferRevenue: number;
  cryptoRevenue: number;
  stripeRevenue: number;
  discountTotal: number;
  taxTotal: number;
  averagePOSBasket: number;
  cashExpected: number;
  cashDifference: number | null;
}

export function computePOSMetrics(
  orders: OrderLike[],
  cashSession?: CashSessionLike | null,
  closingCash?: number
): POSMetrics {
  const completed = orders.filter(isCompleted);
  const posOrdersList = completed.filter((o) => o.channel === 'pos');

  const revenueByMethod = (method: string) =>
    sumBy(posOrdersList.filter((o) => o.paymentMethod === method), orderRevenue);

  const cashRevenue = revenueByMethod('Cash');
  const cardRevenue = revenueByMethod('Card');
  const transferRevenue = revenueByMethod('Transfer');
  const cryptoRevenue = revenueByMethod('Crypto');
  const stripeRevenue = revenueByMethod('Stripe');

  const posRevenue = sumBy(posOrdersList, orderRevenue);
  const posOrders = posOrdersList.length;
  const averagePOSBasket = toMoney(safeDivide(posRevenue, posOrders, 0));

  const discountTotal = sumBy(posOrdersList, (o) => o.discount || 0);
  const taxTotal = sumBy(posOrdersList, (o) => o.tax || 0);

  // Cash expected for the *current* session: opening + cash sales tied to it.
  let cashExpected = 0;
  let cashDifference: number | null = null;
  if (cashSession) {
    const turnOrders = orders.filter((o) => o.cashSessionId === cashSession.id);
    const turnCash = sumBy(
      turnOrders.filter((o) => o.paymentMethod === 'Cash'),
      orderRevenue
    );
    cashExpected = toMoney(clampPositive(cashSession.openingCash) + turnCash);
    if (typeof closingCash === 'number' && Number.isFinite(closingCash)) {
      cashDifference = toMoney(closingCash - cashExpected);
    }
  }

  return {
    posRevenue,
    posOrders,
    cashRevenue,
    cardRevenue,
    transferRevenue,
    cryptoRevenue,
    stripeRevenue,
    discountTotal,
    taxTotal,
    averagePOSBasket,
    cashExpected,
    cashDifference,
  };
}

// ─── Inventory ───────────────────────────────────────────────────────────────

export interface InventoryMetrics {
  totalStockUnits: number;
  totalStockValue: number;
  lowStockProducts: ProductLike[];
  outOfStockProducts: ProductLike[];
  inventoryMovementIn: number;
  inventoryMovementOut: number;
  estimatedCostValue: number;
  estimatedGrossMargin: number;
  stockTurnover: number;
}

export function computeInventoryMetrics(
  products: ProductLike[],
  movements: InventoryMovementLike[] = []
): InventoryMetrics {
  const active = products.filter((p) => p.status !== 'archived');

  const totalStockUnits = active.reduce((sum, p) => sum + clampPositive(p.stockLevel), 0);
  const totalStockValue = sumBy(active, (p) => clampPositive(p.stockLevel) * clampPositive(p.price));
  const estimatedCostValue = sumBy(active, (p) =>
    typeof p.costPrice === 'number' ? clampPositive(p.stockLevel) * clampPositive(p.costPrice) : 0
  );
  const estimatedGrossMargin = toMoney(totalStockValue - estimatedCostValue);

  const lowStockProducts = active.filter(
    (p) => clampPositive(p.stockLevel) > 0 && clampPositive(p.stockLevel) <= LOW_STOCK_THRESHOLD
  );
  const outOfStockProducts = active.filter((p) => clampPositive(p.stockLevel) <= 0);

  const inventoryMovementIn = movements
    .filter((m) => m.type === 'in')
    .reduce((sum, m) => sum + clampPositive(m.quantity), 0);
  const inventoryMovementOut = movements
    .filter((m) => m.type === 'out')
    .reduce((sum, m) => sum + clampPositive(m.quantity), 0);

  // Naïve turnover: units sold / average stock. Rough operator-friendly signal.
  const stockTurnover = toMoney(safeDivide(inventoryMovementOut, totalStockUnits || 1, 0));

  return {
    totalStockUnits,
    totalStockValue,
    lowStockProducts,
    outOfStockProducts,
    inventoryMovementIn,
    inventoryMovementOut,
    estimatedCostValue,
    estimatedGrossMargin,
    stockTurnover,
  };
}

// ─── Customers ───────────────────────────────────────────────────────────────

export interface CustomerSegmented extends CustomerLike {
  derivedSegment: 'new' | 'active' | 'vip' | 'at_risk' | 'inactive';
}

export interface CustomerMetrics {
  totalCustomers: number;
  activeCustomers: number;
  newCustomersThisMonth: number;
  repeatCustomers: number;
  customerLifetimeValue: number;
  averageCustomerValue: number;
  atRiskCustomers: CustomerSegmented[];
  vipCustomers: CustomerSegmented[];
  segmented: CustomerSegmented[];
}

export function computeCustomerMetrics(
  customers: CustomerLike[],
  orders: OrderLike[] = [],
  now: Date = new Date()
): CustomerMetrics {
  const ranges = getDateRanges(now);

  // VIP threshold: top 10% by totalSpent (with a $1k floor to avoid promoting
  // a tiny customer base where the 90th percentile is meaningless).
  const sortedSpend = [...customers]
    .map((c) => c.totalSpent || 0)
    .sort((a, b) => b - a);
  const cutoffIndex = Math.max(0, Math.floor(sortedSpend.length * 0.1) - 1);
  const vipThreshold = Math.max(1000, sortedSpend[cutoffIndex] || 0);

  const segmented: CustomerSegmented[] = customers.map((c) => {
    const lastOrder = tsToDate(c.lastOrderAt);
    const created = tsToDate(c.createdAt);
    const totalSpent = clampPositive(c.totalSpent);
    const totalOrders = clampPositive(c.totalOrders);

    let derivedSegment: CustomerSegmented['derivedSegment'] = 'inactive';
    if (totalSpent >= vipThreshold && totalOrders > 0) {
      derivedSegment = 'vip';
    } else if (created && isInRange(created, ranges.thisMonth) && totalOrders <= 1) {
      derivedSegment = 'new';
    } else if (lastOrder) {
      const daysSinceOrder = daysBetween(now, lastOrder);
      if (daysSinceOrder <= 30) derivedSegment = 'active';
      else if (daysSinceOrder <= AT_RISK_DAYS) derivedSegment = 'at_risk';
      else derivedSegment = 'inactive';
    }

    return { ...c, derivedSegment };
  });

  const totalCustomers = segmented.length;
  const activeCustomers = segmented.filter((c) => c.derivedSegment === 'active' || c.derivedSegment === 'vip').length;
  const newCustomersThisMonth = segmented.filter((c) => c.derivedSegment === 'new').length;
  const repeatCustomers = segmented.filter((c) => clampPositive(c.totalOrders) >= 2).length;

  const customerLifetimeValue = sumBy(segmented, (c) => c.totalSpent || 0);
  const averageCustomerValue = toMoney(safeDivide(customerLifetimeValue, totalCustomers, 0));

  const atRiskCustomers = segmented.filter((c) => c.derivedSegment === 'at_risk');
  const vipCustomers = segmented.filter((c) => c.derivedSegment === 'vip');

  // Side note: orders param reserved for future per-customer cohorts; not used yet
  // to keep this calculator O(n) over customers only. Keep param for stable API.
  void orders;

  return {
    totalCustomers,
    activeCustomers,
    newCustomersThisMonth,
    repeatCustomers,
    customerLifetimeValue,
    averageCustomerValue,
    atRiskCustomers,
    vipCustomers,
    segmented,
  };
}

// ─── Products ────────────────────────────────────────────────────────────────

export interface ProductSalesAggregate {
  product: ProductLike;
  unitsSold: number;
  revenue: number;
  profitPerUnit: number | null;
  stockValue: number | null;
  marginPercent: number | null;
}

export interface ProductMetrics {
  allProductSales: ProductSalesAggregate[];
  bestSellingProducts: ProductSalesAggregate[];
  worstSellingProducts: ProductSalesAggregate[];
  highestRevenueProducts: ProductSalesAggregate[];
  lowMarginProducts: ProductSalesAggregate[];
  productsWithoutStock: ProductLike[];
  productsWithoutSKU: ProductLike[];
  productsWithoutCostPrice: ProductLike[];
}

const LOW_MARGIN_THRESHOLD = 18;

export function computeProductMetrics(
  products: ProductLike[],
  orders: OrderLike[] = [],
  topN = 10
): ProductMetrics {
  const completed = orders.filter(isCompleted);
  const aggregates = new Map<string, { unitsSold: number; revenue: number }>();

  for (const order of completed) {
    if (!order.itemsSnapshot) continue;
    for (const item of order.itemsSnapshot) {
      const cur = aggregates.get(item.productId) || { unitsSold: 0, revenue: 0 };
      cur.unitsSold += clampPositive(item.quantity);
      cur.revenue += clampPositive(item.quantity) * clampPositive(item.price);
      aggregates.set(item.productId, cur);
    }
  }

  const all: ProductSalesAggregate[] = products.map((product) => {
    const agg = aggregates.get(product.id) || { unitsSold: 0, revenue: 0 };
    let marginPercent: number | null = null;
    let profitPerUnit: number | null = null;
    let stockValue: number | null = null;
    if (typeof product.costPrice === 'number' && typeof product.price === 'number' && product.price > 0) {
      profitPerUnit = toMoney(product.price - product.costPrice);
      marginPercent = safeDivide(profitPerUnit, product.price, 0) * 100;
      stockValue = toMoney(clampPositive(product.stockLevel) * clampPositive(product.costPrice));
    }
    return {
      product,
      unitsSold: agg.unitsSold,
      revenue: toMoney(agg.revenue),
      profitPerUnit,
      stockValue,
      marginPercent,
    };
  });

  const bestSellingProducts = [...all].sort((a, b) => b.unitsSold - a.unitsSold).slice(0, topN);
  const worstSellingProducts = [...all]
    .filter((a) => (a.product.status ?? 'active') === 'active')
    .sort((a, b) => a.unitsSold - b.unitsSold)
    .slice(0, topN);
  const highestRevenueProducts = [...all].sort((a, b) => b.revenue - a.revenue).slice(0, topN);
  const lowMarginProducts = all
    .filter((a) => a.marginPercent !== null && a.marginPercent < LOW_MARGIN_THRESHOLD)
    .sort((a, b) => (a.marginPercent ?? 0) - (b.marginPercent ?? 0))
    .slice(0, topN);

  const productsWithoutStock = products.filter(
    (p) => (p.status ?? 'active') !== 'archived' && clampPositive(p.stockLevel) <= 0
  );
  const productsWithoutSKU = products.filter((p) => !p.sku || p.sku.trim().length === 0);
  const productsWithoutCostPrice = products.filter(
    (p) => typeof p.costPrice !== 'number'
  );

  return {
    allProductSales: all,
    bestSellingProducts,
    worstSellingProducts,
    highestRevenueProducts,
    lowMarginProducts,
    productsWithoutStock,
    productsWithoutSKU,
    productsWithoutCostPrice,
  };
}
