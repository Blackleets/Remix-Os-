import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Stripe from 'stripe';
import { GoogleGenAI } from '@google/genai';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import { BILLING_CURRENCY, PLAN_DEFINITIONS, PLAN_IDS, PlanId, getBillingPriceMap, getPlanDefinition } from '../shared/plans.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type AnyRecord = Record<string, any>;
const VALID_PLATFORM_FEEDBACK_STATUSES = ['open', 'reviewed', 'resolved'] as const;
const VALID_PLATFORM_FEEDBACK_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;

interface CompanyOverview {
  companyId: string;
  companyName: string;
  industry: string;
  onboardingCompleted: boolean;
  planId: PlanId;
  customersCount: number;
  productsCount: number;
  ordersCount: number;
  inventoryValue: number;
  recentRevenue: number;
  recentRevenue30d: number;
  previousRevenue30d: number;
  growth: number;
  lowStockCount: number;
  topProducts: Array<{ productId: string; name: string; quantity: number; revenue: number }>;
  lowStockItems: Array<{ id: string; name: string; stock: number }>;
  topCustomers: Array<{ customerId: string; name: string; total: number; count: number }>;
  inventoryStatus: Array<{ id: string; name: string; stock: number }>;
  pendingReminders: Array<{ customer: string; type: string; due: unknown; notes: string }>;
  recentCommunications: Array<{ customer: string; status: string; content: string }>;
  recentActivities: Array<{ type: string; title: string; subtitle: string; createdAt: unknown }>;
  salesVelocity: {
    currentPeriodOrders: number;
    previousPeriodOrders: number;
    trend: 'up' | 'down';
  };
}

let adminDb: Firestore | null = null;
let stripe: Stripe | null = null;
let genai: GoogleGenAI | null = null;

function getFirebaseConfigPath() {
  return path.join(__dirname, '..', 'firebase-applet-config.json');
}

function getDb() {
  if (!adminDb) {
    try {
      if (getApps().length === 0) {
        const svcAcct = process.env.FIREBASE_SERVICE_ACCOUNT;
        if (svcAcct) {
          initializeApp({ credential: cert(JSON.parse(svcAcct)) });
        } else {
          const configPath = getFirebaseConfigPath();
          const projectId = fs.existsSync(configPath)
            ? JSON.parse(fs.readFileSync(configPath, 'utf-8')).projectId
            : process.env.FIREBASE_PROJECT_ID;
          if (!projectId) {
            console.warn('No Firebase project config found.');
            return null;
          }
          initializeApp({ projectId });
        }
      }

      const configPath = getFirebaseConfigPath();
      const dbId = fs.existsSync(configPath)
        ? JSON.parse(fs.readFileSync(configPath, 'utf-8')).firestoreDatabaseId
        : undefined;
      const app = getApps()[0];
      adminDb = dbId && dbId !== '(default)' ? getFirestore(app, dbId) : getFirestore(app);
    } catch (error: any) {
      console.error('Firebase Admin init error:', error.message);
    }
  }

  return adminDb;
}

function getStripe() {
  if (!stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      console.warn('STRIPE_SECRET_KEY not set. Stripe runs in Mock Mode.');
      return null;
    }

    stripe = new Stripe(key, {
      apiVersion: '2026-04-22.dahlia',
    });
  }

  return stripe;
}

function getGenAI() {
  if (!genai) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      console.warn('GEMINI_API_KEY not set. AI features disabled.');
      return null;
    }
    genai = new GoogleGenAI({ apiKey: key });
  }

  return genai;
}

function sendAiConfigError(res: any) {
  return res.status(503).json({
    error: 'AI not configured',
    code: 'AI_NOT_CONFIGURED',
    details: 'GEMINI_API_KEY is not available in the current Vercel runtime. Check environment scope and redeploy.',
  });
}

function logMembership(message: string, extra?: Record<string, unknown>) {
  console.info('[Membership]', message, extra || {});
}

function logCompanyOverview(message: string, extra?: Record<string, unknown>) {
  console.info('[CompanyOverview]', message, extra || {});
}

function buildEmptyCompanyOverview(companyId: string, companyData?: AnyRecord): CompanyOverview {
  return {
    companyId,
    companyName: companyData?.name || 'Remix OS',
    industry: companyData?.industry || 'General',
    onboardingCompleted: false,
    planId: getPlanDefinition(companyData?.subscription?.planId).id,
    customersCount: 0,
    productsCount: 0,
    ordersCount: 0,
    inventoryValue: 0,
    recentRevenue: 0,
    recentRevenue30d: 0,
    previousRevenue30d: 0,
    growth: 0,
    lowStockCount: 0,
    topProducts: [],
    lowStockItems: [],
    topCustomers: [],
    inventoryStatus: [],
    pendingReminders: [],
    recentCommunications: [],
    recentActivities: [],
    salesVelocity: {
      currentPeriodOrders: 0,
      previousPeriodOrders: 0,
      trend: 'up',
    },
  };
}

function extractTextFromGeminiResponse(result: any): string {
  if (!result) return '';

  if (typeof result.text === 'string') return result.text;
  if (typeof result.text === 'function') {
    try {
      const extracted = result.text();
      if (typeof extracted === 'string') return extracted;
    } catch { }
  }

  if (result.response?.text && typeof result.response.text === 'function') {
    try {
      const extracted = result.response.text();
      if (typeof extracted === 'string') return extracted;
    } catch { }
  }

  if (result.response?.text && typeof result.response.text === 'string') {
    return result.response.text;
  }

  if (result.candidates?.[0]?.content?.parts?.[0]?.text) {
    return result.candidates[0].content.parts[0].text;
  }

  return '';
}

async function requireCompanyAccess(
  req: any,
  res: any,
  allowedRoles: string[] = ['owner', 'admin']
): Promise<{ uid: string; companyId: string } | null> {
  const authHeader = req.headers.authorization || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    res.status(401).json({ error: 'Missing Authorization bearer token' });
    return null;
  }

  let decoded;
  try {
    decoded = await getAuth().verifyIdToken(match[1]);
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
    return null;
  }

  const companyId = req.body?.companyId;
  if (!companyId || typeof companyId !== 'string') {
    res.status(400).json({ error: 'companyId is required' });
    return null;
  }

  const db = getDb();
  if (!db) {
    res.status(500).json({ error: 'Database not initialized' });
    return null;
  }

  const expectedMembershipId = `${decoded.uid}_${companyId}`;
  let membershipSnap = await db.collection('memberships').doc(expectedMembershipId).get();

  if (!membershipSnap.exists) {
    logMembership('Expected membership doc not found, falling back to query lookup.', {
      uid: decoded.uid,
      companyId,
      expectedMembershipId,
    });

    const fallbackMemberships = await db
      .collection('memberships')
      .where('userId', '==', decoded.uid)
      .where('companyId', '==', companyId)
      .limit(1)
      .get();

    if (!fallbackMemberships.empty) {
      membershipSnap = fallbackMemberships.docs[0];
      logMembership('Recovered membership through query fallback.', {
        uid: decoded.uid,
        companyId,
        membershipDocId: membershipSnap.id,
        role: membershipSnap.data()?.role,
      });
    }
  }

  if (!membershipSnap.exists) {
    logMembership('No membership found for company access.', {
      uid: decoded.uid,
      companyId,
      expectedMembershipId,
    });
    res.status(403).json({ error: 'Forbidden', code: 'MEMBERSHIP_NOT_FOUND' });
    return null;
  }

  if (!allowedRoles.includes(membershipSnap.data()?.role)) {
    logMembership('Membership role is not allowed for this route.', {
      uid: decoded.uid,
      companyId,
      membershipDocId: membershipSnap.id,
      role: membershipSnap.data()?.role,
      allowedRoles,
    });
    res.status(403).json({ error: 'Forbidden', code: 'MEMBERSHIP_ROLE_FORBIDDEN' });
    return null;
  }

  logMembership('Company access granted.', {
    uid: decoded.uid,
    companyId,
    membershipDocId: membershipSnap.id,
    role: membershipSnap.data()?.role,
  });
  return { uid: decoded.uid, companyId };
}

async function requirePlatformAdmin(req: any, res: any): Promise<{ uid: string; email: string } | null> {
  const authHeader = req.headers.authorization || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    res.status(401).json({ error: 'Missing Authorization bearer token' });
    return null;
  }

  let decoded;
  try {
    decoded = await getAuth().verifyIdToken(match[1]);
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
    return null;
  }

  if (decoded.superAdmin === true) {
    return { uid: decoded.uid, email: decoded.email || '' };
  }

  const db = getDb();
  if (!db) {
    res.status(500).json({ error: 'Database not initialized' });
    return null;
  }

  const adminSnap = await db.collection('platformAdmins').doc(decoded.uid).get();
  const adminData = adminSnap.data();
  if (!adminSnap.exists || adminData?.active !== true || adminData?.role !== 'super_admin') {
    res.status(403).json({ error: 'Forbidden' });
    return null;
  }

  return { uid: decoded.uid, email: decoded.email || '' };
}

async function requireAuthenticatedUser(req: any, res: any): Promise<{ uid: string; email: string } | null> {
  const authHeader = req.headers.authorization || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    res.status(401).json({ error: 'Missing Authorization bearer token' });
    return null;
  }

  try {
    const decoded = await getAuth().verifyIdToken(match[1]);
    return {
      uid: decoded.uid,
      email: decoded.email || '',
    };
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
    return null;
  }
}

