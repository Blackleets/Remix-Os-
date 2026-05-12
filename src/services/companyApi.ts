import { auth } from '../lib/firebase';

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

export async function fetchCompanyOverview(companyId: string) {
  return authedFetchJSON('/api/company/overview', { companyId });
}

export async function fetchPlatformOverview() {
  return authedFetchJSON('/api/platform/overview', {});
}

export async function syncPlatformStats() {
  return authedFetchJSON('/api/platform/stats/sync', {});
}

export async function syncPlatformBilling(companyId?: string | null) {
  return authedFetchJSON('/api/platform/billing/sync', {
    companyId: companyId || null,
  });
}
