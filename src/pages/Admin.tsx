import { useEffect, useState } from 'react';
import { auth } from '../lib/firebase';
import { Building2, Users, Zap, TrendingUp, Search, RefreshCcw, ShieldAlert, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';

interface CompanyRow {
  id: string;
  name: string;
  industry: string;
  ownerEmail: string;
  plan: string;
  status: string;
  trialEndsAt: string | null;
  createdAt: string | null;
  memberCount: number;
}

interface AdminStats {
  totalCompanies: number;
  totalUsers: number;
  trialing: number;
  paid: number;
  canceled: number;
}

async function authedGet(url: string) {
  const token = await auth.currentUser?.getIdToken();
  return fetch(url, {
    headers: { Authorization: token ? `Bearer ${token}` : '' },
  });
}

export function Admin() {
  const { user } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const superAdminUid = import.meta.env.VITE_SUPER_ADMIN_UID;
  const isSuperAdmin = user?.uid === superAdminUid;

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authedGet('/api/admin/overview');
      if (res.status === 403) { setError('Access denied.'); return; }
      if (!res.ok) { setError('Failed to load admin data.'); return; }
      const data = await res.json();
      setStats(data.stats);
      setCompanies(data.companies);
    } catch (e: any) {
      setError(e.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <ShieldAlert className="w-8 h-8 text-red-400" />
        </div>
        <div>
          <p className="font-bold text-white">Access Denied</p>
          <p className="text-neutral-500 text-sm mt-1">Super admin privileges required.</p>
        </div>
      </div>
    );
  }

  const filtered = companies.filter(c => {
    const matchSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.ownerEmail.toLowerCase().includes(search.toLowerCase()) ||
      c.industry.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || c.status === filterStatus || (filterStatus === 'paid' && c.plan !== 'starter');
    return matchSearch && matchStatus;
  });

  const getTrialDays = (trialEndsAt: string | null) => {
    if (!trialEndsAt) return null;
    return differenceInDays(new Date(trialEndsAt), new Date());
  };

  const statusBadge = (status: string, plan: string, trialEndsAt: string | null) => {
    const days = getTrialDays(trialEndsAt);
    if (status === 'trialing') {
      const urgent = days !== null && days <= 3;
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${urgent ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'}`}>
          <Clock className="w-3 h-3" />
          {days !== null ? (days < 0 ? 'Expired' : `${days}d left`) : 'Trial'}
        </span>
      );
    }
    if (status === 'canceled') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border bg-neutral-500/10 border-neutral-500/20 text-neutral-500">
          <XCircle className="w-3 h-3" /> Canceled
        </span>
      );
    }
    if (plan !== 'starter') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border bg-emerald-500/10 border-emerald-500/20 text-emerald-400">
          <CheckCircle2 className="w-3 h-3" /> Paid
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border bg-blue-500/10 border-blue-500/20 text-blue-400">
        <CheckCircle2 className="w-3 h-3" /> Free
      </span>
    );
  };

  const planBadge = (plan: string) => {
    const colors: Record<string, string> = {
      starter: 'text-neutral-500',
      pro: 'text-blue-400',
      business: 'text-purple-400',
    };
    return <span className={`text-xs font-black uppercase tracking-widest ${colors[plan] || 'text-neutral-500'}`}>{plan}</span>;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-black text-red-400 uppercase tracking-widest border border-red-500/20 bg-red-500/5 px-2 py-0.5 rounded-full">Super Admin</span>
          </div>
          <h1 className="font-display text-4xl font-bold tracking-tight text-white">Platform Overview</h1>
          <p className="text-neutral-500 text-sm mt-1">All companies and users across the platform.</p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm font-bold text-neutral-300 hover:bg-white/10 transition-all disabled:opacity-50"
        >
          <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { label: 'Companies', value: stats.totalCompanies, icon: Building2, color: 'text-blue-400' },
            { label: 'Users', value: stats.totalUsers, icon: Users, color: 'text-emerald-400' },
            { label: 'Trialing', value: stats.trialing, icon: Clock, color: 'text-amber-400' },
            { label: 'Paid', value: stats.paid, icon: TrendingUp, color: 'text-purple-400' },
            { label: 'Canceled', value: stats.canceled, icon: XCircle, color: 'text-neutral-500' },
          ].map(s => (
            <div key={s.label} className="bg-neutral-900/60 border border-white/5 rounded-2xl p-5 space-y-3">
              <s.icon className={`w-5 h-5 ${s.color}`} />
              <div>
                <p className="text-2xl font-bold text-white font-mono">{s.value}</p>
                <p className="text-[10px] font-black text-neutral-600 uppercase tracking-widest mt-0.5">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by company, owner, industry..."
            className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['all', 'trialing', 'active', 'paid', 'canceled'].map(f => (
            <button
              key={f}
              onClick={() => setFilterStatus(f)}
              className={`px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all border ${filterStatus === f ? 'bg-blue-600 border-blue-400/30 text-white' : 'bg-white/[0.03] border-white/[0.07] text-neutral-500 hover:text-neutral-300'}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-neutral-900/40 border border-white/5 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-neutral-600 text-sm">Loading platform data...</div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center text-neutral-600 text-sm">No companies match your search.</div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-neutral-900/80">
                    {['Company', 'Owner', 'Industry', 'Plan', 'Status', 'Members', 'Created'].map(h => (
                      <th key={h} className="table-header">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => (
                    <tr key={c.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors last:border-0">
                      <td className="table-cell font-bold text-white">{c.name}</td>
                      <td className="table-cell">
                        <span className="text-[11px] text-neutral-400 font-mono">{c.ownerEmail || '—'}</span>
                      </td>
                      <td className="table-cell text-neutral-500 text-xs">{c.industry || '—'}</td>
                      <td className="table-cell">{planBadge(c.plan)}</td>
                      <td className="table-cell">{statusBadge(c.status, c.plan, c.trialEndsAt)}</td>
                      <td className="table-cell">
                        <span className="flex items-center gap-1.5 text-neutral-400 text-xs">
                          <Users className="w-3.5 h-3.5" /> {c.memberCount}
                        </span>
                      </td>
                      <td className="table-cell">
                        <span className="text-[10px] font-mono text-neutral-600">
                          {c.createdAt ? format(new Date(c.createdAt), 'MMM dd, yyyy') : '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-white/[0.04]">
              {filtered.map(c => (
                <div key={c.id} className="p-4 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold text-white">{c.name}</p>
                      <p className="text-[11px] text-neutral-500 font-mono mt-0.5">{c.ownerEmail || '—'}</p>
                    </div>
                    {statusBadge(c.status, c.plan, c.trialEndsAt)}
                  </div>
                  <div className="flex gap-4 text-xs text-neutral-600">
                    <span>{planBadge(c.plan)}</span>
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {c.memberCount}</span>
                    <span>{c.createdAt ? format(new Date(c.createdAt), 'MMM dd') : '—'}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <p className="text-[10px] text-neutral-700 text-center font-mono">
        {filtered.length} of {companies.length} companies · Last refreshed {new Date().toLocaleTimeString()}
      </p>
    </div>
  );
}
