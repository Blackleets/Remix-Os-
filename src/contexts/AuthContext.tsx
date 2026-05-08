import { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

interface Company {
  id: string;
  name: string;
  ownerId: string;
  industry: string;
  logoURL?: string;
  country?: string;
  currency?: string;
  defaultLanguage?: string;
  timezone?: string;
  dateFormat?: string;
  email?: string;
  phone?: string;
  stripeCustomerId?: string;
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
  };
}

interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  language?: string;
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

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [role, setRole] = useState<'viewer' | 'staff' | 'admin' | 'owner' | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserProfile = async (uid: string) => {
    try {
      const { handleFirestoreError, OperationType } = await import('../lib/firebase');
      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        setUserProfile({ uid, ...userSnap.data() } as UserProfile);
      } else {
        // Fallback for new users or missing docs
        setUserProfile(null);
      }
    } catch (error) {
      console.error("Error fetching user profile:", error);
      const { handleFirestoreError, OperationType } = await import('../lib/firebase');
      handleFirestoreError(error, OperationType.GET, `users/${uid}`);
    }
  };

  const fetchUserCompany = async (userId: string) => {
    try {
      const { handleFirestoreError, OperationType } = await import('../lib/firebase');
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
        const membershipDoc = querySnapshot.docs[0];
        const membershipData = membershipDoc.data();
        setRole(membershipData.role);
        
        try {
          const companyDoc = await getDoc(doc(db, 'companies', membershipData.companyId));
          if (companyDoc.exists()) {
            setCompany({ id: companyDoc.id, ...companyDoc.data() } as Company);
          }
        } catch (e) {
          handleFirestoreError(e, OperationType.GET, `companies/${membershipData.companyId}`);
        }
      } else {
        setCompany(null);
        setRole(null);
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

  return (
    <AuthContext.Provider value={{ user, userProfile, company, role, loading, refreshCompany, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
