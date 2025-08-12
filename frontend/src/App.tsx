import React, { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import { I18nProvider } from './contexts/I18nContext';
import { NotificationProvider } from './contexts/NotificationContext'; // Real implementation
import { PermissionProvider } from './contexts/PermissionContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import ErrorBoundary from './components/common/ErrorBoundary';
import EnhancedErrorBoundary from './components/monitoring/ErrorBoundary';
import { monitoringService } from './services/monitoringService';

// Eager load authentication pages (frequently accessed)
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';

// Eager load problematic pages to avoid dynamic import issues
import FormSubmissions from './pages/FormSubmissions';

// Lazy load less frequently accessed pages
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const EmailVerificationPage = lazy(() => import('./pages/EmailVerificationPage'));
const ResendVerificationPage = lazy(() => import('./pages/ResendVerificationPage'));

// Lazy load main app pages
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const LocationSettingsPage = lazy(() => import('./pages/LocationSettingsPage'));
const NotificationSettingsPage = lazy(() => import('./pages/NotificationSettingsPage'));
const NotificationDashboard = lazy(() => import('./pages/NotificationDashboard'));
const UserManagementPage = lazy(() => import('./pages/UserManagementPage'));
const AvatarTest = lazy(() => import('./pages/AvatarTest'));
const RoleManagementPage = lazy(() => import('./pages/RoleManagementPage'));
const GroupManagementPage = lazy(() => import('./pages/GroupManagementPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const PermissionTestPage = lazy(() => import('./pages/PermissionTestPage'));
const SimplePermissionTest = lazy(() => import('./pages/SimplePermissionTest'));
const PermissionTest = lazy(() => import('./pages/PermissionTest'));
const MonitoringDashboard = lazy(() => import('./pages/MonitoringDashboard'));
const PermissionsDemo = lazy(() => import('./pages/PermissionsDemo'));
const PermissionGuardDemo = lazy(() => import('./pages/PermissionGuardDemo'));

// Lazy load Dynamic Form Builder Pages (heavy components)
const FormsList = lazy(() => import('./pages/FormsList'));
const FormBuilder = lazy(() => import('./pages/FormBuilderEnhanced')); // Using enhanced version with UX improvements
// const FormBuilder = lazy(() => import('./pages/FormBuilderDebug')); // DEBUG VERSION
const FormBuilderOld = lazy(() => import('./pages/FormBuilder')); // Original version
const FormBuilderShowcase = lazy(() => import('./pages/FormBuilderShowcaseSimple'));
const FormSubmit = lazy(() => import('./pages/FormSubmit'));
// const FormSubmissions = lazy(() => import('./pages/FormSubmissions')); // Moved to eager loading
const FormAnalytics = lazy(() => import('./pages/FormAnalytics'));
const DataTableView = lazy(() => import('./pages/DataTableView'));

// MEGA S4 Upload Demo
const MegaUploadDemo = lazy(() => import('./pages/MegaUploadDemo'));

// Comment Attachment Test
const CommentAttachmentTest = lazy(() => import('./components/CommentAttachmentTest'));
const DebugUploadTest = lazy(() => import('./components/DebugUploadTest'));
const AttachmentGalleryDemo = lazy(() => import('./components/AttachmentGalleryDemo'));

// Form Builder MEGA S4 Test
const FormBuilderMegaS4Test = lazy(() => import('./components/FormBuilderMegaS4Test'));

// Upload Demo Page
const UploadDemo = lazy(() => import('./pages/UploadDemo'));
const PublicUploadDemo = lazy(() => import('./pages/PublicUploadDemo'));

// Lazy load Upload Demo Pages
const ParallelUploadDemo = lazy(() => import('./components/upload/ParallelUploadDemo'));
const FileUploadDemo = lazy(() => import('./components/upload/FileUploadDemo'));
const DemoNavigation = lazy(() => import('./pages/DemoNavigation'));
const R2UploadTest = lazy(() => import('./components/upload/R2UploadTest'));


// Styles
import './index.css';

// Loading component
import PageLoader from './components/common/PageLoader';

const App: React.FC = () => {
  // Initialize monitoring service
  useEffect(() => {
    const initMonitoring = async () => {
      try {
        await monitoringService.initialize();
        console.log('🎯 Monitoring service initialized successfully');
      } catch (error) {
        console.error('❌ Failed to initialize monitoring service:', error);
      }
    };

    initMonitoring();
  }, []);

  return (
    <EnhancedErrorBoundary level="page">
      <Router>
        <I18nProvider>
          <AuthProvider>
            <PermissionProvider>
              <NotificationProvider>
                <div className="App">
              <Suspense fallback={<PageLoader />}>
              <Routes>
              {/* Public routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
              <Route path="/verify-email/:token" element={<EmailVerificationPage />} />
              <Route path="/resend-verification" element={<ResendVerificationPage />} />
              
              {/* Public form submission */}
              <Route path="/f/:slug" element={<FormSubmit />} />

              {/* MEGA S4 Upload Demo - Public for testing */}
              <Route path="/mega-upload-demo" element={<MegaUploadDemo />} />
              <Route path="/comment-attachment-test" element={<CommentAttachmentTest />} />
              <Route path="/debug-upload-test" element={<DebugUploadTest />} />
              <Route path="/attachment-gallery-demo" element={<AttachmentGalleryDemo />} />
              <Route path="/form-builder-mega-s4-test" element={<FormBuilderMegaS4Test />} />
              
              {/* Public Upload Demo - No authentication required */}
              <Route path="/public-upload-demo" element={<PublicUploadDemo />} />
              
              {/* Upload Demo - Protected route */}
              <Route path="/upload-demo" element={<ProtectedRoute><UploadDemo /></ProtectedRoute>} />

              {/* Protected routes */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <DashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <SettingsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/location-settings"
                element={
                  <ProtectedRoute>
                    <LocationSettingsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/notification-settings"
                element={
                  <ProtectedRoute>
                    <NotificationSettingsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/notification-dashboard"
                element={
                  <ProtectedRoute>
                    <NotificationDashboard />
                  </ProtectedRoute>
                }
              />

              {/* Dynamic Form Builder Routes */}
              <Route
                path="/showcase"
                element={
                  <ProtectedRoute>
                    <FormBuilderShowcase />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/forms"
                element={
                  <ProtectedRoute>
                    <FormsList />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/forms/:id/edit"
                element={
                  <ProtectedRoute>
                    <FormBuilder />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/forms/new"
                element={
                  <ProtectedRoute>
                    <FormBuilder />
                  </ProtectedRoute>
                }
              />
              {/* Original Form Builder Routes */}
              <Route
                path="/forms/:id/edit-old"
                element={
                  <ProtectedRoute>
                    <FormBuilderOld />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/forms/new-old"
                element={
                  <ProtectedRoute>
                    <FormBuilderOld />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/forms/:id/submissions"
                element={
                  <ProtectedRoute>
                    <FormSubmissions />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/forms/:id/analytics"
                element={
                  <ProtectedRoute>
                    <FormAnalytics />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/forms/:id/submissions/table-view"
                element={
                  <ProtectedRoute>
                    <DataTableView />
                  </ProtectedRoute>
                }
              />
              
              {/* User Management Route */}
              <Route
                path="/user-management"
                element={
                  <ProtectedRoute>
                    <UserManagementPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/avatar-test"
                element={
                  <ProtectedRoute>
                    <AvatarTest />
                  </ProtectedRoute>
                }
              />

              {/* Role Management Route */}
              <Route
                path="/role-management"
                element={
                  <ProtectedRoute>
                    <RoleManagementPage />
                  </ProtectedRoute>
                }
              />

              {/* Group Management Route */}
              <Route
                path="/group-management"
                element={
                  <ProtectedRoute>
                    <GroupManagementPage />
                  </ProtectedRoute>
                }
              />

              {/* Profile Management Route */}
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <ProfilePage />
                  </ProtectedRoute>
                }
              />

              {/* Permission Test Routes */}
              <Route
                path="/permission-test"
                element={
                  <ProtectedRoute>
                    <PermissionTestPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/simple-permission-test"
                element={
                  <ProtectedRoute>
                    <SimplePermissionTest />
                  </ProtectedRoute>
                }
              />
              
              {/* New Permission Test Route */}
              <Route
                path="/permission-system-test"
                element={
                  <ProtectedRoute>
                    <PermissionTest />
                  </ProtectedRoute>
                }
              />

              {/* Monitoring Dashboard Route */}
              <Route
                path="/monitoring"
                element={
                  <ProtectedRoute>
                    <MonitoringDashboard />
                  </ProtectedRoute>
                }
              />

              {/* Permission Guard Demo Route */}
              <Route
                path="/permission-guard-demo"
                element={
                  <ProtectedRoute>
                    <PermissionGuardDemo />
                  </ProtectedRoute>
                }
              />

              {/* Demo Navigation & Upload Demo Routes - For Testing */}
              <Route
                path="/demos"
                element={
                  <ProtectedRoute>
                    <DemoNavigation />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/upload-demo"
                element={
                  <ProtectedRoute>
                    <ParallelUploadDemo />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/upload-ui-demo"
                element={
                  <ProtectedRoute>
                    <FileUploadDemo />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/r2-upload-test"
                element={
                  <ProtectedRoute>
                    <R2UploadTest />
                  </ProtectedRoute>
                }
              />

              {/* Redirect root to login for unauthenticated users */}
              <Route path="/" element={<Navigate to="/login" replace />} />

              {/* Catch all - redirect to login */}
              <Route path="*" element={<Navigate to="/login" replace />} />
              </Routes>
            </Suspense>

          {/* Toast notifications */}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#fff',
                color: '#374151',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                border: '1px solid #e5e7eb',
              },
              success: {
                iconTheme: {
                  primary: '#10b981',
                  secondary: '#fff',
                },
              },
              error: {
                iconTheme: {
                  primary: '#ef4444',
                  secondary: '#fff',
                },
              },
            }}
          />
              </div>
              </NotificationProvider>
            </PermissionProvider>
          </AuthProvider>
        </I18nProvider>
      </Router>
    </EnhancedErrorBoundary>
  );
};

export default App;