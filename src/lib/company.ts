export const COMPANY_VERTICAL_OPTIONS = [
  { value: 'beauty', label: 'Belleza' },
  { value: 'restaurant', label: 'Restaurante' },
  { value: 'retail', label: 'Retail' },
  { value: 'services', label: 'Servicios' },
  { value: 'wellness', label: 'Wellness' },
] as const;

export type CompanyVertical = typeof COMPANY_VERTICAL_OPTIONS[number]['value'];

const FALLBACK_VERTICAL: CompanyVertical = 'retail';

const LEGACY_VERTICAL_MAP: Record<string, CompanyVertical> = {
  belleza: 'beauty',
  beauty: 'beauty',
  restaurante: 'restaurant',
  restaurant: 'restaurant',
  retail: 'retail',
  servicios: 'services',
  services: 'services',
  service: 'services',
  wellness: 'wellness',
};

export function normalizeCompanyVertical(value?: string | null): CompanyVertical {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();

  return LEGACY_VERTICAL_MAP[normalized] || FALLBACK_VERTICAL;
}

export function getCompanyVerticalLabel(value?: string | null) {
  const vertical = normalizeCompanyVertical(value);
  return COMPANY_VERTICAL_OPTIONS.find((option) => option.value === vertical)?.label || 'Retail';
}
