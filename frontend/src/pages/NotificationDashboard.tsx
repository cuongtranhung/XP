import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../contexts/NotificationContext';
import AppLayout from '../components/layout/AppLayout';
import { Button } from '../components/common/Button';
import { 
  Bell, 
  Settings, 
  BarChart3, 
  Clock, 
  CheckCircle, 
  XCircle,
  AlertTriangle,
  Mail,
  MessageSquare,
  TrendingUp,
  TrendingDown,
  Calendar,
  Filter,
  Download,
  RefreshCw
} from '../components/icons';
import toast from 'react-hot-toast';

const NotificationDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { 
    notifications, 
    unreadCount, 
    loading,
    isConnected,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearNotifications,
    sendTestNotification
  } = useNotifications();

  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [selectedTimeRange, setSelectedTimeRange] = useState<string>('7d');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Calculate statistics
  const stats = {
    total: notifications.length,
    unread: unreadCount,
    read: notifications.filter(n => n.read).length,
    critical: notifications.filter(n => n.priority === 'critical').length,
    high: notifications.filter(n => n.priority === 'high').length,
    medium: notifications.filter(n => n.priority === 'medium').length,
    low: notifications.filter(n => n.priority === 'low').length,
  };

  // Calculate type distribution
  const typeDistribution = {
    email: notifications.filter(n => n.type === 'email').length,
    sms: notifications.filter(n => n.type === 'sms').length,
    push: notifications.filter(n => n.type === 'push').length,
    'in-app': notifications.filter(n => n.type === 'in-app').length,
    system: notifications.filter(n => n.type === 'system').length,
    marketing: notifications.filter(n => n.type === 'marketing').length,
    transactional: notifications.filter(n => n.type === 'transactional').length,
  };

  // Filter notifications
  const filteredNotifications = notifications.filter(n => {
    if (selectedType !== 'all' && n.type !== selectedType) return false;
    if (selectedPriority !== 'all' && n.priority !== selectedPriority) return false;
    
    // Time range filter
    if (selectedTimeRange !== 'all') {
      const now = new Date();
      const notifDate = new Date(n.timestamp);
      const daysDiff = (now.getTime() - notifDate.getTime()) / (1000 * 60 * 60 * 24);
      
      if (selectedTimeRange === '1d' && daysDiff > 1) return false;
      if (selectedTimeRange === '7d' && daysDiff > 7) return false;
      if (selectedTimeRange === '30d' && daysDiff > 30) return false;
    }
    
    return true;
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchNotifications();
      toast.success('Notifications refreshed');
    } catch (error) {
      toast.error('Failed to refresh notifications');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleExport = () => {
    const data = JSON.stringify(filteredNotifications, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `notifications-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Notifications exported');
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'email': return '📧';
      case 'sms': return '💬';
      case 'push': return '🔔';
      case 'in-app': return '📱';
      case 'system': return '⚙️';
      case 'marketing': return '📢';
      case 'transactional': return '📋';
      default: return '🔔';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'text-red-600 bg-red-50';
      case 'high': return 'text-orange-600 bg-orange-50';
      case 'medium': return 'text-blue-600 bg-blue-50';
      case 'low': return 'text-gray-600 bg-gray-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const formatRelativeTime = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now.getTime() - time.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    return time.toLocaleDateString();
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <Bell className="h-8 w-8 mr-3 text-blue-600" />
                Notification Dashboard
              </h1>
              <p className="mt-2 text-gray-600">
                Monitor and manage all your notifications in one place
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Settings />}
                onClick={() => navigate('/notification-settings')}
              >
                Settings
              </Button>
              <Button
                variant="outline"
                size="sm"
                leftIcon={<RefreshCw />}
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                {isRefreshing ? 'Refreshing...' : 'Refresh'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Download />}
                onClick={handleExport}
              >
                Export
              </Button>
            </div>
          </div>
        </div>

        {/* Connection Status */}
        <div className={`mb-6 p-4 rounded-lg border ${
          isConnected 
            ? 'bg-green-50 border-green-200' 
            : 'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className={`h-3 w-3 rounded-full mr-3 ${
                isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400 animate-ping'
              }`}></div>
              <span className={`font-medium ${
                isConnected ? 'text-green-800' : 'text-red-800'
              }`}>
                {isConnected ? 'Connected to notification service' : 'Disconnected from notification service'}
              </span>
            </div>
            <span className="text-sm text-gray-600">
              Last updated: {new Date().toLocaleTimeString()}
            </span>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Notifications */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Notifications</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <Bell className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className="text-gray-600">All time</span>
            </div>
          </div>

          {/* Unread */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Unread</p>
                <p className="mt-2 text-3xl font-bold text-orange-600">{stats.unread}</p>
              </div>
              <div className="p-3 bg-orange-100 rounded-lg">
                <AlertTriangle className="h-6 w-6 text-orange-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className="text-orange-600 font-medium">
                {stats.total > 0 ? `${((stats.unread / stats.total) * 100).toFixed(1)}%` : '0%'} unread
              </span>
            </div>
          </div>

          {/* Critical Priority */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Critical Priority</p>
                <p className="mt-2 text-3xl font-bold text-red-600">{stats.critical}</p>
              </div>
              <div className="p-3 bg-red-100 rounded-lg">
                <XCircle className="h-6 w-6 text-red-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className="text-red-600 font-medium">Requires immediate attention</span>
            </div>
          </div>

          {/* Read Rate */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Read Rate</p>
                <p className="mt-2 text-3xl font-bold text-green-600">
                  {stats.total > 0 ? `${((stats.read / stats.total) * 100).toFixed(0)}%` : '0%'}
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className="text-gray-600">{stats.read} of {stats.total} read</span>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Priority Distribution */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <BarChart3 className="h-5 w-5 mr-2 text-gray-600" />
              Priority Distribution
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Critical</span>
                <div className="flex items-center">
                  <div className="w-32 bg-gray-200 rounded-full h-2 mr-3">
                    <div 
                      className="bg-red-600 h-2 rounded-full"
                      style={{ width: `${stats.total > 0 ? (stats.critical / stats.total) * 100 : 0}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium">{stats.critical}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">High</span>
                <div className="flex items-center">
                  <div className="w-32 bg-gray-200 rounded-full h-2 mr-3">
                    <div 
                      className="bg-orange-600 h-2 rounded-full"
                      style={{ width: `${stats.total > 0 ? (stats.high / stats.total) * 100 : 0}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium">{stats.high}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Medium</span>
                <div className="flex items-center">
                  <div className="w-32 bg-gray-200 rounded-full h-2 mr-3">
                    <div 
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${stats.total > 0 ? (stats.medium / stats.total) * 100 : 0}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium">{stats.medium}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Low</span>
                <div className="flex items-center">
                  <div className="w-32 bg-gray-200 rounded-full h-2 mr-3">
                    <div 
                      className="bg-gray-600 h-2 rounded-full"
                      style={{ width: `${stats.total > 0 ? (stats.low / stats.total) * 100 : 0}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium">{stats.low}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Type Distribution */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <MessageSquare className="h-5 w-5 mr-2 text-gray-600" />
              Type Distribution
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(typeDistribution).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <span className="text-lg mr-2">{getNotificationIcon(type)}</span>
                    <span className="text-sm font-medium capitalize">{type}</span>
                  </div>
                  <span className="text-sm font-bold text-gray-900">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Filter className="h-5 w-5 text-gray-400" />
              
              {/* Type Filter */}
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
              >
                <option value="all">All Types</option>
                <option value="email">Email</option>
                <option value="sms">SMS</option>
                <option value="push">Push</option>
                <option value="in-app">In-App</option>
                <option value="system">System</option>
                <option value="marketing">Marketing</option>
                <option value="transactional">Transactional</option>
              </select>

              {/* Priority Filter */}
              <select
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value)}
                className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
              >
                <option value="all">All Priorities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>

              {/* Time Range Filter */}
              <select
                value={selectedTimeRange}
                onChange={(e) => setSelectedTimeRange(e.target.value)}
                className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
              >
                <option value="1d">Last 24 hours</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="all">All time</option>
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">
                {filteredNotifications.length} notifications
              </span>
              {filteredNotifications.length > 0 && (
                <>
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={markAllAsRead}
                    disabled={loading}
                  >
                    Mark all as read
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={clearNotifications}
                    disabled={loading}
                    className="text-red-600 hover:text-red-700"
                  >
                    Clear all
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Notifications List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Recent Notifications</h3>
          </div>
          
          <div className="divide-y divide-gray-200">
            {loading && filteredNotifications.length === 0 ? (
              <div className="p-6 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <div className="text-sm text-gray-500">Loading notifications...</div>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="p-12 text-center">
                <Bell className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-sm font-medium text-gray-900 mb-2">No notifications found</h3>
                <p className="text-sm text-gray-500">
                  Try adjusting your filters or check back later for new notifications.
                </p>
                <Button
                  size="sm"
                  className="mt-4"
                  onClick={() => sendTestNotification('in-app')}
                >
                  Send Test Notification
                </Button>
              </div>
            ) : (
              filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-6 hover:bg-gray-50 transition-colors ${
                    !notification.read ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-start space-x-4">
                    <div className="text-2xl flex-shrink-0">
                      {getNotificationIcon(notification.type)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="text-sm font-medium text-gray-900 mb-1">
                            {notification.title}
                          </h4>
                          <p className="text-sm text-gray-600 mb-2">
                            {notification.message}
                          </p>
                          <div className="flex items-center space-x-4 text-xs">
                            <span className="text-gray-500">
                              {formatRelativeTime(notification.timestamp)}
                            </span>
                            <span className={`px-2 py-1 rounded-full ${getPriorityColor(notification.priority || 'medium')}`}>
                              {notification.priority || 'medium'}
                            </span>
                            <span className="text-gray-500 capitalize">
                              {notification.type}
                            </span>
                            {!notification.read && (
                              <span className="text-blue-600 font-medium">Unread</span>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2 ml-4">
                          {!notification.read && (
                            <button
                              onClick={() => markAsRead(notification.id)}
                              className="p-1 text-blue-600 hover:text-blue-800 rounded hover:bg-blue-100"
                              title="Mark as read"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </button>
                          )}
                          
                          <button
                            onClick={() => deleteNotification(notification.id)}
                            className="p-1 text-gray-400 hover:text-red-600 rounded hover:bg-red-50"
                            title="Delete"
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => sendTestNotification('email')}
              className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Mail className="h-6 w-6 text-gray-600 mx-auto mb-2" />
              <p className="text-sm font-medium">Test Email Notification</p>
            </button>
            
            <button
              onClick={() => sendTestNotification('push')}
              className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Bell className="h-6 w-6 text-gray-600 mx-auto mb-2" />
              <p className="text-sm font-medium">Test Push Notification</p>
            </button>
            
            <button
              onClick={() => navigate('/notification-settings')}
              className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Settings className="h-6 w-6 text-gray-600 mx-auto mb-2" />
              <p className="text-sm font-medium">Configure Settings</p>
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default NotificationDashboard;