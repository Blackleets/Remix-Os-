import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

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

export async function submitBetaFeedback(input: BetaFeedbackInput) {
  const companyId = input.companyId?.trim();
  const userId = input.userId?.trim();
  const userEmail = input.userEmail?.trim();
  const title = input.title?.trim();
  const message = input.message?.trim();
  const pagePath = input.pagePath?.trim();

  if (!companyId) throw new Error('companyId is required');
  if (!userId) throw new Error('userId is required');
  if (!userEmail) throw new Error('userEmail is required');
  if (!title) throw new Error('title is required');
  if (!message) throw new Error('message is required');
  if (!pagePath) throw new Error('pagePath is required');
  if (title.length > 120) throw new Error('title must be 120 characters or less');
  if (message.length > 3000) throw new Error('message must be 3000 characters or less');
  if (!VALID_TYPES.includes(input.type)) throw new Error('type is invalid');
  if (!VALID_SEVERITIES.includes(input.severity)) throw new Error('severity is invalid');

  return addDoc(collection(db, 'betaFeedback'), {
    companyId,
    companyName: input.companyName?.trim() || null,
    userId,
    userEmail,
    userName: input.userName?.trim() || null,
    type: input.type,
    severity: input.severity,
    title,
    message,
    pagePath,
    status: 'open',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}
