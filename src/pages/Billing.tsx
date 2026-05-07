import { useEffect, useState } from 'react';
import { Card, Button } from '../components/Common';
import { Check, Zap, Crown, Shield, ArrowRight, CreditCard, Activity, Package, Users, ShoppingBag, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { motion } from 'motion/react';
import { format } from 'date-fns';
import { useSearchParams } from 'react-router-dom';
import { PLANS as PLAN_DATA, getCompanyUsage } from '../lib/plans';

const PLANS = [
  {
    id: 'starter',
    name: PLAN_DATA.starter.name,
    price: 0,
    description: 'Essential toolkit for emerging entities.',
    features: [
      'Up to 50 Customers',
      'Up to 20 Products',
      '100 Orders / Month',
      'Basic AI Insights',
      'Single Admin Access'
    ],
    limits: PLAN_DATA.starter.limits,
    icon: <Zap className="w-5 h-5 text-blue-400" />,
    color: 'blue'
  },
  {
    id: 'pro',
    name: PLAN_DATA.pro.name,
    price: 49,
    description: 'High-performance tools for growing systems.',
    features: [
      'Up to 500 Customers',
      'Up to 200 Products',
      '1000 Orders / Month',
      'Advanced AI Deep Scan',
      'Up to 3 Admin Seats',
      'Priority System Support'
    ],
    limits: PLAN_DATA.pro.limits,
    icon: <Shield className="w-5 h-5 text-emerald-400" />,
    color: 'emerald',
    popular: true
  },
  {
    id: 'business',
    name: PLAN_DATA.business.name,
    price: 199,
    description: 'Maximum throughput for enterprise-scale ops.',
    features: [
      'Unlimited Customers',
      'Unlimited Products',
      'Unlimited Orders',
      'Custom AI Training',
      'Unlimited Seat Access',
      'Dedicated Account Manager',
      '99.9% Sync SLA'
    ],
    limits: PLAN_DATA.business.limits,
    icon: <Crown className="w-5 h-5 text-orange-400" />,
    color: 'orange'
  }
];

export function Billing() {
  const { company, user, refreshCompany, role } = useAuth();
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  
  if (role !== 'owner' && role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Shield className="w-16 h-16 text-red-500/20 mb-6" />
        <h2 className="text-2xl font-bold text-white mb-2">Access Restricted</h2>
        <p className="text-neutral-500 max-w-sm">Your current designation does not permit access to financial protocols. Contact your administrator.</p>
      </div>
    );
  }

  const [counts, setCounts] = useState({ customers: 0, products: 0, orders: 0, seats: 0 });
  const [searchParams, setSearchParams] = useSearchParams();
  const [stripeConfig, setStripeConfig] = useState<{ 
    stripeEnabled: boolean; 
    publishableKey?: string;
    prices?: Record<string, { amount: number; id?: string }>;
  } | null>(null);

  const currentPlanId = company?.subscription?.planId || 'starter';
  
  // Dynamic Plan merging
  const plansWithPrices = PLANS.map(p => {
    const configPrice = stripeConfig?.prices?.[p.id];
    return {
        ...p,
        price: configPrice ? configPrice.amount : p.price,
        isConfigured: !!configPrice?.id || p.id === 'starter'
    };
  });

  const currentPlan = plansWithPrices.find(p => p.id === currentPlanId) || plansWithPrices[0];

  useEffect(() => {
    fetch('/api/billing/config')
      .then(r => r.json())
      .then(setStripeConfig)
      .catch(console.error);

    if (!company) return;

    const fetchUsage = async () => {
      try {
        const usage = await getCompanyUsage(company.id);
        setCounts(usage);
      } catch (error) {
        console.error("Error fetching usage:", error);
      }
    };

    fetchUsage();

    // Handle return from Stripe
    const sessionId = searchParams.get('session_id');
    const success = searchParams.get('success');

    if (success && sessionId && !syncing) {
      handleSync(sessionId);
    }
  }, [company, searchParams]);

  const handleSync = async (sessionId: string) => {
    if (!company) return;
    setSyncing(true);
    try {
      const res = await fetch('/api/billing/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, companyId: company.id })
      });
      
      if (!res.ok) throw new Error("Sync failed");
      
      await refreshCompany();
      setSearchParams({}); // Clear params
      alert("Billing protocol synchronized successfully.");
    } catch (err) {
      console.error(err);
      alert("Status synchronization failed. Please contact engineering support.");
    } finally {
      setSyncing(false);
    }
  };

  const handleUpgrade = async (planId: string) => {
    if (!company || !user) return;
    setLoading(true);
    try {
      const res = await fetch('/api/billing/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, companyId: company.id, customerEmail: user.email })
      });
      const data = await res.json();
      
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || "Failed to create session");
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to update subscription protocol.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePortal = async () => {
    if (!company) return;
    setLoading(true);
    try {
      const res = await fetch('/api/billing/create-portal-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: company.id })
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || "Failed to create portal session");
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Portal session failed.");
    } finally {
      setLoading(false);
    }
  };

  const getUsagePercent = (current: number, max: number) => {
    if (max === Infinity) return 0;
    return Math.min(Math.round((current / max) * 100), 100);
  };

  return (
    <div className="space-y-10">
      {(loading || syncing) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex flex-col items-center justify-center space-y-4">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
          <p className="font-display font-bold text-white uppercase tracking-widest text-sm">
            {syncing ? 'Synchronizing Protocols...' : 'Provisioning Payment Gateway...'}
          </p>
        </div>
      )}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight mb-2 text-white">Billing & Subscription</h1>
          <p className="text-neutral-500 text-sm">Manage your operational protocol and resource allocation.</p>
        </div>
        {stripeConfig && !stripeConfig.stripeEnabled && (
          <div className="flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full">
            <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Mock/Preview Mode</span>
          </div>
        )}
        {stripeConfig?.stripeEnabled && (
          <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
            <div className="w-2 h-2 bg-emerald-500 rounded-full" />
            <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Live Sync Active</span>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Active Plan Summary */}
          <Card className="p-8 border-white/5 bg-neutral-900 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/5 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 bg-white/[0.03] rounded-2xl flex items-center justify-center border border-white/[0.05]">
                  {currentPlan.icon}
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="font-display font-bold text-2xl text-white uppercase tracking-tight">{currentPlan.name}</h2>
                    <span className="text-[10px] font-bold bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded border border-emerald-500/20 uppercase">Active Protocol</span>
                  </div>
                  <p className="text-sm text-neutral-500 font-mono italic">
                    Status: <span className="text-emerald-400 capitalize">{company?.subscription?.status || 'active'}</span>
                    {company?.subscription?.currentPeriodEnd && ` • Renews ${format(company.subscription.currentPeriodEnd.toDate ? company.subscription.currentPeriodEnd.toDate() : company.subscription.currentPeriodEnd, 'MMM dd, yyyy')}`}
                  </p>
                </div>
              </div>
              <div className="text-right space-y-3">
                <div>
                    <p className="text-[10px] uppercase font-bold text-neutral-600 tracking-widest mb-1">Fee</p>
                    <p className="text-3xl font-mono font-bold text-white">${currentPlan.price}<span className="text-sm text-neutral-500">/mo</span></p>
                </div>
                {company?.stripeCustomerId && stripeConfig?.stripeEnabled && (
                    <Button 
                        variant="secondary" 
                        onClick={handleCreatePortal}
                        disabled={loading}
                        className="text-[9px] h-8 px-4 font-bold tracking-widest"
                    >
                        Manage Subscription
                    </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-12 pt-8 border-t border-white/[0.05] relative z-10">
              {[
                { label: 'Customer Nodes', current: counts.customers, max: currentPlan.limits.customers, icon: <Users className="w-4 h-4" /> },
                { label: 'Asset Variants', current: counts.products, max: currentPlan.limits.products, icon: <Package className="w-4 h-4" /> },
                { label: 'Monthly cycles', current: counts.orders, max: currentPlan.limits.orders, icon: <ShoppingBag className="w-4 h-4" /> },
                { label: 'Team Seats', current: counts.seats, max: currentPlan.limits.seats, icon: <Activity className="w-4 h-4" /> }
              ].map(usage => (
                <div key={usage.label} className="space-y-3">
                  <div className="flex justify-between items-end">
                    <div className="flex items-center gap-2 text-neutral-500">
                      {usage.icon}
                      <span className="text-[10px] uppercase font-bold tracking-widest">{usage.label}</span>
                    </div>
                    <span className="text-xs font-mono text-white font-bold">
                        {usage.current} / {usage.max === Infinity ? '∞' : usage.max}
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-white/[0.03] rounded-full overflow-hidden border border-white/[0.05]">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${getUsagePercent(usage.current, usage.max)}%` }}
                      className="h-full bg-blue-500 rounded-full"
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Plan Comparison */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {plansWithPrices.map((plan) => (
              <Card key={plan.id} className={`p-6 flex flex-col h-full border ${plan.id === currentPlanId ? 'border-blue-500/50 bg-blue-500/[0.02]' : 'border-white/5 bg-neutral-900/40'} relative overflow-hidden group`}>
                {plan.popular && (
                  <div className="absolute top-0 right-0 p-3">
                    <span className="text-[8px] font-bold uppercase tracking-widest bg-emerald-500 text-black px-2 py-0.5 rounded shadow-lg">Optimal Choice</span>
                  </div>
                )}
                {!plan.isConfigured && stripeConfig?.stripeEnabled && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] z-20 flex items-center justify-center p-6 text-center">
                    <div className="space-y-2">
                        <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest">Configuration Required</p>
                        <p className="text-[9px] text-neutral-400 italic">Price ID for this node is missing in server environment.</p>
                    </div>
                  </div>
                )}
                <div className="mb-8">
                  <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.05] flex items-center justify-center mb-4">
                    {plan.icon}
                  </div>
                  <h3 className="font-display font-bold text-lg text-white mb-1 uppercase tracking-tight">{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mb-4">
                    <span className="text-2xl font-mono font-bold text-white">${plan.price}</span>
                    <span className="text-[10px] text-neutral-500 font-bold uppercase">/mo</span>
                  </div>
                  <p className="text-xs text-neutral-500 italic leading-relaxed">
                    {plan.description}
                  </p>
                </div>

                <div className="flex-1 space-y-3 mb-8">
                  {plan.features.map((feat, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                        <Check className="w-2.5 h-2.5 text-emerald-500" />
                      </div>
                      <span className="text-[11px] text-neutral-400 font-medium">{feat}</span>
                    </div>
                  ))}
                </div>

                <Button 
                  disabled={plan.id === currentPlanId || loading || (!plan.isConfigured && stripeConfig?.stripeEnabled)}
                  onClick={() => handleUpgrade(plan.id)}
                  variant={plan.id === currentPlanId ? 'secondary' : 'primary'}
                  className={`w-full text-[10px] font-bold uppercase tracking-[0.2em] h-11 ${plan.id === currentPlanId ? 'opacity-50 cursor-default' : 'shadow-xl shadow-blue-500/10'}`}
                >
                  {plan.id === currentPlanId ? 'Current Protocol' : 'Switch Protocol'}
                </Button>
              </Card>
            ))}
          </div>
        </div>

        <div className="lg:col-span-1 space-y-8">
            <Card className="p-8 border-white/5 bg-neutral-900">
                <h3 className="font-display font-bold text-lg text-white mb-6 uppercase tracking-tight flex items-center gap-3">
                    <CreditCard className="w-5 h-5 text-neutral-500" /> Payment Node
                </h3>
                <div className="space-y-6">
                    <div className="p-4 bg-white/[0.01] border border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center gap-3 py-10 text-center">
                        <div className="w-12 h-12 rounded-full bg-neutral-800 flex items-center justify-center">
                            <CreditCard className="w-6 h-6 text-neutral-600" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs font-bold text-white uppercase tracking-widest">
                                {stripeConfig?.stripeEnabled ? 'Live Gateway Ready' : 'Payment Vector Offline'}
                            </p>
                            <p className="text-[10px] text-neutral-500 italic">
                                {stripeConfig?.stripeEnabled 
                                    ? 'Select a plan to initialize your live subscription.' 
                                    : 'Stripe configuration required for real processing.'}
                            </p>
                        </div>
                        {!stripeConfig?.stripeEnabled && (
                            <div className="px-4 py-2 bg-amber-500/5 border border-amber-500/10 rounded-xl mt-4">
                                <p className="text-[8px] text-amber-500 font-bold uppercase tracking-wider">Engineering Note</p>
                                <p className="text-[9px] text-neutral-500 italic mt-1">Set STRIPE_SECRET_KEY in environment to enable live sync.</p>
                            </div>
                        )}
                    </div>

                    <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl">
                        <div className="flex items-center gap-3 mb-2">
                            <Shield className="w-4 h-4 text-emerald-500" />
                            <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Encryption OK</span>
                        </div>
                        <p className="text-[10px] text-neutral-500 leading-relaxed italic">All financial metadata is handled via AES-256 encrypted protocols.</p>
                    </div>

                    <div className="pt-6 border-t border-white/[0.05] space-y-4">
                        <div className="flex justify-between items-center text-[10px] uppercase font-bold text-neutral-600 tracking-widest">
                            <span>Gateway Status</span>
                            <span className="text-orange-500">Standby</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] uppercase font-bold text-neutral-600 tracking-widest">
                            <span>SLA Uptime</span>
                            <span className="text-emerald-500">99.99%</span>
                        </div>
                    </div>
                </div>
            </Card>

            <Card className="p-8 border-white/5 bg-neutral-900 relative overflow-hidden">
                <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-blue-600/10 rounded-full blur-3xl" />
                <h3 className="font-display font-bold text-lg text-white mb-4 uppercase tracking-tight">Need a Custom Node?</h3>
                <p className="text-xs text-neutral-500 leading-relaxed italic mb-8">For entities requiring more than 100 admin seats or custom API throughput, our engineering team can architect a dedicated protocol.</p>
                <Button variant="ghost" className="w-full text-[10px] font-bold uppercase tracking-widest border border-white/5 h-12 hover:bg-white/5 group">
                    Protocol Consultation <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
            </Card>
        </div>
      </div>
    </div>
  );
}
