import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, Button, Input, Label } from '../components/Common';
import { Plus, Search, Box, Trash2, Tag, DollarSign, Layers, Edit2, Download } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { UpgradeModal } from '../components/UpgradeModal';
import { PLANS, isLimitReached } from '../lib/plans';
import { exportToCSV } from '../lib/exportUtils';

interface Product {
  id: string;
  name: string;
  price: number;
  stockLevel: number;
  category: string;
  sku: string;
  description?: string;
  status: 'active' | 'draft' | 'archived';
}

export function Products() {
  const { company, role } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const { canEditProducts } = usePermissions();

  useEffect(() => {
    if (location.state?.action === 'create') {
      handleCreateNew();
      // Clear state so it doesn't open again on refresh
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state]);

  const [form, setForm] = useState<{
    name: string;
    price: string;
    stockLevel: string;
    category: string;
    sku: string;
    description: string;
    status: 'active' | 'draft' | 'archived';
  }>({ 
    name: '', 
    price: '', 
    stockLevel: '', 
    category: '', 
    sku: '', 
    description: '',
    status: 'active'
  });

  const handleCreateNew = () => {
    const planId = company?.subscription?.planId || 'starter';
    const plan = PLANS[planId];
    if (isLimitReached(products.length, plan.limits.products)) {
      setIsUpgradeModalOpen(true);
      return;
    }
    setSelectedProduct(null);
    setForm({ name: '', price: '', stockLevel: '', category: '', sku: '', description: '', status: 'active' });
    setIsModalOpen(true);
  };

  const fetchProducts = async () => {
    if (!company) return;
    const q = query(collection(db, 'products'), where('companyId', '==', company.id));
    const snap = await getDocs(q);
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
    setProducts(list);
  };

  useEffect(() => {
    fetchProducts();
  }, [company]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company || !form.name) return;

    setLoading(true);
    try {
      const productData = {
        ...form,
        price: parseFloat(form.price) || 0,
        stockLevel: parseInt(form.stockLevel) || 0,
      };

      if (selectedProduct) {
        // Update
        const productRef = doc(db, 'products', selectedProduct.id);
        await updateDoc(productRef, {
          ...productData,
          updatedAt: serverTimestamp(),
        });

        // Log Activity
        await addDoc(collection(db, 'activities'), {
          type: 'product_update',
          title: 'Product Updated',
          subtitle: `${form.name} was modified`,
          companyId: company.id,
          createdAt: serverTimestamp(),
        });
      } else {
        // Create
        await addDoc(collection(db, 'products'), {
          ...productData,
          companyId: company.id,
          createdAt: serverTimestamp(),
        });

        // Log Activity
        await addDoc(collection(db, 'activities'), {
          type: 'product_create',
          title: 'Product Created',
          subtitle: `${form.name} added to catalog`,
          companyId: company.id,
          createdAt: serverTimestamp(),
        });
      }
      setIsModalOpen(false);
      setSelectedProduct(null);
      setForm({ name: '', price: '', stockLevel: '', category: '', sku: '', description: '', status: 'active' });
      fetchProducts();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (product: Product) => {
    setSelectedProduct(product);
    setForm({
      name: product.name,
      price: product.price.toString(),
      stockLevel: product.stockLevel.toString(),
      category: product.category || '',
      sku: product.sku || '',
      description: product.description || '',
      status: product.status || 'active',
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedProduct(null);
    setForm({ name: '', price: '', stockLevel: '', category: '', sku: '', description: '', status: 'active' });
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this product? This will impact inventory records.')) {
      await deleteDoc(doc(db, 'products', id));
      fetchProducts();
    }
  };

  const filtered = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.sku?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight mb-2 text-white">Product Catalog</h1>
          <p className="text-neutral-500 text-sm">Centralized management of asset variants, pricing, and structural metadata.</p>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="secondary" 
            className="gap-2 px-6"
            onClick={() => exportToCSV(products.map(p => ({
              ID: p.id,
              Name: p.name,
              Price: p.price,
              Stock: p.stockLevel,
              Category: p.category,
              SKU: p.sku,
              Status: p.status
            })), 'products')}
            disabled={products.length === 0}
          >
            <Download className="w-4 h-4" /> Export CSV
          </Button>
          {role !== 'viewer' && (
            <Button onClick={handleCreateNew} className="gap-2 px-6">
              <Plus className="w-4 h-4" /> Initialize Asset
            </Button>
          )}
        </div>
      </div>

      <UpgradeModal 
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        title="Asset Allocation Limit"
        message="Your inventory protocol has reached its maximum variant capacity. Upgrade to expand your catalog matrix."
        limitName="Products"
      />

      <Card className="relative overflow-hidden group border-white/5 bg-neutral-900/40 p-0">
        <div className="p-6 border-b border-white/[0.05] bg-white/[0.01]">
          <div className="relative max-w-sm group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600 group-focus-within:text-blue-500 transition-colors" />
            <Input 
              placeholder="Search assets by SKU or name..." 
              className="pl-10 h-11 bg-black/40 border-white/10" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="table-header">Asset Identity</th>
                <th className="table-header">System Metadata</th>
                <th className="table-header">Unit Price</th>
                <th className="table-header">Node Stock</th>
                <th className="table-header text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((product, i) => (
                <motion.tr 
                  key={product.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="group hover:bg-white/[0.02] transition-colors"
                >
                  <td className="table-cell">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.05] flex items-center justify-center text-neutral-500 group-hover:border-blue-500/50 transition-colors">
                        <Box className="w-5 h-5 text-neutral-600 group-hover:text-blue-400 transition-colors" />
                      </div>
                      <div>
                        <p className="font-bold text-neutral-200">{product.name}</p>
                        <p className={`text-[9px] uppercase tracking-widest font-bold ${product.status === 'active' ? 'text-emerald-500' : 'text-neutral-500'}`}>{product.status}</p>
                      </div>
                    </div>
                  </td>
                  <td className="table-cell">
                    <div className="flex flex-col">
                      <span className="text-neutral-400 font-medium">{product.category || 'GENERIC'}</span>
                      <span className="text-[10px] text-neutral-600 font-mono tracking-tighter uppercase">{product.sku || 'NO_SKU_TAG'}</span>
                    </div>
                  </td>
                  <td className="table-cell font-mono text-white text-sm">
                    <span className="text-neutral-600 mr-0.5">$</span>{product.price.toFixed(2)}
                  </td>
                  <td className="table-cell">
                    <div className="flex items-center gap-3">
                      <div className="h-1.5 w-16 bg-white/[0.03] rounded-full overflow-hidden border border-white/[0.05]">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min((product.stockLevel / 50) * 100, 100)}%` }}
                          className={`h-full rounded-full ${product.stockLevel > 10 ? 'bg-emerald-500/50' : 'bg-amber-500/50'}`}
                        />
                      </div>
                      <span className="text-xs font-mono text-neutral-400">{product.stockLevel}</span>
                    </div>
                  </td>
                  <td className="table-cell text-right">
                    {canEditProducts && (
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                        <Button variant="ghost" className="w-9 h-9 p-0 rounded-lg" onClick={() => handleEdit(product)}>
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" className="w-9 h-9 p-0 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-400/5" onClick={() => handleDelete(product.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile View */}
        <div className="sm:hidden divide-y divide-white/[0.05]">
          {filtered.map((product, i) => (
            <motion.div 
              key={product.id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="p-4 space-y-3 active:bg-white/[0.02]"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.05] flex items-center justify-center shrink-0">
                    <Box className="w-5 h-5 text-neutral-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-neutral-200 truncate">{product.name}</p>
                    <p className="text-[10px] text-neutral-600 font-mono truncate">{product.sku || 'NO_SKU'}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-mono text-white text-sm">${product.price.toFixed(2)}</p>
                  <p className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest">{product.stockLevel} In Node</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${product.status === 'active' ? 'text-emerald-500 border-emerald-500/20 bg-emerald-500/5' : 'text-neutral-500 border-white/5 bg-white/5'}`}>
                  {product.status}
                </span>
                {canEditProducts && (
                  <div className="flex gap-1">
                    <Button variant="ghost" className="w-8 h-8 p-0 rounded-lg" onClick={() => handleEdit(product)}>
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="py-24 text-center">
             <div className="flex flex-col items-center gap-6 text-neutral-600 max-w-sm mx-auto p-6">
              <div className="w-20 h-20 rounded-3xl border border-dashed border-white/10 flex items-center justify-center bg-white/[0.01]">
                <Box className="w-10 h-10 opacity-20" />
              </div>
              <div className="space-y-2">
                <p className="text-lg font-bold text-neutral-200">Initialize your Manifest.</p>
                <p className="text-xs leading-relaxed text-neutral-500 px-4">Register your first product to begin tracking inventory and generating sales telemetry.</p>
              </div>
              {canEditProducts && (
                <Button onClick={handleCreateNew} className="gap-2 px-8 h-12 shadow-xl shadow-blue-600/20">
                  <Plus className="w-4 h-4" /> Add first product
                </Button>
              )}
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
              className="bg-neutral-900 w-full max-w-2xl rounded-3xl border border-white/10 shadow-2xl overflow-hidden shadow-black"
            >
              <div className="p-8 border-b border-white/[0.05] flex justify-between items-center bg-white/[0.02]">
                <h2 className="font-display text-xl font-bold text-white uppercase tracking-tight">
                  {selectedProduct ? 'Asset Parameters' : 'Product Node Initialization'}
                </h2>
                <button onClick={handleCloseModal} className="p-2 text-neutral-500 hover:text-white transition-colors rounded-full hover:bg-white/5">
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="col-span-2">
                    <Label>Asset Functional Name</Label>
                    <Input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Kinetic Processor Pro" />
                  </div>
                  <div>
                    <Label>Categorization Node</Label>
                    <Input value={form.category} onChange={e => setForm({...form, category: e.target.value})} placeholder="e.g. Hardware" />
                  </div>
                  <div>
                    <Label>System SKU Tag</Label>
                    <Input value={form.sku} onChange={e => setForm({...form, sku: e.target.value})} placeholder="e.g. SK-1002-X" />
                  </div>
                  <div>
                    <Label>Base Valuation ($)</Label>
                    <Input required type="number" step="0.01" value={form.price} onChange={e => setForm({...form, price: e.target.value})} placeholder="0.00" />
                  </div>
                  <div>
                    <Label>Initial Node Stock</Label>
                    <Input required type="number" value={form.stockLevel} onChange={e => setForm({...form, stockLevel: e.target.value})} placeholder="0" />
                  </div>
                  <div className="col-span-2">
                    <Label>Deployment Status</Label>
                    <select 
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all appearance-none"
                      value={form.status}
                      onChange={e => setForm({...form, status: e.target.value as any})}
                    >
                      <option value="active" className="bg-neutral-900">Active Node</option>
                      <option value="draft" className="bg-neutral-900">System Draft</option>
                      <option value="archived" className="bg-neutral-900">Archived Status</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <Label>Asset Manifest / Description</Label>
                    <textarea 
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all min-h-[100px]"
                      value={form.description}
                      onChange={e => setForm({...form, description: e.target.value})}
                      placeholder="Detailed specifications for the node log..."
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-6">
                  <Button type="button" variant="secondary" onClick={handleCloseModal} className="px-6">Abort</Button>
                  <Button type="submit" disabled={loading} className="px-8">
                    {loading ? 'Processing...' : selectedProduct ? 'Sync Parameters' : 'Register Asset'}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
