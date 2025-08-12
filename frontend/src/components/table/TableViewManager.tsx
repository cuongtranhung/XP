/**
 * Table View Manager Component
 * Manages saved table views with filters, sorting, and column configurations
 */

import React, { useState, useEffect } from 'react';
import { Save, Bookmark, Settings, Trash2, Share2, Star } from '../icons';
import { TableViewConfig, FilterGroup, SortConfig, ColumnConfig } from '../../types/table.types';

interface TableViewManagerProps {
  currentView: TableViewConfig | null;
  savedViews: TableViewConfig[];
  currentFilters: FilterGroup | null;
  currentSort: SortConfig | null;
  currentColumns: ColumnConfig[];
  visibleColumns: Set<string>;
  onLoadView: (view: TableViewConfig) => void;
  onSaveView: (view: TableViewConfig) => void;
  onDeleteView: (viewId: string) => void;
  onUpdateView: (viewId: string, updates: Partial<TableViewConfig>) => void;
}

const TableViewManager: React.FC<TableViewManagerProps> = ({
  currentView,
  savedViews,
  currentFilters,
  currentSort,
  currentColumns,
  visibleColumns,
  onLoadView,
  onSaveView,
  onDeleteView,
  onUpdateView
}) => {
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [viewName, setViewName] = useState('');
  const [viewDescription, setViewDescription] = useState('');
  const [isShared, setIsShared] = useState(false);
  const [isDefault, setIsDefault] = useState(false);
  const [editingView, setEditingView] = useState<TableViewConfig | null>(null);

  // Load default view on mount
  useEffect(() => {
    const defaultView = savedViews.find(v => v.isDefault);
    if (defaultView && !currentView) {
      onLoadView(defaultView);
    }
  }, [savedViews, currentView, onLoadView]);

  const handleSaveView = () => {
    if (!viewName.trim()) {
      alert('Please enter a view name');
      return;
    }

    const newView: TableViewConfig = {
      id: editingView?.id || `view-${Date.now()}`,
      name: viewName,
      description: viewDescription,
      filters: currentFilters,
      sortConfig: currentSort || undefined,
      columnConfigs: currentColumns,
      visibleColumns: Array.from(visibleColumns),
      isDefault,
      isShared,
      createdBy: 'current-user', // Would come from auth context
      createdAt: editingView?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (editingView) {
      onUpdateView(editingView.id, newView);
    } else {
      onSaveView(newView);
    }

    // Reset form
    setViewName('');
    setViewDescription('');
    setIsShared(false);
    setIsDefault(false);
    setEditingView(null);
    setShowSaveDialog(false);
  };

  const handleEditView = (view: TableViewConfig) => {
    setEditingView(view);
    setViewName(view.name);
    setViewDescription(view.description || '');
    setIsShared(view.isShared || false);
    setIsDefault(view.isDefault || false);
    setShowSaveDialog(true);
  };

  const handleSetDefault = (viewId: string) => {
    // Remove default from all other views
    savedViews.forEach(view => {
      if (view.isDefault && view.id !== viewId) {
        onUpdateView(view.id, { isDefault: false });
      }
    });
    // Set new default
    onUpdateView(viewId, { isDefault: true });
  };

  const handleShareView = (view: TableViewConfig) => {
    // Copy view configuration to clipboard
    const viewConfig = {
      name: view.name,
      description: view.description,
      filters: view.filters,
      sortConfig: view.sortConfig,
      columnConfigs: view.columnConfigs,
      visibleColumns: view.visibleColumns
    };
    
    navigator.clipboard.writeText(JSON.stringify(viewConfig, null, 2));
    alert(`View configuration copied to clipboard!`);
  };

  const hasUnsavedChanges = () => {
    if (!currentView) return true;
    
    // Check if current state differs from loaded view
    const currentState = {
      filters: currentFilters,
      sortConfig: currentSort,
      visibleColumns: Array.from(visibleColumns)
    };
    
    const viewState = {
      filters: currentView.filters,
      sortConfig: currentView.sortConfig,
      visibleColumns: currentView.visibleColumns
    };
    
    return JSON.stringify(currentState) !== JSON.stringify(viewState);
  };

  return (
    <div className="relative">
      {/* View Selector and Controls */}
      <div className="flex items-center space-x-2">
        <div className="relative">
          <button
            onClick={() => setShowViewMenu(!showViewMenu)}
            className="flex items-center space-x-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <Bookmark className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium">
              {currentView ? currentView.name : 'Default View'}
            </span>
            {hasUnsavedChanges() && (
              <span className="w-2 h-2 bg-orange-500 rounded-full" title="Unsaved changes" />
            )}
          </button>
          
          {/* View Dropdown Menu */}
          {showViewMenu && (
            <div className="absolute top-full left-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-30">
              <div className="p-3 border-b border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900">Saved Views</h3>
              </div>
              
              <div className="max-h-60 overflow-y-auto">
                {savedViews.length === 0 ? (
                  <div className="p-4 text-sm text-gray-500 text-center">
                    No saved views yet
                  </div>
                ) : (
                  savedViews.map(view => (
                    <div
                      key={view.id}
                      className={`p-3 border-b border-gray-100 hover:bg-gray-50 ${
                        currentView?.id === view.id ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 cursor-pointer" onClick={() => {
                          onLoadView(view);
                          setShowViewMenu(false);
                        }}>
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-sm text-gray-900">
                              {view.name}
                            </span>
                            {view.isDefault && (
                              <Star className="w-3 h-3 text-yellow-500 fill-current" />
                            )}
                            {view.isShared && (
                              <Share2 className="w-3 h-3 text-green-500" />
                            )}
                          </div>
                          {view.description && (
                            <p className="text-xs text-gray-500 mt-1">{view.description}</p>
                          )}
                          <div className="flex items-center space-x-3 mt-1">
                            <span className="text-xs text-gray-400">
                              Updated {new Date(view.updatedAt!).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-1 ml-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditView(view);
                            }}
                            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                            title="Edit view"
                          >
                            <Settings className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSetDefault(view.id);
                            }}
                            className="p-1 text-gray-400 hover:text-yellow-500 hover:bg-gray-100 rounded"
                            title="Set as default"
                          >
                            <Star className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleShareView(view);
                            }}
                            className="p-1 text-gray-400 hover:text-green-500 hover:bg-gray-100 rounded"
                            title="Share view"
                          >
                            <Share2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm(`Delete view "${view.name}"?`)) {
                                onDeleteView(view.id);
                              }
                            }}
                            className="p-1 text-gray-400 hover:text-red-500 hover:bg-gray-100 rounded"
                            title="Delete view"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              
              <div className="p-3 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowViewMenu(false);
                    setShowSaveDialog(true);
                  }}
                  className="w-full px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Save Current View
                </button>
              </div>
            </div>
          )}
        </div>
        
        {/* Quick Save Button */}
        {hasUnsavedChanges() && (
          <button
            onClick={() => setShowSaveDialog(true)}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
            title="Save current view"
          >
            <Save className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Save View Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4 text-gray-900">
              {editingView ? 'Edit View' : 'Save Current View'}
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  View Name *
                </label>
                <input
                  type="text"
                  value={viewName}
                  onChange={(e) => setViewName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Active Customers"
                  autoFocus
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={viewDescription}
                  onChange={(e) => setViewDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Describe what this view shows..."
                  rows={3}
                />
              </div>
              
              <div className="space-y-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={isDefault}
                    onChange={(e) => setIsDefault(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Set as default view</span>
                </label>
                
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={isShared}
                    onChange={(e) => setIsShared(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Share with team</span>
                </label>
              </div>
              
              {/* View Configuration Summary */}
              <div className="p-3 bg-gray-50 rounded-lg text-xs text-gray-600">
                <div className="font-semibold mb-1">This view includes:</div>
                <ul className="space-y-1">
                  {currentFilters && <li>• Custom filters applied</li>}
                  {currentSort && <li>• Sort by {currentSort.field} ({currentSort.direction})</li>}
                  <li>• {visibleColumns.size} visible columns</li>
                </ul>
              </div>
            </div>
            
            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => {
                  setShowSaveDialog(false);
                  setEditingView(null);
                  setViewName('');
                  setViewDescription('');
                  setIsShared(false);
                  setIsDefault(false);
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveView}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                {editingView ? 'Update View' : 'Save View'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TableViewManager;