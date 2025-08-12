/**
 * Table Modals Component
 * Manages all modal dialogs for the table view
 */

import React from 'react';
import ImportModal from '../ImportModal';
import BulkEditModal from '../BulkEditModal';
import DetailModal from '../DetailModal';

export interface TableModalsProps {
  // Import Modal
  showImportModal: boolean;
  onCloseImportModal: () => void;
  onImportData: (data: any[]) => Promise<void>;
  
  // Bulk Edit Modal
  showBulkEditModal: boolean;
  onCloseBulkEditModal: () => void;
  selectedSubmissions: Set<string>;
  submissions: any[];
  form: any;
  onBulkUpdate: (updates: any) => Promise<void>;
  
  // Bulk Delete Modal
  showBulkDeleteModal: boolean;
  onCloseBulkDeleteModal: () => void;
  onConfirmBulkDelete: () => void;
  bulkDeleteCount: number;
  isDeletingBulk: boolean;
  
  // Detail Modal
  selectedSubmission: any | null;
  onCloseDetailModal: () => void;
}

const TableModals: React.FC<TableModalsProps> = ({
  showImportModal,
  onCloseImportModal,
  onImportData,
  showBulkEditModal,
  onCloseBulkEditModal,
  selectedSubmissions,
  submissions,
  form,
  onBulkUpdate,
  showBulkDeleteModal,
  onCloseBulkDeleteModal,
  onConfirmBulkDelete,
  bulkDeleteCount,
  isDeletingBulk,
  selectedSubmission,
  onCloseDetailModal
}) => {
  return (
    <>
      {/* Import Modal */}
      {showImportModal && (
        <ImportModal
          onClose={onCloseImportModal}
          onImport={onImportData}
        />
      )}
      
      {/* Bulk Edit Modal */}
      {showBulkEditModal && (
        <BulkEditModal
          isOpen={showBulkEditModal}
          onClose={onCloseBulkEditModal}
          selectedIds={selectedSubmissions}
          submissions={submissions}
          fields={form?.fields || []}
          onBulkUpdate={onBulkUpdate}
        />
      )}
      
      {/* Bulk Delete Modal */}
      {showBulkDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4 text-gray-900">
              Confirm Bulk Delete
            </h2>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete {bulkDeleteCount} selected submission(s)? 
              This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-2">
              <button
                onClick={onCloseBulkDeleteModal}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
                disabled={isDeletingBulk}
              >
                Cancel
              </button>
              <button
                onClick={onConfirmBulkDelete}
                disabled={isDeletingBulk}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 font-medium disabled:opacity-50"
              >
                {isDeletingBulk ? (
                  <span className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Deleting...
                  </span>
                ) : (
                  `Delete ${bulkDeleteCount} Item${bulkDeleteCount > 1 ? 's' : ''}`
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Detail Modal */}
      {selectedSubmission && (
        <DetailModal
          submission={selectedSubmission}
          onClose={onCloseDetailModal}
        />
      )}
    </>
  );
};

export default TableModals;