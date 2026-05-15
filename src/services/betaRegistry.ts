import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export type BetaRegistryInput = {
  uid: string;
  email: string;
  displayName?: string | null;
  photoURL?: string | null;
  currentCompanyId?: string | null;
  companyId?: string | null;
  companyName?: string | null;
  companyIndustry?: string | null;
  role?: 'viewer' | 'staff' | 'admin' | 'owner' | null;
  onboardingStatus: 'no_company' | 'pending' | 'ready';
  onboardingChecklist?: {
    profile?: boolean;
    product?: boolean;
    customer?: boolean;
    order?: boolean;
  } | null;
  subscriptionStatus?: string | null;
};

function deriveActivationStage(input: BetaRegistryInput) {
  if (input.onboardingStatus === 'ready') return 'active';
  if (input.onboardingStatus === 'no_company') return 'signed_up';

  const checklist = input.onboardingChecklist;
  const hasOperationalData = Boolean(checklist?.product || checklist?.customer || checklist?.order);
  return hasOperationalData ? 'data_seeded' : 'company_created';
}

export async function upsertBetaUserRegistry(input: BetaRegistryInput) {
  const uid = input.uid?.trim();
  const email = input.email?.trim().toLowerCase();

  if (!uid) throw new Error('uid is required');
  if (!email) throw new Error('email is required');

  const ref = doc(db, 'betaUsers', uid);
  const existing = await getDoc(ref);

  await setDoc(
    ref,
    {
      uid,
      email,
      displayName: input.displayName?.trim() || null,
      photoURL: input.photoURL?.trim() || null,
      currentCompanyId: input.currentCompanyId || null,
      companyId: input.companyId || null,
      companyName: input.companyName?.trim() || null,
      companyIndustry: input.companyIndustry?.trim() || null,
      hasCompany: Boolean(input.companyId),
      role: input.role || null,
      onboardingStatus: input.onboardingStatus,
      onboardingChecklist: input.onboardingChecklist || null,
      activationStage: deriveActivationStage(input),
      needsAttention: input.onboardingStatus !== 'ready',
      subscriptionStatus: input.subscriptionStatus || null,
      accessTier: 'free_beta',
      source: 'public_beta',
      lastSeenAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      ...(existing.exists()
        ? {}
        : {
            feedbackCount: 0,
            createdAt: serverTimestamp(),
          }),
    },
    { merge: true }
  );
}
