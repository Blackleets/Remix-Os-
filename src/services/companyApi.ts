import { auth } from '../lib/firebase';
import { CopilotRequestError } from './gemini';

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
    const raw = await response.text();
    let parsed: any = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
    if (parsed) {
      throw new CopilotRequestError(
        parsed.error || `Request failed (${response.status})`,
        response.status,
        parsed.code,
        parsed.details
      );
    }
    throw new CopilotRequestError(raw || `Request failed (${response.status})`, response.status);
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
