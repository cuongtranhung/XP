/**
 * Form Analytics Page
 * Displays analytics and insights for form submissions
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Users, 
  Clock,
  CheckCircle,
  Download,
  Activity
} from '../components/icons';
import { LineChart, DoughnutChart, registerChartJS } from '../components/charts/LazyCharts';
import Button from '../components/common/Button';
import api from '../services/api';
import { formatDate } from '../utils/date';

interface AnalyticsSummary {
  totalSubmissions: number;
  completedSubmissions: number;
  partialSubmissions: number;
  averageCompletionTime: number;
  conversionRate: number;
  uniqueUsers: number;
  submissionsByDate: { date: string; count: number }[];
  deviceStats: { device: string; count: number; percentage: number }[];
  topReferrers: { referrer: string; count: number }[];
}

interface FieldAnalytics {
  fieldKey: string;
  label: string;
  responses: number;
  responseRate: number;
  averageValue?: number;
  distribution?: { value: string; count: number; percentage: number }[];
  topValues?: { value: string; count: number }[];
}

const FormAnalytics: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [fieldAnalytics, setFieldAnalytics] = useState<FieldAnalytics[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState('7d');
  const [form, setForm] = useState<any>(null);

  useEffect(() => {
    // Register Chart.js components when component mounts
    registerChartJS().then(() => {
      fetchAnalytics();
    });
  }, [id, selectedPeriod]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      
      // Fetch form details
      const formResponse = await api.get(`/forms/${id}`);
      setForm(formResponse.data);

      // Fetch analytics summary
      const summaryResponse = await api.get(`/forms/${id}/analytics/summary`, {
        params: { period: selectedPeriod }
      });
      setSummary(summaryResponse.data);

      // Fetch field analytics
      const fieldResponse = await api.get(`/forms/${id}/analytics/fields`, {
        params: { period: selectedPeriod }
      });
      setFieldAnalytics(fieldResponse.data);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportAnalytics = async (format: 'csv' | 'pdf') => {
    try {
      const response = await api.get(`/forms/${id}/analytics/export`, {
        params: { format, period: selectedPeriod },
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `form-analytics-${id}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Failed to export analytics:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">No analytics data available</p>
      </div>
    );
  }

  // Prepare chart data
  const submissionChartData = {
    labels: summary.submissionsByDate.map(d => formatDate(d.date, 'MMM d')),
    datasets: [
      {
        label: 'Submissions',
        data: summary.submissionsByDate.map(d => d.count),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
        fill: true
      }
    ]
  };

  const deviceChartData = {
    labels: summary.deviceStats.map(d => d.device),
    datasets: [
      {
        data: summary.deviceStats.map(d => d.count),
        backgroundColor: [
          'rgba(59, 130, 246, 0.8)',
          'rgba(16, 185, 129, 0.8)',
          'rgba(251, 146, 60, 0.8)',
          'rgba(147, 51, 234, 0.8)'
        ],
        borderWidth: 0
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          precision: 0
        }
      }
    }
  };

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
              <h1 className="text-3xl font-bold text-gray-900">Form Analytics</h1>
              <p className="text-gray-600">{form?.name}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Period Selector */}
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="all">All time</option>
            </select>

            {/* Export Buttons */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportAnalytics('csv')}
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportAnalytics('pdf')}
            >
              <Download className="w-4 h-4 mr-2" />
              Export PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Activity className="w-6 h-6 text-blue-600" />
            </div>
            <span className="text-sm text-gray-500">Total</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{summary.totalSubmissions}</p>
          <p className="text-sm text-gray-600">Total Submissions</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <span className="text-sm text-gray-500">
              {((summary.completedSubmissions / summary.totalSubmissions) * 100).toFixed(1)}%
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{summary.completedSubmissions}</p>
          <p className="text-sm text-gray-600">Completed</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
            <span className="text-sm text-gray-500">Unique</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{summary.uniqueUsers}</p>
          <p className="text-sm text-gray-600">Users</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-orange-100 rounded-lg">
              <Clock className="w-6 h-6 text-orange-600" />
            </div>
            <span className="text-sm text-gray-500">Average</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {Math.round(summary.averageCompletionTime / 60)}m
          </p>
          <p className="text-sm text-gray-600">Completion Time</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Submissions Timeline */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Submissions Over Time</h3>
          <div className="h-64">
            <LineChart data={submissionChartData} options={chartOptions} />
          </div>
        </div>

        {/* Device Distribution */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Device Distribution</h3>
          <div className="h-64">
            <DoughnutChart 
              data={deviceChartData} 
              options={{
                ...chartOptions,
                plugins: {
                  legend: {
                    display: true,
                    position: 'bottom'
                  }
                }
              }} 
            />
          </div>
        </div>
      </div>

      {/* Field Analytics */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Field Analytics</h3>
        <div className="space-y-6">
          {fieldAnalytics.map(field => (
            <div key={field.fieldKey} className="border-b border-gray-200 pb-6 last:border-0">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-gray-900">{field.label}</h4>
                <span className="text-sm text-gray-500">
                  {field.responseRate}% response rate
                </span>
              </div>
              
              {field.distribution && field.distribution.length > 0 && (
                <div className="space-y-2">
                  {field.distribution.slice(0, 5).map((item, index) => (
                    <div key={index} className="flex items-center">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-gray-700">{item.value}</span>
                          <span className="text-sm text-gray-500">{item.percentage}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${item.percentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Top Referrers */}
      {summary.topReferrers && summary.topReferrers.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Referrers</h3>
          <div className="space-y-3">
            {summary.topReferrers.map((referrer, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-gray-700">
                  {referrer.referrer || 'Direct'}
                </span>
                <span className="text-gray-500">{referrer.count} visits</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FormAnalytics;