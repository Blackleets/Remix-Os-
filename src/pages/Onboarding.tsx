import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Button, Input, Label, Card, cn } from '../components/Common';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { doc, setDoc, serverTimestamp, collection, addDoc, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Building2, Plus, ArrowRight } from 'lucide-react';

import { useLocale } from '../hooks/useLocale';

interface Invitation {
  id: string;
  companyId: string;
  companyName: string;
  role: string;
  status: string;
}

export function Onboarding() {
  const { t } = useLocale();
  const { user, company, refreshCompany } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [form, setForm] = useState({
    name: '',
    industry: 'Retail',
    country: 'United States',
    currency: 'USD',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    email: user?.email || '',
    phone: '',
    useSeedData: true
  });

  useEffect(() => {
    const fetchInvitations = async () => {
      if (!user?.email) return;
      const q = query(
        collection(db, 'invitations'), 
        where('email', '==', user.email.toLowerCase()),
        where('status', '==', 'pending')
      );
      const snap = await getDocs(q);
      setInvitations(snap.docs.map(d => ({ id: d.id, ...d.data() } as Invitation)));
    };
    fetchInvitations();
  }, [user]);

  if (!user) return <Navigate to="/auth" />;
  if (company?.onboardingState?.isComplete) return <Navigate to="/dashboard" />;

  const handleAcceptInvite = async (invite: Invitation) => {
    setLoading(true);
    try {
      const { writeBatch, doc } = await import('firebase/firestore');
      const batch = writeBatch(db);
      
      const membershipId = `${user.uid}_${invite.companyId}`;
      batch.set(doc(db, 'memberships', membershipId), {
        userId: user.uid,
        companyId: invite.companyId,
        role: invite.role,
        createdAt: serverTimestamp(),
      });

      batch.update(doc(db, 'invitations', invite.id), {
        status: 'accepted',
        acceptedAt: serverTimestamp(),
      });

      batch.set(doc(collection(db, 'activities')), {
        type: 'team_join',
        title: 'New Member Joined',
        subtitle: `${user.email} joined through invitation`,
        companyId: invite.companyId,
        createdAt: serverTimestamp(),
      });

      await batch.commit();

      await refreshCompany();
      navigate('/dashboard');
    } catch (err: any) {
      setOnboardingError(err?.message || t('onboarding.alerts.join_failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleFinalize = async () => {
    setLoading(true);
    try {
      const { writeBatch, doc } = await import('firebase/firestore');
      const batch = writeBatch(db);
      const companyRef = doc(collection(db, 'companies'));
      
      batch.set(companyRef, {
        name: form.name,
        industry: form.industry,
        country: form.country,
        currency: form.currency,
        timezone: form.timezone,
        email: form.email,
        phone: form.phone,
        ownerId: user.uid,
        createdAt: serverTimestamp(),
        onboardingState: {
          isComplete: true,
          step: 3,
          checklist: {
            profile: true,
            product: false,
            customer: false,
            order: false
          }
        },
        subscription: {
          planId: 'starter',
          status: 'trialing',
          trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        }
      });

      const membershipId = `${user.uid}_${companyRef.id}`;
      batch.set(doc(db, 'memberships', membershipId), {
        userId: user.uid,
        companyId: companyRef.id,
        role: 'owner',
        createdAt: serverTimestamp(),
      });

      await batch.commit();

      if (form.useSeedData) {
        const { seedCompanyData } = await import('../services/seedData');
        await seedCompanyData(companyRef.id);
      }

      await refreshCompany();
      navigate('/dashboard');
    } catch (err: any) {
      setOnboardingError(err?.message || t('onboarding.alerts.init_failed'));
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => setStep(s => s + 1);
  const prevStep = () => setStep(s => s - 1);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black p-6 font-sans selection:bg-blue-500 selection:text-white relative overflow-hidden">
       {/* Background Ambience */}
       <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)]" />
       <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-xl w-full relative">
        {/* Progress Header */}
        <div className="mb-12 flex items-center justify-between px-2">
          <div className="flex gap-4">
            {[1, 2, 3].map((s) => (
              <div 
                key={s}
                className={cn(
                  "h-1 px-1 rounded-full transition-all duration-1000 ease-in-out",
                  step >= s ? "bg-white w-20 shadow-[0_0_15px_rgba(255,255,255,0.3)]" : "bg-white/10 w-8"
                )}
              />
            ))}
          </div>
          <p className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.4em] glow-text">{t('onboarding.step')} {step} / 3</p>
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="mb-8 lg:mb-12">
                <h1 className="text-4xl sm:text-6xl font-bold tracking-tighter mb-4 text-white font-display">{t('onboarding.profile.title')}</h1>
                <p className="text-lg sm:text-xl text-neutral-400 font-medium leading-relaxed max-w-md">{t('onboarding.profile.subtitle')}</p>
              </div>

              {invitations.length > 0 && (
                <div className="mb-8 sm:mb-10 space-y-4">
                  {invitations.map(invite => (
                    <Card key={invite.id} className="p-4 sm:p-6 border-blue-500/30 bg-blue-500/[0.05] flex flex-col sm:flex-row items-center justify-between rounded-3xl backdrop-blur-xl group gap-4">
                      <div className="flex items-center gap-5 w-full sm:w-auto">
                        <div className="w-12 h-12 rounded-2xl bg-blue-600/20 flex items-center justify-center border border-blue-500/20 group-hover:scale-110 transition-transform flex-shrink-0">
                          <Building2 className="w-6 h-6 text-blue-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-white text-lg truncate">{invite.companyName}</p>
                          <p className="text-[10px] text-blue-400 font-black tracking-[0.2em] uppercase">{t('onboarding.profile.invitation_found')}</p>
                        </div>
                      </div>
                      <Button onClick={() => handleAcceptInvite(invite)} className="w-full sm:w-auto bg-blue-600 text-white hover:bg-blue-500 h-12 px-8 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-blue-600/20">{t('onboarding.profile.join_team')}</Button>
                    </Card>
                  ))}
                </div>
              )}

              <Card className="p-6 sm:p-12 space-y-8 sm:space-y-10 rounded-[2.5rem] sm:rounded-[3rem] bg-neutral-900/40 border-white/10 backdrop-blur-3xl shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-[0.02] pointer-events-none hidden sm:block">
                  <Building2 className="w-32 h-32 text-white" />
                </div>
                
                <div className="space-y-4 relative">
                  <span className="text-[10px] font-black uppercase tracking-[0.25em] text-neutral-500 ml-1">{t('onboarding.profile.company_name')}</span>
                  <Input 
                    placeholder={t('onboarding.profile.company_placeholder')}
                    className="h-14 sm:h-16 text-lg sm:text-xl font-bold px-6 rounded-2xl bg-white/[0.03] border-white/10 text-white placeholder:text-neutral-700 focus:bg-white/[0.05] focus:border-white/20 transition-all shadow-inner"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8 relative">
                  <div className="space-y-4">
                    <span className="text-[10px] font-black uppercase tracking-[0.25em] text-neutral-500 ml-1">{t('onboarding.profile.sector')}</span>
                    <div className="relative">
                      <select 
                        className="w-full h-14 sm:h-16 bg-white/[0.03] border border-white/10 rounded-2xl px-6 text-lg font-bold text-white outline-none focus:ring-4 focus:ring-white/5 transition-all appearance-none cursor-pointer"
                        value={form.industry}
                        onChange={(e) => setForm({ ...form, industry: e.target.value })}
                      >
                        <option className="bg-neutral-900" value="Retail">{t('onboarding.profile.sectors.retail')}</option>
                        <option className="bg-neutral-900" value="Tech">{t('onboarding.profile.sectors.tech')}</option>
                        <option className="bg-neutral-900" value="Services">{t('onboarding.profile.sectors.services')}</option>
                        <option className="bg-neutral-900" value="Manufacturing">{t('onboarding.profile.sectors.manufacturing')}</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <span className="text-[10px] font-black uppercase tracking-[0.25em] text-neutral-500 ml-1">{t('onboarding.profile.currency')}</span>
                    <div className="relative">
                      <select 
                        className="w-full h-14 sm:h-16 bg-white/[0.03] border border-white/10 rounded-2xl px-6 text-lg font-bold text-white outline-none focus:ring-4 focus:ring-white/5 transition-all appearance-none cursor-pointer"
                        value={form.currency}
                        onChange={(e) => setForm({ ...form, currency: e.target.value })}
                      >
                        <option className="bg-neutral-900" value="USD">USD ($)</option>
                        <option className="bg-neutral-900" value="EUR">EUR (€)</option>
                        <option className="bg-neutral-900" value="GBP">GBP (£)</option>
                        <option className="bg-neutral-900" value="JPY">JPY (¥)</option>
                      </select>
                    </div>
                  </div>
                </div>
                
                <Button onClick={nextStep} disabled={!form.name?.trim()} className="w-full h-16 sm:h-20 text-lg sm:text-2xl font-black rounded-[2rem] sm:rounded-3xl bg-white text-black hover:bg-neutral-200 shadow-2xl shadow-white/5 transition-all active:scale-[0.98]">
                  {t('common.continue')} <ArrowRight className="ml-4 w-5 h-5 sm:w-7 sm:h-7" />
                </Button>
              </Card>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="mb-8 lg:mb-12">
                <h1 className="text-4xl sm:text-6xl font-bold tracking-tighter mb-4 text-white font-display">{t('onboarding.communication.title')}</h1>
                <p className="text-lg sm:text-xl text-neutral-400 font-medium leading-relaxed max-w-md">{t('onboarding.communication.subtitle')}</p>
              </div>

              <Card className="p-6 sm:p-12 space-y-8 sm:space-y-10 rounded-[2.5rem] sm:rounded-[3rem] bg-neutral-900/40 border-white/10 backdrop-blur-3xl shadow-2xl relative">
                <div className="space-y-4">
                  <span className="text-[10px] font-black uppercase tracking-[0.25em] text-neutral-500 ml-1">{t('onboarding.communication.email')}</span>
                  <Input 
                    type="email"
                    placeholder="contact@business.com"
                    className="h-14 sm:h-16 text-lg sm:text-xl font-bold px-6 rounded-2xl bg-white/[0.03] border-white/10 text-white placeholder:text-neutral-700 focus:bg-white/[0.05] focus:border-white/20 transition-all font-mono"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div className="space-y-4">
                  <span className="text-[10px] font-black uppercase tracking-[0.25em] text-neutral-500 ml-1">{t('onboarding.communication.phone')}</span>
                  <Input 
                    placeholder="+1 (555) 000-0000"
                    className="h-14 sm:h-16 text-lg sm:text-xl font-bold px-6 rounded-2xl bg-white/[0.03] border-white/10 text-white placeholder:text-neutral-700 focus:bg-white/[0.05] focus:border-white/20 transition-all font-mono"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-4">
                  <span className="text-[10px] font-black uppercase tracking-[0.25em] text-neutral-500 ml-1">{t('onboarding.communication.location')}</span>
                  <Input
                    placeholder={t('onboarding.communication.location_placeholder')}
                    className="h-14 sm:h-16 text-lg sm:text-xl font-bold px-6 rounded-2xl bg-white/[0.03] border-white/10 text-white placeholder:text-neutral-700 focus:bg-white/[0.05] focus:border-white/20 transition-all"
                    value={form.country}
                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                  />
                </div>
                <div className="space-y-4">
                  <span className="text-[10px] font-black uppercase tracking-[0.25em] text-neutral-500 ml-1">Timezone</span>
                  <div className="relative">
                    <select
                      className="w-full h-14 sm:h-16 bg-white/[0.03] border border-white/10 rounded-2xl px-6 text-base font-bold text-white outline-none focus:ring-4 focus:ring-white/5 transition-all appearance-none cursor-pointer"
                      value={form.timezone}
                      onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                    >
                      {['UTC','America/New_York','America/Chicago','America/Denver','America/Los_Angeles','America/Bogota','America/Lima','America/Santiago','America/Sao_Paulo','America/Buenos_Aires','Europe/London','Europe/Madrid','Europe/Paris','Europe/Berlin','Asia/Tokyo','Asia/Shanghai','Asia/Kolkata','Australia/Sydney'].map(tz => (
                        <option key={tz} value={tz} className="bg-neutral-900">{tz.replace('_',' ')}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {onboardingError && (
                  <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{onboardingError}</p>
                )}
                <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 pt-6">
                  <Button variant="secondary" onClick={prevStep} className="w-full h-14 sm:h-20 text-lg font-bold rounded-2xl border-white/10 text-neutral-400 hover:bg-white/5 transition-colors order-2 sm:order-1">{t('common.back')}</Button>
                  <Button onClick={nextStep} className="w-full h-14 sm:h-20 text-lg font-black rounded-2xl bg-white text-black hover:bg-neutral-200 order-1 sm:order-2">{t('common.continue')}</Button>
                </div>
              </Card>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="mb-8 lg:mb-12 text-center">
                <div className="inline-flex items-center justify-center w-20 h-20 sm:w-28 sm:h-28 rounded-[2.5rem] bg-white text-black mb-6 sm:mb-10 shadow-[0_0_50px_rgba(255,255,255,0.15)] relative group">
                  <div className="absolute inset-0 bg-white rounded-[2.5rem] animate-ping opacity-20 group-hover:hidden" />
                  <CheckCircle2 className="w-10 h-10 sm:w-14 sm:h-14 relative" />
                </div>
                <h1 className="text-4xl sm:text-6xl font-bold tracking-tighter mb-4 text-white font-display">{t('onboarding.finalize.title')}</h1>
                <p className="text-lg sm:text-xl text-neutral-400 font-medium leading-relaxed">{t('onboarding.finalize.subtitle')}</p>
              </div>

              <Card className="p-6 sm:p-12 space-y-8 sm:space-y-10 rounded-[2.5rem] sm:rounded-[3.5rem] bg-neutral-900/40 border-white/10 backdrop-blur-3xl shadow-2xl text-left">
                <div 
                  className={cn(
                    "p-6 sm:p-8 rounded-[2rem] border-2 transition-all cursor-pointer group relative overflow-hidden",
                    form.useSeedData 
                      ? "border-white bg-white text-black" 
                      : "border-white/5 bg-white/[0.02] hover:border-white/20"
                  )}
                  onClick={() => setForm({ ...form, useSeedData: !form.useSeedData })}
                >
                  <div className="flex items-center justify-between mb-4 relative z-10">
                    <span className={cn("font-black uppercase tracking-[0.3em] text-[10px]", form.useSeedData ? "text-neutral-500" : "text-white")}>
                      {t('onboarding.finalize.sample_data')}
                    </span>
                    <Plus className={cn("w-5 h-5 sm:w-6 h-6 transition-all duration-500", form.useSeedData ? "text-black rotate-45 scale-125" : "text-neutral-600 group-hover:scale-125")} />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black mb-2 relative z-10 tracking-tight">{t('onboarding.finalize.include_sample')}</h3>
                  <p className={cn("text-xs sm:text-sm leading-relaxed relative z-10 font-bold", form.useSeedData ? "text-neutral-600" : "text-neutral-500")}>
                    {t('onboarding.finalize.sample_desc')}
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 pt-6">
                  <Button variant="secondary" onClick={prevStep} className="w-full h-16 sm:h-20 text-lg font-bold rounded-2xl border-white/10 text-neutral-400 hover:bg-white/5 transition-colors order-2 sm:order-1" disabled={loading}>{t('common.back')}</Button>
                  <Button onClick={handleFinalize} disabled={loading} className="w-full h-16 sm:h-20 text-xl sm:text-2xl font-black rounded-[2rem] bg-white text-black hover:bg-neutral-200 shadow-2xl shadow-white/5 order-1 sm:order-2">
                    {loading ? t('onboarding.finalize.activating') : t('onboarding.finalize.get_started')}
                  </Button>
                </div>
                
                <p className="text-center text-[9px] text-neutral-600 uppercase tracking-[0.4em] font-black italic glow-text">
                  {t('onboarding.finalize.secure_auth')}
                </p>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
