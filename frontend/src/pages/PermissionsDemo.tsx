import React, { useState } from 'react';
import { 
  Shield, Users, Key, Settings, BarChart3, Search, 
  ChevronDown, ChevronRight, Check, X, Lock, AlertCircle,
  Eye, Edit, Trash, Plus, Save, Clock, Filter, Download
} from 'lucide-react';

const PermissionsDemo: React.FC = () => {
  const [selectedTab, setSelectedTab] = useState<'tree' | 'matrix' | 'guard'>('tree');
  const [expandedGroups, setExpandedGroups] = useState<string[]>(['user_management']);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([
    'users.view', 'users.create', 'forms.view.own', 'forms.create'
  ]);
  const [selectedRole, setSelectedRole] = useState('admin');
  const [showAssignModal, setShowAssignModal] = useState(false);

  // Mock data
  const permissionGroups = [
    {
      id: 'user_management',
      name: 'user_management',
      display_name: 'User Management',
      icon: '👤',
      description: 'Manage users and their access',
      permissions: [
        { id: 'users.view', name: 'users.view', action: 'view', scope: 'all', description: 'View all users' },
        { id: 'users.create', name: 'users.create', action: 'create', scope: 'all', description: 'Create new users' },
        { id: 'users.update', name: 'users.update', action: 'update', scope: 'all', description: 'Update any user' },
        { id: 'users.delete', name: 'users.delete', action: 'delete', scope: 'all', description: 'Delete users' },
        { id: 'users.approve', name: 'users.approve', action: 'approve', scope: 'all', description: 'Approve/disapprove users' },
        { id: 'users.block', name: 'users.block', action: 'block', scope: 'all', description: 'Block/unblock users' }
      ]
    },
    {
      id: 'role_management',
      name: 'role_management',
      display_name: 'Role Management',
      icon: '🛡️',
      description: 'Manage roles and permissions',
      permissions: [
        { id: 'roles.view', name: 'roles.view', action: 'view', scope: 'all', description: 'View all roles' },
        { id: 'roles.create', name: 'roles.create', action: 'create', scope: 'all', description: 'Create new roles' },
        { id: 'roles.update', name: 'roles.update', action: 'update', scope: 'all', description: 'Update roles' },
        { id: 'roles.delete', name: 'roles.delete', action: 'delete', scope: 'all', description: 'Delete roles' },
        { id: 'roles.assign', name: 'roles.assign', action: 'assign', scope: 'all', description: 'Assign roles to users' }
      ]
    },
    {
      id: 'form_builder',
      name: 'form_builder',
      display_name: 'Form Builder',
      icon: '📄',
      description: 'Create and manage forms',
      permissions: [
        { id: 'forms.view', name: 'forms.view', action: 'view', scope: 'all', description: 'View all forms' },
        { id: 'forms.view.own', name: 'forms.view.own', action: 'view', scope: 'own', description: 'View own forms' },
        { id: 'forms.create', name: 'forms.create', action: 'create', scope: 'all', description: 'Create new forms' },
        { id: 'forms.update', name: 'forms.update', action: 'update', scope: 'all', description: 'Update any form' },
        { id: 'forms.delete', name: 'forms.delete', action: 'delete', scope: 'all', description: 'Delete any form' }
      ]
    }
  ];

  const roles = [
    { id: 'super_admin', name: 'super_admin', display_name: 'Super Admin', priority: 1000, color: 'red' },
    { id: 'admin', name: 'admin', display_name: 'Admin', priority: 900, color: 'orange' },
    { id: 'manager', name: 'manager', display_name: 'Manager', priority: 500, color: 'yellow' },
    { id: 'user', name: 'user', display_name: 'User', priority: 100, color: 'green' }
  ];

  const resources = ['Users', 'Roles', 'Forms', 'Reports'];
  const actions = ['View', 'Create', 'Update', 'Delete'];

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev =>
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  const togglePermission = (permissionId: string) => {
    setSelectedPermissions(prev =>
      prev.includes(permissionId)
        ? prev.filter(id => id !== permissionId)
        : [...prev, permissionId]
    );
  };

  const getScopeColor = (scope: string) => {
    switch (scope) {
      case 'all': return 'bg-red-100 text-red-700 border-red-300';
      case 'department': return 'bg-orange-100 text-orange-700 border-orange-300';
      case 'group': return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'own': return 'bg-green-100 text-green-700 border-green-300';
      default: return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'create': return '➕';
      case 'view': return '👁️';
      case 'update': return '✏️';
      case 'delete': return '🗑️';
      case 'approve': return '✅';
      case 'block': return '🚫';
      case 'assign': return '🔗';
      default: return '⚡';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Shield className="text-blue-600 mr-3" size={28} />
              <h1 className="text-xl font-bold text-gray-900">Permissions Management System</h1>
            </div>
            <div className="flex items-center space-x-4">
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center">
                <Plus size={16} className="mr-2" />
                Add Permission
              </button>
              <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center">
                <Download size={16} className="mr-2" />
                Export
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Shield className="text-blue-600" size={24} />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Total Permissions</p>
                <p className="text-2xl font-bold text-gray-900">48</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-lg">
                <Users className="text-green-600" size={24} />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Active Roles</p>
                <p className="text-2xl font-bold text-gray-900">4</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 bg-yellow-100 rounded-lg">
                <Key className="text-yellow-600" size={24} />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Permission Groups</p>
                <p className="text-2xl font-bold text-gray-900">7</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 bg-purple-100 rounded-lg">
                <BarChart3 className="text-purple-600" size={24} />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Avg. per Role</p>
                <p className="text-2xl font-bold text-gray-900">15</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-t-lg border-b">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            <button
              onClick={() => setSelectedTab('tree')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                selectedTab === 'tree'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Permission Tree View
            </button>
            <button
              onClick={() => setSelectedTab('matrix')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                selectedTab === 'matrix'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Permission Matrix
            </button>
            <button
              onClick={() => setSelectedTab('guard')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                selectedTab === 'guard'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Permission Guards Demo
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-b-lg shadow-sm p-6">
          {/* Tree View Tab */}
          {selectedTab === 'tree' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Assign Permissions to Role: <span className="text-blue-600">{selectedRole}</span>
                </h2>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {roles.map(role => (
                    <option key={role.id} value={role.name}>{role.display_name}</option>
                  ))}
                </select>
              </div>

              {permissionGroups.map(group => {
                const isExpanded = expandedGroups.includes(group.id);
                const selectedCount = group.permissions.filter(p => 
                  selectedPermissions.includes(p.id)
                ).length;

                return (
                  <div key={group.id} className="border rounded-lg overflow-hidden">
                    <div 
                      className="flex items-center justify-between p-4 bg-gray-50 cursor-pointer hover:bg-gray-100"
                      onClick={() => toggleGroup(group.id)}
                    >
                      <div className="flex items-center space-x-3">
                        <button className="p-1">
                          {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                        </button>
                        <span className="text-2xl">{group.icon}</span>
                        <div>
                          <h3 className="font-semibold text-gray-900">{group.display_name}</h3>
                          <p className="text-sm text-gray-500">{group.description}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-3">
                        <span className="text-sm text-gray-600">
                          {selectedCount}/{group.permissions.length} selected
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            group.permissions.forEach(p => {
                              if (!selectedPermissions.includes(p.id)) {
                                togglePermission(p.id);
                              }
                            });
                          }}
                          className="px-3 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200"
                        >
                          Select All
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="p-4 space-y-2">
                        {group.permissions.map(permission => {
                          const isSelected = selectedPermissions.includes(permission.id);
                          
                          return (
                            <div
                              key={permission.id}
                              className={`flex items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer ${
                                isSelected 
                                  ? 'bg-blue-50 border-blue-300' 
                                  : 'bg-white border-gray-200 hover:bg-gray-50'
                              }`}
                              onClick={() => togglePermission(permission.id)}
                            >
                              <div className="flex items-center space-x-3">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {}}
                                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                
                                <span className="text-lg">{getActionIcon(permission.action)}</span>
                                
                                <div>
                                  <div className="flex items-center space-x-2">
                                    <span className="font-medium text-gray-900">
                                      {permission.name}
                                    </span>
                                    <span className={`px-2 py-0.5 text-xs rounded-full border ${getScopeColor(permission.scope)}`}>
                                      {permission.scope}
                                    </span>
                                  </div>
                                  <p className="text-sm text-gray-500 mt-1">
                                    {permission.description}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="mt-6 flex justify-end space-x-3">
                <button className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
                <button className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center">
                  <Save size={16} className="mr-2" />
                  Save Permissions
                </button>
              </div>
            </div>
          )}

          {/* Matrix View Tab */}
          {selectedTab === 'matrix' && (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr>
                    <th className="px-4 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Resource / Role
                    </th>
                    {roles.map(role => (
                      <th key={role.id} colSpan={4} className="px-4 py-3 bg-gray-50 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-l">
                        <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-${role.color}-100 text-${role.color}-800`}>
                          {role.display_name}
                        </div>
                      </th>
                    ))}
                  </tr>
                  <tr>
                    <th className="px-4 py-2 bg-gray-100"></th>
                    {roles.map(role => (
                      <React.Fragment key={role.id}>
                        {actions.map(action => (
                          <th key={`${role.id}-${action}`} className="px-2 py-2 bg-gray-100 text-xs text-gray-600 border-l">
                            {action}
                          </th>
                        ))}
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {resources.map(resource => (
                    <tr key={resource}>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                        {resource}
                      </td>
                      {roles.map(role => (
                        <React.Fragment key={role.id}>
                          {actions.map(action => {
                            // Mock permission logic
                            const hasPermission = 
                              (role.name === 'super_admin') ||
                              (role.name === 'admin' && action !== 'Delete') ||
                              (role.name === 'manager' && (action === 'View' || action === 'Create')) ||
                              (role.name === 'user' && action === 'View');
                            
                            return (
                              <td key={`${role.id}-${resource}-${action}`} className="px-2 py-3 whitespace-nowrap text-center border-l">
                                {hasPermission ? (
                                  <div className="inline-flex items-center justify-center w-6 h-6 bg-green-100 rounded">
                                    <Check className="w-4 h-4 text-green-600" />
                                  </div>
                                ) : (
                                  <div className="inline-flex items-center justify-center w-6 h-6 bg-gray-100 rounded">
                                    <X className="w-4 h-4 text-gray-400" />
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </React.Fragment>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <div className="flex items-center">
                  <AlertCircle className="text-yellow-600 mr-2" size={20} />
                  <p className="text-sm text-yellow-800">
                    Click on any permission cell to toggle access. Changes will be saved automatically.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Permission Guards Demo Tab */}
          {selectedTab === 'guard' && (
            <div className="space-y-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Current User Role: Admin</h3>
                <p className="text-sm text-gray-600">
                  The following UI elements are conditionally rendered based on permissions:
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Permission Granted Examples */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-green-700">✅ Accessible (Admin has permission)</h4>
                  
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-green-800">users.view</span>
                      <Check className="text-green-600" size={16} />
                    </div>
                    <button className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                      View Users List
                    </button>
                  </div>

                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-green-800">forms.create</span>
                      <Check className="text-green-600" size={16} />
                    </div>
                    <button className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
                      Create New Form
                    </button>
                  </div>

                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-green-800">reports.view</span>
                      <Check className="text-green-600" size={16} />
                    </div>
                    <div className="p-3 bg-white rounded">
                      <h5 className="font-semibold text-gray-900">Analytics Dashboard</h5>
                      <p className="text-sm text-gray-600 mt-1">View system reports and analytics</p>
                    </div>
                  </div>
                </div>

                {/* Permission Denied Examples */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-red-700">🚫 Restricted (Admin lacks permission)</h4>
                  
                  <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-red-800">system.settings</span>
                      <Lock className="text-red-600" size={16} />
                    </div>
                    <div className="p-3 bg-gray-100 rounded opacity-50">
                      <p className="text-center text-gray-500">System Settings</p>
                      <p className="text-xs text-center text-gray-400 mt-1">Access Denied</p>
                    </div>
                  </div>

                  <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-red-800">users.delete</span>
                      <Lock className="text-red-600" size={16} />
                    </div>
                    <button disabled className="w-full px-4 py-2 bg-gray-300 text-gray-500 rounded cursor-not-allowed">
                      Delete User (Disabled)
                    </button>
                  </div>

                  <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-red-800">audit.view</span>
                      <Lock className="text-red-600" size={16} />
                    </div>
                    <div className="text-center py-4">
                      <Lock className="mx-auto text-gray-400 mb-2" size={32} />
                      <p className="text-sm text-gray-600">Audit Logs</p>
                      <p className="text-xs text-gray-400">Insufficient permissions</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-start">
                  <AlertCircle className="text-blue-600 mr-2 mt-0.5" size={20} />
                  <div className="text-sm text-blue-800">
                    <p className="font-semibold mb-1">How Permission Guards Work:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Components check user permissions before rendering</li>
                      <li>Unauthorized elements are hidden or disabled</li>
                      <li>Fallback UI shown for restricted content</li>
                      <li>Works on buttons, forms, pages, and any UI element</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Assign Permissions Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">
                Assign Permissions to Admin Role
              </h2>
              <button
                onClick={() => setShowAssignModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="space-y-4">
                {permissionGroups.map(group => (
                  <div key={group.id} className="border rounded-lg p-4">
                    <h3 className="font-semibold mb-3">{group.display_name}</h3>
                    <div className="space-y-2">
                      {group.permissions.map(permission => (
                        <label key={permission.id} className="flex items-center space-x-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedPermissions.includes(permission.id)}
                            onChange={() => togglePermission(permission.id)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-700">{permission.description}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-6 py-4 border-t bg-gray-50 flex justify-end space-x-3">
              <button
                onClick={() => setShowAssignModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Save Permissions
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PermissionsDemo;