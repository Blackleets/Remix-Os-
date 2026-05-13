import { auth } from '../lib/firebase';

// All Gemini calls run on the server so the API key never ships to the browser.
// These helpers POST to the authenticated /api/ai/* endpoints.

export class CopilotRequestError extends Error {
  status: number;
  code?: string;
  details?: string;

  constructor(message: string, status: number, code?: string, details?: string) {
    super(message);
    this.name = 'CopilotRequestError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function authedFetchJSON(url: string, body: Record<string, any>) {
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const raw = await res.text();
    let parsed: any = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
    if (parsed) {
      throw new CopilotRequestError(
        parsed.error || `Request failed (${res.status})`,
        res.status,
        parsed.code,
        parsed.details
      );
    }
    throw new CopilotRequestError(raw || `Request failed (${res.status})`, res.status);
  }

  return res.json();
}

export async function checkAiHealth() {
  return authedFetchJSON('/api/ai/health', {});
}

export async function generateBusinessInsights(businessData: any, language: string = 'en') {
  if (!businessData?.companyId) {
    console.warn('generateBusinessInsights: missing companyId');
    return null;
  }

  try {
    const data = await authedFetchJSON('/api/ai/insights', {
      companyId: businessData.companyId,
      businessData,
      language,
    });
    return data?.insights ?? null;
  } catch (error) {
    console.error('Gemini Insight Error:', error);
    return null;
  }
}

export async function chatCopilot(
  message: string,
  history: any[],
  context: any,
  language: string = 'en'
) {
  if (!context?.companyId) {
    throw new Error('chatCopilot: missing companyId in context');
  }

  const data = await authedFetchJSON('/api/ai/chat', {
    companyId: context.companyId,
    message,
    history,
    context,
    language,
  });

  return data?.text ?? '';
}

export async function getProactiveThoughts(context: any, language: string = 'en') {
  if (!context?.companyId) {
    console.warn('getProactiveThoughts: missing companyId');
    return [];
  }

  try {
    const data = await authedFetchJSON('/api/ai/proactive-thoughts', {
      companyId: context.companyId,
      context,
      language,
    });
    return data?.insights ?? [];
  } catch (error) {
    console.error('Proactive Thoughts Error:', error);
    return [];
  }
}
