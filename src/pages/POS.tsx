import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertCircle,
  BadgeDollarSign,
  BrainCircuit,
  Command,
  Copy,
  CreditCard,
  Eraser,
  Minus,
  Package,
  Plus,
  Printer,
  QrCode,
  ReceiptText,
  Search,
  ShoppingCart,
  ShieldAlert,
  Sparkles,
  Store,
  UserRound,
  Wallet,
  X,
} from 'lucide-react';
import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { Card, Button, Input, Label, cn } from '../components/Common';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { useLocale } from '../hooks/useLocale';
import { db } from '../lib/firebase';
import { createSaleTransaction } from '../services/sales';
import { exportPOSReceiptToPDF } from '../lib/exportUtils';
import { getOrderTotal } from '../../shared/orders';

interface Product {
  id: string;
  name: string;
  price: number;
  stockLevel: number;
  sku?: string;
  category?: string;
  status: 'active' | 'draft' | 'archived';
  costPrice?: number;
  imageURL?: string;
}

interface Customer {
  id: string;
  name: string;
  phone?: string;
  totalOrders?: number;
  totalSpent?: number;
  rfmTier?: string;
  lastOrderAt?: any;
}

interface CartItem {
  productId: string;
  name: string;
  sku?: string;
  price: number;
  quantity: number;
  stockLevel: number;
  category?: string;
  costPrice?: number;
}

interface OrderSnapshotItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  sku?: string;
}

interface OrderDoc {
  id: string;
  customerId?: string;
  customerName?: string;
  paymentMethod?: string;
  total: number;
  status?: string;
  channel?: string;
  cashSessionId?: string;
  createdAt?: any;
  itemsSnapshot?: OrderSnapshotItem[];
}

interface CashSessionDoc {
  id: string;
  companyId: string;
  status: 'open' | 'closed';
  openingCash: number;
  openedAt?: any;
  openedByName?: string;
  closedAt?: any;
  closingNotes?: string;
  salesCount?: number;
  salesTotal?: number;
  cashSalesTotal?: number;
  expectedCash?: number;
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
  footerMessage: string;
}

interface PulseInsight {
  id: string;
  title: string;
  body: string;
  tone: 'info' | 'success' | 'warning';
}

type OperationMode = 'retail' | 'wholesale';

const PAYMENT_METHODS = ['Cash', 'Card', 'Transfer', 'Stripe', 'Crypto'] as const;
const INTEGRATION_ROADMAP = ['Stripe Terminal', 'Square POS', 'Shopify POS', 'SumUp'];
const QUICK_DISCOUNT_RATE = 0.1;

function getTimestampValue(value: any) {
  if (!value) return 0;
  const date = value.toDate ? value.toDate() : new Date(value);
  return date.getTime();
}

