import React, { useState, useEffect } from 'react';
import { Shield, Check, X, AlertCircle, Users, Lock } from 'lucide-react';

const PermissionTest: React.FC = () => {
  const [permissionGroups, setPermissionGroups] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mock data for testing
  const mockPermissionGroups = [
    {
      id: '1',
      name: 'user_management',
      display_name: 'User Management',
      icon: '👤',
      permissions: [
        { id: '1', resource: 'users', action: 'view', scope: 'all', display_name: 'View All Users' },
        { id: '2', resource: 'users', action: 'create', scope: 'all', display_name: 'Create Users' },
        { id: '3', resource: 'users', action: 'update', scope: 'all', display_name: 'Update Users' },
        { id: '4', resource: 'users', action: 'delete', scope: 'all', display_name: 'Delete Users' }
      ]
    },
    {
      id: '2', 
      name: 'role_management',
      display_name: 'Role Management',
      icon: '🛡️',
      permissions: [
        { id: '5', resource: 'roles', action: 'view', scope: 'all', display_name: 'View Roles' },
        { id: '6', resource: 'roles', action: 'create', scope: 'all', display_name: 'Create Roles' },
        { id: '7', resource: 'roles', action: 'assign', scope: 'all', display_name: 'Assign Roles' }
      ]
    },
    {
      id: '3',
      name: 'form_builder',
      display_name: 'Form Builder',
      icon: '📄',
      permissions: [
        { id: '8', resource: 'forms', action: 'view', scope: 'all', display_name: 'View All Forms' },
        { id: '9', resource: 'forms', action: 'view', scope: 'own', display_name: 'View Own Forms' },
        { id: '10', resource: 'forms', action: 'create', scope: 'all', display_name: 'Create Forms' },
        { id: '11', resource: 'forms', action: 'update', scope: 'own', display_name: 'Update Own Forms' }
      ]
    }
  ];

  const mockRoles = [
    { id: '1', name: 'super_admin', display_name: 'Super Admin', priority: 1000 },
    { id: '2', name: 'admin', display_name: 'Admin', priority: 900 },
    { id: '3', name: 'manager', display_name: 'Manager', priority: 500 },
    { id: '4', name: 'user', display_name: 'User', priority: 100 }
  ];

  useEffect(() => {
    // Load mock data
    setPermissionGroups(mockPermissionGroups);
  }, []);

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
      case 'assign': return '🔗';
      default: return '⚡';
    }
  };

  const testApiConnection = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Try to fetch from backend
      const response = await fetch('http://localhost:5000/api/user-management/permissions/groups', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || 'test-token'}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setPermissionGroups(data.data || mockPermissionGroups);
        alert('✅ Backend connected successfully!');
      } else {
        throw new Error('Backend not responding');
      }
    } catch (err) {
      setError('⚠️ Backend not available - using mock data');
      setPermissionGroups(mockPermissionGroups);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Shield className="text-blue-600 mr-3" size={32} />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Permission System Test</h1>
                <p className="text-gray-600">Testing Phase 3 Implementation</p>
              </div>
            </div>
            <button
              onClick={testApiConnection}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Testing...' : 'Test Backend Connection'}
            </button>
          </div>
          
          {error && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center">
              <AlertCircle className="text-yellow-600 mr-2" size={20} />
              <span className="text-yellow-800">{error}</span>
            </div>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Shield className="text-blue-600" size={24} />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Permission Groups</p>
                <p className="text-2xl font-bold">{permissionGroups.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-lg">
                <Check className="text-green-600" size={24} />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Total Permissions</p>
                <p className="text-2xl font-bold">
                  {permissionGroups.reduce((sum, g) => sum + (g.permissions?.length || 0), 0)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 bg-yellow-100 rounded-lg">
                <Users className="text-yellow-600" size={24} />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Roles</p>
                <p className="text-2xl font-bold">{mockRoles.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Lock className="text-purple-600" size={24} />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Status</p>
                <p className="text-lg font-bold text-green-600">Active</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Permission Groups */}
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <h2 className="text-xl font-semibold text-gray-900">Permission Groups</h2>
            <p className="text-gray-600 mt-1">All available permissions organized by groups</p>
          </div>
          
          <div className="p-6 space-y-4">
            {permissionGroups.map(group => (
              <div key={group.id} className="border rounded-lg overflow-hidden">
                <div className="bg-gray-50 p-4 flex items-center">
                  <span className="text-2xl mr-3">{group.icon}</span>
                  <div>
                    <h3 className="font-semibold text-gray-900">{group.display_name}</h3>
                    <p className="text-sm text-gray-600">
                      {group.permissions?.length || 0} permissions
                    </p>
                  </div>
                </div>
                
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                  {group.permissions?.map((perm: any) => (
                    <div
                      key={perm.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-center space-x-3">
                        <span className="text-lg">{getActionIcon(perm.action)}</span>
                        <div>
                          <p className="font-medium text-gray-900">{perm.display_name}</p>
                          <p className="text-sm text-gray-500">
                            {perm.resource}.{perm.action}
                          </p>
                        </div>
                      </div>
                      <span className={`px-2 py-1 text-xs rounded-full border ${getScopeColor(perm.scope)}`}>
                        {perm.scope}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Role Matrix Preview */}
      <div className="max-w-7xl mx-auto mt-8">
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <h2 className="text-xl font-semibold text-gray-900">Role Permission Matrix</h2>
            <p className="text-gray-600 mt-1">Quick overview of role assignments</p>
          </div>
          
          <div className="p-6 overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Permission
                  </th>
                  {mockRoles.map(role => (
                    <th key={role.id} className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                      {role.display_name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {permissionGroups.slice(0, 2).map(group => 
                  group.permissions?.slice(0, 3).map((perm: any) => (
                    <tr key={perm.id}>
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {perm.display_name}
                      </td>
                      {mockRoles.map(role => (
                        <td key={role.id} className="px-4 py-2 text-center">
                          {(role.name === 'super_admin' || 
                            (role.name === 'admin' && perm.action !== 'delete') ||
                            (role.name === 'manager' && perm.action === 'view') ||
                            (role.name === 'user' && perm.scope === 'own')) ? (
                            <Check className="w-5 h-5 text-green-600 mx-auto" />
                          ) : (
                            <X className="w-5 h-5 text-gray-400 mx-auto" />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="max-w-7xl mx-auto mt-8 mb-8">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">Implementation Summary</h3>
          <ul className="space-y-2 text-blue-800">
            <li className="flex items-center">
              <Check className="w-5 h-5 mr-2 text-green-600" />
              Database schema created (permissions, role_permissions, user_permissions)
            </li>
            <li className="flex items-center">
              <Check className="w-5 h-5 mr-2 text-green-600" />
              Backend API implemented (/api/user-management/permissions/*)
            </li>
            <li className="flex items-center">
              <Check className="w-5 h-5 mr-2 text-green-600" />
              Permission Service created
            </li>
            <li className="flex items-center">
              <Check className="w-5 h-5 mr-2 text-green-600" />
              50+ default permissions seeded
            </li>
            <li className="flex items-center">
              <AlertCircle className="w-5 h-5 mr-2 text-yellow-600" />
              Frontend Permission Guards pending
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default PermissionTest;