import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, Button, Input, Label } from '../components/Common';
import { 
  Plus, 
  Search, 
  Mail, 
  Phone, 
  Trash2, 
  Edit2, 
  Users, 
  Download, 
  Bell, 
  MessageSquare, 
  Calendar as CalendarIcon, 
  History, 
  Send, 
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { db } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  serverTimestamp, 
  doc, 
  deleteDoc, 
  updateDoc, 
  orderBy,
  limit,
  Timestamp 
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { UpgradeModal } from '../components/UpgradeModal';
import { PLANS, isLimitReached } from '../lib/plans';
import { exportToCSV } from '../lib/exportUtils';
import { format } from 'date-fns';

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  companyId: string;
  totalSpent?: number;
  totalOrders?: number;
  segment?: 'whale' | 'vip' | 'regular' | 'new' | 'at_risk';
  lastOrderAt?: any;
}

const SEGMENTS = [
  { id: 'all', label: 'All Entities', color: 'bg-neutral-500/10 text-neutral-400' },
  { id: 'whale', label: 'Whale (Top 5%)', color: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' },
  { id: 'vip', label: 'VIP Priority', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  { id: 'active', label: 'Active Node', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  { id: 'at_risk', label: 'Dormant Warning', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  { id: 'new', label: 'New Link', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
];

interface Reminder {
  id: string;
  customerId: string;
  type: 'follow_up' | 'payment' | 'order' | 'reactivation';
  notes: string;
  dueDate: any;
  status: 'pending' | 'completed' | 'dismissed';
  createdAt: any;
}

interface CustomerMessage {
  id: string;
  customerId: string;
  content: string;
  channel: 'email' | 'whatsapp' | 'sms';
  status: 'draft' | 'ready' | 'sent';
  createdAt: any;
  sentAt?: any;
}

const MESSAGE_TEMPLATES = [
  { id: 'follow_up', label: 'Check-in', content: 'Hi {name}, checking in to see if you have any questions about our recent offerings.' },
  { id: 'payment', label: 'Payment', content: 'Dear {name}, this is a friendly reminder that invoice payment is now due. Thank you!' },
  { id: 'order_ready', label: 'Order Ready', content: 'Good news {name}! Your recent order is processed and ready for collection.' },
  { id: 'thank_you', label: 'Gratitude', content: 'Thank you for your continued business, {name}! We truly appreciate your support.' },
];

export function Customers() {
  const { company, role } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [detailCustomer, setDetailCustomer] = useState<Customer | null>(null);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [messages, setMessages] = useState<CustomerMessage[]>([]);
  const [search, setSearch] = useState('');
  const [segmentFilter, setSegmentFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'reminders' | 'messages' | 'history'>('info');
  const { canEditCustomers } = usePermissions();

  useEffect(() => {
    if (location.state?.action === 'create') {
      handleCreateNew();
      // Clear state so it doesn't open again on refresh
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state]);

  const [reminderForm, setReminderForm] = useState({
    type: 'follow_up' as Reminder['type'],
    notes: '',
    dueDate: format(new Date(), 'yyyy-MM-dd')
  });

  const [messageForm, setMessageForm] = useState({
    content: '',
    channel: 'email' as CustomerMessage['channel'],
    status: 'draft' as CustomerMessage['status']
  });

  useEffect(() => {
    if (detailCustomer) {
      fetchCustomerData(detailCustomer.id);
    }
  }, [detailCustomer]);

  const fetchCustomerData = async (customerId: string) => {
    if (!company) return;
    
    // Fetch reminders
    const rq = query(
      collection(db, 'reminders'), 
      where('customerId', '==', customerId),
      orderBy('dueDate', 'asc')
    );
    const rSnap = await getDocs(rq);
    setReminders(rSnap.docs.map(d => ({ id: d.id, ...d.data() } as Reminder)));

    // Fetch messages
    const mq = query(
      collection(db, 'customerMessages'), 
      where('customerId', '==', customerId),
      orderBy('createdAt', 'desc')
    );
    const mSnap = await getDocs(mq);
    setMessages(mSnap.docs.map(d => ({ id: d.id, ...d.data() } as CustomerMessage)));
  };

  const handleAddReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company || !detailCustomer) return;

    try {
      await addDoc(collection(db, 'reminders'), {
        ...reminderForm,
        companyId: company.id,
        customerId: detailCustomer.id,
        customerName: detailCustomer.name,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      setReminderForm({ type: 'follow_up', notes: '', dueDate: format(new Date(), 'yyyy-MM-dd') });
      fetchCustomerData(detailCustomer.id);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateMessage = async (status: CustomerMessage['status'] = 'draft') => {
    if (!company || !detailCustomer || !messageForm.content) return;

    try {
      await addDoc(collection(db, 'customerMessages'), {
        ...messageForm,
        status,
        companyId: company.id,
        customerId: detailCustomer.id,
        createdAt: serverTimestamp(),
        sentAt: status === 'sent' ? serverTimestamp() : null
      });
      setMessageForm({ content: '', channel: 'email', status: 'draft' });
      fetchCustomerData(detailCustomer.id);
    } catch (err) {
      console.error(err);
    }
  };

  const toggleReminderStatus = async (reminder: Reminder) => {
    const newStatus = reminder.status === 'pending' ? 'completed' : 'pending';
    await updateDoc(doc(db, 'reminders', reminder.id), { status: newStatus });
    if (detailCustomer) fetchCustomerData(detailCustomer.id);
  };

  const [form, setForm] = useState({ name: '', email: '', phone: '' });

  const handleCreateNew = () => {
    const planId = company?.subscription?.planId || 'starter';
    const plan = PLANS[planId];
    if (isLimitReached(customers.length, plan.limits.customers)) {
      setIsUpgradeModalOpen(true);
      return;
    }
    setSelectedCustomer(null);
    setForm({ name: '', email: '', phone: '' });
    setIsModalOpen(true);
  };

  const fetchCustomers = async () => {
    if (!company) return;
    const q = query(collection(db, 'customers'), where('companyId', '==', company.id));
    const snap = await getDocs(q);
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Customer));
    setCustomers(list);
  };

  useEffect(() => {
    fetchCustomers();
  }, [company]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company || !form.name) return;

    setLoading(true);
    try {
      if (selectedCustomer) {
        // Update
        const customerRef = doc(db, 'customers', selectedCustomer.id);
        await updateDoc(customerRef, {
          ...form,
          updatedAt: serverTimestamp(),
        });

        // Log Activity
        await addDoc(collection(db, 'activities'), {
          type: 'customer_update',
          title: 'Customer Updated',
          subtitle: `${form.name} profile was modified`,
          companyId: company.id,
          createdAt: serverTimestamp(),
        });
      } else {
        // Create
        await addDoc(collection(db, 'customers'), {
          ...form,
          companyId: company.id,
          createdAt: serverTimestamp(),
        });

        // Log Activity
        await addDoc(collection(db, 'activities'), {
          type: 'customer_create',
          title: 'New Customer',
          subtitle: `${form.name} joined the platform`,
          companyId: company.id,
          createdAt: serverTimestamp(),
        });
      }
      setIsModalOpen(false);
      setSelectedCustomer(null);
      setForm({ name: '', email: '', phone: '' });
      fetchCustomers();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (customer: Customer) => {
    setSelectedCustomer(customer);
    setForm({
      name: customer.name,
      email: customer.email || '',
      phone: customer.phone || '',
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedCustomer(null);
    setForm({ name: '', email: '', phone: '' });
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this customer?')) {
      await deleteDoc(doc(db, 'customers', id));
      fetchCustomers();
    }
  };

  const filtered = customers.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) || 
                         c.email.toLowerCase().includes(search.toLowerCase());
    
    if (segmentFilter === 'all') return matchesSearch;
    
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const lastOrderDate = c.lastOrderAt?.toDate ? c.lastOrderAt.toDate() : null;

    if (segmentFilter === 'active') {
       return matchesSearch && lastOrderDate && lastOrderDate > thirtyDaysAgo;
    }
    if (segmentFilter === 'at_risk') {
       // Either marked in DB or just hasn't ordered in 60 days but was a spender
       const isDormant = lastOrderDate && lastOrderDate < sixtyDaysAgo;
       return matchesSearch && (c.segment === 'at_risk' || (isDormant && (c.totalSpent || 0) > 0));
    }
    return matchesSearch && c.segment === segmentFilter;
  });

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight mb-2 text-white">CRM Vault</h1>
          <p className="text-neutral-500 text-sm">Unified repository for business contacts and interaction history.</p>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="secondary" 
            className="gap-2 px-6"
            onClick={() => exportToCSV(customers.map(c => ({
              ID: c.id,
              Name: c.name,
              Email: c.email,
              Phone: c.phone
            })), 'customers')}
            disabled={customers.length === 0}
          >
            <Download className="w-4 h-4" /> Export CSV
          </Button>
          {canEditCustomers && (
            <Button onClick={handleCreateNew} className="gap-2 px-6">
              <Plus className="w-4 h-4" /> Register Customer
            </Button>
          )}
        </div>
      </div>

      <UpgradeModal 
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        title="CRM Limit Reached"
        message="Your current protocol is maxed out at the designated customer node count. Scale up to accommodate more entities."
        limitName="Customers"
      />

      <Card className="relative overflow-hidden group border-white/5 bg-neutral-900/40 p-0">
        <div className="p-6 border-b border-white/[0.05] bg-white/[0.01] space-y-6">
          <div className="flex flex-wrap gap-2">
            {SEGMENTS.map(seg => (
              <button
                key={seg.id}
                onClick={() => setSegmentFilter(seg.id)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                  segmentFilter === seg.id 
                    ? 'bg-blue-600/10 border-blue-500/40 text-blue-400 ring-2 ring-blue-500/10' 
                    : 'bg-black/20 border-white/5 text-neutral-500 hover:border-white/20'
                }`}
              >
                {seg.label}
              </button>
            ))}
          </div>
          <div className="relative max-w-sm group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600 group-focus-within:text-blue-500 transition-colors" />
            <Input 
              placeholder="Filter registry by name or email hash..." 
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
                <th className="table-header w-1/3">Identity</th>
                <th className="table-header">Engagement Index</th>
                <th className="table-header">Lifetime Value</th>
                <th className="table-header text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((customer, i) => (
                <motion.tr 
                  key={customer.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="group hover:bg-white/[0.02] transition-colors"
                >
                  <td className="table-cell" onClick={() => {
                    setDetailCustomer(customer);
                    setActiveTab('info');
                  }}>
                    <div className="flex items-center gap-3 cursor-pointer">
                      <div className="relative">
                        <div className="w-9 h-9 rounded-lg bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-500 font-bold text-xs uppercase">
                          {customer.name[0]}
                        </div>
                        {customer.segment === 'whale' && (
                          <div className="absolute -top-1 -right-1 w-3 h-3 bg-indigo-500 rounded-full border-2 border-neutral-900 shadow-glow shadow-indigo-500/50" />
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-medium text-neutral-200 group-hover:text-blue-400 transition-colors">{customer.name}</span>
                        {customer.segment && (
                          <span className={`text-[8px] font-black uppercase tracking-tighter mt-0.5 px-1 rounded inline-block w-fit ${SEGMENTS.find(s => s.id === customer.segment)?.color || ''}`}>
                            {customer.segment}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="table-cell cursor-pointer" onClick={() => {
                    setDetailCustomer(customer);
                    setActiveTab('info');
                  }}>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 text-[11px] text-neutral-400">
                        <Mail className="w-3 h-3 text-neutral-600" /> {customer.email || 'NO_VECTOR'}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-neutral-500">
                        <CalendarIcon className="w-3 h-3 text-neutral-600" /> {customer.lastOrderAt ? format(customer.lastOrderAt.toDate(), 'MMM d, yyyy') : 'NO_ORDERS'}
                      </div>
                    </div>
                  </td>
                  <td className="table-cell">
                    <div className="flex flex-col">
                      <span className="text-sm font-mono text-white font-bold tracking-tight">
                        ${customer.totalSpent?.toLocaleString() || '0.00'}
                      </span>
                      <span className="text-[9px] text-neutral-600 font-black uppercase">
                        {customer.totalOrders || 0} Transactions
                      </span>
                    </div>
                  </td>
                  <td className="table-cell text-right">
                    {canEditCustomers && (
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                        <Button variant="ghost" className="w-9 h-9 p-0 rounded-lg" onClick={() => handleEdit(customer)}>
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" className="w-9 h-9 p-0 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-400/5" onClick={() => handleDelete(customer.id)}>
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

        {/* Mobile List View */}
        <div className="sm:hidden divide-y divide-white/[0.05]">
          {filtered.map((customer, i) => (
            <motion.div 
              key={customer.id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="p-4 flex items-center justify-between gap-4 active:bg-white/[0.02]"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-500 font-bold text-xs uppercase shrink-0">
                  {customer.name[0]}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-neutral-200 truncate">{customer.name}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[10px] text-neutral-500 flex items-center gap-1.5 truncate">
                      <Mail className="w-2.5 h-2.5" /> {customer.email || 'No email'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                {canEditCustomers && (
                  <Button variant="ghost" className="w-8 h-8 p-0 rounded-lg" onClick={() => handleEdit(customer)}>
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="py-24 text-center">
            <div className="flex flex-col items-center gap-6 text-neutral-600 max-w-xs mx-auto">
              <div className="w-20 h-20 rounded-3xl border border-dashed border-white/10 flex items-center justify-center bg-white/[0.01]">
                <Users className="w-10 h-10 opacity-20" />
              </div>
              <div className="space-y-2">
                <p className="text-lg font-bold text-neutral-200">The Vault is Silent.</p>
                <p className="text-xs leading-relaxed">System logs indicate zero entities in this node. Register your first customer to establish communication links.</p>
              </div>
              {canEditCustomers && (
                <Button onClick={handleCreateNew} className="gap-2 px-8 h-12 shadow-xl shadow-blue-600/20">
                  <Plus className="w-4 h-4" /> Add your first customer
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
              className="bg-neutral-900 w-full max-w-lg rounded-3xl border border-white/10 shadow-2xl overflow-hidden shadow-black"
            >
              <div className="p-8 border-b border-white/[0.05] flex justify-between items-center bg-white/[0.02]">
                <h2 className="font-display text-xl font-bold text-white uppercase tracking-tight">
                  {selectedCustomer ? 'Identity Modification' : 'Node Initialization'}
                </h2>
                <button onClick={handleCloseModal} className="p-2 text-neutral-500 hover:text-white transition-colors rounded-full hover:bg-white/5">
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                <div>
                  <Label>Legal Identity Name</Label>
                  <Input 
                    required 
                    value={form.name} 
                    onChange={e => setForm({...form, name: e.target.value})} 
                    placeholder="e.g. Sterling Cooper"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <Label>Communication Channel</Label>
                    <Input 
                      type="email" 
                      value={form.email} 
                      onChange={e => setForm({...form, email: e.target.value})}
                      placeholder="identity@node.com"
                    />
                  </div>
                  <div>
                    <Label>Mobile Link</Label>
                    <Input 
                      value={form.phone} 
                      onChange={e => setForm({...form, phone: e.target.value})}
                      placeholder="+1 (555) OS-NODE"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-6">
                  <Button type="button" variant="secondary" onClick={handleCloseModal} className="px-6">Abort</Button>
                  <Button type="submit" disabled={loading} className="px-8">
                    {loading ? 'Processing...' : selectedCustomer ? 'Update Identity' : 'Initialize Node'}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {detailCustomer && (
          <div className="fixed inset-0 z-[110] flex justify-end bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="bg-neutral-900 w-full max-w-2xl h-full border-l border-white/5 shadow-2xl flex flex-col"
            >
              <div className="p-8 border-b border-white/[0.05] bg-white/[0.01] flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-500 font-bold text-xl uppercase">
                    {detailCustomer.name[0]}
                  </div>
                  <div>
                    <h2 className="font-display text-2xl font-bold text-white tracking-tight">{detailCustomer.name}</h2>
                    <p className="text-neutral-500 text-xs font-mono uppercase tracking-widest">{detailCustomer.id}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setDetailCustomer(null)}
                  className="p-3 text-neutral-500 hover:text-white transition-colors rounded-full hover:bg-white/5"
                >
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>

              <div className="flex border-b border-white/[0.05] bg-black/20">
                {[
                  { id: 'info', label: 'Identity', icon: Users },
                  { id: 'reminders', label: 'Follow-ups', icon: Bell },
                  { id: 'messages', label: 'Messaging', icon: MessageSquare },
                  { id: 'history', label: 'History', icon: History }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex-1 flex items-center justify-center gap-2 py-4 text-[11px] font-black uppercase tracking-widest transition-all ${
                      activeTab === tab.id 
                        ? 'text-blue-500 border-b-2 border-blue-500 bg-blue-500/5' 
                        : 'text-neutral-500 hover:text-neutral-300'
                    }`}
                  >
                    <tab.icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                {activeTab === 'info' && (
                  <div className="space-y-8">
                    <div className="grid grid-cols-2 gap-8">
                      <div className="space-y-2">
                        <p className="text-[10px] font-black text-neutral-600 uppercase tracking-widest">Email Vector</p>
                        <p className="text-sm text-neutral-200 font-medium truncate">{detailCustomer.email || 'NODATA'}</p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-[10px] font-black text-neutral-600 uppercase tracking-widest">Mobile Link</p>
                        <p className="text-sm text-neutral-200 font-medium">{detailCustomer.phone || 'NODATA'}</p>
                      </div>
                    </div>
                    
                    <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05] space-y-6">
                      <h4 className="text-[11px] font-black text-white uppercase tracking-widest">Growth Metrics</h4>
                      <div className="grid grid-cols-3 gap-6">
                        <div>
                          <p className="text-[10px] text-neutral-500 mb-1 font-mono">SEGMENT</p>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-tighter ${
                            SEGMENTS.find(s => s.id === detailCustomer.segment)?.color || 'bg-neutral-500/10 text-neutral-400 border-white/5'
                          }`}>
                            {detailCustomer.segment || 'Unknown'}
                          </span>
                        </div>
                        <div>
                          <p className="text-[10px] text-neutral-500 mb-1 font-mono">LIFETIME_VAL</p>
                          <p className="text-sm font-bold text-white shadow-glow shadow-blue-500/20">
                            ${detailCustomer.totalSpent?.toLocaleString() || '0.00'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-neutral-500 mb-1 font-mono">CYCLES</p>
                          <p className="text-sm font-bold text-neutral-400">
                             {detailCustomer.totalOrders || 0}
                          </p>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-white/[0.03]">
                        <p className="text-[10px] font-black text-neutral-600 uppercase tracking-widest mb-2">Last Transmission Detected</p>
                        <p className="text-xs text-neutral-400">
                          {detailCustomer.lastOrderAt ? format(detailCustomer.lastOrderAt.toDate(), 'MMMM d, yyyy HH:mm') : 'No recorded transactions in current node cluster.'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'reminders' && (
                  <div className="space-y-8">
                    <div className="bg-black/40 rounded-2xl p-6 border border-white/[0.05]">
                      <h3 className="text-[11px] font-black text-white uppercase tracking-widest mb-4">New Follow-up</h3>
                      <form onSubmit={handleAddReminder} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Vector Type</Label>
                            <select 
                              className="w-full h-11 px-4 rounded-xl bg-neutral-800 border border-white/10 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                              value={reminderForm.type}
                              onChange={e => setReminderForm({...reminderForm, type: e.target.value as any})}
                            >
                              <option value="follow_up">Regular Follow-up</option>
                              <option value="payment">Payment Reminder</option>
                              <option value="order">Order Protocol</option>
                              <option value="reactivation">Reactivation</option>
                            </select>
                          </div>
                          <div className="space-y-2">
                            <Label>Execution Date</Label>
                            <Input 
                              type="date"
                              value={reminderForm.dueDate}
                              onChange={e => setReminderForm({...reminderForm, dueDate: e.target.value})}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Internal Notes</Label>
                          <Input 
                            placeholder="Add specific instructions for follow-up..."
                            value={reminderForm.notes}
                            onChange={e => setReminderForm({...reminderForm, notes: e.target.value})}
                          />
                        </div>
                        <Button type="submit" className="w-full gap-2">
                          <Bell className="w-4 h-4" /> Initialize Follow-up
                        </Button>
                      </form>
                    </div>

                    <div className="space-y-4">
                      <p className="text-[10px] font-black text-neutral-600 uppercase tracking-widest px-2">Active Protocols</p>
                      {reminders.filter(r => r.status === 'pending').length === 0 && (
                        <div className="p-8 text-center bg-white/[0.01] rounded-2xl border border-dashed border-white/5">
                           <CheckCircle2 className="w-6 h-6 mx-auto text-emerald-500/20 mb-3" />
                           <p className="text-[11px] text-neutral-600 italic">No pending follow-ups required.</p>
                        </div>
                      )}
                      {reminders.filter(r => r.status === 'pending').map(r => (
                        <div key={r.id} className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-between group">
                          <div className="flex items-center gap-4">
                            <button 
                              onClick={() => toggleReminderStatus(r)}
                              className="w-5 h-5 rounded-md border border-neutral-700 flex items-center justify-center hover:border-blue-500 transition-colors"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 opacity-0 group-hover:opacity-20" />
                            </button>
                            <div>
                               <p className="text-[11px] text-white font-bold uppercase tracking-tight">{r.type.replace('_', ' ')}</p>
                               <p className="text-[10px] text-neutral-500 mt-0.5">{r.notes || 'No specific notes'}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-mono text-blue-400">{r.dueDate}</p>
                            <p className="text-[8px] font-black text-neutral-600 uppercase mt-0.5">DUE_NODE</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === 'messages' && (
                  <div className="space-y-8">
                    <div className="bg-black/40 rounded-2xl p-6 border border-white/[0.05]">
                      <h3 className="text-[11px] font-black text-white uppercase tracking-widest mb-4">Transmission Draft</h3>
                      <div className="flex gap-2 p-1 bg-neutral-800 rounded-xl mb-4 border border-white/5">
                        {MESSAGE_TEMPLATES.map(t => (
                          <button
                            key={t.id}
                            onClick={() => setMessageForm({...messageForm, content: t.content.replace('{name}', detailCustomer.name)})}
                            className="flex-1 py-2 text-[9px] font-black uppercase text-neutral-500 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                      <div className="space-y-4">
                        <div className="space-y-2">
                           <Label>Channel</Label>
                           <div className="flex gap-3">
                              {['email', 'whatsapp', 'sms'].map(chan => (
                                <button
                                  key={chan}
                                  onClick={() => setMessageForm({...messageForm, channel: chan as any})}
                                  className={`flex-1 py-3 rounded-xl border transition-all flex items-center justify-center gap-2 text-[10px] uppercase font-bold tracking-widest ${
                                    messageForm.channel === chan 
                                      ? 'bg-blue-500/10 border-blue-500/40 text-blue-400' 
                                      : 'bg-neutral-800 border-white/10 text-neutral-500 hover:border-white/20'
                                  }`}
                                >
                                  {chan === 'email' && <Mail className="w-3 h-3" />}
                                  {chan === 'whatsapp' && <MessageSquare className="w-3 h-3" />}
                                  {chan === 'sms' && <Phone className="w-3 h-3" />}
                                  {chan}
                                </button>
                              ))}
                           </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Message Content</Label>
                          <textarea 
                            className="w-full h-32 p-4 rounded-xl bg-neutral-800 border border-white/10 text-[13px] text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none font-medium leading-relaxed"
                            placeholder="Synthesize transmission payload..."
                            value={messageForm.content}
                            onChange={e => setMessageForm({...messageForm, content: e.target.value})}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <Button 
                            variant="secondary" 
                            className="h-12"
                            onClick={() => handleCreateMessage('draft')}
                          >
                            Save Draft
                          </Button>
                          <Button 
                            className="h-12 gap-2 shadow-lg shadow-blue-600/10"
                            onClick={() => handleCreateMessage('ready')}
                          >
                            <Send className="w-3.5 h-3.5" /> Initialize Sending
                          </Button>
                        </div>
                        <p className="text-[9px] text-neutral-600 italic text-center">Note: Direct delivery requires external node integration. "Initialize Sending" will queue for manual verification.</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                       <p className="text-[10px] font-black text-neutral-600 uppercase tracking-widest px-2">Recent Transmissions</p>
                       {messages.slice(0, 5).map(m => (
                         <div key={m.id} className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.05] space-y-3">
                            <div className="flex items-center justify-between">
                               <div className="flex items-center gap-2">
                                  {m.channel === 'email' && <Mail className="w-3 h-3 text-blue-400" />}
                                  {m.channel === 'whatsapp' && <MessageSquare className="w-3 h-3 text-emerald-400" />}
                                  {m.channel === 'sms' && <Phone className="w-3 h-3 text-orange-400" />}
                                  <span className="text-[10px] font-black uppercase text-neutral-400">{m.channel}</span>
                               </div>
                               <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border ${
                                 m.status === 'sent' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                 m.status === 'ready' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                 'bg-neutral-800 text-neutral-500 border-white/5'
                               }`}>
                                 {m.status}
                               </span>
                            </div>
                            <p className="text-[11px] text-neutral-300 leading-relaxed font-medium line-clamp-2">"{m.content}"</p>
                            <div className="flex items-center justify-between pt-2">
                               <p className="text-[9px] text-neutral-600 font-mono">ID: {m.id.slice(0, 8)}</p>
                               <p className="text-[9px] text-neutral-500">{m.createdAt?.toDate ? format(m.createdAt.toDate(), 'MMM d, HH:mm') : 'Syncing...'}</p>
                            </div>
                         </div>
                       ))}
                       {messages.length === 0 && (
                         <div className="py-12 text-center text-neutral-700">
                           <MessageSquare className="w-8 h-8 mx-auto opacity-10 mb-4" />
                           <p className="text-[11px] italic uppercase tracking-widest">No communication logs recorded.</p>
                         </div>
                       )}
                    </div>
                  </div>
                )}

                {activeTab === 'history' && (
                  <div className="space-y-6">
                    <div className="relative pl-6 space-y-8 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-px before:bg-white/[0.05]">
                       {[...reminders, ...messages]
                        .sort((a, b) => {
                          const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
                          const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
                          return dateB - dateA;
                        })
                        .map((item, idx) => {
                          const isReminder = 'dueDate' in item;
                          return (
                            <div key={idx} className="relative">
                               <div className="absolute -left-[27px] top-1 w-2 h-2 rounded-full bg-neutral-800 border border-white/20" />
                               <div className="space-y-1">
                                  <div className="flex items-center justify-between">
                                     <p className="text-[10px] font-black uppercase text-white/40 tracking-widest">
                                       {isReminder ? <Bell className="inline w-2.5 h-2.5 mr-1" /> : <MessageSquare className="inline w-2.5 h-2.5 mr-1" />}
                                       {isReminder ? 'Reminder Set' : 'Message Drafted'}
                                     </p>
                                     <span className="text-[9px] font-mono text-neutral-600">
                                       {item.createdAt?.toDate ? format(item.createdAt.toDate(), 'HH:mm:ss') : '...'}
                                     </span>
                                  </div>
                                  <p className="text-sm text-neutral-300 font-medium">
                                    {isReminder ? (item as Reminder).notes : (item as CustomerMessage).content}
                                  </p>
                                  <p className="text-[10px] text-neutral-500">
                                    {item.createdAt?.toDate ? format(item.createdAt.toDate(), 'MMMM d, yyyy') : 'Loading identity link...'}
                                  </p>
                               </div>
                            </div>
                          );
                        })
                       }
                       {(reminders.length === 0 && messages.length === 0) && (
                         <div className="py-20 text-center">
                            <History className="w-8 h-8 mx-auto text-neutral-800 mb-4" />
                            <p className="text-[11px] text-neutral-600 font-medium uppercase tracking-widest">History is blank.</p>
                         </div>
                       )}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-8 border-t border-white/[0.05] bg-black/40 flex gap-4">
                 <Button variant="secondary" className="flex-1" onClick={() => setDetailCustomer(null)}>Close Profile</Button>
                 <Button className="flex-1 gap-2" onClick={() => {
                  handleEdit(detailCustomer);
                  setDetailCustomer(null);
                 }}>
                  <Edit2 className="w-4 h-4" /> Edit Identity
                 </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
