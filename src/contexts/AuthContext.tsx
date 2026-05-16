import { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs, setDoc, serverTimestamp, updateDoc, limit } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { normalizeCompanyVertical, getCompanyVerticalLabel } from '../lib/company';
import { upsertBetaUserRegistry } from '../services/betaRegistry';

interface Company {
  id: string;
  name: string;
  ownerId: string;
  industry: string;
  vertical?: string;
  logoURL?: string;
  country?: string;
  currency?: string;
  defaultLanguage?: string;
  timezone?: string;
  dateFormat?: string;
  email?: string;
  phone?: string;
  stripeCustomerId?: string;
  internalTesting?: boolean;
  onboardingState?: {
    isComplete: boolean;
    step: number;
    checklist: {
      profile: boolean;
      product: boolean;
      customer: boolean;
      order: boolean;
    };
  };
  subscription?: {
    planId: 'starter' | 'pro' | 'business';
    status: 'active' | 'past_due' | 'trialing' | 'canceled';
    currentPeriodEnd?: any;
    trialEndsAt?: any;
  };
}

interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  language?: string;
  currentCompanyId?: string | null;
  createdAt?: any;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  company: Company | null;
  role: 'viewer' | 'staff' | 'admin' | 'owner' | null;
  loading: boolean;
  refreshCompany: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  company: null,
  role: null,
  loading: true,
  refreshCompany: async () => {},
  refreshProfile: async () => {},
});

