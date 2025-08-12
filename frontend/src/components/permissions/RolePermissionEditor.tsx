import React, { useState, useEffect } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { 
  AdvancedRole, 
  Permission, 
  PermissionGroup, 
  RolePermission,
  PermissionAction,
  ResourceType,
  PermissionScope,
  CreatePermissionRequest 
} from '../../types/permissions';
import { permissionService } from '../../services/permissionService';
import { 
  Shield, 
  Plus, 
  Trash2, 
  Edit3, 
  Save, 
  X, 
  Search, 
  Filter,
  GripVertical,
  Eye,
  EyeOff,
  Copy,
  Settings,
  AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../common/Button';
import Input from '../common/Input';
// import Modal from '../common/Modal'; // Temporarily disabled

interface RolePermissionEditorProps {
  role: AdvancedRole;
  onRoleUpdate: (role: AdvancedRole) => void;
  className?: string;
}

// Sortable Permission Item Component
const SortablePermissionItem: React.FC<{
  permission: Permission;
  rolePermission?: RolePermission;
  isGranted: boolean;
  onToggle: (permissionId: string, granted: boolean) => void;
  onEdit: (permission: Permission) => void;
  onDelete: (permissionId: string) => void;
  readOnly?: boolean;
}> = ({ permission, rolePermission, isGranted, onToggle, onEdit, onDelete, readOnly = false }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: permission.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  };

  const getActionIcon = (action: PermissionAction) => {
    const icons = {
      create: Plus,
      read: Eye,
      update: Edit3,
      delete: Trash2,
      list: Filter,
      assign: Copy,
      approve: Shield,
      reject: X,
      export: Save,
      import: Plus,
      manage: Settings,
      execute: Settings,
      configure: Settings
    };
    
    const Icon = icons[action] || Shield;
    return <Icon size={16} />;
  };

  const getScopeColor = (scope: PermissionScope) => {
    const colors = {
      global: 'bg-red-100 text-red-800',
      organization: 'bg-blue-100 text-blue-800',
      department: 'bg-green-100 text-green-800',
      team: 'bg-yellow-100 text-yellow-800',
      project: 'bg-purple-100 text-purple-800',
      own: 'bg-gray-100 text-gray-800'
    };
    
    return colors[scope] || colors.own;
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white border border-gray-200 rounded-lg p-4 transition-all ${
        isDragging ? 'shadow-lg z-10' : 'hover:shadow-sm'
      }`}
    >
      <div className="flex items-center space-x-3">
        {/* Drag Handle */}
        {!readOnly && (
          <div {...attributes} {...listeners} className="cursor-grab hover:cursor-grabbing">
            <GripVertical size={16} className="text-gray-400" />
          </div>
        )}

        {/* Permission Toggle */}
        <div className="flex items-center">
          <input
            type="checkbox"
            checked={isGranted}
            onChange={(e) => onToggle(permission.id, e.target.checked)}
            disabled={readOnly}
            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
        </div>

        {/* Permission Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2 mb-1">
            {getActionIcon(permission.action)}
            <span className="font-medium text-gray-900 truncate">
              {permission.display_name}
            </span>
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getScopeColor(permission.scope)}`}>
              {permission.scope}
            </span>
            {permission.is_system && (
              <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
                System
              </span>
            )}
          </div>
          
          <div className="text-sm text-gray-600">
            {permission.action}:{permission.resource_type}
          </div>
          
          {permission.description && (
            <div className="text-sm text-gray-500 mt-1">
              {permission.description}
            </div>
          )}

          {/* Role Permission Conditions */}
          {rolePermission?.conditions?.length && (
            <div className="mt-2 flex items-center space-x-1 text-xs text-orange-600">
              <AlertTriangle size={12} />
              <span>{rolePermission.conditions.length} condition(s) applied</span>
            </div>
          )}

          {rolePermission?.expires_at && (
            <div className="mt-1 text-xs text-orange-600">
              Expires: {new Date(rolePermission.expires_at).toLocaleDateString()}
            </div>
          )}
        </div>

        {/* Actions */}
        {!readOnly && (
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(permission)}
              className="text-gray-400 hover:text-blue-600"
            >
              <Edit3 size={16} />
            </Button>
            
            {!permission.is_system && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(permission.id)}
                className="text-gray-400 hover:text-red-600"
              >
                <Trash2 size={16} />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const RolePermissionEditor: React.FC<RolePermissionEditorProps> = ({
  role,
  onRoleUpdate,
  className = ''
}) => {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [permissionGroups, setPermissionGroups] = useState<PermissionGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterResource, setFilterResource] = useState<ResourceType | ''>('');
  const [filterAction, setFilterAction] = useState<PermissionAction | ''>('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPermission, setEditingPermission] = useState<Permission | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [newPermission, setNewPermission] = useState<CreatePermissionRequest>({
    name: '',
    display_name: '',
    description: '',
    action: PermissionAction.READ,
    resource_type: ResourceType.USER,
    scope: PermissionScope.OWN
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    loadPermissions();
    loadPermissionGroups();
  }, []);

  const loadPermissions = async () => {
    try {
      setLoading(true);
      const response = await permissionService.getPermissions();
      if (response.success) {
        setPermissions(response.data);
      }
    } catch (error) {
      console.error('Failed to load permissions:', error);
      toast.error('Failed to load permissions');
    } finally {
      setLoading(false);
    }
  };

  const loadPermissionGroups = async () => {
    try {
      const response = await permissionService.getPermissionGroups();
      if (response.success) {
        setPermissionGroups(response.data);
      }
    } catch (error) {
      console.error('Failed to load permission groups:', error);
    }
  };

  const handlePermissionToggle = async (permissionId: string, granted: boolean) => {
    try {
      setUpdating(true);
      
      if (granted) {
        // Assign permission to role
        await permissionService.assignPermissionToRole(role.id, {
          permission_id: permissionId,
          is_granted: true
        });
      } else {
        // Remove permission from role
        await permissionService.removePermissionFromRole(role.id, permissionId);
      }

      // Update local state optimistically
      const updatedRole = {
        ...role,
        permissions: granted 
          ? [...role.permissions, { 
              id: 'temp', 
              role_id: role.id, 
              permission_id: permissionId, 
              is_granted: true, 
              priority: 0,
              granted_at: new Date().toISOString()
            }]
          : role.permissions.filter(rp => rp.permission_id !== permissionId)
      };

      onRoleUpdate(updatedRole);
      toast.success(`Permission ${granted ? 'granted' : 'revoked'} successfully`);

    } catch (error: any) {
      console.error('Failed to update permission:', error);
      toast.error(error.response?.data?.message || 'Failed to update permission');
    } finally {
      setUpdating(false);
    }
  };

  const handleDragEnd = async (event: any) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = permissions.findIndex(p => p.id === active.id);
      const newIndex = permissions.findIndex(p => p.id === over.id);
      
      const newPermissions = arrayMove(permissions, oldIndex, newIndex);
      setPermissions(newPermissions);

      // Optional: Save the new order to the server
      try {
        // Implementation depends on backend support for permission ordering
      } catch (error) {
        console.error('Failed to save permission order:', error);
      }
    }
  };

  const handleCreatePermission = async () => {
    try {
      setUpdating(true);
      const response = await permissionService.createPermission(newPermission);
      
      if (response.success) {
        setPermissions([...permissions, response.data]);
        setShowCreateModal(false);
        setNewPermission({
          name: '',
          display_name: '',
          description: '',
          action: PermissionAction.READ,
          resource_type: ResourceType.USER,
          scope: PermissionScope.OWN
        });
        toast.success('Permission created successfully');
      }
    } catch (error: any) {
      console.error('Failed to create permission:', error);
      toast.error(error.response?.data?.message || 'Failed to create permission');
    } finally {
      setUpdating(false);
    }
  };

  const handleDeletePermission = async (permissionId: string) => {
    if (!confirm('Are you sure you want to delete this permission? This action cannot be undone.')) {
      return;
    }

    try {
      setUpdating(true);
      await permissionService.deletePermission(permissionId);
      setPermissions(permissions.filter(p => p.id !== permissionId));
      toast.success('Permission deleted successfully');
    } catch (error: any) {
      console.error('Failed to delete permission:', error);
      toast.error(error.response?.data?.message || 'Failed to delete permission');
    } finally {
      setUpdating(false);
    }
  };

  const filteredPermissions = permissions.filter(permission => {
    const matchesSearch = searchTerm === '' || 
      permission.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      permission.name.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesResource = filterResource === '' || permission.resource_type === filterResource;
    const matchesAction = filterAction === '' || permission.action === filterAction;

    return matchesSearch && matchesResource && matchesAction;
  });

  const groupedPermissions = permissionGroups.length > 0 ? 
    permissionGroups.map(group => ({
      ...group,
      permissions: filteredPermissions.filter(p => 
        group.permissions.some(gp => gp.id === p.id)
      )
    })).filter(group => group.permissions.length > 0) :
    [{ 
      id: 'all', 
      name: 'all_permissions', 
      display_name: 'All Permissions', 
      permissions: filteredPermissions, 
      order: 0, 
      is_system: false 
    }];

  const isPermissionGranted = (permissionId: string) => {
    return role.permissions.some(rp => rp.permission_id === permissionId && rp.is_granted);
  };

  const getRolePermission = (permissionId: string) => {
    return role.permissions.find(rp => rp.permission_id === permissionId);
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-lg border shadow-sm p-6 ${className}`}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          <span className="ml-3 text-gray-600">Loading permissions...</span>
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
            <h3 className="text-lg font-semibold text-gray-900">
              Edit Permissions for "{role.display_name}"
            </h3>
            <p className="text-sm text-gray-600">
              Drag and drop to reorder, toggle to grant/revoke permissions
            </p>
          </div>
          
          <Button onClick={() => setShowCreateModal(true)} size="sm">
            <Plus size={16} className="mr-2" />
            Create Permission
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-64">
            <Input
              placeholder="Search permissions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftIcon={<Search size={16} />}
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

      {/* Permission Groups */}
      <div className="max-h-96 overflow-y-auto">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          {groupedPermissions.map(group => {
            const isExpanded = expandedGroups[group.id] ?? true;
            
            return (
              <div key={group.id} className="border-b border-gray-100">
                {/* Group Header */}
                <div 
                  className="p-4 bg-gray-50 cursor-pointer hover:bg-gray-100"
                  onClick={() => setExpandedGroups(prev => ({
                    ...prev,
                    [group.id]: !isExpanded
                  }))}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Shield size={16} className="text-gray-400" />
                      <span className="font-medium text-gray-900">{group.display_name}</span>
                      <span className="text-sm text-gray-500">({group.permissions.length})</span>
                    </div>
                    <div className={`transform transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                      ▶
                    </div>
                  </div>
                </div>

                {/* Group Permissions */}
                {isExpanded && (
                  <div className="p-4 space-y-3">
                    <SortableContext 
                      items={group.permissions.map(p => p.id)} 
                      strategy={verticalListSortingStrategy}
                    >
                      {group.permissions.map(permission => (
                        <SortablePermissionItem
                          key={permission.id}
                          permission={permission}
                          rolePermission={getRolePermission(permission.id)}
                          isGranted={isPermissionGranted(permission.id)}
                          onToggle={handlePermissionToggle}
                          onEdit={setEditingPermission}
                          onDelete={handleDeletePermission}
                          readOnly={updating}
                        />
                      ))}
                    </SortableContext>
                  </div>
                )}
              </div>
            );
          })}
        </DndContext>
      </div>

      {/* Create Permission Form - Temporarily inline */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-screen overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Create New Permission</h3>
              <button 
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            
            <div className="space-y-4">
              <Input
                label="Permission Name"
                value={newPermission.name}
                onChange={(e) => setNewPermission(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., user_create"
              />
              
              <Input
                label="Display Name"
                value={newPermission.display_name}
                onChange={(e) => setNewPermission(prev => ({ ...prev, display_name: e.target.value }))}
                placeholder="e.g., Create User"
              />
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={newPermission.description}
                  onChange={(e) => setNewPermission(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                  placeholder="Describe what this permission allows..."
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Action
                  </label>
                  <select
                    value={newPermission.action}
                    onChange={(e) => setNewPermission(prev => ({ 
                      ...prev, 
                      action: e.target.value as PermissionAction 
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {Object.values(PermissionAction).map(action => (
                      <option key={action} value={action}>
                        {action.charAt(0).toUpperCase() + action.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Resource
                  </label>
                  <select
                    value={newPermission.resource_type}
                    onChange={(e) => setNewPermission(prev => ({ 
                      ...prev, 
                      resource_type: e.target.value as ResourceType 
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {Object.values(ResourceType).map(type => (
                      <option key={type} value={type}>
                        {type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ')}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Scope
                  </label>
                  <select
                    value={newPermission.scope}
                    onChange={(e) => setNewPermission(prev => ({ 
                      ...prev, 
                      scope: e.target.value as PermissionScope 
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {Object.values(PermissionScope).map(scope => (
                      <option key={scope} value={scope}>
                        {scope.charAt(0).toUpperCase() + scope.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreatePermission}
                  isLoading={updating}
                >
                  Create Permission
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RolePermissionEditor;