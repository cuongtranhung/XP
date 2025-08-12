import React, { ReactNode } from 'react';
import { usePermissions } from '../../contexts/PermissionContext';

interface CanAccessProps {
  // Permission checking props
  permission?: string; // Format: "resource.action" or "resource.action.scope"
  resource?: string;
  action?: string;
  scope?: string;
  
  // Render props
  children: ReactNode;
  fallback?: ReactNode;
  
  // Options
  requireAll?: boolean; // For multiple permissions
  permissions?: string[]; // Multiple permissions to check
}

/**
 * Component to conditionally render children based on permissions
 * 
 * Usage examples:
 * <CanAccess permission="users.create">
 *   <button>Create User</button>
 * </CanAccess>
 * 
 * <CanAccess resource="users" action="update" scope="own">
 *   <button>Edit Profile</button>
 * </CanAccess>
 * 
 * <CanAccess permissions={["users.create", "users.update"]} requireAll={true}>
 *   <AdminPanel />
 * </CanAccess>
 */
export const CanAccess: React.FC<CanAccessProps> = ({
  permission,
  resource,
  action,
  scope = 'all',
  children,
  fallback = null,
  requireAll = false,
  permissions = []
}) => {
  const { hasPermission, canAccess, loading } = usePermissions();

  // Don't render anything while loading permissions
  if (loading) {
    return null;
  }

  let hasAccess = false;

  // Check multiple permissions
  if (permissions.length > 0) {
    if (requireAll) {
      // All permissions must be granted
      hasAccess = permissions.every(p => canAccess(p));
    } else {
      // At least one permission must be granted
      hasAccess = permissions.some(p => canAccess(p));
    }
  }
  // Check single permission string
  else if (permission) {
    hasAccess = canAccess(permission);
  }
  // Check resource/action/scope combination
  else if (resource && action) {
    hasAccess = hasPermission(resource, action, scope);
  }

  return hasAccess ? <>{children}</> : <>{fallback}</>;
};

/**
 * Hook to check permissions programmatically
 */
export const useCanAccess = () => {
  const { hasPermission, canAccess } = usePermissions();

  return {
    check: (permission: string) => canAccess(permission),
    checkResource: (resource: string, action: string, scope?: string) => 
      hasPermission(resource, action, scope),
    checkMultiple: (permissions: string[], requireAll = false) => {
      if (requireAll) {
        return permissions.every(p => canAccess(p));
      }
      return permissions.some(p => canAccess(p));
    }
  };
};

export default CanAccess;