export function POS() {
  const { company, user, userProfile } = useAuth();
  const { t, formatCurrency } = useLocale();
  const { canUsePOS } = usePermissions();
  const commandBarInputRef = useRef<HTMLInputElement>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<OrderDoc[]>([]);
  const [cashSessions, setCashSessions] = useState<CashSessionDoc[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<(typeof PAYMENT_METHODS)[number]>('Cash');
  const [discountInput, setDiscountInput] = useState('0');
  const [discountType, setDiscountType] = useState<'fixed' | 'pct'>('fixed');
  const [taxInput, setTaxInput] = useState('0');
  const [saleError, setSaleError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [operationMode, setOperationMode] = useState<OperationMode>('retail');
  const [latestReceipt, setLatestReceipt] = useState<POSReceipt | null>(null);
  const [receiptFooterMessage, setReceiptFooterMessage] = useState(t('pos.checkout.receipt_placeholder'));
  const [openingCashInput, setOpeningCashInput] = useState('100');
  const [closingNotes, setClosingNotes] = useState('');
  const [cashSessionError, setCashSessionError] = useState<string | null>(null);
  const [cashSessionAccessUnavailable, setCashSessionAccessUnavailable] = useState(false);
  const [isCashLoading, setIsCashLoading] = useState(false);
  const [isCommandBarOpen, setIsCommandBarOpen] = useState(false);
  const [selectedProductIndex, setSelectedProductIndex] = useState(0);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!company) return;

    const productsQuery = query(collection(db, 'products'), where('companyId', '==', company.id));
    const customersQuery = query(collection(db, 'customers'), where('companyId', '==', company.id));
    const ordersQuery = query(collection(db, 'orders'), where('companyId', '==', company.id));
    const cashSessionsQuery = query(collection(db, 'cashSessions'), where('companyId', '==', company.id));

    const unsubscribeProducts = onSnapshot(productsQuery, (snapshot) => {
      setProducts(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() } as Product)));
    }, (error) => {
      console.error('POS products listener error:', error);
    });

    const unsubscribeCustomers = onSnapshot(customersQuery, (snapshot) => {
      setCustomers(snapshot.docs.map((entry) => ({
        id: entry.id,
        name: entry.data().name || 'Unknown',
        phone: entry.data().phone,
        totalOrders: entry.data().totalOrders,
        totalSpent: entry.data().totalSpent,
        rfmTier: entry.data().rfmTier,
        lastOrderAt: entry.data().lastOrderAt,
      })));
    }, (error) => {
      console.error('POS customers listener error:', error);
    });

    const unsubscribeOrders = onSnapshot(ordersQuery, (snapshot) => {
      setOrders(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() } as OrderDoc)));
    }, (error) => {
      console.error('POS orders listener error:', error);
    });

    const unsubscribeSessions = onSnapshot(
      cashSessionsQuery,
      (snapshot) => {
        setCashSessionAccessUnavailable(false);
        setCashSessionError(null);
        setCashSessions(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() } as CashSessionDoc)));
      },
      (error) => {
        console.warn('Cash sessions unavailable:', error);
        setCashSessions([]);
        setCashSessionAccessUnavailable(true);
        setCashSessionError(t('pos.cash.unavailable_error'));
      }
    );

    return () => {
      unsubscribeProducts();
      unsubscribeCustomers();
      unsubscribeOrders();
      unsubscribeSessions();
    };
  }, [company]);

  useEffect(() => {
    if (!company) return;
    const saved = window.localStorage.getItem(`pos_receipt_footer_${company.id}`);
    if (saved) setReceiptFooterMessage(saved);
  }, [company?.id]);

  useEffect(() => {
    if (!company?.id) return;
    const saved = window.localStorage.getItem(`pos_operation_mode_${company.id}`) as OperationMode | null;
    if (saved === 'retail' || saved === 'wholesale') {
      setOperationMode(saved);
      return;
    }

    const profile = `${company.vertical || ''} ${company.industry || ''}`.toLowerCase();
    const inferredMode: OperationMode =
      profile.includes('wholesale') ||
      profile.includes('mayor') ||
      profile.includes('distrib') ||
      profile.includes('manufacturer')
        ? 'wholesale'
        : 'retail';
    setOperationMode(inferredMode);
  }, [company?.id, company?.industry, company?.vertical]);

  useEffect(() => {
    if (!company?.id) return;
    window.localStorage.setItem(`pos_operation_mode_${company.id}`, operationMode);
  }, [company?.id, operationMode]);

  useEffect(() => {
    if (!company) return;
    window.localStorage.setItem(`pos_receipt_footer_${company.id}`, receiptFooterMessage);
  }, [company?.id, receiptFooterMessage]);

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

  useEffect(() => {
    if (filteredProducts.length === 0) {
      setSelectedProductIndex(0);
      return;
    }
    setSelectedProductIndex((current) => Math.min(current, filteredProducts.length - 1));
  }, [filteredProducts]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsCommandBarOpen(true);
        requestAnimationFrame(() => commandBarInputRef.current?.focus());
        return;
      }

      if (!isCommandBarOpen) return;

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedProductIndex((current) =>
          filteredProducts.length === 0 ? 0 : (current + 1) % filteredProducts.length
        );
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedProductIndex((current) =>
          filteredProducts.length === 0 ? 0 : (current - 1 + filteredProducts.length) % filteredProducts.length
        );
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        const selected = filteredProducts[selectedProductIndex];
        if (selected) {
          addToCart(selected);
          setIsCommandBarOpen(false);
        }
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        setSelectedProductIndex(0);
        setSearch('');
        setIsCommandBarOpen(false);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [filteredProducts, isCommandBarOpen, selectedProductIndex]);

  const customerName = useMemo(() => {
    if (!customerId) return t('orders.guest') || 'Guest';
    return customers.find((customer) => customer.id === customerId)?.name || t('orders.guest') || 'Guest';
  }, [customerId, customers, t]);

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discountRaw = Math.max(0, parseFloat(discountInput) || 0);
  const discount = discountType === 'pct' ? Math.min(subtotal, subtotal * (discountRaw / 100)) : Math.min(subtotal, discountRaw);
  const tax = Math.max(0, parseFloat(taxInput) || 0);
  const total = Math.max(0, subtotal - discount + tax);

  const sortedCashSessions = useMemo(
    () => [...cashSessions].sort((a, b) => getTimestampValue(b.openedAt) - getTimestampValue(a.openedAt)),
    [cashSessions]
  );

  const activeCashSession = useMemo(
    () => sortedCashSessions.find((session) => session.status === 'open') || null,
    [sortedCashSessions]
  );

  const availablePaymentMethods = useMemo<readonly (typeof PAYMENT_METHODS)[number][]>(
    () =>
      operationMode === 'wholesale'
        ? PAYMENT_METHODS.filter((method) => method !== 'Crypto')
        : PAYMENT_METHODS,
    [operationMode]
  );

  useEffect(() => {
    if (!availablePaymentMethods.includes(paymentMethod)) {
      setPaymentMethod(availablePaymentMethods[0]);
    }
  }, [availablePaymentMethods, paymentMethod]);

  const cartUnits = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );

  const latestPOSOrder = useMemo(
    () =>
      [...orders]
        .filter((order) => order.channel === 'pos')
        .sort((a, b) => getTimestampValue(b.createdAt) - getTimestampValue(a.createdAt))[0] || null,
    [orders]
  );

  const currentTurnOrders = useMemo(() => {
    if (!activeCashSession) return [];
    return orders.filter((order) => order.cashSessionId === activeCashSession.id);
  }, [orders, activeCashSession]);

  const turnSalesTotal = useMemo(
    () => currentTurnOrders.reduce((sum, order) => sum + getOrderTotal(order), 0),
    [currentTurnOrders]
  );

  const turnCashTotal = useMemo(
    () =>
      currentTurnOrders
        .filter((order) => order.paymentMethod === 'Cash')
        .reduce((sum, order) => sum + getOrderTotal(order), 0),
    [currentTurnOrders]
  );

  const expectedCash = (activeCashSession?.openingCash || 0) + turnCashTotal;

  const getAvailableStock = (productId: string) =>
    products.find((product) => product.id === productId)?.stockLevel ?? 0;

  const hasCartStockIssue = cart.some((item) => item.quantity > getAvailableStock(item.productId));

  const clearCart = () => {
    setCart([]);
    setDiscountInput('0');
    setDiscountType('fixed');
    setTaxInput('0');
    setSaleError(null);
  };

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
            category: product.category,
            costPrice: product.costPrice,
          },
        ];
      }

      const nextQuantity = existingItem.quantity + 1;
      if (nextQuantity > getAvailableStock(product.id)) {
        setSaleError(t('pos.errors.insufficient_stock', { name: product.name, count: getAvailableStock(product.id) }));
        return current;
      }

      return current.map((item) =>
        item.productId === product.id
          ? { ...item, quantity: nextQuantity, stockLevel: getAvailableStock(product.id) }
          : item
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
      setSaleError(t('pos.errors.insufficient_stock', { name: productName, count: availableStock }));
      return;
    }

    setCart((current) =>
      current.map((item) =>
        item.productId === productId
          ? { ...item, quantity: nextQuantity, stockLevel: availableStock }
          : item
      )
    );
  };

  const removeItem = (productId: string) => {
    setSaleError(null);
    setCart((current) => current.filter((item) => item.productId !== productId));
  };

  const applyPackQuantity = (productId: string, packSize: number) => {
    const currentItem = cart.find((item) => item.productId === productId);
    if (!currentItem) return;
    updateQuantity(productId, currentItem.quantity + packSize);
  };

  const applyQuickDiscount = () => {
    if (subtotal <= 0) return;
    setDiscountType('pct');
    setDiscountInput((QUICK_DISCOUNT_RATE * 100).toFixed(0));
  };

  const setGuestCheckout = () => {
    setCustomerId('');
  };

  const closeScanner = useCallback(() => {
    if (scanIntervalRef.current) { clearInterval(scanIntervalRef.current); scanIntervalRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    setIsScannerOpen(false);
    setScannerError(null);
  }, []);

  const openScanner = useCallback(async () => {
    setScannerError(null);
    setIsScannerOpen(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const BarcodeDetectorAPI = (window as any).BarcodeDetector;
      if (!BarcodeDetectorAPI) {
        setScannerError('Barcode scanning is not supported in this browser. Try Chrome on Android.');
        return;
      }
      const detector = new BarcodeDetectorAPI({ formats: ['ean_13', 'ean_8', 'qr_code', 'code_128', 'code_39', 'upc_a', 'upc_e'] });

      scanIntervalRef.current = setInterval(async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) return;
        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes.length === 0) return;
          const code = barcodes[0].rawValue;
          const match = activeProducts.find(p => p.sku === code || p.id === code);
          if (match) {
            addToCart(match);
            closeScanner();
          } else {
            setScannerError(`No product found for barcode: ${code}`);
          }
        } catch { /* frame not ready */ }
      }, 300);
    } catch (err: any) {
      setScannerError(err?.message || 'Camera access denied.');
    }
  }, [activeProducts, addToCart, closeScanner]);

  useEffect(() => () => closeScanner(), [closeScanner]);

  const loadOrderItems = async (order: OrderDoc) => {
    if (order.itemsSnapshot?.length) {
      return order.itemsSnapshot;
    }

    const snapshot = await getDocs(collection(db, 'orders', order.id, 'items'));
    return snapshot.docs.map((entry) => ({
      productId: entry.data().productId,
      productName: entry.data().productName,
      quantity: entry.data().quantity,
      price: entry.data().price,
      sku: entry.data().sku,
    }));
  };

  const handleDuplicateLastSale = async () => {
    if (!latestPOSOrder) {
      setSaleError(t('pos.quick.no_previous_sale'));
      return;
    }

    setIsDuplicating(true);
    setSaleError(null);

    try {
      const items = await loadOrderItems(latestPOSOrder);
      const rebuiltCart: CartItem[] = [];
      const unavailable: string[] = [];

      for (const item of items) {
        const product = products.find((entry) => entry.id === item.productId);
        if (!product) {
          unavailable.push(item.productName);
          continue;
        }

        rebuiltCart.push({
          productId: item.productId,
          name: item.productName,
          sku: item.sku || product.sku,
          price: item.price,
          quantity: Math.min(item.quantity, product.stockLevel),
          stockLevel: product.stockLevel,
          category: product.category,
          costPrice: product.costPrice,
        });

        if (product.stockLevel < item.quantity) {
          unavailable.push(t('pos.quick.adjusted_to_stock', { name: item.productName }));
        }
      }

      if (rebuiltCart.length === 0) {
        throw new Error(t('pos.quick.duplicate_empty'));
      }

      setCart(rebuiltCart);
      setPaymentMethod((latestPOSOrder.paymentMethod as (typeof PAYMENT_METHODS)[number]) || 'Cash');
      setCustomerId(latestPOSOrder.customerId || '');
      setDiscountInput('0');
      setTaxInput('0');
      setIsCommandBarOpen(false);

      if (unavailable.length > 0) {
        setSaleError(t('pos.quick.duplicate_adjusted', { items: unavailable.join(', ') }));
      }
    } catch (error) {
      setSaleError(error instanceof Error ? error.message : t('pos.quick.duplicate_failed'));
    } finally {
      setIsDuplicating(false);
    }
  };

  const handleOpenCashSession = async () => {
    if (!company || activeCashSession || cashSessionAccessUnavailable) return;

    const openingCash = Math.max(0, parseFloat(openingCashInput) || 0);
    setCashSessionError(null);
    setIsCashLoading(true);

    try {
      const operatorName =
        userProfile?.displayName ||
        user?.displayName ||
        user?.email ||
        'POS Operator';

      await addDoc(collection(db, 'cashSessions'), {
        companyId: company.id,
        status: 'open',
        openingCash,
        openedAt: serverTimestamp(),
        openedBy: user?.uid || '',
        openedByName: operatorName,
      });

      await addDoc(collection(db, 'activities'), {
        companyId: company.id,
        type: 'cash_session_open',
        title: 'Cash Session Opened',
        subtitle: `${operatorName} opened cash with $${openingCash.toFixed(2)}`,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      setCashSessionError(error instanceof Error ? error.message : t('pos.cash.open_failed'));
    } finally {
      setIsCashLoading(false);
    }
  };

  const handleCloseCashSession = async () => {
    if (!company || !activeCashSession || cashSessionAccessUnavailable) return;

    setCashSessionError(null);
    setIsCashLoading(true);

    try {
      await updateDoc(doc(db, 'cashSessions', activeCashSession.id), {
        status: 'closed',
        closedAt: serverTimestamp(),
        closedBy: user?.uid || '',
        closedByName: userProfile?.displayName || user?.displayName || user?.email || 'POS Operator',
        closingNotes,
        salesCount: currentTurnOrders.length,
        salesTotal: turnSalesTotal,
        cashSalesTotal: turnCashTotal,
        expectedCash,
      });

      await addDoc(collection(db, 'activities'), {
        companyId: company.id,
        type: 'cash_session_close',
        title: 'Cash Session Closed',
        subtitle: `${currentTurnOrders.length} sales closed with expected cash $${expectedCash.toFixed(2)}`,
        createdAt: serverTimestamp(),
      });

      setClosingNotes('');
    } catch (error) {
      setCashSessionError(error instanceof Error ? error.message : t('pos.cash.close_failed'));
    } finally {
      setIsCashLoading(false);
    }
  };

  const pulseInsights = useMemo<PulseInsight[]>(() => {
    if (cart.length === 0) {
      return [
        {
          id: 'pulse-idle',
          title: t('pos.pulse.idle_title'),
          body: t('pos.pulse.idle_body'),
          tone: 'info',
        },
      ];
    }

    const cartIds = new Set(cart.map((item) => item.productId));
    const richOrders = orders.filter((order) => Array.isArray(order.itemsSnapshot) && order.itemsSnapshot.length > 0);
    const insights: PulseInsight[] = [];

    if (customerId) {
      const customerOrders = richOrders.filter((order) => order.customerId === customerId);
      const relatedCounts = new Map<string, number>();

      customerOrders.forEach((order) => {
        const orderItems = order.itemsSnapshot || [];
        const touchesCurrentCart = orderItems.some((item) => cartIds.has(item.productId));
        if (!touchesCurrentCart) return;

        orderItems.forEach((item) => {
          if (!cartIds.has(item.productId)) {
            relatedCounts.set(item.productId, (relatedCounts.get(item.productId) || 0) + item.quantity);
          }
        });
      });

      const topRelatedCustomerProduct = [...relatedCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([productId]) => products.find((product) => product.id === productId))
        .find(Boolean);

      if (topRelatedCustomerProduct) {
        insights.push({
          id: 'customer-related',
          title: t('pos.pulse.customer_habit_title'),
          body: t('pos.pulse.customer_habit_body', {
            customerName,
            productName: topRelatedCustomerProduct.name,
          }),
          tone: 'success',
        });
      }
    }

    const coPurchaseCounts = new Map<string, number>();
    richOrders.forEach((order) => {
      const orderItems = order.itemsSnapshot || [];
      const touchesCurrentCart = orderItems.some((item) => cartIds.has(item.productId));
      if (!touchesCurrentCart) return;

      orderItems.forEach((item) => {
        if (!cartIds.has(item.productId)) {
          coPurchaseCounts.set(item.productId, (coPurchaseCounts.get(item.productId) || 0) + item.quantity);
        }
      });
    });

    const topCrossSell = [...coPurchaseCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([productId]) => products.find((product) => product.id === productId && product.status === 'active'))
      .find(Boolean);

    if (topCrossSell) {
      insights.push({
        id: 'cross-sell',
        title: t('pos.pulse.related_title'),
        body: t('pos.pulse.related_body', { productName: topCrossSell.name }),
        tone: 'success',
      });
    }

    const upsellCandidate = activeProducts
      .filter((candidate) => !cartIds.has(candidate.id) && candidate.stockLevel > 3)
      .map((candidate) => {
        const sameCategoryMatch = cart.find((item) => item.category && candidate.category && item.category === candidate.category);
        return sameCategoryMatch ? { candidate, baseItem: sameCategoryMatch } : null;
      })
      .filter(Boolean)
      .sort((a, b) => (a!.candidate.price - a!.baseItem.price) - (b!.candidate.price - b!.baseItem.price))[0];

    if (upsellCandidate) {
      insights.push({
        id: 'upsell',
        title: t('pos.pulse.upsell_title'),
        body: t('pos.pulse.upsell_body', {
          baseItem: upsellCandidate.baseItem.name,
          candidate: upsellCandidate.candidate.name,
        }),
        tone: 'info',
      });
    }

    const lowMarginItem = cart.find((item) => {
      if (typeof item.costPrice !== 'number' || item.price <= 0) return false;
      const margin = (item.price - item.costPrice) / item.price;
      return margin < 0.18;
    });

    if (lowMarginItem) {
      insights.push({
        id: 'low-margin',
        title: t('pos.pulse.margin_title'),
        body: t('pos.pulse.margin_body', { productName: lowMarginItem.name }),
        tone: 'warning',
      });
    }

    const lowStockRisk = cart.find((item) => getAvailableStock(item.productId) - item.quantity <= 2);
    if (lowStockRisk) {
      insights.push({
        id: 'low-stock',
        title: t('pos.pulse.stock_title'),
        body: t('pos.pulse.stock_body', { productName: lowStockRisk.name }),
        tone: 'warning',
      });
    }

    return insights.slice(0, 4);
  }, [activeProducts, cart, customerId, customerName, orders, products]);

  const handleCompleteSale = async () => {
    if (!company || cart.length === 0) return;

    setIsSubmitting(true);
    setSaleError(null);

    try {
      if (operationMode === 'wholesale' && !customerId) {
        throw new Error('Selecciona un cliente para completar una venta mayorista.');
      }

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
          sku: item.sku,
        })),
        subtotal,
        discount,
        tax,
        total,
        channel: 'pos',
        cashSessionId: activeCashSession?.id || null,
        movementReason: 'POS Sale',
        activityTitle: 'POS Sale Completed',
        messages: {
          productNotFound: (name) => t('pos.errors.product_not_found', { name }),
          insufficientStock: (name, count) => t('pos.errors.insufficient_stock', { name, count }),
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
        footerMessage: receiptFooterMessage,
      });

      clearCart();
      setCustomerId('');
      setPaymentMethod(operationMode === 'wholesale' ? 'Transfer' : 'Cash');
    } catch (error) {
      setSaleError(error instanceof Error ? error.message : t('pos.errors.sale_failed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrintReceipt = () => {
    if (!latestReceipt) return;

    const receiptWindow = window.open('', '_blank', 'width=420,height=720');
    if (!receiptWindow) return;

    const rows = latestReceipt.items.map((item) => `
      <tr>
        <td>${item.name}</td>
        <td>${item.quantity}</td>
        <td>${formatCurrency(item.price * item.quantity)}</td>
      </tr>
    `).join('');

    receiptWindow.document.write(`
      <html>
        <head>
          <title>Receipt ${latestReceipt.orderId}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
            h1, h2, p { margin: 0 0 8px; }
            table { width: 100%; border-collapse: collapse; margin: 16px 0; }
            td, th { border-bottom: 1px solid #ddd; padding: 8px 0; text-align: left; }
            .meta, .summary { font-size: 12px; color: #555; }
            .total { font-size: 20px; font-weight: 700; }
          </style>
        </head>
        <body>
          <h1>${company?.name || 'Remix OS'}</h1>
          <p class="meta">Order ${latestReceipt.orderId}</p>
          <p class="meta">${latestReceipt.createdAt.toLocaleString()}</p>
          <p>${latestReceipt.customerName} / ${latestReceipt.paymentMethod}</p>
          <table>
            <thead>
              <tr><th>Item</th><th>Qty</th><th>Total</th></tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <p class="summary">Subtotal: ${formatCurrency(latestReceipt.subtotal)}</p>
          <p class="summary">Discount: ${formatCurrency(latestReceipt.discount)}</p>
          <p class="summary">Tax: ${formatCurrency(latestReceipt.tax)}</p>
          <p class="total">Total: ${formatCurrency(latestReceipt.total)}</p>
          <p class="summary">${latestReceipt.footerMessage}</p>
        </body>
      </html>
    `);
    receiptWindow.document.close();
    receiptWindow.focus();
    receiptWindow.print();
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
    <div className="space-y-5 pb-28 xl:pb-8 xl:pl-20 2xl:pl-24">
      <AnimatePresence>
        {isCommandBarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-md z-[90]"
              onClick={() => setIsCommandBarOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              className="fixed top-16 left-1/2 -translate-x-1/2 w-[min(92vw,760px)] z-[100]"
            >
              <div className="rounded-[28px] border border-white/10 bg-neutral-950/95 shadow-2xl overflow-hidden">
                <div className="p-5 border-b border-white/[0.06] flex items-center gap-3">
                  <Command className="w-5 h-5 text-blue-400" />
                  <Input
                    ref={commandBarInputRef}
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={t('pos.command.placeholder')}
                    className="border-0 bg-transparent px-0 py-0 h-auto focus:ring-0"
                  />
                  <button
                    type="button"
                    onClick={() => setIsCommandBarOpen(false)}
                    className="w-9 h-9 rounded-xl border border-white/10 bg-white/[0.03] flex items-center justify-center text-neutral-500 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="max-h-[420px] overflow-y-auto p-3">
                  {filteredProducts.slice(0, 10).map((product, index) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => {
                        addToCart(product);
                        setIsCommandBarOpen(false);
                      }}
                      className={cn(
                        'w-full rounded-2xl border px-4 py-3 text-left transition-all mb-2 last:mb-0',
                        selectedProductIndex === index
                          ? 'border-blue-500/30 bg-blue-500/10'
                          : 'border-white/8 bg-white/[0.02] hover:bg-white/[0.04]'
                      )}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-white font-bold">{product.name}</p>
                          <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-600 font-black">
                            {(product.sku || 'NO_SKU')} / {t('pos.catalog.stock', { count: product.stockLevel })}
                          </p>
                        </div>
                        <p className="text-white font-mono">{formatCurrency(product.price)}</p>
                      </div>
                    </button>
                  ))}
                  {filteredProducts.length === 0 && (
                    <div className="px-4 py-10 text-center text-neutral-500 text-sm">{t('pos.command.empty')}</div>
                  )}
                </div>
                <div className="px-5 py-3 border-t border-white/[0.06] text-[11px] text-neutral-600 flex flex-wrap gap-4 uppercase tracking-[0.2em]">
                  <span>{t('pos.command.enter_hint')}</span>
                  <span>{t('pos.command.escape_hint')}</span>
                  <span>{t('pos.command.reopen_hint')}</span>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight mb-2 text-white">{t('pos.title')}</h1>
          <p className="text-neutral-500 text-sm">
            {operationMode === 'retail'
              ? 'Flujo rapido para tienda minorista, caja y ticket inmediato.'
              : 'Flujo orientado a pedidos por volumen, cliente y cierre comercial.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="px-4 py-2 rounded-2xl border border-white/10 bg-white/[0.03] text-xs uppercase tracking-[0.25em] text-neutral-400 font-bold">
            {company?.name || 'Remix Node'}
          </div>
          <div className="flex rounded-2xl border border-white/10 bg-white/[0.03] p-1">
            <button
              type="button"
              onClick={() => setOperationMode('retail')}
              className={cn(
                'rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] transition-all',
                operationMode === 'retail' ? 'bg-white/10 text-white' : 'text-neutral-500 hover:text-neutral-200'
              )}
            >
              Retail
            </button>
            <button
              type="button"
              onClick={() => setOperationMode('wholesale')}
              className={cn(
                'rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] transition-all',
                operationMode === 'wholesale' ? 'bg-white/10 text-white' : 'text-neutral-500 hover:text-neutral-200'
              )}
            >
              Wholesale
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              setIsCommandBarOpen(true);
              requestAnimationFrame(() => commandBarInputRef.current?.focus());
            }}
            className="px-4 py-2 rounded-2xl border border-blue-500/20 bg-blue-500/10 text-xs uppercase tracking-[0.25em] text-blue-300 font-bold flex items-center gap-2"
          >
            <Command className="w-3.5 h-3.5" />
            {operationMode === 'retail' ? t('pos.command.title') : 'Buscar catalogo'}
          </button>
        </div>
      </div>

      {latestReceipt && (
        <Card className="p-6 border-white/5 bg-neutral-900/40 overflow-hidden">
          <div className="absolute pointer-events-none top-0 right-0 w-64 h-64 bg-blue-500/10 blur-3xl" />
          <div className="relative flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl overflow-hidden border border-white/10 bg-white/[0.03] flex items-center justify-center">
                  {company?.logoURL ? (
                    <img src={company.logoURL} alt={company.name} className="w-full h-full object-cover" />
                  ) : (
                    <ReceiptText className="w-6 h-6 text-blue-400" />
                  )}
                </div>
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
                <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.2em] font-black text-blue-300/80 mb-2">{t('pos.receipt.total')}</p>
                  <p className="text-sm text-white font-mono">{formatCurrency(latestReceipt.total)}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                variant="secondary"
                className="gap-2 px-5 h-11"
                onClick={async () => {
                  await exportPOSReceiptToPDF({
                    companyName: company?.name || 'Remix',
                    logoURL: company?.logoURL,
                    orderId: latestReceipt.orderId,
                    createdAt: latestReceipt.createdAt,
                    customerName: latestReceipt.customerName,
                    paymentMethod: latestReceipt.paymentMethod,
                    subtotal: latestReceipt.subtotal,
                    discount: latestReceipt.discount,
                    tax: latestReceipt.tax,
                    total: latestReceipt.total,
                    footerMessage: latestReceipt.footerMessage,
                    items: latestReceipt.items.map((item) => ({
                      name: item.name,
                      sku: item.sku,
                      quantity: item.quantity,
                      price: item.price,
                    })),
                  });
                }}
              >
                <BadgeDollarSign className="w-4 h-4" />
                {t('pos.receipt.download_pdf')}
              </Button>
              <Button variant="secondary" className="gap-2 px-5 h-11" onClick={handlePrintReceipt}>
                <Printer className="w-4 h-4" />
                {t('common.print') || 'Print'}
              </Button>
            </div>
          </div>

          <div className="relative mt-6 rounded-3xl border border-white/10 bg-black/30 overflow-hidden">
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-neutral-600">{t('pos.receipt.ledger')}</p>
                <p className="text-sm text-neutral-400 mt-1">{latestReceipt.customerName} / {latestReceipt.paymentMethod}</p>
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
                      {(item.sku || 'NO_SKU')} / {t('pos.receipt.qty', { count: item.quantity })}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-mono text-white">{formatCurrency(item.price * item.quantity)}</p>
                    <p className="text-[10px] text-neutral-600">{formatCurrency(item.price)} {t('pos.receipt.each')}</p>
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
              <p className="pt-3 text-xs text-neutral-500 border-t border-white/10">
                {latestReceipt.footerMessage}
              </p>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-[minmax(320px,360px)_minmax(380px,1fr)_minmax(360px,400px)] 2xl:grid-cols-[360px_minmax(420px,1fr)_400px]">
        <Card className="p-0 overflow-hidden border-white/5 bg-neutral-900/40">
          <div className="space-y-4 border-b border-white/[0.05] bg-white/[0.01] p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="mb-2 text-[10px] font-black uppercase tracking-[0.35em] text-neutral-600">{t('pos.catalog.label')}</p>
                <h2 className="text-white font-bold text-lg">{t('pos.catalog.title')}</h2>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500">
                {t('pos.catalog.live', { count: activeProducts.length })}
              </div>
            </div>
            <div className="relative flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-neutral-600 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t('pos.catalog.search_placeholder')}
                  className="pl-10 h-11 bg-black/40 border-white/10"
                />
              </div>
              <button
                onClick={openScanner}
                title="Scan barcode"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/40 text-neutral-500 transition-colors hover:border-blue-400/30 hover:text-blue-300 active:scale-95"
              >
                <QrCode className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="custom-scrollbar min-h-[560px] max-h-[calc(100vh-240px)] overflow-y-auto p-4 space-y-3">
            {filteredProducts.map((product, index) => {
              const isLowStock = product.stockLevel <= 10;
              const isOutOfStock = product.stockLevel <= 0;
              return (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02 }}
                  className={cn(
                    'w-full rounded-2xl border bg-white/[0.02] transition-all',
                    isCommandBarOpen && selectedProductIndex === index
                      ? 'border-blue-500/30'
                      : 'border-white/[0.06]',
                    isOutOfStock ? 'opacity-70' : 'hover:bg-white/[0.04] hover:border-blue-500/20'
                  )}
                >
                  <div className="flex items-start justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl border border-white/10 bg-black/30 flex items-center justify-center overflow-hidden">
                          {product.imageURL ? (
                            <img src={product.imageURL} alt={product.name} className="w-full h-full object-cover" />
                          ) : (
                            <Package className="w-4 h-4 text-neutral-500" />
                          )}
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
                      <Button
                        className="gap-2 px-4 h-10"
                        onClick={(event) => {
                          event.stopPropagation();
                          addToCart(product);
                        }}
                        disabled={isOutOfStock}
                      >
                        <Plus className="w-4 h-4" />
                        {isOutOfStock ? t('pos.catalog.out_of_stock') : t('pos.catalog.add')}
                      </Button>
                    </div>
                  </div>
                </motion.div>
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

        <div className="space-y-5">
          <Card className="flex min-h-[680px] flex-col overflow-hidden border-white/5 bg-neutral-900/40 p-0">
            <div className="flex items-center justify-between border-b border-white/[0.05] bg-white/[0.01] p-5">
              <div>
                <p className="mb-2 text-[10px] font-black uppercase tracking-[0.35em] text-neutral-600">{t('pos.cart.label')}</p>
                <h2 className="text-white font-bold text-lg">{t('pos.cart.title')}</h2>
                <p className="mt-2 text-xs text-neutral-500">
                  {operationMode === 'retail'
                    ? 'Venta rapida con cantidades simples.'
                    : 'Preparado para cajas, volumen y reposicion.'}
                </p>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center">
                <ShoppingCart className="w-5 h-5 text-blue-400" />
              </div>
            </div>

            <div className="custom-scrollbar flex-1 min-h-[360px] max-h-[calc(100vh-310px)] overflow-y-auto p-4 space-y-3">
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

                    {operationMode === 'wholesale' && (
                      <div className="flex flex-wrap gap-2">
                        {[6, 12, 24].map((packSize) => (
                          <button
                            key={packSize}
                            type="button"
                            onClick={() => applyPackQuantity(item.productId, packSize)}
                            className="rounded-xl border border-white/10 bg-black/30 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-300 transition-colors hover:border-blue-400/20 hover:text-white"
                          >
                            +{packSize}
                          </button>
                        ))}
                      </div>
                    )}

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
                <div className="flex min-h-[260px] items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.01] px-6 text-center">
                  <div>
                    <ShoppingCart className="mx-auto mb-4 w-10 h-10 text-neutral-700" />
                    <p className="text-sm font-bold text-neutral-300">{t('pos.cart.empty_title')}</p>
                    <p className="text-xs text-neutral-600 mt-2">{t('pos.cart.empty_subtitle')}</p>
                  </div>
                </div>
              )}
            </div>
          </Card>

          <Card className="space-y-4 border-white/5 bg-neutral-900/40 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="mb-2 text-[10px] font-black uppercase tracking-[0.35em] text-neutral-600">{t('pos.pulse.label')}</p>
                <h2 className="text-white font-bold text-lg">{t('pos.pulse.title')}</h2>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <BrainCircuit className="w-5 h-5 text-blue-400" />
              </div>
            </div>

            <div className="space-y-3">
              {pulseInsights.map((insight) => (
                <div
                  key={insight.id}
                  className={cn(
                    'rounded-2xl border px-4 py-4',
                    insight.tone === 'warning'
                      ? 'border-amber-500/20 bg-amber-500/10'
                      : insight.tone === 'success'
                        ? 'border-emerald-500/20 bg-emerald-500/10'
                        : 'border-blue-500/20 bg-blue-500/10'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <Sparkles className="w-4 h-4 mt-0.5 text-white/80 shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-white">{insight.title}</p>
                      <p className="text-xs text-neutral-200/85 leading-relaxed mt-1">{insight.body}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="custom-scrollbar space-y-5 md:col-span-2 xl:col-span-1 xl:sticky xl:top-24 xl:max-h-[calc(100vh-120px)] xl:overflow-y-auto xl:pr-1">
          <Card className="space-y-4 border-white/5 bg-neutral-900/40 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="mb-2 text-[10px] font-black uppercase tracking-[0.35em] text-neutral-600">{t('pos.quick.label')}</p>
                <h2 className="text-white font-bold text-lg">{t('pos.quick.title')}</h2>
                <p className="mt-2 text-xs text-neutral-500">
                  {operationMode === 'retail'
                    ? 'Atajos para caja y atencion mostrador.'
                    : 'Atajos para pedido recurrente y cierre mayorista.'}
                </p>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center">
                <Command className="w-5 h-5 text-neutral-300" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="secondary"
                className="h-12 gap-2"
                onClick={applyQuickDiscount}
                disabled={subtotal <= 0 || operationMode === 'wholesale'}
              >
                <BadgeDollarSign className="w-4 h-4" />
                {operationMode === 'wholesale' ? 'Precio neto' : t('pos.quick.discount')}
              </Button>
              <Button variant="secondary" className="h-12 gap-2" onClick={setGuestCheckout}>
                <UserRound className="w-4 h-4" />
                {t('pos.quick.guest')}
              </Button>
              <Button variant="secondary" className="h-12 gap-2" onClick={clearCart} disabled={cart.length === 0}>
                <Eraser className="w-4 h-4" />
                {t('pos.quick.clear')}
              </Button>
              <Button variant="secondary" className="h-12 gap-2" onClick={handleDuplicateLastSale} disabled={!latestPOSOrder || isDuplicating}>
                <Copy className="w-4 h-4" />
                {isDuplicating ? t('common.processing') : t('pos.quick.duplicate')}
              </Button>
            </div>
          </Card>

          <Card className="space-y-5 border-white/5 bg-neutral-900/40 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="mb-2 text-[10px] font-black uppercase tracking-[0.35em] text-neutral-600">{t('pos.cash.label')}</p>
                <h2 className="text-white font-bold text-lg">{t('pos.cash.title')}</h2>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-emerald-400" />
              </div>
            </div>

            {cashSessionAccessUnavailable && (
              <div className="p-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-200 text-sm flex gap-3">
                <ShieldAlert className="w-5 h-5 shrink-0" />
                <span>{t('pos.cash.safe_fallback')}</span>
              </div>
            )}

            {cashSessionError && (
              <div className="p-4 rounded-2xl border border-red-500/20 bg-red-500/10 text-red-300 text-sm flex gap-3">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>{cashSessionError}</span>
              </div>
            )}

            {activeCashSession ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
                  <p className="mb-1 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300/80">{t('pos.cash.open_session')}</p>
                  <p className="text-white font-bold">{activeCashSession.openedByName || 'POS Operator'}</p>
                  <p className="text-xs text-neutral-300 mt-1">
                    {t('pos.cash.opened_with', { amount: formatCurrency(activeCashSession.openingCash || 0) })}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                    <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600">{t('pos.cash.turn_sales')}</p>
                    <p className="text-white font-mono">{formatCurrency(turnSalesTotal)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                    <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600">{t('pos.cash.cash_expected')}</p>
                    <p className="text-white font-mono">{formatCurrency(expectedCash)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                    <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600">{t('pos.cash.sales_count')}</p>
                    <p className="text-white">{currentTurnOrders.length}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                    <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600">{t('pos.cash.cash_sales')}</p>
                    <p className="text-white font-mono">{formatCurrency(turnCashTotal)}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{t('pos.cash.closing_notes')}</Label>
                  <textarea
                    value={closingNotes}
                    onChange={(event) => setClosingNotes(event.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all min-h-[90px]"
                    placeholder={t('pos.cash.closing_placeholder')}
                  />
                </div>

                <Button className="w-full h-12" onClick={handleCloseCashSession} disabled={isCashLoading || cashSessionAccessUnavailable}>
                  {isCashLoading ? t('pos.cash.closing') : t('pos.cash.close')}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {!cashSessionAccessUnavailable && (
                  <div className="space-y-2">
                    <Label>{t('pos.cash.opening_cash')}</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={openingCashInput}
                      onChange={(event) => setOpeningCashInput(event.target.value)}
                      placeholder="100.00"
                    />
                  </div>
                )}
                <Button className="w-full h-12" onClick={handleOpenCashSession} disabled={isCashLoading || cashSessionAccessUnavailable}>
                  {isCashLoading ? t('pos.cash.opening') : t('pos.cash.open')}
                </Button>
              </div>
            )}
          </Card>

          <Card className="space-y-6 border-white/5 bg-neutral-900/40 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="mb-2 text-[10px] font-black uppercase tracking-[0.35em] text-neutral-600">{t('pos.checkout.label')}</p>
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
              {operationMode === 'wholesale' && (
                <p className="text-[11px] text-amber-300">Requerido para ventas por volumen.</p>
              )}
              <div className="relative">
                <UserRound className="w-4 h-4 text-neutral-600 absolute left-3 top-1/2 -translate-y-1/2" />
                <select
                  aria-label="Cliente de la venta"
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
              {customerId && (() => {
                const c = customers.find(x => x.id === customerId);
                if (!c) return null;
                const RFM_COLORS: Record<string, string> = {
                  champion: 'border-violet-400/20 bg-violet-500/10 text-violet-300',
                  loyal: 'border-blue-400/20 bg-blue-500/10 text-blue-300',
                  at_risk: 'border-amber-400/20 bg-amber-500/10 text-amber-300',
                  promising: 'border-emerald-400/20 bg-emerald-500/10 text-emerald-300',
                  lost: 'border-red-400/20 bg-red-500/10 text-red-300',
                  new: 'border-sky-400/20 bg-sky-500/10 text-sky-300',
                };
                const lastOrder = c.lastOrderAt?.toDate ? c.lastOrderAt.toDate() : (c.lastOrderAt ? new Date(c.lastOrderAt) : null);
                const daysSince = lastOrder ? Math.floor((Date.now() - lastOrder.getTime()) / 86400000) : null;
                return (
                  <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-white truncate">{c.name}</p>
                      {c.rfmTier && (
                        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${RFM_COLORS[c.rfmTier] || 'border-white/10 bg-white/5 text-neutral-400'}`}>
                          {c.rfmTier}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-xl bg-white/[0.03] px-2 py-2">
                        <p className="text-[10px] text-neutral-500">Pedidos</p>
                        <p className="text-sm font-bold text-white">{c.totalOrders ?? '—'}</p>
                      </div>
                      <div className="rounded-xl bg-white/[0.03] px-2 py-2">
                        <p className="text-[10px] text-neutral-500">Gastado</p>
                        <p className="text-sm font-bold text-white">{c.totalSpent != null ? formatCurrency(c.totalSpent) : '—'}</p>
                      </div>
                      <div className="rounded-xl bg-white/[0.03] px-2 py-2">
                        <p className="text-[10px] text-neutral-500">Último</p>
                        <p className="text-sm font-bold text-white">{daysSince !== null ? `${daysSince}d` : '—'}</p>
                      </div>
                    </div>
                    {c.phone && (
                      <a
                        href={`https://wa.me/${c.phone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-400/15 bg-emerald-500/8 py-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300 transition-colors hover:bg-emerald-500/14"
                      >
                        <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                        WhatsApp
                      </a>
                    )}
                  </div>
                );
              })()}
              <p className="text-[11px] text-neutral-500">{t('pos.checkout.current_customer', { customerName })}</p>
            </div>

            <div className="space-y-2">
              <Label>{t('pos.checkout.payment_method')}</Label>
              <div className="grid grid-cols-2 gap-2">
                {availablePaymentMethods.map((method) => (
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

            <div className="space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{t('pos.summary.discount')}</Label>
                  <div className="flex rounded-xl border border-white/10 bg-black/30 p-0.5">
                    {(['fixed', 'pct'] as const).map(type => (
                      <button
                        key={type}
                        onClick={() => { setDiscountType(type); setDiscountInput('0'); }}
                        className={cn(
                          'rounded-[9px] px-3 py-1 text-[10px] font-bold uppercase tracking-wide transition-all',
                          discountType === type
                            ? 'bg-white/10 text-white'
                            : 'text-neutral-600 hover:text-neutral-400'
                        )}
                      >
                        {type === 'fixed' ? '$' : '%'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-1.5">
                  {discountType === 'pct'
                    ? [5, 10, 15, 20].map(pct => (
                        <button
                          key={pct}
                          onClick={() => setDiscountInput(String(pct))}
                          className={cn(
                            'flex-1 rounded-xl border py-2 text-[11px] font-bold transition-all',
                            discountInput === String(pct)
                              ? 'border-blue-400/30 bg-blue-500/15 text-blue-200'
                              : 'border-white/8 bg-white/[0.03] text-neutral-500 hover:text-white'
                          )}
                        >
                          {pct}%
                        </button>
                      ))
                    : null}
                </div>
                <Input
                  type="number"
                  min="0"
                  step={discountType === 'pct' ? '1' : '0.01'}
                  max={discountType === 'pct' ? '100' : undefined}
                  value={discountInput}
                  onChange={(event) => setDiscountInput(event.target.value)}
                  placeholder={discountType === 'pct' ? '0' : '0.00'}
                  className="h-11 bg-black/40 border-white/10"
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
                  className="h-11 bg-black/40 border-white/10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('pos.checkout.receipt_message')}</Label>
              <Input
                value={receiptFooterMessage}
                onChange={(event) => setReceiptFooterMessage(event.target.value)}
                placeholder={t('pos.checkout.receipt_placeholder')}
              />
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-500">Modo</span>
                <span className="text-white font-mono uppercase">{operationMode}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-500">Unidades</span>
                <span className="text-white font-mono">{cartUnits}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-500">{t('pos.summary.subtotal')}</span>
                <span className="text-white font-mono">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-500">
                  {t('pos.summary.discount')}
                  {discountType === 'pct' && discountRaw > 0 && <span className="ml-1 text-[10px] text-neutral-600">({discountRaw}%)</span>}
                </span>
                <span className={cn('font-mono', discount > 0 ? 'text-emerald-300' : 'text-white')}>
                  {discount > 0 ? `- ${formatCurrency(discount)}` : formatCurrency(0)}
                </span>
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
              disabled={cart.length === 0 || hasCartStockIssue || isSubmitting}
              onClick={handleCompleteSale}
            >
              <BadgeDollarSign className="w-4 h-4 mr-2" />
              {isSubmitting ? t('pos.checkout.processing') : t('pos.checkout.complete_sale')}
            </Button>
          </Card>

          <Card className="space-y-5 border-white/5 bg-neutral-900/40 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="mb-2 text-[10px] font-black uppercase tracking-[0.35em] text-neutral-600">{t('pos.integrations.label')}</p>
                <h3 className="text-white font-bold text-lg">{t('pos.integrations.title')}</h3>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center">
                <Store className="w-5 h-5 text-neutral-400" />
              </div>
            </div>
            <div className="space-y-3">
              {INTEGRATION_ROADMAP.map((integration) => (
                <div
                  key={integration}
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <CreditCard className="w-4 h-4 text-neutral-500" />
                    <span className="text-sm font-medium text-neutral-200">{integration}</span>
                  </div>
                  <span className="text-[10px] uppercase tracking-[0.2em] text-neutral-600 font-bold">{t('pos.integrations.pending')}</span>
                </div>
              ))}
            </div>
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.01] p-4 flex items-center gap-3 text-neutral-500 text-xs">
              <Printer className="w-4 h-4" />
              Manual tenders are live now. Hardware connectors stay in roadmap until certified.
            </div>
          </Card>
        </div>
      </div>

      {/* Barcode Scanner Modal */}
      <AnimatePresence>
        {isScannerOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 backdrop-blur-lg p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-[rgba(6,8,12,0.97)] p-5 shadow-2xl"
            >
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-white">Escanear código</p>
                  <p className="text-xs text-neutral-500">Apunta la cámara al código de barras del producto</p>
                </div>
                <button onClick={closeScanner} className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 text-neutral-500 hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black" style={{ aspectRatio: '4/3' }}>
                <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
                {/* Scanning frame overlay */}
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="relative h-40 w-64">
                    <div className="absolute left-0 top-0 h-6 w-6 rounded-tl-lg border-l-2 border-t-2 border-blue-400" />
                    <div className="absolute right-0 top-0 h-6 w-6 rounded-tr-lg border-r-2 border-t-2 border-blue-400" />
                    <div className="absolute bottom-0 left-0 h-6 w-6 rounded-bl-lg border-b-2 border-l-2 border-blue-400" />
                    <div className="absolute bottom-0 right-0 h-6 w-6 rounded-br-lg border-b-2 border-r-2 border-blue-400" />
                    <motion.div
                      animate={{ y: [0, 112, 0] }}
                      transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                      className="absolute inset-x-0 h-[2px] bg-blue-400/70 shadow-[0_0_8px_rgba(96,165,250,0.8)]"
                    />
                  </div>
                </div>
              </div>

              {scannerError && (
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
                  <p className="text-xs text-red-300">{scannerError}</p>
                </div>
              )}

              <p className="mt-3 text-center text-[10px] text-neutral-600">
                Se requiere permiso de cámara · Busca por SKU o ID de producto
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
