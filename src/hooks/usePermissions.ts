import { useAuth } from '../contexts/AuthContext';

export type Role = 'owner' | 'admin' | 'staff' | 'viewer';

export function usePermissions() {
  const { role } = useAuth();

  const isOwner = role === 'owner';
  const isAdmin = role === 'admin';
  const isStaff = role === 'staff';
  const isViewer = role === 'viewer';

  const canManageTeam = isOwner || isAdmin;
  const canManageBilling = isOwner || isAdmin;
  const canManageSettings = isOwner || isAdmin;
  const canViewInsights = isOwner || isAdmin;
  
  // Operational permissions
  const canEditCustomers = isOwner || isAdmin || isStaff;
  const canEditProducts = isOwner || isAdmin || isStaff;
  const canEditOrders = isOwner || isAdmin || isStaff;
  const canEditInventory = isOwner || isAdmin || isStaff;

  return {
    role,
    isOwner,
    isAdmin,
    isStaff,
    isViewer,
    canManageTeam,
    canManageBilling,
    canManageSettings,
    canViewInsights,
    canEditCustomers,
    canEditProducts,
    canEditOrders,
    canEditInventory
  };
}
