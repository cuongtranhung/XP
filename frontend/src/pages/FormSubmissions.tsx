/**
 * Form Submissions Page
 * View and manage form submissions with export functionality
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Download, 
  Upload,
  Search, 
  Eye,
  Trash2,
  FileText,
  CheckCircle,
  Clock,
  XCircle,
  X,
  Info,
  Users,
  MessageSquare
} from '../components/icons';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Badge from '../components/common/Badge';
import Pagination from '../components/common/Pagination';
import CommentButton from '../components/common/CommentButton';
import CommentComponent from '../components/CommentComponent';
import { CommentPanel } from '../components/comments/CommentPanel';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { formatDate } from '../utils/date';
import toast from 'react-hot-toast';

interface Submission {
  id: string;
  formId: string;
  userId?: string;
  sessionId: string;
  status: 'draft' | 'completed' | 'processing' | 'failed';
  data: Record<string, any>;
  metadata: Record<string, any>;
  currentStep?: number;
  completedSteps?: number[];
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  userEmail?: string;
  userName?: string;
}

const FormSubmissions: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<any>(null);
  const [isFormOwner, setIsFormOwner] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedSubmissions, setSelectedSubmissions] = useState<string[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSubmissionModal, setShowSubmissionModal] = useState<Submission | null>(null);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [showCommentPanel, setShowCommentPanel] = useState(false);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const itemsPerPage = 20;

  useEffect(() => {
    fetchFormAndSubmissions();
  }, [id, currentPage, filterStatus, dateFrom, dateTo]);

  useEffect(() => {
    if (submissions.length > 0) {
      fetchCommentCounts();
    }
  }, [submissions]);

  const fetchFormAndSubmissions = async () => {
    try {
      setLoading(true);
      
      // Fetch form details
      const formResponse = await api.get(`/api/forms/${id}`);
      // Handle response structure from backend
      let formData;
      if (formResponse.data.data) {
        formData = formResponse.data.data;
      } else {
        formData = formResponse.data;
      }
      setForm(formData);
      
      // Check if current user is the form owner
      const ownershipStatus = formData.ownerId === user?.id;
      setIsFormOwner(ownershipStatus);

      // Fetch submissions
      const params: any = {
        page: currentPage,
        limit: itemsPerPage
      };

      if (filterStatus !== 'all') {
        params.status = filterStatus;
      }

      if (dateFrom) {
        params.date_from = dateFrom;
      }

      if (dateTo) {
        params.date_to = dateTo;
      }

      if (searchQuery) {
        params.search = searchQuery;
      }

      const submissionsResponse = await api.get(`/api/forms/${id}/submissions`, { params });
      
      // Handle response structure from backend
      if (submissionsResponse.data.data) {
        setSubmissions(submissionsResponse.data.data.submissions || []);
        // If pages is 0 (no data), still show 1 page
        const pages = submissionsResponse.data.data.pagination?.pages || 0;
        setTotalPages(pages === 0 ? 1 : pages);
      } else {
        setSubmissions(submissionsResponse.data.submissions || []);
        const pages = submissionsResponse.data.pagination?.pages || submissionsResponse.data.totalPages || 0;
        setTotalPages(pages === 0 ? 1 : pages);
      }
    } catch (error) {
      console.error('Failed to fetch submissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCommentCounts = async () => {
    try {
      // Get all submission IDs
      const submissionIds = submissions.map(s => s.id);
      
      if (submissionIds.length === 0) return;

      // Fetch comment counts for all submissions
      const response = await api.post(`/api/submissions/batch/comments/count`, {
        submissionIds
      });

      if (response.data.success) {
        setCommentCounts(response.data.data.commentCounts || {});
      }
    } catch (error) {
      console.error('Failed to fetch comment counts:', error);
      // Set empty comment counts on error
      setCommentCounts({});
    }
  };

  const handleSearch = () => {
    setCurrentPage(1);
    fetchFormAndSubmissions();
  };

  const handleExport = async (format: 'csv' | 'xlsx' | 'json') => {
    try {
      const params: any = { format };
      
      if (selectedSubmissions.length > 0) {
        params.ids = selectedSubmissions.join(',');
      }

      if (filterStatus !== 'all') {
        params.status = filterStatus;
      }

      if (dateFrom) {
        params.date_from = dateFrom;
      }

      if (dateTo) {
        params.date_to = dateTo;
      }

      const response = await api.get(`/api/forms/${id}/submissions/export`, {
        params,
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `submissions-${id}-${new Date().toISOString()}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success(`Successfully exported submissions as ${format.toUpperCase()}`);
    } catch (error) {
      console.error('Failed to export submissions:', error);
      toast.error('Failed to export submissions. Please try again.');
    }
  };

  const handleImport = async (file: File) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      // Determine format from file extension
      const extension = file.name.split('.').pop()?.toLowerCase();
      const format = extension === 'xlsx' || extension === 'xls' ? 'xlsx' : extension;
      
      if (!['csv', 'xlsx', 'xls', 'json'].includes(extension || '')) {
        toast.error('Please upload a CSV, Excel (XLSX/XLS), or JSON file');
        return;
      }
      
      formData.append('format', format || 'csv');

      const response = await api.post(`/api/forms/${id}/submissions/import`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.success) {
        const result = response.data.data;
        toast.success(`Successfully imported ${result.imported} submissions`);
        if (result.failed > 0) {
          toast.error(`${result.failed} submissions failed to import. Check the logs for details.`);
        }
        // Refresh the submissions list
        fetchFormAndSubmissions();
      }
    } catch (error: any) {
      console.error('Failed to import submissions:', error);
      const errorMessage = error.response?.data?.error?.message || 'Failed to import submissions. Please try again.';
      toast.error(errorMessage);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleImport(file);
    }
    // Reset the input so the same file can be selected again
    event.target.value = '';
  };

  const handleDeleteSubmissions = async () => {
    try {
      for (const submissionId of selectedSubmissions) {
        await api.delete(`/api/forms/${id}/submissions/${submissionId}`);
      }
      
      setSelectedSubmissions([]);
      setShowDeleteModal(false);
      fetchFormAndSubmissions();
    } catch (error) {
      console.error('Failed to delete submissions:', error);
    }
  };

  const handleBatchStatusUpdate = async (newStatus: string) => {
    try {
      const response = await api.patch(`/api/forms/${id}/submissions/batch-status`, {
        submissionIds: selectedSubmissions,
        status: newStatus
      });

      if (response.data.success) {
        const result = response.data.data;
        console.log(`Updated ${result.updated} submissions, failed: ${result.failed}`);
        
        // Reset selection and refresh data
        setSelectedSubmissions([]);
        fetchFormAndSubmissions();
        
        // Show success message
        toast.success(`Successfully updated ${result.updated} submission(s) to ${newStatus}`);
      }
    } catch (error) {
      console.error('Failed to update submission status:', error);
      toast.error('Failed to update submission status. Please try again.');
    }
  };

  const toggleSubmissionSelection = (submissionId: string) => {
    setSelectedSubmissions(prev => 
      prev.includes(submissionId)
        ? prev.filter(id => id !== submissionId)
        : [...prev, submissionId]
    );
  };

  const toggleAllSubmissions = () => {
    if (submissions && selectedSubmissions.length === submissions.length) {
      setSelectedSubmissions([]);
    } else {
      setSelectedSubmissions(submissions.map(s => s.id));
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      submitted: { variant: 'info', icon: CheckCircle, label: 'Submitted' },
      completed: { variant: 'success', icon: CheckCircle, label: 'Completed' },
      draft: { variant: 'warning', icon: Clock, label: 'Draft' },
      processing: { variant: 'info', icon: Clock, label: 'Processing' },
      failed: { variant: 'danger', icon: XCircle, label: 'Failed' }
    };
    const config = variants[status] || variants.draft;
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  const renderFieldValue = (value: any): string => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'object') {
      if (value.filename) return value.originalName || value.filename;
      return JSON.stringify(value);
    }
    return String(value);
  };

  if (loading && (!submissions || submissions.length === 0)) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading submissions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/forms')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Form Submissions</h1>
              <p className="text-gray-600">{form?.name}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/forms/${id}/submissions/table-view?from=submissions`)}
            >
              View as Table
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/forms/${id}/analytics`)}
            >
              View Analytics
            </Button>
            {isFormOwner && (
              <>
                <div className="relative">
                  <input
                    type="file"
                    id="import-file"
                    className="hidden"
                    accept=".csv,.xlsx,.xls,.json"
                    onChange={handleFileSelect}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById('import-file')?.click()}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Import
                  </Button>
                </div>
                <div className="relative">
                  <Button
                    size="sm"
                    onClick={() => document.getElementById('export-menu')?.classList.toggle('hidden')}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export
                  </Button>
                  <div id="export-menu" className="hidden absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                    <button
                      onClick={() => handleExport('csv')}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Export as CSV
                    </button>
                    <button
                      onClick={() => handleExport('xlsx')}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Export as Excel
                    </button>
                    <button
                      onClick={() => handleExport('json')}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Export as JSON
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Access Information Banner */}
        {form && (
          <div className={`mb-4 p-4 rounded-lg flex items-start space-x-3 ${
            isFormOwner 
              ? 'bg-blue-50 border border-blue-200' 
              : 'bg-yellow-50 border border-yellow-200'
          }`}>
            {isFormOwner ? (
              <>
                <Users className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-900">
                    Full Access - Form Owner
                  </p>
                  <p className="text-sm text-blue-700 mt-1">
                    You can view all submissions to this form from all users.
                  </p>
                </div>
              </>
            ) : (
              <>
                <Info className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-900">
                    Limited Access - Form Participant
                  </p>
                  <p className="text-sm text-yellow-700 mt-1">
                    You can only view your own submissions to this form. The form owner can see all submissions.
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                type="text"
                placeholder="Search submissions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10 w-full"
              />
            </div>
            
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="submitted">Submitted</option>
              <option value="completed">Completed</option>
              <option value="draft">Draft</option>
              <option value="processing">Processing</option>
              <option value="failed">Failed</option>
            </select>

            <Input
              type="date"
              placeholder="From date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full"
            />

            <Input
              type="date"
              placeholder="To date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full"
            />
          </div>
        </div>
      </div>

      {/* Selected Actions - Only for Form Owners */}
      {selectedSubmissions.length > 0 && isFormOwner && (
        <div className="mb-4 p-4 bg-blue-50 rounded-lg flex items-center justify-between">
          <span className="text-sm text-blue-700">
            {selectedSubmissions.length} submission{selectedSubmissions.length > 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center space-x-2">
            <select
              className="px-3 py-1 border border-blue-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              onChange={(e) => {
                if (e.target.value) {
                  handleBatchStatusUpdate(e.target.value);
                }
              }}
              defaultValue=""
            >
              <option value="" disabled>Change Status...</option>
              <option value="completed">Mark as Completed</option>
              <option value="submitted">Mark as Submitted</option>
              <option value="processing">Mark as Processing</option>
              <option value="draft">Mark as Draft</option>
              <option value="failed">Mark as Failed</option>
            </select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeleteModal(true)}
              className="text-red-600 border-red-600 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Selected
            </Button>
          </div>
        </div>
      )}

      {/* Submissions Table */}
      {!submissions || submissions.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12">
          <div className="text-center">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No submissions found</h3>
            <p className="text-gray-600">
              {searchQuery || filterStatus !== 'all' 
                ? 'Try adjusting your search or filters'
                : 'No submissions have been received yet'}
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {isFormOwner && (
                    <th className="px-6 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={submissions && selectedSubmissions.length === submissions.length}
                        onChange={toggleAllSubmissions}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Submitted By
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Comments
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {submissions.map((submission) => (
                  <tr key={submission.id} className="hover:bg-gray-50">
                    {isFormOwner && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedSubmissions.includes(submission.id)}
                          onChange={() => toggleSubmissionSelection(submission.id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="text-sm font-mono text-gray-900">
                        {submission.id.slice(0, 8)}...
                      </p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(submission.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="text-sm text-gray-900">
                        {submission.userEmail || submission.userName || 'Anonymous'}
                      </p>
                      {submission.metadata?.userAgent && (
                        <p className="text-xs text-gray-500">
                          {submission.metadata.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop'}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(submission.submittedAt || submission.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <CommentButton
                        commentCount={commentCounts[submission.id] || 0}
                        onClick={() => {
                          console.log('Comment button clicked for submission:', submission.id);
                          setSelectedSubmissionId(submission.id);
                          setShowCommentPanel(true);
                          console.log('showCommentPanel state will be set to true');
                        }}
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowSubmissionModal(submission)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Delete Submissions</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete {selectedSubmissions.length} submission{selectedSubmissions.length > 1 ? 's' : ''}? 
              This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => setShowDeleteModal(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                className="bg-red-600 hover:bg-red-700"
                onClick={handleDeleteSubmissions}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Submission Details Modal */}
      {showSubmissionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Submission Details</h3>
              <button
                onClick={() => setShowSubmissionModal(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <XCircle className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Metadata */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Submission Information</h4>
                <dl className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm text-gray-500">ID</dt>
                    <dd className="text-sm font-mono text-gray-900">{showSubmissionModal.id}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Status</dt>
                    <dd>{getStatusBadge(showSubmissionModal.status)}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Submitted</dt>
                    <dd className="text-sm text-gray-900">
                      {formatDate(showSubmissionModal.submittedAt || showSubmissionModal.createdAt)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">User</dt>
                    <dd className="text-sm text-gray-900">
                      {showSubmissionModal.userEmail || showSubmissionModal.userName || 'Anonymous'}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Form Data */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Form Data</h4>
                <div className="bg-gray-50 rounded-lg p-4">
                  <dl className="space-y-3">
                    {Object.entries(showSubmissionModal.data).map(([key, value]) => {
                      const field = form?.fields?.find((f: any) => f.fieldKey === key);
                      return (
                        <div key={key}>
                          <dt className="text-sm font-medium text-gray-700">
                            {field?.label || key}
                          </dt>
                          <dd className="text-sm text-gray-900 mt-1">
                            {renderFieldValue(value)}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                </div>
              </div>

              {/* Additional Metadata */}
              {showSubmissionModal.metadata && Object.keys(showSubmissionModal.metadata).length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Additional Information</h4>
                  <dl className="grid grid-cols-2 gap-4 text-sm">
                    {showSubmissionModal.metadata.userAgent && (
                      <div className="col-span-2">
                        <dt className="text-gray-500">User Agent</dt>
                        <dd className="text-gray-900 font-mono text-xs mt-1">
                          {showSubmissionModal.metadata.userAgent}
                        </dd>
                      </div>
                    )}
                    {showSubmissionModal.metadata.referrer && (
                      <div>
                        <dt className="text-gray-500">Referrer</dt>
                        <dd className="text-gray-900">{showSubmissionModal.metadata.referrer}</dd>
                      </div>
                    )}
                  </dl>
                </div>
              )}
            </div>

            <div className="flex justify-end mt-6">
              <Button onClick={() => setShowSubmissionModal(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Comment Panel Modal */}
      <CommentPanel
        isOpen={showCommentPanel}
        onClose={() => {
          setShowCommentPanel(false);
          setSelectedSubmissionId(null);
        }}
        submissionId={selectedSubmissionId || ''}
      />
    </div>
  );
};

export default FormSubmissions;