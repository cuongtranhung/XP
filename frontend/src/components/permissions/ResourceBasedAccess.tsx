import React from 'react';
import { usePermissions } from '../../hooks/usePermissions';
import { PermissionAction, ResourceType } from '../../types/permissions';

interface ResourceBasedAccessProps {
  action: PermissionAction | PermissionAction[];
  resource: ResourceType | ResourceType[];
  resourceId?: string;
  context?: Record<string, any>;
  fallback?: React.ReactNode;
  children: React.ReactNode;
  requireAll?: boolean; // If multiple actions/resources, require all permissions (AND) vs any (OR)
}

/**
 * ResourceBasedAccess - Component that conditionally renders content based on user permissions
 * 
 * Usage examples:
 * 
 * // Simple permission check
 * <ResourceBasedAccess action="create" resource="user">
 *   <CreateUserButton />
 * </ResourceBasedAccess>
 * 
 * // Multiple actions (any)
 * <ResourceBasedAccess action={["read", "update"]} resource="user" requireAll={false}>
 *   <UserProfile />
 * </ResourceBasedAccess>
 * 
 * // Multiple resources with context
 * <ResourceBasedAccess 
 *   action="read" 
 *   resource={["project", "form"]}
 *   context={{ departmentId: "dept-123" }}
 *   fallback={<div>Access Denied</div>}
 * >
 *   <ProjectDashboard />
 * </ResourceBasedAccess>
 * 
 * // Resource-specific access
 * <ResourceBasedAccess action="update" resource="form" resourceId="form-123">
 *   <EditFormButton />
 * </ResourceBasedAccess>
 */
const ResourceBasedAccess: React.FC<ResourceBasedAccessProps> = ({
  action,
  resource,
  resourceId,
  context,
  fallback = null,
  children,
  requireAll = true
}) => {
  const { checkPermission, checkPermissions, isLoading, error } = usePermissions();

  // Show loading state while permissions are being fetched
  if (isLoading) {
    return (
      <div className="inline-flex items-center">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400 mr-2" />
        <span className="text-sm text-gray-500">Checking permissions...</span>
      </div>
    );
  }

  // Show error state if permissions check failed
  if (error) {
    console.warn('Permission check failed:', error);
    return fallback as React.ReactElement;
  }

  // Normalize inputs to arrays
  const actions = Array.isArray(action) ? action : [action];
  const resources = Array.isArray(resource) ? resource : [resource];

  // Build permission checks
  const permissionChecks: Array<{ action: PermissionAction; resource: ResourceType }> = [];
  
  for (const act of actions) {
    for (const res of resources) {
      permissionChecks.push({ action: act, resource: res });
    }
  }

  // Check permissions
  let hasAccess = false;

  if (permissionChecks.length === 1) {
    // Single permission check - use optimized method
    const { action: singleAction, resource: singleResource } = permissionChecks[0];
    hasAccess = checkPermission(singleAction, singleResource, resourceId, context);
  } else {
    // Multiple permission checks
    const results = checkPermissions(
      permissionChecks.map(({ action, resource }) => ({
        action,
        resource_type: resource,
        resource_id: resourceId,
        context
      }))
    );

    if (requireAll) {
      // AND logic - all permissions must be granted
      hasAccess = results.every(result => result.granted);
    } else {
      // OR logic - at least one permission must be granted
      hasAccess = results.some(result => result.granted);
    }
  }

  // Render children if access is granted, fallback otherwise
  return hasAccess ? (children as React.ReactElement) : (fallback as React.ReactElement);
};

// Higher-order component version for class components or complex scenarios
export const withResourceBasedAccess = <P extends object>(
  WrappedComponent: React.ComponentType<P>,
  permissions: {
    action: PermissionAction | PermissionAction[];
    resource: ResourceType | ResourceType[];
    resourceId?: string;
    context?: Record<string, any>;
    requireAll?: boolean;
  }
) => {
  const WithResourceBasedAccessComponent = (props: P) => (
    <ResourceBasedAccess {...permissions}>
      <WrappedComponent {...props} />
    </ResourceBasedAccess>
  );

  WithResourceBasedAccessComponent.displayName = 
    `withResourceBasedAccess(${WrappedComponent.displayName || WrappedComponent.name})`;

  return WithResourceBasedAccessComponent;
};

