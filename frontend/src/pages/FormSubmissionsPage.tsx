import React from 'react';
import { QueryProvider } from '../providers/QueryProvider';
import { TableViewWithComments } from '../components/TableView/TableViewWithComments';

// Mock data for demonstration
const mockSubmissions = [
  {
    id: 'sub-001',
    form_id: 'form-001',
    user_id: 'user-001',
    data: {
      name: 'John Doe',
      email: 'john@example.com',
      phone: '+1234567890',
      message: 'This is a test submission',
      status: 'pending'
    },
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z'
  },
  {
    id: 'sub-002',
    form_id: 'form-001',
    user_id: 'user-002',
    data: {
      name: 'Jane Smith',
      email: 'jane@example.com',
      phone: '+0987654321',
      message: 'Another test submission',
      status: 'approved'
    },
    created_at: '2024-01-15T11:00:00Z',
    updated_at: '2024-01-15T11:00:00Z'
  },
  {
    id: 'sub-003',
    form_id: 'form-001',
    user_id: 'user-003',
    data: {
      name: 'Bob Johnson',
      email: 'bob@example.com',
      phone: '+1122334455',
      message: 'Third submission for testing',
      status: 'rejected'
    },
    created_at: '2024-01-15T12:00:00Z',
    updated_at: '2024-01-15T12:00:00Z'
  }
];

// Define table columns
const columns = [
  {
    key: 'name',
    label: 'Name',
  },
  {
    key: 'email',
    label: 'Email',
  },
  {
    key: 'phone',
    label: 'Phone',
  },
  {
    key: 'status',
    label: 'Status',
    render: (value: string) => {
      const statusColors = {
        pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
        approved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
        rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      };
      
      return (
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[value as keyof typeof statusColors] || ''}`}>
          {value}
        </span>
      );
    }
  },
];

export const FormSubmissionsPage: React.FC = () => {
  // In a real app, these would come from auth context
  const currentUserId = 'user-001';
  const currentUserName = 'John Doe';
  const isAdmin = true;

  return (
    <QueryProvider>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Form Submissions
            </h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              View and manage all form submissions with integrated comments
            </p>
          </div>

          {/* Filters and Actions */}
          <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-2">
              <button className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700">
                Filter
              </button>
              <button className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700">
                Export
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {mockSubmissions.length} submissions
              </span>
            </div>
          </div>

          {/* Table with Comments */}
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
            <TableViewWithComments
              submissions={mockSubmissions}
              currentUserId={currentUserId}
              currentUserName={currentUserName}
              isAdmin={isAdmin}
              columns={columns}
            />
          </div>

          {/* Pagination */}
          <div className="mt-6 flex items-center justify-between">
            <div className="text-sm text-gray-700 dark:text-gray-300">
              Showing 1 to {mockSubmissions.length} of {mockSubmissions.length} results
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled
                className="px-3 py-1 text-sm font-medium text-gray-500 bg-gray-100 dark:bg-gray-700 rounded-md cursor-not-allowed"
              >
                Previous
              </button>
              <button
                disabled
                className="px-3 py-1 text-sm font-medium text-gray-500 bg-gray-100 dark:bg-gray-700 rounded-md cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </QueryProvider>
  );
};