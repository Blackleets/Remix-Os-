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
  Contact, 
  Download, 
  Inbox, 
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
import { useLocale } from '../hooks/useLocale';
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
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { UpgradeModal } from '../components/UpgradeModal';
import { PLANS, isLimitReached, getCompanyUsage } from '../lib/plans';
import { exportToCSV } from '../lib/exportUtils';
import { format } from 'date-fns';
import { ImageUpload } from '../components/ImageUpload';

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
  imageURL?: string;
}

const SEGMENTS_LOCALIZED = (t: any) => [
  { id: 'all', label: t('customers.segments.all'), color: 'bg-neutral-500/10 text-neutral-400' },
  { id: 'whale', label: t('customers.segments.whale'), color: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' },
  { id: 'vip', label: t('customers.segments.vip'), color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  { id: 'active', label: t('customers.segments.active'), color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  { id: 'at_risk', label: t('customers.segments.at_risk'), color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  { id: 'new', label: t('customers.segments.new'), color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
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

const MESSAGE_TEMPLATES_LOCALIZED = (t: any) => [
  { id: 'follow_up', label: t('customers.details.messages.templates.follow_up'), content: 'Hi {name}, checking in to see if you have any questions about our recent offerings.' },
  { id: 'payment', label: t('customers.details.messages.templates.payment'), content: 'Dear {name}, this is a friendly reminder that invoice payment is now due. Thank you!' },
  { id: 'order_ready', label: t('customers.details.messages.templates.order_ready'), content: 'Good news {name}! Your recent order is processed and ready for collection.' },
  { id: 'thank_you', label: t('customers.details.messages.templates.thank_you'), content: 'Thank you for your continued business, {name}! We truly appreciate your support.' },
];

export function Customers() {
  const { company, role } = useAuth();
  const { t, formatCurrency, formatDate } = useLocale();
  const SEGMENTS = SEGMENTS_LOCALIZED(t);
  const MESSAGE_TEMPLATES = MESSAGE_TEMPLATES_LOCALIZED(t);
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
      // Persist dueDate as a Firestore Timestamp so range queries
      // ("due before now", orderBy('dueDate')) behave correctly across timezones.
      const due = reminderForm.dueDate ? new Date(reminderForm.dueDate) : new Date();
      await addDoc(collection(db, 'reminders'), {
        type: reminderForm.type,
        notes: reminderForm.notes,
        dueDate: Timestamp.fromDate(due),
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

  const [form, setForm] = useState({ name: '', email: '', phone: '', imageURL: '' });

  const handleCreateNew = async () => {
    if (!company) return;
    const planId = company.subscription?.planId || 'starter';
    const plan = PLANS[planId];
    try {
      const usage = await getCompanyUsage(company.id);
      if (isLimitReached(usage.customers, plan.limits.customers)) {
        setIsUpgradeModalOpen(true);
        return;
      }
    } catch (e) {
      console.warn('Plan usage check failed, falling back to local count', e);
      if (isLimitReached(customers.length, plan.limits.customers)) {
        setIsUpgradeModalOpen(true);
        return;
      }
    }
    setSelectedCustomer(null);
    setForm({ name: '', email: '', phone: '', imageURL: '' });
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
      const batch = writeBatch(db);
      const activityRef = doc(collection(db, 'activities'));

      if (selectedCustomer) {
        const customerRef = doc(db, 'customers', selectedCustomer.id);
        batch.update(customerRef, {
          ...form,
          updatedAt: serverTimestamp(),
        });
        batch.set(activityRef, {
          type: 'customer_update',
          title: 'Customer Updated',
          subtitle: `${form.name} profile was modified`,
          companyId: company.id,
          createdAt: serverTimestamp(),
        });
      } else {
        const customerRef = doc(collection(db, 'customers'));
        batch.set(customerRef, {
          ...form,
          companyId: company.id,
          createdAt: serverTimestamp(),
        });
        batch.set(activityRef, {
          type: 'customer_create',
          title: 'New Customer',
          subtitle: `${form.name} joined the platform`,
          companyId: company.id,
          createdAt: serverTimestamp(),
        });
      }

      await batch.commit();
      setIsModalOpen(false);
      setSelectedCustomer(null);
      setForm({ name: '', email: '', phone: '', imageURL: '' });
      fetchCustomers();
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'Failed to save customer.');
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
      imageURL: customer.imageURL || '',
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedCustomer(null);
    setForm({ name: '', email: '', phone: '', imageURL: '' });
  };

  const handleDelete = async (id: string) => {
    if (!company) return;
    if (!confirm(t('customers.delete_confirm'))) return;
    try {
      // Block delete if the customer is referenced by any order so order
      // history doesn't dangle to a missing customer doc.
      const ordersSnap = await getDocs(query(
        collection(db, 'orders'),
        where('companyId', '==', company.id),
        where('customerId', '==', id),
        limit(1)
      ));
      if (!ordersSnap.empty) {
        alert('This customer has orders and cannot be deleted.');
        return;
      }
      await deleteDoc(doc(db, 'customers', id));
      fetchCustomers();
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'Failed to delete customer.');
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
          <h1 className="font-display text-4xl font-bold tracking-tight mb-2 text-white">{t('customers.title')}</h1>
          <p className="text-neutral-500 text-sm">{t('customers.subtitle')}</p>
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
            <Download className="w-4 h-4" /> {t('common.export')}
          </Button>
          {canEditCustomers && (
            <Button onClick={handleCreateNew} className="gap-2 px-6">
              <Plus className="w-4 h-4" /> {t('customers.add')}
            </Button>
          )}
        </div>
      </div>

      <UpgradeModal 
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        title={t('billing.upgrade_required')}
        message={t('customers.upgrade_message')}
        limitName={t('nav.customers')}
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
              placeholder={t('customers.search_placeholder')} 
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
                <th className="table-header w-1/3">{t('customers.table.identity')}</th>
                <th className="table-header">{t('customers.table.engagement')}</th>
                <th className="table-header">{t('customers.table.ltv')}</th>
                <th className="table-header text-right">{t('customers.table.actions')}</th>
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
                          <div className="w-9 h-9 rounded-lg bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-500 font-bold text-xs uppercase overflow-hidden">
                            {customer.imageURL ? (
                              <img src={customer.imageURL} alt={customer.name} className="w-full h-full object-cover" />
                            ) : (
                              customer.name ? customer.name[0] : '?'
                            )}
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
                        <Mail className="w-3 h-3 text-neutral-600" /> {customer.email || t('customers.table.no_vector')}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-neutral-500">
                        <CalendarIcon className="w-3 h-3 text-neutral-600" /> {customer.lastOrderAt ? formatDate(customer.lastOrderAt.toDate()) : t('customers.table.no_orders')}
                      </div>
                    </div>
                  </td>
                  <td className="table-cell">
                    <div className="flex flex-col">
                      <span className="text-sm font-mono text-white font-bold tracking-tight">
                        {formatCurrency(customer.totalSpent || 0)}
                      </span>
                      <span className="text-[9px] text-neutral-600 font-black uppercase">
                        {customer.totalOrders || 0} {t('customers.table.transactions')}
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
                <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-500 font-bold text-xs uppercase shrink-0 overflow-hidden">
                  {customer.imageURL ? (
                    <img src={customer.imageURL} alt={customer.name} className="w-full h-full object-cover" />
                  ) : (
                    customer.name ? customer.name[0] : '?'
                  )}
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
                <Contact className="w-10 h-10 opacity-20" />
              </div>
              <div className="space-y-2">
                <p className="text-lg font-bold text-neutral-200">{t('customers.empty.title')}</p>
                <p className="text-xs leading-relaxed">{t('customers.empty.subtitle')}</p>
              </div>
              {canEditCustomers && (
                <Button onClick={handleCreateNew} className="gap-2 px-8 h-12 shadow-xl shadow-blue-600/20">
                  <Plus className="w-4 h-4" /> {t('customers.add')}
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
                  {selectedCustomer ? t('customers.modal.modification') : t('customers.modal.initialization')}
                </h2>
                <button onClick={handleCloseModal} className="p-2 text-neutral-500 hover:text-white transition-colors rounded-full hover:bg-white/5">
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                <div className="flex gap-6 items-start">
                    <div className="w-24 shrink-0">
                        <ImageUpload 
                            value={form.imageURL}
                            onChange={url => setForm({ ...form, imageURL: url })}
                            path={`companies/${company?.id}/customers`}
                            label={t('customers.modal.avatar')}
                        />
                    </div>
                    <div className="flex-1 space-y-4">
                        <div>
                            <Label>{t('customers.name')}</Label>
                            <Input 
                                required 
                                value={form.name} 
                                onChange={e => setForm({...form, name: e.target.value})} 
                                placeholder={t('customers.modal.name_placeholder')}
                            />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <Label>{t('customers.email')}</Label>
                                <Input 
                                type="email" 
                                value={form.email} 
                                onChange={e => setForm({...form, email: e.target.value})}
                                placeholder={t('customers.modal.email_placeholder')}
                                />
                            </div>
                            <div>
                                <Label>{t('customers.phone')}</Label>
                                <Input 
                                value={form.phone} 
                                onChange={e => setForm({...form, phone: e.target.value})}
                                placeholder={t('customers.modal.phone_placeholder')}
                                />
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex justify-end gap-3 pt-6 border-t border-white/5">
                  <Button type="button" variant="secondary" onClick={handleCloseModal} className="px-6">{t('common.abort')}</Button>
                  <Button type="submit" disabled={loading} className="px-8">
                    {loading ? t('common.processing') : selectedCustomer ? t('common.update') : t('customers.add')}
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
                  <div className="w-14 h-14 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-500 font-bold text-xl uppercase overflow-hidden">
                    {detailCustomer.imageURL ? (
                      <img src={detailCustomer.imageURL} alt={detailCustomer.name} className="w-full h-full object-cover" />
                    ) : (
                      detailCustomer.name ? detailCustomer.name[0] : '?'
                    )}
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
                  { id: 'info', label: t('customers.details.tabs.info'), icon: Contact },
                  { id: 'reminders', label: t('customers.details.tabs.reminders'), icon: Inbox },
                  { id: 'messages', label: t('customers.details.tabs.messages'), icon: MessageSquare },
                  { id: 'history', label: t('customers.details.tabs.history'), icon: History }
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
                        <p className="text-[10px] font-black text-neutral-600 uppercase tracking-widest">{t('customers.email')}</p>
                        <p className="text-sm text-neutral-200 font-medium truncate">{detailCustomer.email || 'NODATA'}</p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-[10px] font-black text-neutral-600 uppercase tracking-widest">{t('customers.phone')}</p>
                        <p className="text-sm text-neutral-200 font-medium">{detailCustomer.phone || 'NODATA'}</p>
                      </div>
                    </div>
                    
                    <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05] space-y-6">
                      <h4 className="text-[11px] font-black text-white uppercase tracking-widest">{t('customers.details.metrics.title')}</h4>
                      <div className="grid grid-cols-3 gap-6">
                        <div>
                          <p className="text-[10px] text-neutral-500 mb-1 font-mono">{t('customers.details.metrics.segment')}</p>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-tighter ${
                            SEGMENTS.find(s => s.id === detailCustomer.segment)?.color || 'bg-neutral-500/10 text-neutral-400 border-white/5'
                          }`}>
                            {detailCustomer.segment || t('customers.details.metrics.unknown')}
                          </span>
                        </div>
                        <div>
                          <p className="text-[10px] text-neutral-500 mb-1 font-mono">{t('customers.details.metrics.ltv')}</p>
                          <p className="text-sm font-bold text-white shadow-glow shadow-blue-500/20">
                            {formatCurrency(detailCustomer.totalSpent || 0)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-neutral-500 mb-1 font-mono">{t('customers.details.metrics.cycles')}</p>
                          <p className="text-sm font-bold text-neutral-400">
                             {detailCustomer.totalOrders || 0}
                          </p>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-white/[0.03]">
                        <p className="text-[10px] font-black text-neutral-600 uppercase tracking-widest mb-2">{t('customers.details.metrics.last_transmission')}</p>
                        <p className="text-xs text-neutral-400">
                          {detailCustomer.lastOrderAt ? formatDate(detailCustomer.lastOrderAt.toDate()) : t('customers.details.metrics.no_transactions')}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'reminders' && (
                  <div className="space-y-8">
                    <div className="bg-black/40 rounded-2xl p-6 border border-white/[0.05]">
                      <h3 className="text-[11px] font-black text-white uppercase tracking-widest mb-4">{t('customers.details.reminders.new_title')}</h3>
                      <form onSubmit={handleAddReminder} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>{t('customers.details.reminders.vector_type')}</Label>
                            <select 
                              className="w-full h-11 px-4 rounded-xl bg-neutral-800 border border-white/10 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                              value={reminderForm.type}
                              onChange={e => setReminderForm({...reminderForm, type: e.target.value as any})}
                            >
                              <option value="follow_up">{t('customers.details.reminders.types.follow_up')}</option>
                              <option value="payment">{t('customers.details.reminders.types.payment')}</option>
                              <option value="order">{t('customers.details.reminders.types.order')}</option>
                              <option value="reactivation">{t('customers.details.reminders.types.reactivation')}</option>
                            </select>
                          </div>
                          <div className="space-y-2">
                            <Label>{t('customers.details.reminders.execution_date')}</Label>
                            <Input 
                              type="date"
                              value={reminderForm.dueDate}
                              onChange={e => setReminderForm({...reminderForm, dueDate: e.target.value})}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>{t('customers.details.reminders.notes')}</Label>
                          <Input 
                            placeholder={t('customers.details.reminders.notes_placeholder')}
                            value={reminderForm.notes}
                            onChange={e => setReminderForm({...reminderForm, notes: e.target.value})}
                          />
                        </div>
                        <Button type="submit" className="w-full gap-2">
                          <Inbox className="w-4 h-4" /> {t('customers.details.reminders.btn_initialize')}
                        </Button>
                      </form>
                    </div>

                    <div className="space-y-4">
                      <p className="text-[10px] font-black text-neutral-600 uppercase tracking-widest px-2">{t('customers.details.reminders.active_protocols')}</p>
                      {reminders.filter(r => r.status === 'pending').length === 0 && (
                        <div className="p-8 text-center bg-white/[0.01] rounded-2xl border border-dashed border-white/5">
                           <CheckCircle2 className="w-6 h-6 mx-auto text-emerald-500/20 mb-3" />
                           <p className="text-[11px] text-neutral-600 italic">{t('customers.details.reminders.no_pending')}</p>
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
                               <p className="text-[11px] text-white font-bold uppercase tracking-tight">{t(`customers.details.reminders.types.${r.type}`)}</p>
                               <p className="text-[10px] text-neutral-500 mt-0.5">{r.notes || t('customers.details.reminders.no_notes')}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-mono text-blue-400">{r.dueDate?.toDate ? format(r.dueDate.toDate(), 'yyyy-MM-dd') : r.dueDate}</p>
                            <p className="text-[8px] font-black text-neutral-600 uppercase mt-0.5">{t('customers.details.reminders.due_node')}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === 'messages' && (
                  <div className="space-y-8">
                    <div className="bg-black/40 rounded-2xl p-6 border border-white/[0.05]">
                      <h3 className="text-[11px] font-black text-white uppercase tracking-widest mb-4">{t('customers.details.messages.draft_title')}</h3>
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
                           <Label>{t('customers.details.messages.channel')}</Label>
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
                          <Label>{t('customers.details.messages.content')}</Label>
                          <textarea 
                            className="w-full h-32 p-4 rounded-xl bg-neutral-800 border border-white/10 text-[13px] text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none font-medium leading-relaxed"
                            placeholder={t('customers.details.messages.placeholder')}
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
                            {t('customers.details.messages.btn_save')}
                          </Button>
                          <Button 
                            className="h-12 gap-2 shadow-lg shadow-blue-600/10"
                            onClick={() => handleCreateMessage('ready')}
                          >
                            <Send className="w-3.5 h-3.5" /> {t('customers.details.messages.btn_send')}
                          </Button>
                        </div>
                        <p className="text-[9px] text-neutral-600 italic text-center">{t('customers.details.messages.note')}</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                       <p className="text-[10px] font-black text-neutral-600 uppercase tracking-widest px-2">{t('customers.details.messages.history')}</p>
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
                                 {t(`customers.details.messages.${m.status}`)}
                               </span>
                            </div>
                            <p className="text-[11px] text-neutral-300 leading-relaxed font-medium line-clamp-2">"{m.content}"</p>
                            <div className="flex items-center justify-between pt-2">
                               <p className="text-[9px] text-neutral-600 font-mono">ID: {m.id.slice(0, 8)}</p>
                               <p className="text-[9px] text-neutral-500">{m.createdAt?.toDate ? formatDate(m.createdAt.toDate()) : 'Syncing...'}</p>
                            </div>
                         </div>
                       ))}
                       {messages.length === 0 && (
                         <div className="py-12 text-center text-neutral-700">
                           <MessageSquare className="w-8 h-8 mx-auto opacity-10 mb-4" />
                           <p className="text-[11px] italic uppercase tracking-widest">{t('customers.details.messages.no_history')}</p>
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
                                       {isReminder ? <Inbox className="inline w-2.5 h-2.5 mr-1" /> : <MessageSquare className="inline w-2.5 h-2.5 mr-1" />}
                                       {isReminder ? t('customers.details.reminders.new_title') : t('customers.details.messages.draft_title')}
                                     </p>
                                     <span className="text-[9px] font-mono text-neutral-600">
                                       {item.createdAt?.toDate ? formatDate(item.createdAt.toDate()) : '...'}
                                     </span>
                                  </div>
                                  <p className="text-sm text-neutral-300 font-medium">
                                    {isReminder ? (item as Reminder).notes : (item as CustomerMessage).content}
                                  </p>
                                  <p className="text-[10px] text-neutral-500">
                                    {item.createdAt?.toDate ? formatDate(item.createdAt.toDate()) : 'Loading identity link...'}
                                  </p>
                               </div>
                            </div>
                          );
                        })
                       }
                       {(reminders.length === 0 && messages.length === 0) && (
                         <div className="py-20 text-center">
                            <History className="w-8 h-8 mx-auto text-neutral-800 mb-4" />
                            <p className="text-[11px] text-neutral-600 font-medium uppercase tracking-widest">{t('customers.details.tabs.history')} is blank.</p>
                         </div>
                       )}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-8 border-t border-white/[0.05] bg-black/40 flex gap-4">
                 <Button variant="secondary" className="flex-1" onClick={() => setDetailCustomer(null)}>{t('common.abort')}</Button>
                 <Button className="flex-1 gap-2" onClick={() => {
                  handleEdit(detailCustomer);
                  setDetailCustomer(null);
                 }}>
                  <Edit2 className="w-4 h-4" /> {t('common.update')}
                 </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
