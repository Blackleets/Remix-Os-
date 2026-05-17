import test from 'node:test';
import assert from 'node:assert/strict';
import {
  roundMoney,
  calculateInvoiceItem,
  calculateInvoiceTotals,
  formatInvoiceNumber,
  isInvoiceEditable,
  canDeleteInvoice,
  isFinalStatus,
  nextStatus,
} from './invoices.ts';

test('roundMoney avoids float drift', () => {
  assert.equal(roundMoney(0.1 + 0.2), 0.3);
  assert.equal(roundMoney(1.005), 1.01);
  assert.equal(roundMoney(2.675), 2.68);
  assert.equal(roundMoney(NaN), 0);
  assert.equal(roundMoney(Infinity), 0);
});

test('calculateInvoiceItem: plain line', () => {
  const item = calculateInvoiceItem({ name: 'A', quantity: 3, unitPrice: 10 });
  assert.equal(item.subtotal, 30);
  assert.equal(item.discountAmount, 0);
  assert.equal(item.taxBase, 30);
  assert.equal(item.taxTotal, 0);
  assert.equal(item.total, 30);
});

test('calculateInvoiceItem: discount then tax (order matters)', () => {
  // 2 x 100 = 200; 10% discount = 20; base 180; 21% IVA = 37.8; total 217.8
  const item = calculateInvoiceItem({
    name: 'B',
    quantity: 2,
    unitPrice: 100,
    discountRate: 0.1,
    taxRate: 21,
  });
  assert.equal(item.subtotal, 200);
  assert.equal(item.discountAmount, 20);
  assert.equal(item.taxBase, 180);
  assert.equal(item.taxTotal, 37.8);
  assert.equal(item.total, 217.8);
});

test('calculateInvoiceItem: clamps negative + over-100% discount', () => {
  const item = calculateInvoiceItem({
    name: 'C',
    quantity: -5,
    unitPrice: -10,
    discountRate: 2,
    taxRate: -8,
  });
  assert.equal(item.quantity, 0);
  assert.equal(item.unitPrice, 0);
  assert.equal(item.total, 0);
  assert.ok(item.total >= 0, 'total never negative');
});

test('calculateInvoiceItem: assigns an id when missing', () => {
  const item = calculateInvoiceItem({ name: 'D', quantity: 1, unitPrice: 1 });
  assert.ok(typeof item.id === 'string' && item.id.length > 0);
});

test('calculateInvoiceTotals aggregates rounded per-line', () => {
  const { totals } = calculateInvoiceTotals([
    { name: 'x', quantity: 3, unitPrice: 9.99, taxRate: 21 },
    { name: 'y', quantity: 1, unitPrice: 0.01, taxRate: 0 },
  ]);
  // line1: 29.97 base, 6.29 tax, 36.26 ; line2: 0.01
  assert.equal(totals.subtotal, 29.98);
  assert.equal(totals.taxTotal, 6.29);
  assert.equal(totals.total, 36.27);
});

test('calculateInvoiceTotals on empty list is all zeros', () => {
  const { totals, items } = calculateInvoiceTotals([]);
  assert.deepEqual(totals, { subtotal: 0, discountTotal: 0, taxTotal: 0, total: 0 });
  assert.equal(items.length, 0);
});

test('formatInvoiceNumber pads and sanitizes series', () => {
  assert.equal(formatInvoiceNumber('A', 7), 'A-0007');
  assert.equal(formatInvoiceNumber('a', 7), 'A-0007');
  assert.equal(formatInvoiceNumber('FY25', 1234), 'FY25-1234');
  assert.equal(formatInvoiceNumber('b@d!', 3), 'BD-0003');
  assert.equal(formatInvoiceNumber('', 0), 'A-0000');
});

test('editability + deletability gated to draft', () => {
  assert.equal(isInvoiceEditable('draft'), true);
  assert.equal(isInvoiceEditable('issued'), false);
  assert.equal(isInvoiceEditable('paid'), false);
  assert.equal(canDeleteInvoice('draft'), true);
  assert.equal(canDeleteInvoice('issued'), false);
});

test('isFinalStatus', () => {
  assert.equal(isFinalStatus('paid'), true);
  assert.equal(isFinalStatus('cancelled'), true);
  assert.equal(isFinalStatus('issued'), false);
});

test('nextStatus enforces the state machine', () => {
  assert.equal(nextStatus('draft', 'issued'), 'issued');
  assert.equal(nextStatus('draft', 'paid'), null);
  assert.equal(nextStatus('issued', 'paid'), 'paid');
  assert.equal(nextStatus('paid', 'issued'), null);
  assert.equal(nextStatus('cancelled', 'issued'), null);
  assert.equal(nextStatus('overdue', 'paid'), 'paid');
});
