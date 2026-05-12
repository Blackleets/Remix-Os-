import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';

interface PlatformAdminRecord {
  uid: string;
  email: string;
  role: 'super_admin';
  active: boolean;
  createdAt?: unknown;
}

export function usePlatformAdmin() {
  const { user } = useAuth();
  const [platformAdmin, setPlatformAdmin] = useState<PlatformAdminRecord | null>(null);
  const [hasPlatformAdminClaim, setHasPlatformAdminClaim] = useState(false);
  const [loadingPlatformAdmin, setLoadingPlatformAdmin] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadPlatformAdmin = async () => {
      if (!user) {
        if (isMounted) {
          setPlatformAdmin(null);
          setHasPlatformAdminClaim(false);
          setLoadingPlatformAdmin(false);
        }
        return;
      }

      setLoadingPlatformAdmin(true);
      try {
        const tokenResult = await user.getIdTokenResult();
        const hasClaim = tokenResult.claims.superAdmin === true;
        if (!isMounted) return;

        setHasPlatformAdminClaim(hasClaim);
        if (hasClaim) {
          setPlatformAdmin({
            uid: user.uid,
            email: user.email || '',
            role: 'super_admin',
            active: true,
          });
          return;
        }

        const snapshot = await getDoc(doc(db, 'platformAdmins', user.uid));
        if (!isMounted) return;

        if (snapshot.exists()) {
          setPlatformAdmin({ uid: snapshot.id, ...snapshot.data() } as PlatformAdminRecord);
        } else {
          setPlatformAdmin(null);
        }
      } catch (error) {
        console.warn('Platform admin lookup failed:', error);
        if (isMounted) {
          setHasPlatformAdminClaim(false);
          setPlatformAdmin(null);
        }
      } finally {
        if (isMounted) {
          setLoadingPlatformAdmin(false);
        }
      }
    };

    loadPlatformAdmin();

    return () => {
      isMounted = false;
    };
  }, [user?.uid]);

  const isPlatformAdmin =
    hasPlatformAdminClaim ||
    (
      Boolean(platformAdmin?.active) &&
      platformAdmin?.role === 'super_admin' &&
      platformAdmin?.uid === user?.uid
    );

  return {
    platformAdmin,
    hasPlatformAdminClaim,
    isPlatformAdmin,
    loadingPlatformAdmin,
    canAccessSuperAdmin: isPlatformAdmin,
  };
}
