/**
 * Data Table View Component
 * Display form submissions in a table format with fields as columns
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { 
  ArrowLeft, 
  Download,
  Upload,
  Search,
  ChevronUp,
  ChevronDown,
  Eye,
  Filter,
  Edit2,
  Trash2,
  Plus,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Zap,
  Columns
} from '../components/icons';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Badge from '../components/common/Badge';
import Pagination from '../components/common/Pagination';
import CommentButton from '../components/common/CommentButton';
import { CommentPanel } from '../components/comments/CommentPanel';
import EditableCell from '../components/EditableCell';
import api from '../services/api';
import { formatDate } from '../utils/date';
import toast from 'react-hot-toast';
import { useDebounce, useDebouncedCallback } from '../hooks/useDebounce';
import useTableKeyboardNavigation from '../hooks/useTableKeyboardNavigation';
import useUndoRedo from '../hooks/useUndoRedo';
import TableSkeleton from '../components/TableSkeleton';
import VirtualTable from '../components/VirtualTable';
import ResizableTable from '../components/ResizableTable';
import ColumnVisibilityToggle from '../components/ColumnVisibilityToggle';
import OptimizedTableRow from '../components/OptimizedTableRow';
import InfiniteScrollTable from '../components/InfiniteScrollTable';
import BulkEditModal from '../components/BulkEditModal';

interface FormField {
  id: string;
  fieldKey: string;  // Changed from name to fieldKey to match backend
  fieldType: string;  // Changed from type to fieldType to match backend
  label: string;
  required?: boolean;
  options?: Array<{ label: string; value: string }>;
}

interface Submission {
  id: string;
  formId: string;
  userId?: string;
  sessionId: string;
  status: 'draft' | 'completed' | 'processing' | 'failed' | 'submitted';
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

interface Form {
  id: string;
  name: string;
  description?: string;
  fields: FormField[];
  settings?: any;
}

const DataTableView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [form, setForm] = useState<Form | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortField, setSortField] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedSubmissions, setSelectedSubmissions] = useState<Set<string>>(new Set());
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [newRowData, setNewRowData] = useState<Record<string, any> | null>(null);
  const [isCreatingNewRow, setIsCreatingNewRow] = useState(false);
  const [isSavingNewRow, setIsSavingNewRow] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [enableVirtualScrolling, setEnableVirtualScrolling] = useState(true);
  const [clipboardData, setClipboardData] = useState<any>(null);
  const [enableResizableColumns, setEnableResizableColumns] = useState(false);
  const [columnConfigs, setColumnConfigs] = useState<any[]>([]);
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set());
  const [enableInfiniteScroll, setEnableInfiniteScroll] = useState(false);
  const [allSubmissions, setAllSubmissions] = useState<Submission[]>([]);
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [showCommentPanel, setShowCommentPanel] = useState(false);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  
  // Undo/Redo for cell edits
  const {
    state: editHistory,
    setState: addEditToHistory,
    undo,
    redo,
    historyInfo
  } = useUndoRedo<{ submissionId: string; fieldKey: string; value: any }[]>([]);
  
  // Initialize sortedSubmissions early for use in keyboard navigation
  const sortedSubmissions = useMemo(() => {
    if (!form) return [];
    
    let sorted = [...submissions];
    if (sortField) {
      sorted.sort((a, b) => {
        let aVal = a.data[sortField];
        let bVal = b.data[sortField];
        
        // Handle different data types
        if (typeof aVal === 'string') aVal = aVal.toLowerCase();
        if (typeof bVal === 'string') bVal = bVal.toLowerCase();
        
        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sorted;
  }, [submissions, sortField, sortDirection, form]);
  
  // Keyboard navigation
  const {
    activeCell,
    setActiveCell,
    isEditing: isCellEditing,
    setIsEditing: setIsCellEditing
  } = useTableKeyboardNavigation({
    enabled: true,
    totalRows: sortedSubmissions.length,
    totalColumns: form?.fields.length || 0,
    onCellSelect: (row, col) => {
      // Focus on the selected cell
      const cellId = `cell-${row}-${col}`;
      document.getElementById(cellId)?.focus();
    },
    onCellEdit: (row, col) => {
      // Start editing the selected cell
      const cellId = `cell-${row}-${col}`;
      const editButton = document.querySelector(`#${cellId} .edit-trigger`);
      (editButton as HTMLElement)?.click();
    },
    onCopy: (row, col) => {
      // Copy cell value to clipboard
      const submission = sortedSubmissions[row];
      const field = form?.fields[col];
      if (submission && field) {
        const value = submission.data[field.fieldKey];
        setClipboardData({ value, fieldKey: field.fieldKey });
        navigator.clipboard.writeText(String(value || ''));
        toast.success('Copied to clipboard', { duration: 1500 });
      }
    },
    onPaste: async (row, col) => {
      // Paste clipboard value to cell
      if (clipboardData) {
        const submission = sortedSubmissions[row];
        const field = form?.fields[col];
        if (submission && field) {
          await handleCellSave(submission.id, field.fieldKey, clipboardData.value);
          toast.success('Pasted from clipboard', { duration: 1500 });
        }
      }
    }
  });
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const itemsPerPage = 50;

  useEffect(() => {
    // Initial load - fetch everything
    fetchFormAndSubmissions(false, true);
  }, [id]);

  useEffect(() => {
    // When page or filter changes, only fetch submissions (not form structure)
    if (form) {
      fetchFormAndSubmissions(false, false);
    }
  }, [currentPage, filterStatus]);

  // Fetch when debounced search changes
  useEffect(() => {
    if (form && debouncedSearchQuery !== undefined) {
      fetchFormAndSubmissions(false, false);
    }
  }, [debouncedSearchQuery]);

  // Fetch comment counts when submissions change
  useEffect(() => {
    if (submissions.length > 0) {
      fetchCommentCounts();
    }
  }, [submissions]);

  const fetchFormAndSubmissions = async (showRefreshToast = false, isInitialLoad = true) => {
    try {
      // Only show full page loading on very first load
      if (isInitialLoad && !form) {
        setLoading(true);
      } else if (!isRefreshing) {
        // Show table loading for pagination/filter changes
        setTableLoading(true);
      }
      
      // Only fetch form details on initial load (not during refresh or pagination)
      if (isInitialLoad && !form) {
        const formResponse = await api.get(`/api/forms/${id}`);
        const formData = formResponse.data.data || formResponse.data;
        setForm(formData);
        
        // Initialize column configs for resizable table
        if (formData.fields) {
          const configs = formData.fields.map((field: FormField) => ({
            id: field.id,
            key: field.fieldKey,
            label: field.label,
            width: 200,
            minWidth: 100,
            maxWidth: 400,
            resizable: true,
            sortable: true,
            visible: true
          }));
          setColumnConfigs(configs);
          setVisibleColumns(new Set(configs.map((c: any) => c.id)));
        }
      }
      
      // Always fetch submissions (this is what we want to refresh)
      const params: Record<string, string | number> = {
        page: currentPage,
        limit: itemsPerPage
      };

      if (filterStatus !== 'all') {
        params.status = filterStatus;
      }

      if (debouncedSearchQuery) {
        params.search = debouncedSearchQuery;
      }

      const submissionsResponse = await api.get(`/api/forms/${id}/submissions`, { params });
      
      if (submissionsResponse.data.data) {
        setSubmissions(submissionsResponse.data.data.submissions || []);
        const pages = submissionsResponse.data.data.pagination?.pages || 0;
        setTotalPages(pages === 0 ? 1 : pages);
      } else {
        setSubmissions(submissionsResponse.data.submissions || []);
        const pages = submissionsResponse.data.pagination?.pages || submissionsResponse.data.totalPages || 0;
        setTotalPages(pages === 0 ? 1 : pages);
      }
      
      if (showRefreshToast) {
        toast.success('Table data refreshed successfully', {
          duration: 2000,
          position: 'bottom-right',
          style: {
            background: '#10B981',
            color: 'white',
            fontSize: '14px'
          },
          icon: '🔄'
        });
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to refresh table data');
    } finally {
      // Only reset loading if it was set for this operation
      if (isInitialLoad && !form) {
        setLoading(false);
      }
      setTableLoading(false);
      setIsRefreshing(false);
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

  // Load more data for infinite scroll
  const loadMoreSubmissions = async (page: number) => {
    try {
      const params: Record<string, string | number> = {
        page,
        limit: itemsPerPage
      };
      
      if (filterStatus !== 'all') {
        params.status = filterStatus;
      }
      
      if (debouncedSearchQuery) {
        params.search = debouncedSearchQuery;
      }
      
      const response = await api.get(`/api/forms/${id}/submissions`, { params });
      const newSubmissions = response.data.data?.submissions || response.data.submissions || [];
      const totalPages = response.data.data?.pagination?.pages || response.data.pagination?.pages || 0;
      
      return {
        data: newSubmissions,
        hasMore: page < totalPages
      };
    } catch (error) {
      console.error('Failed to load more submissions:', error);
      throw error;
    }
  };

  const handleRefresh = async () => {
    // Save current scroll position
    const tableContainer = document.querySelector('.overflow-x-auto');
    if (tableContainer) {
      setScrollPosition(tableContainer.scrollTop);
    }
    
    // Only refresh table data, not the entire page
    setIsRefreshing(true);
    await fetchFormAndSubmissions(true, false); // false = not initial load
    
    // Restore scroll position after refresh
    setTimeout(() => {
      if (tableContainer && scrollPosition > 0) {
        tableContainer.scrollTop = scrollPosition;
      }
    }, 100);
  };

  const handleSort = (fieldName: string) => {
    if (sortField === fieldName) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(fieldName);
      setSortDirection('asc');
    }
  };

  const handleCellSave = useCallback(async (submissionId: string, fieldKey: string, newValue: string | number | boolean | null) => {
    // Add to undo history
    const oldValue = submissions.find(s => s.id === submissionId)?.data[fieldKey];
    addEditToHistory(
      `Edit ${fieldKey}`,
      [...editHistory, { submissionId, fieldKey, value: oldValue }]
    );

    const originalSubmissions = [...submissions];
    
    try {
      // Optimistic update - Update UI immediately for better UX
      const submissionData = submissions.find(s => s.id === submissionId)?.data || {};
      const updatedData = {
        ...submissionData,
        [fieldKey]: newValue
      };

      // Update local state optimistically
      setSubmissions(prevSubmissions => 
        prevSubmissions.map(sub => 
          sub.id === submissionId 
            ? { ...sub, data: updatedData, updatedAt: new Date().toISOString() }
            : sub
        )
      );

      // Call API to update submission
      const response = await api.put(`/api/forms/${id}/submissions/${submissionId}`, {
        data: updatedData,
        partial: true
      });

      if (response.data.success) {
        // Success - toast notification
        toast.success('Updated successfully', {
          duration: 2000,
          position: 'bottom-right',
          style: {
            background: '#10B981',
            color: 'white',
            fontSize: '14px'
          }
        });
      } else {
        throw new Error('Update failed');
      }
    } catch (error) {
      console.error('Failed to update cell:', error);
      
      // Revert optimistic update on error
      setSubmissions(originalSubmissions);
      
      toast.error('Failed to update. Please try again.', {
        duration: 4000,
        position: 'bottom-right',
        style: {
          background: '#EF4444',
          color: 'white',
          fontSize: '14px'
        }
      });
      throw error;
    }
  }, [submissions, id, editHistory, addEditToHistory]);


  const renderCellValue = (value: unknown, fieldType: string): string | JSX.Element => {
    if (value === null || value === undefined) return '-';
    
    switch (fieldType) {
      case 'checkbox':
        return value ? '✓' : '✗';
      case 'date':
        return formatDate(value);
      case 'file':
        if (typeof value === 'object' && value.filename) {
          return (
            <a 
              href={value.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              {value.originalName || value.filename}
            </a>
          );
        }
        return '-';
      case 'select':
      case 'radio':
        if (Array.isArray(value)) {
          return value.join(', ');
        }
        return String(value);
      default:
        if (typeof value === 'boolean') return value ? 'Yes' : 'No';
        if (Array.isArray(value)) return value.join(', ');
        if (typeof value === 'object') return JSON.stringify(value);
        return String(value);
    }
  };

  const handleExport = async (format: 'csv' | 'xlsx' | 'json') => {
    try {
      const params: any = { format, include_metadata: 'true' };
      
      if (filterStatus !== 'all') {
        params.status = filterStatus;
      }

      const response = await api.get(`/api/forms/${id}/submissions/export`, {
        params,
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `table-view-${id}-${new Date().toISOString()}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success(`Data exported as ${format.toUpperCase()}`);
    } catch (error) {
      console.error('Failed to export:', error);
      toast.error('Failed to export data');
    }
  };

  const showSubmissionDetails = (submission: Submission) => {
    setSelectedSubmission(submission);
    setShowDetailModal(true);
  };

  // Bulk selection handlers
  const handleSelectAll = () => {
    if (selectedSubmissions.size === sortedSubmissions.length) {
      setSelectedSubmissions(new Set());
    } else {
      setSelectedSubmissions(new Set(sortedSubmissions.map(s => s.id)));
    }
  };

  const handleSelectSubmission = (submissionId: string) => {
    const newSelected = new Set(selectedSubmissions);
    if (newSelected.has(submissionId)) {
      newSelected.delete(submissionId);
    } else {
      newSelected.add(submissionId);
    }
    setSelectedSubmissions(newSelected);
  };

  // Handle bulk edit
  const handleBulkEdit = async (updates: Record<string, any>) => {
    try {
      const selectedIds = Array.from(selectedSubmissions);
      const updatePromises = selectedIds.map(submissionId => 
        api.patch(`/api/forms/${id}/submissions/${submissionId}`, {
          data: updates,
          partial: true
        })
      );
      
      await Promise.all(updatePromises);
      
      toast.success(`Successfully updated ${selectedIds.length} submissions`, {
        duration: 3000,
        position: 'bottom-right'
      });
      
      // Refresh data to show updates
      await fetchFormAndSubmissions(false, false);
      setSelectedSubmissions(new Set());
      
      // Add to undo history
      addEditToHistory(selectedIds.map(id => ({ 
        submissionId: id, 
        fieldKey: 'bulk', 
        value: updates 
      })));
    } catch (error) {
      console.error('Failed to apply bulk updates:', error);
      toast.error('Failed to update some submissions. Please try again.');
      throw error;
    }
  };

  const handleBulkDelete = async () => {
    if (selectedSubmissions.size === 0) return;
    
    setIsDeleting(true);
    try {
      // Delete each selected submission
      const deletePromises = Array.from(selectedSubmissions).map(submissionId => 
        api.delete(`/api/forms/${id}/submissions/${submissionId}`)
      );
      
      await Promise.all(deletePromises);
      
      // Refresh the data
      await fetchFormAndSubmissions(false, false); // Only refresh table data, not full page
      
      // Clear selections and close modal
      setSelectedSubmissions(new Set());
      setShowBulkDeleteModal(false);
      
      toast.success(`Successfully deleted ${selectedSubmissions.size} submission${selectedSubmissions.size > 1 ? 's' : ''}`, {
        duration: 3000,
        position: 'bottom-right',
        style: {
          background: '#10B981',
          color: 'white',
          fontSize: '14px'
        }
      });
    } catch (error) {
      console.error('Failed to delete submissions:', error);
      toast.error('Failed to delete some submissions. Please try again.', {
        duration: 4000,
        position: 'bottom-right',
        style: {
          background: '#EF4444',
          color: 'white',
          fontSize: '14px'
        }
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Add new row functionality
  const handleImport = async () => {
    if (!importFile || !form || isImporting) return;
    
    setIsImporting(true);
    
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('formId', id || '');
      
      // Send file to backend for import
      const response = await api.post(`/api/forms/${id}/submissions/import`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      if (response.data.success) {
        const imported = response.data.data?.imported || 0;
        const failed = response.data.data?.failed || 0;
        
        toast.success(`Import successful! ${imported} rows imported${failed > 0 ? `, ${failed} failed` : ''}`, {
          duration: 4000,
          position: 'bottom-right',
          style: {
            background: '#10B981',
            color: 'white',
            fontSize: '14px'
          },
          icon: '📥'
        });
        
        // Close modal and refresh data
        setShowImportModal(false);
        setImportFile(null);
        await fetchFormAndSubmissions(false, false);
        
      } else {
        throw new Error(response.data.message || 'Import failed');
      }
    } catch (error: any) {
      console.error('Import error:', error);
      toast.error(error.response?.data?.message || 'Failed to import data. Please check file format.', {
        duration: 5000,
        position: 'bottom-right',
        style: {
          background: '#EF4444',
          color: 'white',
          fontSize: '14px'
        }
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const validTypes = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
      if (!validTypes.includes(file.type) && !file.name.endsWith('.csv')) {
        toast.error('Please select a CSV or Excel file', {
          duration: 3000,
          position: 'bottom-right'
        });
        return;
      }
      
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size must be less than 10MB', {
          duration: 3000,
          position: 'bottom-right'
        });
        return;
      }
      
      setImportFile(file);
    }
  };

  const handleAddNewRow = () => {
    if (!form || isCreatingNewRow) return;
    
    // Initialize new row data with empty values for all form fields
    const initialData: Record<string, any> = {};
    form.fields.forEach(field => {
      switch (field.fieldType) {
        case 'checkbox':
          initialData[field.fieldKey] = false;
          break;
        case 'select':
        case 'radio':
          initialData[field.fieldKey] = field.options?.[0]?.value || '';
          break;
        case 'number':
          initialData[field.fieldKey] = '';
          break;
        default:
          initialData[field.fieldKey] = '';
      }
    });
    
    setNewRowData(initialData);
    setIsCreatingNewRow(true);
  };

  const handleCancelNewRow = () => {
    setNewRowData(null);
    setIsCreatingNewRow(false);
  };

  const handleNewRowCellChange = (fieldKey: string, value: any) => {
    if (!newRowData) return;
    
    setNewRowData(prev => ({
      ...prev!,
      [fieldKey]: value
    }));
  };

  const handleSaveNewRow = async () => {
    if (!newRowData || !form || isSavingNewRow) return;
    
    // Validate required fields
    const missingFields = form.fields
      .filter(field => field.required && (!newRowData[field.fieldKey] || newRowData[field.fieldKey] === ''))
      .map(field => field.label);
    
    if (missingFields.length > 0) {
      toast.error(`Please fill in required fields: ${missingFields.join(', ')}`, {
        duration: 4000,
        position: 'bottom-right'
      });
      return;
    }
    
    setIsSavingNewRow(true);
    
    try {
      // Create new submission
      const submissionData = {
        data: newRowData,
        status: 'completed',
        metadata: {
          source: 'table_view',
          device: { type: 'desktop' }
        }
      };

      const response = await api.post(`/api/forms/${id}/submissions`, submissionData);
      
      if (response.data.success) {
        toast.success('New row added successfully!', {
          duration: 3000,
          position: 'bottom-right',
          style: {
            background: '#10B981',
            color: 'white',
            fontSize: '14px'
          }
        });
        
        // Clear new row state
        setNewRowData(null);
        setIsCreatingNewRow(false);
        
        // Refresh data to show new submission
        await fetchFormAndSubmissions(false, false); // Only refresh table data
      } else {
        throw new Error('Failed to create submission');
      }
    } catch (error) {
      console.error('Failed to save new row:', error);
      toast.error('Failed to save new row. Please try again.', {
        duration: 4000,
        position: 'bottom-right',
        style: {
          background: '#EF4444',
          color: 'white',
          fontSize: '14px'
        }
      });
    } finally {
      setIsSavingNewRow(false);
    }
  };

  // Show skeleton loading on initial load
  if (loading && !form) {
    return (
      <div className="container-fluid mx-auto px-4 py-8">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-gray-200 rounded-lg animate-pulse"></div>
              <div>
                <div className="h-6 w-32 bg-gray-200 rounded animate-pulse mb-2"></div>
                <div className="h-4 w-48 bg-gray-200 rounded animate-pulse"></div>
              </div>
            </div>
            <div className="flex space-x-2">
              <div className="h-10 w-24 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-10 w-24 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-10 w-24 bg-gray-200 rounded animate-pulse"></div>
            </div>
          </div>
        </div>
        <TableSkeleton rows={10} columns={5} />
      </div>
    );
  }

  // Show error if form not found after loading
  if (!loading && !form) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-center text-gray-600">Form not found</p>
      </div>
    );
  }

  // If form exists but still loading (shouldn't happen with our new logic), continue rendering
  if (!form) {
    return null;
  }

  return (
    <div className="container-fluid mx-auto px-4 py-8">
      <style>{`
        .editable-table {
          table-layout: fixed;
        }
        .editable-table td {
          word-wrap: break-word;
          overflow-wrap: break-word;
        }
        .editable-cell-container {
          transition: all 0.2s ease-in-out;
        }
        .editable-cell-container:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        .table-row-hover:hover .sticky-cell {
          background-color: rgb(249 250 251);
        }
        .sticky-checkbox {
          position: sticky;
          left: 0;
          z-index: 10;
          background-color: inherit;
        }
        .sticky-number {
          position: sticky;
          left: 3rem;
          z-index: 10;
          background-color: inherit;
        }
        .selected-row {
          background-color: rgb(239 246 255) !important;
        }
        .selected-row:hover {
          background-color: rgb(219 234 254) !important;
        }
        .new-row {
          background-color: rgb(254 249 195) !important;
          border: 2px solid rgb(251 191 36) !important;
        }
        .new-row:hover {
          background-color: rgb(253 230 138) !important;
        }
        .new-row .editable-cell-container {
          border-color: rgb(251 191 36);
        }
      `}</style>
      {/* Header - Updated to hide Submitted At and Status columns */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => {
                // Check if we came from forms list or from submissions page
                const searchParams = new URLSearchParams(location.search);
                const fromParam = searchParams.get('from');
                
                if (fromParam === 'forms-list') {
                  navigate('/forms');
                } else {
                  navigate(`/forms/${id}/submissions`);
                }
              }}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              title="Go back"
              aria-label="Navigate back to previous page"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Table View</h1>
              <p className="text-gray-600">{form.name} - {submissions.length} submissions</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Undo/Redo Buttons */}
            <div className="flex items-center border-r pr-2 mr-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const result = undo();
                  if (result.success) {
                    toast.success(`Undone: ${result.action}`, { duration: 1500 });
                    fetchFormAndSubmissions(false, false);
                  } else {
                    toast.error('Nothing to undo', { duration: 1500 });
                  }
                }}
                disabled={!historyInfo.canUndo}
                aria-label="Undo last action"
                title={`Undo (${historyInfo.historySize} actions)`}
                className="mr-1"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const result = redo();
                  if (result.success) {
                    toast.success(`Redone: ${result.action}`, { duration: 1500 });
                    fetchFormAndSubmissions(false, false);
                  } else {
                    toast.error('Nothing to redo', { duration: 1500 });
                  }
                }}
                disabled={!historyInfo.canRedo}
                aria-label="Redo last action"
                title="Redo"
              >
                <RotateCw className="w-4 h-4" />
              </Button>
            </div>
            
            {/* Virtual Scrolling Toggle */}
            <Button
              size="sm"
              variant={enableVirtualScrolling ? 'primary' : 'outline'}
              onClick={() => {
                setEnableVirtualScrolling(!enableVirtualScrolling);
                toast.success(
                  enableVirtualScrolling ? 'Virtual scrolling disabled' : 'Virtual scrolling enabled',
                  { duration: 1500 }
                );
              }}
              aria-label="Toggle virtual scrolling"
              title={enableVirtualScrolling ? 'Disable virtual scrolling' : 'Enable virtual scrolling for better performance'}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              <Zap className="w-4 h-4" />
            </Button>
            
            {/* Resizable Columns Toggle */}
            <Button
              size="sm"
              variant={enableResizableColumns ? 'primary' : 'outline'}
              onClick={() => {
                setEnableResizableColumns(!enableResizableColumns);
                toast.success(
                  enableResizableColumns ? 'Resizable columns disabled' : 'Resizable columns enabled',
                  { duration: 1500 }
                );
              }}
              aria-label="Toggle resizable columns"
              title={enableResizableColumns ? 'Disable resizable columns' : 'Enable column resizing and reordering'}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <Columns className="w-4 h-4" />
            </Button>
            
            {/* Infinite Scroll Toggle */}
            <Button
              size="sm"
              variant={enableInfiniteScroll ? 'primary' : 'outline'}
              onClick={() => {
                setEnableInfiniteScroll(!enableInfiniteScroll);
                if (!enableInfiniteScroll) {
                  // Reset to first page when enabling infinite scroll
                  setCurrentPage(1);
                  setAllSubmissions([]);
                }
                toast.success(
                  enableInfiniteScroll ? 'Infinite scroll disabled' : 'Infinite scroll enabled',
                  { duration: 1500 }
                );
              }}
              aria-label="Toggle infinite scroll"
              title={enableInfiniteScroll ? 'Disable infinite scroll' : 'Enable infinite scroll for continuous loading'}
              className="bg-teal-600 hover:bg-teal-700 text-white"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </Button>
            
            {/* Column Visibility Toggle */}
            {form && form.fields.length > 0 && (
              <ColumnVisibilityToggle
                columns={columnConfigs.map(c => ({
                  key: c.id,
                  label: c.label,
                  visible: visibleColumns.has(c.id),
                  locked: false
                }))}
                onChange={(updatedColumns) => {
                  const newVisible = new Set(
                    updatedColumns.filter(c => c.visible).map(c => c.key)
                  );
                  setVisibleColumns(newVisible);
                  setColumnConfigs(columnConfigs.map(c => ({
                    ...c,
                    visible: newVisible.has(c.id)
                  })));
                }}
              />
            )}
            
            {/* Refresh Button */}
            <Button
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              aria-label="Refresh table data"
              className="bg-green-500 hover:bg-green-600 text-white"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
            
            {/* Add Row Button */}
            <Button
              size="sm"
              onClick={handleAddNewRow}
              disabled={isCreatingNewRow}
              aria-label="Add new row to table"
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              {isCreatingNewRow ? 'Adding...' : 'Add Row'}
            </Button>
            
            {/* Import Button */}
            <Button
              size="sm"
              onClick={() => setShowImportModal(true)}
              aria-label="Import data to table"
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Upload className="w-4 h-4 mr-2" />
              Import
            </Button>
            
            {/* Export Button */}
            <div className="relative">
              <Button
                size="sm"
                onClick={() => document.getElementById('export-menu')?.classList.toggle('hidden')}
                aria-label="Export table data"
                aria-haspopup="true"
                aria-expanded={false}
              >
                <Download className="w-4 h-4 mr-2" />
                Export Table
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
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
          <div className="flex items-center space-x-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                type="text"
                placeholder="Search in table..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && fetchFormAndSubmissions(false, false)}
                className="pl-10"
                aria-label="Search submissions in table"
              />
            </div>
            
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              aria-label="Filter submissions by status"
            >
              <option value="all">All Status</option>
              <option value="submitted">Submitted</option>
              <option value="completed">Completed</option>
              <option value="draft">Draft</option>
              <option value="processing">Processing</option>
              <option value="failed">Failed</option>
            </select>

            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchFormAndSubmissions(false, false)}
            >
              <Filter className="w-4 h-4 mr-2" />
              Apply Filters
            </Button>
            
            {selectedSubmissions.size > 0 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowBulkEditModal(true)}
                  className="border-blue-300 text-blue-600 hover:bg-blue-50 hover:border-blue-400"
                >
                  <Edit2 className="w-4 h-4 mr-2" />
                  Edit ({selectedSubmissions.size})
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowBulkDeleteModal(true)}
                  className="border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete ({selectedSubmissions.size})
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden relative">
        {/* Loading overlay for refresh and table updates - only shows over table content */}
        {(isRefreshing || tableLoading) && (
          <div className="absolute inset-0 bg-white bg-opacity-75 z-20 flex items-center justify-center">
            <div className="flex flex-col items-center space-y-2">
              <RefreshCw className="w-8 h-8 text-green-500 animate-spin" />
              <span className="text-sm text-gray-600 font-medium">
                {isRefreshing ? 'Refreshing table data...' : 'Loading data...'}
              </span>
            </div>
          </div>
        )}
        <div className="overflow-x-auto">
          {enableInfiniteScroll && form ? (
            <InfiniteScrollTable
              data={sortedSubmissions}
              fields={form.fields}
              onLoadMore={loadMoreSubmissions}
              onCellSave={handleCellSave}
              onRowSelect={handleSelectSubmission}
              onViewDetails={showSubmissionDetails}
              selectedRows={selectedSubmissions}
              pageSize={itemsPerPage}
              threshold={200}
              className=""
              // New row props
              isCreatingNewRow={isCreatingNewRow}
              newRowData={newRowData}
              isSavingNewRow={isSavingNewRow}
              onNewRowCellChange={handleNewRowCellChange}
              onSaveNewRow={handleSaveNewRow}
              onCancelNewRow={handleCancelNewRow}
            />
          ) : enableResizableColumns && form ? (
            <ResizableTable
              columns={columnConfigs.filter(c => visibleColumns.has(c.id))}
              data={sortedSubmissions}
              onColumnResize={(columnId, width) => {
                setColumnConfigs(prev => prev.map(c => 
                  c.id === columnId ? { ...c, width } : c
                ));
              }}
              onColumnReorder={(newColumns) => {
                // Update column configs with new order
                const orderedIds = newColumns.map(c => c.id);
                const reordered = orderedIds.map(id => 
                  columnConfigs.find(c => c.id === id)
                ).filter(Boolean);
                const hiddenColumns = columnConfigs.filter(c => !visibleColumns.has(c.id));
                setColumnConfigs([...reordered, ...hiddenColumns]);
              }}
              renderCell={(value, column, row, rowIndex) => (
                <EditableCell
                  value={value}
                  fieldType={form.fields.find(f => f.fieldKey === column.key)?.fieldType || 'text'}
                  fieldKey={column.key}
                  submissionId={row.id}
                  options={form.fields.find(f => f.fieldKey === column.key)?.options}
                  onSave={handleCellSave}
                  disabled={false}
                  className="w-full"
                />
              )}
              onSort={(columnKey, direction) => {
                setSortField(columnKey);
                setSortDirection(direction);
              }}
              className=""
            />
          ) : (
          <table className="min-w-full divide-y divide-gray-200 table-fixed editable-table">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky-checkbox w-12">
                  <div className="flex items-center justify-center">
                    <input
                      type="checkbox"
                      checked={sortedSubmissions.length > 0 && selectedSubmissions.size === sortedSubmissions.length}
                      onChange={handleSelectAll}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                      title={selectedSubmissions.size === sortedSubmissions.length ? 'Deselect all' : 'Select all'}
                    />
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky-number w-16">
                  #
                </th>
                {/* Hidden: Submitted At and Status columns */}
                {form.fields.map((field) => (
                  <th 
                    key={field.id}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 min-w-[150px]"
                    onClick={() => handleSort(field.fieldKey)}
                  >
                    <div className="flex items-center">
                      <span className="flex items-center">
                        {field.label}
                        {field.required && <span className="text-red-500 ml-1">*</span>}
                      </span>
                      <Edit2 className="w-3 h-3 ml-1 text-gray-400" />
                      {sortField === field.fieldKey && (
                        sortDirection === 'asc' ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />
                      )}
                    </div>
                  </th>
                ))}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Comments
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {/* New Row (when adding) */}
              {isCreatingNewRow && newRowData && (
                <tr className="new-row">
                  <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900 sticky-checkbox w-12">
                    <div className="flex items-center justify-center h-10">
                      <span className="text-xs text-green-600 font-semibold">NEW</span>
                    </div>
                  </td>
                  <td className="px-6 py-2 whitespace-nowrap text-sm font-medium text-gray-900 sticky-number w-16">
                    <div className="flex items-center h-10">
                      <span className="text-green-600">+</span>
                    </div>
                  </td>
                  {form?.fields.map((field) => (
                    <td key={field.id} className="px-6 py-2 text-sm text-gray-900 min-w-[150px] max-w-[300px] align-top">
                      <div className="w-full min-h-[2.5rem] flex items-start">
                        <EditableCell
                          value={newRowData[field.fieldKey]}
                          fieldType={field.fieldType}
                          fieldKey={field.fieldKey}
                          submissionId="new"
                          options={field.options}
                          onSave={(submissionId, fieldKey, newValue) => {
                            handleNewRowCellChange(fieldKey, newValue);
                            return Promise.resolve();
                          }}
                          disabled={isSavingNewRow}
                          className="w-full border-yellow-300"
                          isNewRow={true}
                        />
                      </div>
                    </td>
                  ))}
                  <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-500">
                    {/* No comments for new row */}
                  </td>
                  <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex items-center h-10 space-x-2">
                      <button
                        onClick={handleSaveNewRow}
                        disabled={isSavingNewRow}
                        className="p-1.5 text-white bg-green-600 hover:bg-green-700 rounded transition-colors duration-200 disabled:opacity-50"
                        title="Save new row"
                        aria-label="Save new row"
                      >
                        {isSavingNewRow ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                      <button
                        onClick={handleCancelNewRow}
                        disabled={isSavingNewRow}
                        className="p-1.5 text-white bg-red-600 hover:bg-red-700 rounded transition-colors duration-200 disabled:opacity-50"
                        title="Cancel new row"
                        aria-label="Cancel new row"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              )}
              
              {sortedSubmissions.map((submission, index) => (
                <tr key={submission.id} className={`group transition-colors duration-200 ${
                  selectedSubmissions.has(submission.id) ? 'selected-row' : 'hover:bg-gray-50'
                }`}>
                  <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900 sticky-checkbox w-12">
                    <div className="flex items-center justify-center h-10">
                      <input
                        type="checkbox"
                        checked={selectedSubmissions.has(submission.id)}
                        onChange={() => handleSelectSubmission(submission.id)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                        title={`Select submission #${(currentPage - 1) * itemsPerPage + index + 1}`}
                      />
                    </div>
                  </td>
                  <td className="px-6 py-2 whitespace-nowrap text-sm font-medium text-gray-900 sticky-number w-16">
                    <div className="flex items-center h-10">
                      {(currentPage - 1) * itemsPerPage + index + 1}
                    </div>
                  </td>
                  {/* Hidden: Submitted At and Status cells */}
                  {form.fields.map((field) => (
                    <td key={field.id} className="px-6 py-2 text-sm text-gray-900 min-w-[150px] max-w-[300px] align-top">
                      <div className="w-full min-h-[2.5rem] flex items-start">
                        <EditableCell
                          value={submission.data[field.fieldKey]}
                          fieldType={field.fieldType}
                          fieldKey={field.fieldKey}
                          submissionId={submission.id}
                          options={field.options}
                          onSave={handleCellSave}
                          disabled={false}
                          className="w-full"
                        />
                      </div>
                    </td>
                  ))}
                  <td className="px-6 py-2 whitespace-nowrap">
                    <div className="flex items-center h-10">
                      <CommentButton
                        commentCount={commentCounts[submission.id] || 0}
                        onClick={() => {
                          setSelectedSubmissionId(submission.id);
                          setShowCommentPanel(true);
                        }}
                      />
                    </div>
                  </td>
                  <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex items-center h-10 space-x-2">
                      <button
                        onClick={() => showSubmissionDetails(submission)}
                        className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors duration-200"
                        title="View details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {sortedSubmissions.length === 0 && (
                <tr>
                  <td colSpan={form.fields.length + 4} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center space-y-2">
                      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <p className="text-gray-500 font-medium">No submissions found</p>
                      <p className="text-sm text-gray-400">Data will appear here when form submissions are received</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          )}
        </div>
      </div>

      {/* Pagination - Hide when infinite scroll is enabled */}
      {totalPages > 1 && !enableInfiniteScroll && (
        <div className="mt-6 flex justify-center">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedSubmission && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Submission Details</h2>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ×
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500">Submission ID</p>
                <p className="font-mono text-sm">{selectedSubmission.id}</p>
              </div>
              
              <div>
                <p className="text-sm text-gray-500">Submitted At</p>
                <p>{selectedSubmission.submittedAt ? formatDate(selectedSubmission.submittedAt) : 'Not submitted'}</p>
              </div>
              
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <Badge 
                  variant={
                    selectedSubmission.status === 'completed' ? 'success' :
                    selectedSubmission.status === 'submitted' ? 'info' :
                    selectedSubmission.status === 'draft' ? 'warning' :
                    selectedSubmission.status === 'failed' ? 'error' : 'default'
                  }
                >
                  {selectedSubmission.status}
                </Badge>
              </div>
              
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-2">Form Data</h3>
                <div className="space-y-2">
                  {form.fields.map((field) => (
                    <div key={field.id} className="flex">
                      <span className="font-medium text-sm w-1/3">{field.label}:</span>
                      <span className="text-sm w-2/3">
                        {renderCellValue(selectedSubmission.data[field.fieldKey], field.fieldType)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="mt-6 flex justify-end">
              <Button
                variant="outline"
                onClick={() => setShowDetailModal(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Bulk Edit Modal */}
      {form && (
        <BulkEditModal
          isOpen={showBulkEditModal}
          onClose={() => setShowBulkEditModal(false)}
          selectedCount={selectedSubmissions.size}
          fields={form.fields}
          onApply={handleBulkEdit}
        />
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                  <Upload className="w-5 h-5 text-blue-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">Import Data</h2>
              </div>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportFile(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-4">
                  Upload a CSV or Excel file to import data into this form. The file should have columns matching the form fields.
                </p>
                
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <input
                    type="file"
                    id="import-file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <label
                    htmlFor="import-file"
                    className="cursor-pointer"
                  >
                    {importFile ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-center">
                          <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <p className="text-sm font-medium text-gray-900">{importFile.name}</p>
                        <p className="text-xs text-gray-500">
                          {(importFile.size / 1024).toFixed(2)} KB
                        </p>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            setImportFile(null);
                          }}
                          className="text-xs text-red-600 hover:text-red-800"
                        >
                          Remove file
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Upload className="w-12 h-12 text-gray-400 mx-auto" />
                        <p className="text-sm text-gray-600">
                          Click to browse or drag and drop your file here
                        </p>
                        <p className="text-xs text-gray-500">
                          CSV or Excel files up to 10MB
                        </p>
                      </div>
                    )}
                  </label>
                </div>
              </div>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="w-5 h-5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800">
                      Important Notes
                    </h3>
                    <div className="mt-2 text-xs text-yellow-700">
                      <ul className="list-disc list-inside space-y-1">
                        <li>First row should contain column headers</li>
                        <li>Column names should match form field names</li>
                        <li>Date format: YYYY-MM-DD</li>
                        <li>Boolean values: true/false or 1/0</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <strong>Expected columns for this form:</strong>
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  {form?.fields.map(f => f.label).join(', ')}
                </p>
              </div>
            </div>
            
            <div className="mt-6 flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowImportModal(false);
                  setImportFile(null);
                }}
                disabled={isImporting}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleImport}
                disabled={!importFile || isImporting}
                className="bg-blue-600 hover:bg-blue-700 focus:ring-blue-500"
              >
                {isImporting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Import Data
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Bulk Delete Confirmation Modal */}
      {showBulkDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-600" />
                </div>
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-semibold text-gray-900">Delete Submissions</h3>
              </div>
            </div>
            
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete {selectedSubmissions.size} submission{selectedSubmissions.size > 1 ? 's' : ''}? 
              This action cannot be undone and all associated data will be permanently removed.
            </p>
            
            <div className="flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => setShowBulkDeleteModal(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                className="bg-red-600 hover:bg-red-700 focus:ring-red-500"
                onClick={handleBulkDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete {selectedSubmissions.size} Submission{selectedSubmissions.size > 1 ? 's' : ''}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Comment Panel */}
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

export default DataTableView;