import { useState } from 'react';
import { Card, Button, Input, Label } from '../components/Common';
import { Shield, CreditCard, Users, Building, Bell, Check, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { motion } from 'motion/react';

export function Settings() {
  const { company, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: company?.name || '',
    industry: company?.industry || '',
    email: company?.email || '',
    phone: company?.phone || '',
    currency: company?.currency || 'USD',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) return;

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const companyRef = doc(db, 'companies', company.id);
      await updateDoc(companyRef, {
        ...form,
        updatedAt: serverTimestamp(),
      });
      
      // Log Activity
      try {
        const { addDoc, collection } = await import('firebase/firestore');
        await addDoc(collection(db, 'activities'), {
          type: 'setting_update',
          title: 'Settings Updated',
          subtitle: `Company profile was updated by ${user?.email}`,
          companyId: company.id,
          createdAt: serverTimestamp(),
        });
      } catch (logErr) {
        console.error("Activity log failed:", logErr);
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to update settings.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight mb-2 text-white">System Configuration</h1>
          <p className="text-neutral-500 text-sm">Fine-tune your OS environment, security parameters, and regional metadata.</p>
        </div>
      </div>

      <div className="space-y-8">
        <form onSubmit={handleSubmit}>
          <Card className="p-8 border-white/5 bg-neutral-900 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/5 rounded-full blur-3xl pointer-events-none group-hover:bg-blue-600/10 transition-colors" />
            
            <div className="flex flex-col md:flex-row items-center justify-between mb-12 gap-6 relative z-10 text-center md:text-left">
              <div className="flex flex-col md:flex-row items-center gap-6">
                <div className="w-16 h-16 bg-white/[0.03] rounded-2xl flex items-center justify-center border border-white/[0.05] group-hover:scale-110 transition-transform">
                  <Building className="w-8 h-8 text-blue-500" />
                </div>
                <div>
                  <h2 className="font-display font-bold text-2xl text-white">Master Entity Profile</h2>
                  <p className="text-sm text-neutral-500 font-mono">NODE_OS_ID: {company?.id.slice(0, 12).toUpperCase()}</p>
                </div>
              </div>
              <div className="flex flex-col md:flex-row items-center gap-4">
                <div className="flex items-center">
                    {success && (
                    <motion.span initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-1.5 text-emerald-500 text-xs font-bold uppercase tracking-widest mr-4">
                        <Check className="w-4 h-4" /> Parameters Synced
                    </motion.span>
                    )}
                    {error && (
                    <motion.span initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-1.5 text-red-500 text-xs font-bold uppercase tracking-widest mr-4">
                        <AlertCircle className="w-4 h-4" /> ERROR_LOG_FAIL
                    </motion.span>
                    )}
                </div>
                <Button type="submit" disabled={loading} className="px-8 h-12 shadow-xl shadow-blue-600/10">
                  {loading ? 'Initializing Sync...' : 'Commit Changes'}
                </Button>
              </div>
            </div>
            
            <div className="grid lg:grid-cols-3 gap-12 relative z-10">
              <div className="lg:col-span-2 space-y-8">
                <div className="grid md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                    <Label>Entity Official Name</Label>
                    <Input 
                        required 
                        value={form.name} 
                        onChange={e => setForm({...form, name: e.target.value})} 
                        placeholder="e.g. Acme Industrials"
                    />
                    </div>
                    <div className="space-y-2">
                    <Label>Industry Classification</Label>
                    <select 
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all appearance-none"
                        value={form.industry}
                        onChange={e => setForm({...form, industry: e.target.value})}
                    >
                        <option className="bg-neutral-900">Retail</option>
                        <option className="bg-neutral-900">SaaS</option>
                        <option className="bg-neutral-900">Manufacturing</option>
                        <option className="bg-neutral-900">Services</option>
                        <option className="bg-neutral-900">Technology</option>
                    </select>
                    </div>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <Label>Currency Unit</Label>
                    <select 
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all appearance-none"
                      value={form.currency}
                      onChange={e => setForm({...form, currency: e.target.value})}
                    >
                      <option value="USD" className="bg-neutral-900">USD ($) - US Dollars</option>
                      <option value="EUR" className="bg-neutral-900">EUR (€) - Euros</option>
                      <option value="GBP" className="bg-neutral-900">GBP (£) - British Pounds</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Identity Sync Contact</Label>
                    <Input 
                      value={form.phone} 
                      onChange={e => setForm({...form, phone: e.target.value})} 
                      placeholder="+1 (555) OS-BLOCK"
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
                        <h3 className="font-bold text-sm text-white uppercase tracking-widest">Protocol Status</h3>
                    </div>
                    <p className="text-xs text-neutral-500 leading-relaxed italic">Your node is currently operating on the <span className="text-blue-400 font-bold">REMIX_OS_ENTERPRISE</span> protocol. High-throughput features enabled.</p>
                    
                    <div className="space-y-3 pt-4">
                        <div className="flex items-center justify-between py-2 border-b border-white/[0.03]">
                            <span className="text-[10px] uppercase font-bold text-neutral-600 tracking-widest">Node Tier</span>
                            <span className="text-[10px] font-mono bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20 uppercase font-bold">Priority V1</span>
                        </div>
                        <div className="flex items-center justify-between py-2">
                            <span className="text-[10px] uppercase font-bold text-neutral-600 tracking-widest">Entity Health</span>
                            <div className="flex gap-1">
                                {[1,2,3,4,5].map(i => <div key={i} className="w-2.5 h-1 bg-emerald-500 rounded-full" />)}
                            </div>
                        </div>
                    </div>
                    
                    <Button variant="ghost" type="button" className="w-full mt-2 text-[10px] uppercase font-bold tracking-[0.2em] border border-white/5 h-11">
                        System Protocol Control
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
              <h2 className="font-display font-bold text-2xl text-white">Identity Access Control</h2>
              <p className="text-sm text-neutral-500 mt-1 italic">
                Managed by terminal access: <span className="text-neutral-300 font-mono">{user?.email}</span>
              </p>
            </div>
            <div className="md:ml-auto">
                <Button variant="secondary" disabled className="text-[10px] uppercase tracking-widest font-bold opacity-50 px-6">
                    Multi-Admin coming in v2.4
                </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
