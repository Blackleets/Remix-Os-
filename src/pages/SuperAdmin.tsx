import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Building2,
  CreditCard,
  DollarSign,
  Flame,
  LifeBuoy,
  Layers3,
  Loader2,
  Radar,
  RefreshCcw,
  Save,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { addDoc, collection, doc, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc } from 'firebase/firestore';
import type { ComponentType } from 'react';
import { SuperAdminFeedbackCenter } from '../components/super-admin/FeedbackCenter';
import { Button, Card, cn, Input, Label } from '../components/Common';
import { auth, db } from '../lib/firebase';
import { useLocale } from '../hooks/useLocale';
import { usePlatformAdmin } from '../hooks/usePlatformAdmin';
import { fetchPlatformOverview, fetchPlatformSupportView, syncPlatformBilling, syncPlatformStats } from '../services/companyApi';

interface CompanyDoc {
  id: string;
  name?: string;
  ownerId?: string;
  industry?: string;
  stripeCustomerId?: string;
  createdAt?: any;
  onboardingState?: {
    isComplete?: boolean;
    step?: number;
    checklist?: {
      profile?: boolean;
      product?: boolean;
      customer?: boolean;
      order?: boolean;
    };
  };
  subscription?: {
    planId?: 'starter' | 'pro' | 'business';
    status?: 'active' | 'past_due' | 'trialing' | 'canceled';
    currentPeriodEnd?: any;
    trialEndsAt?: any;
  };
}

interface UserDoc {
  id: string;
  email?: string;
  displayName?: string;
  currentCompanyId?: string;
  createdAt?: any;
}

interface MembershipDoc {
  id: string;
  userId: string;
  companyId: string;
  role: 'owner' | 'admin' | 'staff' | 'viewer';
}

interface ProductDoc {
  id: string;
  companyId: string;
}

interface CustomerDoc {
  id: string;
  companyId: string;
}

interface OrderDoc {
  id: string;
  companyId: string;
  total?: number;
  totalAmount?: number;
  status?: string;
  createdAt?: any;
}

interface PlatformMetrics {
  totalCompanies: number;
  totalUsers: number;
  totalProducts: number;
  totalCustomers: number;
  activeCompanies: number;
  trialCompanies: number;
  expiredOrPastDueCompanies: number;
  starterPlans: number;
  proPlans: number;
  businessPlans: number;
  estimatedMrr: number;
  totalOrders: number;
  totalSales: number;
  averageOrderValue: number;
  companiesWithoutOrders: number;
  trialExpiringSoon: number;
  ownerlessCompanies: number;
  estimatedArr: number;
  monthlyPlatformSales: number;
  statsCoverage: number;
  activeNoConversionCompanies: number;
  pastDueWatchCount: number;
  realMrr: number;
  realArr: number;
  activeSubscriptions: number;
  trialingSubscriptions: number;
  pastDueSubscriptions: number;
  canceledSubscriptions: number;
  cancelAtPeriodEndCount: number;
  billingCoverage: number;
  topRevenueShare: number;
}

interface CompanyRow {
  id: string;
  name: string;
  industry: string;
  ownerEmail: string;
  ownerId?: string;
  plan: string;
  subscriptionStatus: string;
  stripeCustomerId?: string;
  onboardingComplete: boolean;
  onboardingStep: number;
  onboardingChecklist: {
    profile: boolean;
    product: boolean;
    customer: boolean;
    order: boolean;
  };
  trialEndsAt?: any;
  currentPeriodEnd?: any;
  users: number;
  products: number;
  customers: number;
  orders: number;
  revenue: number;
  createdAt?: any;
}

interface CompanyStatsDoc {
  companyId: string;
  ordersCount: number;
  customersCount: number;
  productsCount: number;
  lifetimeRevenue: number;
  monthlyRevenue: number;
  lastOrderAt?: any;
  firstOrderAt?: any;
  activeUsers: number;
  updatedAt?: any;
}

interface CompanyBillingStatsDoc {
  companyId: string;
  stripeCustomerId?: string;
  planId?: 'starter' | 'pro' | 'business';
  subscriptionStatus?: 'active' | 'past_due' | 'trialing' | 'canceled' | 'incomplete' | 'unpaid';
  mrr: number;
  arr: number;
  currency?: string;
  currentPeriodEnd?: any;
  trialEndsAt?: any;
  pastDue: boolean;
  cancelAtPeriodEnd: boolean;
  lastInvoiceAt?: any;
  lastPaymentStatus?: string;
  updatedAt?: any;
}

interface UserRow {
  id: string;
  email: string;
  displayName: string;
  photoURL?: string | null;
  companyId?: string | null;
  companyName: string;
  role: string;
  currentCompanyId?: string | null;
  subscriptionStatus?: string;
  onboardingStatus?: string;
  products?: number;
  customers?: number;
  orders?: number;
  createdAt?: any;
}

interface BetaUserRow {
  id: string;
  uid: string;
  email: string;
  displayName?: string | null;
  companyId?: string | null;
  companyName?: string | null;
  onboardingStatus?: 'no_company' | 'pending' | 'ready';
  activationStage?: 'signed_up' | 'company_created' | 'data_seeded' | 'active';
  needsAttention?: boolean;
  feedbackCount?: number;
  lastSeenAt?: any;
}

interface BetaUserOpsDoc {
  id: string;
  userId: string;
  targetCompanyId?: string | null;
  followUpStatus?: 'new' | 'watching' | 'contacted' | 'qualified';
  notes?: string | null;
  updatedBy?: string | null;
  updatedAt?: any;
}

type BetaConversionPriority = 'low' | 'medium' | 'high';

interface SupportViewPayload {
  mode: 'support';
  company: {
    id: string;
    name: string;
    industry: string;
    ownerId?: string | null;
    ownerEmail: string;
    subscriptionStatus: string;
    planId: string;
    stripeCustomerId?: string | null;
    currentCompanyId?: string | null;
    onboardingComplete: boolean;
    onboardingStep: number;
    createdAt?: any;
    totals: {
      users: number;
      products: number;
      customers: number;
      orders: number;
      revenue: number;
    };
  };
  targetUser: {
    uid: string;
    email: string;
    displayName: string;
    photoURL?: string | null;
    currentCompanyId?: string | null;
    createdAt?: any;
  } | null;
  membership: {
    id: string;
    userId: string;
    companyId: string;
    role: string;
    createdAt?: any;
  } | null;
  memberships: Array<{
    id: string;
    userId: string;
    companyId: string;
    role: string;
    email: string;
    displayName: string;
  }>;
  activity: {
    recentActivities: Array<{
      id: string;
      type?: string;
      title?: string;
      subtitle?: string;
      createdAt?: any;
    }>;
  };
  issues: Array<{
    severity: 'info' | 'warning' | 'error';
    code: string;
    message: string;
  }>;
}

const MISSING_OWNER_EMAIL = 'No owner email';

function hasMissingOwnerEmail(ownerEmail?: string | null) {
  return !ownerEmail || ownerEmail === MISSING_OWNER_EMAIL;
}

function displayOwnerEmail(ownerEmail?: string | null) {
  return hasMissingOwnerEmail(ownerEmail) ? 'Sin owner asignado' : ownerEmail;
}

function getBetaActivationScore(entry: BetaUserRow, ops?: BetaUserOpsDoc | null) {
  let score = 0;
  if (entry.companyId) score += 20;
  if (entry.activationStage === 'company_created') score += 15;
  if (entry.activationStage === 'data_seeded') score += 35;
  if (entry.activationStage === 'active') score += 45;
  if (entry.onboardingStatus === 'ready') score += 20;
  if ((entry.feedbackCount || 0) > 0) score += Math.min(15, (entry.feedbackCount || 0) * 5);
  if (entry.needsAttention) score += 5;
  if (ops?.followUpStatus === 'contacted') score += 5;
  if (ops?.followUpStatus === 'qualified') score += 15;
  return Math.min(100, score);
}

function getBetaConversionPriority(score: number): BetaConversionPriority {
  if (score >= 75) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

function getBetaNextAction(entry: BetaUserRow, score: number, ops?: BetaUserOpsDoc | null) {
  if (!entry.companyId) return 'Llevar a onboarding y creacion de empresa.';
  if (entry.activationStage === 'company_created') return 'Empujar carga base: productos, clientes y primer pedido.';
  if (entry.activationStage === 'data_seeded' && (entry.feedbackCount || 0) === 0) return 'Pedir feedback temprano y validar friccion.';
  if (score >= 75 && ops?.followUpStatus !== 'contacted') return 'Contactar owner y empujar cierre de trial.';
  if (ops?.followUpStatus === 'contacted') return 'Calificar potencial y mapear necesidad comercial.';
  if (entry.needsAttention) return 'Revisar soporte o feedback antes de perder activacion.';
  return 'Mantener seguimiento ligero y observar uso.';
}

interface PlatformAlert {
  id: string;
  tone: 'warning' | 'info' | 'success';
  title: string;
  body: string;
}

interface PlatformCompanyControlDoc {
  companyId: string;
  lifecycleStatus: 'active' | 'watch' | 'internal_hold' | 'suspended';
  priority: 'low' | 'normal' | 'high' | 'critical';
  nextAction?: string;
  assignedTo?: string;
  notes?: string;
  updatedAt?: unknown;
  updatedBy?: string;
}

interface CompanyControlForm {
  lifecycleStatus: 'active' | 'watch' | 'internal_hold' | 'suspended';
  priority: 'low' | 'normal' | 'high' | 'critical';
  nextAction: string;
  assignedTo: string;
  notes: string;
}

type ControlFeedbackTone = 'neutral' | 'success' | 'error';

interface PlatformAuditLog {
  type: string;
  companyId?: string;
  actorUid: string;
  payload?: Record<string, unknown>;
  createdAt?: unknown;
}

const PLAN_MRR: Record<string, number> = {
  starter: 19,
  pro: 49,
  business: 99,
};

function toDate(value: any) {
  if (!value) return null;
  if (value?.toDate) return value.toDate() as Date;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const SUBSCRIPTION_LABELS: Record<string, string> = {
  active: 'Activa',
  trialing: 'En prueba',
  past_due: 'Pago vencido',
  canceled: 'Cancelada',
  incomplete: 'Incompleta',
  unpaid: 'Sin pago',
};

const ONBOARDING_LABELS: Record<string, string> = {
  complete: 'Completo',
  in_progress: 'En curso',
  pending: 'Pendiente',
  not_started: 'No iniciado',
  unassigned: 'Sin empresa',
  no_company: 'Sin empresa',
};

function humanizeStatus(value?: string | null, dict?: Record<string, string>) {
  if (!value) return 'Sin dato';
  const key = value.toLowerCase();
  if (dict && dict[key]) return dict[key];
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase());
}

function statusTone(value?: string | null): 'emerald' | 'blue' | 'amber' | 'red' | 'neutral' {
  if (!value) return 'neutral';
  const key = value.toLowerCase();
  if (['active', 'complete', 'completed', 'paid'].includes(key)) return 'emerald';
  if (['trialing', 'in_progress', 'pending'].includes(key)) return 'blue';
  if (['past_due', 'incomplete', 'not_started', 'unpaid'].includes(key)) return 'amber';
  if (['canceled', 'cancelled', 'failed', 'unassigned', 'no_company'].includes(key)) return 'red';
  return 'neutral';
}

function StatusChip({ value, dict }: { value?: string | null; dict?: Record<string, string> }) {
  const tone = statusTone(value);
  const toneClass = {
    emerald: 'border-emerald-400/16 bg-emerald-500/8 text-emerald-200',
    blue: 'border-blue-400/16 bg-blue-500/8 text-blue-200',
    amber: 'border-amber-400/16 bg-amber-500/8 text-amber-200',
    red: 'border-red-400/16 bg-red-500/8 text-red-200',
    neutral: 'border-white/10 bg-white/[0.03] text-neutral-300',
  }[tone];
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]', toneClass)}>
      {humanizeStatus(value, dict)}
    </span>
  );
}

function compareByCreatedAtDesc<T extends { createdAt?: any }>(items: T[]) {
  return [...items].sort((a, b) => {
    const aTime = toDate(a.createdAt)?.getTime() || 0;
    const bTime = toDate(b.createdAt)?.getTime() || 0;
    return bTime - aTime;
  });
}

function normalizeOrderTotal(order: OrderDoc) {
  return order.totalAmount ?? order.total ?? 0;
}

