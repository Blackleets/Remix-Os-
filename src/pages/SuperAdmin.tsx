import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Building2,
  CreditCard,
  DollarSign,
  Flame,
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
} from 'lucide-react';
import { addDoc, collection, doc, getDocs, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import type { ComponentType } from 'react';
import { Button, Card, cn, Input, Label } from '../components/Common';
import { db } from '../lib/firebase';
import { useLocale } from '../hooks/useLocale';
import { usePlatformAdmin } from '../hooks/usePlatformAdmin';

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

interface UserRow {
  id: string;
  email: string;
  displayName: string;
  companyName: string;
  role: string;
  createdAt?: any;
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

interface PlatformAuditLog {
  type: string;
  companyId?: string;
  actorUid: string;
  payload?: Record<string, unknown>;
  createdAt?: unknown;
}

const PLAN_MRR: Record<string, number> = {
  starter: 29,
  pro: 99,
  business: 299,
};

function toDate(value: any) {
  if (!value) return null;
  if (value?.toDate) return value.toDate() as Date;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
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
  });
  const [companiesTable, setCompaniesTable] = useState<CompanyRow[]>([]);
  const [usersTable, setUsersTable] = useState<UserRow[]>([]);
  const [latestUsers, setLatestUsers] = useState<UserRow[]>([]);
  const [companyControls, setCompanyControls] = useState<Record<string, PlatformCompanyControlDoc>>({});
  const [companyStats, setCompanyStats] = useState<Record<string, CompanyStatsDoc>>({});
  const [controlForm, setControlForm] = useState<CompanyControlForm>({
    lifecycleStatus: 'active',
    priority: 'normal',
    nextAction: '',
    assignedTo: '',
    notes: '',
  });
  const [savingControl, setSavingControl] = useState(false);
  const [syncingStats, setSyncingStats] = useState(false);
  const [controlFeedback, setControlFeedback] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadPlatformData = async () => {
      setLoading(true);
      setError(null);

      try {
        const [
          companiesSnap,
          usersSnap,
          membershipsSnap,
          productsSnap,
          customersSnap,
          ordersSnap,
          controlsSnap,
          statsSnap,
        ] = await Promise.all([
          getDocs(collection(db, 'companies')),
          getDocs(collection(db, 'users')),
          getDocs(collection(db, 'memberships')),
          getDocs(collection(db, 'products')),
          getDocs(collection(db, 'customers')),
          getDocs(collection(db, 'orders')),
          getDocs(collection(db, 'platformCompanyControls')),
          getDocs(collection(db, 'companyStats')),
        ]);

        if (!isMounted) return;

        const companies = companiesSnap.docs.map((entry) => ({ id: entry.id, ...entry.data() } as CompanyDoc));
        const users = usersSnap.docs.map((entry) => ({ id: entry.id, ...entry.data() } as UserDoc));
        const memberships = membershipsSnap.docs.map((entry) => ({ id: entry.id, ...entry.data() } as MembershipDoc));
        const products = productsSnap.docs.map((entry) => ({ id: entry.id, ...entry.data() } as ProductDoc));
        const customers = customersSnap.docs.map((entry) => ({ id: entry.id, ...entry.data() } as CustomerDoc));
        const orders = ordersSnap.docs.map((entry) => ({ id: entry.id, ...entry.data() } as OrderDoc));
        const controls = Object.fromEntries(
          controlsSnap.docs.map((entry) => [entry.id, { companyId: entry.id, ...entry.data() } as PlatformCompanyControlDoc])
        );
        const stats = Object.fromEntries(
          statsSnap.docs.map((entry) => [entry.id, { companyId: entry.id, ...entry.data() } as CompanyStatsDoc])
        );

        const usersById = new Map(users.map((user) => [user.id, user]));
        const companyNameById = new Map(companies.map((company) => [company.id, company.name || 'Unknown company']));
        const membershipsByCompany = new Map<string, MembershipDoc[]>();
        const productsByCompany = new Map<string, number>();
        const customersByCompany = new Map<string, number>();
        const ordersByCompany = new Map<string, OrderDoc[]>();

        memberships.forEach((membership) => {
          membershipsByCompany.set(
            membership.companyId,
            [...(membershipsByCompany.get(membership.companyId) || []), membership]
          );
        });

        products.forEach((product) => {
          productsByCompany.set(product.companyId, (productsByCompany.get(product.companyId) || 0) + 1);
        });

        customers.forEach((customer) => {
          customersByCompany.set(customer.companyId, (customersByCompany.get(customer.companyId) || 0) + 1);
        });

        orders.forEach((order) => {
          ordersByCompany.set(order.companyId, [...(ordersByCompany.get(order.companyId) || []), order]);
        });

        const now = new Date();
        const activeCompanies = companies.filter((company) => company.subscription?.status === 'active').length;
        const trialCompanies = companies.filter((company) => company.subscription?.status === 'trialing').length;
        const expiredOrPastDueCompanies = companies.filter((company) => {
          if (company.subscription?.status === 'past_due' || company.subscription?.status === 'canceled') return true;
          if (company.subscription?.status === 'trialing') {
            const trialEndsAt = toDate(company.subscription?.trialEndsAt);
            return Boolean(trialEndsAt && trialEndsAt < now);
          }
          return false;
        }).length;

        const starterPlans = companies.filter((company) => (company.subscription?.planId || 'starter') === 'starter').length;
        const proPlans = companies.filter((company) => company.subscription?.planId === 'pro').length;
        const businessPlans = companies.filter((company) => company.subscription?.planId === 'business').length;
        const estimatedMrr = companies.reduce((sum, company) => {
          const status = company.subscription?.status || 'trialing';
          if (!['active', 'past_due'].includes(status)) return sum;
          const planId = company.subscription?.planId || 'starter';
          return sum + (PLAN_MRR[planId] || 0);
        }, 0);
        const totalOrders = orders.length;
        const totalSales = orders.reduce((sum, order) => sum + normalizeOrderTotal(order), 0);
        const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;
        const monthlyPlatformSales = orders
          .filter((order) => isCurrentMonth(order.createdAt))
          .reduce((sum, order) => sum + normalizeOrderTotal(order), 0);
        const estimatedArr = estimatedMrr * 12;

        const companyRows: CompanyRow[] = companies.map((company) => {
          const companyMemberships = membershipsByCompany.get(company.id) || [];
          const companyOrders = ordersByCompany.get(company.id) || [];
          const revenue = companyOrders.reduce((sum, order) => sum + normalizeOrderTotal(order), 0);
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
            users: companyMemberships.length,
            products: productsByCompany.get(company.id) || 0,
            customers: customersByCompany.get(company.id) || 0,
            orders: companyOrders.length,
            revenue,
            createdAt: company.createdAt,
          };
        });

        const userRows: UserRow[] = users.map((user) => {
          const membership = memberships.find((entry) => entry.userId === user.id);
          return {
            id: user.id,
            email: user.email || 'No email',
            displayName: user.displayName || 'Unnamed user',
            companyName: membership ? companyNameById.get(membership.companyId) || 'Unknown company' : 'No company',
            role: membership?.role || 'unassigned',
            createdAt: user.createdAt,
          };
        });

        const companiesWithoutOrders = companyRows.filter((company) => company.orders === 0).length;
        const ownerlessCompanies = companyRows.filter((company) => company.ownerEmail === 'No owner email').length;
        const statsCoverage = companies.length > 0 ? Math.round((Object.keys(stats).length / companies.length) * 100) : 0;
        const activeNoConversionCompanies = companyRows.filter(
          (company) => company.subscriptionStatus === 'active' && company.orders === 0
        ).length;
        const pastDueWatchCount = companyRows.filter((company) => company.subscriptionStatus === 'past_due').length;
        const trialExpiringSoon = companies.filter((company) => {
          if (company.subscription?.status !== 'trialing') return false;
          const trialEndsAt = toDate(company.subscription?.trialEndsAt);
          if (!trialEndsAt || trialEndsAt < now) return false;
          const diff = trialEndsAt.getTime() - now.getTime();
          const days = diff / (1000 * 60 * 60 * 24);
          return days <= 7;
        }).length;

        setMetrics({
          totalCompanies: companies.length,
          totalUsers: users.length,
          totalProducts: products.length,
          totalCustomers: customers.length,
          activeCompanies,
          trialCompanies,
          expiredOrPastDueCompanies,
          starterPlans,
          proPlans,
          businessPlans,
          estimatedMrr,
          totalOrders,
          totalSales,
          averageOrderValue,
          companiesWithoutOrders,
          trialExpiringSoon,
          ownerlessCompanies,
          estimatedArr,
          monthlyPlatformSales,
          statsCoverage,
          activeNoConversionCompanies,
          pastDueWatchCount,
        });
        setCompaniesTable(compareByCreatedAtDesc(companyRows));
        setUsersTable(compareByCreatedAtDesc(userRows));
        setLatestUsers(compareByCreatedAtDesc(userRows).slice(0, 6));
        setCompanyControls(controls);
        setCompanyStats(stats);
        if (!selectedCompanyId && companyRows.length > 0) {
          setSelectedCompanyId(compareByCreatedAtDesc(companyRows)[0].id);
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

    if (companiesTable.some((company) => company.ownerEmail === 'No owner email')) {
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

  const pastDueWatchlist = useMemo(
    () =>
      companiesTable
        .filter((company) => company.subscriptionStatus === 'past_due')
        .sort((a, b) => {
          const aRevenue = companyStats[a.id]?.monthlyRevenue ?? 0;
          const bRevenue = companyStats[b.id]?.monthlyRevenue ?? 0;
          return bRevenue - aRevenue;
        })
        .slice(0, 6),
    [companiesTable, companyStats]
  );

  const activationWatchlist = useMemo(
    () =>
      companiesTable
        .filter(
          (company) =>
            company.orders === 0 ||
            company.subscriptionStatus === 'past_due' ||
            company.subscriptionStatus === 'canceled' ||
            company.ownerEmail === 'No owner email'
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
        company.industry.toLowerCase().includes(normalized);
      return statusMatch && searchMatch;
    });
  }, [companiesTable, companySearch, statusFilter]);

  const selectedCompany =
    filteredCompanies.find((company) => company.id === selectedCompanyId) ||
    companiesTable.find((company) => company.id === selectedCompanyId) ||
    filteredCompanies[0] ||
    companiesTable[0] ||
    null;

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
  const selectedTenantAgeDays = selectedCompany
    ? Math.max(
        0,
        Math.floor(((new Date()).getTime() - (toDate(selectedCompany.createdAt)?.getTime() || Date.now())) / (1000 * 60 * 60 * 24))
      )
    : 0;
  const selectedMonetizationPressure = selectedCompany
    ? selectedCompany.subscriptionStatus === 'past_due'
      ? t('super_admin.company_panel.pressure_high')
      : selectedCompany.subscriptionStatus === 'trialing' && selectedCompany.orders > 0
        ? t('super_admin.company_panel.pressure_conversion')
        : !selectedStats
          ? t('super_admin.company_panel.pressure_pending')
          : (selectedStats.monthlyRevenue || 0) === 0
            ? t('super_admin.company_panel.pressure_low_signal')
            : t('super_admin.company_panel.pressure_healthy')
    : '';

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
  }, [companyControls, selectedCompany?.id]);

  const saveCompanyControl = async () => {
    if (!selectedCompany || !platformAdmin?.uid) return;
    setSavingControl(true);
    setControlFeedback(null);
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
    } catch (saveError) {
      console.error('Failed to save platform company control:', saveError);
      setControlFeedback(t('super_admin.company_panel.save_failed'));
    } finally {
      setSavingControl(false);
    }
  };

  const syncCompanyStats = async () => {
    if (!platformAdmin?.uid) return;
    setSyncingStats(true);
    setError(null);
    try {
      const [membershipsSnap, productsSnap, customersSnap, ordersSnap] = await Promise.all([
        getDocs(collection(db, 'memberships')),
        getDocs(collection(db, 'products')),
        getDocs(collection(db, 'customers')),
        getDocs(collection(db, 'orders')),
      ]);

      const memberships = membershipsSnap.docs.map((entry) => ({ id: entry.id, ...entry.data() } as MembershipDoc));
      const products = productsSnap.docs.map((entry) => ({ id: entry.id, ...entry.data() } as ProductDoc));
      const customers = customersSnap.docs.map((entry) => ({ id: entry.id, ...entry.data() } as CustomerDoc));
      const orders = ordersSnap.docs.map((entry) => ({ id: entry.id, ...entry.data() } as OrderDoc));

      const productsByCompany = new Map<string, number>();
      const customersByCompany = new Map<string, number>();
      const membershipsByCompany = new Map<string, number>();
      const ordersByCompany = new Map<string, OrderDoc[]>();

      memberships.forEach((membership) => {
        membershipsByCompany.set(membership.companyId, (membershipsByCompany.get(membership.companyId) || 0) + 1);
      });
      products.forEach((product) => {
        productsByCompany.set(product.companyId, (productsByCompany.get(product.companyId) || 0) + 1);
      });
      customers.forEach((customer) => {
        customersByCompany.set(customer.companyId, (customersByCompany.get(customer.companyId) || 0) + 1);
      });
      orders.forEach((order) => {
        ordersByCompany.set(order.companyId, [...(ordersByCompany.get(order.companyId) || []), order]);
      });

      const batch = writeBatch(db);
      const nextStats: Record<string, CompanyStatsDoc> = {};

      companiesTable.forEach((company) => {
        const companyOrders = ordersByCompany.get(company.id) || [];
        const sortedOrders = [...companyOrders].sort((a, b) => {
          const aTime = toDate(a.createdAt)?.getTime() || 0;
          const bTime = toDate(b.createdAt)?.getTime() || 0;
          return aTime - bTime;
        });
        const payload: CompanyStatsDoc = {
          companyId: company.id,
          ordersCount: companyOrders.length,
          customersCount: customersByCompany.get(company.id) || 0,
          productsCount: productsByCompany.get(company.id) || 0,
          lifetimeRevenue: companyOrders.reduce((sum, order) => sum + normalizeOrderTotal(order), 0),
          monthlyRevenue: companyOrders
            .filter((order) => isCurrentMonth(order.createdAt))
            .reduce((sum, order) => sum + normalizeOrderTotal(order), 0),
          firstOrderAt: sortedOrders[0]?.createdAt || null,
          lastOrderAt: sortedOrders[sortedOrders.length - 1]?.createdAt || null,
          activeUsers: membershipsByCompany.get(company.id) || 0,
          updatedAt: serverTimestamp(),
        };
        nextStats[company.id] = payload;
        batch.set(doc(db, 'companyStats', company.id), payload, { merge: true });
      });

      batch.set(
        doc(collection(db, 'platformAuditLogs')),
        {
          type: 'company_stats_synced',
          actorUid: platformAdmin.uid,
          payload: {
            companies: companiesTable.length,
          },
          createdAt: serverTimestamp(),
        } as PlatformAuditLog
      );

      await batch.commit();
      setCompanyStats((current) => ({ ...current, ...nextStats }));
      setRefreshKey((current) => current + 1);
      setControlFeedback(t('super_admin.metrics.sync_success'));
    } catch (syncError) {
      console.error('Failed to sync company stats:', syncError);
      setError(t('super_admin.errors.stats_sync_failed'));
    } finally {
      setSyncingStats(false);
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
            <div className="grid grid-cols-2 gap-3">
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
          {error}
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
                  <h2 className="mt-2 text-lg font-bold text-white">{t('super_admin.metrics.estimated_mrr')}</h2>
                </div>
                <CreditCard className="h-5 w-5 text-emerald-300" />
              </div>
              <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-200/80">{t('super_admin.metrics.projected_mrr')}</p>
                <p className="mt-4 text-4xl font-bold tracking-tight text-white">{formatCurrency(metrics.estimatedMrr)}</p>
              </div>
              <p className="mt-4 text-xs leading-relaxed text-neutral-500">
                {t('super_admin.metrics.mrr_note')}
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
                  <h2 className="mt-2 text-lg font-bold text-white">{t('super_admin.metrics.arr_estimated')}</h2>
                </div>
                <TrendingUp className="h-5 w-5 text-emerald-300" />
              </div>
              <div className="space-y-3">
                <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600">{t('super_admin.metrics.arr_estimated')}</p>
                  <p className="mt-3 text-2xl font-bold text-white">{formatCurrency(metrics.estimatedArr)}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600">{t('super_admin.metrics.monthly_platform_sales')}</p>
                  <p className="mt-3 text-2xl font-bold text-white">{formatCurrency(metrics.monthlyPlatformSales)}</p>
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
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCompanies.slice(0, 10).map((company) => (
                      <tr
                        key={company.id}
                        className={cn(
                          'cursor-pointer border-t border-white/[0.04] transition-colors hover:bg-white/[0.02]',
                          selectedCompany?.id === company.id && 'bg-blue-500/[0.06]'
                        )}
                        onClick={() => setSelectedCompanyId(company.id)}
                      >
                        <td className="table-cell font-semibold text-white">{company.name}</td>
                        <td className="table-cell text-neutral-400">{company.ownerEmail}</td>
                        <td className="table-cell uppercase text-neutral-300">{company.plan}</td>
                        <td className="table-cell uppercase text-neutral-300">{company.subscriptionStatus}</td>
                        <td className="table-cell text-neutral-300">{company.users}</td>
                        <td className="table-cell text-neutral-300">{company.products}</td>
                        <td className="table-cell text-neutral-300">{company.customers}</td>
                        <td className="table-cell text-neutral-300">{company.orders}</td>
                        <td className="table-cell text-white font-mono">{formatCurrency(company.revenue)}</td>
                        <td className="table-cell text-neutral-400">{toDate(company.createdAt)?.toLocaleDateString() || '-'}</td>
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
                          <p className="mt-1 text-sm font-semibold uppercase text-white">{selectedCompany.subscriptionStatus}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-600">{t('super_admin.company_panel.owner')}</p>
                          <p className="mt-1 text-sm text-neutral-300 break-all">{selectedCompany.ownerEmail}</p>
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
                          {toDate(selectedCompany.currentPeriodEnd || selectedCompany.trialEndsAt)?.toLocaleDateString() || '-'}
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
                      {selectedStats ? (
                        <>
                          <div className="mt-3 grid grid-cols-2 gap-3">
                            <div><p className="text-[10px] text-neutral-600">{t('super_admin.company_panel.lifetime_revenue')}</p><p className="mt-1 text-lg font-bold text-white">{formatCurrency(selectedStats.lifetimeRevenue)}</p></div>
                            <div><p className="text-[10px] text-neutral-600">{t('super_admin.company_panel.monthly_revenue')}</p><p className="mt-1 text-lg font-bold text-white">{formatCurrency(selectedStats.monthlyRevenue)}</p></div>
                            <div><p className="text-[10px] text-neutral-600">{t('super_admin.company_panel.last_sale')}</p><p className="mt-1 text-sm font-semibold text-white">{toDate(selectedStats.lastOrderAt)?.toLocaleDateString() || '-'}</p></div>
                            <div><p className="text-[10px] text-neutral-600">{t('super_admin.company_panel.first_sale')}</p><p className="mt-1 text-sm font-semibold text-white">{toDate(selectedStats.firstOrderAt)?.toLocaleDateString() || '-'}</p></div>
                            <div><p className="text-[10px] text-neutral-600">{t('super_admin.company_panel.active_users')}</p><p className="mt-1 text-lg font-bold text-white">{selectedStats.activeUsers}</p></div>
                            <div><p className="text-[10px] text-neutral-600">{t('super_admin.company_panel.tenant_age')}</p><p className="mt-1 text-lg font-bold text-white">{selectedTenantAgeDays}d</p></div>
                          </div>
                          <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                            <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-600">{t('super_admin.company_panel.monetization_pressure')}</p>
                            <p className="mt-2 text-sm font-semibold text-white">{selectedMonetizationPressure}</p>
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
                              value={controlForm.lifecycleStatus}
                              onChange={(event) =>
                                setControlForm((current) => ({
                                  ...current,
                                  lifecycleStatus: event.target.value as CompanyControlForm['lifecycleStatus'],
                                }))
                              }
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
                              value={controlForm.priority}
                              onChange={(event) =>
                                setControlForm((current) => ({
                                  ...current,
                                  priority: event.target.value as CompanyControlForm['priority'],
                                }))
                              }
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
                            onChange={(event) =>
                              setControlForm((current) => ({
                                ...current,
                                assignedTo: event.target.value,
                              }))
                            }
                            placeholder={t('super_admin.company_panel.assigned_placeholder')}
                          />
                        </div>

                        <div>
                          <Label>{t('super_admin.company_panel.next_action')}</Label>
                          <Input
                            value={controlForm.nextAction}
                            onChange={(event) =>
                              setControlForm((current) => ({
                                ...current,
                                nextAction: event.target.value,
                              }))
                            }
                            placeholder={t('super_admin.company_panel.next_action_placeholder')}
                          />
                        </div>

                        <div>
                          <Label>{t('super_admin.company_panel.notes')}</Label>
                          <textarea
                            value={controlForm.notes}
                            onChange={(event) =>
                              setControlForm((current) => ({
                                ...current,
                                notes: event.target.value,
                              }))
                            }
                            placeholder={t('super_admin.company_panel.notes_placeholder')}
                            className="min-h-[120px] w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-neutral-600 focus:border-blue-500/50 focus:outline-none"
                          />
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs text-neutral-500">
                            {controlFeedback || t('super_admin.company_panel.controls_note')}
                          </p>
                          <Button
                            onClick={saveCompanyControl}
                            disabled={savingControl}
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
            <Card className="border-white/5 bg-neutral-900/40 p-5 xl:col-span-2">
              <div className="mb-5">
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-neutral-600">{t('super_admin.tables.users_label')}</p>
                <h2 className="mt-2 text-lg font-bold text-white">{t('super_admin.tables.users_title')}</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="table-header">{t('super_admin.tables.user_email')}</th>
                      <th className="table-header">{t('super_admin.tables.user_name')}</th>
                      <th className="table-header">{t('super_admin.tables.company')}</th>
                      <th className="table-header">{t('super_admin.tables.user_role')}</th>
                      <th className="table-header">{t('super_admin.tables.registered_at')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersTable.slice(0, 12).map((user) => (
                      <tr key={user.id} className="border-t border-white/[0.04]">
                        <td className="table-cell text-white">{user.email}</td>
                        <td className="table-cell text-neutral-300">{user.displayName}</td>
                        <td className="table-cell text-neutral-300">{user.companyName}</td>
                        <td className="table-cell uppercase text-neutral-300">{user.role}</td>
                        <td className="table-cell text-neutral-400">{toDate(user.createdAt)?.toLocaleDateString() || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

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
                    <div key={company.id} className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-white">{company.name}</p>
                          <p className="mt-1 text-[11px] text-neutral-400">{company.orders} {t('super_admin.latest.orders_count')}</p>
                        </div>
                        <p className="text-[11px] font-mono font-bold text-emerald-300">{formatCurrency(company.revenue)}</p>
                      </div>
                    </div>
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
                    <div key={company.id} className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                      <p className="text-sm font-bold text-white">{company.name}</p>
                      <p className="mt-1 text-[11px] text-neutral-400">
                        {company.orders === 0
                          ? t('super_admin.latest.no_orders_watch')
                          : `${company.subscriptionStatus.toUpperCase()} | ${company.ownerEmail}`}
                      </p>
                    </div>
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
                    <p className="text-[10px] font-black uppercase tracking-[0.25em] text-neutral-600">{t('super_admin.metrics.activation')}</p>
                    <h2 className="mt-2 text-lg font-bold text-white">{t('super_admin.metrics.trial_to_paid_watch')}</h2>
                  </div>
                  <Sparkles className="h-5 w-5 text-emerald-300" />
                </div>
                <div className="space-y-3">
                  {trialToPaidWatchlist.length > 0 ? trialToPaidWatchlist.map((company) => (
                    <div key={company.id} className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                      <p className="text-sm font-bold text-white">{company.name}</p>
                      <p className="mt-1 text-[11px] text-neutral-400">
                        {formatCurrency(companyStats[company.id]?.monthlyRevenue ?? 0)} | {company.orders} {t('super_admin.latest.orders_count')}
                      </p>
                    </div>
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
                    <h2 className="mt-2 text-lg font-bold text-white">{t('super_admin.metrics.past_due_watch')}</h2>
                  </div>
                  <AlertTriangle className="h-5 w-5 text-red-300" />
                </div>
                <div className="space-y-3">
                  {pastDueWatchlist.length > 0 ? pastDueWatchlist.map((company) => (
                    <div key={company.id} className="rounded-2xl border border-red-500/10 bg-red-500/[0.06] px-4 py-3">
                      <p className="text-sm font-bold text-white">{company.name}</p>
                      <p className="mt-1 text-[11px] text-neutral-300">
                        {formatCurrency(companyStats[company.id]?.monthlyRevenue ?? 0)} | {company.ownerEmail}
                      </p>
                    </div>
                  )) : (
                    <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-6 text-center text-sm text-neutral-500">
                      {t('super_admin.metrics.no_past_due_watch')}
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
