/**
 * Forms List Page
 * Displays and manages all dynamic forms
 */

import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  Edit2, 
  Copy, 
  Trash2, 
  MoreVertical,
  Eye,
  BarChart,
  FileText
} from '../components/icons';
import { useFormBuilder } from '../hooks/useFormBuilder';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Badge from '../components/common/Badge';
import Pagination from '../components/common/Pagination';
import { formatDate } from '../utils/date';
import AppLayout from '../components/layout/AppLayout';

const FormsList: React.FC = () => {
  const navigate = useNavigate();
  const { forms, loading, error, loadForms, deleteForm, duplicateForm, publishForm } = useFormBuilder();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'published' | 'draft' | 'archived'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState<string | null>(null);
  const itemsPerPage = 10;

  useEffect(() => {
    loadForms();
  }, [loadForms]);

  // Handle click outside to close menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Check if click is on a menu item or button
      const isMenuClick = target.closest('[data-menu-item]');
      const isButtonClick = target.closest('[data-menu-button]');
      
      // If clicking on menu item, let it handle the action
      if (isMenuClick) {
        return;
      }
      
      // If clicking on button, it will toggle the menu
      if (isButtonClick) {
        return;
      }
      
      // Otherwise close the menu
      setShowMenu(null);
    };

    if (showMenu) {
      document.addEventListener('click', handleClickOutside, true);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside, true);
    };
  }, [showMenu]);

  const filteredForms = forms.filter(form => {
    const matchesSearch = form.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         form.slug.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || form.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const paginatedForms = filteredForms.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleDelete = async (formId: string) => {
    await deleteForm(formId);
    setShowDeleteModal(null);
    loadForms();
  };

  const handleDuplicate = async (formId: string) => {
    await duplicateForm(formId);
    setShowMenu(null);
    loadForms();
  };

  const handlePublish = async (formId: string) => {
    try {
      await publishForm(formId);
      setShowMenu(null);
      loadForms(); // Reload to update status
    } catch (error) {
      console.error('Failed to publish form:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      published: { variant: 'success', label: 'Published' },
      draft: { variant: 'warning', label: 'Draft' },
      archived: { variant: 'default', label: 'Archived' }
    };
    const config = variants[status] || variants.draft;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loading && forms.length === 0) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading forms...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  Error loading forms
                </h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{error}</p>
                </div>
                <div className="mt-4">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => loadForms()}
                  >
                    Try Again
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-gray-900">Forms</h1>
            <Button onClick={() => navigate('/forms/new')}>
              <Plus className="w-4 h-4 mr-2" />
              Create Form
            </Button>
          </div>
        
        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              type="text"
              placeholder="Search forms..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-full"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>
      </div>

      {/* Forms Table */}
      {filteredForms.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12">
          <div className="text-center">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No forms found</h3>
            <p className="text-gray-600 mb-6">
              {searchQuery || filterStatus !== 'all' 
                ? 'Try adjusting your search or filters'
                : 'Get started by creating your first form'}
            </p>
            {!searchQuery && filterStatus === 'all' && (
              <Button onClick={() => navigate('/forms/new')}>
                <Plus className="w-4 h-4 mr-2" />
                Create Form
              </Button>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-visible">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Form Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Submissions
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Modified
                  </th>
                  <th className="relative px-6 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedForms.map((form) => (
                  <tr key={form.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <Link 
                          to={`/forms/${form.id}/edit`}
                          className="text-sm font-medium text-gray-900 hover:text-blue-600"
                        >
                          {form.name}
                        </Link>
                        <p className="text-sm text-gray-500">/{form.slug}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(form.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {/* TODO: Add submissionCount to Form type */}
                      {/* {form.submissionCount || 0} */}
                      0
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(form.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(form.updatedAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {/* Dropdown container with relative positioning */}
                      <div className="relative inline-block text-left">
                        <button
                          data-menu-button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setShowMenu(showMenu === form.id ? null : form.id);
                          }}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <MoreVertical className="w-4 h-4 text-gray-500" />
                        </button>
                        
                        {/* Dropdown menu with absolute positioning */}
                        {showMenu === form.id && (
                          <div className="absolute right-0 top-full mt-1 w-48 rounded-lg shadow-2xl bg-white border border-gray-200 ring-1 ring-black ring-opacity-5 z-50">
                            <div data-menu-item className="py-1">
                              <Link
                                to={`/forms/${form.id}/edit`}
                                className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                onClick={() => {
                                  setShowMenu(null);
                                }}
                              >
                                <Edit2 className="w-4 h-4 mr-2" />
                                Edit
                              </Link>
                              <a
                                href={`/f/${form.slug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                onClick={() => {
                                  setShowMenu(null);
                                }}
                              >
                                <Eye className="w-4 h-4 mr-2" />
                                Preview
                              </a>
                              <Link
                                to={`/forms/${form.id}/submissions`}
                                className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                onClick={() => {
                                  setShowMenu(null);
                                }}
                              >
                                <BarChart className="w-4 h-4 mr-2" />
                                Submissions
                              </Link>
                              <button
                                onClick={() => {
                                  handleDuplicate(form.id);
                                }}
                                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 text-left"
                              >
                                <Copy className="w-4 h-4 mr-2" />
                                Duplicate
                              </button>
                              {form.status === 'draft' && (
                                <button
                                  onClick={() => {
                                    handlePublish(form.id);
                                  }}
                                  className="flex items-center w-full px-4 py-2 text-sm text-green-600 hover:bg-green-50 text-left"
                                >
                                  <FileText className="w-4 h-4 mr-2" />
                                  Publish
                                </button>
                              )}
                              <hr className="my-1" />
                              <button
                                onClick={() => {
                                  setShowDeleteModal(form.id);
                                  setShowMenu(null);
                                }}
                                className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 text-left"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {filteredForms.length > itemsPerPage && (
            <div className="mt-6">
              <Pagination
                currentPage={currentPage}
                totalPages={Math.ceil(filteredForms.length / itemsPerPage)}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Delete Form</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this form? This action cannot be undone and all submissions will be permanently deleted.
            </p>
            <div className="flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => setShowDeleteModal(null)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                className="bg-red-600 hover:bg-red-700"
                onClick={() => handleDelete(showDeleteModal)}
              >
                Delete Form
              </Button>
            </div>
          </div>
        </div>
      )}
      </div>
    </AppLayout>
  );
};

export default FormsList;