function getPeriodEndMs(sub: any): number {
  const direct = sub?.current_period_end;
  if (typeof direct === 'number') return direct * 1000;
  const item = sub?.items?.data?.[0]?.current_period_end;
  if (typeof item === 'number') return item * 1000;
  return Date.now() + 30 * 24 * 60 * 60 * 1000;
}

function getPlanIdFromPriceId(priceId?: string | null): PlanId | undefined {
  const priceMap: Partial<Record<string, PlanId>> = {};
  if (process.env.STRIPE_PRICE_ID_STARTER) priceMap[process.env.STRIPE_PRICE_ID_STARTER] = 'starter';
  if (process.env.STRIPE_PRICE_ID_PRO) priceMap[process.env.STRIPE_PRICE_ID_PRO] = 'pro';
  if (process.env.STRIPE_PRICE_ID_BUSINESS) priceMap[process.env.STRIPE_PRICE_ID_BUSINESS] = 'business';
  return priceId ? priceMap[priceId] : undefined;
}

function getSubscriptionMrr(subscription: any): number {
  const items = subscription?.items?.data || [];
  return items.reduce((sum: number, item: any) => {
    const amount = item?.price?.unit_amount ?? item?.plan?.amount ?? 0;
    const quantity = item?.quantity ?? 1;
    const interval = item?.price?.recurring?.interval ?? item?.plan?.interval ?? 'month';
    const intervalCount = item?.price?.recurring?.interval_count ?? item?.plan?.interval_count ?? 1;
    const gross = amount * quantity;

    if (interval === 'year') return sum + gross / 12 / intervalCount;
    if (interval === 'week') return sum + (gross * 52) / 12 / intervalCount;
    if (interval === 'day') return sum + gross / 30 / intervalCount;
    return sum + gross / intervalCount;
  }, 0) / 100;
}

function getOrderTotal(order: AnyRecord) {
  return order.totalAmount ?? order.total ?? 0;
}

function getOrderItems(order: AnyRecord) {
  if (Array.isArray(order.itemsSnapshot)) return order.itemsSnapshot;
  if (Array.isArray(order.items)) return order.items;
  return [];
}

function getBilledPrices() {
  const sharedPrices = getBillingPriceMap();
  return {
    starter: {
      amount: sharedPrices.starter.amount,
      id: process.env.STRIPE_PRICE_ID_STARTER,
    },
    pro: {
      amount: sharedPrices.pro.amount,
      id: process.env.STRIPE_PRICE_ID_PRO,
    },
    business: {
      amount: sharedPrices.business.amount,
      id: process.env.STRIPE_PRICE_ID_BUSINESS,
    },
  };
}

function buildFallbackBillingStats(companyId: string, companyData: any) {
  const planId = getPlanDefinition(companyData?.subscription?.planId).id;
  const subscriptionStatus = companyData?.subscription?.status || 'trialing';
  const mrr = ['active', 'past_due'].includes(subscriptionStatus)
    ? PLAN_DEFINITIONS[planId].monthlyPrice
    : 0;

  return {
    companyId,
    stripeCustomerId: companyData?.stripeCustomerId || '',
    planId,
    subscriptionStatus,
    mrr,
    arr: mrr * 12,
    currency: BILLING_CURRENCY.toLowerCase(),
    currentPeriodEnd: companyData?.subscription?.currentPeriodEnd || null,
    trialEndsAt: companyData?.subscription?.trialEndsAt || null,
    pastDue: subscriptionStatus === 'past_due',
    cancelAtPeriodEnd: false,
    lastInvoiceAt: null,
    lastPaymentStatus: subscriptionStatus,
    updatedAt: FieldValue.serverTimestamp(),
  };
}

function buildStripeBillingStats(companyId: string, companyData: any, subscription: any) {
  const firstItem = subscription?.items?.data?.[0];
  const priceId = firstItem?.price?.id || firstItem?.plan?.id || null;
  const planId = getPlanIdFromPriceId(priceId) || getPlanDefinition(companyData?.subscription?.planId).id;
  const mrr = getSubscriptionMrr(subscription);
  const latestInvoice = subscription?.latest_invoice;
  const lastInvoiceAt = latestInvoice?.status_transitions?.paid_at
    ? Timestamp.fromMillis(latestInvoice.status_transitions.paid_at * 1000)
    : latestInvoice?.created
      ? Timestamp.fromMillis(latestInvoice.created * 1000)
      : null;

  return {
    companyId,
    stripeCustomerId: companyData?.stripeCustomerId || subscription?.customer || '',
    planId,
    subscriptionStatus: subscription?.status || companyData?.subscription?.status || 'trialing',
    mrr,
    arr: mrr * 12,
    currency: firstItem?.price?.currency || latestInvoice?.currency || subscription?.currency || BILLING_CURRENCY.toLowerCase(),
    currentPeriodEnd: Timestamp.fromMillis(getPeriodEndMs(subscription)),
    trialEndsAt: subscription?.trial_end
      ? Timestamp.fromMillis(subscription.trial_end * 1000)
      : companyData?.subscription?.trialEndsAt || null,
    pastDue: subscription?.status === 'past_due' || latestInvoice?.status === 'open',
    cancelAtPeriodEnd: subscription?.cancel_at_period_end === true,
    lastInvoiceAt,
    lastPaymentStatus: latestInvoice?.status || subscription?.status || 'pending',
    updatedAt: FieldValue.serverTimestamp(),
  };
}

async function syncCompanyBillingStats(
  db: Firestore,
  stripeClient: Stripe | null,
  companyId: string,
  companyData: any
) {
  const stripeCustomerId = companyData?.stripeCustomerId;
  if (!stripeClient || !stripeCustomerId) {
    return null;
  }

  const subscriptions = await stripeClient.subscriptions.list({
    customer: stripeCustomerId,
    status: 'all',
    limit: 10,
    expand: ['data.latest_invoice', 'data.items.data.price'],
  } as any);

  const rankedSubscriptions = [...subscriptions.data].sort((a: any, b: any) => {
    const score = (status?: string) => {
      if (status === 'past_due') return 6;
      if (status === 'active') return 5;
      if (status === 'trialing') return 4;
      if (status === 'unpaid') return 3;
      if (status === 'incomplete') return 2;
      if (status === 'canceled') return 1;
      return 0;
    };
    const scoreDiff = score(b.status) - score(a.status);
    if (scoreDiff !== 0) return scoreDiff;
    return (b.created || 0) - (a.created || 0);
  });

  const subscription = rankedSubscriptions[0];
  if (!subscription) {
    return null;
  }

  const billingStats = buildStripeBillingStats(companyId, companyData, subscription);
  await db.collection('companyBillingStats').doc(companyId).set(billingStats, { merge: true });
  return billingStats;
}

