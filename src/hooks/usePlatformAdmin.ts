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
  const [loadingPlatformAdmin, setLoadingPlatformAdmin] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadPlatformAdmin = async () => {
      if (!user) {
        if (isMounted) {
          setPlatformAdmin(null);
          setLoadingPlatformAdmin(false);
        }
        return;
      }

      setLoadingPlatformAdmin(true);
      try {
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
    Boolean(platformAdmin?.active) &&
    platformAdmin?.role === 'super_admin' &&
    platformAdmin?.uid === user?.uid;

  return {
    platformAdmin,
    isPlatformAdmin,
    loadingPlatformAdmin,
    canAccessSuperAdmin: isPlatformAdmin,
  };
}
