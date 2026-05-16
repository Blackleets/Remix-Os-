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
import * as Sentry from '@sentry/node';
import { getOrderTotal, getOrderItems } from '../shared/orders.js';
import { formatInvoiceNumber } from '../shared/invoices.js';

// Backend error observability. No-op until SENTRY_DSN is set, so existing
// deploys are unaffected. captureBackendError is safe to call unconditionally.
let sentryInitialized = false;
function initBackendSentry() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn || sentryInitialized) return;
  try {
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: 0.1,
      sendDefaultPii: false,
    });
    sentryInitialized = true;
  } catch (err) {
    console.error('[Sentry] backend init failed (continuing without it):', err);
  }
}

function captureBackendError(error: unknown, context?: Record<string, unknown>) {
  if (!sentryInitialized) return;
  try {
    Sentry.captureException(error, context ? { extra: context } : undefined);
  } catch {
    /* telemetry must never throw into request handling */
  }
}

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
  customerRFMSummary?: {
    champions: number;
    loyal: number;
    atRisk: number;
    lost: number;
    promising: number;
    topAtRiskCustomers: Array<{ name: string; daysSinceLastOrder: number }>;
  };
  invoicesSummary?: {
    invoicesCount: number;
    issuedCount: number;
    paidCount: number;
    overdueCount: number;
    draftCount: number;
    unpaidInvoicesTotal: number;
    paidInvoicesTotal: number;
  };
}

type RFMTier = 'champion' | 'loyal' | 'at_risk' | 'lost' | 'promising' | 'new';

interface RFMResult {
  rfmTier: RFMTier;
  rfmScore: number;
  recencyScore: number;
  frequencyScore: number;
  monetaryScore: number;
  daysSinceLastOrder: number;
}

function computeRFMScores(
  orders: AnyRecord[],
  customerIds: string[],
  now: Date
): Map<string, RFMResult> {
  const ordersByCustomer = new Map<string, AnyRecord[]>();
  for (const id of customerIds) ordersByCustomer.set(id, []);
  for (const order of orders) {
    const cid = order.customerId || 'guest';
    if (ordersByCustomer.has(cid)) ordersByCustomer.get(cid)!.push(order);
  }

  const avgSpend = customerIds.length > 0
    ? orders.reduce((s, o) => s + getOrderTotal(o), 0) / Math.max(customerIds.length, 1)
    : 0;

  const results = new Map<string, RFMResult>();

  for (const cid of customerIds) {
    const custOrders = ordersByCustomer.get(cid) || [];
    const frequency = custOrders.length;
    const monetary = custOrders.reduce((s, o) => s + getOrderTotal(o), 0);

    let daysSinceLastOrder = 999;
    if (frequency > 0) {
      const lastOrderDate = custOrders
        .map(o => toDate(o.createdAt))
        .filter(Boolean)
        .sort((a, b) => b!.getTime() - a!.getTime())[0];
      if (lastOrderDate) {
        daysSinceLastOrder = Math.floor((now.getTime() - lastOrderDate.getTime()) / 86400000);
      }
    }

    // Recency score 1-5
    const rScore = daysSinceLastOrder <= 30 ? 5
      : daysSinceLastOrder <= 60 ? 4
      : daysSinceLastOrder <= 90 ? 3
      : daysSinceLastOrder <= 180 ? 2 : 1;

    // Frequency score 1-5
    const fScore = frequency >= 10 ? 5
      : frequency >= 6 ? 4
      : frequency >= 3 ? 3
      : frequency >= 2 ? 2 : 1;

    // Monetary score 1-5 (relative to avg spend per customer)
    const ratio = avgSpend > 0 ? monetary / avgSpend : 0;
    const mScore = ratio >= 3 ? 5 : ratio >= 2 ? 4 : ratio >= 1 ? 3 : ratio >= 0.5 ? 2 : 1;

    const rfmScore = rScore * 100 + fScore * 10 + mScore;

    let rfmTier: RFMTier;
    if (rScore >= 4 && fScore >= 4 && mScore >= 4) rfmTier = 'champion';
    else if (rScore >= 3 && fScore >= 3) rfmTier = 'loyal';
    else if (rScore <= 2 && fScore >= 3) rfmTier = 'at_risk';
    else if (rScore >= 4 && fScore <= 2) rfmTier = 'promising';
    else if (rScore <= 2) rfmTier = 'lost';
    else rfmTier = 'new';

    results.set(cid, { rfmTier, rfmScore, recencyScore: rScore, frequencyScore: fScore, monetaryScore: mScore, daysSinceLastOrder });
  }

  return results;
}

let adminDb: Firestore | null = null;
let stripe: Stripe | null = null;
let genai: GoogleGenAI | null = null;

function getFirebaseConfigPath() {
  return path.join(__dirname, '..', 'firebase-applet-config.json');
}

