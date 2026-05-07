import { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

interface Company {
  id: string;
  name: string;
  ownerId: string;
  industry: string;
  country?: string;
  currency?: string;
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

interface AuthContextType {
  user: User | null;
  company: Company | null;
  role: 'viewer' | 'staff' | 'admin' | 'owner' | null;
  loading: boolean;
  refreshCompany: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  company: null,
  role: null,
  loading: true,
  refreshCompany: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [role, setRole] = useState<'viewer' | 'staff' | 'admin' | 'owner' | null>(null);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        await fetchUserCompany(user.uid);
      } else {
        setCompany(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, company, role, loading, refreshCompany }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
