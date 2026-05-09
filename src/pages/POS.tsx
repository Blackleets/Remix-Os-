import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertCircle,
  BadgeDollarSign,
  CreditCard,
  Minus,
  Package,
  Plus,
  Printer,
  Search,
  ShoppingCart,
  ShieldAlert,
  Store,
  UserRound,
  Wallet,
} from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Card, Button, Input, Label, cn } from '../components/Common';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { useLocale } from '../hooks/useLocale';
import { db } from '../lib/firebase';
import { createSaleTransaction } from '../services/sales';
import { exportPOSReceiptToPDF } from '../lib/exportUtils';

interface Product {
  id: string;
  name: string;
  price: number;
  stockLevel: number;
  sku?: string;
  category?: string;
  status: 'active' | 'draft' | 'archived';
}

interface Customer {
  id: string;
  name: string;
}

interface CartItem {
  productId: string;
  name: string;
  sku?: string;
  price: number;
  quantity: number;
  stockLevel: number;
}

interface POSReceipt {
  orderId: string;
  createdAt: Date;
  customerName: string;
  paymentMethod: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  items: CartItem[];
}

const PAYMENT_METHODS = ['Cash', 'Card', 'Transfer', 'Stripe', 'Crypto'] as const;
const COMING_SOON = ['Stripe Terminal', 'Square POS', 'Shopify POS', 'SumUp'];

