
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import { startOfMonth, endOfMonth } from 'date-fns';

export interface PlanLimits {
  customers: number;
  products: number;
  orders: number;
  seats: number;
}

export interface Plan {
  id: 'starter' | 'pro' | 'business';
  name: string;
  limits: PlanLimits;
  aiLevel: 'basic' | 'advanced';
}

export const PLANS: Record<string, Plan> = {
  starter: {
    id: 'starter',
    name: 'Starter Node',
    limits: {
      customers: 50,
      products: 20,
      orders: 100,
      seats: 1, // Only the owner
    },
    aiLevel: 'basic',
  },
  pro: {
    id: 'pro',
    name: 'Pro Protocol',
    limits: {
      customers: 500,
      products: 200,
      orders: 1000,
      seats: 3, // Owner + 2 others
    },
    aiLevel: 'advanced',
  },
  business: {
    id: 'business',
    name: 'Business Core',
    limits: {
      customers: Infinity,
      products: Infinity,
      orders: Infinity,
      seats: Infinity,
    },
    aiLevel: 'advanced',
  },
};

export async function getCompanyUsage(companyId: string) {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const [customersSnap, productsSnap, ordersSnap, teamSnap, invitesSnap] = await Promise.all([
    getDocs(query(collection(db, 'customers'), where('companyId', '==', companyId))),
    getDocs(query(collection(db, 'products'), where('companyId', '==', companyId))),
    getDocs(query(collection(db, 'orders'), 
      where('companyId', '==', companyId),
      where('createdAt', '>=', Timestamp.fromDate(monthStart)),
      where('createdAt', '<=', Timestamp.fromDate(monthEnd))
    )),
    getDocs(query(collection(db, 'memberships'), where('companyId', '==', companyId))),
    getDocs(query(collection(db, 'invitations'), where('companyId', '==', companyId), where('status', '==', 'pending')))
  ]);

  return {
    customers: customersSnap.size,
    products: productsSnap.size,
    orders: ordersSnap.size,
    seats: teamSnap.size + invitesSnap.size, // Count pending invites too
  };
}

export function isLimitReached(usage: number, limit: number) {
  if (limit === Infinity) return false;
  return usage >= limit;
}
