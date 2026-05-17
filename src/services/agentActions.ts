import { auth } from '../lib/firebase';

async function authedPost(url: string, body: Record<string, any>) {
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
    throw new Error(err || `Accion fallida (${res.status})`);
  }

  return res.json();
}

export async function executeAgentAction(
  companyId: string,
  commandType: string,
  params: string
): Promise<{ status: string; actionId: string }> {
  const data = await authedPost('/api/ai/action', { companyId, commandType, params });
  return data;
}
