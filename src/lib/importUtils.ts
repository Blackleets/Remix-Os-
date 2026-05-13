export const MAX_IMPORT_ROWS = 1000;
export const MAX_IMPORT_FILE_SIZE_BYTES = 2 * 1024 * 1024;

export type SupportedImportFormat = 'csv' | 'json';

export interface ParsedImportFile {
  format: SupportedImportFormat;
  headers: string[];
  rows: Array<Record<string, string>>;
}

export interface ImportPreviewRow<T> {
  index: number;
  raw: Record<string, string>;
  normalized?: T;
  issues: string[];
  duplicateKeys: string[];
}

export interface ImportPreview<T> {
  format: SupportedImportFormat;
  fileName: string;
  totalRows: number;
  validRows: number;
  errorRows: number;
  duplicateRows: number;
  rows: Array<ImportPreviewRow<T>>;
}

export interface ProductImportRow {
  name: string;
  sku: string;
  price: number;
  stockLevel: number;
  cost?: number;
  category?: string;
  status: 'active' | 'draft' | 'archived';
  description?: string;
}

export interface CustomerImportRow {
  name: string;
  email: string;
  phone: string;
  segment?: 'whale' | 'vip' | 'regular' | 'new' | 'at_risk';
  status?: string;
  notes?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PRODUCT_STATUSES = new Set(['active', 'draft', 'archived']);
const CUSTOMER_SEGMENTS = new Set(['whale', 'vip', 'regular', 'new', 'at_risk']);

function normalizeCellValue(value: unknown) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function normalizeHeader(header: string) {
  return header.trim();
}

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      cells.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells.map((cell) => cell.trim());
}

export function parseCsvText(text: string) {
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    throw new Error('El archivo está vacío.');
  }

  const headers = splitCsvLine(lines[0]).map(normalizeHeader);
  if (headers.length === 0) {
    throw new Error('No se detectaron columnas en el CSV.');
  }

  const rows = lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = normalizeCellValue(values[index] ?? '');
    });
    return row;
  });

  return { headers, rows };
}

export function parseJsonText(text: string) {
  const parsed = JSON.parse(text);
  const list = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.items)
      ? parsed.items
      : null;

  if (!list) {
    throw new Error('El JSON debe ser un arreglo de objetos o un objeto con "items".');
  }

  const rows = list.map((entry) => {
    const row: Record<string, string> = {};
    Object.entries(entry ?? {}).forEach(([key, value]) => {
      row[normalizeHeader(key)] = normalizeCellValue(value);
    });
    return row;
  });

  const headers = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set<string>())
  ) as string[];

  return { headers, rows };
}

export async function readImportFile(file: File): Promise<ParsedImportFile> {
  if (file.size > MAX_IMPORT_FILE_SIZE_BYTES) {
    throw new Error(`El archivo supera el máximo permitido de ${Math.round(MAX_IMPORT_FILE_SIZE_BYTES / 1024 / 1024)} MB.`);
  }

  const extension = file.name.split('.').pop()?.toLowerCase();
  const text = await file.text();

  if (extension === 'csv') {
    const parsed = parseCsvText(text);
    return { format: 'csv', ...parsed };
  }

  if (extension === 'json') {
    const parsed = parseJsonText(text);
    return { format: 'json', ...parsed };
  }

  throw new Error('Formato no soportado. Usa CSV o JSON.');
}

function parseRequiredNumber(value: string, fieldLabel: string, issues: string[]) {
  const normalized = value.replace(',', '.').trim();
  if (!normalized) {
    issues.push(`${fieldLabel} es obligatorio.`);
    return null;
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    issues.push(`${fieldLabel} debe ser numérico.`);
    return null;
  }
  return parsed;
}

function parseOptionalNumber(value: string, fieldLabel: string, issues: string[]) {
  const normalized = value.replace(',', '.').trim();
  if (!normalized) return undefined;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    issues.push(`${fieldLabel} debe ser numérico.`);
    return undefined;
  }
  return parsed;
}

function normalizeProductStatus(value: string, issues: string[]) {
  if (!value) return 'active' as const;
  const normalized = value.trim().toLowerCase();
  if (!PRODUCT_STATUSES.has(normalized)) {
    issues.push('status debe ser active, draft o archived.');
    return 'active' as const;
  }
  return normalized as ProductImportRow['status'];
}

function normalizeCustomerSegment(value: string, issues: string[]) {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (!CUSTOMER_SEGMENTS.has(normalized)) {
    issues.push('segment debe ser whale, vip, regular, new o at_risk.');
    return undefined;
  }
  return normalized as CustomerImportRow['segment'];
}

function ensureRowLimit<T>(rows: T[]) {
  if (rows.length > MAX_IMPORT_ROWS) {
    throw new Error(`La importación supera el límite inicial de ${MAX_IMPORT_ROWS} filas.`);
  }
}