function isCurrentMonth(value: any) {
  const date = toDate(value);
  if (!date) return false;
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

function SuperMetricCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <Card className="border-white/5 bg-neutral-900/40 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-neutral-600">{label}</p>
          <p className="mt-4 text-3xl font-bold text-white tracking-tight">{value}</p>
        </div>
        <div className={cn('flex h-12 w-12 items-center justify-center rounded-2xl border', accent)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}

export function SuperAdmin() {
  const { t, formatCurrency } = useLocale();
  const { platformAdmin } = usePlatformAdmin();
  const [refreshKey, setRefreshKey] = useState(0);
  const [companySearch, setCompanySearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'trialing' | 'past_due' | 'canceled'>('all');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<PlatformMetrics>({
    totalCompanies: 0,
    totalUsers: 0,
    totalProducts: 0,
    totalCustomers: 0,
    activeCompanies: 0,
    trialCompanies: 0,
    expiredOrPastDueCompanies: 0,
    starterPlans: 0,
    proPlans: 0,
    businessPlans: 0,
    estimatedMrr: 0,
    totalOrders: 0,
    totalSales: 0,
    averageOrderValue: 0,
    companiesWithoutOrders: 0,
    trialExpiringSoon: 0,
    ownerlessCompanies: 0,
    estimatedArr: 0,
    monthlyPlatformSales: 0,
    statsCoverage: 0,
    activeNoConversionCompanies: 0,
    pastDueWatchCount: 0,
    realMrr: 0,
    realArr: 0,
    activeSubscriptions: 0,
    trialingSubscriptions: 0,
    pastDueSubscriptions: 0,
    canceledSubscriptions: 0,
    cancelAtPeriodEndCount: 0,
    billingCoverage: 0,
    topRevenueShare: 0,
  });
  const [companiesTable, setCompaniesTable] = useState<CompanyRow[]>([]);
  const [usersTable, setUsersTable] = useState<UserRow[]>([]);
  const [latestUsers, setLatestUsers] = useState<UserRow[]>([]);
  const [betaUsers, setBetaUsers] = useState<BetaUserRow[]>([]);
  const [betaUserOps, setBetaUserOps] = useState<Record<string, BetaUserOpsDoc>>({});
  const [betaUserSearch, setBetaUserSearch] = useState('');
  const [betaStageFilter, setBetaStageFilter] = useState<'all' | 'signed_up' | 'company_created' | 'data_seeded' | 'active'>('all');
  const [betaFollowUpFilter, setBetaFollowUpFilter] = useState<'all' | 'new' | 'watching' | 'contacted' | 'qualified'>('all');
  const [betaPriorityFilter, setBetaPriorityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [selectedBetaUserId, setSelectedBetaUserId] = useState<string | null>(null);
  const [betaUserNoteDraft, setBetaUserNoteDraft] = useState('');
  const [savingBetaOpsId, setSavingBetaOpsId] = useState<string | null>(null);
  const [companyControls, setCompanyControls] = useState<Record<string, PlatformCompanyControlDoc>>({});
  const [companyStats, setCompanyStats] = useState<Record<string, CompanyStatsDoc>>({});
  const [companyBillingStats, setCompanyBillingStats] = useState<Record<string, CompanyBillingStatsDoc>>({});
  const [controlForm, setControlForm] = useState<CompanyControlForm>({
    lifecycleStatus: 'active',
    priority: 'normal',
    nextAction: '',
    assignedTo: '',
    notes: '',
  });
  const [savingControl, setSavingControl] = useState(false);
  const [syncingStats, setSyncingStats] = useState(false);
  const [syncingBilling, setSyncingBilling] = useState(false);
  const [controlFeedback, setControlFeedback] = useState<string | null>(null);
  const [controlFeedbackTone, setControlFeedbackTone] = useState<ControlFeedbackTone>('neutral');
  const [supportView, setSupportView] = useState<SupportViewPayload | null>(null);
  const [loadingSupport, setLoadingSupport] = useState(false);
  const [supportError, setSupportError] = useState<string | null>(null);
  const [supportRequest, setSupportRequest] = useState<{ companyId: string | null; targetUserId: string | null }>({
    companyId: null,
    targetUserId: null,
  });

  useEffect(() => {
    let isMounted = true;

    const loadPlatformData = async () => {
      setLoading(true);
      setError(null);
      setSupportError(null);

      try {
        const payload = await fetchPlatformOverview();
        const companies = (payload.companiesTable || []) as CompanyRow[];
        const users = (payload.usersTable || []) as UserRow[];
        const latest = (payload.latestUsers || []) as UserRow[];
        if (!isMounted) return;
        setMetrics(payload.metrics);
        setCompaniesTable(compareByCreatedAtDesc(companies));
        setUsersTable(compareByCreatedAtDesc(users));
        setLatestUsers(latest);
        setCompanyControls(payload.companyControls || {});
        setCompanyStats(payload.companyStats || {});
        setCompanyBillingStats(payload.companyBillingStats || {});
        if (!selectedCompanyId && companies.length > 0) {
          setSelectedCompanyId(compareByCreatedAtDesc(companies)[0].id);
        }
      } catch (loadError) {
        console.error('Failed to load super admin data:', loadError);
        if (isMounted) {
          setError(t('super_admin.errors.load_failed'));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadPlatformData();

    return () => {
      isMounted = false;
    };
  }, [refreshKey, t]);

  useEffect(() => {
    if (!platformAdmin?.uid) return;

    const betaUsersQuery = query(collection(db, 'betaUsers'), orderBy('lastSeenAt', 'desc'), limit(24));
    const unsubscribe = onSnapshot(
      betaUsersQuery,
      (snapshot) => {
        setBetaUsers(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() } as BetaUserRow)));
      },
      (error) => {
        console.error('Failed to load beta users:', error);
        setBetaUsers([]);
      }
    );

    return () => unsubscribe();
  }, [platformAdmin?.uid]);

  useEffect(() => {
    if (!platformAdmin?.uid) return;

    const unsubscribe = onSnapshot(
      collection(db, 'betaUserOps'),
      (snapshot) => {
        setBetaUserOps(
          snapshot.docs.reduce<Record<string, BetaUserOpsDoc>>((acc, entry) => {
            acc[entry.id] = { id: entry.id, ...entry.data() } as BetaUserOpsDoc;
            return acc;
          }, {})
        );
      },
      (error) => {
        console.error('Failed to load beta user ops:', error);
        setBetaUserOps({});
      }
    );

    return () => unsubscribe();
  }, [platformAdmin?.uid]);

  const openSupportView = async (companyId?: string | null, targetUserId?: string | null) => {
    if (!companyId) {
      setSupportRequest({ companyId: null, targetUserId: targetUserId || null });
      setSupportError('No hay empresa asociada para esta vista de soporte.');
      return;
    }
    setSupportRequest({ companyId, targetUserId: targetUserId || null });
    setLoadingSupport(true);
    setSupportError(null);
    setSupportView(null);
    try {
      const payload = await fetchPlatformSupportView(companyId, targetUserId);
      setSupportView(payload as SupportViewPayload);
    } catch (viewError) {
      console.error('Failed to load support view:', viewError);
      setSupportError('No se pudo cargar la vista de soporte.');
    } finally {
      setLoadingSupport(false);
    }
  };

  const alerts = useMemo<PlatformAlert[]>(() => {
    const items: PlatformAlert[] = [];

    if (metrics.expiredOrPastDueCompanies > 0) {
      items.push({
        id: 'past-due',
        tone: 'warning',
        title: t('super_admin.alerts.billing_title'),
        body: t('super_admin.alerts.billing_body', { count: metrics.expiredOrPastDueCompanies }),
      });
    }

    if (companiesTable.some((company) => hasMissingOwnerEmail(company.ownerEmail))) {
      items.push({
        id: 'owner-missing',
        tone: 'warning',
        title: t('super_admin.alerts.owner_title'),
        body: t('super_admin.alerts.owner_body'),
      });
    }

    if (metrics.totalCompanies > 0 && metrics.totalOrders === 0) {
      items.push({
        id: 'no-orders',
        tone: 'info',
        title: t('super_admin.alerts.orders_title'),
        body: t('super_admin.alerts.orders_body'),
      });
    }

    if (metrics.trialExpiringSoon > 0) {
      items.push({
        id: 'trial-window',
        tone: 'info',
        title: t('super_admin.alerts.trial_title'),
        body: t('super_admin.alerts.trial_body', { count: metrics.trialExpiringSoon }),
      });
    }

    if (items.length === 0) {
      items.push({
        id: 'healthy',
        tone: 'success',
        title: t('super_admin.alerts.healthy_title'),
        body: t('super_admin.alerts.healthy_body'),
      });
    }

    return items;
  }, [companiesTable, metrics, t]);

  const revenueLeaderboard = useMemo(
    () => [...companiesTable].sort((a, b) => b.revenue - a.revenue).slice(0, 5),
    [companiesTable]
  );

  const trialToPaidWatchlist = useMemo(
    () =>
      companiesTable
        .filter((company) => {
          const stats = companyStats[company.id];
          return (
            company.subscriptionStatus === 'trialing' &&
            ((stats?.ordersCount || company.orders) > 0 || (stats?.monthlyRevenue || 0) > 0)
          );
        })
        .slice(0, 6),
    [companiesTable, companyStats]
  );

  const trialEndingWithUsageWatchlist = useMemo(
    () =>
      companiesTable
        .filter((company) => {
          const billing = companyBillingStats[company.id];
          const stats = companyStats[company.id];
          const trialEnd = toDate(billing?.trialEndsAt || company.trialEndsAt);
          if ((billing?.subscriptionStatus || company.subscriptionStatus) !== 'trialing' || !trialEnd) return false;
          const diffDays = (trialEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
          return diffDays <= 7 && diffDays >= 0 && ((stats?.ordersCount || company.orders) > 0 || (stats?.monthlyRevenue || 0) > 0);
        })
        .sort((a, b) => (companyStats[b.id]?.monthlyRevenue || 0) - (companyStats[a.id]?.monthlyRevenue || 0))
        .slice(0, 6),
    [companiesTable, companyBillingStats, companyStats]
  );

  const pastDueWatchlist = useMemo(
    () =>
      companiesTable
        .filter((company) => (companyBillingStats[company.id]?.subscriptionStatus || company.subscriptionStatus) === 'past_due')
        .sort((a, b) => {
          const aMrr = companyBillingStats[a.id]?.mrr ?? 0;
          const bMrr = companyBillingStats[b.id]?.mrr ?? 0;
          return bMrr - aMrr;
        })
        .slice(0, 6),
    [companiesTable, companyBillingStats]
  );

  const activeWithoutUsageWatchlist = useMemo(
    () =>
      companiesTable
        .filter((company) => {
          const billing = companyBillingStats[company.id];
          const stats = companyStats[company.id];
          return (
            (billing?.subscriptionStatus || company.subscriptionStatus) === 'active' &&
            (billing?.mrr || 0) > 0 &&
            (stats?.ordersCount || company.orders) === 0 &&
            (stats?.monthlyRevenue || 0) === 0
          );
        })
        .sort((a, b) => (companyBillingStats[b.id]?.mrr || 0) - (companyBillingStats[a.id]?.mrr || 0))
        .slice(0, 6),
    [companiesTable, companyBillingStats, companyStats]
  );

  const highRevenueLowAdoptionWatchlist = useMemo(
    () =>
      companiesTable
        .filter((company) => {
          const billing = companyBillingStats[company.id];
          const stats = companyStats[company.id];
          return (
            (billing?.mrr || 0) >= 49 &&
            ((stats?.activeUsers || company.users) <= 1 || (stats?.ordersCount || company.orders) === 0)
          );
        })
        .sort((a, b) => (companyBillingStats[b.id]?.mrr || 0) - (companyBillingStats[a.id]?.mrr || 0))
        .slice(0, 6),
    [companiesTable, companyBillingStats, companyStats]
  );

  const activationWatchlist = useMemo(
    () =>
      companiesTable
        .filter(
          (company) =>
            company.orders === 0 ||
            company.subscriptionStatus === 'past_due' ||
            company.subscriptionStatus === 'canceled' ||
            hasMissingOwnerEmail(company.ownerEmail)
        )
        .slice(0, 6),
    [companiesTable]
  );

  const filteredCompanies = useMemo(() => {
    const normalized = companySearch.trim().toLowerCase();
    return companiesTable.filter((company) => {
      const statusMatch = statusFilter === 'all' || company.subscriptionStatus === statusFilter;
      const searchMatch =
        normalized.length === 0 ||
        company.name.toLowerCase().includes(normalized) ||
        company.ownerEmail.toLowerCase().includes(normalized) ||
        company.industry.toLowerCase().includes(normalized) ||
        company.id.toLowerCase().includes(normalized) ||
        company.plan.toLowerCase().includes(normalized);
      return statusMatch && searchMatch;
    });
  }, [companiesTable, companySearch, statusFilter]);

  const filteredUsers = useMemo(() => {
    const normalized = userSearch.trim().toLowerCase();
    if (!normalized) return usersTable;
    return usersTable.filter((user) =>
      [user.id, user.email, user.displayName, user.companyName, user.companyId, user.currentCompanyId, user.role]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized))
    );
  }, [usersTable, userSearch]);

  const selectedCompany =
    filteredCompanies.find((company) => company.id === selectedCompanyId) ||
    companiesTable.find((company) => company.id === selectedCompanyId) ||
    filteredCompanies[0] ||
    companiesTable[0] ||
    null;

  useEffect(() => {
    setControlFeedback(null);
    setSupportError(null);
    setSupportView(null);
  }, [selectedCompanyId]);

  useEffect(() => {
    if (!selectedCompanyId) return;
    if (companiesTable.some((company) => company.id === selectedCompanyId)) return;
    setSelectedCompanyId(companiesTable[0]?.id || null);
  }, [companiesTable, selectedCompanyId]);

  const selectedCompanyHealth = useMemo(() => {
    if (!selectedCompany) return 'neutral';
    const platformLifecycle = companyControls[selectedCompany.id]?.lifecycleStatus;
    if (platformLifecycle === 'suspended' || platformLifecycle === 'internal_hold') {
      return 'risk';
    }
    if (platformLifecycle === 'watch') {
      return 'watch';
    }
    if (selectedCompany.subscriptionStatus === 'past_due' || selectedCompany.subscriptionStatus === 'canceled') {
      return 'risk';
    }
    if (!selectedCompany.onboardingComplete || selectedCompany.orders === 0) {
      return 'watch';
    }
    return 'healthy';
  }, [companyControls, selectedCompany]);

  const selectedStats = selectedCompany ? companyStats[selectedCompany.id] || null : null;
  const selectedBilling = selectedCompany ? companyBillingStats[selectedCompany.id] || null : null;
  const selectedControl = selectedCompany ? companyControls[selectedCompany.id] || null : null;
  const selectedTenantAgeDays = selectedCompany
    ? Math.max(
        0,
        Math.floor(((new Date()).getTime() - (toDate(selectedCompany.createdAt)?.getTime() || Date.now())) / (1000 * 60 * 60 * 24))
      )
    : 0;
  const selectedMonetizationPressure = selectedCompany
    ? (selectedBilling?.subscriptionStatus || selectedCompany.subscriptionStatus) === 'past_due'
      ? t('super_admin.company_panel.pressure_high')
      : (selectedBilling?.subscriptionStatus || selectedCompany.subscriptionStatus) === 'trialing' && selectedCompany.orders > 0
        ? t('super_admin.company_panel.pressure_conversion')
        : !selectedBilling && !selectedStats
          ? t('super_admin.company_panel.pressure_pending')
          : ((selectedStats?.monthlyRevenue || 0) === 0 && (selectedBilling?.mrr || 0) > 0)
            ? t('super_admin.company_panel.pressure_low_signal')
            : t('super_admin.company_panel.pressure_healthy')
    : '';
  const selectedChurnRisk = selectedCompany
    ? (selectedBilling?.subscriptionStatus === 'past_due' || selectedBilling?.cancelAtPeriodEnd)
      ? t('super_admin.company_panel.churn_risk_high')
      : (selectedBilling?.subscriptionStatus || selectedCompany.subscriptionStatus) === 'trialing' && (selectedStats?.ordersCount || selectedCompany.orders) > 0
        ? t('super_admin.company_panel.churn_risk_medium')
        : !selectedBilling
          ? t('super_admin.company_panel.billing_pending')
          : t('super_admin.company_panel.churn_risk_low')
    : '';
  const resolvedMrr = metrics.billingCoverage > 0 ? metrics.realMrr : metrics.estimatedMrr;
  const resolvedArr = metrics.billingCoverage > 0 ? metrics.realArr : metrics.estimatedArr;
  const usingRealBilling = metrics.billingCoverage > 0;
  const betaUserReadyCount = betaUsers.filter((entry) => entry.onboardingStatus === 'ready').length;
  const betaUserPendingCount = betaUsers.filter((entry) => entry.onboardingStatus === 'pending').length;
  const betaFeedbackSignals = betaUsers.reduce((sum, entry) => sum + (entry.feedbackCount || 0), 0);
  const betaAttentionCount = betaUsers.filter((entry) => entry.needsAttention).length;
  const betaQualifiedCount = betaUsers.filter((entry) => betaUserOps[entry.uid]?.followUpStatus === 'qualified').length;
  const betaHighPotentialCount = betaUsers.filter((entry) => getBetaConversionPriority(getBetaActivationScore(entry, betaUserOps[entry.uid])) === 'high').length;
  const betaContactedCount = betaUsers.filter((entry) => betaUserOps[entry.uid]?.followUpStatus === 'contacted').length;
  const filteredBetaUsers = useMemo(() => {
    const normalized = betaUserSearch.trim().toLowerCase();
    return betaUsers
      .filter((entry) => {
        const matchesStage = betaStageFilter === 'all' || entry.activationStage === betaStageFilter;
        const followUpStatus = betaUserOps[entry.uid]?.followUpStatus || 'new';
        const matchesFollowUp = betaFollowUpFilter === 'all' || followUpStatus === betaFollowUpFilter;
        const priority = getBetaConversionPriority(getBetaActivationScore(entry, betaUserOps[entry.uid]));
        const matchesPriority = betaPriorityFilter === 'all' || priority === betaPriorityFilter;
        const matchesSearch = !normalized || [
          entry.displayName,
          entry.email,
          entry.companyName,
          entry.companyId,
          entry.uid,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalized));
        return matchesStage && matchesFollowUp && matchesPriority && matchesSearch;
      })
      .sort((left, right) => {
        const rightScore = getBetaActivationScore(right, betaUserOps[right.uid]);
        const leftScore = getBetaActivationScore(left, betaUserOps[left.uid]);
        return rightScore - leftScore;
      });
  }, [betaFollowUpFilter, betaPriorityFilter, betaStageFilter, betaUserOps, betaUserSearch, betaUsers]);
  const selectedBetaUser = useMemo(
    () => filteredBetaUsers.find((entry) => entry.uid === selectedBetaUserId) || filteredBetaUsers[0] || null,
    [filteredBetaUsers, selectedBetaUserId]
  );
  const selectedBetaOps = selectedBetaUser ? betaUserOps[selectedBetaUser.uid] || null : null;
  const betaNoteDirty = (betaUserNoteDraft.trim() || '') !== ((selectedBetaOps?.notes || '').trim());
  const selectedBetaScore = selectedBetaUser ? getBetaActivationScore(selectedBetaUser, selectedBetaOps) : 0;
  const selectedBetaPriority = selectedBetaUser ? getBetaConversionPriority(selectedBetaScore) : 'low';
  const selectedBetaNextAction = selectedBetaUser ? getBetaNextAction(selectedBetaUser, selectedBetaScore, selectedBetaOps) : '';

  useEffect(() => {
    if (!selectedBetaUserId && filteredBetaUsers.length > 0) {
      setSelectedBetaUserId(filteredBetaUsers[0].uid);
      return;
    }
    if (selectedBetaUserId && !filteredBetaUsers.some((entry) => entry.uid === selectedBetaUserId)) {
      setSelectedBetaUserId(filteredBetaUsers[0]?.uid || null);
    }
  }, [filteredBetaUsers, selectedBetaUserId]);

  useEffect(() => {
    setBetaUserNoteDraft(selectedBetaOps?.notes || '');
  }, [selectedBetaOps?.notes, selectedBetaUser?.uid]);

  const saveBetaUserFollowUp = async (
    entry: BetaUserRow,
    payload: {
      followUpStatus?: 'new' | 'watching' | 'contacted' | 'qualified';
      notes?: string;
    }
  ) => {
    if (!platformAdmin?.uid) return;
    setSavingBetaOpsId(entry.uid);
    const resolvedStatus = payload.followUpStatus || betaUserOps[entry.uid]?.followUpStatus || 'new';
    try {
      await setDoc(
        doc(db, 'betaUserOps', entry.uid),
        {
          userId: entry.uid,
          targetCompanyId: entry.companyId || null,
          followUpStatus: resolvedStatus,
          notes: payload.notes !== undefined ? payload.notes.trim() : (betaUserOps[entry.uid]?.notes || null),
          updatedBy: platformAdmin.uid,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      await addDoc(collection(db, 'platformAuditLogs'), {
        type: 'beta_user_followup_updated',
        actorUid: platformAdmin.uid,
        payload: {
          betaUserId: entry.uid,
          followUpStatus: resolvedStatus,
          companyId: entry.companyId || null,
          noteUpdated: payload.notes !== undefined,
        },
        createdAt: serverTimestamp(),
      } as PlatformAuditLog);
    } catch (saveError) {
      console.error('Failed to save beta user follow-up:', saveError);
    } finally {
      setSavingBetaOpsId(null);
    }
  };
  const hasControlChanges = selectedCompany
    ? controlForm.lifecycleStatus !== (selectedControl?.lifecycleStatus || 'active')
      || controlForm.priority !== (selectedControl?.priority || 'normal')
      || controlForm.nextAction.trim() !== (selectedControl?.nextAction || '')
      || controlForm.assignedTo.trim() !== (selectedControl?.assignedTo || '')
      || controlForm.notes.trim() !== (selectedControl?.notes || '')
    : false;

  useEffect(() => {
    if (!selectedCompany) return;
    const existingControl = companyControls[selectedCompany.id];
    setControlForm({
      lifecycleStatus: existingControl?.lifecycleStatus || 'active',
      priority: existingControl?.priority || 'normal',
      nextAction: existingControl?.nextAction || '',
      assignedTo: existingControl?.assignedTo || '',
      notes: existingControl?.notes || '',
    });
    setControlFeedback(null);
    setControlFeedbackTone('neutral');
  }, [companyControls, selectedCompany?.id]);

  const toggleInternalTesting = async () => {
    if (!selectedCompany) return;
    const current = (selectedCompany as any).internalTesting === true;
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/platform/company/override', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ companyId: selectedCompany.id, internalTesting: !current }),
      });
      if (!res.ok) throw new Error('Override failed');
      setControlFeedback(
        !current ? '✓ Modo interno activado. Límites de plan desactivados.' : 'Modo interno desactivado.'
      );
      setRefreshKey((k) => k + 1);
    } catch {
      setControlFeedback('Error al cambiar modo interno.');
    }
  };

  const saveCompanyControl = async () => {
    if (!selectedCompany || !platformAdmin?.uid) return;
    setSavingControl(true);
    setControlFeedback(null);
    setControlFeedbackTone('neutral');
    try {
      await setDoc(
        doc(db, 'platformCompanyControls', selectedCompany.id),
        {
          companyId: selectedCompany.id,
          lifecycleStatus: controlForm.lifecycleStatus,
          priority: controlForm.priority,
          nextAction: controlForm.nextAction.trim(),
          assignedTo: controlForm.assignedTo.trim(),
          notes: controlForm.notes.trim(),
          updatedAt: serverTimestamp(),
          updatedBy: platformAdmin.uid,
        },
        { merge: true }
      );

      setCompanyControls((current) => ({
        ...current,
        [selectedCompany.id]: {
          companyId: selectedCompany.id,
          lifecycleStatus: controlForm.lifecycleStatus,
          priority: controlForm.priority,
          nextAction: controlForm.nextAction.trim(),
          assignedTo: controlForm.assignedTo.trim(),
          notes: controlForm.notes.trim(),
          updatedBy: platformAdmin.uid,
        },
      }));
      await addDoc(collection(db, 'platformAuditLogs'), {
        type: 'company_control_updated',
        companyId: selectedCompany.id,
        actorUid: platformAdmin.uid,
        payload: {
          lifecycleStatus: controlForm.lifecycleStatus,
          priority: controlForm.priority,
        },
        createdAt: serverTimestamp(),
      } as PlatformAuditLog);
      setControlFeedback(t('super_admin.company_panel.saved'));
      setControlFeedbackTone('success');
    } catch (saveError) {
      console.error('Failed to save platform company control:', saveError);
      setControlFeedback(t('super_admin.company_panel.save_failed'));
      setControlFeedbackTone('error');
    } finally {
      setSavingControl(false);
    }
  };

  const logBillingAction = async (
    type: 'billing_note_added' | 'billing_status_reviewed' | 'churn_risk_marked' | 'followup_scheduled'
  ) => {
    if (!selectedCompany || !platformAdmin?.uid) return;
    try {
      setControlFeedback(null);
      setControlFeedbackTone('neutral');
      await addDoc(collection(db, 'platformAuditLogs'), {
        type,
        companyId: selectedCompany.id,
        actorUid: platformAdmin.uid,
        payload: {
          note: type === 'billing_note_added' ? controlForm.notes.trim() : undefined,
          nextAction: controlForm.nextAction.trim() || undefined,
          assignedTo: controlForm.assignedTo.trim() || undefined,
        },
        createdAt: serverTimestamp(),
      } as PlatformAuditLog);
      setControlFeedback(t(`super_admin.company_panel.action_feedback.${type}`));
      setControlFeedbackTone('success');
    } catch (auditError) {
      console.error(`Failed to log ${type}:`, auditError);
      setControlFeedback(t('super_admin.company_panel.save_failed'));
      setControlFeedbackTone('error');
    }
  };

  const syncCompanyStats = async () => {
    if (!platformAdmin?.uid) return;
    setSyncingStats(true);
    setError(null);
    try {
      await syncPlatformStats();
      setRefreshKey((current) => current + 1);
      setControlFeedback(t('super_admin.metrics.sync_success'));
      setControlFeedbackTone('success');
    } catch (syncError) {
      console.error('Failed to sync company stats:', syncError);
      setError(t('super_admin.errors.stats_sync_failed'));
    } finally {
      setSyncingStats(false);
    }
  };

  const syncBillingStats = async () => {
    setSyncingBilling(true);
    setError(null);
    try {
      const payload = await syncPlatformBilling(selectedCompany?.id || null);
      setRefreshKey((current) => current + 1);
      setControlFeedback(t('super_admin.metrics.billing_sync_success', { count: payload.syncedCompanies || 0 }));
      setControlFeedbackTone('success');
    } catch (syncError) {
      console.error('Failed to sync billing stats:', syncError);
      setError(t('super_admin.errors.billing_sync_failed'));
    } finally {
      setSyncingBilling(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_35%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] p-8">
        <div className="absolute inset-y-0 right-0 w-1/3 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),transparent_55%)] pointer-events-none" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.3em] text-blue-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              {t('super_admin.badge')}
            </div>
            <h1 className="font-display text-4xl font-bold tracking-tight text-white">{t('super_admin.title')}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-300">
              {t('super_admin.subtitle')}
            </p>
          </div>
          <div className="flex flex-col gap-3 lg:w-[360px]">
            <div className="grid grid-cols-3 gap-3">
              <Button
                variant="secondary"
                onClick={() => setRefreshKey((current) => current + 1)}
                className="justify-center gap-2 border-white/10 bg-black/30"
              >
                <RefreshCcw className="h-4 w-4" />
                {t('super_admin.actions.refresh')}
              </Button>
              <Button
                variant="secondary"
                onClick={syncCompanyStats}
                disabled={syncingStats}
                className="justify-center gap-2 border-white/10 bg-black/30"
              >
                {syncingStats ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
                {t('super_admin.actions.sync_stats')}
              </Button>
              <Button
                variant="secondary"
                onClick={syncBillingStats}
                disabled={syncingBilling}
                className="justify-center gap-2 border-white/10 bg-black/30"
              >
                {syncingBilling ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                {t('super_admin.actions.sync_billing')}
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600">{t('super_admin.identity')}</p>
              <p className="mt-2 text-sm font-semibold text-white truncate">{platformAdmin?.email || '...'}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600">{t('super_admin.role')}</p>
              <p className="mt-2 text-sm font-semibold uppercase tracking-[0.2em] text-blue-300">{platformAdmin?.role || 'super_admin'}</p>
            </div>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <Card className="border-white/5 bg-neutral-900/40 p-10 text-center text-neutral-400">
          {t('super_admin.loading')}
        </Card>
      ) : error ? (
        <Card className="border-red-500/20 bg-red-500/10 p-6 text-red-200">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <span>{error}</span>
            <Button
              variant="secondary"
              onClick={() => setRefreshKey((current) => current + 1)}
              className="border-red-400/20 bg-black/30 text-red-100"
            >
              Reintentar
            </Button>
          </div>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            <SuperMetricCard icon={Building2} label={t('super_admin.metrics.total_companies')} value={String(metrics.totalCompanies)} accent="border-blue-500/20 bg-blue-500/10 text-blue-300" />
            <SuperMetricCard icon={Users} label={t('super_admin.metrics.total_users')} value={String(metrics.totalUsers)} accent="border-white/10 bg-white/[0.03] text-white" />
            <SuperMetricCard icon={Layers3} label={t('super_admin.metrics.total_products')} value={String(metrics.totalProducts)} accent="border-violet-500/20 bg-violet-500/10 text-violet-300" />
            <SuperMetricCard icon={ShieldCheck} label={t('super_admin.metrics.total_customers')} value={String(metrics.totalCustomers)} accent="border-cyan-500/20 bg-cyan-500/10 text-cyan-300" />
            <SuperMetricCard icon={ShoppingBag} label={t('super_admin.metrics.total_orders')} value={String(metrics.totalOrders)} accent="border-emerald-500/20 bg-emerald-500/10 text-emerald-300" />
            <SuperMetricCard icon={DollarSign} label={t('super_admin.metrics.total_sales')} value={formatCurrency(metrics.totalSales)} accent="border-amber-500/20 bg-amber-500/10 text-amber-300" />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <Card className="border-white/5 bg-neutral-900/40 p-5 xl:col-span-6">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-neutral-600">{t('super_admin.metrics.platform_health')}</p>
                  <h2 className="mt-2 text-lg font-bold text-white">{t('super_admin.metrics.platform_snapshot')}</h2>
                </div>
                <Sparkles className="h-5 w-5 text-blue-400" />
              </div>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600">{t('super_admin.metrics.active_companies')}</p>
                  <p className="mt-3 text-2xl font-bold text-white">{metrics.activeCompanies}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600">{t('super_admin.metrics.trial_companies')}</p>
                  <p className="mt-3 text-2xl font-bold text-white">{metrics.trialCompanies}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600">{t('super_admin.metrics.past_due_companies')}</p>
                  <p className="mt-3 text-2xl font-bold text-white">{metrics.expiredOrPastDueCompanies}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600">{t('super_admin.metrics.starter_plan')}</p>
                  <p className="mt-3 text-2xl font-bold text-white">{metrics.starterPlans}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600">{t('super_admin.metrics.pro_plan')}</p>
                  <p className="mt-3 text-2xl font-bold text-white">{metrics.proPlans}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600">{t('super_admin.metrics.business_plan')}</p>
                  <p className="mt-3 text-2xl font-bold text-white">{metrics.businessPlans}</p>
                </div>
              </div>
            </Card>

            <Card className="border-white/5 bg-neutral-900/40 p-5 xl:col-span-3">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-neutral-600">{t('super_admin.metrics.revenue')}</p>
                  <h2 className="mt-2 text-lg font-bold text-white">
                    {usingRealBilling ? t('super_admin.metrics.real_mrr') : t('super_admin.metrics.estimated_mrr')}
                  </h2>
                </div>
                <CreditCard className="h-5 w-5 text-emerald-300" />
              </div>
              <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-200/80">
                  {usingRealBilling ? t('super_admin.metrics.billing_source_live') : t('super_admin.metrics.billing_source_fallback')}
                </p>
                <p className="mt-4 text-4xl font-bold tracking-tight text-white">{formatCurrency(resolvedMrr)}</p>
              </div>
              <p className="mt-4 text-xs leading-relaxed text-neutral-500">
                {usingRealBilling
                  ? t('super_admin.metrics.real_mrr_note', { coverage: metrics.billingCoverage })
                  : t('super_admin.metrics.mrr_note')}
              </p>
            </Card>

            <Card className="border-white/5 bg-neutral-900/40 p-5 xl:col-span-3">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-neutral-600">{t('super_admin.metrics.activation')}</p>
                  <h2 className="mt-2 text-lg font-bold text-white">{t('super_admin.metrics.activation_title')}</h2>
                </div>
                <ArrowUpRight className="h-5 w-5 text-blue-300" />
              </div>
              <div className="space-y-3">
                <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600">{t('super_admin.metrics.average_order_value')}</p>
                  <p className="mt-3 text-2xl font-bold text-white">{formatCurrency(metrics.averageOrderValue)}</p>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:grid-cols-1">
                  <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600">{t('super_admin.metrics.companies_without_orders')}</p>
                    <p className="mt-2 text-xl font-bold text-white">{metrics.companiesWithoutOrders}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600">{t('super_admin.metrics.trial_expiring_soon')}</p>
                    <p className="mt-2 text-xl font-bold text-white">{metrics.trialExpiringSoon}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600">{t('super_admin.metrics.ownerless_companies')}</p>
                    <p className="mt-2 text-xl font-bold text-white">{metrics.ownerlessCompanies}</p>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <Card className="border-white/5 bg-neutral-900/40 p-5 xl:col-span-4">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-neutral-600">{t('super_admin.metrics.revenue')}</p>
                  <h2 className="mt-2 text-lg font-bold text-white">
                    {usingRealBilling ? t('super_admin.metrics.arr_real') : t('super_admin.metrics.arr_estimated')}
                  </h2>
                </div>
                <TrendingUp className="h-5 w-5 text-emerald-300" />
              </div>
              <div className="space-y-3">
                <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600">
                    {usingRealBilling ? t('super_admin.metrics.arr_real') : t('super_admin.metrics.arr_estimated')}
                  </p>
                  <p className="mt-3 text-2xl font-bold text-white">{formatCurrency(resolvedArr)}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600">{t('super_admin.metrics.monthly_platform_sales')}</p>
                  <p className="mt-3 text-2xl font-bold text-white">{formatCurrency(metrics.monthlyPlatformSales)}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600">{t('super_admin.metrics.active_subscriptions')}</p>
                    <p className="mt-2 text-xl font-bold text-white">{metrics.activeSubscriptions}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600">{t('super_admin.metrics.billing_coverage')}</p>
                    <p className="mt-2 text-xl font-bold text-white">{metrics.billingCoverage}%</p>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="border-white/5 bg-neutral-900/40 p-5 xl:col-span-4">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-neutral-600">{t('super_admin.metrics.activation')}</p>
                  <h2 className="mt-2 text-lg font-bold text-white">{t('super_admin.metrics.conversion_watch')}</h2>
                </div>
                <Radar className="h-5 w-5 text-blue-300" />
              </div>
              <div className="space-y-3">
                <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600">{t('super_admin.metrics.trial_to_paid_watch')}</p>
                  <p className="mt-2 text-xl font-bold text-white">{trialToPaidWatchlist.length}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600">{t('super_admin.metrics.active_no_conversion')}</p>
                  <p className="mt-2 text-xl font-bold text-white">{metrics.activeNoConversionCompanies}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600">{t('super_admin.metrics.stats_coverage')}</p>
                  <p className="mt-2 text-xl font-bold text-white">{metrics.statsCoverage}%</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600">{t('super_admin.metrics.revenue_concentration')}</p>
                  <p className="mt-2 text-xl font-bold text-white">{metrics.topRevenueShare}%</p>
                </div>
              </div>
            </Card>

            <Card className="border-white/5 bg-neutral-900/40 p-5 xl:col-span-4">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-neutral-600">{t('super_admin.alerts.label')}</p>
                  <h2 className="mt-2 text-lg font-bold text-white">{t('super_admin.metrics.billing_watch')}</h2>
                </div>
                <CreditCard className="h-5 w-5 text-amber-300" />
              </div>
              <div className="space-y-3">
                <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600">{t('super_admin.metrics.past_due_watch')}</p>
                  <p className="mt-2 text-xl font-bold text-white">{metrics.pastDueWatchCount}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600">{t('super_admin.metrics.trial_expiring_soon')}</p>
                  <p className="mt-2 text-xl font-bold text-white">{metrics.trialExpiringSoon}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600">{t('super_admin.metrics.cancel_at_period_end')}</p>
                    <p className="mt-2 text-xl font-bold text-white">{metrics.cancelAtPeriodEndCount}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600">{t('super_admin.metrics.trialing_subscriptions')}</p>
                    <p className="mt-2 text-xl font-bold text-white">{metrics.trialingSubscriptions}</p>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <Card className="border-white/5 bg-neutral-900/40 p-5 xl:col-span-8">
              <div className="mb-5">
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-neutral-600">{t('super_admin.tables.companies_label')}</p>
                <h2 className="mt-2 text-lg font-bold text-white">{t('super_admin.tables.companies_title')}</h2>
              </div>
              <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <input
                  value={companySearch}
                  onChange={(event) => setCompanySearch(event.target.value)}
                  placeholder={t('super_admin.tables.search_placeholder')}
                  className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-neutral-600 focus:border-blue-500/40 focus:outline-none lg:max-w-sm"
                />
                <div className="flex flex-wrap gap-2">
                  {(['all', 'active', 'trialing', 'past_due', 'canceled'] as const).map((status) => (
                    <button
                      key={status}
                      onClick={() => setStatusFilter(status)}
                      className={cn(
                        'rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.22em] transition-colors',
                        statusFilter === status
                          ? 'border-blue-500/30 bg-blue-500/10 text-blue-300'
                          : 'border-white/10 bg-black/30 text-neutral-500 hover:text-white'
                      )}
                    >
                      {t(`super_admin.filters.${status}`)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="table-header">{t('super_admin.tables.company')}</th>
                      <th className="table-header">{t('super_admin.tables.owner')}</th>
                      <th className="table-header">{t('super_admin.tables.plan')}</th>
                      <th className="table-header">{t('super_admin.tables.subscription')}</th>
                      <th className="table-header">{t('super_admin.tables.users')}</th>
                      <th className="table-header">{t('super_admin.tables.products')}</th>
                      <th className="table-header">{t('super_admin.tables.customers')}</th>
                      <th className="table-header">{t('super_admin.tables.orders')}</th>
                      <th className="table-header">{t('super_admin.tables.revenue')}</th>
                      <th className="table-header">{t('super_admin.tables.created_at')}</th>
                      <th className="table-header">Soporte</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCompanies.length === 0 ? (
                      <tr className="border-t border-white/[0.04]">
                        <td colSpan={11} className="px-4 py-6 text-center text-sm text-neutral-500">
                          <p>{companiesTable.length === 0 ? 'Todavia no hay empresas registradas.' : 'No hay empresas que coincidan con los filtros actuales.'}</p>
                          {(statusFilter !== 'all' || companySearch.trim()) ? (
                            <Button
                              type="button"
                              variant="secondary"
                              className="mt-4 border-white/10 bg-white/[0.03]"
                              onClick={() => {
                                setStatusFilter('all');
                                setCompanySearch('');
                              }}
                            >
                              Limpiar filtros
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    ) : filteredCompanies.slice(0, 10).map((company) => (
                      <tr
                        key={company.id}
                        className={cn(
                          'cursor-pointer border-t border-white/[0.04] transition-colors hover:bg-white/[0.02]',
                          selectedCompany?.id === company.id && 'bg-blue-500/[0.06]'
                        )}
                        onClick={() => setSelectedCompanyId(company.id)}
                      >
                        <td className="table-cell font-semibold text-white">{company.name}</td>
                        <td className="table-cell text-neutral-400">{displayOwnerEmail(company.ownerEmail)}</td>
                        <td className="table-cell uppercase text-neutral-300">{company.plan}</td>
                        <td className="table-cell uppercase text-neutral-300">{companyBillingStats[company.id]?.subscriptionStatus || company.subscriptionStatus}</td>
                        <td className="table-cell text-neutral-300">{company.users}</td>
                        <td className="table-cell text-neutral-300">{company.products}</td>
                        <td className="table-cell text-neutral-300">{company.customers}</td>
                        <td className="table-cell text-neutral-300">{company.orders}</td>
                        <td className="table-cell text-white font-mono">{formatCurrency(company.revenue)}</td>
                        <td className="table-cell text-neutral-400">{toDate(company.createdAt)?.toLocaleDateString() || '-'}</td>
                        <td className="table-cell">
                          <Button
                            variant="secondary"
                            className="border-white/10 bg-black/30 px-3 py-2 text-xs"
                            onClick={(event) => {
                              event.stopPropagation();
                              void openSupportView(company.id, company.ownerId || null);
                            }}
                          >
                            Abrir soporte
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <div className="space-y-4 xl:col-span-4">
              <Card className="border-white/5 bg-neutral-900/40 p-5">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.25em] text-neutral-600">{t('super_admin.company_panel.label')}</p>
                    <h2 className="mt-2 text-lg font-bold text-white">{t('super_admin.company_panel.title')}</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedCompany ? (
                      <Button
                        variant="secondary"
                        className="border-white/10 bg-black/30 px-3 py-2 text-xs"
                        onClick={() => void openSupportView(selectedCompany.id, selectedCompany.ownerId || null)}
                      >
                        <LifeBuoy className="h-4 w-4" />
                        Abrir vista soporte
                      </Button>
                    ) : null}
                    <div
                      className={cn(
                        'rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em]',
                        selectedCompanyHealth === 'healthy'
                          ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                          : selectedCompanyHealth === 'risk'
                            ? 'border-red-500/20 bg-red-500/10 text-red-300'
                            : 'border-amber-500/20 bg-amber-500/10 text-amber-300'
                      )}
                    >
                      {t(`super_admin.company_panel.health.${selectedCompanyHealth}`)}
                    </div>
                  </div>
                </div>

                {selectedCompany ? (
                  <div className="space-y-4">
                    <div className="rounded-3xl border border-white/10 bg-black/30 p-4">
                      <p className="text-lg font-bold text-white">{selectedCompany.name}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.2em] text-neutral-500">{selectedCompany.industry}</p>
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-600">{t('super_admin.company_panel.plan')}</p>
                          <p className="mt-1 text-sm font-semibold uppercase text-white">{selectedCompany.plan}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-600">{t('super_admin.company_panel.subscription')}</p>
                          <p className="mt-1 text-sm font-semibold uppercase text-white">{selectedBilling?.subscriptionStatus || selectedCompany.subscriptionStatus}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-600">{t('super_admin.company_panel.owner')}</p>
                          <p className="mt-1 text-sm text-neutral-300 break-all">{displayOwnerEmail(selectedCompany.ownerEmail)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-600">{t('super_admin.company_panel.created')}</p>
                          <p className="mt-1 text-sm text-neutral-300">{toDate(selectedCompany.createdAt)?.toLocaleDateString() || '-'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-600">{t('super_admin.company_panel.stripe')}</p>
                        <p className="mt-2 text-xs font-semibold text-white break-all">
                          {selectedCompany.stripeCustomerId || t('super_admin.company_panel.not_connected')}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                          <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-600">{t('super_admin.company_panel.renewal')}</p>
                          <p className="mt-2 text-xs font-semibold text-white">
                          {toDate(selectedBilling?.currentPeriodEnd || selectedBilling?.trialEndsAt || selectedCompany.currentPeriodEnd || selectedCompany.trialEndsAt)?.toLocaleDateString() || '-'}
                          </p>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-600">{t('super_admin.company_panel.onboarding')}</p>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {(['profile', 'product', 'customer', 'order'] as const).map((item) => (
                          <div
                            key={item}
                            className={cn(
                              'rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em]',
                              selectedCompany.onboardingChecklist[item]
                                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                                : 'border-white/10 bg-black/30 text-neutral-500'
                            )}
                          >
                            {t(`super_admin.company_panel.checklist.${item}`)}
                          </div>
                        ))}
                      </div>
                      <p className="mt-3 text-xs text-neutral-400">
                        {t('super_admin.company_panel.onboarding_step', { step: selectedCompany.onboardingStep })}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-600">{t('super_admin.company_panel.usage')}</p>
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <div><p className="text-[10px] text-neutral-600">{t('super_admin.tables.users')}</p><p className="mt-1 text-lg font-bold text-white">{selectedCompany.users}</p></div>
                        <div><p className="text-[10px] text-neutral-600">{t('super_admin.tables.products')}</p><p className="mt-1 text-lg font-bold text-white">{selectedCompany.products}</p></div>
                        <div><p className="text-[10px] text-neutral-600">{t('super_admin.tables.customers')}</p><p className="mt-1 text-lg font-bold text-white">{selectedCompany.customers}</p></div>
                        <div><p className="text-[10px] text-neutral-600">{t('super_admin.tables.orders')}</p><p className="mt-1 text-lg font-bold text-white">{selectedCompany.orders}</p></div>
                      </div>
                      <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-600">{t('super_admin.tables.revenue')}</p>
                        <p className="mt-2 text-xl font-bold text-white">{formatCurrency(selectedCompany.revenue)}</p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-600">{t('super_admin.company_panel.commercial')}</p>
                      {selectedStats || selectedBilling ? (
                        <>
                          <div className="mt-3 grid grid-cols-2 gap-3">
                            <div><p className="text-[10px] text-neutral-600">{t('super_admin.company_panel.lifetime_revenue')}</p><p className="mt-1 text-lg font-bold text-white">{formatCurrency(selectedStats?.lifetimeRevenue || 0)}</p></div>
                            <div><p className="text-[10px] text-neutral-600">{t('super_admin.company_panel.monthly_revenue')}</p><p className="mt-1 text-lg font-bold text-white">{formatCurrency(selectedStats?.monthlyRevenue || 0)}</p></div>
                            <div><p className="text-[10px] text-neutral-600">{t('super_admin.company_panel.last_sale')}</p><p className="mt-1 text-sm font-semibold text-white">{toDate(selectedStats?.lastOrderAt)?.toLocaleDateString() || '-'}</p></div>
                            <div><p className="text-[10px] text-neutral-600">{t('super_admin.company_panel.first_sale')}</p><p className="mt-1 text-sm font-semibold text-white">{toDate(selectedStats?.firstOrderAt)?.toLocaleDateString() || '-'}</p></div>
                            <div><p className="text-[10px] text-neutral-600">{t('super_admin.company_panel.active_users')}</p><p className="mt-1 text-lg font-bold text-white">{selectedStats?.activeUsers || 0}</p></div>
                            <div><p className="text-[10px] text-neutral-600">{t('super_admin.company_panel.tenant_age')}</p><p className="mt-1 text-lg font-bold text-white">{selectedTenantAgeDays}d</p></div>
                            <div><p className="text-[10px] text-neutral-600">{t('super_admin.company_panel.billing_status')}</p><p className="mt-1 text-sm font-semibold uppercase text-white">{selectedBilling?.subscriptionStatus || t('super_admin.company_panel.billing_pending')}</p></div>
                            <div><p className="text-[10px] text-neutral-600">{t('super_admin.company_panel.mrr')}</p><p className="mt-1 text-lg font-bold text-white">{selectedBilling ? formatCurrency(selectedBilling.mrr) : formatCurrency(0)}</p></div>
                            <div><p className="text-[10px] text-neutral-600">{t('super_admin.company_panel.billing_plan')}</p><p className="mt-1 text-sm font-semibold uppercase text-white">{selectedBilling?.planId || selectedCompany.plan}</p></div>
                            <div><p className="text-[10px] text-neutral-600">{t('super_admin.company_panel.last_payment_status')}</p><p className="mt-1 text-sm font-semibold uppercase text-white">{selectedBilling?.lastPaymentStatus || '-'}</p></div>
                          </div>
                          <div className="mt-4 grid grid-cols-1 gap-3">
                            <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                              <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-600">{t('super_admin.company_panel.monetization_pressure')}</p>
                              <p className="mt-2 text-sm font-semibold text-white">{selectedMonetizationPressure}</p>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                              <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-600">{t('super_admin.company_panel.churn_risk')}</p>
                              <p className="mt-2 text-sm font-semibold text-white">{selectedChurnRisk}</p>
                            </div>
                            {selectedBilling ? (
                              <div className="grid grid-cols-2 gap-3">
                                <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                                  <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-600">{t('super_admin.company_panel.renewal')}</p>
                                  <p className="mt-2 text-xs font-semibold text-white">{toDate(selectedBilling.currentPeriodEnd || selectedBilling.trialEndsAt)?.toLocaleDateString() || '-'}</p>
                                </div>
                                <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                                  <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-600">{t('super_admin.company_panel.cancel_at_period_end')}</p>
                                  <p className="mt-2 text-xs font-semibold text-white">{selectedBilling.cancelAtPeriodEnd ? t('super_admin.company_panel.boolean_yes') : t('super_admin.company_panel.boolean_no')}</p>
                                </div>
                              </div>
                            ) : (
                              <div className="rounded-2xl border border-dashed border-white/10 bg-black/30 px-4 py-4 text-center text-sm text-neutral-500">
                                {t('super_admin.company_panel.billing_pending')}
                              </div>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="mt-3 rounded-2xl border border-dashed border-white/10 bg-black/30 px-4 py-6 text-center text-sm text-neutral-500">
                          {t('super_admin.company_panel.stats_pending')}
                        </div>
                      )}
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                      <div className="mb-4 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-600">{t('super_admin.company_panel.controls_label')}</p>
                          <h3 className="mt-2 text-base font-bold text-white">{t('super_admin.company_panel.controls_title')}</h3>
                        </div>
                        <Flame className="h-5 w-5 text-blue-300" />
                      </div>

                      <div className="grid grid-cols-1 gap-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label>{t('super_admin.company_panel.lifecycle')}</Label>
                            <select
                              aria-label="Estado de ciclo de vida de la empresa"
                              value={controlForm.lifecycleStatus}
                              onChange={(event) => {
                                setControlFeedback(null);
                                setControlFeedbackTone('neutral');
                                setControlForm((current) => ({
                                  ...current,
                                  lifecycleStatus: event.target.value as CompanyControlForm['lifecycleStatus'],
                                }));
                              }}
                              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-blue-500/50 focus:outline-none"
                            >
                              {(['active', 'watch', 'internal_hold', 'suspended'] as const).map((value) => (
                                <option key={value} value={value} className="bg-neutral-950 text-white">
                                  {t(`super_admin.company_panel.lifecycle_options.${value}`)}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <Label>{t('super_admin.company_panel.priority')}</Label>
                            <select
                              aria-label="Prioridad de la empresa"
                              value={controlForm.priority}
                              onChange={(event) => {
                                setControlFeedback(null);
                                setControlFeedbackTone('neutral');
                                setControlForm((current) => ({
                                  ...current,
                                  priority: event.target.value as CompanyControlForm['priority'],
                                }));
                              }}
                              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-blue-500/50 focus:outline-none"
                            >
                              {(['low', 'normal', 'high', 'critical'] as const).map((value) => (
                                <option key={value} value={value} className="bg-neutral-950 text-white">
                                  {t(`super_admin.company_panel.priority_options.${value}`)}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div>
                          <Label>{t('super_admin.company_panel.assigned_to')}</Label>
                          <Input
                            value={controlForm.assignedTo}
                            onChange={(event) => {
                              setControlFeedback(null);
                              setControlFeedbackTone('neutral');
                              setControlForm((current) => ({
                                ...current,
                                assignedTo: event.target.value,
                              }));
                            }}
                            placeholder={t('super_admin.company_panel.assigned_placeholder')}
                          />
                        </div>

                        <div>
                          <Label>{t('super_admin.company_panel.next_action')}</Label>
                          <Input
                            value={controlForm.nextAction}
                            onChange={(event) => {
                              setControlFeedback(null);
                              setControlFeedbackTone('neutral');
                              setControlForm((current) => ({
                                ...current,
                                nextAction: event.target.value,
                              }));
                            }}
                            placeholder={t('super_admin.company_panel.next_action_placeholder')}
                          />
                        </div>

                        <div>
                          <Label>{t('super_admin.company_panel.notes')}</Label>
                          <textarea
                            value={controlForm.notes}
                            onChange={(event) => {
                              setControlFeedback(null);
                              setControlFeedbackTone('neutral');
                              setControlForm((current) => ({
                                ...current,
                                notes: event.target.value,
                              }));
                            }}
                            placeholder={t('super_admin.company_panel.notes_placeholder')}
                            className="min-h-[120px] w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-neutral-600 focus:border-blue-500/50 focus:outline-none"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <Button variant="secondary" className="border-white/10 bg-black/30" onClick={() => logBillingAction('billing_status_reviewed')} disabled={!selectedCompany}>
                            {t('super_admin.company_panel.actions.review_billing')}
                          </Button>
                          <Button variant="secondary" className="border-white/10 bg-black/30" onClick={() => logBillingAction('churn_risk_marked')} disabled={!selectedCompany}>
                            {t('super_admin.company_panel.actions.mark_churn')}
                          </Button>
                          <Button variant="secondary" className="border-white/10 bg-black/30" onClick={() => logBillingAction('followup_scheduled')} disabled={!selectedCompany}>
                            {t('super_admin.company_panel.actions.schedule_followup')}
                          </Button>
                          <Button
                            variant="secondary"
                            className="border-white/10 bg-black/30"
                            onClick={() => logBillingAction('billing_note_added')}
                            disabled={!selectedCompany || !controlForm.notes.trim()}
                          >
                            {t('super_admin.company_panel.actions.log_note')}
                          </Button>
                        </div>

                        <div className="mt-2 rounded-lg border border-amber-500/20 bg-amber-500/[0.08] p-3">
                          <p className="text-[10px] font-black uppercase tracking-widest text-amber-400 mb-2">
                            Modo Interno / Beta Testing
                          </p>
                          <p className="text-xs text-neutral-400 mb-2">
                            {(selectedCompany as any)?.internalTesting
                              ? '✓ Activo — límites de plan desactivados para esta empresa.'
                              : 'Inactivo — límites de plan normales.'}
                          </p>
                          <p className="text-[10px] text-neutral-500 mb-2">No afecta suscripción real de Stripe.</p>
                          <Button
                            variant="secondary"
                            className="border-amber-500/30 text-amber-300 text-xs"
                            onClick={() => void toggleInternalTesting()}
                          >
                            {(selectedCompany as any)?.internalTesting ? 'Desactivar modo interno' : 'Activar modo interno'}
                          </Button>
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <p
                            className={cn(
                              'text-xs',
                              controlFeedbackTone === 'success'
                                ? 'text-emerald-300'
                                : controlFeedbackTone === 'error'
                                  ? 'text-red-200'
                                  : 'text-neutral-500'
                            )}
                          >
                            {controlFeedback || t('super_admin.company_panel.controls_note')}
                          </p>
                          <Button
                            onClick={saveCompanyControl}
                            disabled={savingControl || !selectedCompany || !hasControlChanges}
                            className="gap-2"
                          >
                            <Save className="h-4 w-4" />
                            {savingControl
                              ? t('super_admin.company_panel.saving')
                              : t('super_admin.company_panel.save')}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-8 text-center text-sm text-neutral-500">
                    {t('super_admin.company_panel.empty')}
                  </div>
                )}
              </Card>

              <Card className="border-white/5 bg-neutral-900/40 p-5">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.25em] text-neutral-600">{t('super_admin.alerts.label')}</p>
                    <h2 className="mt-2 text-lg font-bold text-white">{t('super_admin.alerts.title')}</h2>
                  </div>
                  <AlertTriangle className="h-5 w-5 text-amber-300" />
                </div>
                <div className="space-y-3">
                  {alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={cn(
                        'rounded-2xl border px-4 py-4',
                        alert.tone === 'warning'
                          ? 'border-amber-500/20 bg-amber-500/10'
                          : alert.tone === 'success'
                            ? 'border-emerald-500/20 bg-emerald-500/10'
                            : 'border-blue-500/20 bg-blue-500/10'
                      )}
                    >
                      <p className="text-sm font-bold text-white">{alert.title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-neutral-200/85">{alert.body}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <SuperAdminFeedbackCenter />

            <Card className="border-white/5 bg-neutral-900/40 p-5 xl:col-span-2">
              <div className="mb-5">
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-neutral-600">{t('super_admin.tables.users_label')}</p>
                <h2 className="mt-2 text-lg font-bold text-white">{t('super_admin.tables.users_title')}</h2>
              </div>
              <div className="mb-4">
                <Input
                  value={userSearch}
                  onChange={(event) => setUserSearch(event.target.value)}
                  placeholder="Buscar usuario, empresa, rol o empresa actual"
                  className="border-white/10 bg-black/30"
                />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="table-header">UID</th>
                      <th className="table-header">{t('super_admin.tables.user_email')}</th>
                      <th className="table-header">{t('super_admin.tables.user_name')}</th>
                      <th className="table-header">{t('super_admin.tables.company')}</th>
                      <th className="table-header">Empresa actual</th>
                      <th className="table-header">{t('super_admin.tables.user_role')}</th>
                      <th className="table-header">Suscripcion</th>
                      <th className="table-header">Onboarding</th>
                      <th className="table-header">Volumen</th>
                      <th className="table-header">{t('super_admin.tables.registered_at')}</th>
                      <th className="table-header">Soporte</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.length === 0 ? (
                      <tr className="border-t border-white/[0.04]">
                        <td colSpan={11} className="px-4 py-6 text-center text-sm text-neutral-500">
                          <p>{usersTable.length === 0 ? 'Todavia no hay usuarios registrados.' : 'No hay usuarios que coincidan con la busqueda actual.'}</p>
                          {userSearch.trim() ? (
                            <Button
                              type="button"
                              variant="secondary"
                              className="mt-4 border-white/10 bg-white/[0.03]"
                              onClick={() => setUserSearch('')}
                            >
                              Limpiar busqueda
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    ) : filteredUsers.slice(0, 12).map((user) => (
                      <tr key={user.id} className="border-t border-white/[0.04]">
                        <td className="table-cell font-mono text-[11px] text-neutral-400">{user.id}</td>
                        <td className="table-cell text-white">{user.email}</td>
                        <td className="table-cell text-neutral-300">
                          <div className="flex items-center gap-3">
                            {user.photoURL ? (
                              <img src={user.photoURL} alt={user.displayName} className="h-8 w-8 rounded-full object-cover" />
                            ) : (
                              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-[10px] font-bold text-neutral-400">
                                {(user.displayName || user.email || '?').slice(0, 1).toUpperCase()}
                              </div>
                            )}
                            <span>{user.displayName}</span>
                          </div>
                        </td>
                        <td className="table-cell text-neutral-300">
                          {user.companyName ? (
                            <>
                              <div>{user.companyName}</div>
                              <div className="mt-1 font-mono text-[10px] text-neutral-500">{user.companyId || '-'}</div>
                            </>
                          ) : (
                            <span className="text-neutral-500">Sin empresa</span>
                          )}
                        </td>
                        <td className="table-cell font-mono text-[11px] text-neutral-500">{user.currentCompanyId || '-'}</td>
                        <td className="table-cell uppercase text-neutral-300">{user.role}</td>
                        <td className="table-cell"><StatusChip value={user.subscriptionStatus} dict={SUBSCRIPTION_LABELS} /></td>
                        <td className="table-cell"><StatusChip value={user.onboardingStatus} dict={ONBOARDING_LABELS} /></td>
                        <td className="table-cell text-[11px] text-neutral-300">
                          <span className="font-semibold text-white">{user.products || 0}</span>
                          <span className="text-neutral-600"> / </span>
                          <span className="font-semibold text-white">{user.customers || 0}</span>
                          <span className="text-neutral-600"> / </span>
                          <span className="font-semibold text-white">{user.orders || 0}</span>
                          <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.2em] text-neutral-600">Prod / Clt / Ped</div>
                        </td>
                        <td className="table-cell text-neutral-400">{toDate(user.createdAt)?.toLocaleDateString() || '-'}</td>
                        <td className="table-cell">
                          <Button
                            variant="secondary"
                            className="border-white/10 bg-black/30 px-3 py-2 text-xs"
                            disabled={loadingSupport || !(user.companyId || user.currentCompanyId)}
                            onClick={() => void openSupportView(user.companyId || user.currentCompanyId || null, user.id)}
                          >
                            Ver soporte
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <div className="space-y-4">
              <Card className="border-white/5 bg-neutral-900/40 p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.25em] text-neutral-600">Vista de soporte</p>
                    <h2 className="mt-2 text-lg font-bold text-white">Vista de soporte en solo lectura</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    {loadingSupport ? <Loader2 className="h-4 w-4 animate-spin text-blue-300" /> : null}
                    {supportView ? (
                      <Button
                        variant="secondary"
                        className="border-white/10 bg-black/30 px-3 py-2 text-xs"
                        onClick={() => {
                          setSupportView(null);
                          setSupportError(null);
                          setSupportRequest({
                            companyId: null,
                            targetUserId: null,
                          });
                        }}
                      >
                        <X className="h-4 w-4" />
                        Cerrar
                      </Button>
                    ) : null}
                  </div>
                </div>

                {supportError ? (
                  <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.08] px-4 py-3 text-sm text-red-200">
                    <div className="flex flex-col gap-3">
                      <span>{supportError}</span>
                      <Button
                        variant="secondary"
                        className="w-fit border-red-400/20 bg-black/30 px-3 py-2 text-xs text-red-100"
                        disabled={!supportRequest.companyId && !selectedCompany?.id}
                        onClick={() => {
                          if (supportRequest.companyId) {
                            void openSupportView(supportRequest.companyId, supportRequest.targetUserId);
                          } else if (selectedCompany?.id) {
                            void openSupportView(selectedCompany.id, selectedCompany.ownerId || null);
                          }
                        }}
                      >
                        Reintentar soporte
                      </Button>
                    </div>
                  </div>
                ) : null}

                {supportView ? (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.08] px-4 py-3">
                      <p className="text-[11px] font-black uppercase tracking-[0.22em] text-amber-300">Modo soporte activo</p>
                      <p className="mt-1 text-sm text-neutral-200">
                        Vista en solo lectura como admin de plataforma. No cambia la sesion ni la autenticacion del usuario real.
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-600">Incidencias</p>
                        <p className="mt-2 text-xl font-bold text-white">{supportView.issues.length}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-600">Miembros</p>
                        <p className="mt-2 text-xl font-bold text-white">{supportView.memberships.length}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-600">Actividad</p>
                        <p className="mt-2 text-xl font-bold text-white">{supportView.activity.recentActivities.length}</p>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-600">Usuario</p>
                        {supportView.targetUser ? (
                          <div className="mt-3 space-y-2 text-sm text-neutral-300">
                            <p className="font-semibold text-white">{supportView.targetUser.displayName}</p>
                            <p>{supportView.targetUser.email}</p>
                            <p className="font-mono text-[11px] text-neutral-500">{supportView.targetUser.uid}</p>
                            <p>Empresa actual: <span className="font-mono text-[11px]">{supportView.targetUser.currentCompanyId || '-'}</span></p>
                            <p>Creado: {toDate(supportView.targetUser.createdAt)?.toLocaleString() || '-'}</p>
                          </div>
                        ) : (
                          <p className="mt-3 text-sm text-neutral-500">No se encontro usuario objetivo.</p>
                        )}
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-600">Empresa</p>
                        <div className="mt-3 space-y-2 text-sm text-neutral-300">
                          <p className="font-semibold text-white">{supportView.company.name}</p>
                          <p>{supportView.company.industry}</p>
                          <p className="font-mono text-[11px] text-neutral-500">{supportView.company.id}</p>
                          <p>Plan: <span className="uppercase">{supportView.company.planId}</span></p>
                          <p>Suscripcion: <span className="uppercase">{supportView.company.subscriptionStatus}</span></p>
                          <p>Owner asignado: {displayOwnerEmail(supportView.company.ownerEmail)}</p>
                          <p>Onboarding: {supportView.company.onboardingComplete ? 'completo' : `paso ${supportView.company.onboardingStep}`}</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-neutral-300">
                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-600">Totales</p>
                        <p className="mt-3">Usuarios: <span className="font-semibold text-white">{supportView.company.totals.users}</span></p>
                        <p>Productos: <span className="font-semibold text-white">{supportView.company.totals.products}</span></p>
                        <p>Clientes: <span className="font-semibold text-white">{supportView.company.totals.customers}</span></p>
                        <p>Pedidos: <span className="font-semibold text-white">{supportView.company.totals.orders}</span></p>
                        <p>Ingresos: <span className="font-semibold text-white">{formatCurrency(supportView.company.totals.revenue)}</span></p>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-neutral-300">
                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-600">Acceso objetivo</p>
                        {supportView.membership ? (
                          <div className="mt-3 space-y-1">
                            <p>Rol: <span className="font-semibold uppercase text-white">{supportView.membership.role}</span></p>
                            <p>Usuario: <span className="font-mono text-[11px]">{supportView.membership.userId}</span></p>
                            <p>Empresa: <span className="font-mono text-[11px]">{supportView.membership.companyId}</span></p>
                          </div>
                        ) : (
                          <p className="mt-3 text-neutral-500">No hay membership enlazada.</p>
                        )}
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-neutral-300">
                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-600">Validaciones</p>
                        <div className="mt-3 space-y-2">
                          {supportView.issues.length > 0 ? supportView.issues.map((issue) => (
                            <div
                              key={issue.code}
                              className={cn(
                                'rounded-xl border px-3 py-2 text-xs',
                                issue.severity === 'error'
                                  ? 'border-red-500/20 bg-red-500/[0.08] text-red-200'
                                  : issue.severity === 'warning'
                                    ? 'border-amber-500/20 bg-amber-500/[0.08] text-amber-200'
                                    : 'border-blue-500/20 bg-blue-500/[0.08] text-blue-200'
                              )}
                            >
                              <p className="text-sm font-semibold leading-snug">{issue.message}</p>
                              <p className="mt-1.5 inline-flex items-center rounded-full border border-white/10 bg-black/30 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-neutral-400">{issue.code}</p>
                            </div>
                          )) : (
                            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.08] px-3 py-2 text-xs text-emerald-200">
                              Sin inconsistencias criticas detectadas.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-600">Actividad reciente</p>
                      <div className="mt-3 space-y-2">
                        {supportView.activity.recentActivities.length > 0 ? supportView.activity.recentActivities.map((item) => (
                          <div key={item.id} className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-neutral-300">
                            <p className="font-semibold text-white">{item.title || item.type || 'Actividad'}</p>
                            <p className="mt-1 text-neutral-400">{item.subtitle || '-'}</p>
                            <p className="mt-1 text-neutral-500">{toDate(item.createdAt)?.toLocaleString() || '-'}</p>
                          </div>
                        )) : (
                          <p className="text-sm text-neutral-500">No hay actividad registrada todavia.</p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-8 text-center text-sm text-neutral-500">
                    Abre una empresa o usuario desde Super Admin para inspeccion en solo lectura.
                  </div>
                )}
              </Card>
            </div>

            <div className="space-y-4">
              <Card className="border-white/5 bg-neutral-900/40 p-5">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.25em] text-neutral-600">{t('super_admin.latest.companies_label')}</p>
                    <h2 className="mt-2 text-lg font-bold text-white">{t('super_admin.latest.companies_title')}</h2>
                  </div>
                  <Layers3 className="h-5 w-5 text-blue-300" />
                </div>
                <div className="space-y-3">
                  {revenueLeaderboard.map((company) => (
                    <button
                      key={company.id}
                      type="button"
                      onClick={() => setSelectedCompanyId(company.id)}
                      className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-left transition-colors hover:border-white/20 hover:bg-white/[0.03]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-white">{company.name}</p>
                          <p className="mt-1 text-[11px] text-neutral-400">{company.orders} {t('super_admin.latest.orders_count')}</p>
                        </div>
                        <p className="text-[11px] font-mono font-bold text-emerald-300">{formatCurrency(company.revenue)}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </Card>

              <Card className="border-white/5 bg-neutral-900/40 p-5">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.25em] text-neutral-600">{t('super_admin.latest.users_label')}</p>
                    <h2 className="mt-2 text-lg font-bold text-white">{t('super_admin.latest.users_title')}</h2>
                  </div>
                  <Users className="h-5 w-5 text-purple-300" />
                </div>
                <div className="space-y-3">
                  {activationWatchlist.length > 0 ? activationWatchlist.map((company) => (
                    <button
                      key={company.id}
                      type="button"
                      onClick={() => setSelectedCompanyId(company.id)}
                      className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-left transition-colors hover:border-white/20 hover:bg-white/[0.03]"
                    >
                      <p className="text-sm font-bold text-white">{company.name}</p>
                      <p className="mt-1 text-[11px] text-neutral-400">
                        {company.orders === 0
                          ? t('super_admin.latest.no_orders_watch')
                          : `${company.subscriptionStatus.toUpperCase()} | ${displayOwnerEmail(company.ownerEmail)}`}
                      </p>
                    </button>
                  )) : latestUsers.map((user) => (
                    <div key={user.id} className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                      <p className="text-sm font-bold text-white">{user.displayName}</p>
                      <p className="mt-1 text-[11px] text-neutral-400">{user.email}</p>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="border-white/5 bg-neutral-900/40 p-5">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.25em] text-neutral-600">Base beta</p>
                    <h2 className="mt-2 text-lg font-bold text-white">Usuarios para pruebas</h2>
                  </div>
                  <Users className="h-5 w-5 text-cyan-300" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600">Total</p>
                    <p className="mt-2 text-xl font-bold text-white">{betaUsers.length}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600">Listos</p>
                    <p className="mt-2 text-xl font-bold text-white">{betaUserReadyCount}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600">Feedback</p>
                    <p className="mt-2 text-xl font-bold text-white">{betaFeedbackSignals}</p>
                  </div>
                </div>
                <div className="mt-3 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
                  <Input
                    value={betaUserSearch}
                    onChange={(event) => setBetaUserSearch(event.target.value)}
                    placeholder="Buscar beta user, empresa o email"
                    className="border-white/10 bg-black/30"
                  />
                  <select
                    aria-label="Filtrar base beta por etapa"
                    value={betaStageFilter}
                    onChange={(event) => setBetaStageFilter(event.target.value as typeof betaStageFilter)}
                    className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white focus:border-blue-500/50 focus:outline-none"
                  >
                    <option value="all" className="bg-neutral-950 text-white">Etapa: todas</option>
                    <option value="signed_up" className="bg-neutral-950 text-white">Solo registro</option>
                    <option value="company_created" className="bg-neutral-950 text-white">Empresa creada</option>
                    <option value="data_seeded" className="bg-neutral-950 text-white">Con datos base</option>
                    <option value="active" className="bg-neutral-950 text-white">Activos</option>
                  </select>
                </div>
                <div className="mt-3">
                  <select
                    aria-label="Filtrar base beta por seguimiento"
                    value={betaFollowUpFilter}
                    onChange={(event) => setBetaFollowUpFilter(event.target.value as typeof betaFollowUpFilter)}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white focus:border-blue-500/50 focus:outline-none"
                  >
                    <option value="all" className="bg-neutral-950 text-white">Seguimiento: todos</option>
                    <option value="new" className="bg-neutral-950 text-white">Nuevos</option>
                    <option value="watching" className="bg-neutral-950 text-white">En seguimiento</option>
                    <option value="contacted" className="bg-neutral-950 text-white">Contactados</option>
                    <option value="qualified" className="bg-neutral-950 text-white">Alto potencial</option>
                  </select>
                </div>
                <div className="mt-3">
                  <select
                    aria-label="Filtrar base beta por prioridad"
                    value={betaPriorityFilter}
                    onChange={(event) => setBetaPriorityFilter(event.target.value as typeof betaPriorityFilter)}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white focus:border-blue-500/50 focus:outline-none"
                  >
                    <option value="all" className="bg-neutral-950 text-white">Prioridad: todas</option>
                    <option value="high" className="bg-neutral-950 text-white">Alta</option>
                    <option value="medium" className="bg-neutral-950 text-white">Media</option>
                    <option value="low" className="bg-neutral-950 text-white">Baja</option>
                  </select>
                </div>
                <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-neutral-300">
                  <p>Pendientes: <span className="font-semibold text-white">{betaUserPendingCount}</span></p>
                  <p className="mt-1">Seguimiento: <span className="font-semibold text-white">{betaAttentionCount}</span></p>
                  <p className="mt-1">Contactados: <span className="font-semibold text-white">{betaContactedCount}</span></p>
                  <p className="mt-1">Potencial: <span className="font-semibold text-white">{betaQualifiedCount}</span></p>
                  <p className="mt-1">Listos para cerrar: <span className="font-semibold text-white">{betaHighPotentialCount}</span></p>
                  <p className="mt-1 text-xs text-neutral-500">Usuarios beta registrados, activacion y senal de feedback sobre Firestore.</p>
                </div>
                <div className="mt-4 space-y-3">
                  {filteredBetaUsers.length > 0 ? filteredBetaUsers.slice(0, 6).map((entry) => {
                    const score = getBetaActivationScore(entry, betaUserOps[entry.uid]);
                    const priority = getBetaConversionPriority(score);
                    return (
                    <div key={entry.id} className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-white">{entry.displayName || entry.email}</p>
                          <p className="mt-1 text-[11px] text-neutral-400">{entry.companyName || 'Sin empresa activa'}</p>
                          <p className="mt-1 text-[10px] text-neutral-600">{entry.email}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">{entry.activationStage || entry.onboardingStatus || 'no_company'}</p>
                          <p className="mt-1 text-[10px] text-neutral-500">{entry.feedbackCount || 0} feedback / {score} pts</p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className={cn(
                          'rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em]',
                          priority === 'high'
                            ? 'border-emerald-500/20 bg-emerald-500/[0.08] text-emerald-200'
                            : priority === 'medium'
                              ? 'border-amber-500/20 bg-amber-500/[0.08] text-amber-200'
                              : 'border-white/10 bg-white/[0.04] text-neutral-300'
                        )}>
                          {priority === 'high' ? 'cierre alto' : priority === 'medium' ? 'conversion media' : 'frio'}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-neutral-300">
                          {betaUserOps[entry.uid]?.followUpStatus === 'qualified'
                            ? 'alto potencial'
                            : betaUserOps[entry.uid]?.followUpStatus === 'contacted'
                              ? 'contactado'
                              : betaUserOps[entry.uid]?.followUpStatus === 'watching'
                                ? 'en seguimiento'
                                : 'nuevo'}
                        </span>
                        {entry.companyId ? (
                          <button
                            type="button"
                            onClick={() => setSelectedCompanyId(entry.companyId || null)}
                            className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white transition-colors hover:border-white/20 hover:bg-white/[0.08]"
                          >
                            Abrir empresa
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => setSelectedBetaUserId(entry.uid)}
                          className={cn(
                            'rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] transition-colors',
                            selectedBetaUser?.uid === entry.uid
                              ? 'border-white/20 bg-white/[0.1] text-white'
                              : 'border-white/10 bg-white/[0.04] text-neutral-300 hover:border-white/20 hover:bg-white/[0.08]'
                          )}
                        >
                          Seguimiento
                        </button>
                        <button
                          type="button"
                          onClick={() => saveBetaUserFollowUp(entry, { followUpStatus: 'watching' })}
                          disabled={savingBetaOpsId === entry.uid}
                          className="rounded-full border border-amber-500/20 bg-amber-500/[0.08] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-amber-200 transition-colors hover:border-amber-400/30 hover:bg-amber-500/[0.14] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Seguir
                        </button>
                        <button
                          type="button"
                          onClick={() => saveBetaUserFollowUp(entry, { followUpStatus: 'contacted' })}
                          disabled={savingBetaOpsId === entry.uid}
                          className="rounded-full border border-cyan-500/20 bg-cyan-500/[0.08] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200 transition-colors hover:border-cyan-400/30 hover:bg-cyan-500/[0.14] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Contactado
                        </button>
                        <button
                          type="button"
                          onClick={() => saveBetaUserFollowUp(entry, { followUpStatus: 'qualified' })}
                          disabled={savingBetaOpsId === entry.uid}
                          className="rounded-full border border-emerald-500/20 bg-emerald-500/[0.08] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200 transition-colors hover:border-emerald-400/30 hover:bg-emerald-500/[0.14] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Potencial
                        </button>
                      </div>
                    </div>
                    );
                  }) : (
                    <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-6 text-center text-sm text-neutral-500">
                      {betaUsers.length === 0 ? 'Aun no hay usuarios beta registrados.' : 'No hay usuarios beta para el filtro actual.'}
                    </div>
                  )}
                </div>
                {selectedBetaUser ? (
                  <div className="mt-4 rounded-[28px] border border-white/10 bg-neutral-950/70 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600">Seguimiento beta</p>
                        <h3 className="mt-2 truncate text-base font-bold text-white">{selectedBetaUser.displayName || selectedBetaUser.email}</h3>
                        <p className="mt-1 text-xs text-neutral-400">{selectedBetaUser.email}</p>
                        <p className="mt-1 text-xs text-neutral-500">{selectedBetaUser.companyName || 'Sin empresa activa'} / {selectedBetaUser.activationStage || selectedBetaUser.onboardingStatus || 'no_company'}</p>
                      </div>
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white">
                        {selectedBetaOps?.followUpStatus === 'qualified'
                          ? 'alto potencial'
                          : selectedBetaOps?.followUpStatus === 'contacted'
                            ? 'contactado'
                            : selectedBetaOps?.followUpStatus === 'watching'
                              ? 'en seguimiento'
                              : 'nuevo'}
                      </span>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                      <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-600">Feedback</p>
                        <p className="mt-2 text-lg font-bold text-white">{selectedBetaUser.feedbackCount || 0}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-600">Atencion</p>
                        <p className="mt-2 text-lg font-bold text-white">{selectedBetaUser.needsAttention ? 'Alta' : 'Normal'}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-600">Empresa</p>
                        <p className="mt-2 truncate text-sm font-bold text-white">{selectedBetaUser.companyId || '-'}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-600">Score</p>
                        <p className="mt-2 text-lg font-bold text-white">{selectedBetaScore}/100</p>
                      </div>
                    </div>
                    <div className="mt-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-600">Prioridad de conversion</p>
                      <p className={cn(
                        'mt-2 text-sm font-bold uppercase tracking-[0.16em]',
                        selectedBetaPriority === 'high'
                          ? 'text-emerald-300'
                          : selectedBetaPriority === 'medium'
                            ? 'text-amber-300'
                            : 'text-neutral-300'
                      )}>
                        {selectedBetaPriority === 'high' ? 'Alta' : selectedBetaPriority === 'medium' ? 'Media' : 'Baja'}
                      </p>
                      <p className="mt-2 text-sm text-neutral-400">{selectedBetaNextAction}</p>
                    </div>
                    <div className="mt-4">
                      <Label>Notas internas</Label>
                      <textarea
                        value={betaUserNoteDraft}
                        onChange={(event) => setBetaUserNoteDraft(event.target.value)}
                        rows={4}
                        placeholder="Anota friccion, potencial de conversion o siguiente contacto."
                        className="w-full rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-white placeholder:text-neutral-600 transition-all duration-200 focus:border-blue-400/40 focus:outline-none focus:ring-2 focus:ring-blue-400/24"
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => saveBetaUserFollowUp(selectedBetaUser, { notes: betaUserNoteDraft })}
                        disabled={savingBetaOpsId === selectedBetaUser.uid || !betaNoteDirty}
                      >
                        Guardar nota
                      </Button>
                      {selectedBetaUser.companyId ? (
                        <Button
                          variant="secondary"
                          onClick={() => openSupportView(selectedBetaUser.companyId || null, selectedBetaUser.uid)}
                          disabled={loadingSupport}
                        >
                          Abrir soporte
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </Card>

              <Card className="border-white/5 bg-neutral-900/40 p-5">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.25em] text-neutral-600">{t('super_admin.metrics.activation')}</p>
                    <h2 className="mt-2 text-lg font-bold text-white">{t('super_admin.metrics.trial_ending_with_usage')}</h2>
                  </div>
                  <Sparkles className="h-5 w-5 text-emerald-300" />
                </div>
                <div className="space-y-3">
                  {trialEndingWithUsageWatchlist.length > 0 ? trialEndingWithUsageWatchlist.map((company) => (
                    <button
                      key={company.id}
                      type="button"
                      onClick={() => setSelectedCompanyId(company.id)}
                      className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-left transition-colors hover:border-white/20 hover:bg-white/[0.03]"
                    >
                      <p className="text-sm font-bold text-white">{company.name}</p>
                      <p className="mt-1 text-[11px] text-neutral-400">
                        {formatCurrency(companyStats[company.id]?.monthlyRevenue ?? 0)} | {toDate(companyBillingStats[company.id]?.trialEndsAt || company.trialEndsAt)?.toLocaleDateString() || '-'}
                      </p>
                    </button>
                  )) : (
                    <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-6 text-center text-sm text-neutral-500">
                      {t('super_admin.metrics.no_trial_watch')}
                    </div>
                  )}
                </div>
              </Card>

              <Card className="border-white/5 bg-neutral-900/40 p-5">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.25em] text-neutral-600">{t('super_admin.alerts.label')}</p>
                    <h2 className="mt-2 text-lg font-bold text-white">{t('super_admin.metrics.past_due_high_value')}</h2>
                  </div>
                  <AlertTriangle className="h-5 w-5 text-red-300" />
                </div>
                <div className="space-y-3">
                  {pastDueWatchlist.length > 0 ? pastDueWatchlist.map((company) => (
                    <button
                      key={company.id}
                      type="button"
                      onClick={() => setSelectedCompanyId(company.id)}
                      className="w-full rounded-2xl border border-red-500/10 bg-red-500/[0.06] px-4 py-3 text-left transition-colors hover:border-red-400/20 hover:bg-red-500/[0.09]"
                    >
                      <p className="text-sm font-bold text-white">{company.name}</p>
                      <p className="mt-1 text-[11px] text-neutral-300">
                        {formatCurrency(companyBillingStats[company.id]?.mrr ?? 0)} MRR | {displayOwnerEmail(company.ownerEmail)}
                      </p>
                    </button>
                  )) : (
                    <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-6 text-center text-sm text-neutral-500">
                      {t('super_admin.metrics.no_past_due_watch')}
                    </div>
                  )}
                </div>
              </Card>

              <Card className="border-white/5 bg-neutral-900/40 p-5">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.25em] text-neutral-600">{t('super_admin.metrics.activation')}</p>
                    <h2 className="mt-2 text-lg font-bold text-white">{t('super_admin.metrics.active_without_usage')}</h2>
                  </div>
                  <Activity className="h-5 w-5 text-amber-300" />
                </div>
                <div className="space-y-3">
                  {activeWithoutUsageWatchlist.length > 0 ? activeWithoutUsageWatchlist.map((company) => (
                    <button
                      key={company.id}
                      type="button"
                      onClick={() => setSelectedCompanyId(company.id)}
                      className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-left transition-colors hover:border-white/20 hover:bg-white/[0.03]"
                    >
                      <p className="text-sm font-bold text-white">{company.name}</p>
                      <p className="mt-1 text-[11px] text-neutral-400">
                        {formatCurrency(companyBillingStats[company.id]?.mrr ?? 0)} MRR | {company.users} {t('super_admin.tables.users')}
                      </p>
                    </button>
                  )) : (
                    <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-6 text-center text-sm text-neutral-500">
                      {t('super_admin.metrics.no_active_without_usage')}
                    </div>
                  )}
                </div>
              </Card>

              <Card className="border-white/5 bg-neutral-900/40 p-5">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.25em] text-neutral-600">{t('super_admin.metrics.revenue')}</p>
                    <h2 className="mt-2 text-lg font-bold text-white">{t('super_admin.metrics.high_revenue_low_adoption')}</h2>
                  </div>
                  <TrendingUp className="h-5 w-5 text-blue-300" />
                </div>
                <div className="space-y-3">
                  {highRevenueLowAdoptionWatchlist.length > 0 ? highRevenueLowAdoptionWatchlist.map((company) => (
                    <button
                      key={company.id}
                      type="button"
                      onClick={() => setSelectedCompanyId(company.id)}
                      className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-left transition-colors hover:border-white/20 hover:bg-white/[0.03]"
                    >
                      <p className="text-sm font-bold text-white">{company.name}</p>
                      <p className="mt-1 text-[11px] text-neutral-400">
                        {formatCurrency(companyBillingStats[company.id]?.mrr ?? 0)} MRR | {(companyStats[company.id]?.ordersCount ?? company.orders)} {t('super_admin.latest.orders_count')}
                      </p>
                    </button>
                  )) : (
                    <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-6 text-center text-sm text-neutral-500">
                      {t('super_admin.metrics.no_high_revenue_low_adoption')}
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
