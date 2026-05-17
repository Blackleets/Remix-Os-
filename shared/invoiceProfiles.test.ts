import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INVOICE_COUNTRY_PROFILES,
  COUNTRY_PROFILE_ORDER,
  getCountryProfile,
  formatInvoiceCurrency,
} from './invoiceProfiles.ts';
import type { CountryProfileId } from './invoices.ts';

const ALL_IDS: CountryProfileId[] = ['ES', 'MX', 'US', 'EU_GENERIC', 'LATAM_GENERIC'];

test('every expected country profile exists with consistent id', () => {
  for (const id of ALL_IDS) {
    const p = INVOICE_COUNTRY_PROFILES[id];
    assert.ok(p, `profile ${id} must exist`);
    assert.equal(p.id, id, `profile.id must match its key (${id})`);
    assert.ok(p.currency.length === 3, `${id} currency should be ISO 4217`);
    assert.ok(p.commonTaxRates.includes(p.defaultTaxRate), `${id} defaultTaxRate must be in commonTaxRates`);
    assert.ok(p.paperSize === 'a4' || p.paperSize === 'letter');
  }
});

test('COUNTRY_PROFILE_ORDER lists exactly the 5 supported profiles', () => {
  assert.deepEqual([...COUNTRY_PROFILE_ORDER].sort(), [...ALL_IDS].sort());
});

test('getCountryProfile returns the right profile per id', () => {
  for (const id of ALL_IDS) {
    assert.equal(getCountryProfile(id).id, id);
  }
});

test('getCountryProfile falls back to ES for unknown/empty input', () => {
  assert.equal(getCountryProfile(undefined).id, 'ES');
  assert.equal(getCountryProfile(null).id, 'ES');
  assert.equal(getCountryProfile('').id, 'ES');
  assert.equal(getCountryProfile('ZZ').id, 'ES');
  // @ts-expect-error intentional wrong type
  assert.equal(getCountryProfile(123).id, 'ES');
});

test('formatInvoiceCurrency never throws and is non-empty for any numeric input', () => {
  for (const id of ALL_IDS) {
    const p = INVOICE_COUNTRY_PROFILES[id];
    for (const v of [0, 1234.5, -99.99, 0.005, Number.NaN, Infinity]) {
      const out = formatInvoiceCurrency(v, p);
      assert.equal(typeof out, 'string');
      assert.ok(out.length > 0, `formatInvoiceCurrency(${v}) for ${id} should be non-empty`);
    }
  }
});

test('formatInvoiceCurrency reflects the profile currency', () => {
  // es-ES EUR renders the euro sign or the EUR code depending on the runtime ICU.
  const es = formatInvoiceCurrency(10, INVOICE_COUNTRY_PROFILES.ES);
  assert.ok(/€|EUR/.test(es), `ES currency output unexpected: ${es}`);
  const us = formatInvoiceCurrency(10, INVOICE_COUNTRY_PROFILES.US);
  assert.ok(/\$|USD/.test(us), `US currency output unexpected: ${us}`);
});

// --- Compliance invariant (goal principle #12) -----------------------------
// Each warning must read as a *commercial-only disclaimer that requires a
// provider*, and must NEVER make an affirmative fiscal-compliance claim.
// NOTE: the regexes target affirmative CLAIM constructions only — the real
// warnings legitimately contain words like "certificada" inside
// "...certificada requieren conectar un proveedor", which is a disclaimer,
// not a claim, and must NOT trip the test.
const CLAIM_PATTERNS: RegExp[] = [
  /\bcumple\b/i,                       // "cumple Verifactu/SAT"
  /\bcompliant\b/i,                    // "Verifactu compliant"
  /cfdi\s+v[aá]lido/i,                 // "CFDI válido"
  /cumplimiento\s+fiscal\s+garantizad/i, // "cumplimiento fiscal garantizado"
  /garantiza(?:mos)?\s+(?:el\s+)?cumplimiento/i,
  /certificad[ao]\s+y\s+(?:v[aá]lid|legal)/i,
];

const DISCLAIMER_HINTS = /requiere|requieren|connect|plug in|provider|proveedor|integraci|vary|var[ií]an|differ/i;
const COMMERCIAL_HINT = /comercial|commercial/i;

test('every profile warning is a commercial-only disclaimer (no fiscal claims)', () => {
  for (const id of ALL_IDS) {
    const w = INVOICE_COUNTRY_PROFILES[id].warning;
    assert.ok(w && w.length > 0, `${id} must have a warning`);
    assert.ok(COMMERCIAL_HINT.test(w), `${id} warning must state it is a commercial document: "${w}"`);
    assert.ok(DISCLAIMER_HINTS.test(w), `${id} warning must say certification requires a provider: "${w}"`);
    for (const claim of CLAIM_PATTERNS) {
      assert.ok(!claim.test(w), `${id} warning must NOT assert fiscal compliance (${claim}): "${w}"`);
    }
  }
});