function toDate(value: any) {
  if (!value) return null;
  if (value?.toDate) return value.toDate() as Date;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isCurrentMonth(value: any) {
  const date = toDate(value);
  if (!date) return false;
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

function compareByCreatedAtDesc<T extends { createdAt?: any }>(items: T[]) {
  return [...items].sort((a, b) => {
    const aTime = toDate(a.createdAt)?.getTime() || 0;
    const bTime = toDate(b.createdAt)?.getTime() || 0;
    return bTime - aTime;
  });
}

function serializeTimestamp(value: any) {
  const date = toDate(value);
  return date ? date.toISOString() : null;
}

function serializeBetaFeedback(entry: AnyRecord) {
  return {
    id: entry.id,
    companyId: entry.companyId,
    companyName: entry.companyName || null,
    userId: entry.userId,
    userEmail: entry.userEmail,
    userName: entry.userName || null,
    type: entry.type,
    severity: entry.severity,
    title: entry.title,
    message: entry.message,
    pagePath: entry.pagePath,
    status: entry.status,
    createdAt: serializeTimestamp(entry.createdAt),
    updatedAt: serializeTimestamp(entry.updatedAt),
    reviewedAt: serializeTimestamp(entry.reviewedAt),
    resolvedAt: serializeTimestamp(entry.resolvedAt),
    adminNotes: entry.adminNotes || '',
    lastUpdatedByAdminUid: entry.lastUpdatedByAdminUid || null,
  };
}

async function buildCompanyOverview(db: Firestore, companyId: string): Promise<CompanyOverview> {
  const companySnap = await db.collection('companies').doc(companyId).get();
  const company = companySnap.data() || {};

  if (!companySnap.exists) {
    logCompanyOverview('Company document missing. Returning empty overview.', { companyId });
    return buildEmptyCompanyOverview(companyId);
  }

  const [productsSnap, ordersSnap, customersSnap, remindersSnap, messagesSnap, activitiesSnap] = await Promise.all([
    db.collection('products').where('companyId', '==', companyId).get(),
    db.collection('orders').where('companyId', '==', companyId).get(),
    db.collection('customers').where('companyId', '==', companyId).get(),
    db.collection('reminders').where('companyId', '==', companyId).where('status', '==', 'pending').get(),
    db.collection('customerMessages').where('companyId', '==', companyId).orderBy('createdAt', 'desc').limit(10).get().catch(() => ({
      docs: [],
      size: 0,
    })),
    db.collection('activities').where('companyId', '==', companyId).orderBy('createdAt', 'desc').limit(10).get().catch(() => ({
      docs: [],
      size: 0,
    })),
  ]);

  const now = new Date();
  const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const prev7Days = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const prev30Days = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  const orders = ordersSnap.docs.map((entry) => ({ id: entry.id, ...entry.data() })) as AnyRecord[];
  const recentOrders = orders.filter((order) => toDate(order.createdAt) && toDate(order.createdAt)! > last7Days);
  const previousOrders = orders.filter((order) => {
    const date = toDate(order.createdAt);
    return date && date <= last7Days && date > prev7Days;
  });
  const recentRevenue30d = orders
    .filter((order) => {
      const date = toDate(order.createdAt);
      return date && date >= last30Days;
    })
    .reduce((sum, order) => sum + getOrderTotal(order), 0);
  const previousRevenue30d = orders
    .filter((order) => {
      const date = toDate(order.createdAt);
      return date && date >= prev30Days && date < last30Days;
    })
    .reduce((sum, order) => sum + getOrderTotal(order), 0);

  const productSales = new Map<string, { productId: string; name: string; quantity: number; revenue: number }>();
  const customerSales = new Map<string, { customerId: string; name: string; total: number; count: number }>();

  orders.forEach((order) => {
    getOrderItems(order).forEach((item: AnyRecord) => {
      const existing = productSales.get(item.productId) || {
        productId: item.productId,
        name: item.productName || 'Unknown',
        quantity: 0,
        revenue: 0,
      };
      existing.quantity += item.quantity || 0;
      existing.revenue += (item.price || 0) * (item.quantity || 0);
      productSales.set(item.productId, existing);
    });

    const customerId = order.customerId || 'guest';
    const existingCustomer = customerSales.get(customerId) || {
      customerId,
      name: order.customerName || 'Guest',
      total: 0,
      count: 0,
    };
    existingCustomer.total += getOrderTotal(order);
    existingCustomer.count += 1;
    customerSales.set(customerId, existingCustomer);
  });

  const lowStockItems = productsSnap.docs
    .map((entry) => ({
      id: entry.id,
      name: entry.data().name,
      stock: entry.data().stockLevel ?? 0,
    }))
    .filter((product) => product.stock <= 10)
    .sort((a, b) => a.stock - b.stock);
  const inventoryValue = productsSnap.docs.reduce((sum, entry) => {
    const data = entry.data();
    return sum + ((data.stockLevel ?? 0) * (data.price ?? 0));
  }, 0);

  const growth = previousRevenue30d > 0
    ? ((recentRevenue30d - previousRevenue30d) / previousRevenue30d) * 100
    : recentRevenue30d > 0 ? 100 : 0;
  const onboardingChecklist = {
    profile: true,
    product: productsSnap.size > 0,
    customer: customersSnap.size > 0,
    order: ordersSnap.size > 0,
  };
  const onboardingCompleted = Object.values(onboardingChecklist).every(Boolean);

  return {
    companyId,
    companyName: company.name || 'Unknown company',
    industry: company.industry || 'General',
    onboardingCompleted,
    planId: getPlanDefinition(company.subscription?.planId).id,
    customersCount: customersSnap.size,
    productsCount: productsSnap.size,
    ordersCount: ordersSnap.size,
    inventoryValue,
    recentRevenue: recentRevenue30d,
    recentRevenue30d,
    previousRevenue30d,
    growth,
    lowStockCount: lowStockItems.length,
    topProducts: [...productSales.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 5),
    lowStockItems: lowStockItems.slice(0, 5),
    topCustomers: [...customerSales.values()].sort((a, b) => b.total - a.total).slice(0, 5),
    inventoryStatus: lowStockItems.slice(0, 5),
    pendingReminders: remindersSnap.docs.slice(0, 10).map((entry) => ({
      customer: entry.data().customerName || 'Unknown',
      type: entry.data().type || 'follow_up',
      due: entry.data().dueDate || null,
      notes: entry.data().notes || '',
    })),
    recentCommunications: (messagesSnap as any).docs?.map((entry: any) => ({
      customer: entry.data().customerName || 'Unknown',
      status: entry.data().status || 'draft',
      content: String(entry.data().content || '').slice(0, 120),
    })) || [],
    recentActivities: (activitiesSnap as any).docs?.map((entry: any) => ({
      type: entry.data().type || 'activity',
      title: entry.data().title || '',
      subtitle: entry.data().subtitle || '',
      createdAt: entry.data().createdAt || null,
    })) || [],
    salesVelocity: {
      currentPeriodOrders: recentOrders.length,
      previousPeriodOrders: previousOrders.length,
      trend: recentOrders.length >= previousOrders.length ? 'up' : 'down',
    },
  };
}

async function buildCompanyUsage(db: Firestore, companyId: string) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const [customersSnap, productsSnap, ordersSnap, teamSnap, invitesSnap] = await Promise.all([
    db.collection('customers').where('companyId', '==', companyId).get(),
    db.collection('products').where('companyId', '==', companyId).get(),
    db.collection('orders')
      .where('companyId', '==', companyId)
      .where('createdAt', '>=', Timestamp.fromDate(monthStart))
      .where('createdAt', '<', Timestamp.fromDate(nextMonthStart))
      .get(),
    db.collection('memberships').where('companyId', '==', companyId).get(),
    db.collection('invitations').where('companyId', '==', companyId).where('status', '==', 'pending').get(),
  ]);

  return {
    customers: customersSnap.size,
    products: productsSnap.size,
    orders: ordersSnap.size,
    seats: teamSnap.size + invitesSnap.size,
  };
}

function resolvePrimaryMembershipForUser(user: AnyRecord, memberships: AnyRecord[]) {
  if (!memberships.length) return null;
  if (user.currentCompanyId) {
    const currentCompanyMembership = memberships.find((entry) => entry.companyId === user.currentCompanyId);
    if (currentCompanyMembership) return currentCompanyMembership;
  }
  const ownerMembership = memberships.find((entry) => entry.role === 'owner');
  return ownerMembership || memberships[0];
}

async function buildPlatformSupportView(
  db: Firestore,
  companyId: string,
  targetUserId?: string | null
) {
  const [
    companySnap,
    companyStatsSnap,
    companyBillingSnap,
    membershipsSnap,
    activitiesSnap,
  ] = await Promise.all([
    db.collection('companies').doc(companyId).get(),
    db.collection('companyStats').doc(companyId).get(),
    db.collection('companyBillingStats').doc(companyId).get(),
    db.collection('memberships').where('companyId', '==', companyId).get(),
    db.collection('activities').where('companyId', '==', companyId).orderBy('createdAt', 'desc').limit(10).get().catch(() => ({
      docs: [],
    })),
  ]);

  const companyData = companySnap.exists ? companySnap.data() || {} : {};
  const companyStats = companyStatsSnap.exists ? companyStatsSnap.data() || {} : {};
  const companyBilling = companyBillingSnap.exists ? companyBillingSnap.data() || {} : {};
  const memberships = membershipsSnap.docs.map((entry) => ({ id: entry.id, ...entry.data() })) as AnyRecord[];
  const ownerMembership = (memberships.find((entry: AnyRecord) => entry.role === 'owner') || null) as AnyRecord | null;
  const membershipUserIds = [...new Set(memberships.map((entry) => entry.userId).filter(Boolean))];
  if (targetUserId && !membershipUserIds.includes(targetUserId)) {
    membershipUserIds.push(targetUserId);
  }
  const userDocs = await Promise.all(
    membershipUserIds.map(async (uid) => {
      const userSnap = await db.collection('users').doc(uid).get();
      return userSnap.exists ? { id: userSnap.id, ...userSnap.data() } : null;
    })
  );
  const users = userDocs.filter(Boolean) as AnyRecord[];
  const usersById = new Map(users.map((entry) => [entry.id, entry]));
  const targetUser =
    (targetUserId ? usersById.get(targetUserId) : null) ||
    (ownerMembership ? usersById.get(ownerMembership.userId) : null) ||
    users[0] ||
    null;
  const targetMembership = targetUser
    ? memberships.find((entry: AnyRecord) => entry.userId === targetUser.id && entry.companyId === companyId) || null
    : ownerMembership;
  const ownerUser = ownerMembership ? usersById.get(ownerMembership.userId) : null;

  const issues: Array<{ severity: 'info' | 'warning' | 'error'; code: string; message: string }> = [];
  if (!companySnap.exists) {
    issues.push({
      severity: 'error',
      code: 'COMPANY_MISSING',
      message: 'The company document does not exist.',
    });
  }
  if (!memberships.length) {
    issues.push({
      severity: 'error',
      code: 'MEMBERSHIPS_MISSING',
      message: 'The company has no memberships.',
    });
  }
  if (!ownerMembership) {
    issues.push({
      severity: 'warning',
      code: 'OWNER_MEMBERSHIP_MISSING',
      message: 'No owner membership was found for this company.',
    });
  }
  if (targetUser && targetUser.currentCompanyId !== companyId) {
    issues.push({
      severity: 'warning',
      code: 'CURRENT_COMPANY_MISMATCH',
      message: 'The selected user currentCompanyId does not match this company.',
    });
  }
  if (!companyData?.onboardingState?.isComplete) {
    issues.push({
      severity: 'info',
      code: 'ONBOARDING_INCOMPLETE',
      message: 'Onboarding is not marked as complete yet.',
    });
  }
  if ((companyStats.ordersCount || 0) === 0 && (companyStats.productsCount || 0) === 0 && (companyStats.customersCount || 0) === 0) {
    issues.push({
      severity: 'info',
      code: 'NO_OPERATIONAL_DATA',
      message: 'The company has no operational data yet.',
    });
  }

  return {
    mode: 'support',
    company: {
      id: companyId,
      name: companyData?.name || 'Unnamed company',
      industry: companyData?.industry || 'Unknown industry',
      ownerId: companyData?.ownerId || ownerMembership?.userId || null,
      ownerEmail: ownerUser?.email || 'No owner email',
      subscriptionStatus: companyBilling.subscriptionStatus || companyData?.subscription?.status || 'trialing',
      planId: companyBilling.planId || companyData?.subscription?.planId || 'starter',
      stripeCustomerId: companyData?.stripeCustomerId || null,
      currentCompanyId: targetUser?.currentCompanyId || null,
      onboardingComplete: Boolean(companyData?.onboardingState?.isComplete),
      onboardingStep: companyData?.onboardingState?.step || 1,
      createdAt: companyData?.createdAt || null,
      totals: {
        users: memberships.length,
        products: companyStats.productsCount || 0,
        customers: companyStats.customersCount || 0,
        orders: companyStats.ordersCount || 0,
        revenue: companyStats.lifetimeRevenue || 0,
      },
    },
    targetUser: targetUser
      ? {
          uid: targetUser.id,
          email: targetUser.email || 'No email',
          displayName: targetUser.displayName || 'Unnamed user',
          photoURL: targetUser.photoURL || null,
          currentCompanyId: targetUser.currentCompanyId || null,
          createdAt: targetUser.createdAt || null,
        }
      : null,
    membership: targetMembership
      ? {
          id: targetMembership.id,
          userId: targetMembership.userId,
          companyId: targetMembership.companyId,
          role: targetMembership.role,
          createdAt: targetMembership.createdAt || null,
        }
      : null,
    memberships: memberships.map((entry) => ({
      id: entry.id,
      userId: entry.userId,
      companyId: entry.companyId,
      role: entry.role,
      email: usersById.get(entry.userId)?.email || 'No email',
      displayName: usersById.get(entry.userId)?.displayName || 'Unnamed user',
    })),
    activity: {
      recentActivities: (activitiesSnap as any).docs?.map((entry: any) => ({
        id: entry.id,
        ...entry.data(),
      })) || [],
    },
    issues,
  };
}

async function buildPlatformOverview(db: Firestore) {
  const [
    companiesSnap,
    usersSnap,
    membershipsSnap,
    controlsSnap,
    statsSnap,
    billingStatsSnap,
  ] = await Promise.all([
    db.collection('companies').get(),
    db.collection('users').get(),
    db.collection('memberships').get(),
    db.collection('platformCompanyControls').get(),
    db.collection('companyStats').get(),
    db.collection('companyBillingStats').get(),
  ]);

  const companies = companiesSnap.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
  const users = usersSnap.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
  const memberships = membershipsSnap.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
  const controls = Object.fromEntries(
    controlsSnap.docs.map((entry) => [entry.id, { companyId: entry.id, ...entry.data() }])
  ) as Record<string, AnyRecord>;
  const companyStats = Object.fromEntries(
    statsSnap.docs.map((entry) => [entry.id, { companyId: entry.id, ...entry.data() }])
  ) as Record<string, AnyRecord>;
  const companyBillingStats = Object.fromEntries(
    billingStatsSnap.docs.map((entry) => [entry.id, { companyId: entry.id, ...entry.data() }])
  ) as Record<string, AnyRecord>;

  const companyNameById = new Map(companies.map((company: AnyRecord) => [company.id, company.name || 'Unknown company']));
  const companiesById = new Map(companies.map((company: AnyRecord) => [company.id, company]));
  const usersById = new Map(users.map((user: AnyRecord) => [user.id, user]));
  const membershipsByCompany = new Map<string, AnyRecord[]>();
  const membershipsByUser = new Map<string, AnyRecord[]>();

  memberships.forEach((membership: AnyRecord) => {
    membershipsByCompany.set(
      membership.companyId,
      [...(membershipsByCompany.get(membership.companyId) || []), membership]
    );
    membershipsByUser.set(
      membership.userId,
      [...(membershipsByUser.get(membership.userId) || []), membership]
    );
  });

  const companiesTable = companies.map((company: AnyRecord) => {
    const stats = companyStats[company.id] || {};
    const companyMemberships = membershipsByCompany.get(company.id) || [];
    const ownerMembership = companyMemberships.find((membership) => membership.role === 'owner');
    const ownerUser = ownerMembership ? usersById.get(ownerMembership.userId) : undefined;
    return {
      id: company.id,
      name: company.name || 'Unnamed company',
      industry: company.industry || 'Unknown industry',
      ownerEmail: ownerUser?.email || usersById.get(company.ownerId || '')?.email || 'No owner email',
      ownerId: company.ownerId,
      plan: company.subscription?.planId || 'starter',
      subscriptionStatus: company.subscription?.status || 'trialing',
      stripeCustomerId: company.stripeCustomerId,
      onboardingComplete: Boolean(company.onboardingState?.isComplete),
      onboardingStep: company.onboardingState?.step || 1,
      onboardingChecklist: {
        profile: Boolean(company.onboardingState?.checklist?.profile),
        product: Boolean(company.onboardingState?.checklist?.product),
        customer: Boolean(company.onboardingState?.checklist?.customer),
        order: Boolean(company.onboardingState?.checklist?.order),
      },
      trialEndsAt: company.subscription?.trialEndsAt,
      currentPeriodEnd: company.subscription?.currentPeriodEnd,
      users: stats.activeUsers || companyMemberships.length,
      products: stats.productsCount || 0,
      customers: stats.customersCount || 0,
      orders: stats.ordersCount || 0,
      revenue: stats.lifetimeRevenue || 0,
      createdAt: company.createdAt,
    };
  });

  const usersTable = users.map((user: AnyRecord) => {
    const candidateMemberships = membershipsByUser.get(user.id) || [];
    const membership = resolvePrimaryMembershipForUser(user, candidateMemberships) as AnyRecord | null;
    const resolvedCompanyId = membership?.companyId || user.currentCompanyId || null;
    const company = resolvedCompanyId ? companiesById.get(resolvedCompanyId) : null;
    const stats = resolvedCompanyId ? companyStats[resolvedCompanyId] || {} : {};
    const billing = resolvedCompanyId ? companyBillingStats[resolvedCompanyId] || {} : {};
    return {
      id: user.id,
      email: user.email || 'No email',
      displayName: user.displayName || 'Unnamed user',
      photoURL: user.photoURL || null,
      companyId: resolvedCompanyId,
      companyName: resolvedCompanyId ? companyNameById.get(resolvedCompanyId) || 'Unknown company' : 'No company',
      role: membership?.role || 'unassigned',
      currentCompanyId: user.currentCompanyId || null,
      subscriptionStatus: billing.subscriptionStatus || company?.subscription?.status || 'no_company',
      onboardingStatus: company?.onboardingState?.isComplete ? 'complete' : (resolvedCompanyId ? 'pending' : 'not_started'),
      products: stats.productsCount || 0,
      customers: stats.customersCount || 0,
      orders: stats.ordersCount || 0,
      createdAt: user.createdAt,
    };
  });

  const latestUsers = compareByCreatedAtDesc(usersTable).slice(0, 6);
  const now = new Date();
  const billingStatsValues = Object.values(companyBillingStats) as AnyRecord[];
  const companiesCount = companies.length || 1;
  const totalSales = companiesTable.reduce((sum, company: AnyRecord) => sum + (company.revenue || 0), 0);
  const totalOrders = companiesTable.reduce((sum, company: AnyRecord) => sum + (company.orders || 0), 0);
  const estimatedMrr = companiesTable.reduce((sum, company: AnyRecord) => {
    const plan = getPlanDefinition(company.plan);
    return ['active', 'past_due'].includes(company.subscriptionStatus) ? sum + plan.monthlyPrice : sum;
  }, 0);
  const realMrr = billingStatsValues.reduce((sum, stat) => sum + (stat.mrr || 0), 0);
  const realArr = billingStatsValues.reduce((sum, stat) => sum + (stat.arr || 0), 0);
  const largestMrr = billingStatsValues.reduce((max, stat) => Math.max(max, stat.mrr || 0), 0);

  const metrics = {
    totalCompanies: companies.length,
    totalUsers: users.length,
    totalProducts: companiesTable.reduce((sum, company: AnyRecord) => sum + (company.products || 0), 0),
    totalCustomers: companiesTable.reduce((sum, company: AnyRecord) => sum + (company.customers || 0), 0),
    activeCompanies: companiesTable.filter((company: AnyRecord) => company.subscriptionStatus === 'active').length,
    trialCompanies: companiesTable.filter((company: AnyRecord) => company.subscriptionStatus === 'trialing').length,
    expiredOrPastDueCompanies: companiesTable.filter((company: AnyRecord) => {
      if (company.subscriptionStatus === 'past_due' || company.subscriptionStatus === 'canceled') return true;
      const trialEndsAt = toDate(company.trialEndsAt);
      return company.subscriptionStatus === 'trialing' && Boolean(trialEndsAt && trialEndsAt < now);
    }).length,
    starterPlans: companiesTable.filter((company: AnyRecord) => company.plan === 'starter').length,
    proPlans: companiesTable.filter((company: AnyRecord) => company.plan === 'pro').length,
    businessPlans: companiesTable.filter((company: AnyRecord) => company.plan === 'business').length,
    estimatedMrr,
    totalOrders,
    totalSales,
    averageOrderValue: totalOrders > 0 ? totalSales / totalOrders : 0,
    companiesWithoutOrders: companiesTable.filter((company: AnyRecord) => (company.orders || 0) === 0).length,
    trialExpiringSoon: companiesTable.filter((company: AnyRecord) => {
      const trialEndsAt = toDate(company.trialEndsAt);
      if (company.subscriptionStatus !== 'trialing' || !trialEndsAt || trialEndsAt < now) return false;
      const diffDays = (trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays <= 7;
    }).length,
    ownerlessCompanies: companiesTable.filter((company: AnyRecord) => company.ownerEmail === 'No owner email').length,
    estimatedArr: estimatedMrr * 12,
    monthlyPlatformSales: Object.values(companyStats).reduce((sum: number, stat: any) => sum + (stat.monthlyRevenue || 0), 0),
    statsCoverage: Math.round((Object.keys(companyStats).length / companiesCount) * 100),
    activeNoConversionCompanies: companiesTable.filter((company: AnyRecord) => company.subscriptionStatus === 'active' && (company.orders || 0) === 0).length,
    pastDueWatchCount: companiesTable.filter((company: AnyRecord) => company.subscriptionStatus === 'past_due').length,
    realMrr,
    realArr,
    activeSubscriptions: billingStatsValues.filter((stat) => stat.subscriptionStatus === 'active').length,
    trialingSubscriptions: billingStatsValues.filter((stat) => stat.subscriptionStatus === 'trialing').length,
    pastDueSubscriptions: billingStatsValues.filter((stat) => stat.subscriptionStatus === 'past_due' || stat.pastDue).length,
    canceledSubscriptions: billingStatsValues.filter((stat) => stat.subscriptionStatus === 'canceled').length,
    cancelAtPeriodEndCount: billingStatsValues.filter((stat) => stat.cancelAtPeriodEnd).length,
    billingCoverage: Math.round((billingStatsValues.length / companiesCount) * 100),
    topRevenueShare: realMrr > 0 ? Math.round((largestMrr / realMrr) * 100) : 0,
  };

  return {
    metrics,
    companiesTable,
    usersTable,
    latestUsers,
    companyControls: controls,
    companyStats,
    companyBillingStats,
  };
}

function parseJSONPayload(text: string) {
  const sanitized = (text || '').replace(/```json|```/g, '').trim();
  return sanitized;
}

function logAiRequest(route: string, companyId: string, start: number, extra?: Record<string, unknown>) {
  const durationMs = Date.now() - start;
  console.info(`[AI] ${route}`, {
    companyId,
    durationMs,
    ...extra,
  });
}

export function createApp() {
  const app = express();

  app.use((req, res, next) => {
    if (req.originalUrl === '/api/billing/webhook') {
      return next();
    }
    return express.json()(req, res, next);
  });

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  const handleAiHealth = async (req: express.Request, res: express.Response) => {
    try {
      const access = await requireAuthenticatedUser(req, res);
      if (!access) return;
      const db = getDb();
      const geminiConfigured = Boolean(process.env.GEMINI_API_KEY);
      const firebaseAdminReady = Boolean(db);
      console.info('[AI Health] runtime', {
        geminiConfigured,
        firebaseAdminReady,
        vercelEnv: process.env.VERCEL_ENV || null,
      });
      res.json({
        ok: true,
        provider: 'gemini',
        geminiConfigured,
        firebaseAdminReady,
        nodeEnv: process.env.NODE_ENV || null,
        vercelEnv: process.env.VERCEL_ENV || null,
        deploymentUrlPresent: Boolean(process.env.VERCEL_URL),
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('[AI] /api/ai/health error:', error.message || error);
      res.status(500).json({ error: error.message || 'Failed to load AI health' });
    }
  };

  app.get('/api/ai/health', handleAiHealth);
  app.post('/api/ai/health', handleAiHealth);

  app.get('/api/billing/config', (_req, res) => {
    res.json({
      stripeEnabled: !!process.env.STRIPE_SECRET_KEY,
      publishableKey: process.env.VITE_STRIPE_PUBLISHABLE_KEY,
      currency: BILLING_CURRENCY,
      prices: getBilledPrices(),
    });
  });

  app.post('/api/company/usage', async (req, res) => {
    try {
      const access = await requireCompanyAccess(req, res, ['owner', 'admin', 'staff', 'viewer']);
      if (!access) return;
      const db = getDb();
      if (!db) throw new Error('Database not initialized');
      const usage = await buildCompanyUsage(db, access.companyId);
      res.json(usage);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to load company usage' });
    }
  });

  app.post('/api/company/overview', async (req, res) => {
    try {
      console.info('[AI] company overview request received', {
        companyId: req.body?.companyId,
      });
      logCompanyOverview('Overview request received.', {
        companyId: req.body?.companyId,
      });
      const access = await requireCompanyAccess(req, res, ['owner', 'admin', 'staff', 'viewer']);
      if (!access) return;
      const db = getDb();
      if (!db) throw new Error('Database not initialized');
      const overview = await buildCompanyOverview(db, access.companyId);
      logCompanyOverview('Overview response ready.', {
        companyId: access.companyId,
        productsCount: overview.productsCount,
        customersCount: overview.customersCount,
        ordersCount: overview.ordersCount,
        inventoryValue: overview.inventoryValue,
      });
      console.info('[AI] company overview loaded', {
        companyId: access.companyId,
        productsCount: overview.productsCount,
        customersCount: overview.customersCount,
        ordersCount: overview.ordersCount,
        inventoryValue: overview.inventoryValue,
      });
      res.json(overview);
    } catch (error: any) {
      console.error('[CompanyOverview] Failed to load company overview:', error.message || error);
      res.status(500).json({ error: error.message || 'Failed to load company overview' });
    }
  });

  app.post('/api/platform/overview', async (req, res) => {
    try {
      const access = await requirePlatformAdmin(req, res);
      if (!access) return;
      const db = getDb();
      if (!db) throw new Error('Database not initialized');
      const overview = await buildPlatformOverview(db);
      await db.collection('platformAuditLogs').add({
        type: 'platform_overview_loaded',
        actorUid: access.uid,
        createdAt: FieldValue.serverTimestamp(),
      });
      res.json(overview);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to load platform overview' });
    }
  });

  app.get('/api/platform/feedback', async (req, res) => {
    try {
      const access = await requirePlatformAdmin(req, res);
      if (!access) return;
      const db = getDb();
      if (!db) throw new Error('Database not initialized');

      const status = typeof req.query?.status === 'string' ? req.query.status.trim() : '';
      const severity = typeof req.query?.severity === 'string' ? req.query.severity.trim() : '';

      if (status && !VALID_PLATFORM_FEEDBACK_STATUSES.includes(status as typeof VALID_PLATFORM_FEEDBACK_STATUSES[number])) {
        return res.status(400).json({ error: 'Invalid status filter' });
      }

      if (severity && !VALID_PLATFORM_FEEDBACK_SEVERITIES.includes(severity as typeof VALID_PLATFORM_FEEDBACK_SEVERITIES[number])) {
        return res.status(400).json({ error: 'Invalid severity filter' });
      }

      const feedbackSnap = await db
        .collection('betaFeedback')
        .orderBy('createdAt', 'desc')
        .limit(100)
        .get();

      const feedback = feedbackSnap.docs
        .map((entry) => serializeBetaFeedback({ id: entry.id, ...entry.data() }))
        .filter((entry) => (!status || entry.status === status) && (!severity || entry.severity === severity));

      res.json({ feedback });
    } catch (error: any) {
      console.error('Platform feedback load failed:', error);
      res.status(500).json({ error: error.message || 'Failed to load platform feedback' });
    }
  });

  app.patch('/api/platform/feedback/:feedbackId', async (req, res) => {
    try {
      const access = await requirePlatformAdmin(req, res);
      if (!access) return;
      const db = getDb();
      if (!db) throw new Error('Database not initialized');

      const feedbackId = typeof req.params?.feedbackId === 'string' ? req.params.feedbackId.trim() : '';
      if (!feedbackId) {
        return res.status(400).json({ error: 'feedbackId is required' });
      }

      const status = req.body?.status;
      const adminNotes = req.body?.adminNotes;

      if (status !== undefined && !VALID_PLATFORM_FEEDBACK_STATUSES.includes(status)) {
        return res.status(400).json({ error: 'Invalid status value' });
      }

      if (adminNotes !== undefined && typeof adminNotes !== 'string') {
        return res.status(400).json({ error: 'adminNotes must be a string' });
      }

      const allowedKeys = Object.keys(req.body || {});
      const hasOnlyAllowedKeys = allowedKeys.every((key) => ['status', 'adminNotes'].includes(key));
      if (!hasOnlyAllowedKeys || allowedKeys.length === 0) {
        return res.status(400).json({ error: 'Only status and adminNotes can be updated' });
      }

      const feedbackRef = db.collection('betaFeedback').doc(feedbackId);
      const feedbackSnap = await feedbackRef.get();
      if (!feedbackSnap.exists) {
        return res.status(404).json({ error: 'Feedback not found' });
      }

      const payload: Record<string, unknown> = {
        updatedAt: FieldValue.serverTimestamp(),
        lastUpdatedByAdminUid: access.uid,
      };

      if (typeof status === 'string') {
        payload.status = status;
        if (status === 'reviewed') {
          payload.reviewedAt = FieldValue.serverTimestamp();
        }
        if (status === 'resolved') {
          payload.resolvedAt = FieldValue.serverTimestamp();
        }
      }

      if (typeof adminNotes === 'string') {
        payload.adminNotes = adminNotes.trim();
      }

      await feedbackRef.update(payload);
      await db.collection('adminAuditLogs').add({
        adminUid: access.uid,
        adminEmail: access.email,
        action: 'beta_feedback_updated',
        targetCompanyId: feedbackSnap.data()?.companyId || null,
        targetUserId: feedbackSnap.data()?.userId || null,
        feedbackId,
        createdAt: FieldValue.serverTimestamp(),
      });

      res.json({ ok: true });
    } catch (error: any) {
      console.error('Platform feedback update failed:', error);
      res.status(500).json({ error: error.message || 'Failed to update feedback' });
    }
  });

  app.post('/api/platform/stats/sync', async (req, res) => {
    try {
      const access = await requirePlatformAdmin(req, res);
      if (!access) return;
      const db = getDb();
      if (!db) throw new Error('Database not initialized');
      const overview = await buildPlatformOverview(db);
      const batch = db.batch();

      overview.companiesTable.forEach((company: AnyRecord) => {
        const companyStatsEntry = overview.companyStats[company.id] || {};
        const payload = {
          companyId: company.id,
          ordersCount: company.orders,
          customersCount: company.customers,
          productsCount: company.products,
          lifetimeRevenue: company.revenue,
          monthlyRevenue: companyStatsEntry.monthlyRevenue || 0,
          lastOrderAt: companyStatsEntry.lastOrderAt || null,
          firstOrderAt: companyStatsEntry.firstOrderAt || null,
          activeUsers: company.users,
          updatedAt: FieldValue.serverTimestamp(),
        };
        batch.set(db.collection('companyStats').doc(company.id), payload, { merge: true });
      });

      batch.set(db.collection('platformAuditLogs').doc(), {
        type: 'company_stats_synced',
        actorUid: access.uid,
        payload: { companies: overview.companiesTable.length },
        createdAt: FieldValue.serverTimestamp(),
      });

      await batch.commit();
      res.json({ status: 'success', companies: overview.companiesTable.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Platform stats sync failed' });
    }
  });

  app.post('/api/billing/create-checkout-session', async (req, res) => {
    try {
      const access = await requireCompanyAccess(req, res, ['owner', 'admin']);
      if (!access) return;
      const { planId, companyId, customerEmail } = req.body;
      const stripeClient = getStripe();

      if (!PLAN_IDS.includes(planId)) {
        return res.status(400).json({ error: `Unsupported plan: ${planId}` });
      }

      if (!stripeClient) {
        const mockUrl = `${process.env.APP_URL || 'http://localhost:3000'}/billing?success=true&session_id=mock_session_${planId}_${Date.now()}`;
        return res.json({ url: mockUrl });
      }

      const prices: Record<string, string | undefined> = {
        starter: process.env.STRIPE_PRICE_ID_STARTER,
        pro: process.env.STRIPE_PRICE_ID_PRO,
        business: process.env.STRIPE_PRICE_ID_BUSINESS,
      };

      const priceId = prices[planId];
      if (!priceId) {
        return res.status(400).json({ error: `Price mapping for ${planId} is missing.` });
      }

      const db = getDb();
      if (!db) throw new Error('Database not initialized');

      const companyRef = db.collection('companies').doc(companyId);
      const companyDoc = await companyRef.get();
      let stripeCustomerId = companyDoc.data()?.stripeCustomerId;

      if (!stripeCustomerId) {
        const customer = await stripeClient.customers.create({
          email: customerEmail,
          metadata: { companyId },
        });
        stripeCustomerId = customer.id;
        await companyRef.update({ stripeCustomerId });
      }

      const session = await stripeClient.checkout.sessions.create({
        customer: stripeCustomerId,
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: 'subscription',
        success_url: `${process.env.APP_URL || 'http://localhost:3000'}/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.APP_URL || 'http://localhost:3000'}/billing?canceled=true`,
        metadata: { companyId, planId },
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error('Stripe Session Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/billing/create-portal-session', async (req, res) => {
    try {
      const access = await requireCompanyAccess(req, res, ['owner', 'admin']);
      if (!access) return;
      const stripeClient = getStripe();
      if (!stripeClient) {
        return res.status(400).json({ error: 'Stripe not configured.' });
      }

      const db = getDb();
      if (!db) throw new Error('Database not initialized');
      const companyDoc = await db.collection('companies').doc(req.body.companyId).get();
      const stripeCustomerId = companyDoc.data()?.stripeCustomerId;
      if (!stripeCustomerId) {
        return res.status(400).json({ error: 'No Stripe customer found.' });
      }

      const session = await stripeClient.billingPortal.sessions.create({
        customer: stripeCustomerId,
        return_url: `${process.env.APP_URL || 'http://localhost:3000'}/billing`,
      });
      res.json({ url: session.url });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/billing/sync', async (req, res) => {
    try {
      const access = await requireCompanyAccess(req, res, ['owner', 'admin']);
      if (!access) return;
      const { sessionId, companyId } = req.body;
      const db = getDb();
      if (!db) throw new Error('Database not initialized');

      if (typeof sessionId !== 'string' || !sessionId) {
        return res.status(400).json({ error: 'sessionId is required' });
      }

      if (sessionId.startsWith('mock_session_')) {
        if (getStripe()) {
          return res.status(400).json({ error: 'Mock sessions are not allowed in production' });
        }
        const planId = (sessionId.split('_')[2] || 'starter') as PlanId;
        if (!PLAN_IDS.includes(planId)) {
          return res.status(400).json({ error: 'Invalid mock plan' });
        }

        const currentPeriodEnd = Timestamp.fromMillis(Date.now() + 30 * 24 * 60 * 60 * 1000);
        await db.collection('companies').doc(companyId).update({
          subscription: {
            planId,
            status: 'active',
            currentPeriodEnd,
            stripeSubscriptionId: `mock_${Date.now()}`,
          },
          updatedAt: FieldValue.serverTimestamp(),
        });

        await db.collection('companyBillingStats').doc(companyId).set(
          buildFallbackBillingStats(companyId, {
            subscription: {
              planId,
              status: 'active',
              currentPeriodEnd,
            },
          }),
          { merge: true }
        );

        return res.json({ status: 'success', planId });
      }

      const stripeClient = getStripe();
      if (!stripeClient) throw new Error('Stripe not configured');

      const session = await stripeClient.checkout.sessions.retrieve(sessionId, { expand: ['subscription'] });
      if (session.metadata?.companyId !== companyId) {
        return res.status(403).json({ error: 'Session does not belong to this company' });
      }

      if (session.payment_status !== 'paid') {
        return res.status(400).json({ error: 'Payment not completed' });
      }

      const subscription = session.subscription as any;
      const planId = getPlanDefinition(session.metadata?.planId).id;

      await db.collection('companies').doc(companyId).update({
        subscription: {
          planId,
          status: subscription.status,
          currentPeriodEnd: Timestamp.fromMillis(getPeriodEndMs(subscription)),
          stripeSubscriptionId: subscription.id,
        },
        updatedAt: FieldValue.serverTimestamp(),
      });

      await db.collection('companyBillingStats').doc(companyId).set(
        buildStripeBillingStats(companyId, { stripeCustomerId: session.customer, subscription: { planId } }, subscription),
        { merge: true }
      );

      res.json({ status: 'success', planId });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/platform/billing/sync', async (req, res) => {
    try {
      const access = await requirePlatformAdmin(req, res);
      if (!access) return;
      const db = getDb();
      if (!db) throw new Error('Database not initialized');
      const stripeClient = getStripe();
      if (!stripeClient) {
        return res.status(503).json({ error: 'Stripe not configured' });
      }

      const requestedCompanyId = typeof req.body?.companyId === 'string' && req.body.companyId.trim()
        ? req.body.companyId.trim()
        : null;

      const companiesSnap = requestedCompanyId
        ? await db.collection('companies').doc(requestedCompanyId).get().then((doc) => ({ docs: doc.exists ? [doc] : [] }))
        : await db.collection('companies').get();

      let syncedCompanies = 0;
      let skippedCompanies = 0;

      for (const companyDoc of companiesSnap.docs) {
        const companyData = companyDoc.data();
        if (!companyData?.stripeCustomerId) {
          skippedCompanies += 1;
          continue;
        }
        const synced = await syncCompanyBillingStats(db, stripeClient, companyDoc.id, companyData);
        if (synced) {
          syncedCompanies += 1;
        } else {
          skippedCompanies += 1;
        }
      }

      await db.collection('platformAuditLogs').add({
        type: 'billing_stats_synced',
        actorUid: access.uid,
        payload: {
          requestedCompanyId,
          syncedCompanies,
          skippedCompanies,
        },
        createdAt: FieldValue.serverTimestamp(),
      });

      res.json({ status: 'success', syncedCompanies, skippedCompanies });
    } catch (error: any) {
      console.error('Platform billing sync failed:', error);
      res.status(500).json({ error: error.message || 'Platform billing sync failed' });
    }
  });

  app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const stripeClient = getStripe();
    const db = getDb();
    if (!stripeClient || !db) return res.sendStatus(200);

    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret || !sig) {
      return res.status(503).send('Webhook secret not configured');
    }

    let event;
    try {
      event = stripeClient.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err: any) {
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    const { type, data } = event;
    switch (type) {
      case 'checkout.session.completed': {
        const session = data.object as any;
        if (session.mode === 'subscription') {
          const subId = session.subscription;
          const companyId = session.metadata?.companyId;
          const planId = getPlanDefinition(session.metadata?.planId).id;
          if (companyId && subId) {
            const sub = await stripeClient.subscriptions.retrieve(subId as string, {
              expand: ['latest_invoice', 'items.data.price'],
            } as any);
            const companyRef = db.collection('companies').doc(companyId);
            await companyRef.update({
              'subscription.planId': planId,
              'subscription.status': (sub as any).status,
              'subscription.currentPeriodEnd': Timestamp.fromMillis(getPeriodEndMs(sub)),
              'subscription.stripeSubscriptionId': subId,
            });
            const companySnap = await companyRef.get();
            await db.collection('companyBillingStats').doc(companyId).set(
              buildStripeBillingStats(companyId, { ...companySnap.data(), stripeCustomerId: session.customer }, sub),
              { merge: true }
            );
          }
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = data.object as any;
        const companies = await db.collection('companies').where('stripeCustomerId', '==', sub.customer).limit(1).get();
        if (!companies.empty) {
          const companyDoc = companies.docs[0];
          await companyDoc.ref.update({
            'subscription.status': sub.status,
            'subscription.currentPeriodEnd': Timestamp.fromMillis(getPeriodEndMs(sub)),
          });
          await db.collection('companyBillingStats').doc(companyDoc.id).set(
            buildStripeBillingStats(companyDoc.id, companyDoc.data(), sub),
            { merge: true }
          );
        }
        break;
      }
      case 'customer.subscription.trial_will_end': {
        const sub = data.object as any;
        const companies = await db.collection('companies').where('stripeCustomerId', '==', sub.customer).limit(1).get();
        if (!companies.empty) {
          const companyDoc = companies.docs[0];
          await db.collection('companyBillingStats').doc(companyDoc.id).set(
            buildStripeBillingStats(companyDoc.id, companyDoc.data(), sub),
            { merge: true }
          );
          await db.collection('platformAuditLogs').add({
            type: 'billing_trial_will_end',
            companyId: companyDoc.id,
            actorUid: 'stripe_webhook',
            payload: {
              stripeCustomerId: sub.customer,
            },
            createdAt: FieldValue.serverTimestamp(),
          });
        }
        break;
      }
      case 'invoice.finalized':
      case 'invoice.paid': {
        const invoice = data.object as any;
        if (invoice.subscription) {
          const companies = await db.collection('companies').where('stripeCustomerId', '==', invoice.customer).limit(1).get();
          if (!companies.empty) {
            const companyDoc = companies.docs[0];
            await companyDoc.ref.update({ 'subscription.status': 'active' });
            const sub = await stripeClient.subscriptions.retrieve(invoice.subscription as string, {
              expand: ['latest_invoice', 'items.data.price'],
            } as any);
            await db.collection('companyBillingStats').doc(companyDoc.id).set(
              buildStripeBillingStats(companyDoc.id, companyDoc.data(), sub),
              { merge: true }
            );
          }
        }
        break;
      }
      case 'invoice.finalization_failed':
      case 'invoice.payment_failed': {
        const invoice = data.object as any;
        if (invoice.subscription) {
          const companies = await db.collection('companies').where('stripeCustomerId', '==', invoice.customer).limit(1).get();
          if (!companies.empty) {
            const companyDoc = companies.docs[0];
            await companyDoc.ref.update({ 'subscription.status': 'past_due' });
            const sub = await stripeClient.subscriptions.retrieve(invoice.subscription as string, {
              expand: ['latest_invoice', 'items.data.price'],
            } as any);
            await db.collection('companyBillingStats').doc(companyDoc.id).set(
              buildStripeBillingStats(companyDoc.id, companyDoc.data(), sub),
              { merge: true }
            );
          }
        }
        break;
      }
    }

    res.json({ received: true });
  });

  app.post('/api/ai/insights', async (req, res) => {
    const startedAt = Date.now();
    try {
      const access = await requireCompanyAccess(req, res, ['owner', 'admin']);
      if (!access) return;
      console.info('[AI] GEMINI_API_KEY detected', Boolean(process.env.GEMINI_API_KEY));
      const ai = getGenAI();
      if (!ai) return sendAiConfigError(res);

      const db = getDb();
      if (!db) throw new Error('Database not initialized');
      const overview = req.body?.businessData || await buildCompanyOverview(db, access.companyId);
      const language = req.body?.language;
      const langMap: Record<string, string> = {
        en: 'Output all text in English.',
        es: 'Entrega toda la salida de texto en Español.',
        pt: 'Entregue toda a saída de texto em Português.',
      };
      const langInstruction = langMap[language] || langMap.en;
      const prompt = `
You are an expert business consultant for Remix OS.
Analyze the following small business data and provide a set of actionable insights.

CRITICAL: ${langInstruction}

Business: ${overview.companyName} (${overview.industry})
Current Plan: ${overview.planId}
Onboarding: ${overview.onboardingCompleted ? 'COMPLETE' : 'INCOMPLETE/PENDING'}
Total Customers: ${overview.customersCount}
Total Products: ${overview.productsCount}
Revenue (Last 30 Days): $${Number(overview.recentRevenue30d ?? overview.recentRevenue ?? 0).toFixed(2)}
Growth vs Prev Period: ${Number(overview.growth || 0).toFixed(1)}%
Top Products: ${JSON.stringify(overview.topProducts || [])}
Low Stock Items: ${JSON.stringify(overview.lowStockItems || [])}
Top Customers: ${JSON.stringify(overview.topCustomers || [])}

Constraint based on Plan:
- starter: basic observations and straightforward advice.
- pro: deeper analysis, subtle patterns and market opportunities.
- business: highly strategic, predictive forecasting and growth blueprints.

Return ONLY a valid JSON array of insight objects. Each must have:
- title (string), explanation (1-2 sentences), type ("opportunity"|"risk"|"efficiency"|"growth"),
- severity ("info"|"success"|"warning"|"critical"), recommendation (1 specific next action).
No markdown, no preamble.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt,
      });
      console.info('[AI] Gemini response received', {
        route: '/api/ai/insights',
        companyId: access.companyId,
      });
      const responseText = extractTextFromGeminiResponse(response);
      console.info('[AI] Gemini extraction result length', {
        route: '/api/ai/insights',
        companyId: access.companyId,
        length: responseText.length,
      });
      const text = parseJSONPayload(responseText);
      if (!text) {
        logAiRequest('/api/ai/insights', access.companyId, startedAt, { empty: true });
        return res.json({ insights: null });
      }
      try {
        const parsed = JSON.parse(text);
        logAiRequest('/api/ai/insights', access.companyId, startedAt, { insights: Array.isArray(parsed) ? parsed.length : 0 });
        return res.json({ insights: parsed });
      } catch (error) {
        console.error('Insight JSON parse error:', error);
        logAiRequest('/api/ai/insights', access.companyId, startedAt, { parseError: true });
        return res.json({ insights: null });
      }
    } catch (error: any) {
      console.error('[AI] /api/ai/insights error:', error.message || error);
      res.status(500).json({ error: error.message || 'AI request failed' });
    }
  });

  app.post('/api/platform/support/view', async (req, res) => {
    try {
      const access = await requirePlatformAdmin(req, res);
      if (!access) return;
      const db = getDb();
      if (!db) throw new Error('Database not initialized');
      const companyId = typeof req.body?.companyId === 'string' ? req.body.companyId.trim() : '';
      const targetUserId = typeof req.body?.targetUserId === 'string' ? req.body.targetUserId.trim() : '';
      if (!companyId) {
        return res.status(400).json({ error: 'companyId is required' });
      }

      const supportView = await buildPlatformSupportView(db, companyId, targetUserId || null);
      await db.collection('adminAuditLogs').add({
        adminUid: access.uid,
        adminEmail: access.email,
        targetCompanyId: companyId,
        targetUserId: targetUserId || null,
        action: 'support_view_opened',
        createdAt: FieldValue.serverTimestamp(),
      });
      res.json(supportView);
    } catch (error: any) {
      console.error('Platform support view failed:', error);
      res.status(500).json({ error: error.message || 'Failed to load support view' });
    }
  });

  app.post('/api/ai/chat', async (req, res) => {
    const startedAt = Date.now();
    try {
      const access = await requireCompanyAccess(req, res, ['owner', 'admin', 'staff', 'viewer']);
      if (!access) return;
      console.info('[AI] /api/ai/chat request received', {
        hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
        hasCompanyId: Boolean(req.body?.companyId),
        vercelEnv: process.env.VERCEL_ENV || null,
      });
      const ai = getGenAI();
      if (!ai) return sendAiConfigError(res);
      const { message, history, language } = req.body || {};
      if (typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({ error: 'message required' });
      }

      const db = getDb();
      if (!db) throw new Error('Database not initialized');
      const ctx = req.body?.context || await buildCompanyOverview(db, access.companyId);
      console.info('[AI] company overview loaded', {
        companyId: access.companyId,
        productsCount: ctx.productsCount,
        customersCount: ctx.customersCount,
        ordersCount: ctx.ordersCount,
        inventoryValue: ctx.inventoryValue,
        recentRevenue30d: ctx.recentRevenue30d,
      });
      const langMap: Record<string, string> = {
        en: 'Communicate in English.',
        es: 'Comunícate en Español. Mantén un tono profesional y premium.',
        pt: 'Comunique-se em Português. Mantenha um tom profissional e premium.',
      };
      const langInstruction = langMap[language] || langMap.en;
      const systemInstruction = `
You are the Remix OS AI Operator, a premium business intelligence system.
You are a proactive business advisor and operational assistant.

CRITICAL: ${langInstruction}

SYSTEM STATUS:
- Company: ${ctx.companyName} (${ctx.industry})
- Onboarding: ${ctx.onboardingCompleted ? 'COMPLETED' : 'IN PROGRESS'}
- User Role: ${req.body?.context?.userRole || 'staff'}

BUSINESS TELEMETRY:
- 30-Day Revenue: $${Number(ctx.recentRevenue30d ?? ctx.recentRevenue ?? 0).toFixed(2)}
- Sales Trend: ${ctx.salesVelocity?.currentPeriodOrders || 0} orders this week (${ctx.salesVelocity?.trend || 'flat'} vs last week)
- Inventory Risk: ${ctx.lowStockCount || 0} items below threshold.
- Engagement: ${ctx.pendingReminders?.length || 0} urgent follow-ups pending.
- Recent Activities: ${JSON.stringify(ctx.recentActivities || [])}
- Recent Communications: ${JSON.stringify(ctx.recentCommunications || [])}

OPERATIONAL PRINCIPLES:
1. OPERATIONAL FOCUS: Avoid conversational filler. Provide high-impact data analysis first.
2. INDUSTRY CONTEXT: Calibrate terminology to "${ctx.industry}".
3. PROACTIVE ADVICE: Prioritize critical risks and suggest specific drafted actions.
4. CUSTOMER ENGAGEMENT: Identify pending reminders and suggest follow-ups.
5. SECURITY PROTOCOL: Respect user roles.

COMMAND PROTOCOLS (MUST appear at the END of the response, on their own line):
- [COMMAND: NAVIGATE | /path] - ONLY for changing screens. Valid paths: /dashboard, /customers, /products, /inventory, /orders, /pos, /insights, /team, /settings, /billing.
- [COMMAND: OPEN_FILTER | module | payload] - For complex data views.
- [COMMAND: DRAFT_REPORT | summary] - When generating an analysis or report.
- [COMMAND: REVIEW_ONLY | summary] - For complex advice without automated path.
- [COMMAND: DRAFT_ORDER | details] - For preparing new orders.

CRITICAL RULES:
1. NEVER put long markdown reports inside [COMMAND: NAVIGATE].
2. If a customer needs a reminder, suggest it and tell the user to check the Customers module.
3. If there are messages in "draft" status, suggest reviewing them.

STRUCTURE: Use SUMMARY, STATUS REPORT, RECOMMENDATIONS, and [COMMANDS].
Maintain a professional, efficient, and supportive persona.`;

      const chat = ai.chats.create({
        model: 'gemini-2.0-flash',
        history: Array.isArray(history) ? history : [],
        config: { systemInstruction },
      });
      const result = await chat.sendMessage({ message });
      console.info('[AI] Gemini response received', {
        route: '/api/ai/chat',
        companyId: access.companyId,
      });
      const responseText = extractTextFromGeminiResponse(result);
      console.info('[AI] Gemini extraction result length', {
        route: '/api/ai/chat',
        companyId: access.companyId,
        length: responseText.length,
      });

      if (!responseText || !responseText.trim()) {
        console.warn('[AI] /api/ai/chat: Empty response from Gemini', { companyId: access.companyId });
        logAiRequest('/api/ai/chat', access.companyId, startedAt, { empty: true, error: 'empty_response' });
        return res.status(502).json({
          error: 'AI response empty',
          details: 'Gemini returned an empty response. Please try again.'
        });
      }

      logAiRequest('/api/ai/chat', access.companyId, startedAt, { responseLength: responseText.length });
      res.json({ text: responseText });
    } catch (error: any) {
      console.error('[AI] /api/ai/chat error:', error.message || error);

      if (error.message?.includes('API key')) {
        return res.status(503).json({
          error: 'AI not configured',
          code: 'AI_NOT_CONFIGURED',
          details: 'La IA no está configurada. Añade GEMINI_API_KEY en variables de entorno.'
        });
      }

      res.status(500).json({ error: error.message || 'AI request failed' });
    }
  });

  app.post('/api/ai/proactive-thoughts', async (req, res) => {
    const startedAt = Date.now();
    try {
      const access = await requireCompanyAccess(req, res, ['owner', 'admin', 'staff', 'viewer']);
      if (!access) return;
      console.info('[AI] GEMINI_API_KEY detected', Boolean(process.env.GEMINI_API_KEY));
      const ai = getGenAI();
      if (!ai) return sendAiConfigError(res);

      const db = getDb();
      if (!db) throw new Error('Database not initialized');
      const context = req.body?.context || await buildCompanyOverview(db, access.companyId);
      const language = req.body?.language;
      const langMap: Record<string, string> = {
        en: 'Respond in English.',
        es: 'Responde en Español. Sé directo y útil.',
        pt: 'Responda em Português. Seja direto e útil.',
      };
      const langInstruction = langMap[language] || langMap.en;

      const prompt = `You are the Remix OS AI Operator thinking about business insights in real-time.
Analyze the current business context and generate 1-2 specific, actionable insights.
Be direct, logical, and practical. Focus on what matters NOW.

CRITICAL: ${langInstruction}

CURRENT BUSINESS STATE:
- Company: ${context.companyName}
- Total Customers: ${context.customersCount}
- Total Products: ${context.productsCount}
- 7-Day Revenue: $${Number(context.recentRevenue || 0).toFixed(2)}
- Sales Trend: ${context.salesVelocity?.trend === 'up' ? 'Increasing' : 'Decreasing'} (${context.salesVelocity?.currentPeriodOrders || 0} vs ${context.salesVelocity?.previousPeriodOrders || 0} orders)
- Low Stock Items: ${context.lowStockCount}

TOP PERFORMERS:
${(context.topProducts?.slice(0, 3) || []).map((product: AnyRecord, index: number) =>
  `${index + 1}. ${product.name}: ${product.quantity} sold ($${product.revenue})`).join('\n') || 'No data'}

TOP CUSTOMERS:
${(context.topCustomers?.slice(0, 3) || []).map((customer: AnyRecord, index: number) =>
  `${index + 1}. ${customer.name}: $${customer.total} total (${customer.count} orders)`).join('\n') || 'No data'}

LOW INVENTORY:
${(context.inventoryStatus?.slice(0, 3) || []).map((product: AnyRecord) =>
  `- ${product.name}: ${product.stock} units`).join('\n') || 'All stock healthy'}

RECENT ACTIVITIES:
${(context.recentActivities?.slice(0, 5) || []).map((activity: AnyRecord, index: number) =>
  `${index + 1}. ${activity.title || activity.type}: ${activity.subtitle || ''}`).join('\n') || 'No recent activity'}

Format: Return ONLY a JSON object with:
{ "insights": [ { "text": "specific insight", "priority": "high"|"medium"|"low" } ] }

NO markdown, NO preamble, just valid JSON.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt,
      });
      console.info('[AI] Gemini response received', {
        route: '/api/ai/proactive-thoughts',
        companyId: access.companyId,
      });
      const responseText = extractTextFromGeminiResponse(response);
      console.info('[AI] Gemini extraction result length', {
        route: '/api/ai/proactive-thoughts',
        companyId: access.companyId,
        length: responseText.length,
      });
      const text = parseJSONPayload(responseText);
      if (!text) {
        logAiRequest('/api/ai/proactive-thoughts', access.companyId, startedAt, { empty: true });
        return res.json({ insights: [] });
      }

      try {
        const parsed = JSON.parse(text);
        logAiRequest('/api/ai/proactive-thoughts', access.companyId, startedAt, { insights: parsed?.insights?.length || 0 });
        return res.json({ insights: parsed.insights || [] });
      } catch (error) {
        console.error('Proactive thoughts JSON parse error:', error);
        logAiRequest('/api/ai/proactive-thoughts', access.companyId, startedAt, { parseError: true });
        return res.json({ insights: [] });
      }
    } catch (error: any) {
      console.error('[AI] /api/ai/proactive-thoughts error:', error.message || error);
      res.status(500).json({ error: error.message || 'AI request failed' });
    }
  });

  return app;
}
