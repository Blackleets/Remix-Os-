import { auth } from '../lib/firebase';
import { CopilotRequestError } from './gemini';

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH';
  body?: Record<string, unknown>;
  query?: Record<string, string | number | boolean | null | undefined>;
};

async function authedRequestJSON(url: string, options: RequestOptions = {}) {
  const { method = 'POST', body, query } = options;
  const token = await auth.currentUser?.getIdToken();
  const searchParams = new URLSearchParams();

  Object.entries(query || {}).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return;
    searchParams.set(key, String(value));
  });

  const finalUrl = searchParams.toString() ? `${url}?${searchParams.toString()}` : url;
  const response = await fetch(finalUrl, {
    method,
    headers: {
      ...(method !== 'GET' ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(method !== 'GET' ? { body: JSON.stringify(body || {}) } : {}),
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

async function authedFetchJSON(url: string, body: Record<string, unknown>) {
  return authedRequestJSON(url, { method: 'POST', body });
}

export type PlatformFeedbackStatus = 'open' | 'reviewed' | 'resolved';
export type PlatformFeedbackSeverity = 'low' | 'medium' | 'high' | 'critical';
export type PlatformFeedbackType = 'bug' | 'idea' | 'ux' | 'billing' | 'copilot' | 'other';

export type PlatformFeedbackItem = {
  id: string;
  companyId: string;
  companyName?: string;
  userId: string;
  userEmail: string;
  userName?: string;
  type: PlatformFeedbackType;
  severity: PlatformFeedbackSeverity;
  title: string;
  message: string;
  pagePath: string;
  status: PlatformFeedbackStatus;
  createdAt?: string | number | null;
  updatedAt?: string | number | null;
  reviewedAt?: string | number | null;
  resolvedAt?: string | number | null;
  adminNotes?: string;
  lastUpdatedByAdminUid?: string;
};

export async function fetchCompanyOverview(companyId: string) {
  try {
    console.info('[CompanyOverview] Fetching company overview.', { companyId });
    const overview = await authedFetchJSON('/api/company/overview', { companyId });
    console.info('[CompanyOverview] Company overview loaded.', {
      companyId,
      productsCount: overview?.productsCount ?? 0,
      customersCount: overview?.customersCount ?? 0,
      ordersCount: overview?.ordersCount ?? 0,
    });
    return overview;
  } catch (error) {
    console.error('[CompanyOverview] Failed to fetch company overview.', { companyId, error });
    throw error;
  }
}

export async function fetchPlatformOverview() {
  return authedFetchJSON('/api/platform/overview', {});
}

export async function fetchPlatformSupportView(companyId: string, targetUserId?: string | null) {
  return authedFetchJSON('/api/platform/support/view', {
    companyId,
    targetUserId: targetUserId || null,
  });
}

export async function syncPlatformStats() {
  return authedFetchJSON('/api/platform/stats/sync', {});
}

export async function syncPlatformBilling(companyId?: string | null) {
  return authedFetchJSON('/api/platform/billing/sync', {
    companyId: companyId || null,
  });
}

export async function fetchPlatformFeedback(filters?: {
  status?: 'all' | PlatformFeedbackStatus;
  severity?: 'all' | PlatformFeedbackSeverity;
}) {
  return authedRequestJSON('/api/platform/feedback', {
    method: 'GET',
    query: {
      status: filters?.status && filters.status !== 'all' ? filters.status : undefined,
      severity: filters?.severity && filters.severity !== 'all' ? filters.severity : undefined,
    },
  });
}

export async function updatePlatformFeedback(
  feedbackId: string,
  payload: {
    status?: PlatformFeedbackStatus;
    adminNotes?: string;
  }
) {
  return authedRequestJSON(`/api/platform/feedback/${feedbackId}`, {
    method: 'PATCH',
    body: payload,
  });
}
