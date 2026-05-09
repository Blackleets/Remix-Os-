import { useEffect, useState } from 'react';
import { Card, Button, Input, Label } from '../components/Common';
import { Database, Move, Filter, ArrowDownLeft, ArrowUpRight, History, Download, ShieldAlert } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLocale } from '../hooks/useLocale';
import { usePermissions } from '../hooks/usePermissions';
import { db } from '../lib/firebase';
import { collection, query, where, addDoc, serverTimestamp, orderBy, doc, increment, runTransaction, onSnapshot } from 'firebase/firestore';
import { format } from 'date-fns';
import { exportToCSV } from '../lib/exportUtils';

interface Movement {
  id: string;
  type: 'in' | 'out';
  quantity: number;
  reason: string;
  productName: string;
  createdAt: any;
}

export function Inventory() {
  const { company } = useAuth();
  const { t } = useLocale();
  const [movements, setMovements] = useState<Movement[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [form, setForm] = useState({ productId: '', quantity: '', type: 'in', reason: '' });

  const { canEditInventory } = usePermissions();

  useEffect(() => {
    if (!company) return;
    
    // real-time movements
    const qMoved = query(
      collection(db, 'inventoryMovements'), 
      where('companyId', '==', company.id),
      orderBy('createdAt', 'desc')
    );
    const unsubscribeMovements = onSnapshot(qMoved, (snap) => {
      setMovements(snap.docs.map(d => ({ id: d.id, ...d.data() } as Movement)));
    });

    // real-time products
    const qProd = query(collection(db, 'products'), where('companyId', '==', company.id));
    const unsubscribeProducts = onSnapshot(qProd, (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubscribeMovements();
      unsubscribeProducts();
    };
  }, [company]);

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdjustError(null);
    if (!form.productId || !form.quantity || !company) return;
    const qty = parseInt(form.quantity);
    if (!qty || qty < 1) { setAdjustError('Quantity must be at least 1.'); return; }

    setLoading(true);
    try {
      const product = products.find(p => p.id === form.productId);
      
      await runTransaction(db, async (transaction) => {
        const prodRef = doc(db, 'products', form.productId);
        const prodSnap = await transaction.get(prodRef);
        
        if (!prodSnap.exists()) throw new Error(t('inventory.alerts.not_found'));
        
        const currentStock = prodSnap.data().stockLevel || 0;
        if (form.type === 'out' && currentStock < qty) {
          throw new Error(t('inventory.alerts.insufficient', { count: currentStock }));
        }

        // 1. Log movement
        const moveRef = doc(collection(db, 'inventoryMovements'));
        transaction.set(moveRef, {
          ...form,
          quantity: qty,
          productName: product?.name || 'Unknown',
          companyId: company.id,
          createdAt: serverTimestamp(),
        });

        // 2. Update product stock
        transaction.update(prodRef, {
          stockLevel: increment(form.type === 'in' ? qty : -qty)
        });

        // 3. Log General Activity
        const actRef = doc(collection(db, 'activities'));
        transaction.set(actRef, {
          type: 'inventory_update',
          title: `Stock ${form.type.toUpperCase()}`,
          subtitle: `${product?.name || 'Item'} (${form.type === 'in' ? '+' : '-'}${qty})`,
          companyId: company.id,
          createdAt: serverTimestamp(),
        });
      });

      setForm({ productId: '', quantity: '', type: 'in', reason: '' });
    } catch (err: any) {
      setAdjustError(err.message || t('inventory.alerts.failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight mb-2 text-white">{t('inventory.title')}</h1>
          <p className="text-neutral-500 text-sm">{t('inventory.subtitle')}</p>
        </div>
        <Button 
          variant="secondary" 
          className="gap-2 px-6 h-12"
          onClick={() => exportToCSV(movements.map(m => ({
            ID: m.id,
            Type: m.type,
            Quantity: m.quantity,
            Reason: m.reason,
            Product: m.productName,
            Date: m.createdAt && m.createdAt.toDate ? m.createdAt.toDate().toISOString() : m.createdAt
          })), 'inventory_movements')}
          disabled={movements.length === 0}
        >
          <Download className="w-4 h-4" /> {t('common.export')}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          {canEditInventory ? (
            <Card className="p-6 h-fit bg-neutral-900 shadow-2xl border-white/5">
              <div className="flex items-center gap-3 mb-8 border-b border-white/[0.05] pb-4">
                <div className="w-8 h-8 rounded-lg bg-blue-600/10 border border-blue-500/20 flex items-center justify-center">
                  <Move className="w-4 h-4 text-blue-500" />
                </div>
                <h2 className="font-display font-bold text-lg text-white uppercase tracking-tight">{t('inventory.manual_adjustment')}</h2>
              </div>
              <form onSubmit={handleAdjust} className="space-y-6">
                <div className="space-y-2">
                  <Label>{t('inventory.target_asset')}</Label>
                  <select 
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all appearance-none"
                    value={form.productId}
                    onChange={e => setForm({...form, productId: e.target.value})}
                    required
                  >
                    <option value="" className="bg-neutral-900 italic">{t('inventory.select_asset')}</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id} className="bg-neutral-900">
                        {p.name} [{p.stockLevel} {t('inventory.units')}]
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('inventory.vector_type')}</Label>
                    <select 
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all appearance-none"
                      value={form.type}
                      onChange={e => setForm({...form, type: e.target.value as any})}
                    >
                      <option value="in" className="bg-neutral-900 text-emerald-500 font-bold uppercase tracking-widest">{t('inventory.inflow')}</option>
                      <option value="out" className="bg-neutral-900 text-red-500 font-bold uppercase tracking-widest">{t('inventory.outflow')}</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('inventory.quantity')}</Label>
                    <Input 
                      type="number" 
                      required 
                      value={form.quantity}
                      onChange={e => setForm({...form, quantity: e.target.value})}
                      placeholder="0"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t('inventory.rationale')}</Label>
                  <Input 
                    placeholder={t('inventory.rationale_placeholder')} 
                    value={form.reason}
                    onChange={e => setForm({...form, reason: e.target.value})}
                  />
                </div>
                {adjustError && (
                  <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{adjustError}</p>
                )}
                <Button type="submit" disabled={loading} className="w-full h-12 text-sm font-bold uppercase tracking-widest shadow-lg shadow-blue-600/10">
                  {loading ? t('settings.syncing_msg') : t('inventory.commit')}
                </Button>
              </form>
            </Card>
          ) : (
            <Card className="p-10 text-center bg-neutral-900/40 border-white/5 space-y-6">
              <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
                <ShieldAlert className="w-8 h-8 text-red-500" />
              </div>
              <div className="space-y-2">
                <h3 className="text-white font-bold uppercase tracking-widest text-xs">{t('inventory.access_denied')}</h3>
                <p className="text-neutral-500 text-[11px] leading-relaxed italic">
                  {t('inventory.access_denied_desc')}
                </p>
              </div>
            </Card>
          )}
        </div>

        <Card className="lg:col-span-2 p-0 overflow-hidden border-white/5 bg-neutral-900/40">
          <div className="p-6 border-b border-white/[0.05] flex justify-between items-center bg-white/[0.01]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-neutral-800 flex items-center justify-center border border-white/5">
                <History className="w-4 h-4 text-neutral-400" />
              </div>
              <h2 className="font-display font-bold text-lg text-white uppercase tracking-tight">{t('inventory.movement_logs')}</h2>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" className="w-9 h-9 p-0 rounded-lg text-neutral-500 hover:text-white border border-white/5 hover:bg-white/5">
                <Filter className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="hidden sm:block overflow-x-auto overflow-y-auto max-h-[600px]">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="bg-neutral-900/90 backdrop-blur-md">
                  <th className="table-header">{t('inventory.table.timestamp')}</th>
                  <th className="table-header">{t('inventory.table.asset')}</th>
                  <th className="table-header">{t('inventory.table.delta')}</th>
                  <th className="table-header">{t('inventory.table.reason')}</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((move, i) => (
                  <tr key={move.id} className="group border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors last:border-0 font-sans">
                    <td className="table-cell">
                      <span className="text-[10px] font-mono font-bold text-neutral-600 uppercase">
                        {move.createdAt?.toDate ? format(move.createdAt.toDate(), 'MM/dd HH:mm:ss') : t('inventory.table.live')}
                      </span>
                    </td>
                    <td className="table-cell font-bold text-neutral-200">{move.productName}</td>
                    <td className="table-cell">
                      <span className={cn(
                        "inline-flex items-center gap-1.5 font-bold text-xs px-2 py-1 rounded bg-white/[0.02] border border-white/[0.05]",
                        move.type === 'in' ? 'text-emerald-500' : 'text-red-500'
                      )}>
                        {move.type === 'in' ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                        {move.type === 'in' ? t('inventory.table.in') : t('inventory.table.out')}:{move.quantity}
                      </span>
                    </td>
                    <td className="table-cell">
                      <p className="text-[11px] text-neutral-500 italic max-w-xs truncate">{move.reason || t('inventory.table.manual')}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="sm:hidden divide-y divide-white/[0.05] overflow-y-auto max-h-[500px]">
            {movements.map((move, i) => (
              <div key={move.id} className="p-4 space-y-2 active:bg-white/[0.02]">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-mono font-bold text-neutral-600 uppercase">
                    {move.createdAt?.toDate ? format(move.createdAt.toDate(), 'MM/dd HH:mm:ss') : t('inventory.table.syncing')}
                  </span>
                  <span className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded border",
                    move.type === 'in' ? 'text-emerald-500 border-emerald-500/20 bg-emerald-500/5' : 'text-red-500 border-red-500/20 bg-red-500/5'
                  )}>
                    {move.type === 'in' ? '+' : '-'}{move.quantity}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-bold text-neutral-200">{move.productName}</p>
                  <p className="text-[10px] text-neutral-500 italic truncate mt-0.5">{move.reason || t('inventory.manual_adjustment')}</p>
                </div>
              </div>
            ))}
          </div>

          {movements.length === 0 && (
            <div className="py-24 text-center">
              <div className="flex flex-col items-center gap-4 text-neutral-600">
                <div className="w-12 h-12 rounded-full border border-dashed border-white/10 flex items-center justify-center">
                  <History className="w-6 h-6 opacity-20" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold uppercase tracking-widest text-neutral-500">{t('inventory.empty.title')}</p>
                  <p className="text-xs">{t('inventory.empty.subtitle')}</p>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
