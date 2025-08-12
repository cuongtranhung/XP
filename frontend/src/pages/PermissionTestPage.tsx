import React, { useState, useEffect } from 'react';
import { usePermissions } from '../hooks/usePermissions';
import { useAuth } from '../contexts/AuthContext';
import { 
  PermissionAction, 
  ResourceType, 
  PermissionScope,
  AdvancedRole,
  Permission 
} from '../types/permissions';
import { permissionService } from '../services/permissionService';
import PermissionMatrix from '../components/permissions/PermissionMatrix';
import ResourceBasedAccess from '../components/permissions/ResourceBasedAccess';
import RolePermissionEditor from '../components/permissions/RolePermissionEditor';
import Button from '../components/common/Button';
import { 
  Shield, 
  User, 
  Settings, 
  Lock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Eye,
  Edit,
  Trash2,
  UserPlus,
  Save
} from 'lucide-react';
import toast from 'react-hot-toast';

interface TestScenario {
  id: string;
  name: string;
  description: string;
  action: PermissionAction;
  resource: ResourceType;
  resourceId?: string;
  context?: any;
  expectedResult: boolean;
}

const PermissionTestPage: React.FC = () => {
  const { user } = useAuth();
  const { 
    permissions,
    checkPermission,
    checkPermissions,
    bulkCheckPermissions,
    isLoading,
    canCreate,
    canRead,
    canUpdate,
    canDelete,
    canManage,
    isAdmin,
    isManager,
    permissionGroups,
    refreshPermissions
  } = usePermissions();

  const [roles, setRoles] = useState<AdvancedRole[]>([]);
  const [selectedRole, setSelectedRole] = useState<AdvancedRole | null>(null);
  const [testResults, setTestResults] = useState<Record<string, boolean>>({});
  const [bulkTestResults, setBulkTestResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Test scenarios
  const testScenarios: TestScenario[] = [
    {
      id: 'user_create',
      name: 'Create User',
      description: 'Test if user can create new users',
      action: PermissionAction.CREATE,
      resource: ResourceType.USER,
      expectedResult: false // Update based on your test user's permissions
    },
    {
      id: 'user_read',
      name: 'Read User',
      description: 'Test if user can read user information',
      action: PermissionAction.READ,
      resource: ResourceType.USER,
      expectedResult: true
    },
    {
      id: 'user_update',
      name: 'Update User',
      description: 'Test if user can update user information',
      action: PermissionAction.UPDATE,
      resource: ResourceType.USER,
      resourceId: user?.id,
      expectedResult: true // Should be able to update own profile
    },
    {
      id: 'user_delete',
      name: 'Delete User',
      description: 'Test if user can delete users',
      action: PermissionAction.DELETE,
      resource: ResourceType.USER,
      expectedResult: false
    },
    {
      id: 'role_manage',
      name: 'Manage Roles',
      description: 'Test if user can manage roles',
      action: PermissionAction.MANAGE,
      resource: ResourceType.ROLE,
      expectedResult: false
    },
    {
      id: 'form_create',
      name: 'Create Form',
      description: 'Test if user can create forms',
      action: PermissionAction.CREATE,
      resource: ResourceType.FORM,
      expectedResult: true
    },
    {
      id: 'system_configure',
      name: 'Configure System',
      description: 'Test if user can configure system settings',
      action: PermissionAction.CONFIGURE,
      resource: ResourceType.SYSTEM_CONFIG,
      expectedResult: false
    }
  ];

  useEffect(() => {
    loadRoles();
  }, []);

  const loadRoles = async () => {
    try {
      setLoading(true);
      const response = await permissionService.getAdvancedRoles();
      if (response.success) {
        setRoles(response.data);
        if (response.data.length > 0) {
          setSelectedRole(response.data[0]);
        }
      }
    } catch (error) {
      console.error('Failed to load roles:', error);
      toast.error('Failed to load roles');
    } finally {
      setLoading(false);
    }
  };

  const runIndividualTests = () => {
    const results: Record<string, boolean> = {};
    
    testScenarios.forEach(scenario => {
      const result = checkPermission(
        scenario.action, 
        scenario.resource, 
        scenario.resourceId, 
        scenario.context
      );
      results[scenario.id] = result;
    });
    
    setTestResults(results);
    toast.success('Individual permission tests completed!');
  };

  const runBulkTests = async () => {
    try {
      setLoading(true);
      
      const checks = testScenarios.map(scenario => ({
        action: scenario.action,
        resource_type: scenario.resource,
        resource_id: scenario.resourceId,
        context: scenario.context
      }));

      const result = await bulkCheckPermissions(checks);
      setBulkTestResults(result.results);
      toast.success('Bulk permission tests completed!');
      
    } catch (error) {
      console.error('Bulk permission test failed:', error);
      toast.error('Failed to run bulk permission tests');
    } finally {
      setLoading(false);
    }
  };

  const runConvenienceMethodTests = () => {
    const results = {
      canCreateUser: canCreate(ResourceType.USER),
      canReadUser: canRead(ResourceType.USER, user?.id),
      canUpdateUser: canUpdate(ResourceType.USER, user?.id),
      canDeleteUser: canDelete(ResourceType.USER, user?.id),
      canManageRoles: canManage(ResourceType.ROLE),
      isAdminUser: isAdmin,
      isManagerUser: isManager
    };

    console.log('Convenience Method Test Results:', results);
    toast.success('Convenience method tests logged to console!');
  };

  const testResourceConstraints = () => {
    // Test with different contexts
    const contextTests = [
      {
        name: 'Department Context',
        context: { departmentId: 'dept-1', projectId: 'proj-1' }
      },
      {
        name: 'Project Context',
        context: { projectId: 'proj-2', organizationId: 'org-1' }
      },
      {
        name: 'No Context',
        context: undefined
      }
    ];

    contextTests.forEach(test => {
      const result = checkPermission(
        PermissionAction.READ,
        ResourceType.USER,
        'user-123',
        test.context
      );
      console.log(`${test.name}: ${result}`);
    });

    toast.success('Resource constraint tests logged to console!');
  };

  const getTestIcon = (passed: boolean | undefined) => {
    if (passed === undefined) return <AlertTriangle className="w-4 h-4 text-gray-400" />;
    return passed ? 
      <CheckCircle className="w-4 h-4 text-green-600" /> : 
      <XCircle className="w-4 h-4 text-red-600" />;
  };

  const getTestColor = (passed: boolean | undefined, expected: boolean) => {
    if (passed === undefined) return 'bg-gray-50';
    const correct = passed === expected;
    return correct ? 'bg-green-50' : 'bg-red-50';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center space-x-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          <span>Loading permission system...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-4">
            <Shield className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Permission System Test</h1>
          </div>
          <p className="text-gray-600">
            Comprehensive testing interface for the advanced role permissions and resource-based authorization system.
          </p>
        </div>

        {/* User Info */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Current User Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex items-center space-x-2">
              <User className="w-5 h-5 text-gray-400" />
              <span className="text-sm">
                <strong>User:</strong> {user?.email || 'N/A'}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <Shield className="w-5 h-5 text-gray-400" />
              <span className="text-sm">
                <strong>Admin:</strong> {isAdmin ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <Settings className="w-5 h-5 text-gray-400" />
              <span className="text-sm">
                <strong>Manager:</strong> {isManager ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <Lock className="w-5 h-5 text-gray-400" />
              <span className="text-sm">
                <strong>Permissions:</strong> {(permissions as any)?.effective_permissions?.length || 0}
              </span>
            </div>
          </div>
        </div>

        {/* Test Controls */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Permission Tests</h2>
          <div className="flex flex-wrap gap-4 mb-6">
            <Button onClick={runIndividualTests} variant="primary">
              Run Individual Tests
            </Button>
            <Button onClick={runBulkTests} variant="outline" isLoading={loading}>
              Run Bulk Tests
            </Button>
            <Button onClick={runConvenienceMethodTests} variant="outline">
              Test Convenience Methods
            </Button>
            <Button onClick={testResourceConstraints} variant="outline">
              Test Resource Constraints
            </Button>
            <Button onClick={refreshPermissions} variant="ghost">
              Refresh Permissions
            </Button>
          </div>

          {/* Test Results */}
          <div className="space-y-4">
            <h3 className="font-medium">Test Scenarios</h3>
            <div className="grid gap-4">
              {testScenarios.map(scenario => (
                <div 
                  key={scenario.id} 
                  className={`p-4 rounded-lg border ${getTestColor(testResults[scenario.id], scenario.expectedResult)}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {getTestIcon(testResults[scenario.id])}
                      <div>
                        <h4 className="font-medium">{scenario.name}</h4>
                        <p className="text-sm text-gray-600">{scenario.description}</p>
                        <div className="text-xs text-gray-500 mt-1">
                          {scenario.action}:{scenario.resource}
                          {scenario.resourceId && ` (${scenario.resourceId})`}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-right">
                      <div>Result: {testResults[scenario.id]?.toString() || 'Not tested'}</div>
                      <div>Expected: {scenario.expectedResult.toString()}</div>
                      <div className="text-xs text-gray-500">
                        {testResults[scenario.id] === scenario.expectedResult ? '✅ Correct' : '❌ Incorrect'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Permission Groups */}
        {Object.keys(permissionGroups).length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">Current Permission Groups</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(permissionGroups).map(([resource, permissions]) => (
                <div key={resource} className="p-4 border rounded-lg">
                  <h3 className="font-medium capitalize mb-2">{resource.replace('_', ' ')}</h3>
                  <div className="space-y-1">
                    {permissions.map((permission: any, index: number) => (
                      <div key={index} className="text-sm text-gray-600 flex items-center space-x-2">
                        <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                        <span>{permission}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Resource-Based Access Examples */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Resource-Based Access Component Tests</h2>
          <div className="space-y-4">
            <div className="p-4 border rounded-lg">
              <h3 className="font-medium mb-2">User Management Actions</h3>
              <div className="flex flex-wrap gap-2">
                <ResourceBasedAccess 
                  action={PermissionAction.CREATE} 
                  resource={ResourceType.USER}
                  fallback={<span className="text-gray-400">Create User (Hidden)</span>}
                >
                  <Button size="sm" leftIcon={<UserPlus className="w-4 h-4" />}>
                    Create User
                  </Button>
                </ResourceBasedAccess>

                <ResourceBasedAccess 
                  action={PermissionAction.READ} 
                  resource={ResourceType.USER}
                  fallback={<span className="text-gray-400">View Users (Hidden)</span>}
                >
                  <Button variant="outline" size="sm" leftIcon={<Eye className="w-4 h-4" />}>
                    View Users
                  </Button>
                </ResourceBasedAccess>

                <ResourceBasedAccess 
                  action={PermissionAction.UPDATE} 
                  resource={ResourceType.USER}
                  resourceId={user?.id}
                  fallback={<span className="text-gray-400">Edit Profile (Hidden)</span>}
                >
                  <Button variant="outline" size="sm" leftIcon={<Edit className="w-4 h-4" />}>
                    Edit Profile
                  </Button>
                </ResourceBasedAccess>

                <ResourceBasedAccess 
                  action={PermissionAction.DELETE} 
                  resource={ResourceType.USER}
                  fallback={<span className="text-gray-400">Delete User (Hidden)</span>}
                >
                  <Button variant="outline" size="sm" leftIcon={<Trash2 className="w-4 h-4" />}>
                    Delete User
                  </Button>
                </ResourceBasedAccess>
              </div>
            </div>

            <div className="p-4 border rounded-lg">
              <h3 className="font-medium mb-2">Form Management Actions</h3>
              <div className="flex flex-wrap gap-2">
                <ResourceBasedAccess 
                  action={PermissionAction.CREATE} 
                  resource={ResourceType.FORM}
                  fallback={<span className="text-gray-400">Create Form (Hidden)</span>}
                >
                  <Button size="sm" leftIcon={<Save className="w-4 h-4" />}>
                    Create Form
                  </Button>
                </ResourceBasedAccess>

                <ResourceBasedAccess 
                  action={PermissionAction.MANAGE} 
                  resource={ResourceType.ROLE}
                  fallback={<span className="text-gray-400">Manage Roles (Hidden)</span>}
                >
                  <Button variant="outline" size="sm" leftIcon={<Shield className="w-4 h-4" />}>
                    Manage Roles
                  </Button>
                </ResourceBasedAccess>
              </div>
            </div>
          </div>
        </div>

        {/* Role Permission Editor Test */}
        {selectedRole && (
          <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">Role Permission Editor Test</h2>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Select Role to Edit:</label>
              <select 
                value={selectedRole.id} 
                onChange={(e) => setSelectedRole(roles.find(r => r.id === e.target.value) || null)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {roles.map(role => (
                  <option key={role.id} value={role.id}>
                    {role.display_name}
                  </option>
                ))}
              </select>
            </div>
            
            <RolePermissionEditor
              role={selectedRole}
              onRoleUpdate={(updatedRole) => {
                setSelectedRole(updatedRole);
                setRoles(roles.map(r => r.id === updatedRole.id ? updatedRole : r));
                toast.success('Role updated successfully!');
              }}
              className="border-t pt-6"
            />
          </div>
        )}

        {/* Permission Matrix Test */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-xl font-semibold mb-4">Permission Matrix Test</h2>
          <PermissionMatrix
            roleIds={roles.map(r => r.id)}
            onPermissionChange={(updates) => {
              console.log('Permission matrix updates:', updates);
              toast.success(`Updated ${updates.length} permissions!`);
            }}
            readOnly={false}
          />
        </div>

        {/* Debug Information */}
        <div className="bg-gray-900 text-white rounded-lg p-6 mt-8">
          <h2 className="text-xl font-semibold mb-4">Debug Information</h2>
          <div className="space-y-4 text-sm">
            <div>
              <strong>Raw Permissions Data:</strong>
              <pre className="mt-2 text-xs overflow-x-auto">
                {JSON.stringify(permissions, null, 2)}
              </pre>
            </div>
            
            <div>
              <strong>Bulk Test Results:</strong>
              <pre className="mt-2 text-xs overflow-x-auto">
                {JSON.stringify(bulkTestResults, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PermissionTestPage;