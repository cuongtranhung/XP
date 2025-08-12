/**
 * User Analytics Dashboard
 * Charts for user registrations over time, department distribution, approval rates, activity metrics
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Bar, Line, Pie, Doughnut } from 'react-chartjs-2';
import { toast } from 'react-hot-toast';
import userManagementService from '../../services/userManagementService';
import { Button } from '../common/Button';
import { LoadingSpinner } from '../common/LoadingSpinner';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

interface AnalyticsData {
  userRegistrations: {
    dates: string[];
    counts: number[];
  };
  departmentDistribution: {
    labels: string[];
    data: number[];
  };
  approvalRates: {
    approved: number;
    pending: number;
    rejected: number;
  };
  activityMetrics: {
    totalUsers: number;
    activeUsers: number;
    blockedUsers: number;
    newUsersThisMonth: number;
    lastLoginStats: {
      today: number;
      thisWeek: number;
      thisMonth: number;
      older: number;
    };
  };
  growthTrend: {
    months: string[];
    userCounts: number[];
    approvalCounts: number[];
  };
}

interface AnalyticsDashboardProps {
  className?: string;
}

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  className = ''
}) => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  // Load analytics data
  const loadAnalytics = useCallback(async () => {
    try {
      setLoading(true);

      // Mock data for now - replace with actual API calls
      const mockData: AnalyticsData = {
        userRegistrations: {
          dates: Array.from({ length: 30 }, (_, i) => {
            const date = new Date();
            date.setDate(date.getDate() - (29 - i));
            return date.toLocaleDateString('vi-VN', { month: 'short', day: 'numeric' });
          }),
          counts: Array.from({ length: 30 }, () => Math.floor(Math.random() * 20) + 1)
        },
        departmentDistribution: {
          labels: ['Engineering', 'Sales', 'Marketing', 'HR', 'Finance', 'Operations', 'Other'],
          data: [45, 32, 28, 15, 12, 20, 8]
        },
        approvalRates: {
          approved: 156,
          pending: 23,
          rejected: 8
        },
        activityMetrics: {
          totalUsers: 187,
          activeUsers: 143,
          blockedUsers: 12,
          newUsersThisMonth: 34,
          lastLoginStats: {
            today: 45,
            thisWeek: 89,
            thisMonth: 134,
            older: 53
          }
        },
        growthTrend: {
          months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
          userCounts: [120, 135, 148, 162, 171, 187],
          approvalCounts: [18, 22, 19, 25, 21, 34]
        }
      };

      setData(mockData);
    } catch (error) {
      console.error('Error loading analytics:', error);
      toast.error('Lỗi khi tải dữ liệu phân tích');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  // Auto-refresh data every 5 minutes
  useEffect(() => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }

    const interval = setInterval(() => {
      loadAnalytics();
    }, 5 * 60 * 1000); // 5 minutes

    setRefreshInterval(interval);

    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [loadAnalytics]);

  // Chart configurations
  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
        borderColor: 'rgba(255, 255, 255, 0.2)',
        borderWidth: 1,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          color: '#6B7280',
        },
        grid: {
          color: 'rgba(107, 114, 128, 0.1)',
        },
      },
      x: {
        ticks: {
          color: '#6B7280',
        },
        grid: {
          color: 'rgba(107, 114, 128, 0.1)',
        },
      },
    },
  }), []);

  const pieOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
        borderColor: 'rgba(255, 255, 255, 0.2)',
        borderWidth: 1,
      },
    },
  }), []);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <LoadingSpinner size="lg" />
        <span className="ml-3 text-gray-600">Đang tải dữ liệu phân tích...</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500 text-lg mb-2">Không thể tải dữ liệu phân tích</div>
        <Button onClick={loadAnalytics} variant="outline">
          🔄 Thử lại
        </Button>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="bg-white shadow-sm rounded-lg p-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h2>
            <p className="text-gray-600">Phân tích và thống kê người dùng</p>
          </div>
          <div className="flex space-x-2">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as '7d' | '30d' | '90d' | '1y')}
              className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="7d">7 ngày</option>
              <option value="30d">30 ngày</option>
              <option value="90d">90 ngày</option>
              <option value="1y">1 năm</option>
            </select>
            <Button size="sm" variant="outline" onClick={loadAnalytics}>
              🔄 Làm mới
            </Button>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <span className="text-blue-600">👥</span>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Tổng người dùng</p>
              <p className="text-2xl font-bold text-gray-900">{data.activityMetrics.totalUsers.toLocaleString()}</p>
            </div>
          </div>
          <div className="mt-4">
            <span className="text-sm text-green-600">+{data.activityMetrics.newUsersThisMonth} tháng này</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                <span className="text-green-600">✅</span>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Người dùng hoạt động</p>
              <p className="text-2xl font-bold text-gray-900">{data.activityMetrics.activeUsers.toLocaleString()}</p>
            </div>
          </div>
          <div className="mt-4">
            <span className="text-sm text-gray-600">
              {Math.round((data.activityMetrics.activeUsers / data.activityMetrics.totalUsers) * 100)}% tổng số
            </span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
                <span className="text-yellow-600">⏳</span>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Chờ phê duyệt</p>
              <p className="text-2xl font-bold text-gray-900">{data.approvalRates.pending.toLocaleString()}</p>
            </div>
          </div>
          <div className="mt-4">
            <span className="text-sm text-yellow-600">
              Cần xem xét
            </span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                <span className="text-red-600">🚫</span>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Bị chặn</p>
              <p className="text-2xl font-bold text-gray-900">{data.activityMetrics.blockedUsers.toLocaleString()}</p>
            </div>
          </div>
          <div className="mt-4">
            <span className="text-sm text-red-600">
              {Math.round((data.activityMetrics.blockedUsers / data.activityMetrics.totalUsers) * 100)}% tổng số
            </span>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Registrations Chart */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Đăng ký người dùng mới</h3>
          <div className="h-80">
            <Line
              data={{
                labels: data.userRegistrations.dates,
                datasets: [
                  {
                    label: 'Người dùng mới',
                    data: data.userRegistrations.counts,
                    borderColor: 'rgb(59, 130, 246)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: true,
                    tension: 0.4,
                  },
                ],
              }}
              options={chartOptions}
            />
          </div>
        </div>

        {/* Department Distribution */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Phân bố theo phòng ban</h3>
          <div className="h-80">
            <Doughnut
              data={{
                labels: data.departmentDistribution.labels,
                datasets: [
                  {
                    data: data.departmentDistribution.data,
                    backgroundColor: [
                      'rgba(59, 130, 246, 0.8)',
                      'rgba(16, 185, 129, 0.8)',
                      'rgba(245, 158, 11, 0.8)',
                      'rgba(239, 68, 68, 0.8)',
                      'rgba(139, 92, 246, 0.8)',
                      'rgba(236, 72, 153, 0.8)',
                      'rgba(107, 114, 128, 0.8)',
                    ],
                    borderColor: [
                      'rgb(59, 130, 246)',
                      'rgb(16, 185, 129)',
                      'rgb(245, 158, 11)',
                      'rgb(239, 68, 68)',
                      'rgb(139, 92, 246)',
                      'rgb(236, 72, 153)',
                      'rgb(107, 114, 128)',
                    ],
                    borderWidth: 2,
                  },
                ],
              }}
              options={pieOptions}
            />
          </div>
        </div>

        {/* Growth Trend */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Xu hướng tăng trưởng</h3>
          <div className="h-80">
            <Bar
              data={{
                labels: data.growthTrend.months,
                datasets: [
                  {
                    label: 'Tổng người dùng',
                    data: data.growthTrend.userCounts,
                    backgroundColor: 'rgba(59, 130, 246, 0.8)',
                    borderColor: 'rgb(59, 130, 246)',
                    borderWidth: 1,
                  },
                  {
                    label: 'Người dùng mới',
                    data: data.growthTrend.approvalCounts,
                    backgroundColor: 'rgba(16, 185, 129, 0.8)',
                    borderColor: 'rgb(16, 185, 129)',
                    borderWidth: 1,
                  },
                ],
              }}
              options={chartOptions}
            />
          </div>
        </div>

        {/* Last Login Stats */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Thống kê đăng nhập cuối</h3>
          <div className="h-80">
            <Pie
              data={{
                labels: ['Hôm nay', 'Tuần này', 'Tháng này', 'Lâu hơn'],
                datasets: [
                  {
                    data: [
                      data.activityMetrics.lastLoginStats.today,
                      data.activityMetrics.lastLoginStats.thisWeek,
                      data.activityMetrics.lastLoginStats.thisMonth,
                      data.activityMetrics.lastLoginStats.older,
                    ],
                    backgroundColor: [
                      'rgba(34, 197, 94, 0.8)',
                      'rgba(59, 130, 246, 0.8)',
                      'rgba(245, 158, 11, 0.8)',
                      'rgba(239, 68, 68, 0.8)',
                    ],
                    borderColor: [
                      'rgb(34, 197, 94)',
                      'rgb(59, 130, 246)',
                      'rgb(245, 158, 11)',
                      'rgb(239, 68, 68)',
                    ],
                    borderWidth: 2,
                  },
                ],
              }}
              options={pieOptions}
            />
          </div>
        </div>
      </div>

      {/* Approval Rates Summary */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Tỷ lệ phê duyệt</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600 mb-2">
              {data.approvalRates.approved}
            </div>
            <div className="text-sm text-gray-600">Đã phê duyệt</div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div 
                className="bg-green-600 h-2 rounded-full"
                style={{
                  width: `${(data.approvalRates.approved / (data.approvalRates.approved + data.approvalRates.pending + data.approvalRates.rejected)) * 100}%`
                }}
              ></div>
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-3xl font-bold text-yellow-600 mb-2">
              {data.approvalRates.pending}
            </div>
            <div className="text-sm text-gray-600">Chờ phê duyệt</div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div 
                className="bg-yellow-600 h-2 rounded-full"
                style={{
                  width: `${(data.approvalRates.pending / (data.approvalRates.approved + data.approvalRates.pending + data.approvalRates.rejected)) * 100}%`
                }}
              ></div>
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-3xl font-bold text-red-600 mb-2">
              {data.approvalRates.rejected}
            </div>
            <div className="text-sm text-gray-600">Bị từ chối</div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div 
                className="bg-red-600 h-2 rounded-full"
                style={{
                  width: `${(data.approvalRates.rejected / (data.approvalRates.approved + data.approvalRates.pending + data.approvalRates.rejected)) * 100}%`
                }}
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;