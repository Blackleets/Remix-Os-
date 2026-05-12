export type PlanId = 'starter' | 'pro' | 'business';

export interface PlanLimits {
  customers: number;
  products: number;
  orders: number;
  seats: number;
}

export interface PlanDefinition {
  id: PlanId;
  name: string;
  monthlyPrice: number;
  currency: string;
  limits: PlanLimits;
  aiLevel: 'basic' | 'advanced';
}

export const BILLING_CURRENCY = 'USD';

export const PLAN_DEFINITIONS: Record<PlanId, PlanDefinition> = {
  starter: {
    id: 'starter',
    name: 'Starter Node',
    monthlyPrice: 19,
    currency: BILLING_CURRENCY,
    limits: {
      customers: 50,
      products: 20,
      orders: 100,
      seats: 1,
    },
    aiLevel: 'basic',
  },
  pro: {
    id: 'pro',
    name: 'Pro Protocol',
    monthlyPrice: 49,
    currency: BILLING_CURRENCY,
    limits: {
      customers: 500,
      products: 200,
      orders: 1000,
      seats: 3,
    },
    aiLevel: 'advanced',
  },
  business: {
    id: 'business',
    name: 'Business Core',
    monthlyPrice: 99,
    currency: BILLING_CURRENCY,
    limits: {
      customers: Infinity,
      products: Infinity,
      orders: Infinity,
      seats: Infinity,
    },
    aiLevel: 'advanced',
  },
};

export const PLAN_IDS = Object.keys(PLAN_DEFINITIONS) as PlanId[];

export function getPlanDefinition(planId?: string | null): PlanDefinition {
  if (!planId || !(planId in PLAN_DEFINITIONS)) {
    return PLAN_DEFINITIONS.starter;
  }
  return PLAN_DEFINITIONS[planId as PlanId];
}

export function getBillingPriceMap() {
  return PLAN_IDS.reduce((acc, planId) => {
    const plan = PLAN_DEFINITIONS[planId];
    acc[planId] = {
      amount: plan.monthlyPrice,
      currency: plan.currency,
    };
    return acc;
  }, {} as Record<PlanId, { amount: number; currency: string }>);
}
