import { useEffect, useState } from 'react';
import { Card, Button } from '../components/Common';
import { RefreshCcw, TrendingUp, AlertTriangle, CheckCircle, Info, ArrowRight, Activity, Zap, Fingerprint, Globe, Database, Terminal, Cpu, Gauge } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { generateBusinessInsights } from '../services/gemini';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../components/Common';
import { useLocale } from '../hooks/useLocale';
import { fetchCompanyOverview } from '../services/companyApi';

interface Insight {
  title: string;
  explanation: string;
  type: 'opportunity' | 'risk' | 'efficiency' | 'growth';
  severity: 'info' | 'success' | 'warning' | 'critical';
  recommendation: string;
}

export function Insights() {
  const { company, role } = useAuth();
  const { t, formatCurrency, formatDate, language } = useLocale();
  const navigate = useNavigate();
  const [insights, setInsights] = useState<Insight[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const planId = company?.subscription?.planId || 'starter';

  if (role !== 'owner' && role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Cpu className="w-16 h-16 text-blue-500/20 mb-6" />
        <h2 className="text-2xl font-bold text-white mb-2">Acceso restringido</h2>
        <p className="text-neutral-500 max-w-sm font-mono text-[10px] uppercase tracking-widest leading-loose">
          Los analisis avanzados estan reservados para administradores. Contacta a tu responsable para obtener acceso.
        </p>
      </div>
    );
  }

  const performAnalysis = async () => {
    if (!company) return;
    setLoading(true);
    setError(null);

    try {
      // Log activity
      await addDoc(collection(db, 'activities'), {
        companyId: company.id,
        type: 'ai_sync',
        title: 'Deep Analysis Initiated',
        subtitle: 'Analyzing business data for growth opportunities.',
        createdAt: serverTimestamp()
      });

      const overview = await fetchCompanyOverview(company.id);

      const businessData = {
        companyId: company.id,
        companyName: overview.companyName || company.name,
        industry: overview.industry || company.industry,
        onboardingCompleted: overview.onboardingCompleted,
        customersCount: overview.customersCount,
        productsCount: overview.productsCount,
        recentRevenue: overview.recentRevenue30d ?? overview.recentRevenue,
        growth: Number(overview.growth || 0).toFixed(1),
        topProducts: overview.topProducts || [],
        lowStockItems: overview.lowStockItems || [],
        topCustomers: overview.topCustomers || [],
        planLevel: overview.planId || planId,
      };

      const result = await generateBusinessInsights(businessData, language);
      
      if (!result || !Array.isArray(result)) {
        throw new Error('La IA no pudo generar un analisis estructurado.');
      }
      
      // Limit insights for Starter plan
      if (planId === 'starter' && result.length > 3) {
        setInsights(result.slice(0, 3));
      } else {
        setInsights(result);
      }
    } catch (err: any) {
      console.error(err);
      setError('No se pudo completar el analisis. Revisa tus datos e intentalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-orange-500" />;
      case 'success': return <CheckCircle className="w-5 h-5 text-emerald-500" />;
      default: return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case 'critical': return 'border-red-500/20 bg-red-500/[0.02] shadow-[0_0_50px_rgba(239,68,68,0.05)]';
      case 'warning': return 'border-orange-500/20 bg-orange-500/[0.02] shadow-[0_0_50px_rgba(249,115,22,0.05)]';
      case 'success': return 'border-emerald-500/20 bg-emerald-500/[0.02] shadow-[0_0_50px_rgba(16,185,129,0.05)]';
      default: return 'border-blue-500/20 bg-blue-500/[0.02] shadow-[0_0_50px_rgba(59,130,246,0.05)]';
    }
  };

  return (
    <div className="space-y-12 pb-20">
      {/* Premium Header System */}
      <div className="relative p-10 rounded-[3rem] bg-neutral-900 border border-white/[0.05] overflow-hidden group">
        <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none animate-pulse" />
        
        <div className="relative z-10 flex flex-col lg:flex-row justify-between items-center gap-12">
          <div className="flex-1 space-y-6">
            <div className="inline-flex items-center gap-3 px-4 py-2 bg-blue-500/5 border border-blue-500/20 rounded-full">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400">Centro de analisis</span>
            </div>
            <div className="space-y-4">
              <h1 className="font-display text-6xl font-bold tracking-tighter text-white leading-[0.9]">
                Inteligencia <br /> <span className="text-blue-500">{t('insights.title')}</span>
              </h1>
              <p className="text-neutral-400 max-w-md text-lg leading-relaxed font-medium">
                {t('insights.subtitle')}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-6">
            {planId === 'starter' && (
              <div 
                onClick={() => navigate('/billing')}
                className="group/upgrade p-6 rounded-[2rem] bg-white/[0.02] border border-white/10 backdrop-blur-xl cursor-pointer hover:bg-white/[0.05] transition-all"
              >
                <div className="flex items-center gap-4 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-500/70">Acceso limitado</p>
                    <p className="font-bold text-white">Plan Starter</p>
                  </div>
                </div>
                <p className="text-[10px] text-neutral-500 font-mono tracking-widest leading-loose">
                  ACTUALIZA PARA DESBLOQUEAR <br /> MAS ANALISIS
                </p>
              </div>
            )}

            <button 
              onClick={performAnalysis} 
              disabled={loading}
              className={cn(
                "relative group overflow-hidden w-64 h-64 rounded-full flex flex-col items-center justify-center transition-all duration-700",
                loading ? "scale-95" : "hover:scale-105"
              )}
            >
              <div className={cn(
                "absolute inset-0 rounded-full border-4 border-dashed border-blue-500/30 transition-all duration-[3000ms]",
                loading ? "animate-[spin_10s_linear_infinite]" : "animate-[spin_30s_linear_infinite]"
              )} />
              <div className="absolute inset-4 rounded-full bg-blue-600/10 border border-blue-500/20 backdrop-blur-md" />
              
              <div className="relative z-10 flex flex-col items-center gap-4">
                <div className={cn(
                  "w-16 h-16 rounded-2xl bg-blue-500 text-white flex items-center justify-center shadow-[0_0_30px_rgba(59,130,246,0.5)]",
                  loading && "animate-pulse"
                )}>
                  {loading ? <RefreshCcw className="w-8 h-8 animate-spin" /> : <Zap className="w-8 h-8" />}
                </div>
                <div className="text-center">
                  <p className="text-xs font-black uppercase tracking-[0.4em] text-white">
                    {loading ? t('insights.analyzing') : t('insights.start')}
                  </p>
                  <p className="text-[9px] font-mono text-blue-400 mt-1 uppercase">
                    {loading ? 'Procesando...' : 'Iniciar analisis'}
                  </p>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Operational Modules */}
      <div className="grid lg:grid-cols-4 gap-10">
        <div className="lg:col-span-1 space-y-10">
          <div className="space-y-6">
            <h3 className="text-[11px] font-black text-neutral-600 uppercase tracking-[0.4em] flex items-center gap-3">
              <Database className="w-4 h-4" /> Telemetria
            </h3>
            <div className="grid gap-4">
                {[
                  { label: 'Carga', val: 'Baja', status: 'optimo', icon: Cpu },
                  { label: 'Velocidad', val: 'Alta', status: 'activa', icon: Zap },
                  { label: 'Integridad', val: 'Verificada', status: 'segura', icon: Fingerprint },
                  { label: 'Sync', val: 'Al dia', status: 'online', icon: Globe },
                ].map(m => (
                  <div key={m.label} className="p-5 rounded-2xl bg-neutral-900 border border-white/[0.03] group hover:border-blue-500/30 transition-all">
                    <div className="flex justify-between items-center mb-4">
                      <div className="w-8 h-8 rounded-lg bg-white/[0.03] border border-white/[0.05] flex items-center justify-center text-neutral-500 group-hover:text-blue-500">
                        <m.icon className="w-4 h-4" />
                      </div>
                      <span className="text-[9px] font-mono font-bold text-blue-500/50 uppercase tracking-widest">
                        {m.status}
                      </span>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-neutral-600 uppercase tracking-widest mb-1">{m.label}</p>
                      <p className="text-xl font-bold text-white">{m.val}</p>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          <div className="p-8 rounded-[2rem] bg-gradient-to-br from-blue-600/10 to-transparent border border-blue-500/20 relative overflow-hidden">
            <Terminal className="absolute bottom-4 right-4 w-20 h-20 text-blue-500/10 -rotate-12" />
            <h4 className="text-xs font-black uppercase tracking-widest text-blue-400 mb-4 flex items-center gap-2">
              <Info className="w-3.5 h-3.5" /> Estado IA
            </h4>
            <p className="text-sm text-neutral-400 leading-relaxed italic font-medium relative z-10">
              "Cada transaccion registrada mejora el contexto operativo y la calidad del analisis."
            </p>
          </div>
        </div>

        <div className="lg:col-span-3 min-h-[700px] relative">
          <AnimatePresence mode="wait">
            {!insights && !loading && !error && (
              <motion.div 
                key="empty"
                initial={{ opacity: 0, scale: 0.95 }} 
                animate={{ opacity: 1, scale: 1 }} 
                exit={{ opacity: 0, scale: 1.05 }}
                className="absolute inset-0 flex flex-col items-center justify-center text-center p-12 bg-neutral-900 border border-white/[0.05] rounded-[3rem]"
              >
                <div className="relative group mb-12">
                  <div className="absolute inset-0 bg-blue-500/20 rounded-[2.5rem] blur-3xl animate-pulse" />
                  <div className="w-32 h-32 bg-neutral-800 rounded-[2.5rem] flex items-center justify-center relative border border-white/10 group-hover:border-blue-500/50 transition-colors">
                    <Cpu className="w-16 h-16 text-blue-500" />
                  </div>
                </div>
                <h3 className="text-4xl font-display font-bold text-white mb-6 tracking-tight">Listo para analizar.</h3>
                <p className="text-neutral-500 max-w-sm mb-12 leading-relaxed text-lg font-medium">
                  Aun no hay suficiente contexto. Registra ventas, clientes o productos para generar analisis mas utiles.
                </p>
                <button 
                  onClick={performAnalysis} 
                  className="px-12 py-5 bg-white text-black rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] hover:bg-neutral-200 transition-all active:scale-[0.98] shadow-2xl shadow-white/5"
                >
                  Ejecutar analisis
                </button>
              </motion.div>
            )}

            {loading && (
              <motion.div 
                key="loading"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-900/60 backdrop-blur-2xl z-50 rounded-[3.5rem] border border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.5)]"
              >
                <div className="space-y-16 flex flex-col items-center w-full max-w-lg px-12">
                  <div className="relative w-full h-1 bg-white/[0.05] rounded-full overflow-hidden">
                    <motion.div 
                      className="absolute inset-y-0 bg-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.8)]"
                      initial={{ left: '-100%', width: '100%' }}
                      animate={{ left: '100%' }}
                      transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                    />
                  </div>
                  
                  <div className="text-center space-y-6">
                    <div className="flex justify-center gap-4 mb-4">
                        {[0,1,2].map(i => (
                          <motion.div 
                            key={i}
                            animate={{ 
                              scale: [1, 1.5, 1], 
                              opacity: [0.3, 1, 0.3],
                              backgroundColor: i === 1 ? '#3b82f6' : '#1d4ed8'
                            }} 
                            transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.2 }} 
                            className="w-3 h-3 rounded-full" 
                          />
                        ))}
                    </div>
                    <p className="font-display font-black text-3xl text-white uppercase tracking-tighter">Analizando operacion</p>
                    <div className="grid grid-cols-2 gap-4 max-w-xs mx-auto">
                        <p className="text-[10px] text-neutral-500 font-mono tracking-widest uppercase text-left">PROD_SYNC: <span className="text-blue-500">OK</span></p>
                        <p className="text-[10px] text-neutral-500 font-mono tracking-widest uppercase text-left">CUST_MAP: <span className="text-blue-500">OK</span></p>
                        <p className="text-[10px] text-neutral-500 font-mono tracking-widest uppercase text-left">REV_CALC: <span className="text-blue-500">OK</span></p>
                        <p className="text-[10px] text-neutral-500 font-mono tracking-widest uppercase text-left">AI_ANALYSIS: <span className="text-amber-500 animate-pulse">BUSY</span></p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {error && (
              <motion.div 
                key="error"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="absolute inset-0 flex flex-col items-center justify-center text-center p-12 bg-neutral-900 border border-red-500/20 rounded-[3rem]"
              >
                <div className="w-24 h-24 bg-red-500/10 rounded-[2rem] flex items-center justify-center mb-10 border border-red-500/20 shadow-[0_0_50px_rgba(239,68,68,0.1)]">
                  <AlertTriangle className="w-12 h-12 text-red-500" />
                </div>
                <h3 className="text-3xl font-bold text-white mb-4">Analisis interrumpido.</h3>
                <p className="text-neutral-500 max-w-sm mb-12 text-lg font-medium leading-relaxed">{error}</p>
                <button 
                  onClick={performAnalysis} 
                  className="px-10 py-5 border border-white/10 rounded-2xl bg-white/5 text-white font-black uppercase tracking-widest text-[10px] hover:bg-white/10 transition-all"
                >
                  Reintentar
                </button>
              </motion.div>
            )}

            {insights && (
              <motion.div 
                key="results"
                initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
                className="space-y-10"
              >
                <div className="flex items-center justify-between px-6">
                  <h2 className="text-[11px] font-black text-neutral-600 uppercase tracking-[0.4em] flex items-center gap-3">
                    <Activity className="w-4 h-4" /> Recomendaciones activas
                  </h2>
                  <div className="flex items-center gap-4">
                    <span className="text-[10px] font-mono text-neutral-600">INSIGHTS: {insights.length}</span>
                    <div className="w-px h-4 bg-white/10" />
                    <span className="text-[10px] font-mono text-emerald-500">CONTEXTO ACTIVO</span>
                  </div>
                </div>

                <div className="grid gap-8">
                  {insights.map((insight, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -30 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                    >
                      <Card className={`p-10 border-2 ${getSeverityStyles(insight.severity)} group relative overflow-hidden rounded-[2.5rem]`}>
                        <div className="absolute top-0 right-0 p-12 opacity-[0.02] pointer-events-none group-hover:scale-125 transition-transform duration-1000">
                          {getSeverityIcon(insight.severity)}
                        </div>
                        
                        <div className="flex flex-col xl:flex-row gap-12 relative z-10">
                          <div className="flex-shrink-0">
                            <div className={`w-20 h-20 rounded-[1.5rem] flex items-center justify-center border-2 ${getSeverityStyles(insight.severity)} shadow-inner`}>
                              {getSeverityIcon(insight.severity)}
                            </div>
                          </div>
                          
                          <div className="flex-1 space-y-8">
                            <div className="space-y-4">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="flex items-center gap-4">
                                  <span className="px-3 py-1 bg-white/[0.03] border border-white/5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
                                    {insight.type === 'opportunity' ? 'Oportunidad' : insight.type === 'risk' ? 'Riesgo' : insight.type === 'efficiency' ? 'Eficiencia' : 'Crecimiento'}
                                  </span>
                                  <h3 className="font-display font-bold text-3xl text-white tracking-tight">{insight.title}</h3>
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className="h-1.5 w-24 bg-white/[0.05] rounded-full overflow-hidden">
                                     <div className={cn(
                                       "h-full rounded-full",
                                       insight.severity === 'critical' ? 'bg-red-500 w-full' :
                                       insight.severity === 'warning' ? 'bg-orange-500 w-[70%]' :
                                       insight.severity === 'success' ? 'bg-emerald-500 w-[40%]' :
                                       'bg-blue-500 w-[20%]'
                                     )} />
                                  </div>
                                  <span className="text-[10px] font-mono text-neutral-600 uppercase tracking-widest">
                                    {insight.severity === 'critical' ? 'Critico' : insight.severity === 'warning' ? 'Alerta' : insight.severity === 'success' ? 'Positivo' : 'Info'}
                                  </span>
                                </div>
                              </div>
                              <p className="text-neutral-400 text-lg leading-relaxed font-medium max-w-3xl">
                                {insight.explanation}
                              </p>
                            </div>

                            <div className="pt-8 flex flex-col md:flex-row md:items-center justify-between gap-8 border-t border-white/[0.03]">
                              <div className="flex items-center gap-5">
                                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 shadow-lg shadow-blue-500/5">
                                  <Zap className="w-6 h-6 text-blue-400" />
                                </div>
                                <div>
                                  <p className="text-[10px] font-black uppercase text-neutral-500 tracking-[0.3em] leading-none mb-2">Siguiente paso</p>
                                  <p className="text-lg font-bold text-blue-400">{insight.recommendation}</p>
                                </div>
                              </div>
                              
                            <Button 
                              onClick={() => {
                                const rec = insight.recommendation.toLowerCase();
                                if (rec.includes('stock') || rec.includes('inventory') || rec.includes('product')) {
                                  navigate('/inventory');
                                } else if (rec.includes('customer')) {
                                  navigate('/customers');
                                } else if (rec.includes('order') || rec.includes('sale') || rec.includes('revenue')) {
                                  navigate('/orders');
                                } else {
                                  navigate('/dashboard');
                                }
                              }}
                              className="h-14 px-10 text-[11px] font-black uppercase tracking-[0.3em] gap-3 bg-white text-black hover:bg-neutral-200 border-0 rounded-2xl transition-all active:scale-[0.98]"
                            >
                              {t('insights.execute')} <ArrowRight className="w-4 h-4" />
                            </Button>
                            </div>
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
