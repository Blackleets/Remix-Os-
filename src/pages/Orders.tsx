import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, Button, Input, Label } from '../components/Common';
import { ClipboardList, Plus, Search, ShoppingBag, CreditCard, ChevronRight, Trash2, AlertCircle, Download } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { db } from '../lib/firebase';
import { collection, query, where, serverTimestamp, doc, increment, runTransaction, onSnapshot, orderBy } from 'firebase/firestore';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { UpgradeModal } from '../components/UpgradeModal';
import { PLANS, isLimitReached } from '../lib/plans';
import { exportToCSV } from '../lib/exportUtils';

interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
}

interface Order {
  id: string;
  customerId: string;
  customerName: string;
  total: number;
  status: string;
  paymentMethod: string;
  createdAt: any;
}

interface Product {
  id: string;
  name: string;
  price: number;
  stockLevel: number;
}

export function Orders() {
  const { company } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { canEditOrders } = usePermissions();

  useEffect(() => {
    if (location.state?.action === 'create') {
      handleCreateNew();
      setError(null);
      // Clear state so it doesn't open again on refresh
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state]);
  
  const [form, setForm] = useState({ 
    customerId: '', 
    paymentMethod: 'Card',
    items: [] as OrderItem[]
  });

  const getMonthlyOrdersCount = () => {
    const now = new Date();
    const start = startOfMonth(now);
    const end = endOfMonth(now);
    
    return orders.filter(o => {
      if (!o.createdAt) return false;
      const date = o.createdAt.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
      return date >= start && date <= end;
    }).length;
  };

  const handleCreateNew = () => {
    const planId = company?.subscription?.planId || 'starter';
    const plan = PLANS[planId];
    const monthlyCount = getMonthlyOrdersCount();
    
    if (isLimitReached(monthlyCount, plan.limits.orders)) {
      setIsUpgradeModalOpen(true);
      return;
    }
    setForm({ customerId: '', paymentMethod: 'Card', items: [] });
    setIsModalOpen(true);
  };

  useEffect(() => {
    if (!company) return;
    
    // real-time orders
    const qOrders = query(
      collection(db, 'orders'), 
      where('companyId', '==', company.id),
      orderBy('createdAt', 'desc')
    );
    const unsubscribeOrders = onSnapshot(qOrders, (snap) => {
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() } as Order)));
    });

    // real-time customers
    const qCust = query(collection(db, 'customers'), where('companyId', '==', company.id));
    const unsubscribeCustomers = onSnapshot(qCust, (snap) => {
      setCustomers(snap.docs.map(d => ({ id: d.id, name: d.data().name })));
    });

    // real-time products
    const qProd = query(collection(db, 'products'), where('companyId', '==', company.id));
    const unsubscribeProducts = onSnapshot(qProd, (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
    });

    return () => {
      unsubscribeOrders();
      unsubscribeCustomers();
      unsubscribeProducts();
    };
  }, [company]);

  const addItem = () => {
    setForm({
      ...form,
      items: [...form.items, { productId: '', productName: '', quantity: 1, price: 0 }]
    });
  };

  const removeItem = (index: number) => {
    const newItems = [...form.items];
    newItems.splice(index, 1);
    setForm({ ...form, items: newItems });
  };

  const updateItem = (index: number, fields: Partial<OrderItem>) => {
    const newItems = [...form.items];
    const item = { ...newItems[index], ...fields };
    
    if (fields.productId) {
      const p = products.find(prod => prod.id === fields.productId);
      if (p) {
        item.productName = p.name;
        item.price = p.price;
      }
    }
    
    newItems[index] = item;
    setForm({ ...form, items: newItems });
  };

  const calculateTotal = () => {
    return form.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company || !form.customerId || form.items.length === 0) {
      setError("Please select a customer and at least one item.");
      return;
    }

    if (form.items.some(i => !i.productId)) {
      setError("Please select a product for all items.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const customer = customers.find(c => c.id === form.customerId);
      const total = calculateTotal();

      await runTransaction(db, async (transaction) => {
        // 1. Verify all stock first
        const productRefs = form.items.map(item => doc(db, 'products', item.productId));
        const productSnaps = await Promise.all(productRefs.map(ref => transaction.get(ref)));
        
        for (let i = 0; i < form.items.length; i++) {
          const item = form.items[i];
          const snap = productSnaps[i];
          if (!snap.exists()) throw new Error(`Product ${item.productName} not found.`);
          
          const currentStock = snap.data().stockLevel || 0;
          if (currentStock < item.quantity) {
            throw new Error(`Insufficient stock for ${snap.data().name}. Available: ${currentStock}`);
          }
        }

        // 2. Create Order
        const orderRef = doc(collection(db, 'orders'));
        transaction.set(orderRef, {
          customerId: form.customerId,
          customerName: customer?.name || 'Guest',
          total,
          paymentMethod: form.paymentMethod,
          status: 'completed',
          companyId: company.id,
          createdAt: serverTimestamp(),
        });

        // 3. Create Order Items & Update Stock & Log Movements
        for (const item of form.items) {
          const itemRef = doc(collection(db, 'orders', orderRef.id, 'items'));
          transaction.set(itemRef, {
            ...item,
            createdAt: serverTimestamp()
          });

          const pRef = doc(db, 'products', item.productId);
          transaction.update(pRef, {
            stockLevel: increment(-item.quantity)
          });

          const mRef = doc(collection(db, 'inventoryMovements'));
          transaction.set(mRef, {
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            type: 'out',
            reason: 'Sale',
            orderId: orderRef.id,
            companyId: company.id,
            createdAt: serverTimestamp()
          });
        }

        // 4. Update Customer Stats and Segment
        const cRef = doc(db, 'customers', form.customerId);
        const cSnap = await transaction.get(cRef);
        if (cSnap.exists()) {
          const cData = cSnap.data();
          const newTotalSpent = (cData.totalSpent || 0) + total;
          const newTotalOrders = (cData.totalOrders || 0) + 1;
          
          let segment = 'regular';
          if (newTotalSpent > 5000) segment = 'whale';
          else if (newTotalSpent > 1000) segment = 'vip';
          else if (newTotalOrders === 1) segment = 'new';

          transaction.update(cRef, {
            totalSpent: newTotalSpent,
            totalOrders: newTotalOrders,
            lastOrderAt: serverTimestamp(),
            segment
          });
        }

        // 5. Log General Activity
        const aRef = doc(collection(db, 'activities'));
        transaction.set(aRef, {
          type: 'order_create',
          title: 'Order Confirmed',
          subtitle: `${customer?.name || 'Guest'} purchased items ($${total.toFixed(2)})`,
          orderId: orderRef.id,
          companyId: company.id,
          createdAt: serverTimestamp()
        });
      });

      setIsModalOpen(false);
      setForm({ customerId: '', paymentMethod: 'Card', items: [] });
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred while placing the order.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight mb-2 text-white">Sales Ledger</h1>
          <p className="text-neutral-500 text-sm">Comprehensive transaction record and revenue vector history.</p>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="secondary" 
            className="gap-2 px-6"
            onClick={() => exportToCSV(orders.map(o => ({
              ID: o.id,
              Customer: o.customerName,
              Total: o.total,
              Status: o.status,
              Payment: o.paymentMethod,
              Date: o.createdAt && o.createdAt.toDate ? o.createdAt.toDate().toISOString() : o.createdAt
            })), 'orders')}
            disabled={orders.length === 0}
          >
            <Download className="w-4 h-4" /> Export CSV
          </Button>
          {canEditOrders && (
            <Button onClick={() => { handleCreateNew(); setError(null); }} className="gap-2 px-6 shadow-lg shadow-blue-600/20">
              <Plus className="w-4 h-4" /> Log Transaction
            </Button>
          )}
        </div>
      </div>

      <UpgradeModal 
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        title="Transaction Limit Reached"
        message="Monthly transaction throughput has peaked for your current plan. Synchronize to a higher tier to restore commercial flow."
        limitName="Monthly Orders"
      />

      <Card className="relative overflow-hidden group border-white/5 bg-neutral-900/40 p-0">
        <div className="p-6 border-b border-white/[0.05] bg-white/[0.01] flex flex-col md:flex-row justify-between gap-4">
          <div className="relative max-w-sm group w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600 group-focus-within:text-blue-500 transition-colors" />
            <Input 
              placeholder="Search ledger by order ID or customer..." 
              className="pl-10 h-11 bg-black/40 border-white/10" 
            />
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" className="text-xs px-4 h-11 border border-white/10">Filter Logs</Button>
            <Button variant="secondary" className="text-xs px-4 h-11 border border-white/10">Export Dataset</Button>
          </div>
        </div>

        <div className="hidden sm:block overflow-x-auto overflow-y-auto max-h-[700px]">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-neutral-900/90 backdrop-blur-md">
                <th className="table-header">Transaction ID</th>
                <th className="table-header">Temporal Node</th>
                <th className="table-header">Counterparty</th>
                <th className="table-header">Net Value</th>
                <th className="table-header">Vector State</th>
                <th className="table-header text-right">Modality</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order, i) => (
                <motion.tr 
                  key={order.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="group border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors last:border-0 cursor-pointer"
                >
                  <td className="table-cell">
                    <span className="font-mono text-[11px] text-neutral-500 uppercase tracking-tighter">
                      NODE_#{order.id.slice(0, 8)}
                    </span>
                  </td>
                  <td className="table-cell">
                    <span className="text-[11px] font-bold text-neutral-500 uppercase">
                      {order.createdAt?.toDate ? format(order.createdAt.toDate(), 'MMM dd, HH:mm') : 'SYNC_PENDING'}
                    </span>
                  </td>
                  <td className="table-cell font-bold text-neutral-200">{order.customerName}</td>
                  <td className="table-cell font-mono font-bold text-blue-400">
                    <span className="text-neutral-600 mr-0.5">$</span>{order.total.toFixed(2)}
                  </td>
                  <td className="table-cell">
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-500 uppercase tracking-widest">
                      {order.status}
                    </span>
                  </td>
                  <td className="table-cell text-right">
                    <div className="flex items-center justify-end gap-3 text-neutral-500 group-hover:text-blue-500 transition-colors">
                      <CreditCard className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">{order.paymentMethod}</span>
                      <ChevronRight className="w-4 h-4 ml-1 opacity-0 group-hover:opacity-100 transition-all translate-x-[-4px] group-hover:translate-x-0" />
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile View */}
        <div className="sm:hidden divide-y divide-white/[0.05]">
          {orders.map((order, i) => (
            <motion.div 
              key={order.id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="p-4 space-y-3 active:bg-white/[0.02]"
              onClick={() => {}} // Could navigate to details
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-tighter">
                  #{order.id.slice(0, 8)}
                </span>
                <span className="text-[10px] font-bold text-neutral-600 uppercase">
                  {order.createdAt?.toDate ? format(order.createdAt.toDate(), 'MMM dd, HH:mm') : 'SYNCING'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-neutral-200">{order.customerName}</p>
                  <p className="text-[10px] text-neutral-500 uppercase tracking-widest mt-0.5">{order.paymentMethod}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono font-bold text-blue-400 text-base">${order.total.toFixed(2)}</p>
                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-black text-emerald-500 uppercase tracking-[0.15em] mt-1">
                    {order.status}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {orders.length === 0 && (
          <div className="py-24 text-center">
             <div className="flex flex-col items-center gap-6 text-neutral-600 max-w-sm mx-auto p-6">
              <div className="w-20 h-20 rounded-3xl border border-dashed border-white/10 flex items-center justify-center bg-white/[0.01]">
                <ShoppingBag className="w-10 h-10 opacity-20" />
              </div>
              <div className="space-y-2">
                <p className="text-lg font-bold text-neutral-200">The Ledger is Void.</p>
                <p className="text-xs leading-relaxed text-neutral-500 px-4">No transaction cycles detected. Log your first sale to activate revenue tracking.</p>
              </div>
              <Button onClick={() => { handleCreateNew(); setError(null); }} className="gap-2 px-8 h-12 shadow-xl shadow-blue-600/20">
                <Plus className="w-4 h-4" /> Create first order
              </Button>
            </div>
          </div>
        )}
      </Card>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-neutral-900 w-full max-w-2xl rounded-3xl border border-white/10 shadow-2xl overflow-hidden shadow-black flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-white/[0.05] flex justify-between items-center bg-white/[0.02]">
                <h2 className="font-display text-xl font-bold text-white uppercase tracking-tight">Transaction Initialization</h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-neutral-500 hover:text-white transition-colors rounded-full hover:bg-white/5">
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                <form onSubmit={handleSubmit} className="p-8 space-y-10">
                  {error && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex gap-3 text-red-500">
                      <AlertCircle className="w-5 h-5 flex-shrink-0" />
                      <p className="text-sm font-bold">{error}</p>
                    </motion.div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
                    <div className="space-y-2">
                      <Label>Counterparty Identity</Label>
                      <select required className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all appearance-none" value={form.customerId} onChange={e => setForm({...form, customerId: e.target.value})}>
                        <option value="" className="bg-neutral-900">Select customer node...</option>
                        {customers.map(c => <option key={c.id} value={c.id} className="bg-neutral-900">{c.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Financial Modality</Label>
                      <select className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all appearance-none" value={form.paymentMethod} onChange={e => setForm({...form, paymentMethod: e.target.value})}>
                        <option className="bg-neutral-900">Card</option>
                        <option className="bg-neutral-900">Cash</option>
                        <option className="bg-neutral-900">Transfer</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-end border-b border-white/[0.05] pb-2">
                      <Label className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-bold">Transaction Components</Label>
                      <Button type="button" variant="ghost" className="h-7 text-[10px] gap-1 hover:bg-white/5 uppercase tracking-widest px-3 border border-white/10" onClick={addItem}>
                        <Plus className="w-3 h-3" /> Append Unit
                      </Button>
                    </div>
                    
                    <div className="space-y-4">
                      {form.items.map((item, index) => (
                        <div key={index} className="flex flex-col sm:flex-row gap-4 items-start sm:items-center bg-white/[0.02] border border-white/[0.05] p-4 rounded-2xl">
                          <div className="flex-1 w-full">
                            <select 
                              required 
                              className="w-full bg-transparent border-0 text-sm text-white focus:ring-0 outline-none appearance-none"
                              value={item.productId}
                              onChange={e => updateItem(index, { productId: e.target.value })}
                            >
                              <option value="" className="bg-neutral-900">Select Asset Variant...</option>
                              {products.map(p => (
                                <option key={p.id} value={p.id} className="bg-neutral-900">
                                  {p.name} (${p.price.toFixed(2)})
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="flex items-center gap-4 w-full sm:w-auto mt-2 sm:mt-0">
                            <div className="flex-1 sm:w-24">
                              <Input 
                                type="number" 
                                min="1" 
                                required
                                className="h-10 bg-black/40 text-center"
                                value={item.quantity}
                                onChange={e => updateItem(index, { quantity: parseInt(e.target.value) || 1 })}
                              />
                            </div>
                            <Button 
                              type="button" 
                              variant="ghost" 
                              className="w-10 h-10 p-0 text-neutral-600 hover:text-red-500 shrink-0"
                              onClick={() => removeItem(index)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      {form.items.length === 0 && (
                        <div className="py-12 text-center bg-white/[0.01] rounded-2xl border border-dashed border-white/10">
                          <p className="text-[10px] uppercase font-bold tracking-widest text-neutral-700 italic">Empty_Transaction_Buffer</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-8 border-t border-white/[0.05] space-y-8">
                    <div className="flex justify-between items-center px-2">
                        <div>
                            <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Total Valuation</p>
                            <span className="text-neutral-500 text-xs italic">All taxes and fees included</span>
                        </div>
                      <span className="text-4xl font-mono font-bold text-white tracking-tighter">
                        <span className="text-blue-500 mr-1">$</span>{calculateTotal().toFixed(2)}
                      </span>
                    </div>
                    <Button type="submit" disabled={loading} className="w-full h-14 text-sm font-bold uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-blue-600/10">
                      {loading ? 'Finalizing Transaction Hash...' : 'Commit Transaction'}
                    </Button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

