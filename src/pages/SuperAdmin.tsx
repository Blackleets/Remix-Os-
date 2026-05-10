import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  CreditCard,
  DollarSign,
  Layers3,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Users,
} from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import type { ComponentType } from 'react';
import { Card, cn } from '../components/Common';
import { db } from '../lib/firebase';
import { useLocale } from '../hooks/useLocale';
import { usePlatformAdmin } from '../hooks/usePlatformAdmin';

interface CompanyDoc {
  id: string;
  name?: string;
  ownerId?: string;
  industry?: string;
  createdAt?: any;
  subscription?: {
    planId?: 'starter' | 'pro' | 'business';
    status?: 'active' | 'past_due' | 'trialing' | 'canceled';
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
  status?: string;
}

interface PlatformMetrics {
  totalCompanies: number;
  totalUsers: number;
  activeCompanies: number;
  trialCompanies: number;
  expiredOrPastDueCompanies: number;
  starterPlans: number;
  proPlans: number;
  businessPlans: number;
  estimatedMrr: number;
  totalOrders: number;
  totalSales: number;
}

interface CompanyRow {
  id: string;
  name: string;
  ownerEmail: string;
  plan: string;
  subscriptionStatus: string;
  users: number;
  products: number;
  customers: number;
  orders: number;
  revenue: number;
  createdAt?: any;
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<PlatformMetrics>({
    totalCompanies: 0,
    totalUsers: 0,
    activeCompanies: 0,
    trialCompanies: 0,
    expiredOrPastDueCompanies: 0,
    starterPlans: 0,
    proPlans: 0,
    businessPlans: 0,
    estimatedMrr: 0,
    totalOrders: 0,
    totalSales: 0,
  });
  const [companiesTable, setCompaniesTable] = useState<CompanyRow[]>([]);
  const [usersTable, setUsersTable] = useState<UserRow[]>([]);
  const [latestCompanies, setLatestCompanies] = useState<CompanyRow[]>([]);
  const [latestUsers, setLatestUsers] = useState<UserRow[]>([]);

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
        ] = await Promise.all([
          getDocs(collection(db, 'companies')),
          getDocs(collection(db, 'users')),
          getDocs(collection(db, 'memberships')),
          getDocs(collection(db, 'products')),
          getDocs(collection(db, 'customers')),
          getDocs(collection(db, 'orders')),
        ]);

        if (!isMounted) return;

        const companies = companiesSnap.docs.map((entry) => ({ id: entry.id, ...entry.data() } as CompanyDoc));
        const users = usersSnap.docs.map((entry) => ({ id: entry.id, ...entry.data() } as UserDoc));
        const memberships = membershipsSnap.docs.map((entry) => ({ id: entry.id, ...entry.data() } as MembershipDoc));
        const products = productsSnap.docs.map((entry) => ({ id: entry.id, ...entry.data() } as ProductDoc));
        const customers = customersSnap.docs.map((entry) => ({ id: entry.id, ...entry.data() } as CustomerDoc));
        const orders = ordersSnap.docs.map((entry) => ({ id: entry.id, ...entry.data() } as OrderDoc));

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
        const totalSales = orders.reduce((sum, order) => sum + (order.total || 0), 0);

        const companyRows: CompanyRow[] = companies.map((company) => {
          const companyMemberships = membershipsByCompany.get(company.id) || [];
          const companyOrders = ordersByCompany.get(company.id) || [];
          const revenue = companyOrders.reduce((sum, order) => sum + (order.total || 0), 0);
          const ownerMembership = companyMemberships.find((membership) => membership.role === 'owner');
          const ownerUser = ownerMembership ? usersById.get(ownerMembership.userId) : undefined;

          return {
            id: company.id,
            name: company.name || 'Unnamed company',
            ownerEmail: ownerUser?.email || usersById.get(company.ownerId || '')?.email || 'No owner email',
            plan: company.subscription?.planId || 'starter',
            subscriptionStatus: company.subscription?.status || 'trialing',
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

        setMetrics({
          totalCompanies: companies.length,
          totalUsers: users.length,
          activeCompanies,
          trialCompanies,
          expiredOrPastDueCompanies,
          starterPlans,
          proPlans,
          businessPlans,
          estimatedMrr,
          totalOrders,
          totalSales,
        });
        setCompaniesTable(compareByCreatedAtDesc(companyRows));
        setUsersTable(compareByCreatedAtDesc(userRows));
        setLatestCompanies(compareByCreatedAtDesc(companyRows).slice(0, 6));
        setLatestUsers(compareByCreatedAtDesc(userRows).slice(0, 6));
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
  }, [t]);

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
          <div className="grid grid-cols-2 gap-3 lg:w-[360px]">
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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SuperMetricCard icon={Building2} label={t('super_admin.metrics.total_companies')} value={String(metrics.totalCompanies)} accent="border-blue-500/20 bg-blue-500/10 text-blue-300" />
            <SuperMetricCard icon={Users} label={t('super_admin.metrics.total_users')} value={String(metrics.totalUsers)} accent="border-white/10 bg-white/[0.03] text-white" />
            <SuperMetricCard icon={ShoppingBag} label={t('super_admin.metrics.total_orders')} value={String(metrics.totalOrders)} accent="border-emerald-500/20 bg-emerald-500/10 text-emerald-300" />
            <SuperMetricCard icon={DollarSign} label={t('super_admin.metrics.total_sales')} value={formatCurrency(metrics.totalSales)} accent="border-amber-500/20 bg-amber-500/10 text-amber-300" />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Card className="border-white/5 bg-neutral-900/40 p-5 xl:col-span-2">
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

            <Card className="border-white/5 bg-neutral-900/40 p-5">
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
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Card className="border-white/5 bg-neutral-900/40 p-5 xl:col-span-2">
              <div className="mb-5">
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-neutral-600">{t('super_admin.tables.companies_label')}</p>
                <h2 className="mt-2 text-lg font-bold text-white">{t('super_admin.tables.companies_title')}</h2>
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
                    {companiesTable.slice(0, 10).map((company) => (
                      <tr key={company.id} className="border-t border-white/[0.04]">
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
                  {latestCompanies.map((company) => (
                    <div key={company.id} className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                      <p className="text-sm font-bold text-white">{company.name}</p>
                      <p className="mt-1 text-[11px] text-neutral-400">{company.ownerEmail}</p>
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
                  {latestUsers.map((user) => (
                    <div key={user.id} className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                      <p className="text-sm font-bold text-white">{user.displayName}</p>
                      <p className="mt-1 text-[11px] text-neutral-400">{user.email}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
