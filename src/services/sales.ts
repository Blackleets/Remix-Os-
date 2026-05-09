import {
  collection,
  doc,
  increment,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface SaleItemInput {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
}

interface SaleMessageOptions {
  productNotFound?: (name: string) => string;
  insufficientStock?: (name: string, count: number) => string;
}

export interface CreateSaleTransactionInput {
  companyId: string;
  customerId?: string | null;
  customerName: string;
  paymentMethod: string;
  items: SaleItemInput[];
  subtotal: number;
  discount?: number;
  tax?: number;
  total: number;
  channel?: string;
  status?: 'pending' | 'completed' | 'cancelled';
  movementReason?: string;
  activityTitle?: string;
  messages?: SaleMessageOptions;
}

export interface CreateSaleTransactionResult {
  orderId: string;
  createdAt: Date;
}

export async function createSaleTransaction(
  input: CreateSaleTransactionInput
): Promise<CreateSaleTransactionResult> {
  const {
    companyId,
    customerId,
    customerName,
    paymentMethod,
    items,
    subtotal,
    discount = 0,
    tax = 0,
    total,
    channel = 'manual',
    status = 'completed',
    movementReason = 'Sale',
    activityTitle = 'Order Confirmed',
    messages,
  } = input;

  if (!companyId) {
    throw new Error('Company ID is required.');
  }

  if (items.length === 0) {
    throw new Error('At least one sale item is required.');
  }

  const aggregatedByProduct = new Map<string, SaleItemInput>();
  for (const item of items) {
    const existing = aggregatedByProduct.get(item.productId);
    if (existing) {
      existing.quantity += item.quantity;
    } else {
      aggregatedByProduct.set(item.productId, { ...item });
    }
  }
  const aggregatedItems = Array.from(aggregatedByProduct.values());

  const createdAt = new Date();
  const orderRef = doc(collection(db, 'orders'));

  await runTransaction(db, async (transaction) => {
    const productRefs = aggregatedItems.map((item) => doc(db, 'products', item.productId));
    const productSnaps = await Promise.all(productRefs.map((ref) => transaction.get(ref)));
    const customerRef = customerId ? doc(db, 'customers', customerId) : null;
    const customerSnap = customerRef ? await transaction.get(customerRef) : null;

    for (let index = 0; index < aggregatedItems.length; index += 1) {
      const item = aggregatedItems[index];
      const snap = productSnaps[index];

      if (!snap.exists()) {
        throw new Error(
          messages?.productNotFound?.(item.productName) || `Product ${item.productName} not found.`
        );
      }

      const currentStock = snap.data().stockLevel || 0;
      if (currentStock < item.quantity) {
        throw new Error(
          messages?.insufficientStock?.(snap.data().name || item.productName, currentStock) ||
            `Insufficient stock for ${snap.data().name || item.productName}. Available: ${currentStock}`
        );
      }
    }

    transaction.set(orderRef, {
      companyId,
      customerId: customerId || '',
      customerName,
      paymentMethod,
      status,
      subtotal,
      discount,
      tax,
      total,
      totalAmount: total,
      itemCount: aggregatedItems.reduce((sum, item) => sum + item.quantity, 0),
      channel,
      createdAt: serverTimestamp(),
    });

    for (const item of aggregatedItems) {
      const itemRef = doc(collection(db, 'orders', orderRef.id, 'items'));
      transaction.set(itemRef, {
        orderId: orderRef.id,
        ...item,
        companyId,
        createdAt: serverTimestamp(),
      });

      const productRef = doc(db, 'products', item.productId);
      transaction.update(productRef, {
        stockLevel: increment(-item.quantity),
      });

      const movementRef = doc(collection(db, 'inventoryMovements'));
      transaction.set(movementRef, {
        companyId,
        orderId: orderRef.id,
        productId: item.productId,
        productName: item.productName,
        type: 'out',
        quantity: item.quantity,
        reason: movementReason,
        createdAt: serverTimestamp(),
      });
    }

    if (customerRef && customerSnap?.exists()) {
        const customerData = customerSnap.data();
        const newTotalSpent = (customerData.totalSpent || 0) + total;
        const newTotalOrders = (customerData.totalOrders || 0) + 1;

        let segment = 'regular';
        if (newTotalSpent > 5000) segment = 'whale';
        else if (newTotalSpent > 1000) segment = 'vip';
        else if (newTotalOrders === 1) segment = 'new';

        transaction.update(customerRef, {
          totalSpent: newTotalSpent,
          totalOrders: newTotalOrders,
          lastOrderAt: serverTimestamp(),
          segment,
        });
    }

    const activityRef = doc(collection(db, 'activities'));
    transaction.set(activityRef, {
      companyId,
      orderId: orderRef.id,
      type: 'order_create',
      title: activityTitle,
      subtitle: `${customerName} purchased items ($${total.toFixed(2)})`,
      channel,
      createdAt: serverTimestamp(),
    });
  });

  return {
    orderId: orderRef.id,
    createdAt,
  };
}
