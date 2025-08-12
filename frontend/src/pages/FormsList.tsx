/**
 * Forms List Page
 * Displays and manages all dynamic forms
 */

import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Search,
  Edit2,
  Copy,
  Trash2,
  Eye,
  BarChart,
  FileText,
  Table,
  Activity
} from '../components/icons';
import { useFormBuilder } from '../hooks/useFormBuilder';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Badge from '../components/common/Badge';
import Pagination from '../components/common/Pagination';
import { DropdownMenu, MenuItem } from '../components/common/DropdownMenu';
import { formatDate } from '../utils/date';
import AppLayout from '../components/layout/AppLayout';
import { useFormTranslations } from '../contexts/I18nContext';
import { Form } from '../types/formBuilder';
import { useAuth } from '../contexts/AuthContext';
import FormPublicStats from '../components/FormPublicStats';

const FormsList: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { forms, loading, error, loadForms, deleteForm, duplicateForm, publishForm, totalPages } = useFormBuilder();
  const { tForm, tCommon } = useFormTranslations();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'published' | 'draft' | 'archived'>('all');
  const [filterOwner, setFilterOwner] = useState<'all' | 'mine' | 'others'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null);
  const [expandedStats, setExpandedStats] = useState<string | null>(null);

  useEffect(() => {
    loadForms(currentPage, searchQuery, filterStatus, filterOwner);
  }, [loadForms, currentPage, searchQuery, filterStatus, filterOwner]);

  // Server-side filtering and pagination are now handled by the API
  const paginatedForms = forms;

  const handleDelete = async (formId: string) => {
    try {
      await deleteForm(formId);
      setShowDeleteModal(null);
      await loadForms(currentPage, searchQuery, filterStatus);
    } catch (error) {
      console.error('Failed to delete form:', error);
      // Error is already handled by useFormBuilder hook with user notification
    }
  };

  const handleDuplicate = async (formId: string) => {
    try {
      await duplicateForm(formId);
      await loadForms(currentPage, searchQuery, filterStatus);
    } catch (error) {
      console.error('Failed to duplicate form:', error);
      // Error is already handled by useFormBuilder hook with user notification
    }
  };

  const handlePublish = async (formId: string) => {
    try {
      await publishForm(formId);
      loadForms(currentPage, searchQuery, filterStatus);
    } catch (error) {
      console.error('Failed to publish form:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'success' | 'warning' | 'default', label: string }> = {
      published: { variant: 'success', label: tCommon('status.published') },
      draft: { variant: 'warning', label: tCommon('status.draft') },
      archived: { variant: 'default', label: tCommon('status.archived') }
    };
    const config = variants[status] || variants.draft;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  // Create menu items for a form
  const getMenuItems = (form: Form): MenuItem[] => {
    const isOwner = form.ownerId === user?.id;
    const items: MenuItem[] = [
      {
        id: 'view',
        label: 'View',
        icon: <Eye className="w-4 h-4" />,
        onClick: () => navigate(`/forms/${form.id}/view`)
      },
      {
        id: 'preview',
        label: tForm('actions.preview'),
        icon: <Eye className="w-4 h-4" />,
        onClick: () => window.open(`/f/${form.slug}`, '_blank')
      },
      {
        id: 'submissions',
        label: tForm('actions.submissions'),
        icon: <BarChart className="w-4 h-4" />,
        onClick: () => navigate(`/forms/${form.id}/submissions`)
      },
      {
        id: 'table-view',
        label: tForm('actions.tableView'),
        icon: <Table className="w-4 h-4" />,
        onClick: () => {
          const url = `/forms/${form.id}/submissions/table-view?from=forms-list`;
          navigate(url);
          return Promise.resolve();
        }
      },
      {
        id: 'stats',
        label: 'View Statistics',
        icon: <Activity className="w-4 h-4" />,
        onClick: () => {
          setExpandedStats(expandedStats === form.id ? null : form.id);
        },
        show: form.status === 'published'
      }
    ];

    // Clone option - available for all published forms or own forms
    if (form.status === 'published' || isOwner) {
      items.push({
        id: 'clone',
        label: isOwner ? tForm('actions.duplicate') : 'Clone Form',
        icon: <Copy className="w-4 h-4" />,
        onClick: async () => {
          await handleDuplicate(form.id);
        }
      });
    }

    // Owner-only actions
    if (isOwner) {
      // Design New action - Enhanced Form Builder (only for owners)
      items.unshift({
        id: 'design-new',
        label: 'Design New',
        icon: <Edit2 className="w-4 h-4" />,
        onClick: () => navigate(`/forms/${form.id}/edit`)
      });
      
      // Design action - Original Form Builder (only for owners)
      items.unshift({
        id: 'design',
        label: 'Design',
        icon: <Edit2 className="w-4 h-4" />,
        onClick: () => navigate(`/forms/${form.id}/edit-old`)
      });

      // Publish action (only for draft forms owned by user)
      if (form.status === 'draft') {
        items.push({
          id: 'publish',
          label: tForm('actions.publish'),
          icon: <FileText className="w-4 h-4" />,
          onClick: async () => {
            await handlePublish(form.id);
          },
          variant: 'success'
        });
      }

      // Delete action (only for owners)
      items.push({
        id: 'delete',
        label: tForm('actions.delete'),
        icon: <Trash2 className="w-4 h-4" />,
        onClick: () => setShowDeleteModal(form.id),
        variant: 'danger',
        divider: true
      });
    }

    return items;
  };

  if (loading && forms.length === 0) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">{tCommon('status.loading')}</p>
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
            <h1 className="text-3xl font-bold text-gray-900">{tForm('title')}</h1>
            <Button onClick={() => navigate('/forms/new')}>
              <Plus className="w-4 h-4 mr-2" />
              {tForm('list.createButton')}
            </Button>
          </div>
        
        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              type="text"
              placeholder={tForm('list.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-full"
              aria-label="Search forms"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              aria-label="Filter forms by status"
            >
              <option value="all">{tCommon('ui.allStatus')}</option>
              <option value="published">{tCommon('status.published')}</option>
              <option value="draft">{tCommon('status.draft')}</option>
              <option value="archived">{tCommon('status.archived')}</option>
            </select>
            <select
              value={filterOwner}
              onChange={(e) => setFilterOwner(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              aria-label="Filter forms by owner"
            >
              <option value="all">All Forms</option>
              <option value="mine">My Forms</option>
              <option value="others">Others' Forms</option>
            </select>
          </div>
        </div>
      </div>

      {/* Forms Table */}
      {forms.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12">
          <div className="text-center">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">{tForm('list.noForms')}</h3>
            <p className="text-gray-600 mb-6">
              {searchQuery || filterStatus !== 'all' 
                ? tForm('list.tryAdjustFilters')
                : tForm('list.noFormsSubtext')}
            </p>
            {!searchQuery && filterStatus === 'all' && (
              <Button onClick={() => navigate('/forms/new')}>
                <Plus className="w-4 h-4 mr-2" />
                {tForm('list.createButton')}
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
                    {tForm('list.columns.name')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created By
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {tForm('list.columns.status')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {tForm('list.columns.submissions')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {tForm('list.columns.created')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {tForm('list.columns.lastModified')}
                  </th>
                  <th className="relative px-6 py-3">
                    <span className="sr-only">{tForm('list.columns.actions')}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedForms.map((form) => (
                  <React.Fragment key={form.id}>
                    <tr className="hover:bg-gray-50">
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
                        <div className="flex items-center">
                          <span className="text-sm text-gray-900">
                            {form.ownerId === user?.id ? 'You' : (form as any).ownerName || 'Unknown'}
                          </span>
                          {form.ownerId === user?.id && (
                            <span className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">Owner</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(form.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        0
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(form.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(form.updatedAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <DropdownMenu items={getMenuItems(form)} />
                      </td>
                    </tr>
                    {expandedStats === form.id && form.status === 'published' && (
                      <tr>
                        <td colSpan={7} className="px-6 py-4 bg-gray-50">
                          <FormPublicStats formId={form.id} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" role="dialog" aria-modal="true" aria-labelledby="delete-modal-title">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 id="delete-modal-title" className="text-lg font-semibold text-gray-900 mb-4">{tForm('actions.delete')} {tForm('title')}</h3>
            <p className="text-gray-600 mb-6">
              {tForm('messages.confirmDelete')}
            </p>
            <div className="flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => setShowDeleteModal(null)}
              >
                {tCommon('actions.cancel')}
              </Button>
              <Button
                variant="primary"
                className="bg-red-600 hover:bg-red-700"
                onClick={() => handleDelete(showDeleteModal)}
              >
                {tForm('actions.delete')} {tForm('title')}
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