// Activity Log Viewer Component
// Date: 2025-08-04

import React, { useState, useEffect } from 'react';
import { activityService } from '../../services/activityService';
import { ActivityLog, ACTION_TYPES, ACTION_CATEGORIES } from '../../types/activity';
import LoadingSpinner from '../common/LoadingSpinner';
import Alert from '../common/Alert';

interface ActivityLogViewerProps {
  limit?: number;
  showFilters?: boolean;
  title?: string;
}

export const ActivityLogViewer: React.FC<ActivityLogViewerProps> = ({
  limit = 10,
  showFilters = false,
  title = "Recent Activity"
}) => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ualEnabled, setUalEnabled] = useState<boolean | null>(null);
  const [filters, setFilters] = useState({
    action_type: '',
    action_category: '',
    page: 1,
    limit: limit
  });

  const checkUalStatus = async () => {
    try {
      const statusResponse = await activityService.getActivityStatus();
      setUalEnabled(statusResponse.data.enabled);
    } catch (err: any) {
      // If user doesn't have admin access, assume UAL is enabled
      // Only admins can check status, regular users see logs if available
      setUalEnabled(true);
    }
  };

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Check UAL status first
      await checkUalStatus();
      
      const response = await activityService.getUserActivityLogs(filters);
      setLogs(response.data.logs);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [filters]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      page: 1 // Reset to first page when filtering
    }));
  };

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'LOGIN':
        return '🔑';
      case 'LOGOUT':
        return '👋';
      case 'FAILED_LOGIN':
        return '❌';
      case 'CHANGE_PASSWORD':
        return '🔒';
      case 'API_CALL':
        return '📡';
      case 'Profile Update':
        return '👤';
      default:
        return '📝';
    }
  };

  const getActionTypeDisplay = (actionType: string) => {
    return ACTION_TYPES[actionType as keyof typeof ACTION_TYPES] || actionType;
  };

  const getCategoryDisplay = (category: string) => {
    return ACTION_CATEGORIES[category as keyof typeof ACTION_CATEGORIES] || category;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        <div className="flex justify-center py-8">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6">
        <h3 className="text-lg font-semibold mb-4">{title}</h3>

        {/* Filters */}
        {showFilters && (
          <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Action Type
              </label>
              <select
                value={filters.action_type}
                onChange={(e) => handleFilterChange('action_type', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Actions</option>
                {Object.entries(ACTION_TYPES).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category
              </label>
              <select
                value={filters.action_category}
                onChange={(e) => handleFilterChange('action_category', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Categories</option>
                {Object.entries(ACTION_CATEGORIES).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <Alert 
            type="error" 
            message={error}
            dismissible={true}
            onDismiss={() => setError(null)}
            className="mb-4"
          />
        )}

        {/* Activity List */}
        <div className="space-y-3">
          {logs.length === 0 ? (
            <div className="text-gray-500 text-center py-8">
              {ualEnabled === false ? (
                <div className="space-y-2">
                  <div className="text-blue-600 font-medium">Activity Logging is Currently Disabled</div>
                  <div className="text-sm">Activity tracking has been disabled by an administrator.</div>
                </div>
              ) : (
                'No activity logs found'
              )}
            </div>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className="flex items-start space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                {/* Icon */}
                <div className="flex-shrink-0 text-xl">
                  {getActionIcon(log.action_type)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-gray-900">
                        {getActionTypeDisplay(log.action_type)}
                      </span>
                      <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded">
                        {getCategoryDisplay(log.action_category)}
                      </span>
                      {log.response_status && (
                        <span className={`px-2 py-1 text-xs font-medium rounded ${activityService.getStatusColor(log.response_status)} bg-gray-100`}>
                          {log.response_status}
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-gray-500">
                      {activityService.formatDate(log.created_at)}
                    </span>
                  </div>

                  {/* Details */}
                  <div className="mt-1 text-sm text-gray-600">
                    {log.endpoint && (
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                          {log.method} {log.endpoint}
                        </span>
                        {log.processing_time_ms && (
                          <span className="text-xs text-gray-500">
                            {activityService.formatProcessingTime(log.processing_time_ms)}
                          </span>
                        )}
                      </div>
                    )}
                    
                    {log.ip_address && (
                      <div className="mt-1 text-xs text-gray-500">
                        IP: {log.ip_address}
                      </div>
                    )}

                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <details className="mt-2">
                        <summary className="text-xs text-blue-600 cursor-pointer hover:text-blue-800">
                          View Details
                        </summary>
                        <pre className="mt-1 text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Load More Button */}
        {logs.length === filters.limit && (
          <div className="mt-6 text-center">
            <button
              onClick={() => setFilters(prev => ({ ...prev, limit: prev.limit + 10 }))}
              className="px-4 py-2 text-sm font-medium text-blue-600 bg-white border border-blue-600 rounded-md hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Load More
            </button>
          </div>
        )}
      </div>
    </div>
  );
};