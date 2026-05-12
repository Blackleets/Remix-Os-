import { endOfMonth, startOfMonth } from 'date-fns';
import { collection, getDocs, query, Timestamp, where } from 'firebase/firestore';
import { PLAN_DEFINITIONS, type PlanDefinition, type PlanLimits } from '../../shared/plans';
import { auth, db } from './firebase';

export type Plan = PlanDefinition;
export type { PlanLimits };

export const PLANS: Record<string, Plan> = PLAN_DEFINITIONS;

async function authedFetchJSON(url: string, body: Record<string, unknown>) {
  const token = await auth.currentUser?.getIdToken();
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

async function getCompanyUsageFromFirestore(companyId: string) {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const [customersSnap, productsSnap, ordersSnap, teamSnap, invitesSnap] = await Promise.all([
    getDocs(query(collection(db, 'customers'), where('companyId', '==', companyId))),
    getDocs(query(collection(db, 'products'), where('companyId', '==', companyId))),
    getDocs(query(
      collection(db, 'orders'),
      where('companyId', '==', companyId),
      where('createdAt', '>=', Timestamp.fromDate(monthStart)),
      where('createdAt', '<=', Timestamp.fromDate(monthEnd))
    )),
    getDocs(query(collection(db, 'memberships'), where('companyId', '==', companyId))),
    getDocs(query(collection(db, 'invitations'), where('companyId', '==', companyId), where('status', '==', 'pending'))),
  ]);

  return {
    customers: customersSnap.size,
    products: productsSnap.size,
    orders: ordersSnap.size,
    seats: teamSnap.size + invitesSnap.size,
  };
}

export async function getCompanyUsage(companyId: string) {
  try {
    return await authedFetchJSON('/api/company/usage', { companyId });
  } catch (_error) {
    return getCompanyUsageFromFirestore(companyId);
  }
}

export function isLimitReached(usage: number, limit: number) {
  if (limit === Infinity) return false;
  return usage >= limit;
}
