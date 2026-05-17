import { useEffect, useState } from 'react';
import { Card, Button, Input, Label } from '../components/Common';
import { Shield, CreditCard, Users, Building, Bell, Check, AlertCircle, Globe, Clock, Calendar, UserRound } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { motion } from 'motion/react';
import { useLocale } from '../hooks/useLocale';
import { ImageUpload } from '../components/ImageUpload';
import { updateProfile } from 'firebase/auth';
import { COMPANY_VERTICAL_OPTIONS, getCompanyVerticalLabel, normalizeCompanyVertical } from '../lib/company';

export function Settings() {
  const { company, user, userProfile, refreshCompany, refreshProfile } = useAuth();
  const { t, setLanguage } = useLocale();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: company?.name || '',
    industry: company?.industry || '',
    vertical: normalizeCompanyVertical((company as any)?.vertical || company?.industry),
    email: company?.email || '',
    phone: company?.phone || '',
    currency: company?.currency || 'USD',
    defaultLanguage: company?.defaultLanguage || 'es',
    timezone: company?.timezone || 'UTC',
    logoURL: company?.logoURL || '',
  });

  const [avatarForm, setAvatarForm] = useState({
    displayName: userProfile?.displayName || '',
    photoURL: userProfile?.photoURL || '',
  });

  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarSuccess, setAvatarSuccess] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const [userLang, setUserLang] = useState(userProfile?.language || 'es');

  useEffect(() => {
    setForm({
      name: company?.name || '',
      industry: company?.industry || '',
      vertical: normalizeCompanyVertical((company as any)?.vertical || company?.industry),
      email: company?.email || '',
      phone: company?.phone || '',
      currency: company?.currency || 'USD',
      defaultLanguage: company?.defaultLanguage || 'es',
      timezone: company?.timezone || 'UTC',
      logoURL: company?.logoURL || '',
    });
  }, [company?.id, company?.name, company?.industry, company?.currency, company?.defaultLanguage, company?.timezone, company?.logoURL, company?.email, company?.phone]);

  useEffect(() => {
    setAvatarForm({
      displayName: userProfile?.displayName || user?.displayName || '',
      photoURL: userProfile?.photoURL || user?.photoURL || '',
    });
    setUserLang(userProfile?.language || 'es');
  }, [userProfile?.uid, userProfile?.displayName, userProfile?.photoURL, userProfile?.language, user?.displayName, user?.photoURL]);

  const handleUserLangChange = async (newLang: string) => {
    setUserLang(newLang);
    await setLanguage(newLang);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) return;

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const companyRef = doc(db, 'companies', company.id);
      const vertical = normalizeCompanyVertical(form.vertical);
      await updateDoc(companyRef, {
        ...form,
        industry: getCompanyVerticalLabel(vertical),
        vertical,
        updatedAt: serverTimestamp(),
      });
      
      await refreshCompany();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || t('settings.sync_error'));
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid) return;

    setAvatarLoading(true);
    setAvatarError(null);
    try {
      const userRef = doc(db, 'users', user.uid);
      if (user) {
        await updateProfile(user, {
          displayName: avatarForm.displayName || user.displayName || '',
          photoURL: avatarForm.photoURL || user.photoURL || '',
        });
      }
      await updateDoc(userRef, {
        ...avatarForm,
        updatedAt: serverTimestamp(),
      });
      await refreshProfile();
      setAvatarSuccess(true);
      setTimeout(() => setAvatarSuccess(false), 3000);
    } catch (err: any) {
      console.error('Avatar update failed:', err);
      setAvatarError(err?.message || 'No se pudo actualizar el perfil.');
    } finally {
      setAvatarLoading(false);
    }
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight mb-2 text-white">{t('settings.title')}</h1>
          <p className="text-neutral-500 text-sm">{t('settings.subtitle')}</p>
        </div>
      </div>

      <div className="space-y-8">
        <div className="grid lg:grid-cols-2 gap-8">
            {/* User Profile Card */}
            <Card className="p-8 border-white/5 bg-neutral-900 shadow-xl overflow-hidden group">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-6">
                        <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform">
                            <UserRound className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="font-display font-bold text-xl text-white">{t('settings.security_credentials')}</h2>
                            <p className="text-xs text-neutral-500 uppercase tracking-widest font-mono">PERFIL</p>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleAvatarSubmit} className="space-y-6">
                    <div className="flex gap-8 items-start">
                        <div className="w-24 shrink-0">
                            <ImageUpload 
                                value={avatarForm.photoURL}
                                onChange={url => setAvatarForm({ ...avatarForm, photoURL: url })}
                                path={`users/${user?.uid}/avatar`}
                                label="Foto"
                            />
                        </div>
                        <div className="flex-1 space-y-4">
                            <div className="space-y-2">
                                <Label>{t('settings.display_name')}</Label>
                                <Input 
                                    value={avatarForm.displayName}
                                    onChange={e => setAvatarForm({ ...avatarForm, displayName: e.target.value })}
                                />
                            </div>
                            <Button 
                                type="submit" 
                                variant="secondary" 
                                disabled={avatarLoading}
                                className="w-full text-[10px] uppercase font-bold tracking-widest"
                            >
                                {avatarLoading ? t('common.syncing') : avatarSuccess ? t('settings.profile_updated') : t('settings.update_profile')}
                            </Button>
                            {avatarError && (
                              <p className="text-xs text-red-400">{avatarError}</p>
                            )}
                        </div>
                    </div>
                </form>
            </Card>

            {/* Localization Card */}
            <Card className="p-8 border-white/5 bg-neutral-900 shadow-xl relative overflow-hidden group">
                <div className="flex items-center gap-6 mb-8">
                    <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center border border-blue-500/20 group-hover:scale-110 transition-transform">
                        <Globe className="w-6 h-6 text-blue-500" />
                    </div>
                    <div>
                        <h2 className="font-display font-bold text-xl text-white">{t('settings.localization')}</h2>
                        <p className="text-xs text-neutral-500 uppercase tracking-widest font-mono">IDIOMA Y REGION</p>
                    </div>
                </div>

                <div className="space-y-4 relative z-10">
                    <div className="space-y-2">
                        <Label>{t('settings.language')}</Label>
                        <select 
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all appearance-none"
                            aria-label={t('settings.language')}
                            value={userLang}
                            onChange={e => handleUserLangChange(e.target.value)}
                        >
                            <option value="en" className="bg-neutral-900 text-white">{t('common.languages.en')}</option>
                            <option value="es" className="bg-neutral-900 text-white">{t('common.languages.es')}</option>
                            <option value="pt" className="bg-neutral-900 text-white">{t('common.languages.pt')}</option>
                        </select>
                        <p className="text-[10px] text-neutral-600 italic">{t('settings.lang_desc')}</p>
                    </div>
                </div>
            </Card>
        </div>

        <form onSubmit={handleSubmit}>
          <Card className="p-8 border-white/5 bg-neutral-900 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/5 rounded-full blur-3xl pointer-events-none group-hover:bg-blue-600/10 transition-colors" />
            
            <div className="flex flex-col md:flex-row items-center justify-between mb-12 gap-6 relative z-10 text-center md:text-left">
              <div className="flex flex-col md:flex-row items-center gap-6">
                <div className="w-20 shrink-0">
                    <ImageUpload 
                        value={form.logoURL}
                        onChange={url => setForm({ ...form, logoURL: url })}
                        path={`companies/${company?.id}/logo`}
                        label="Logo"
                    />
                </div>
                <div>
                  <h2 className="font-display font-bold text-2xl text-white">{t('settings.company_profile')}</h2>
                  <p className="text-sm text-neutral-500 font-mono">EMPRESA: {company?.id.slice(0, 12).toUpperCase()}</p>
                </div>
              </div>
              <div className="flex flex-col md:flex-row items-center gap-4">
                <div className="flex items-center">
                    {success && (
                    <motion.span initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-1.5 text-emerald-500 text-xs font-bold uppercase tracking-widest mr-4">
                        <Check className="w-4 h-4" /> {t('settings.synced')}
                    </motion.span>
                    )}
                    {error && (
                    <motion.span initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-1.5 text-red-500 text-xs font-bold uppercase tracking-widest mr-4">
                        <AlertCircle className="w-4 h-4" /> {t('settings.sync_error')}
                    </motion.span>
                    )}
                </div>
                <Button type="submit" disabled={loading} className="px-8 h-12 shadow-xl shadow-blue-600/10">
                  {loading ? t('settings.syncing_msg') : t('settings.save')}
                </Button>
              </div>
            </div>
            
            <div className="grid lg:grid-cols-3 gap-12 relative z-10">
              <div className="lg:col-span-2 space-y-8">
                <div className="grid md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                    <Label>{t('settings.company_name')}</Label>
                    <Input 
                        required 
                        value={form.name} 
                        onChange={e => setForm({...form, name: e.target.value})} 
                        placeholder="Ej. Acme Industrials"
                    />
                    </div>
                    <div className="space-y-2">
                    <Label>Vertical</Label>
                    <select 
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all appearance-none"
                        aria-label="Vertical"
                        value={form.vertical}
                        onChange={e => setForm({...form, vertical: e.target.value as typeof form.vertical})}
                    >
                        {COMPANY_VERTICAL_OPTIONS.map((option) => (
                          <option key={option.value} className="bg-neutral-900" value={option.value}>{option.label}</option>
                        ))}
                    </select>
                    </div>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <Label>{t('settings.currency')}</Label>
                    <select 
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all appearance-none"
                      aria-label={t('settings.currency')}
                      value={form.currency}
                      onChange={e => setForm({...form, currency: e.target.value})}
                    >
                      <option value="USD" className="bg-neutral-900">USD ($) - Dolares</option>
                      <option value="EUR" className="bg-neutral-900">EUR (€) - Euros</option>
                      <option value="MXN" className="bg-neutral-900">MXN ($) - Pesos Mexicanos</option>
                      <option value="COP" className="bg-neutral-900">COP ($) - Pesos Colombianos</option>
                      <option value="BRL" className="bg-neutral-900">BRL (R$) - Real Brasileiro</option>
                      <option value="GBP" className="bg-neutral-900">GBP (£) - Libras esterlinas</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('settings.timezone')}</Label>
                    <select 
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all appearance-none"
                      aria-label={t('settings.timezone')}
                      value={form.timezone}
                      onChange={e => setForm({...form, timezone: e.target.value})}
                    >
                      <option value="UTC" className="bg-neutral-900">UTC (Universal)</option>
                      <option value="America/New_York" className="bg-neutral-900">EST (New York)</option>
                      <option value="America/Mexico_City" className="bg-neutral-900">CST (Mexico City)</option>
                      <option value="America/Bogota" className="bg-neutral-900">COT (Bogota)</option>
                      <option value="America/Sao_Paulo" className="bg-neutral-900">BRT (Sao Paulo)</option>
                      <option value="Europe/London" className="bg-neutral-900">GMT (Londres)</option>
                      <option value="Europe/Madrid" className="bg-neutral-900">CET (Madrid)</option>
                    </select>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <Label>{t('settings.default_company_lang')}</Label>
                    <select 
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all appearance-none"
                      aria-label={t('settings.default_company_lang')}
                      value={form.defaultLanguage}
                      onChange={e => setForm({...form, defaultLanguage: e.target.value})}
                    >
                      <option value="en" className="bg-neutral-900">{t('common.languages.en')}</option>
                      <option value="es" className="bg-neutral-900">{t('common.languages.es')}</option>
                      <option value="pt" className="bg-neutral-900">{t('common.languages.pt')}</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('settings.sync_contact')}</Label>
                    <Input 
                      value={form.phone} 
                      onChange={e => setForm({...form, phone: e.target.value})} 
                      placeholder="+1 (555) 010-2020"
                    />
                  </div>
                </div>
              </div>

              <div className="lg:col-span-1">
                <div className="bg-white/[0.02] p-8 rounded-3xl border border-white/[0.05] space-y-6">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                            <Shield className="w-4 h-4 text-orange-500" />
                        </div>
                        <h3 className="font-bold text-sm text-white uppercase tracking-widest">{t('settings.protocol_status')}</h3>
                    </div>
                    <p className="text-xs text-neutral-500 leading-relaxed italic">{t('settings.protocol_desc', { protocol: 'REMIX_OS_ENTERPRISE' })}</p>
                    
                    <div className="space-y-3 pt-4">
                        <div className="flex items-center justify-between py-2 border-b border-white/[0.03]">
                            <span className="text-[10px] uppercase font-bold text-neutral-600 tracking-widest">{t('settings.node_tier')}</span>
                            <span className="text-[10px] font-mono bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20 uppercase font-bold text-center">Prioridad v1</span>
                        </div>
                        <div className="flex items-center justify-between py-2">
                            <span className="text-[10px] uppercase font-bold text-neutral-600 tracking-widest">{t('settings.entity_health')}</span>
                            <div className="flex gap-1">
                                {[1,2,3,4,5].map(i => <div key={i} className="w-2.5 h-1 bg-emerald-500 rounded-full" />)}
                            </div>
                        </div>
                    </div>
                    
                    <Button variant="ghost" type="button" className="w-full mt-2 text-[10px] uppercase font-bold tracking-[0.2em] border border-white/5 h-11">
                        {t('settings.protocol_control')}
                    </Button>
                </div>
              </div>
            </div>
          </Card>
        </form>

        <Card className="p-8 border-white/5 bg-neutral-900 shadow-xl">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="w-16 h-16 bg-white/[0.03] rounded-2xl flex items-center justify-center border border-white/[0.05]">
              <Users className="w-8 h-8 text-neutral-600" />
            </div>
            <div className="text-center md:text-left">
              <h2 className="font-display font-bold text-2xl text-white">{t('settings.access_control')}</h2>
              <p className="text-sm text-neutral-500 mt-1 italic">
                {t('settings.managed_by')}: <span className="text-neutral-300 font-mono">{userProfile?.email || user?.email}</span>
              </p>
            </div>
            <div className="md:ml-auto">
                <Button variant="secondary" disabled className="text-[10px] uppercase tracking-widest font-bold opacity-50 px-6">
                    Multi-admin disponible en proxima fase
                </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
