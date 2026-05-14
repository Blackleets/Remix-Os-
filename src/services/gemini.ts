import { auth } from '../lib/firebase';

// All Gemini calls run on the server so the API key never ships to the browser.
// These helpers POST to the authenticated /api/ai/* endpoints.

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
    const err = await res.text();
    throw new Error(err || `Request failed (${res.status})`);
  }

  return res.json();
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

export async function getDailyBriefing(
  companyId: string,
  language: string = 'es'
): Promise<{ briefing: string; generatedAt: string } | null> {
  if (!companyId) {
    console.warn('getDailyBriefing: missing companyId');
    return null;
  }

  try {
    const data = await authedFetchJSON('/api/ai/daily-briefing', { companyId, language });
    return data ?? null;
  } catch (error) {
    console.error('Daily Briefing Error:', error);
    return null;
  }
}
