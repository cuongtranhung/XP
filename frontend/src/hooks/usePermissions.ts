import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { 
  UserPermissions,
  PermissionAction,
  ResourceType,
  PermissionCheckRequest,
  PermissionCheckResult,
  PermissionContextValue
} from '../types/permissions';
import { permissionService } from '../services/permissionService';
import toast from 'react-hot-toast';

// Permission cache for performance optimization
const permissionCache = new Map<string, { result: boolean; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const usePermissions = (): PermissionContextValue => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch current user's permissions
  const {
    data: userPermissions,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['permissions', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const response = await permissionService.getCurrentUserPermissions();
      return response.data;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2
  });

  // Clear cache when user changes or permissions are refetched
  useEffect(() => {
    permissionCache.clear();
  }, [user?.id, userPermissions]);

  // Single permission check with caching
  const checkPermission = useCallback((
    action: PermissionAction,
    resource: ResourceType,
    resourceId?: string,
    context?: any
  ): boolean => {
    if (!userPermissions || !user) return false;

    // Create cache key
    const cacheKey = `${user.id}:${action}:${resource}:${resourceId || ''}:${JSON.stringify(context || {})}`;
    
    // Check cache first
    const cached = permissionCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.result;
    }

    // Find matching effective permissions
    const matchingPermissions = userPermissions.effective_permissions.filter(ep => {
      const permission = ep.permission;
      
      // Check basic permission match
      if (permission.action !== action || permission.resource_type !== resource) {
        return false;
      }

      // Check if permission is active and not expired
      if (!permission.is_active || (ep.expires_at && new Date(ep.expires_at) < new Date())) {
        return false;
      }

      // Check resource constraints
      if (ep.resource_constraints?.length && resourceId) {
        const hasResourceAccess = ep.resource_constraints.some(constraint => {
          if (constraint.resource_type !== resource) return false;
          
          // If specific resource IDs are defined, check if our resource is included
          if (constraint.resource_ids?.length) {
            return constraint.resource_ids.includes(resourceId);
          }
          
          // If no specific resource IDs, check department/project constraints with context
          if (context) {
            if (constraint.department_ids?.length && context.departmentId) {
              return constraint.department_ids.includes(context.departmentId);
            }
            if (constraint.project_ids?.length && context.projectId) {
              return constraint.project_ids.includes(context.projectId);
            }
            if (constraint.organization_ids?.length && context.organizationId) {
              return constraint.organization_ids.includes(context.organizationId);
            }
          }
          
          // If no constraints match and we have a resource ID, deny access
          return !resourceId;
        });
        
        if (!hasResourceAccess) return false;
      }

      // Check conditions
      if (ep.conditions?.length && context) {
        const conditionsMet = ep.conditions.every(condition => {
          const contextValue = context[condition.field];
          
          switch (condition.operator) {
            case 'equals':
              return contextValue === condition.value;
            case 'not_equals':
              return contextValue !== condition.value;
            case 'contains':
              return String(contextValue).includes(String(condition.value));
            case 'not_contains':
              return !String(contextValue).includes(String(condition.value));
            case 'in':
              return Array.isArray(condition.value) && condition.value.includes(contextValue);
            case 'not_in':
              return Array.isArray(condition.value) && !condition.value.includes(contextValue);
            case 'greater_than':
              return Number(contextValue) > Number(condition.value);
            case 'less_than':
              return Number(contextValue) < Number(condition.value);
            default:
              return true;
          }
        });
        
        if (!conditionsMet) return false;
      }

      return true;
    });

    // Determine access based on grant/deny rules
    // Sort by priority (higher priority first)
    const sortedPermissions = matchingPermissions.sort((a, b) => b.priority - a.priority);
    
    let hasAccess = false;
    
    for (const ep of sortedPermissions) {
      if (ep.is_granted) {
        hasAccess = true;
        break; // Grant found, access allowed
      } else {
        hasAccess = false;
        break; // Explicit deny found, access denied
      }
    }

    // Cache the result
    permissionCache.set(cacheKey, {
      result: hasAccess,
      timestamp: Date.now()
    });

    return hasAccess;
  }, [userPermissions, user]);

  // Bulk permission check
  const checkPermissions = useCallback((
    checks: Omit<PermissionCheckRequest, 'user_id'>[]
  ): PermissionCheckResult[] => {
    if (!userPermissions || !user) {
      return checks.map(() => ({
        granted: false,
        reason: 'No permissions loaded',
        matching_permissions: [],
        resource_constraints: []
      }));
    }

    return checks.map(check => {
      const granted = checkPermission(
        check.action,
        check.resource_type,
        check.resource_id,
        check.context
      );

      return {
        granted,
        reason: granted ? 'Permission granted' : 'Permission denied',
        matching_permissions: userPermissions.effective_permissions.filter(ep =>
          ep.permission.action === check.action && 
          ep.permission.resource_type === check.resource_type
        ),
        resource_constraints: []
      };
    });
  }, [checkPermission, userPermissions, user]);

  // Bulk permission check with server validation (for critical operations)
  const bulkCheckPermissions = useCallback(async (
    checks: Omit<PermissionCheckRequest, 'user_id'>[]
  ): Promise<import('../types/permissions').BulkPermissionCheckResult> => {
    if (!user?.id) {
      throw new Error('User not authenticated');
    }

    const response = await permissionService.bulkCheckPermissions({
      user_id: user.id,
      checks
    });

    return response.data;
  }, [user?.id]);

  // Refresh permissions
  const refreshPermissions = useCallback(async () => {
    permissionCache.clear();
    await refetch();
  }, [refetch]);

  // Convenience methods for common permission checks
  const canCreate = useCallback((resource: ResourceType, context?: any) => 
    checkPermission(PermissionAction.CREATE, resource, undefined, context), [checkPermission]);

  const canRead = useCallback((resource: ResourceType, resourceId?: string, context?: any) => 
    checkPermission(PermissionAction.READ, resource, resourceId, context), [checkPermission]);

  const canUpdate = useCallback((resource: ResourceType, resourceId?: string, context?: any) => 
    checkPermission(PermissionAction.UPDATE, resource, resourceId, context), [checkPermission]);

  const canDelete = useCallback((resource: ResourceType, resourceId?: string, context?: any) => 
    checkPermission(PermissionAction.DELETE, resource, resourceId, context), [checkPermission]);

  const canManage = useCallback((resource: ResourceType, resourceId?: string, context?: any) => 
    checkPermission(PermissionAction.MANAGE, resource, resourceId, context), [checkPermission]);

  const canAssign = useCallback((resource: ResourceType, resourceId?: string, context?: any) => 
    checkPermission(PermissionAction.ASSIGN, resource, resourceId, context), [checkPermission]);

  const canApprove = useCallback((resource: ResourceType, resourceId?: string, context?: any) => 
    checkPermission(PermissionAction.APPROVE, resource, resourceId, context), [checkPermission]);

  const canExport = useCallback((resource: ResourceType, context?: any) => 
    checkPermission(PermissionAction.EXPORT, resource, undefined, context), [checkPermission]);

  const canImport = useCallback((resource: ResourceType, context?: any) => 
    checkPermission(PermissionAction.IMPORT, resource, undefined, context), [checkPermission]);

  // Memoized permission groups for easy access
  const permissionGroups = useMemo(() => {
    if (!userPermissions) return {};

    const groups: Record<string, string[]> = {};

    userPermissions.effective_permissions.forEach(ep => {
      if (ep.is_granted && ep.permission.is_active) {
        const resourceType = ep.permission.resource_type;
        if (!groups[resourceType]) {
          groups[resourceType] = [];
        }
        
        const permissionKey = `${ep.permission.action}:${ep.permission.scope}`;
        if (!groups[resourceType].includes(permissionKey)) {
          groups[resourceType].push(permissionKey);
        }
      }
    });

    return groups;
  }, [userPermissions]);

  // Check if user has any admin permissions
  const isAdmin = useMemo(() => {
    return checkPermission(PermissionAction.MANAGE, ResourceType.USER) ||
           checkPermission(PermissionAction.MANAGE, ResourceType.ROLE) ||
           checkPermission(PermissionAction.MANAGE, ResourceType.SYSTEM_CONFIG);
  }, [checkPermission]);

  // Check if user has any manager permissions
  const isManager = useMemo(() => {
    return Object.values(ResourceType).some(resource => 
      checkPermission(PermissionAction.MANAGE, resource) ||
      checkPermission(PermissionAction.ASSIGN, resource) ||
      checkPermission(PermissionAction.APPROVE, resource)
    );
  }, [checkPermission]);

  return {
    permissions: userPermissions,
    checkPermission,
    checkPermissions,
    bulkCheckPermissions,
    refreshPermissions,
    isLoading,
    error: error as Error | null,
    
    // Convenience methods
    canCreate,
    canRead,
    canUpdate,
    canDelete,
    canManage,
    canAssign,
    canApprove,
    canExport,
    canImport,
    
    // Permission groups and role checks
    permissionGroups,
    isAdmin,
    isManager
  };
};

