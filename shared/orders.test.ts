import test from 'node:test';
import assert from 'node:assert/strict';
import { getOrderTotal, getOrderItems } from './orders.ts';

test('getOrderTotal prefers totalAmount over total', () => {
  assert.equal(getOrderTotal({ total: 10, totalAmount: 25 }), 25);
});

test('getOrderTotal falls back to total when totalAmount missing', () => {
  assert.equal(getOrderTotal({ total: 10 }), 10);
});

test('getOrderTotal is 0 for null/undefined/garbage', () => {
  assert.equal(getOrderTotal(null), 0);
  assert.equal(getOrderTotal(undefined), 0);
  assert.equal(getOrderTotal({}), 0);
  assert.equal(getOrderTotal({ total: NaN }), 0);
  assert.equal(getOrderTotal({ totalAmount: Infinity }), 0);
  // @ts-expect-error intentionally wrong type
  assert.equal(getOrderTotal({ total: '50' }), 0);
});

test('getOrderItems prefers itemsSnapshot over items', () => {
  const snap = [{ a: 1 }];
  const items = [{ b: 2 }];
  assert.deepEqual(getOrderItems({ itemsSnapshot: snap, items }), snap);
});

test('getOrderItems falls back to items, then empty array', () => {
  assert.deepEqual(getOrderItems({ items: [{ b: 2 }] }), [{ b: 2 }]);
  assert.deepEqual(getOrderItems({}), []);
  assert.deepEqual(getOrderItems(null), []);
  assert.deepEqual(getOrderItems({ itemsSnapshot: 'not-array' as any }), []);
});
