import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PLAN_DEFINITIONS,
  PLAN_IDS,
  BILLING_CURRENCY,
  getPlanDefinition,
  getBillingPriceMap,
  type PlanId,
} from './plans.ts';

const IDS: PlanId[] = ['starter', 'pro', 'business'];
const LIMIT_KEYS = ['customers', 'products', 'orders', 'seats'] as const;

test('PLAN_IDS lists exactly the three plans', () => {
  assert.deepEqual([...PLAN_IDS].sort(), [...IDS].sort());
});

test('each plan definition is internally consistent', () => {
  for (const id of IDS) {
    const p = PLAN_DEFINITIONS[id];
    assert.ok(p, `plan ${id} must exist`);
    assert.equal(p.id, id, `plan.id must match its key (${id})`);
    assert.equal(p.currency, BILLING_CURRENCY);
    assert.ok(p.monthlyPrice >= 0);
    assert.ok(p.aiLevel === 'basic' || p.aiLevel === 'advanced');
    for (const k of LIMIT_KEYS) {
      assert.ok(typeof p.limits[k] === 'number', `${id}.limits.${k} numeric`);
      assert.ok(p.limits[k] > 0, `${id}.limits.${k} positive`);
    }
  }
});

test('limits are monotonic starter <= pro <= business', () => {
  for (const k of LIMIT_KEYS) {
    assert.ok(
      PLAN_DEFINITIONS.starter.limits[k] <= PLAN_DEFINITIONS.pro.limits[k],
      `starter.${k} <= pro.${k}`
    );
    assert.ok(
      PLAN_DEFINITIONS.pro.limits[k] <= PLAN_DEFINITIONS.business.limits[k],
      `pro.${k} <= business.${k}`
    );
  }
});

test('business plan is the unlimited tier (override invariant)', () => {
  for (const k of LIMIT_KEYS) {
    assert.equal(
      PLAN_DEFINITIONS.business.limits[k],
      Infinity,
      `business.${k} must be Infinity — the internal-testing override relies on this`
    );
  }
});

test('getPlanDefinition returns the right plan for valid ids', () => {
  for (const id of IDS) {
    assert.equal(getPlanDefinition(id).id, id);
  }
});

test('getPlanDefinition falls back to starter for invalid/empty input', () => {
  assert.equal(getPlanDefinition(undefined).id, 'starter');
  assert.equal(getPlanDefinition(null).id, 'starter');
  assert.equal(getPlanDefinition('').id, 'starter');
  assert.equal(getPlanDefinition('enterprise').id, 'starter');
  // @ts-expect-error intentional wrong type
  assert.equal(getPlanDefinition(42).id, 'starter');
});

test('getPlanDefinition is not fooled by Object.prototype keys', () => {
  // Regression: `planId in PLAN_DEFINITIONS` matched inherited keys and
  // returned undefined, crashing callers that read plan.limits.*.
  for (const proto of ['toString', 'constructor', 'hasOwnProperty', '__proto__']) {
    const plan = getPlanDefinition(proto);
    assert.ok(plan && typeof plan.limits?.customers === 'number',
      `getPlanDefinition('${proto}') must return a real plan, got ${JSON.stringify(plan)}`);
    assert.equal(plan.id, 'starter');
  }
});

test('getBillingPriceMap mirrors each plan price/currency', () => {
  const map = getBillingPriceMap();
  assert.deepEqual([...Object.keys(map)].sort(), [...IDS].sort());
  for (const id of IDS) {
    assert.equal(map[id].amount, PLAN_DEFINITIONS[id].monthlyPrice);
    assert.equal(map[id].currency, BILLING_CURRENCY);
  }
});