// Hook for permission-specific queries
export const usePermissionQueries = () => {
  const queryClient = useQueryClient();

  // Invalidate permission-related queries
  const invalidatePermissions = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['permissions'] });
    queryClient.invalidateQueries({ queryKey: ['roles'] });
    queryClient.invalidateQueries({ queryKey: ['permission-matrix'] });
  }, [queryClient]);

  return {
    invalidatePermissions
  };
};

// Hook for permission mutations
export const usePermissionMutations = () => {
  const queryClient = useQueryClient();

  const assignPermissionMutation = useMutation({
    mutationFn: (data: { roleId: string; permissionId: string; granted: boolean }) => 
      permissionService.updatePermissionMatrix([{
        role_id: data.roleId,
        permission_id: data.permissionId,
        is_granted: data.granted
      }]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permissions'] });
      queryClient.invalidateQueries({ queryKey: ['permission-matrix'] });
      toast.success('Permission updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update permission');
    }
  });

  const syncPermissionsMutation = useMutation({
    mutationFn: (userId?: string) => 
      userId 
        ? permissionService.syncUserPermissions(userId)
        : permissionService.syncAllUserPermissions(),
    onSuccess: (data, userId) => {
      queryClient.invalidateQueries({ queryKey: ['permissions'] });
      toast.success(userId ? 'User permissions synced' : 'All permissions synced');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to sync permissions');
    }
  });

  return {
    assignPermission: assignPermissionMutation.mutate,
    syncPermissions: syncPermissionsMutation.mutate,
    isAssigningPermission: assignPermissionMutation.isPending,
    isSyncingPermissions: syncPermissionsMutation.isPending
  };
};

export default usePermissions;