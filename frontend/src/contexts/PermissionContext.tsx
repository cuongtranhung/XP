import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { permissionService } from '../services/permissionService';

interface Permission {
  id: string;
  resource: string;
  action: string;
  scope: string;
  display_name?: string;
}

interface PermissionContextType {
  permissions: Permission[];
  loading: boolean;
  error: string | null;
  hasPermission: (resource: string, action: string, scope?: string) => boolean;
  canAccess: (permission: string) => boolean;
  refreshPermissions: () => Promise<void>;
}

const PermissionContext = createContext<PermissionContextType | undefined>(undefined);

export const usePermissions = () => {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error('usePermissions must be used within a PermissionProvider');
  }
  return context;
};

interface PermissionProviderProps {
  children: ReactNode;
}

export const PermissionProvider: React.FC<PermissionProviderProps> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPermissions = async () => {
    if (!isAuthenticated || !user) {
      setPermissions([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // Fetch current user's permissions
      const response = await permissionService.getCurrentUserPermissions();
      
      if (response.success && response.data) {
        // Extract permissions from the response
        const userPermissions = [
          ...(response.data.role_permissions || []),
          ...(response.data.direct_permissions || [])
        ];
        setPermissions(userPermissions);
      }
    } catch (err: any) {
      console.error('Failed to fetch permissions:', err);
      setError(err.message || 'Failed to load permissions');
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  };

  // Only refetch permissions when authentication status changes or user ID changes
  // This prevents infinite loops caused by user object reference changes
  useEffect(() => {
    fetchPermissions();
  }, [isAuthenticated, user?.id]); // Only track user.id, not the entire user object

  const hasPermission = (resource: string, action: string, scope: string = 'all'): boolean => {
    if (!permissions.length) return false;

    // Check for exact match
    const hasExactMatch = permissions.some(p => 
      p.resource === resource && 
      p.action === action && 
      (p.scope === scope || p.scope === 'all')
    );

    if (hasExactMatch) return true;

    // Check for wildcard permissions
    const hasWildcard = permissions.some(p => 
      (p.resource === '*' || p.resource === resource) &&
      (p.action === '*' || p.action === action) &&
      (p.scope === 'all')
    );

    return hasWildcard;
  };

  const canAccess = (permission: string): boolean => {
    // Permission string format: "resource.action" or "resource.action.scope"
    const parts = permission.split('.');
    
    if (parts.length < 2) {
      console.warn(`Invalid permission format: ${permission}`);
      return false;
    }

    const [resource, action, scope = 'all'] = parts;
    return hasPermission(resource, action, scope);
  };

  const refreshPermissions = async () => {
    await fetchPermissions();
  };

  const value: PermissionContextType = {
    permissions,
    loading,
    error,
    hasPermission,
    canAccess,
    refreshPermissions
  };

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
};

export default PermissionContext;