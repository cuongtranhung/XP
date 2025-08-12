import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, User, LogOut, Settings, Menu, X, FileText, Sparkles } from '../icons';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../contexts/I18nContext';
import Button from '../common/Button';
import LanguageSelector from '../common/LanguageSelector';
import { NotificationCenter } from '../notifications/NotificationCenter';

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            {/* Logo and brand */}
            <div className="flex items-center">
              <Link to="/dashboard" className="flex items-center space-x-2">
                <div className="p-1.5 bg-primary-600 rounded-lg">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <span className="text-xl font-bold text-gray-900">
                  {import.meta.env.VITE_APP_NAME || 'SecureAuth'}
                </span>
              </Link>
            </div>

            {/* Desktop navigation */}
            <div className="hidden md:flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2 text-sm text-gray-700">
                  {/* User Avatar */}
                  {user?.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt={user.full_name}
                      className="w-8 h-8 rounded-full object-cover border border-gray-200"
                    />
                  ) : (
                    <User className="w-4 h-4" />
                  )}
                  <span className="font-medium">{user?.full_name}</span>
                  {user?.email_verified ? (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      Unverified
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<FileText />}
                  onClick={() => navigate('/forms')}
                >
                  {t('common.navigation.forms')}
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<User />}
                  onClick={() => navigate('/profile')}
                >
                  Profile
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<Settings />}
                  onClick={() => navigate('/settings')}
                >
                  {t('common.navigation.settings')}
                </Button>
                
                {/* Language Selector */}
                <LanguageSelector 
                  variant="compact" 
                  showFlag={true} 
                  showNativeName={false}
                  className="mr-2"
                />
                
                {/* Notification Center */}
                <NotificationCenter className="mr-2" />
                
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<LogOut />}
                  onClick={handleLogout}
                >
                  {t('common.navigation.logout')}
                </Button>
              </div>
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden flex items-center space-x-2">
              {/* Mobile Notification Center */}
              <NotificationCenter />
              
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {isMobileMenuOpen ? (
                  <X className="w-6 h-6" />
                ) : (
                  <Menu className="w-6 h-6" />
                )}
              </button>
            </div>
          </div>

          {/* Mobile menu */}
          {isMobileMenuOpen && (
            <div className="md:hidden border-t border-gray-200 bg-white">
              <div className="px-2 pt-2 pb-3 space-y-1">
                <div className="px-3 py-2 border-b border-gray-200">
                  <div className="flex items-center space-x-2 text-sm">
                    {/* User Avatar */}
                    {user?.avatar_url ? (
                      <img
                        src={user.avatar_url}
                        alt={user.full_name}
                        className="w-8 h-8 rounded-full object-cover border border-gray-200"
                      />
                    ) : (
                      <User className="w-4 h-4" />
                    )}
                    <span className="font-medium text-gray-900">{user?.full_name}</span>
                  </div>
                  <div className="text-xs text-gray-600 mt-1">{user?.email}</div>
                  <div className="mt-2">
                    {user?.email_verified ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Email Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        Email Not Verified
                      </span>
                    )}
                  </div>
                </div>
                
                <button
                  onClick={() => {
                    navigate('/forms');
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md flex items-center space-x-2"
                >
                  <FileText className="w-4 h-4" />
                  <span>Forms</span>
                </button>
                
                <button
                  onClick={() => {
                    navigate('/profile');
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md flex items-center space-x-2"
                >
                  <User className="w-4 h-4" />
                  <span>Profile</span>
                </button>
                
                <button
                  onClick={() => {
                    navigate('/settings');
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md flex items-center space-x-2"
                >
                  <Settings className="w-4 h-4" />
                  <span>Settings</span>
                </button>
                
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-3 py-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md flex items-center space-x-2"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Main content */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
};

export default AppLayout;