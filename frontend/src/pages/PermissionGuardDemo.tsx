import React from 'react';
import { CanAccess, useCanAccess } from '../components/auth/CanAccess';
import { usePermissions } from '../contexts/PermissionContext';
import { useAuth } from '../contexts/AuthContext';

const PermissionGuardDemo: React.FC = () => {
  const { user } = useAuth();
  const { permissions, loading, error } = usePermissions();
  const { check, checkResource } = useCanAccess();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            🛡️ Permission Guards Demo
          </h1>
          <p className="text-gray-600">
            Testing Frontend Permission Guards and CanAccess Components
          </p>
          {user && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                Logged in as: <span className="font-semibold">{user.email}</span>
              </p>
            </div>
          )}
          {error && (
            <div className="mt-4 p-3 bg-red-50 rounded-lg">
              <p className="text-sm text-red-800">Error: {error}</p>
            </div>
          )}
        </div>

        {/* Current Permissions */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            📋 Your Current Permissions ({permissions.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {permissions.length > 0 ? (
              permissions.map((perm, index) => (
                <div key={index} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">
                      {perm.resource}.{perm.action}
                    </span>
                    <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                      {perm.scope}
                    </span>
                  </div>
                  {perm.display_name && (
                    <p className="text-xs text-gray-500 mt-1">{perm.display_name}</p>
                  )}
                </div>
              ))
            ) : (
              <p className="text-gray-500 col-span-3">No permissions found</p>
            )}
          </div>
        </div>

        {/* User Management Permissions */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            👥 User Management Permissions
          </h2>
          <div className="space-y-4">
            {/* View Users */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <h3 className="font-medium">View Users</h3>
                <p className="text-sm text-gray-500">Permission: users.view</p>
              </div>
              <CanAccess 
                permission="users.view"
                fallback={
                  <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm">
                    ❌ No Access
                  </span>
                }
              >
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                  ✅ Allowed
                </span>
              </CanAccess>
            </div>

            {/* Create Users */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <h3 className="font-medium">Create Users</h3>
                <p className="text-sm text-gray-500">Permission: users.create</p>
              </div>
              <CanAccess 
                permission="users.create"
                fallback={
                  <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm">
                    ❌ No Access
                  </span>
                }
              >
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                  ✅ Allowed
                </span>
              </CanAccess>
            </div>

            {/* Update Users */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <h3 className="font-medium">Update Users</h3>
                <p className="text-sm text-gray-500">Permission: users.update</p>
              </div>
              <CanAccess 
                permission="users.update"
                fallback={
                  <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm">
                    ❌ No Access
                  </span>
                }
              >
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                  ✅ Allowed
                </span>
              </CanAccess>
            </div>

            {/* Delete Users */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <h3 className="font-medium">Delete Users</h3>
                <p className="text-sm text-gray-500">Permission: users.delete</p>
              </div>
              <CanAccess 
                permission="users.delete"
                fallback={
                  <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm">
                    ❌ No Access
                  </span>
                }
              >
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                  ✅ Allowed
                </span>
              </CanAccess>
            </div>
          </div>
        </div>

        {/* Form Builder Permissions */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            📝 Form Builder Permissions
          </h2>
          <div className="space-y-4">
            {/* View All Forms */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <h3 className="font-medium">View All Forms</h3>
                <p className="text-sm text-gray-500">Resource: forms, Action: view, Scope: all</p>
              </div>
              <CanAccess 
                resource="forms"
                action="view"
                scope="all"
                fallback={
                  <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm">
                    ❌ No Access
                  </span>
                }
              >
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                  ✅ Allowed
                </span>
              </CanAccess>
            </div>

            {/* View Own Forms */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <h3 className="font-medium">View Own Forms</h3>
                <p className="text-sm text-gray-500">Resource: forms, Action: view, Scope: own</p>
              </div>
              <CanAccess 
                resource="forms"
                action="view"
                scope="own"
                fallback={
                  <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm">
                    ❌ No Access
                  </span>
                }
              >
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                  ✅ Allowed
                </span>
              </CanAccess>
            </div>

            {/* Create Forms */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <h3 className="font-medium">Create Forms</h3>
                <p className="text-sm text-gray-500">Permission: forms.create</p>
              </div>
              <CanAccess 
                permission="forms.create"
                fallback={
                  <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm">
                    ❌ No Access
                  </span>
                }
              >
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                  ✅ Allowed
                </span>
              </CanAccess>
            </div>
          </div>
        </div>

        {/* Conditional UI Elements */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            🎨 Conditional UI Elements
          </h2>
          <div className="space-y-4">
            {/* Admin Panel Access */}
            <CanAccess 
              permissions={["users.create", "users.delete", "roles.assign"]}
              requireAll={true}
            >
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <h3 className="font-medium text-purple-900">Admin Panel</h3>
                <p className="text-sm text-purple-700">
                  You have full admin access! This panel is only visible to administrators.
                </p>
                <button className="mt-2 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700">
                  Open Admin Panel
                </button>
              </div>
            </CanAccess>

            {/* Manager Dashboard */}
            <CanAccess 
              permissions={["users.view", "forms.view"]}
              requireAll={false}
            >
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="font-medium text-blue-900">Manager Dashboard</h3>
                <p className="text-sm text-blue-700">
                  You can view users or forms. This dashboard is visible to managers.
                </p>
                <button className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                  View Dashboard
                </button>
              </div>
            </CanAccess>

            {/* User Actions */}
            <div className="flex space-x-4">
              <CanAccess permission="users.create">
                <button className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
                  ➕ Create User
                </button>
              </CanAccess>

              <CanAccess permission="users.update">
                <button className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700">
                  ✏️ Edit User
                </button>
              </CanAccess>

              <CanAccess permission="users.delete">
                <button className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
                  🗑️ Delete User
                </button>
              </CanAccess>
            </div>

            {/* Programmatic Check */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-2">Programmatic Permission Check</h3>
              <div className="space-y-2 text-sm">
                <p>
                  Can create users: {' '}
                  <span className={check('users.create') ? 'text-green-600' : 'text-red-600'}>
                    {check('users.create') ? 'Yes' : 'No'}
                  </span>
                </p>
                <p>
                  Can view forms (all): {' '}
                  <span className={checkResource('forms', 'view', 'all') ? 'text-green-600' : 'text-red-600'}>
                    {checkResource('forms', 'view', 'all') ? 'Yes' : 'No'}
                  </span>
                </p>
                <p>
                  Can view forms (own): {' '}
                  <span className={checkResource('forms', 'view', 'own') ? 'text-green-600' : 'text-red-600'}>
                    {checkResource('forms', 'view', 'own') ? 'Yes' : 'No'}
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PermissionGuardDemo;