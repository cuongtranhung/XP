/**
 * Data Table View - Refactored Version
 * Modularized table view using smaller, reusable components
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { toast } from 'react-toastify';

// Import modular table components
import {
  TableHeader,
  TableFilters,
  TableContent,
  TableModals,
  TablePagination
} from '../components/table';

// Import custom hooks
import { useDebounce } from '../hooks/useDebounce';
import { useTableKeyboardNavigation } from '../hooks/useTableKeyboardNavigation';
import { useUndoRedo } from '../hooks/useUndoRedo';

// Import utilities
import { saveAs } from 'file-saver';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const DataTableViewRefactored: React.FC = () => {
  const { formId } = useParams<{ formId: string }>();
  const navigate = useNavigate();

  // Form and submissions state
  const [form, setForm] = useState<any>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Table state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortField, setSortField] = useState('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [selectedSubmissions, setSelectedSubmissions] = useState<Set<string>>(new Set());

  // New row state
  const [isCreatingNewRow, setIsCreatingNewRow] = useState(false);
  const [newRowData, setNewRowData] = useState<any>({});
  const [isSavingNewRow, setIsSavingNewRow] = useState(false);

  // Modal state
  const [showImportModal, setShowImportModal] = useState(false);
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);

  // Feature toggles
  const [enableVirtualScrolling, setEnableVirtualScrolling] = useState(false);
  const [enableResizableColumns, setEnableResizableColumns] = useState(false);
  const [enableInfiniteScroll, setEnableInfiniteScroll] = useState(false);

  // Column configuration
  const [columnConfigs, setColumnConfigs] = useState<any[]>([]);
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set());

  // Custom hooks
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const {
    state: undoRedoState,
    setState: setUndoRedoState,
    undo,
    redo,
    canUndo,
    canRedo,
    historySize
  } = useUndoRedo(submissions, 20);

  const { activeCell, handleKeyDown: handleTableKeyDown } = useTableKeyboardNavigation({
    enabled: true,
    totalRows: submissions.length,
    totalColumns: form?.fields?.length || 0,
    onNavigate: (row, col) => {
      console.log(`Navigated to cell [${row}, ${col}]`);
    },
    onEnter: (row, col) => {
      console.log(`Enter pressed on cell [${row}, ${col}]`);
    },
    onEscape: () => {
      console.log('Escape pressed');
    }
  });

  // Fetch form and submissions
  const fetchFormAndSubmissions = useCallback(async (forceRefresh = false, isInitialLoad = true) => {
    try {
      if (isInitialLoad) {
        setLoading(true);
      } else if (forceRefresh) {
        setIsRefreshing(true);
      } else {
        setTableLoading(true);
      }
      setError(null);

      const [formResponse, submissionsResponse] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/forms/${formId}`),
        axios.get(`${API_BASE_URL}/api/forms/${formId}/submissions`)
      ]);

      setForm(formResponse.data);
      setSubmissions(submissionsResponse.data);

      // Initialize column configs
      if (formResponse.data?.fields) {
        const configs = formResponse.data.fields.map((field: any) => ({
          id: field.fieldKey,
          key: field.fieldKey,
          label: field.label,
          width: 150,
          minWidth: 100,
          maxWidth: 300,
          sortable: true,
          resizable: true
        }));
        setColumnConfigs(configs);
        setVisibleColumns(new Set(configs.map((c: any) => c.id)));
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load form data');
      toast.error('Failed to load form data');
    } finally {
      setLoading(false);
      setTableLoading(false);
      setIsRefreshing(false);
    }
  }, [formId]);

  useEffect(() => {
    if (formId) {
      fetchFormAndSubmissions(false, true);
    }
  }, [formId, fetchFormAndSubmissions]);

  // Filtered and sorted submissions
  const filteredSubmissions = useMemo(() => {
    let filtered = [...submissions];

    // Apply search filter
    if (debouncedSearchQuery) {
      filtered = filtered.filter(submission => {
        const searchLower = debouncedSearchQuery.toLowerCase();
        return Object.values(submission.data || {}).some(value =>
          String(value).toLowerCase().includes(searchLower)
        );
      });
    }

    // Apply status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(submission => submission.status === filterStatus);
    }

    return filtered;
  }, [submissions, debouncedSearchQuery, filterStatus]);

  const sortedSubmissions = useMemo(() => {
    const sorted = [...filteredSubmissions];
    sorted.sort((a, b) => {
      let aValue = sortField === 'createdAt' ? a[sortField] : a.data[sortField];
      let bValue = sortField === 'createdAt' ? b[sortField] : b.data[sortField];

      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue?.toLowerCase() || '';
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [filteredSubmissions, sortField, sortDirection]);

  // Paginated submissions
  const paginatedSubmissions = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return sortedSubmissions.slice(start, end);
  }, [sortedSubmissions, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(sortedSubmissions.length / itemsPerPage);

  // Event handlers
  const handleRefresh = async () => {
    await fetchFormAndSubmissions(true, false);
    toast.success('Table data refreshed');
  };

  const handleAddRow = () => {
    setIsCreatingNewRow(true);
    const initialData: any = {};
    form?.fields?.forEach((field: any) => {
      initialData[field.fieldKey] = '';
    });
    setNewRowData(initialData);
  };

  const handleSaveNewRow = async () => {
    try {
      setIsSavingNewRow(true);
      const response = await axios.post(
        `${API_BASE_URL}/api/forms/${formId}/submissions`,
        newRowData
      );
      setSubmissions([response.data, ...submissions]);
      setIsCreatingNewRow(false);
      setNewRowData({});
      toast.success('New row added successfully');
    } catch (error) {
      console.error('Error saving new row:', error);
      toast.error('Failed to save new row');
    } finally {
      setIsSavingNewRow(false);
    }
  };

  const handleCancelNewRow = () => {
    setIsCreatingNewRow(false);
    setNewRowData({});
  };

  const handleCellSave = async (submissionId: string, fieldKey: string, value: any) => {
    try {
      const submission = submissions.find(s => s.id === submissionId);
      if (!submission) return;

      const updatedData = { ...submission.data, [fieldKey]: value };
      await axios.patch(
        `${API_BASE_URL}/api/forms/${formId}/submissions/${submissionId}`,
        updatedData
      );

      setSubmissions(prev =>
        prev.map(s => s.id === submissionId ? { ...s, data: updatedData } : s)
      );
      toast.success('Cell updated successfully');
    } catch (error) {
      console.error('Error updating cell:', error);
      toast.error('Failed to update cell');
      throw error;
    }
  };

  const handleExport = (format: string) => {
    try {
      if (format === 'csv') {
        const csvContent = convertToCSV(sortedSubmissions);
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        saveAs(blob, `${form?.name || 'data'}_export.csv`);
      } else if (format === 'xlsx') {
        const ws = XLSX.utils.json_to_sheet(
          sortedSubmissions.map(s => s.data)
        );
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Data');
        XLSX.writeFile(wb, `${form?.name || 'data'}_export.xlsx`);
      } else if (format === 'json') {
        const jsonContent = JSON.stringify(sortedSubmissions, null, 2);
        const blob = new Blob([jsonContent], { type: 'application/json' });
        saveAs(blob, `${form?.name || 'data'}_export.json`);
      }
      toast.success(`Data exported as ${format.toUpperCase()}`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export data');
    }
  };

  const handleImportData = async (data: any[]) => {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/forms/${formId}/submissions/bulk`,
        { submissions: data }
      );
      await fetchFormAndSubmissions(false, false);
      toast.success(`Successfully imported ${response.data.length} records`);
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Failed to import data');
    }
  };

  const handleBulkDelete = async () => {
    try {
      setIsDeletingBulk(true);
      const idsToDelete = Array.from(selectedSubmissions);
      await axios.delete(`${API_BASE_URL}/api/forms/${formId}/submissions/bulk`, {
        data: { ids: idsToDelete }
      });
      setSubmissions(prev => prev.filter(s => !selectedSubmissions.has(s.id)));
      setSelectedSubmissions(new Set());
      setShowBulkDeleteModal(false);
      toast.success(`Deleted ${idsToDelete.length} submissions`);
    } catch (error) {
      console.error('Bulk delete error:', error);
      toast.error('Failed to delete submissions');
    } finally {
      setIsDeletingBulk(false);
    }
  };

  const handleBulkUpdate = async (updates: any) => {
    try {
      const idsToUpdate = Array.from(selectedSubmissions);
      await axios.patch(`${API_BASE_URL}/api/forms/${formId}/submissions/bulk`, {
        ids: idsToUpdate,
        updates
      });
      await fetchFormAndSubmissions(false, false);
      setSelectedSubmissions(new Set());
      setShowBulkEditModal(false);
      toast.success(`Updated ${idsToUpdate.length} submissions`);
    } catch (error) {
      console.error('Bulk update error:', error);
      toast.error('Failed to update submissions');
    }
  };

  // Utility functions
  const convertToCSV = (data: any[]) => {
    if (!data.length) return '';
    const headers = Object.keys(data[0].data);
    const csvHeaders = headers.join(',');
    const csvRows = data.map(row =>
      headers.map(header => {
        const value = row.data[header];
        return typeof value === 'string' && value.includes(',')
          ? `"${value}"`
          : value;
      }).join(',')
    );
    return [csvHeaders, ...csvRows].join('\n');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6" onKeyDown={handleTableKeyDown}>
      <div className="max-w-full mx-auto">
        {/* Table Header */}
        <TableHeader
          formName={form?.name || 'Untitled Form'}
          onBack={() => navigate('/dashboard')}
          onRefresh={handleRefresh}
          onAddRow={handleAddRow}
          onImport={() => setShowImportModal(true)}
          onExport={handleExport}
          onUndo={undo}
          onRedo={redo}
          canUndo={canUndo}
          canRedo={canRedo}
          historySize={historySize}
          isRefreshing={isRefreshing}
          isCreatingNewRow={isCreatingNewRow}
          enableVirtualScrolling={enableVirtualScrolling}
          onToggleVirtualScrolling={() => setEnableVirtualScrolling(!enableVirtualScrolling)}
          enableResizableColumns={enableResizableColumns}
          onToggleResizableColumns={() => setEnableResizableColumns(!enableResizableColumns)}
          enableInfiniteScroll={enableInfiniteScroll}
          onToggleInfiniteScroll={() => setEnableInfiniteScroll(!enableInfiniteScroll)}
          columnConfigs={columnConfigs}
          visibleColumns={visibleColumns}
          onColumnVisibilityChange={(columns) => {
            setVisibleColumns(new Set(columns.filter(c => c.visible).map(c => c.key)));
          }}
        />

        {/* Table Filters */}
        <TableFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSearchSubmit={() => setCurrentPage(1)}
          filterStatus={filterStatus}
          onFilterStatusChange={setFilterStatus}
          onApplyFilters={() => setCurrentPage(1)}
          selectedCount={selectedSubmissions.size}
          onBulkEdit={() => setShowBulkEditModal(true)}
          onBulkDelete={() => setShowBulkDeleteModal(true)}
        />

        {/* Table Content */}
        <TableContent
          form={form}
          submissions={submissions}
          sortedSubmissions={paginatedSubmissions}
          selectedSubmissions={selectedSubmissions}
          isRefreshing={isRefreshing}
          tableLoading={tableLoading}
          enableInfiniteScroll={enableInfiniteScroll}
          enableResizableColumns={enableResizableColumns}
          columnConfigs={columnConfigs}
          visibleColumns={visibleColumns}
          sortField={sortField}
          sortDirection={sortDirection}
          currentPage={currentPage}
          itemsPerPage={itemsPerPage}
          isCreatingNewRow={isCreatingNewRow}
          newRowData={newRowData}
          isSavingNewRow={isSavingNewRow}
          onLoadMore={async (page) => {
            // For infinite scroll
            const start = page * itemsPerPage;
            const end = start + itemsPerPage;
            const newData = sortedSubmissions.slice(start, end);
            return { data: newData, hasMore: end < sortedSubmissions.length };
          }}
          onCellSave={handleCellSave}
          onSelectSubmission={(id) => {
            const newSelection = new Set(selectedSubmissions);
            if (newSelection.has(id)) {
              newSelection.delete(id);
            } else {
              newSelection.add(id);
            }
            setSelectedSubmissions(newSelection);
          }}
          onSelectAll={() => {
            if (selectedSubmissions.size === paginatedSubmissions.length) {
              setSelectedSubmissions(new Set());
            } else {
              setSelectedSubmissions(new Set(paginatedSubmissions.map(s => s.id)));
            }
          }}
          onSort={(field) => {
            if (sortField === field) {
              setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
            } else {
              setSortField(field);
              setSortDirection('asc');
            }
            setCurrentPage(1);
          }}
          onColumnResize={(columnId, width) => {
            setColumnConfigs(prev =>
              prev.map(c => c.id === columnId ? { ...c, width } : c)
            );
          }}
          onColumnReorder={(columns) => {
            setColumnConfigs(columns);
          }}
          onNewRowCellChange={(fieldKey, value) => {
            setNewRowData((prev: any) => ({ ...prev, [fieldKey]: value }));
          }}
          onSaveNewRow={handleSaveNewRow}
          onCancelNewRow={handleCancelNewRow}
          onViewDetails={setSelectedSubmission}
        />

        {/* Table Pagination */}
        {!enableInfiniteScroll && (
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={sortedSubmissions.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={(value) => {
              setItemsPerPage(value);
              setCurrentPage(1);
            }}
            startItem={(currentPage - 1) * itemsPerPage + 1}
            endItem={Math.min(currentPage * itemsPerPage, sortedSubmissions.length)}
          />
        )}

        {/* Table Modals */}
        <TableModals
          showImportModal={showImportModal}
          onCloseImportModal={() => setShowImportModal(false)}
          onImportData={handleImportData}
          showBulkEditModal={showBulkEditModal}
          onCloseBulkEditModal={() => setShowBulkEditModal(false)}
          selectedSubmissions={selectedSubmissions}
          submissions={submissions}
          form={form}
          onBulkUpdate={handleBulkUpdate}
          showBulkDeleteModal={showBulkDeleteModal}
          onCloseBulkDeleteModal={() => setShowBulkDeleteModal(false)}
          onConfirmBulkDelete={handleBulkDelete}
          bulkDeleteCount={selectedSubmissions.size}
          isDeletingBulk={isDeletingBulk}
          selectedSubmission={selectedSubmission}
          onCloseDetailModal={() => setSelectedSubmission(null)}
        />
      </div>
    </div>
  );
};

export default DataTableViewRefactored;