// In Vercel/serverless environments Application Default Credentials are unavailable.
// Without FIREBASE_SERVICE_ACCOUNT, verifyIdToken and Firestore reads fail at runtime —
// fail fast at init so /api/health and /api/ai/health surface the misconfiguration
// instead of every request returning a confusing 401/500.
function isServerlessRuntime() {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

function getDb() {
  if (!adminDb) {
    try {
      if (getApps().length === 0) {
        const svcAcct = process.env.FIREBASE_SERVICE_ACCOUNT;
        if (svcAcct) {
          initializeApp({ credential: cert(JSON.parse(svcAcct)) });
        } else if (isServerlessRuntime()) {
          console.error(
            '[Firebase Admin] FIREBASE_SERVICE_ACCOUNT is required in serverless runtime. ' +
              'Set the env var to the JSON.stringify(...) of your service account.'
          );
          return null;
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
        : process.env.FIREBASE_FIRESTORE_DATABASE_ID;
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

// Gemini returns RESOURCE_EXHAUSTED / 429 when the free-tier per-minute or
// per-day quota is hit. Map these to a clean 429 so the Copilot UI can show its
// existing "rate limited" toast instead of a confusing generic 500.
function isGeminiQuotaError(error: any): boolean {
  if (!error) return false;
  if (error.status === 429 || error.statusCode === 429 || error.code === 429) return true;
  const msg = String(error?.message || error || '');
  return msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota') || msg.includes('429');
}

// Distinct from our own per-minute limiter (AI_RATE_LIMIT): this is the
// upstream Gemini provider quota (per-minute OR daily). The frontend shows a
// different, honest message because "wait a few seconds" is wrong for a daily
// cap and makes Peppy look broken on first use.
function sendAiQuotaError(res: any, retryAfterSec = 30) {
  res.setHeader('Retry-After', String(retryAfterSec));
  return res.status(429).json({
    error: 'AI provider quota exceeded',
    code: 'AI_PROVIDER_QUOTA',
    details: 'Gemini upstream quota reached (per-minute or daily).',
    retryAfterSec,
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
    invoicesSummary: {
      invoicesCount: 0,
      issuedCount: 0,
      paidCount: 0,
      overdueCount: 0,
      draftCount: 0,
      unpaidInvoicesTotal: 0,
      paidInvoicesTotal: 0,
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
  // Surface Firebase Admin misconfiguration with a distinct 503 before any
  // token verification or DB call — otherwise users see "Invalid token" when
  // the real problem is a missing FIREBASE_SERVICE_ACCOUNT env var.
  if (!getDb()) {
    res.status(503).json({
      error: 'Firebase Admin not configured',
      code: 'FIREBASE_ADMIN_NOT_CONFIGURED',
      details: 'FIREBASE_SERVICE_ACCOUNT is missing in the current runtime. Set it in Vercel env and redeploy.',
    });
    return null;
  }

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
  if (!getDb()) {
    res.status(503).json({
      error: 'Firebase Admin not configured',
      code: 'FIREBASE_ADMIN_NOT_CONFIGURED',
      details: 'FIREBASE_SERVICE_ACCOUNT is missing in the current runtime. Set it in Vercel env and redeploy.',
    });
    return null;
  }

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

  const db = getDb()!;

  const adminSnap = await db.collection('platformAdmins').doc(decoded.uid).get();
  const adminData = adminSnap.data();
  if (!adminSnap.exists || adminData?.active !== true || adminData?.role !== 'super_admin') {
    res.status(403).json({ error: 'Forbidden' });
    return null;
  }

  return { uid: decoded.uid, email: decoded.email || '' };
}

async function requireAuthenticatedUser(req: any, res: any): Promise<{ uid: string; email: string } | null> {
  if (!getDb()) {
    res.status(503).json({
      error: 'Firebase Admin not configured',
      code: 'FIREBASE_ADMIN_NOT_CONFIGURED',
      details: 'FIREBASE_SERVICE_ACCOUNT is missing in the current runtime. Set it in Vercel env and redeploy.',
    });
    return null;
  }

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

  const [productsSnap, ordersSnap, customersSnap, remindersSnap, messagesSnap, activitiesSnap, invoicesSnap] = await Promise.all([
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
    // Invoices are optional — companies that pre-date the module simply
    // produce an empty aggregate. Never let this query block the overview.
    db.collection('invoices').where('companyId', '==', companyId).get().catch(() => ({
      docs: [] as any[],
      size: 0,
    })),
  ]);

  const now = new Date();
  const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const prev7Days = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const prev30Days = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  // Revenue/order metrics count only finalized orders. Keep this list aligned with
  // src/pages/Dashboard.tsx and src/pages/POS.tsx (both filter completed). If you add
  // a new terminal status, update the three call sites together.
  const REVENUE_STATUSES = new Set(['completed', 'paid', 'fulfilled']);
  const allOrders = ordersSnap.docs.map((entry) => ({ id: entry.id, ...entry.data() })) as AnyRecord[];
  const orders = allOrders.filter((order) => !order.status || REVENUE_STATUSES.has(order.status));
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

  // Commercial invoicing aggregates. Document statuses live in shared/invoices.ts:
  // draft | issued | sent | paid | overdue | cancelled. Unpaid = issued+sent+overdue.
  const invoicesDocs = (invoicesSnap as any).docs || [];
  let invoicesCount = 0;
  let issuedCount = 0;
  let paidCount = 0;
  let overdueCount = 0;
  let draftCount = 0;
  let unpaidInvoicesTotal = 0;
  let paidInvoicesTotal = 0;
  for (const entry of invoicesDocs) {
    const data = (entry && typeof entry.data === 'function') ? entry.data() : entry?.data || {};
    if (!data || data.status === 'cancelled') continue;
    invoicesCount += 1;
    const total = Number(data.total) || 0;
    const amountDue = Number(data.amountDue);
    const dueValue = Number.isFinite(amountDue) ? amountDue : total;
    switch (data.status) {
      case 'draft':
        draftCount += 1;
        break;
      case 'issued':
        issuedCount += 1;
        unpaidInvoicesTotal += dueValue;
        break;
      case 'sent':
        issuedCount += 1;
        unpaidInvoicesTotal += dueValue;
        break;
      case 'overdue':
        overdueCount += 1;
        unpaidInvoicesTotal += dueValue;
        break;
      case 'paid':
        paidCount += 1;
        paidInvoicesTotal += total;
        break;
      default:
        break;
    }
  }
  const invoicesSummary = {
    invoicesCount,
    issuedCount,
    paidCount,
    overdueCount,
    draftCount,
    unpaidInvoicesTotal: Math.round(unpaidInvoicesTotal * 100) / 100,
    paidInvoicesTotal: Math.round(paidInvoicesTotal * 100) / 100,
  };

  const onboardingChecklist = {
    profile: true,
    product: productsSnap.size > 0,
    customer: customersSnap.size > 0,
    order: ordersSnap.size > 0,
  };
  const onboardingCompleted = Object.values(onboardingChecklist).every(Boolean);

  const customerIds = customersSnap.docs.map(d => d.id);
  const rfmMap = computeRFMScores(orders, customerIds, now);

  const rfmEntries = [...rfmMap.entries()];
  const rfmSummary = {
    champions: rfmEntries.filter(([, r]) => r.rfmTier === 'champion').length,
    loyal: rfmEntries.filter(([, r]) => r.rfmTier === 'loyal').length,
    atRisk: rfmEntries.filter(([, r]) => r.rfmTier === 'at_risk').length,
    lost: rfmEntries.filter(([, r]) => r.rfmTier === 'lost').length,
    promising: rfmEntries.filter(([, r]) => r.rfmTier === 'promising').length,
    topAtRiskCustomers: rfmEntries
      .filter(([, r]) => r.rfmTier === 'at_risk')
      .sort(([, a], [, b]) => b.daysSinceLastOrder - a.daysSinceLastOrder)
      .slice(0, 3)
      .map(([cid, r]) => {
        const cdata = customersSnap.docs.find(d => d.id === cid)?.data() || {};
        return { name: cdata.name || 'Unknown', daysSinceLastOrder: r.daysSinceLastOrder };
      }),
  };

  // Background batch-write RFM scores to customer documents (fire-and-forget)
  Promise.resolve().then(async () => {
    try {
      const chunks: Array<[string, RFMResult][]> = [];
      for (let i = 0; i < rfmEntries.length; i += 490) chunks.push(rfmEntries.slice(i, i + 490));
      for (const chunk of chunks) {
        const batch = db.batch();
        for (const [cid, r] of chunk) {
          batch.update(db.collection('customers').doc(cid), {
            rfmTier: r.rfmTier,
            rfmScore: r.rfmScore,
            rfmUpdatedAt: FieldValue.serverTimestamp(),
          });
        }
        await batch.commit();
      }
    } catch (e) {
      // RFM batch update is best-effort; don't block the response
    }
  });

  return {
    companyId,
    companyName: company.name || 'Unknown company',
    industry: company.industry || 'General',
    onboardingCompleted,
    planId: getPlanDefinition(company.subscription?.planId).id,
    customersCount: customersSnap.size,
    productsCount: productsSnap.size,
    ordersCount: orders.length,
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
    customerRFMSummary: rfmSummary,
    invoicesSummary,
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
      internalTesting: Boolean(company.internalTesting),
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

// In-memory rate limiter for AI endpoints. Keyed by companyId since billing
// happens at the tenant level. Migrate to Upstash Redis in Fase 4 when multi-instance
// scaling makes the in-memory counter inconsistent across Vercel cold starts.
const AI_RATE_WINDOW_MS = 60 * 1000;
const AI_RATE_LIMIT_PER_WINDOW = 30;
const aiRateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

function checkAiRateLimit(companyId: string): { allowed: boolean; retryAfterSec: number; remaining: number } {
  const now = Date.now();
  const bucket = aiRateLimitBuckets.get(companyId);
  if (!bucket || bucket.resetAt <= now) {
    aiRateLimitBuckets.set(companyId, { count: 1, resetAt: now + AI_RATE_WINDOW_MS });
    return { allowed: true, retryAfterSec: 0, remaining: AI_RATE_LIMIT_PER_WINDOW - 1 };
  }
  if (bucket.count >= AI_RATE_LIMIT_PER_WINDOW) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
      remaining: 0,
    };
  }
  bucket.count += 1;
  return { allowed: true, retryAfterSec: 0, remaining: AI_RATE_LIMIT_PER_WINDOW - bucket.count };
}

function enforceAiRateLimit(req: any, res: any): boolean {
  const companyId = typeof req.body?.companyId === 'string' ? req.body.companyId : null;
  if (!companyId) return true; // Defer to requireCompanyAccess, which will 400.
  const result = checkAiRateLimit(companyId);
  if (!result.allowed) {
    res.setHeader('Retry-After', String(result.retryAfterSec));
    res.status(429).json({
      error: 'AI rate limit exceeded',
      code: 'AI_RATE_LIMIT',
      details: `Too many AI requests for this company. Retry in ${result.retryAfterSec}s.`,
      retryAfterSec: result.retryAfterSec,
    });
    return false;
  }
  return true;
}

export function createApp() {
  initBackendSentry();
  const app = express();

  app.use((req, res, next) => {
    if (req.originalUrl === '/api/billing/webhook') {
      return next();
    }
    return express.json()(req, res, next);
  });

  app.get('/api/health', (_req, res) => {
    const db = getDb();
    const firebaseAdminReady = Boolean(db);
    const serviceAccountPresent = Boolean(process.env.FIREBASE_SERVICE_ACCOUNT);
    const status = firebaseAdminReady ? 'ok' : 'degraded';
    res.status(firebaseAdminReady ? 200 : 503).json({
      status,
      firebaseAdminReady,
      serviceAccountPresent,
      vercelEnv: process.env.VERCEL_ENV || null,
      time: new Date().toISOString(),
    });
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
      captureBackendError(error, { route: '/api/company/overview' });
      res.status(500).json({ error: error.message || 'Failed to load company overview' });
    }
  });

  // Issue an invoice with monotonic numbering. Runs the counter increment +
  // invoice promotion inside a single firestore transaction so concurrent
  // issuers in the same company can never collide. Idempotent: re-issuing
  // an already-issued invoice returns the existing number instead of
  // burning a new one.
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
        // Mock sessions are a dev/staging-only convenience. Block them in any
        // production runtime regardless of whether STRIPE_SECRET_KEY is set,
        // so a missing or corrupt key cannot silently enable free plan upgrades.
        const isProductionRuntime =
          process.env.VERCEL_ENV === 'production' ||
          process.env.NODE_ENV === 'production';
        if (isProductionRuntime || getStripe()) {
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

    // Idempotency: Stripe retries deliveries for up to ~3 days. Claim the
    // event id atomically (.create throws ALREADY_EXISTS if the lock doc is
    // already there) so a retry never double-processes — which would create
    // duplicate audit logs and double any future side-effects. If processing
    // then fails we delete the lock so Stripe's retry can reprocess cleanly.
    // The TTL field lets a Firestore TTL policy on `expiresAt` garbage-collect
    // old locks (configure once in the Firebase console).
    const eventLockRef = db.collection('processedStripeEvents').doc(event.id);
    try {
      await eventLockRef.create({
        type: event.type,
        receivedAt: FieldValue.serverTimestamp(),
        expiresAt: Timestamp.fromMillis(Date.now() + 35 * 24 * 60 * 60 * 1000),
      });
    } catch (lockErr: any) {
      if (lockErr?.code === 6 || /already exists/i.test(lockErr?.message || '')) {
        console.info('[Stripe] Duplicate webhook ignored', { eventId: event.id, type: event.type });
        return res.json({ received: true, duplicate: true });
      }
      throw lockErr;
    }

    try {
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
    } catch (processErr: any) {
      // Processing failed — release the idempotency lock so Stripe's retry
      // can have another go instead of being silently skipped forever.
      try {
        await eventLockRef.delete();
      } catch {
        /* best-effort rollback */
      }
      console.error('[Stripe] Webhook processing failed, lock released for retry', {
        eventId: event.id,
        type: event.type,
        error: processErr?.message || processErr,
      });
      captureBackendError(processErr, {
        route: '/api/billing/webhook',
        eventId: event.id,
        eventType: event.type,
      });
      return res.status(500).json({ error: 'Webhook processing failed' });
    }

    res.json({ received: true });
  });

  app.post('/api/ai/insights', async (req, res) => {
    const startedAt = Date.now();
    try {
      if (!enforceAiRateLimit(req, res)) return;
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
Top Customers: ${JSON.stringify(overview.topCustomers || [])}${
  (overview.invoicesSummary?.invoicesCount || 0) > 0
    ? `
Invoicing: ${overview.invoicesSummary!.invoicesCount} documents · unpaid $${overview.invoicesSummary!.unpaidInvoicesTotal.toFixed(2)} · overdue ${overview.invoicesSummary!.overdueCount}`
    : ''
}

Constraint based on Plan:
- starter: basic observations and straightforward advice.
- pro: deeper analysis, subtle patterns and market opportunities.
- business: highly strategic, predictive forecasting and growth blueprints.

Return ONLY a valid JSON array of insight objects. Each must have:
- title (string), explanation (1-2 sentences), type ("opportunity"|"risk"|"efficiency"|"growth"),
- severity ("info"|"success"|"warning"|"critical"), recommendation (1 specific next action).
No markdown, no preamble.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
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
      if (isGeminiQuotaError(error)) return sendAiQuotaError(res);
      res.status(500).json({ error: error.message || 'AI request failed' });
    }
  });

  function buildPeppySystemInstruction(ctx: CompanyOverview, language: string, userRole: string): string {
    const langMap: Record<string, string> = {
      en: 'Communicate in English.',
      es: 'Comunícate en Español. Mantén un tono profesional y premium.',
      pt: 'Comunique-se em Português. Mantenha um tom profissional e premium.',
    };
    const langInstruction = langMap[language] || langMap.en;
    const rfm = ctx.customerRFMSummary;
    const rfmBlock = rfm ? `
CUSTOMER INTELLIGENCE (RFM Analysis):
- Champions: ${rfm.champions} customers (high value, recent, frequent)
- Loyal: ${rfm.loyal} customers (consistent buyers)
- At Risk: ${rfm.atRisk} customers (were frequent, now absent)
- Promising: ${rfm.promising} new high-potential customers
- Lost: ${rfm.lost} customers (inactive)${rfm.topAtRiskCustomers.length > 0 ? `
- Top At-Risk: ${rfm.topAtRiskCustomers.map(c => `${c.name} (${c.daysSinceLastOrder}d inactive)`).join(', ')}` : ''}` : '';

    return `You are Peppy, the dedicated AI copilot for Remix OS.
Personality: direct, warm, data-focused, occasionally witty — never corporate speak.
Celebrate wins, flag risks with urgency, always end with a clear next action.
Sign your greeting with your name on the first message only.

CRITICAL: ${langInstruction}

SYSTEM STATUS:
- Company: ${ctx.companyName} (${ctx.industry})
- Onboarding: ${ctx.onboardingCompleted ? 'COMPLETED' : 'IN PROGRESS'}
- User Role: ${userRole}

BUSINESS TELEMETRY:
- 30-Day Revenue: $${Number(ctx.recentRevenue30d ?? ctx.recentRevenue ?? 0).toFixed(2)} (growth: ${ctx.growth?.toFixed(1) ?? 0}%)
- Sales Trend: ${ctx.salesVelocity?.currentPeriodOrders || 0} orders this week (${ctx.salesVelocity?.trend || 'flat'} vs last week)
- Inventory Risk: ${ctx.lowStockCount || 0} items below threshold.
- Engagement: ${ctx.pendingReminders?.length || 0} urgent follow-ups pending.
${rfmBlock}
OPERATIONAL PRINCIPLES:
1. OPERATIONAL FOCUS: Avoid conversational filler. Provide high-impact data analysis first.
2. INDUSTRY CONTEXT: Calibrate terminology to "${ctx.industry}".
3. PROACTIVE ADVICE: Prioritize critical risks and suggest specific drafted actions.
4. CUSTOMER ENGAGEMENT: Use RFM data to identify at-risk customers; suggest win-back actions.
5. SECURITY PROTOCOL: Respect user roles. Never suggest actions beyond the user's role.
6. PERSONALITY: Use phrases like "Let's unpack that:", "Here's the signal:", "Action window:" to maintain your distinct voice as Peppy.

COMMAND PROTOCOLS (MUST appear at the END of the response, on their own line):
- [COMMAND: NAVIGATE | /path] - ONLY for changing screens. Valid paths: /dashboard, /customers, /products, /inventory, /orders, /pos, /insights, /team, /settings, /billing.
- [COMMAND: OPEN_FILTER | module | payload] - For complex data views.
- [COMMAND: DRAFT_REPORT | summary] - When generating an analysis or report.
- [COMMAND: REVIEW_ONLY | summary] - For complex advice without automated path.
- [COMMAND: DRAFT_ORDER | details] - For preparing new orders.
- [COMMAND: CREATE_REMINDER | customerId | customerName | follow_up | notes | YYYY-MM-DD] - Create a customer reminder. Use when user asks to follow up with a specific customer.
- [COMMAND: DRAFT_MESSAGE | customerId | customerName | email | message content] - Draft a customer message for review. Use when user asks to contact a customer.
- [COMMAND: FLAG_CUSTOMER | customerId | whale|vip|regular|new|at_risk] - Update customer segment. Use when user identifies a customer's value tier.
- [COMMAND: STOCK_ALERT | productId | productName | threshold] - Set a stock alert threshold for a product.

CRITICAL RULES:
1. NEVER put long markdown reports inside [COMMAND: NAVIGATE].
2. Use CREATE_REMINDER when user says "follow up with", "remind me about", or "call [customer]".
3. Use DRAFT_MESSAGE when user wants to send or write to a customer.
4. Use FLAG_CUSTOMER when a customer's behavior warrants reclassification.
5. For DRAFT_MESSAGE, always set isReviewOnly so the user must confirm before sending.

STRUCTURE: Use SUMMARY, STATUS REPORT, RECOMMENDATIONS, and [COMMANDS].`;
  }

  function parseCommandFromText(text: string, userMessage: string): { type: string; params: string } | null {
    const userTriedToInject = /\[COMMAND:/i.test(userMessage);
    if (userTriedToInject) return null;
    const match = text.match(/\[COMMAND:\s*([^|\]\n]+)\s*\|\s*([^\]]+)\]\s*$/);
    if (!match) return null;
    return { type: match[1].trim(), params: match[2].trim() };
  }

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
      if (!enforceAiRateLimit(req, res)) return;
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
      const systemInstruction = buildPeppySystemInstruction(ctx, language || 'en', req.body?.context?.userRole || 'staff');

      const chat = ai.chats.create({
        model: 'gemini-2.5-flash',
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

      if (isGeminiQuotaError(error)) return sendAiQuotaError(res);
      res.status(500).json({ error: error.message || 'AI request failed' });
    }
  });

  app.post('/api/ai/chat/stream', async (req, res) => {
    try {
      if (!enforceAiRateLimit(req, res)) return;
      const access = await requireCompanyAccess(req, res, ['owner', 'admin', 'staff', 'viewer']);
      if (!access) return;
      const ai = getGenAI();
      if (!ai) return sendAiConfigError(res);
      const { message, history, language } = req.body || {};
      if (typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({ error: 'message required' });
      }
      const db = getDb();
      if (!db) throw new Error('Database not initialized');
      const ctx = req.body?.context || await buildCompanyOverview(db, access.companyId);
      const systemInstruction = buildPeppySystemInstruction(ctx, language || 'en', req.body?.context?.userRole || 'staff');

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();

      let disconnected = false;
      req.on('close', () => { disconnected = true; });

      const chat = ai.chats.create({
        model: 'gemini-2.5-flash',
        history: Array.isArray(history) ? history : [],
        config: { systemInstruction },
      });

      let accumulated = '';
      try {
        const stream = await chat.sendMessageStream({ message });
        for await (const chunk of stream) {
          if (disconnected || res.writableEnded) break;
          const text = chunk.text ?? '';
          accumulated += text;
          res.write(`data: ${JSON.stringify({ text })}\n\n`);
        }
      } catch (streamErr: any) {
        const errorMsg = isGeminiQuotaError(streamErr)
          ? 'AI quota exceeded. Please retry shortly.'
          : streamErr.message || 'Stream failed';
        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify({ error: errorMsg })}\n\n`);
        }
      }

      if (!res.writableEnded) {
        const command = parseCommandFromText(accumulated, message);
        res.write(`data: ${JSON.stringify({ done: true, command })}\n\n`);
        res.end();
      }
    } catch (error: any) {
      console.error('/api/ai/chat/stream error:', error);
      if (!res.headersSent) {
        if (isGeminiQuotaError(error)) return sendAiQuotaError(res);
        res.status(500).json({ error: error.message || 'Stream failed' });
      }
      else if (!res.writableEnded) res.end();
    }
  });

  app.post('/api/ai/proactive-thoughts', async (req, res) => {
    const startedAt = Date.now();
    try {
      if (!enforceAiRateLimit(req, res)) return;
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

      const hasOperationalData =
        Number(context.productsCount || 0) > 0 ||
        Number(context.customersCount || 0) > 0 ||
        Number(context.ordersCount || 0) > 0 ||
        Number(context.inventoryValue || 0) > 0;

      const tonePalette = [
        'curious analyst',
        'pragmatic operator',
        'pattern hunter',
        'risk sentinel',
        'growth strategist',
        'efficiency auditor',
      ];
      const toneSeed = tonePalette[new Date().getUTCMinutes() % tonePalette.length];

      const prompt = hasOperationalData
        ? `You are Peppy, the Remix OS AI copilot — a ${toneSeed} watching this business in real-time.

Generate exactly ONE short, alive, conversational thought (one sentence, 12-24 words) about what's happening right now in this business. Sound human, not robotic. Pick something specific to react to, not a generic summary.

VOICE RULES:
- Speak in first-person observation ("I'm noticing...", "There's a pattern...", "Heads up:").
- Reference a concrete number, product name, or customer if you can.
- Vary between observation, alert, suggestion, and question. Don't always be alarmist.
- Skip preambles like "As your AI...". Just say the thing.

CRITICAL: ${langInstruction}

LIVE STATE:
- Company: ${context.companyName} (${context.industry || 'general'})
- Customers: ${context.customersCount} · Products: ${context.productsCount} · Orders: ${context.ordersCount || 0}
- 30-day revenue: $${Number(context.recentRevenue30d ?? context.recentRevenue ?? 0).toFixed(2)} (growth ${Number(context.growth || 0).toFixed(1)}%)
- This-week orders: ${context.salesVelocity?.currentPeriodOrders || 0} (trend: ${context.salesVelocity?.trend || 'flat'})
- Low stock items: ${context.lowStockCount}${
  (context.invoicesSummary?.invoicesCount || 0) > 0
    ? `
- Invoicing: $${context.invoicesSummary!.unpaidInvoicesTotal.toFixed(2)} unpaid across ${context.invoicesSummary!.issuedCount + context.invoicesSummary!.overdueCount} open invoices${context.invoicesSummary!.overdueCount > 0 ? ` (${context.invoicesSummary!.overdueCount} overdue)` : ''}`
    : ''
}

TOP PRODUCTS: ${(context.topProducts?.slice(0, 3) || []).map((p: AnyRecord) => `${p.name} (${p.quantity})`).join(', ') || 'none yet'}
TOP CUSTOMERS: ${(context.topCustomers?.slice(0, 3) || []).map((c: AnyRecord) => `${c.name} ($${c.total})`).join(', ') || 'none yet'}
LOW STOCK: ${(context.inventoryStatus?.slice(0, 3) || []).map((p: AnyRecord) => `${p.name} (${p.stock})`).join(', ') || 'all healthy'}
RECENT ACTIVITY: ${(context.recentActivities?.slice(0, 3) || []).map((a: AnyRecord) => a.title || a.type).join(' · ') || 'quiet so far'}

Return ONLY this JSON, nothing else:
{ "insights": [ { "text": "your single thought", "priority": "high"|"medium"|"low" } ] }`
        : `You are Peppy, the Remix OS AI copilot — welcoming a brand-new business that just signed up.

The user just created ${context.companyName} (${context.industry || 'general'}). They have ZERO data yet (no products, customers, or orders). Don't pretend there are insights to extract.

Generate exactly ONE short, warm, helpful nudge (one sentence, 12-24 words) that suggests a concrete first step. Examples of tone:
- "Let's get a first product on the shelves — it unlocks the inventory radar."
- "Add a few customers and I'll start watching for loyalty patterns."
- "Run your first order in POS and I can begin tracking revenue trends."

Vary the suggestion each time you're called — alternate between products, customers, orders, settings.

VOICE RULES:
- First-person and friendly, not robotic.
- Skip preambles. Just say the thing.

CRITICAL: ${langInstruction}

Return ONLY this JSON:
{ "insights": [ { "text": "your single nudge", "priority": "low" } ] }`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
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
      if (isGeminiQuotaError(error)) return sendAiQuotaError(res);
      res.status(500).json({ error: error.message || 'AI request failed' });
    }
  });

  app.post('/api/ai/conversation/load', async (req, res) => {
    try {
      const access = await requireCompanyAccess(req, res, ['owner', 'admin', 'staff', 'viewer']);
      if (!access) return;
      const db = getDb();
      if (!db) throw new Error('Database not initialized');
      const docId = `${access.companyId}_${access.uid}_peppy`;
      const snap = await db.collection('agentConversations').doc(docId).get();
      const messages = snap.exists ? (snap.data()?.messages || []) : [];
      res.json({ messages });
    } catch (error: any) {
      console.error('/api/ai/conversation/load error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/ai/conversation/save', async (req, res) => {
    try {
      const access = await requireCompanyAccess(req, res, ['owner', 'admin', 'staff', 'viewer']);
      if (!access) return;
      const db = getDb();
      if (!db) throw new Error('Database not initialized');
      const { messages } = req.body || {};
      if (!Array.isArray(messages)) return res.status(400).json({ error: 'messages array required' });

      const sanitized = messages
        .filter((m: AnyRecord) => !m.streaming && m.role && m.text !== undefined)
        .slice(-60)
        .map((m: AnyRecord) => ({
          id: m.id,
          role: m.role,
          text: String(m.text || '').slice(0, 8000),
          timestamp: m.timestamp || new Date().toISOString(),
          isBriefing: m.isBriefing || false,
          commandStatus: m.commandStatus || null,
        }));

      const docId = `${access.companyId}_${access.uid}_peppy`;
      await db.collection('agentConversations').doc(docId).set({
        companyId: access.companyId,
        userId: access.uid,
        agentName: 'peppy',
        messages: sanitized,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      res.json({ status: 'saved', count: sanitized.length });
    } catch (error: any) {
      console.error('/api/ai/conversation/save error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/ai/action', async (req, res) => {
    try {
      const access = await requireCompanyAccess(req, res, ['owner', 'admin', 'staff']);
      if (!access) return;
      const db = getDb();
      if (!db) throw new Error('Database not initialized');

      const { commandType, params } = req.body || {};
      if (!commandType || typeof params !== 'string') {
        return res.status(400).json({ error: 'commandType and params required' });
      }

      const parts = params.split('|').map((s: string) => s.trim());

      if (commandType === 'CREATE_REMINDER') {
        const [customerId, customerName, type, notes, dueDateStr] = parts;
        if (!customerId || !customerName) return res.status(400).json({ error: 'Missing reminder params' });
        const customerDoc = await db.collection('customers').doc(customerId).get();
        if (!customerDoc.exists || customerDoc.data()?.companyId !== access.companyId) {
          return res.status(403).json({ error: 'Customer not found in this company' });
        }
        const dueDate = dueDateStr ? new Date(dueDateStr) : new Date(Date.now() + 86400000 * 3);
        const ref = await db.collection('reminders').add({
          companyId: access.companyId,
          customerId,
          customerName,
          type: type || 'follow_up',
          notes: notes || '',
          dueDate: Timestamp.fromDate(dueDate),
          status: 'pending',
          createdBy: 'peppy',
          createdAt: FieldValue.serverTimestamp(),
        });
        return res.json({ status: 'success', actionId: ref.id });
      }

      if (commandType === 'DRAFT_MESSAGE') {
        const [customerId, customerName, channel, ...contentParts] = parts;
        const content = contentParts.join(' | ');
        if (!customerId || !content) return res.status(400).json({ error: 'Missing message params' });
        const customerDoc = await db.collection('customers').doc(customerId).get();
        if (!customerDoc.exists || customerDoc.data()?.companyId !== access.companyId) {
          return res.status(403).json({ error: 'Customer not found in this company' });
        }
        const ref = await db.collection('customerMessages').add({
          companyId: access.companyId,
          customerId,
          customerName: customerName || '',
          content,
          channel: channel || 'email',
          status: 'draft',
          createdBy: 'peppy',
          createdAt: FieldValue.serverTimestamp(),
        });
        return res.json({ status: 'success', actionId: ref.id });
      }

      if (commandType === 'FLAG_CUSTOMER') {
        const [customerId, segment] = parts;
        const validSegments = ['whale', 'vip', 'regular', 'new', 'at_risk'];
        if (!customerId || !validSegments.includes(segment)) {
          return res.status(400).json({ error: 'Invalid customer or segment' });
        }
        const customerDoc = await db.collection('customers').doc(customerId).get();
        if (!customerDoc.exists || customerDoc.data()?.companyId !== access.companyId) {
          return res.status(403).json({ error: 'Customer not found in this company' });
        }
        await db.collection('customers').doc(customerId).update({ segment, updatedAt: FieldValue.serverTimestamp() });
        return res.json({ status: 'success', actionId: customerId });
      }

      if (commandType === 'STOCK_ALERT') {
        const [productId, productName, thresholdStr] = parts;
        if (!productId || !productName) return res.status(400).json({ error: 'Missing stock alert params' });
        const ref = await db.collection('stockAlerts').add({
          companyId: access.companyId,
          productId,
          productName,
          threshold: Number(thresholdStr) || 5,
          status: 'active',
          createdBy: 'peppy',
          createdAt: FieldValue.serverTimestamp(),
        });
        return res.json({ status: 'success', actionId: ref.id });
      }

      return res.status(400).json({ error: `Unknown commandType: ${commandType}` });
    } catch (error: any) {
      console.error('/api/ai/action error:', error);
      res.status(500).json({ error: error.message || 'Action failed' });
    }
  });

  app.post('/api/ai/daily-briefing', async (req, res) => {
    if (!enforceAiRateLimit(req, res)) return;
    const startedAt = Date.now();
    try {
      const access = await requireCompanyAccess(req, res, ['owner', 'admin']);
      if (!access) return;
      const ai = getGenAI();
      if (!ai) return res.status(503).json({ error: 'AI not configured' });

      const db = getDb();
      if (!db) throw new Error('Database not initialized');
      const ctx = await buildCompanyOverview(db, access.companyId);
      const language = req.body?.language || 'es';
      const langMap: Record<string, string> = {
        en: 'Write the briefing in English.',
        es: 'Escribe el briefing en Español.',
        pt: 'Escreva o briefing em Português.',
      };
      const langInstruction = langMap[language] || langMap.es;
      const greetingMap: Record<string, string> = {
        en: `## Good morning, ${ctx.companyName}`,
        es: `## Buenos días, ${ctx.companyName}`,
        pt: `## Bom dia, ${ctx.companyName}`,
      };
      const greeting = greetingMap[language] || greetingMap.es;

      const prompt = `You are Peppy, the Remix OS AI copilot delivering a morning operational briefing.
${langInstruction}

Be concise: 4-6 bullet points maximum. Lead with the most critical signal.
Cover: revenue snapshot (30d and trend), any at-risk customers needing attention, inventory pressure, and sales velocity.
End with ONE specific recommended action for today.
Start with exactly: "${greeting}"
Use Markdown formatting with bullet points.

CURRENT BUSINESS DATA:
- 30-Day Revenue: $${Number(ctx.recentRevenue30d ?? ctx.recentRevenue ?? 0).toFixed(2)} (growth: ${ctx.growth?.toFixed(1) ?? 0}%)
- Sales Trend: ${ctx.salesVelocity?.currentPeriodOrders || 0} orders this week vs ${ctx.salesVelocity?.previousPeriodOrders || 0} last week (${ctx.salesVelocity?.trend || 'flat'})
- Low Stock Items: ${ctx.lowStockCount || 0}
- Pending Follow-ups: ${ctx.pendingReminders?.length || 0}
- Total Customers: ${ctx.customersCount}
- Top Products: ${(ctx.topProducts?.slice(0, 3) || []).map((p: AnyRecord) => `${p.name} ($${p.revenue})`).join(', ') || 'No data'}
- Top Customers: ${(ctx.topCustomers?.slice(0, 3) || []).map((c: AnyRecord) => `${c.name} ($${c.total})`).join(', ') || 'No data'}${
  (ctx.invoicesSummary?.invoicesCount || 0) > 0
    ? `
- Invoicing: $${ctx.invoicesSummary!.unpaidInvoicesTotal.toFixed(2)} pending · ${ctx.invoicesSummary!.overdueCount} overdue invoices`
    : ''
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });
      const briefing = response.text ?? '';
      logAiRequest('/api/ai/daily-briefing', access.companyId, startedAt, { briefingLength: briefing.length });
      res.json({ briefing, generatedAt: new Date().toISOString() });
    } catch (error: any) {
      console.error('/api/ai/daily-briefing error:', error);
      res.status(500).json({ error: error.message || 'Briefing generation failed' });
    }
  });

  // ── Invoice issuing (server-side transaction) ─────────────────────────────
  app.post('/api/invoices/issue', async (req, res) => {
    console.info('[Invoices] issue request received');
    try {
      const access = await requireCompanyAccess(req, res, ['owner', 'admin', 'staff']);
      if (!access) return;
      console.info('[Invoices] access granted', { companyId: access.companyId });

      const { invoiceId } = req.body;
      if (typeof invoiceId !== 'string' || !invoiceId) {
        return res.status(400).json({ error: 'invoiceId requerido', code: 'MISSING_INVOICE_ID' });
      }

      const db = getDb();
      if (!db) throw new Error('Database not initialized');

      const result = await db.runTransaction(async (tx) => {
        const invRef = db.collection('invoices').doc(invoiceId);
        const invSnap = await tx.get(invRef);
        if (!invSnap.exists) {
          return { status: 404 as const, error: 'Invoice not found' };
        }
        const invoice = invSnap.data() || {};

        if (invoice.companyId !== access.companyId) {
          return { status: 403 as const, error: 'Invoice belongs to a different company' };
        }

        console.info('[Invoices] invoice loaded', {
          companyId: access.companyId,
          invoiceId,
          status: invoice.status,
          series: invoice.series || 'A',
        });

        // Idempotency: already issued — return existing data, no second numbering.
        if (invoice.status && invoice.status !== 'draft') {
          console.info('[Invoices] already issued', {
            companyId: access.companyId,
            invoiceId,
            invoiceNumber: invoice.invoiceNumber || '',
            sequentialNumber: invoice.sequentialNumber || 0,
          });
          return {
            status: 200 as const,
            invoiceNumber: invoice.invoiceNumber || '',
            sequentialNumber: invoice.sequentialNumber || 0,
            alreadyIssued: true,
          };
        }

        const series = String(invoice.series || 'A').toUpperCase();
        const counterRef = db.collection('invoiceCounters').doc(`${access.companyId}_${series}`);
        const counterSnap = await tx.get(counterRef);
        const current = counterSnap.exists ? Number(counterSnap.data()?.nextNumber || 1) : 1;
        const invoiceNumber = formatInvoiceNumber(series, current);

        tx.set(counterRef, {
          companyId: access.companyId,
          series,
          nextNumber: current + 1,
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });

        tx.update(invRef, {
          status: 'issued',
          invoiceNumber,
          sequentialNumber: current,
          issuedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });

        console.info('[Invoices] issued', {
          companyId: access.companyId,
          invoiceId,
          invoiceNumber,
          sequentialNumber: current,
        });

        return {
          status: 200 as const,
          invoiceNumber,
          sequentialNumber: current,
          alreadyIssued: false,
        };
      });

      if (result.status !== 200) {
        return res.status(result.status).json({ error: result.error });
      }
      res.json({
        invoiceNumber: result.invoiceNumber,
        sequentialNumber: result.sequentialNumber,
        alreadyIssued: result.alreadyIssued,
      });
    } catch (error: any) {
      console.error('[Invoices] failed', { message: error?.message || String(error) });
      captureBackendError(error, { route: '/api/invoices/issue' });
      res.status(500).json({ error: error?.message || 'Failed to issue invoice' });
    }
  });

  // ── Platform admin: company internal-testing override ─────────────────────
  app.post('/api/platform/company/override', async (req, res) => {
    try {
      const access = await requirePlatformAdmin(req, res);
      if (!access) return;

      const { companyId, internalTesting } = req.body;
      if (typeof companyId !== 'string' || !companyId) {
        return res.status(400).json({ error: 'companyId (string) requerido', code: 'MISSING_COMPANY_ID' });
      }
      if (typeof internalTesting !== 'boolean') {
        return res.status(400).json({ error: 'internalTesting (boolean) requerido', code: 'MISSING_INTERNAL_TESTING' });
      }

      const db = getDb();
      if (!db) throw new Error('Database not initialized');

      const companyRef = db.collection('companies').doc(companyId);
      const companySnap = await companyRef.get();
      if (!companySnap.exists) {
        return res.status(404).json({ error: 'Empresa no encontrada', code: 'COMPANY_NOT_FOUND' });
      }

      await companyRef.update({
        internalTesting,
        updatedAt: FieldValue.serverTimestamp(),
      });
      await db.collection('platformAuditLogs').add({
        type: 'internal_testing_toggled',
        companyId,
        value: internalTesting,
        actorUid: access.uid,
        createdAt: FieldValue.serverTimestamp(),
      });
      res.json({ ok: true, companyId, internalTesting });
    } catch (err: any) {
      console.error('[Override] /api/platform/company/override failed:', err?.message || err);
      res.status(500).json({ error: 'No se pudo actualizar el modo interno.', code: 'OVERRIDE_FAILED' });
    }
  });

  return app;
}
