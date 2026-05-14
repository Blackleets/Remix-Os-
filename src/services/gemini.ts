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

export async function chatCopilotStream(
  message: string,
  history: any[],
  context: any,
  language: string = 'en',
  onChunk: (text: string) => void,
  onDone: (command: { type: string; params: string } | null) => void,
  onError: (err: Error) => void
): Promise<void> {
  if (!context?.companyId) {
    onError(new Error('chatCopilotStream: missing companyId in context'));
    return;
  }

  let token: string | undefined;
  try {
    token = await auth.currentUser?.getIdToken();
  } catch {
    onError(new Error('Failed to get auth token'));
    return;
  }

  let response: Response;
  try {
    response = await fetch('/api/ai/chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ companyId: context.companyId, message, history, context, language }),
    });
  } catch (err: any) {
    onError(err);
    return;
  }

  if (!response.ok) {
    onError(new Error(`Stream request failed (${response.status})`));
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    onError(new Error('No response body'));
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (!raw || raw === '[DONE]') continue;
        try {
          const parsed = JSON.parse(raw);
          if (parsed.error) { onError(new Error(parsed.error)); return; }
          if (parsed.done) { onDone(parsed.command ?? null); return; }
          if (parsed.text) onChunk(parsed.text);
        } catch {
          // skip malformed SSE line
        }
      }
    }
    onDone(null);
  } catch (err: any) {
    onError(err);
  } finally {
    reader.releaseLock();
  }
}

export async function loadPeppyConversation(companyId: string): Promise<any[]> {
  try {
    const data = await authedFetchJSON('/api/ai/conversation/load', { companyId });
    return (data?.messages || []).map((m: any) => ({
      ...m,
      timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
      streaming: false,
    }));
  } catch (error) {
    console.warn('loadPeppyConversation failed, using localStorage fallback:', error);
    return [];
  }
}

export async function savePeppyConversation(companyId: string, messages: any[]): Promise<void> {
  try {
    const payload = messages
      .filter(m => !m.streaming)
      .map(m => ({ ...m, timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp }));
    await authedFetchJSON('/api/ai/conversation/save', { companyId, messages: payload });
  } catch (error) {
    console.warn('savePeppyConversation failed:', error);
  }
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