const normalizeLanguage = (lang?: string | null) => {
  const base = (lang || 'es').split('-')[0].toLowerCase();
  return ['en', 'es', 'pt'].includes(base) ? base : 'es';
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [role, setRole] = useState<'viewer' | 'staff' | 'admin' | 'owner' | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserProfile = async (uid: string) => {
    try {
      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        setUserProfile({ uid, ...userSnap.data() } as UserProfile);
      } else {
        setUserProfile(null);
      }
    } catch (error) {
      console.error("Error fetching user profile:", error);
      handleFirestoreError(error, OperationType.GET, `users/${uid}`);
    }
  };

  const syncCurrentCompanyId = async (uid: string, companyId?: string | null) => {
    try {
      await setDoc(doc(db, 'users', uid), {
        currentCompanyId: companyId || null,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch (error) {
      console.error('Error syncing currentCompanyId:', error);
    }
  };

  const syncOnboardingState = async (
    companyId: string,
    membershipRole: 'viewer' | 'staff' | 'admin' | 'owner' | null,
    currentCompany?: Company | null
  ) => {
    const [productsSnap, customersSnap, ordersSnap] = await Promise.all([
      getDocs(query(collection(db, 'products'), where('companyId', '==', companyId), limit(1))),
      getDocs(query(collection(db, 'customers'), where('companyId', '==', companyId), limit(1))),
      getDocs(query(collection(db, 'orders'), where('companyId', '==', companyId), limit(1))),
    ]);

    const checklist = {
      profile: true,
      product: !productsSnap.empty,
      customer: !customersSnap.empty,
      order: !ordersSnap.empty,
    };
    const completedSteps = Object.values(checklist).filter(Boolean).length;
    const nextStep = checklist.order ? 4 : checklist.customer ? 3 : checklist.product ? 2 : 1;
    const onboardingState = {
      isComplete: completedSteps === 4,
      step: nextStep,
      checklist,
    };

    const normalizedVertical = normalizeCompanyVertical(currentCompany?.vertical || currentCompany?.industry);
    const normalizedCompany = currentCompany ? {
      ...currentCompany,
      vertical: normalizedVertical,
      industry: getCompanyVerticalLabel(normalizedVertical),
      onboardingState,
    } : null;

    const stateChanged =
      currentCompany?.onboardingState?.isComplete !== onboardingState.isComplete ||
      currentCompany?.onboardingState?.step !== onboardingState.step ||
      currentCompany?.onboardingState?.checklist?.profile !== onboardingState.checklist.profile ||
      currentCompany?.onboardingState?.checklist?.product !== onboardingState.checklist.product ||
      currentCompany?.onboardingState?.checklist?.customer !== onboardingState.checklist.customer ||
      currentCompany?.onboardingState?.checklist?.order !== onboardingState.checklist.order ||
      currentCompany?.vertical !== normalizedVertical ||
      currentCompany?.industry !== getCompanyVerticalLabel(normalizedVertical);

    if (stateChanged && (membershipRole === 'owner' || membershipRole === 'admin')) {
      await updateDoc(doc(db, 'companies', companyId), {
        vertical: normalizedVertical,
        industry: getCompanyVerticalLabel(normalizedVertical),
        onboardingState,
        updatedAt: serverTimestamp(),
      });
    }

    return normalizedCompany;
  };

  const ensureUserProfile = async (firebaseUser: User) => {
    try {
      const userRef = doc(db, 'users', firebaseUser.uid);
      const userSnap = await getDoc(userRef);
      const fallbackName =
        firebaseUser.displayName ||
        firebaseUser.email?.split('@')[0] ||
        'Operador Remix';
      const fallbackLanguage = normalizeLanguage(firebaseUser.providerData?.[0]?.providerId ? 'es' : 'es');

      if (!userSnap.exists()) {
        await setDoc(userRef, {
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: fallbackName,
          photoURL: firebaseUser.photoURL || '',
          language: fallbackLanguage,
          currentCompanyId: null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return;
      }

      const current = userSnap.data();
      const patch: Record<string, unknown> = {};

      if (!current.displayName && fallbackName) patch.displayName = fallbackName;
      if (!current.photoURL && firebaseUser.photoURL) patch.photoURL = firebaseUser.photoURL;
      if (!current.email && firebaseUser.email) patch.email = firebaseUser.email;
      if (!current.language) patch.language = fallbackLanguage;
      if (!('currentCompanyId' in current)) patch.currentCompanyId = null;

      if (Object.keys(patch).length > 0) {
        await setDoc(userRef, { ...patch, updatedAt: serverTimestamp() }, { merge: true });
      }
    } catch (error) {
      console.error('Error ensuring user profile:', error);
    }
  };

  const fetchUserCompany = async (userId: string) => {
    try {
      console.info('[Membership] Resolving company for user.', { userId });
      const membershipsRef = collection(db, 'memberships');
      const q = query(membershipsRef, where('userId', '==', userId));
      let querySnapshot;
      try {
        querySnapshot = await getDocs(q);
      } catch (e) {
        handleFirestoreError(e, OperationType.LIST, 'memberships');
        return;
      }
      
      if (!querySnapshot.empty) {
        const userProfileSnap = await getDoc(doc(db, 'users', userId)).catch(() => null);
        const preferredCompanyId = userProfileSnap?.exists() ? userProfileSnap.data()?.currentCompanyId : null;
        const membershipDocs = querySnapshot.docs;
        const preferredMembership =
          membershipDocs.find((entry) => entry.data().companyId === preferredCompanyId) ||
          membershipDocs.find((entry) => entry.data().role === 'owner') ||
          membershipDocs[0];

        const membershipDoc = preferredMembership;
        const membershipData = membershipDoc.data();
        console.info('[Membership] Membership selected for active company.', {
          userId,
          preferredCompanyId,
          membershipDocId: membershipDoc.id,
          companyId: membershipData.companyId,
          role: membershipData.role,
          membershipCount: membershipDocs.length,
        });
        setRole(membershipData.role);
        
        try {
          const companyDoc = await getDoc(doc(db, 'companies', membershipData.companyId));
          if (companyDoc.exists()) {
            const rawCompany = { id: companyDoc.id, ...companyDoc.data() } as Company;
            const normalizedCompany = await syncOnboardingState(
              membershipData.companyId,
              membershipData.role,
              rawCompany
            );
            setCompany(normalizedCompany || rawCompany);
            await syncCurrentCompanyId(userId, membershipData.companyId);
            console.info('[Membership] Company loaded for user.', {
              userId,
              companyId: membershipData.companyId,
              role: membershipData.role,
            });
          } else {
            console.warn('[Membership] Membership points to missing company document.', {
              userId,
              companyId: membershipData.companyId,
              membershipDocId: membershipDoc.id,
            });
            setCompany(null);
            setRole(null);
            await syncCurrentCompanyId(userId, null);
          }
        } catch (e) {
          handleFirestoreError(e, OperationType.GET, `companies/${membershipData.companyId}`);
        }
      } else {
        console.info('[Membership] No memberships found for user.', { userId });
        setCompany(null);
        setRole(null);
        await syncCurrentCompanyId(userId, null);
      }
    } catch (error) {
      console.error("Error fetching company:", error);
    }
  };

  const refreshCompany = async () => {
    if (user) {
      await fetchUserCompany(user.uid);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchUserProfile(user.uid);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        await ensureUserProfile(user);
        await Promise.all([
          fetchUserProfile(user.uid),
          fetchUserCompany(user.uid)
        ]);
      } else {
        setCompany(null);
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user?.uid || !user.email || loading) return;

    const onboardingStatus: 'no_company' | 'pending' | 'ready' =
      !company
        ? 'no_company'
        : company.onboardingState?.isComplete
          ? 'ready'
          : 'pending';

    void upsertBetaUserRegistry({
      uid: user.uid,
      email: user.email,
      displayName: userProfile?.displayName || user.displayName,
      photoURL: userProfile?.photoURL || user.photoURL,
      currentCompanyId: userProfile?.currentCompanyId || company?.id || null,
      companyId: company?.id || null,
      companyName: company?.name || null,
      companyIndustry: company?.industry || null,
      role,
      onboardingStatus,
      onboardingChecklist: company?.onboardingState?.checklist || null,
      subscriptionStatus: company?.subscription?.status || null,
    }).catch((error) => {
      console.error('Error syncing beta user registry:', error);
    });
  }, [
    company?.id,
    company?.industry,
    company?.name,
    company?.onboardingState?.isComplete,
    company?.subscription?.status,
    loading,
    role,
    user?.displayName,
    user?.email,
    user?.photoURL,
    user?.uid,
    userProfile?.currentCompanyId,
    userProfile?.displayName,
    userProfile?.photoURL,
  ]);

  return (
    <AuthContext.Provider value={{ user, userProfile, company, role, loading, refreshCompany, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
