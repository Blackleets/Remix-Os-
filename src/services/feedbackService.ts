import { auth } from '../lib/firebase';

export type BetaFeedbackType =
  | 'bug'
  | 'idea'
  | 'ux'
  | 'billing'
  | 'copilot'
  | 'other';

export type BetaFeedbackSeverity =
  | 'low'
  | 'medium'
  | 'high'
  | 'critical';

export type BetaFeedbackStatus =
  | 'open'
  | 'reviewed'
  | 'resolved';

export type BetaFeedbackInput = {
  companyId: string;
  companyName?: string;
  userId: string;
  userEmail: string;
  userName?: string;
  type: BetaFeedbackType;
  severity: BetaFeedbackSeverity;
  title: string;
  message: string;
  pagePath: string;
};

const VALID_TYPES: BetaFeedbackType[] = ['bug', 'idea', 'ux', 'billing', 'copilot', 'other'];
const VALID_SEVERITIES: BetaFeedbackSeverity[] = ['low', 'medium', 'high', 'critical'];

// Submission goes through the backend (POST /api/beta-feedback/submit, Admin
// SDK) instead of writing betaFeedback/betaUsers directly. The betaUsers
// security rule (isValidBetaUserWrite) mandates a strict shape — hasCompany
// and activationStage — that this client path never sent, so every direct
// write was rejected by Firestore rules and surfaced as "No pudimos enviar tu
// feedback". The endpoint verifies the Firebase ID token, confirms the user
// is a member of the active company (companyId cannot be spoofed), and
// performs both writes server-side. There is intentionally no direct-Firestore
// fallback: a partial write (betaFeedback created, betaUsers rejected) is the
// exact inconsistency we are removing.
export async function submitBetaFeedback(
  input: BetaFeedbackInput
): Promise<{ ok: true; feedbackId: string }> {
  const companyId = input.companyId?.trim();
  const userEmail = input.userEmail?.trim();
  const title = input.title?.trim();
  const message = input.message?.trim();
  const pagePath = input.pagePath?.trim();

  if (!companyId) throw new Error('companyId is required');
  if (!userEmail) throw new Error('userEmail is required');
  if (!title) throw new Error('title is required');
  if (!message) throw new Error('message is required');
  if (!pagePath) throw new Error('pagePath is required');
  if (title.length > 120) throw new Error('title must be 120 characters or less');
  if (message.length > 3000) throw new Error('message must be 3000 characters or less');
  if (!VALID_TYPES.includes(input.type)) throw new Error('type is invalid');
  if (!VALID_SEVERITIES.includes(input.severity)) throw new Error('severity is invalid');

  const token = await auth.currentUser?.getIdToken().catch(() => null);
  if (!token) {
    throw new Error('Tu sesión expiró. Vuelve a iniciar sesión para enviar feedback.');
  }

  let response: Response;
  try {
    response = await fetch('/api/beta-feedback/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        companyId,
        companyName: input.companyName?.trim() || '',
        userEmail,
        userName: input.userName?.trim() || '',
        type: input.type,
        severity: input.severity,
        title,
        message,
        pagePath,
      }),
    });
  } catch {
    throw new Error(
      'No se pudo contactar el servidor para enviar el feedback. Revisa tu conexión e inténtalo de nuevo.'
    );
  }

  if (response.status === 404 || response.status === 405) {
    throw new Error('El servicio de feedback no está disponible en este despliegue.');
  }

  if (!response.ok) {
    let messageText = `No se pudo enviar el feedback (error ${response.status}).`;
    try {
      const body = await response.json();
      if (body?.error) messageText = String(body.error);
    } catch {
      /* keep generic message */
    }
    throw new Error(messageText);
  }

  const payload = await response.json().catch(() => null);
  return { ok: true, feedbackId: payload && typeof payload.feedbackId === 'string' ? payload.feedbackId : '' };
}
