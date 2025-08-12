/**
 * Form Public Statistics Component
 * Display public metrics for any published form
 */

import React, { useState, useEffect } from 'react';
import { 
  BarChart,
  Users,
  TrendingUp,
  CheckCircle,
  Clock,
  Activity
} from './icons';
import api from '../services/api';
import { formatDate } from '../utils/date';
import toast from 'react-hot-toast';

interface FormPublicStatsProps {
  formId: string;
  className?: string;
}

interface FormStats {
  formId: string;
  formName: string;
  formStatus: string;
  owner: {
    id: string;
    name: string;
  };
  metrics: {
    totalSubmissions: number;
    completedSubmissions: number;
    uniqueSubmitters: number;
    completionRate: number;
    firstSubmission: string | null;
    lastSubmission: string | null;
    isActive: boolean;
  };
  trend: {
    daily: Array<{
      date: string;
      count: number;
    }>;
  };
}

const FormPublicStats: React.FC<FormPublicStatsProps> = ({ formId, className = '' }) => {
  const [stats, setStats] = useState<FormStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPublicStats();
  }, [formId]);

  const fetchPublicStats = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.get(`/api/forms/${formId}/public-stats`);
      
      if (response.data.success) {
        setStats(response.data.data);
      } else {
        setError('Failed to load statistics');
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.error?.message || 'Failed to load statistics';
      setError(errorMessage);
      
      // Don't show toast for 404 errors (form not published)
      if (err.response?.status !== 404) {
        toast.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 ${className}`}>
        <div className="text-center">
          <BarChart className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">
            {error === 'Form not found or not published' 
              ? 'Statistics are only available for published forms'
              : error || 'Unable to load statistics'}
          </p>
        </div>
      </div>
    );
  }

  const maxDailyCount = Math.max(...stats.trend.daily.map(d => d.count), 1);

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            Public Statistics
          </h3>
          <div className="flex items-center space-x-2">
            {stats.metrics.isActive ? (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                <Activity className="w-3 h-3 mr-1" />
                Active
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                <Clock className="w-3 h-3 mr-1" />
                Inactive
              </span>
            )}
          </div>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          Created by {stats.owner.name}
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="px-6 py-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Total</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {stats.metrics.totalSubmissions}
                </p>
              </div>
              <BarChart className="w-8 h-8 text-gray-400" />
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Completed</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {stats.metrics.completedSubmissions}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Users</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {stats.metrics.uniqueSubmitters}
                </p>
              </div>
              <Users className="w-8 h-8 text-blue-500" />
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Rate</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {stats.metrics.completionRate}%
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-purple-500" />
            </div>
          </div>
        </div>

        {/* Activity Timeline */}
        {stats.metrics.firstSubmission && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h4 className="text-sm font-medium text-gray-900 mb-3">Activity Timeline</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">First submission:</span>
                <span className="text-gray-900 font-medium">
                  {formatDate(stats.metrics.firstSubmission)}
                </span>
              </div>
              {stats.metrics.lastSubmission && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Latest submission:</span>
                  <span className="text-gray-900 font-medium">
                    {formatDate(stats.metrics.lastSubmission)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Daily Trend Chart */}
        {stats.trend.daily.length > 0 && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h4 className="text-sm font-medium text-gray-900 mb-3">Last 7 Days</h4>
            <div className="space-y-2">
              {stats.trend.daily.map((day) => (
                <div key={day.date} className="flex items-center space-x-3">
                  <span className="text-xs text-gray-500 w-16">
                    {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}
                  </span>
                  <div className="flex-1 bg-gray-100 rounded-full h-6 relative">
                    <div 
                      className="absolute left-0 top-0 h-full bg-blue-500 rounded-full"
                      style={{ width: `${(day.count / maxDailyCount) * 100}%` }}
                    />
                    <span className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs text-gray-700 font-medium">
                      {day.count}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FormPublicStats;