export function buildProductImportPreview(
  parsed: ParsedImportFile,
  existingSkus: Set<string>
): ImportPreview<ProductImportRow> {
  ensureRowLimit(parsed.rows);

  const seenSkus = new Set<string>();
  let validRows = 0;
  let duplicateRows = 0;

  const rows = parsed.rows.map((raw, index) => {
    const issues: string[] = [];
    const duplicateKeys: string[] = [];
    const name = normalizeCellValue(raw.name);
    const sku = normalizeCellValue(raw.sku);
    const price = parseRequiredNumber(normalizeCellValue(raw.price), 'price', issues);
    const stockLevel = parseRequiredNumber(normalizeCellValue(raw.stockLevel), 'stockLevel', issues);
    const cost = parseOptionalNumber(normalizeCellValue(raw.cost), 'cost', issues);
    const status = normalizeProductStatus(normalizeCellValue(raw.status), issues);

    if (!name) issues.push('name es obligatorio.');
    if (!sku) issues.push('sku es obligatorio.');

    const skuKey = sku.toLowerCase();
    if (skuKey) {
      if (seenSkus.has(skuKey)) {
        duplicateKeys.push(`SKU repetido en el archivo: ${sku}`);
      }
      if (existingSkus.has(skuKey)) {
        duplicateKeys.push(`SKU ya existe en la empresa: ${sku}`);
      }
      seenSkus.add(skuKey);
    }

    const normalized = issues.length === 0
      ? {
          name,
          sku,
          price: price ?? 0,
          stockLevel: stockLevel ?? 0,
          ...(cost !== undefined ? { cost } : {}),
          ...(normalizeCellValue(raw.category) ? { category: normalizeCellValue(raw.category) } : {}),
          status,
          ...(normalizeCellValue(raw.description) ? { description: normalizeCellValue(raw.description) } : {}),
        }
      : undefined;

    if (duplicateKeys.length > 0) duplicateRows += 1;
    if (normalized && duplicateKeys.length === 0) validRows += 1;

    return {
      index: index + 2,
      raw,
      normalized,
      issues,
      duplicateKeys,
    };
  });

  return {
    format: parsed.format,
    fileName: '',
    totalRows: parsed.rows.length,
    validRows,
    errorRows: rows.filter((row) => row.issues.length > 0).length,
    duplicateRows,
    rows,
  };
}

export function buildCustomerImportPreview(
  parsed: ParsedImportFile,
  existingEmails: Set<string>,
  existingPhones: Set<string>
): ImportPreview<CustomerImportRow> {
  ensureRowLimit(parsed.rows);

  const seenEmails = new Set<string>();
  const seenPhones = new Set<string>();
  let validRows = 0;
  let duplicateRows = 0;

  const rows = parsed.rows.map((raw, index) => {
    const issues: string[] = [];
    const duplicateKeys: string[] = [];
    const name = normalizeCellValue(raw.name);
    const email = normalizeCellValue(raw.email).toLowerCase();
    const phone = normalizeCellValue(raw.phone);
    const segment = normalizeCustomerSegment(normalizeCellValue(raw.segment), issues);

    if (!name) issues.push('name es obligatorio.');
    if (email && !EMAIL_REGEX.test(email)) {
      issues.push('email no tiene un formato válido.');
    }

    if (email) {
      if (seenEmails.has(email)) duplicateKeys.push(`Email repetido en el archivo: ${email}`);
      if (existingEmails.has(email)) duplicateKeys.push(`Email ya existe en la empresa: ${email}`);
      seenEmails.add(email);
    }

    if (phone) {
      if (seenPhones.has(phone)) duplicateKeys.push(`Teléfono repetido en el archivo: ${phone}`);
      if (existingPhones.has(phone)) duplicateKeys.push(`Teléfono ya existe en la empresa: ${phone}`);
      seenPhones.add(phone);
    }

    const normalized = issues.length === 0
      ? {
          name,
          email,
          phone,
          ...(segment ? { segment } : {}),
          ...(normalizeCellValue(raw.status) ? { status: normalizeCellValue(raw.status) } : {}),
          ...(normalizeCellValue(raw.notes) ? { notes: normalizeCellValue(raw.notes) } : {}),
        }
      : undefined;

    if (duplicateKeys.length > 0) duplicateRows += 1;
    if (normalized && duplicateKeys.length === 0) validRows += 1;

    return {
      index: index + 2,
      raw,
      normalized,
      issues,
      duplicateKeys,
    };
  });

  return {
    format: parsed.format,
    fileName: '',
    totalRows: parsed.rows.length,
    validRows,
    errorRows: rows.filter((row) => row.issues.length > 0).length,
    duplicateRows,
    rows,
  };
}

export function withImportFileName<T>(preview: ImportPreview<T>, fileName: string): ImportPreview<T> {
  return {
    ...preview,
    fileName,
  };
}

export function downloadCsvTemplate(fileName: string, headers: string[]) {
  const csv = `${headers.join(',')}\n`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}
