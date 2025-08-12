import React, { useState, useEffect, useMemo } from 'react';
import { 
  PermissionMatrix as PermissionMatrixType, 
  PermissionMatrixCell, 
  AdvancedRole, 
  Permission,
  ResourceType,
  PermissionAction 
} from '../../types/permissions';
import { permissionService } from '../../services/permissionService';
import { Check, X, Lock, Clock, AlertTriangle, Filter, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../common/Button';
import Input from '../common/Input';

interface PermissionMatrixProps {
  roleIds?: string[];
  onPermissionChange?: (roleId: string, permissionId: string, granted: boolean) => void;
  readOnly?: boolean;
  className?: string;
}

const PermissionMatrix: React.FC<PermissionMatrixProps> = ({
  roleIds,
  onPermissionChange,
  readOnly = false,
  className = ''
}) => {
  const [matrix, setMatrix] = useState<PermissionMatrixType | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [filterResource, setFilterResource] = useState<ResourceType | ''>('');
  const [filterAction, setFilterAction] = useState<PermissionAction | ''>('');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadMatrix();
  }, [roleIds]);

  const loadMatrix = async () => {
    try {
      setLoading(true);
      const response = await permissionService.getPermissionMatrix(roleIds);
      if (response.success) {
        setMatrix(response.data);
      }
    } catch (error) {
      console.error('Failed to load permission matrix:', error);
      toast.error('Failed to load permission matrix');
    } finally {
      setLoading(false);
    }
  };

  const handlePermissionToggle = async (roleId: string, permissionId: string, currentValue: boolean) => {
    if (readOnly) return;

    const key = `${roleId}-${permissionId}`;
    setUpdating(prev => ({ ...prev, [key]: true }));

    try {
      const newValue = !currentValue;
      
      // Optimistic update
      setMatrix(prev => {
        if (!prev) return null;
        
        return {
          ...prev,
          matrix: prev.matrix.map(row =>
            row.map(cell =>
              cell.role_id === roleId && cell.permission_id === permissionId
                ? { ...cell, is_granted: newValue }
                : cell
            )
          )
        };
      });

      // Make API call
      await permissionService.updatePermissionMatrix([{
        role_id: roleId,
        permission_id: permissionId,
        is_granted: newValue
      }]);

      onPermissionChange?.(roleId, permissionId, newValue);
      toast.success(`Permission ${newValue ? 'granted' : 'revoked'} successfully`);

    } catch (error: any) {
      console.error('Permission update failed:', error);
      toast.error(error.response?.data?.message || 'Failed to update permission');
      
      // Revert optimistic update
      loadMatrix();
    } finally {
      setUpdating(prev => ({ ...prev, [key]: false }));
    }
  };

  const getPermissionCell = (roleId: string, permissionId: string): PermissionMatrixCell | undefined => {
    if (!matrix) return undefined;
    
    for (const row of matrix.matrix) {
      const cell = row.find(cell => cell.role_id === roleId && cell.permission_id === permissionId);
      if (cell) return cell;
    }
    return undefined;
  };

  const filteredPermissions = useMemo(() => {
    if (!matrix) return [];

    return matrix.permissions.filter(permission => {
      const matchesSearch = searchTerm === '' || 
        permission.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        permission.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        permission.description?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesResource = filterResource === '' || permission.resource_type === filterResource;
      const matchesAction = filterAction === '' || permission.action === filterAction;

      return matchesSearch && matchesResource && matchesAction;
    });
  }, [matrix, searchTerm, filterResource, filterAction]);

  const groupedPermissions = useMemo(() => {
    const groups: Record<string, Permission[]> = {};
    
    filteredPermissions.forEach(permission => {
      const groupKey = `${permission.resource_type}`;
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(permission);
    });

    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredPermissions]);

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupKey]: !prev[groupKey]
    }));
  };

  const renderPermissionIcon = (cell: PermissionMatrixCell | undefined, isUpdating: boolean) => {
    if (isUpdating) {
      return <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />;
    }

    if (!cell) {
      return <div className="w-4 h-4 bg-gray-200 rounded" />;
    }

    if (cell.expires_at && new Date(cell.expires_at) < new Date()) {
      return <Clock className="w-4 h-4 text-orange-500" title="Expired" />;
    }

    if (cell.conditions?.length || cell.resource_constraints?.length) {
      return cell.is_granted ? (
        <div className="relative">
          <Check className="w-4 h-4 text-green-600" />
          <AlertTriangle className="w-2 h-2 text-orange-500 absolute -top-1 -right-1" title="Has conditions" />
        </div>
      ) : (
        <div className="relative">
          <X className="w-4 h-4 text-red-600" />
          <AlertTriangle className="w-2 h-2 text-orange-500 absolute -top-1 -right-1" title="Has conditions" />
        </div>
      );
    }

    return cell.is_granted ? (
      <Check className="w-4 h-4 text-green-600" />
    ) : (
      <X className="w-4 h-4 text-red-600" />
    );
  };

  const getCellClassName = (cell: PermissionMatrixCell | undefined, isUpdating: boolean) => {
    let baseClasses = 'w-12 h-8 flex items-center justify-center border border-gray-200 transition-colors';
    
    if (readOnly) {
      baseClasses += ' cursor-default';
    } else {
      baseClasses += ' cursor-pointer hover:bg-gray-100';
    }

    if (isUpdating) {
      baseClasses += ' bg-blue-50';
    } else if (cell?.is_granted) {
      baseClasses += ' bg-green-50';
    } else if (cell && !cell.is_granted) {
      baseClasses += ' bg-red-50';
    } else {
      baseClasses += ' bg-gray-50';
    }

    return baseClasses;
  };

  const exportMatrix = () => {
    if (!matrix) return;

    const csvData = [
      ['Role', ...matrix.permissions.map(p => p.display_name)],
      ...matrix.roles.map(role => [
        role.display_name,
        ...matrix.permissions.map(permission => {
          const cell = getPermissionCell(role.id, permission.id);
          return cell?.is_granted ? 'Yes' : 'No';
        })
      ])
    ];

    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `permission-matrix-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-lg border shadow-sm p-6 ${className}`}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          <span className="ml-3 text-gray-600">Loading permission matrix...</span>
        </div>
      </div>
    );
  }

  if (!matrix) {
    return (
      <div className={`bg-white rounded-lg border shadow-sm p-6 ${className}`}>
        <div className="text-center text-gray-500">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p className="text-lg font-medium mb-2">No Permission Data</p>
          <p>Unable to load the permission matrix.</p>
          <Button className="mt-4" onClick={loadMatrix}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg border shadow-sm ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Permission Matrix</h3>
            <p className="text-sm text-gray-600">
              Manage role-based permissions across {matrix.roles.length} roles and {matrix.permissions.length} permissions
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" onClick={exportMatrix} size="sm">
              Export CSV
            </Button>
            <Button variant="outline" onClick={loadMatrix} size="sm">
              Refresh
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-64">
            <Input
              placeholder="Search permissions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftIcon={<Search size={16} />}
              className="w-full"
            />
          </div>
          
          <select
            value={filterResource}
            onChange={(e) => setFilterResource(e.target.value as ResourceType | '')}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Resources</option>
            {Object.values(ResourceType).map(type => (
              <option key={type} value={type}>
                {type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ')}
              </option>
            ))}
          </select>
          
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value as PermissionAction | '')}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Actions</option>
            {Object.values(PermissionAction).map(action => (
              <option key={action} value={action}>
                {action.charAt(0).toUpperCase() + action.slice(1).replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Matrix */}
      <div className="overflow-auto">
        <div className="min-w-full">
          {/* Role Headers */}
          <div className="sticky top-0 bg-white border-b border-gray-200 z-10">
            <div className="flex">
              {/* Permission column header */}
              <div className="w-80 p-3 text-sm font-medium text-gray-900 border-r border-gray-200 bg-gray-50">
                Permission
              </div>
              
              {/* Role headers */}
              {matrix.roles.map(role => (
                <div
                  key={role.id}
                  className="w-12 p-1 text-xs font-medium text-center text-gray-900 border-r border-gray-200 bg-gray-50 truncate"
                  title={role.display_name}
                  style={{ writingMode: 'vertical-lr', textOrientation: 'mixed' }}
                >
                  {role.display_name}
                </div>
              ))}
            </div>
          </div>

          {/* Permission Rows by Group */}
          {groupedPermissions.map(([groupKey, permissions]) => {
            const isExpanded = expandedGroups[groupKey] ?? true;
            
            return (
              <div key={groupKey}>
                {/* Group Header */}
                <div 
                  className="flex items-center p-2 bg-gray-100 border-b border-gray-200 cursor-pointer hover:bg-gray-200"
                  onClick={() => toggleGroup(groupKey)}
                >
                  <Filter size={16} className="mr-2" />
                  <span className="font-medium text-gray-900">
                    {groupKey.replace('_', ' ').toUpperCase()} ({permissions.length})
                  </span>
                  <span className={`ml-auto transform transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                    ▶
                  </span>
                </div>

                {/* Group Permissions */}
                {isExpanded && permissions.map(permission => (
                  <div key={permission.id} className="flex border-b border-gray-200 hover:bg-gray-50">
                    {/* Permission Info */}
                    <div className="w-80 p-3 border-r border-gray-200">
                      <div className="font-medium text-sm text-gray-900">
                        {permission.display_name}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        {permission.action}:{permission.resource_type}:{permission.scope}
                      </div>
                      {permission.description && (
                        <div className="text-xs text-gray-500 mt-1">
                          {permission.description}
                        </div>
                      )}
                    </div>

                    {/* Permission Cells for Each Role */}
                    {matrix.roles.map(role => {
                      const cell = getPermissionCell(role.id, permission.id);
                      const key = `${role.id}-${permission.id}`;
                      const isUpdating = updating[key] || false;

                      return (
                        <div
                          key={role.id}
                          className={getCellClassName(cell, isUpdating)}
                          onClick={() => !readOnly && !isUpdating && handlePermissionToggle(role.id, permission.id, cell?.is_granted || false)}
                          title={`${role.display_name} - ${permission.display_name}: ${cell?.is_granted ? 'Granted' : 'Denied'}`}
                        >
                          {renderPermissionIcon(cell, isUpdating)}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center space-x-6 text-sm">
          <div className="flex items-center">
            <Check className="w-4 h-4 text-green-600 mr-2" />
            <span>Granted</span>
          </div>
          <div className="flex items-center">
            <X className="w-4 h-4 text-red-600 mr-2" />
            <span>Denied</span>
          </div>
          <div className="flex items-center">
            <div className="relative mr-2">
              <Check className="w-4 h-4 text-green-600" />
              <AlertTriangle className="w-2 h-2 text-orange-500 absolute -top-1 -right-1" />
            </div>
            <span>Conditional</span>
          </div>
          <div className="flex items-center">
            <Clock className="w-4 h-4 text-orange-500 mr-2" />
            <span>Expired</span>
          </div>
          <div className="flex items-center">
            <Lock className="w-4 h-4 text-gray-400 mr-2" />
            <span>System Role</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PermissionMatrix;