export function POS() {
  const { company } = useAuth();
  const { t, formatCurrency } = useLocale();
  const { canUsePOS } = usePermissions();
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<(typeof PAYMENT_METHODS)[number]>('Cash');
  const [discountInput, setDiscountInput] = useState('0');
  const [taxInput, setTaxInput] = useState('0');
  const [saleError, setSaleError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [latestReceipt, setLatestReceipt] = useState<POSReceipt | null>(null);

  useEffect(() => {
    if (!company) return;

    const productsQuery = query(collection(db, 'products'), where('companyId', '==', company.id));
    const customersQuery = query(collection(db, 'customers'), where('companyId', '==', company.id));

    const unsubscribeProducts = onSnapshot(productsQuery, (snapshot) => {
      const nextProducts = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(nextProducts);
    });

    const unsubscribeCustomers = onSnapshot(customersQuery, (snapshot) => {
      const nextCustomers = snapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name || 'Unknown',
      }));
      setCustomers(nextCustomers);
    });

    return () => {
      unsubscribeProducts();
      unsubscribeCustomers();
    };
  }, [company]);

  const activeProducts = useMemo(
    () => products.filter((product) => product.status === 'active'),
    [products]
  );

  const filteredProducts = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return activeProducts;
    return activeProducts.filter((product) =>
      product.name.toLowerCase().includes(normalized) ||
      product.sku?.toLowerCase().includes(normalized)
    );
  }, [activeProducts, search]);

  const customerName = useMemo(() => {
    if (!customerId) return t('orders.guest') || 'Guest';
    return customers.find((customer) => customer.id === customerId)?.name || t('orders.guest') || 'Guest';
  }, [customerId, customers, t]);

  const discount = Math.max(0, parseFloat(discountInput) || 0);
  const tax = Math.max(0, parseFloat(taxInput) || 0);
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const total = Math.max(0, subtotal - discount + tax);

  const getAvailableStock = (productId: string) =>
    products.find((product) => product.id === productId)?.stockLevel ?? 0;

  const addToCart = (product: Product) => {
    setSaleError(null);
    setCart((current) => {
      const existingItem = current.find((item) => item.productId === product.id);
      if (!existingItem) {
        return [
          ...current,
          {
            productId: product.id,
            name: product.name,
            sku: product.sku,
            price: product.price || 0,
            quantity: 1,
            stockLevel: product.stockLevel || 0,
          },
        ];
      }

      const nextQuantity = existingItem.quantity + 1;
      if (nextQuantity > getAvailableStock(product.id)) {
        setSaleError(`Insufficient stock for ${product.name}.`);
        return current;
      }

      return current.map((item) =>
        item.productId === product.id ? { ...item, quantity: nextQuantity, stockLevel: getAvailableStock(product.id) } : item
      );
    });
  };

  const updateQuantity = (productId: string, nextQuantity: number) => {
    setSaleError(null);
    if (nextQuantity < 1) {
      setCart((current) => current.filter((item) => item.productId !== productId));
      return;
    }

    const availableStock = getAvailableStock(productId);
    if (nextQuantity > availableStock) {
      const productName = cart.find((item) => item.productId === productId)?.name || 'item';
      setSaleError(`Insufficient stock for ${productName}.`);
      return;
    }

    setCart((current) =>
      current.map((item) =>
        item.productId === productId ? { ...item, quantity: nextQuantity, stockLevel: availableStock } : item
      )
    );
  };

  const removeItem = (productId: string) => {
    setSaleError(null);
    setCart((current) => current.filter((item) => item.productId !== productId));
  };

  const handleCompleteSale = async () => {
    if (!company || cart.length === 0) return;

    setIsSubmitting(true);
    setSaleError(null);

    try {
      const receiptItems = cart.map((item) => ({ ...item }));
      const result = await createSaleTransaction({
        companyId: company.id,
        customerId: customerId || null,
        customerName,
        paymentMethod,
        items: receiptItems.map((item) => ({
          productId: item.productId,
          productName: item.name,
          quantity: item.quantity,
          price: item.price,
        })),
        subtotal,
        discount,
        tax,
        total,
        channel: 'pos',
        movementReason: 'POS Sale',
        activityTitle: 'POS Sale Completed',
        messages: {
          productNotFound: (name) => `Product ${name} not found.`,
          insufficientStock: (name, count) => `Insufficient stock for ${name}. Available: ${count}`,
        },
      });

      setLatestReceipt({
        orderId: result.orderId,
        createdAt: result.createdAt,
        customerName,
        paymentMethod,
        subtotal,
        discount,
        tax,
        total,
        items: receiptItems,
      });
      setCart([]);
      setCustomerId('');
      setPaymentMethod('Cash');
      setDiscountInput('0');
      setTaxInput('0');
    } catch (error) {
      setSaleError(error instanceof Error ? error.message : 'Failed to complete sale.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!canUsePOS) {
    return (
      <Card className="p-10 text-center bg-neutral-900/40 border-white/5 space-y-6">
        <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-8 h-8 text-red-500" />
        </div>
        <div className="space-y-2">
          <h1 className="text-white font-bold uppercase tracking-widest text-sm">{t('pos.access.title')}</h1>
          <p className="text-neutral-500 text-xs leading-relaxed max-w-md mx-auto">
            {t('pos.access.description')}
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight mb-2 text-white">{t('pos.title')}</h1>
          <p className="text-neutral-500 text-sm">{t('pos.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 rounded-2xl border border-white/10 bg-white/[0.03] text-xs uppercase tracking-[0.25em] text-neutral-400 font-bold">
            {company?.name || 'Remix Node'}
          </div>
          <div className="px-4 py-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-xs uppercase tracking-[0.25em] text-emerald-400 font-bold">
            Live Counter
          </div>
        </div>
      </div>

      {latestReceipt && (
        <Card className="p-6 border-white/5 bg-neutral-900/40">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-black text-neutral-600 uppercase tracking-[0.35em] mb-2">{t('pos.receipt.label')}</p>
                <h2 className="text-white font-bold text-2xl">{t('pos.receipt.title')}</h2>
                <p className="text-neutral-500 text-sm mt-2">
                  {t('pos.receipt.generated_for', {
                    orderId: latestReceipt.orderId.slice(0, 8).toUpperCase(),
                    customerName: latestReceipt.customerName,
                  })}
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.2em] font-black text-neutral-600 mb-2">{t('pos.receipt.date')}</p>
                  <p className="text-sm text-white">{latestReceipt.createdAt.toLocaleString()}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.2em] font-black text-neutral-600 mb-2">{t('pos.receipt.payment')}</p>
                  <p className="text-sm text-white">{latestReceipt.paymentMethod}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.2em] font-black text-neutral-600 mb-2">{t('pos.receipt.items')}</p>
                  <p className="text-sm text-white">{latestReceipt.items.length}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.2em] font-black text-neutral-600 mb-2">{t('pos.receipt.total')}</p>
                  <p className="text-sm text-white font-mono">{formatCurrency(latestReceipt.total)}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                variant="secondary"
                className="gap-2 px-5 h-11"
                onClick={() =>
                  exportPOSReceiptToPDF({
                    companyName: company?.name || 'Remix',
                    orderId: latestReceipt.orderId,
                    createdAt: latestReceipt.createdAt,
                    customerName: latestReceipt.customerName,
                    paymentMethod: latestReceipt.paymentMethod,
                    subtotal: latestReceipt.subtotal,
                    discount: latestReceipt.discount,
                    tax: latestReceipt.tax,
                    total: latestReceipt.total,
                    items: latestReceipt.items.map((item) => ({
                      name: item.name,
                      sku: item.sku,
                      quantity: item.quantity,
                      price: item.price,
                    })),
                  })
                }
              >
                <BadgeDollarSign className="w-4 h-4" />
                {t('pos.receipt.download_pdf')}
              </Button>
              <Button variant="secondary" className="gap-2 px-5 h-11" disabled>
                <Printer className="w-4 h-4" />
                {t('pos.receipt.print_coming_soon')}
              </Button>
            </div>
          </div>

          <div className="mt-6 rounded-3xl border border-white/10 bg-black/30 overflow-hidden">
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-neutral-600">{t('pos.receipt.ledger')}</p>
                <p className="text-sm text-neutral-400 mt-1">{latestReceipt.customerName} · {latestReceipt.paymentMethod}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-600 font-black">{t('pos.receipt.order')}</p>
                <p className="text-sm font-mono text-white">{latestReceipt.orderId}</p>
              </div>
            </div>

            <div className="divide-y divide-white/[0.05]">
              {latestReceipt.items.map((item) => (
                <div key={`${latestReceipt.orderId}-${item.productId}`} className="px-6 py-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-white font-bold truncate">{item.name}</p>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-600 font-black">
                      {item.sku || 'NO_SKU'} · Qty {item.quantity}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-mono text-white">{formatCurrency(item.price * item.quantity)}</p>
                    <p className="text-[10px] text-neutral-600">{formatCurrency(item.price)} each</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="px-6 py-5 border-t border-white/10 bg-white/[0.02] space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-500">{t('pos.summary.subtotal')}</span>
                <span className="text-white font-mono">{formatCurrency(latestReceipt.subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-500">{t('pos.summary.discount')}</span>
                <span className="text-white font-mono">- {formatCurrency(latestReceipt.discount)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-500">{t('pos.summary.tax')}</span>
                <span className="text-white font-mono">+ {formatCurrency(latestReceipt.tax)}</span>
              </div>
              <div className="pt-3 mt-3 border-t border-white/10 flex items-center justify-between">
                <span className="text-xs uppercase tracking-[0.25em] text-neutral-500 font-black">{t('pos.summary.final_total')}</span>
                <span className="text-2xl font-mono text-white">{formatCurrency(latestReceipt.total)}</span>
              </div>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_1fr_380px] gap-6">
        <Card className="p-0 overflow-hidden border-white/5 bg-neutral-900/40">
          <div className="p-6 border-b border-white/[0.05] bg-white/[0.01] space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-black text-neutral-600 uppercase tracking-[0.35em] mb-2">Catalog Feed</p>
                <h2 className="text-white font-bold text-lg">{t('pos.catalog.title')}</h2>
              </div>
              <div className="px-3 py-2 rounded-xl border border-white/10 bg-black/30 text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-bold">
                {activeProducts.length} live
              </div>
            </div>
            <div className="relative">
              <Search className="w-4 h-4 text-neutral-600 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t('pos.catalog.search_placeholder')}
                  className="pl-10 h-11 bg-black/40 border-white/10"
                />
            </div>
          </div>

          <div className="max-h-[720px] overflow-y-auto p-4 space-y-3">
            {filteredProducts.map((product, index) => {
              const isLowStock = product.stockLevel <= 10;
              return (
                <motion.button
                  key={product.id}
                  type="button"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02 }}
                  onClick={() => addToCart(product)}
                  className="w-full text-left p-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-blue-500/20 transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl border border-white/10 bg-black/30 flex items-center justify-center">
                          <Package className="w-4 h-4 text-neutral-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-white truncate">{product.name}</p>
                          <p className="text-[10px] uppercase tracking-[0.25em] text-neutral-600 font-bold truncate">
                            {product.sku || 'NO_SKU'}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 flex items-center gap-3 flex-wrap">
                        <span className="text-sm font-mono text-white">{formatCurrency(product.price || 0)}</span>
                        <span
                          className={cn(
                            'text-[10px] uppercase tracking-[0.2em] font-bold px-2 py-1 rounded-full border',
                            isLowStock
                              ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                              : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                          )}
                        >
                          {t('pos.catalog.stock', { count: product.stockLevel })}
                        </span>
                        {product.category && (
                          <span className="text-[10px] uppercase tracking-[0.2em] font-bold px-2 py-1 rounded-full border border-white/10 text-neutral-500">
                            {product.category}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0">
                        <Button className="gap-2 px-4 h-10">
                          <Plus className="w-4 h-4" />
                          {t('pos.catalog.add')}
                        </Button>
                    </div>
                  </div>
                </motion.button>
              );
            })}

            {filteredProducts.length === 0 && (
              <div className="py-16 text-center border border-dashed border-white/10 rounded-2xl bg-white/[0.01]">
                <Search className="w-8 h-8 mx-auto text-neutral-700 mb-4" />
                <p className="text-sm font-bold text-neutral-300">{t('pos.catalog.empty_title')}</p>
                <p className="text-xs text-neutral-600 mt-2">{t('pos.catalog.empty_subtitle')}</p>
              </div>
            )}
          </div>
        </Card>

        <Card className="p-0 overflow-hidden border-white/5 bg-neutral-900/40">
          <div className="p-6 border-b border-white/[0.05] bg-white/[0.01] flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-neutral-600 uppercase tracking-[0.35em] mb-2">Sale Builder</p>
                <h2 className="text-white font-bold text-lg">{t('pos.cart.title')}</h2>
              </div>
            <div className="w-11 h-11 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-blue-400" />
            </div>
          </div>

          <div className="p-4 space-y-3 max-h-[720px] overflow-y-auto">
            {cart.map((item) => {
              const availableStock = getAvailableStock(item.productId);
              const lineTotal = item.price * item.quantity;
              const stockExceeded = item.quantity > availableStock;

              return (
                <div key={item.productId} className="p-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-bold text-white truncate">{item.name}</p>
                      <p className="text-[10px] uppercase tracking-[0.25em] text-neutral-600 font-bold">
                        {item.sku || 'NO_SKU'}
                      </p>
                    </div>
                    <Button variant="ghost" className="w-10 h-10 p-0" onClick={() => removeItem(item.productId)}>
                      <Minus className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div className="inline-flex items-center rounded-xl border border-white/10 bg-black/30">
                      <button
                        type="button"
                        className="w-10 h-10 flex items-center justify-center text-neutral-400 hover:text-white"
                        onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <div className="w-12 text-center text-sm font-bold text-white">{item.quantity}</div>
                      <button
                        type="button"
                        className="w-10 h-10 flex items-center justify-center text-neutral-400 hover:text-white"
                        onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-mono text-white">{formatCurrency(lineTotal)}</p>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-600 font-bold">
                        {t('pos.cart.available', { count: availableStock })}
                      </p>
                    </div>
                  </div>

                  {stockExceeded && (
                    <div className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-amber-300 text-xs">
                      <AlertCircle className="w-4 h-4" />
                      {t('pos.cart.stock_error')}
                    </div>
                  )}
                </div>
              );
            })}

            {cart.length === 0 && (
              <div className="py-20 text-center border border-dashed border-white/10 rounded-2xl bg-white/[0.01]">
                <ShoppingCart className="w-10 h-10 mx-auto text-neutral-700 mb-4" />
                <p className="text-sm font-bold text-neutral-300">{t('pos.cart.empty_title')}</p>
                <p className="text-xs text-neutral-600 mt-2">{t('pos.cart.empty_subtitle')}</p>
              </div>
            )}
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="p-6 border-white/5 bg-neutral-900/40 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-neutral-600 uppercase tracking-[0.35em] mb-2">Checkout Core</p>
                <h2 className="text-white font-bold text-lg">{t('pos.checkout.title')}</h2>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-emerald-400" />
              </div>
            </div>

            {saleError && (
              <div className="p-4 rounded-2xl border border-red-500/20 bg-red-500/10 text-red-300 text-sm flex gap-3">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>{saleError}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label>{t('pos.checkout.customer')}</Label>
              <div className="relative">
                <UserRound className="w-4 h-4 text-neutral-600 absolute left-3 top-1/2 -translate-y-1/2" />
                <select
                  value={customerId}
                  onChange={(event) => setCustomerId(event.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all appearance-none"
                >
                  <option value="" className="bg-neutral-900">{t('pos.checkout.guest_checkout')}</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id} className="bg-neutral-900">
                      {customer.name}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-[11px] text-neutral-500">{t('pos.checkout.current_customer', { customerName })}</p>
            </div>

            <div className="space-y-2">
              <Label>{t('pos.checkout.payment_method')}</Label>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(method)}
                    className={cn(
                      'px-3 py-3 rounded-xl border text-xs uppercase tracking-[0.2em] font-bold transition-all',
                      paymentMethod === method
                        ? 'border-blue-500/30 bg-blue-500/10 text-white'
                        : 'border-white/10 bg-white/[0.03] text-neutral-500 hover:text-neutral-200'
                    )}
                  >
                    {method}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('pos.summary.discount')}</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={discountInput}
                  onChange={(event) => setDiscountInput(event.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('pos.summary.tax')}</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={taxInput}
                  onChange={(event) => setTaxInput(event.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-500">{t('pos.summary.subtotal')}</span>
                <span className="text-white font-mono">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-500">{t('pos.summary.discount')}</span>
                <span className="text-white font-mono">- {formatCurrency(discount)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-500">{t('pos.summary.tax')}</span>
                <span className="text-white font-mono">+ {formatCurrency(tax)}</span>
              </div>
              <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                <span className="text-xs uppercase tracking-[0.25em] text-neutral-500 font-black">{t('pos.summary.total')}</span>
                <span className="text-3xl font-mono text-white tracking-tighter">{formatCurrency(total)}</span>
              </div>
            </div>

            <Button
              className="w-full h-14 text-sm font-bold uppercase tracking-[0.25em] shadow-xl shadow-blue-600/10"
              disabled={cart.length === 0 || isSubmitting}
              onClick={handleCompleteSale}
            >
              <BadgeDollarSign className="w-4 h-4 mr-2" />
              {isSubmitting ? t('pos.checkout.processing') : t('pos.checkout.complete_sale')}
            </Button>
          </Card>

          <Card className="p-6 border-white/5 bg-neutral-900/40 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-neutral-600 uppercase tracking-[0.35em] mb-2">Roadmap Surface</p>
                <h3 className="text-white font-bold text-lg">{t('pos.integrations.title')}</h3>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center">
                <Store className="w-5 h-5 text-neutral-400" />
              </div>
            </div>
            <div className="space-y-3">
              {COMING_SOON.map((integration) => (
                <div
                  key={integration}
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <CreditCard className="w-4 h-4 text-neutral-500" />
                    <span className="text-sm font-medium text-neutral-200">{integration}</span>
                  </div>
                  <span className="text-[10px] uppercase tracking-[0.2em] text-neutral-600 font-bold">Pending</span>
                </div>
              ))}
            </div>
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.01] p-4 flex items-center gap-3 text-neutral-500 text-xs">
              <Printer className="w-4 h-4" />
              {t('pos.integrations.note')}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