// Hook for imperative permission checking
export const useResourceBasedAccess = () => {
  const { checkPermission, checkPermissions, isLoading, error } = usePermissions();

  const hasAccess = (
    action: PermissionAction | PermissionAction[],
    resource: ResourceType | ResourceType[],
    options?: {
      resourceId?: string;
      context?: Record<string, any>;
      requireAll?: boolean;
    }
  ): boolean => {
    if (isLoading || error) return false;

    const { resourceId, context, requireAll = true } = options || {};
    
    // Normalize inputs to arrays
    const actions = Array.isArray(action) ? action : [action];
    const resources = Array.isArray(resource) ? resource : [resource];

    // Build permission checks
    const permissionChecks: Array<{ action: PermissionAction; resource: ResourceType }> = [];
    
    for (const act of actions) {
      for (const res of resources) {
        permissionChecks.push({ action: act, resource: res });
      }
    }

    if (permissionChecks.length === 1) {
      // Single permission check
      const { action: singleAction, resource: singleResource } = permissionChecks[0];
      return checkPermission(singleAction, singleResource, resourceId, context);
    } else {
      // Multiple permission checks
      const results = checkPermissions(
        permissionChecks.map(({ action, resource }) => ({
          action,
          resource_type: resource,
          resource_id: resourceId,
          context
        }))
      );

      return requireAll 
        ? results.every(result => result.granted)
        : results.some(result => result.granted);
    }
  };

  const canCreate = (resource: ResourceType, context?: Record<string, any>) =>
    hasAccess(PermissionAction.CREATE, resource, { context });

  const canRead = (resource: ResourceType, resourceId?: string, context?: Record<string, any>) =>
    hasAccess(PermissionAction.READ, resource, { resourceId, context });

  const canUpdate = (resource: ResourceType, resourceId?: string, context?: Record<string, any>) =>
    hasAccess(PermissionAction.UPDATE, resource, { resourceId, context });

  const canDelete = (resource: ResourceType, resourceId?: string, context?: Record<string, any>) =>
    hasAccess(PermissionAction.DELETE, resource, { resourceId, context });

  const canManage = (resource: ResourceType, resourceId?: string, context?: Record<string, any>) =>
    hasAccess(PermissionAction.MANAGE, resource, { resourceId, context });

  return {
    hasAccess,
    canCreate,
    canRead,
    canUpdate,
    canDelete,
    canManage,
    isLoading,
    error
  };
};

// Predefined permission components for common use cases
export const CanCreate: React.FC<{
  resource: ResourceType;
  context?: Record<string, any>;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}> = ({ resource, context, fallback, children }) => (
  <ResourceBasedAccess action={PermissionAction.CREATE} resource={resource} context={context} fallback={fallback}>
    {children}
  </ResourceBasedAccess>
);

export const CanRead: React.FC<{
  resource: ResourceType;
  resourceId?: string;
  context?: Record<string, any>;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}> = ({ resource, resourceId, context, fallback, children }) => (
  <ResourceBasedAccess 
    action={PermissionAction.READ} 
    resource={resource} 
    resourceId={resourceId}
    context={context} 
    fallback={fallback}
  >
    {children}
  </ResourceBasedAccess>
);

export const CanUpdate: React.FC<{
  resource: ResourceType;
  resourceId?: string;
  context?: Record<string, any>;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}> = ({ resource, resourceId, context, fallback, children }) => (
  <ResourceBasedAccess 
    action={PermissionAction.UPDATE} 
    resource={resource} 
    resourceId={resourceId}
    context={context} 
    fallback={fallback}
  >
    {children}
  </ResourceBasedAccess>
);

export const CanDelete: React.FC<{
  resource: ResourceType;
  resourceId?: string;
  context?: Record<string, any>;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}> = ({ resource, resourceId, context, fallback, children }) => (
  <ResourceBasedAccess 
    action={PermissionAction.DELETE} 
    resource={resource} 
    resourceId={resourceId}
    context={context} 
    fallback={fallback}
  >
    {children}
  </ResourceBasedAccess>
);

export const CanManage: React.FC<{
  resource: ResourceType;
  resourceId?: string;
  context?: Record<string, any>;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}> = ({ resource, resourceId, context, fallback, children }) => (
  <ResourceBasedAccess 
    action={PermissionAction.MANAGE} 
    resource={resource} 
    resourceId={resourceId}
    context={context} 
    fallback={fallback}
  >
    {children}
  </ResourceBasedAccess>
);

export default ResourceBasedAccess;