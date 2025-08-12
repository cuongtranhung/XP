import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { SecuritySettings as SecuritySettingsType, PasswordChangeData, ActiveSession } from '../../types/profile';
import { profileService } from '../../services/profileService';
import Button from '../common/Button';
import Input from '../common/Input';
import Modal from '../common/Modal';
import { Shield, Lock, Smartphone, Monitor, AlertTriangle, Eye, EyeOff } from 'lucide-react';

interface SecuritySettingsProps {
  security: SecuritySettingsType;
  onSecurityUpdate: (security: SecuritySettingsType) => void;
  className?: string;
}

const SecuritySettings: React.FC<SecuritySettingsProps> = ({
  security,
  onSecurityUpdate,
  className = ''
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [showTwoFactorSetup, setShowTwoFactorSetup] = useState(false);
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [twoFactorData, setTwoFactorData] = useState<any>(null);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [showPassword, setShowPassword] = useState({
    current: false,
    new: false,
    confirm: false
  });

  const passwordForm = useForm<PasswordChangeData>();
  const twoFactorForm = useForm<{ verification_code: string }>();

  useEffect(() => {
    loadActiveSessions();
  }, []);

  const loadActiveSessions = async () => {
    try {
      const response = await profileService.getActiveSessions();
      if (response.success) {
        setActiveSessions(response.data);
      }
    } catch (error) {
      console.error('Failed to load active sessions:', error);
    }
  };

  const handlePasswordChange = async (data: PasswordChangeData) => {
    try {
      setIsLoading(true);
      const response = await profileService.changePassword(data);
      
      if (response.success) {
        toast.success('Password changed successfully!');
        setShowPasswordForm(false);
        passwordForm.reset();
      }
    } catch (error: any) {
      console.error('Password change failed:', error);
      toast.error(error.response?.data?.message || 'Failed to change password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetupTwoFactor = async () => {
    try {
      setIsLoading(true);
      const response = await profileService.setupTwoFactor();
      
      if (response.success) {
        setTwoFactorData(response.data);
        setShowTwoFactorSetup(true);
      }
    } catch (error: any) {
      console.error('2FA setup failed:', error);
      toast.error(error.response?.data?.message || 'Failed to setup 2FA');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyTwoFactor = async (data: { verification_code: string }) => {
    try {
      setIsLoading(true);
      const response = await profileService.verifyTwoFactor(data.verification_code);
      
      if (response.success) {
        setBackupCodes(response.data.backup_codes);
        setShowBackupCodes(true);
        setShowTwoFactorSetup(false);
        
        // Update security settings
        const updatedSecurity = {
          ...security,
          two_factor_enabled: true,
          backup_codes_count: response.data.backup_codes.length
        };
        onSecurityUpdate(updatedSecurity);
        
        toast.success('Two-factor authentication enabled!');
      }
    } catch (error: any) {
      console.error('2FA verification failed:', error);
      toast.error(error.response?.data?.message || 'Invalid verification code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisableTwoFactor = async () => {
    const password = prompt('Enter your password to disable 2FA:');
    if (!password) return;

    try {
      setIsLoading(true);
      const response = await profileService.disableTwoFactor(password);
      
      if (response.success) {
        const updatedSecurity = {
          ...security,
          two_factor_enabled: false,
          backup_codes_count: 0
        };
        onSecurityUpdate(updatedSecurity);
        
        toast.success('Two-factor authentication disabled');
      }
    } catch (error: any) {
      console.error('2FA disable failed:', error);
      toast.error(error.response?.data?.message || 'Failed to disable 2FA');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      const response = await profileService.revokeSession(sessionId);
      if (response.success) {
        setActiveSessions(prev => prev.filter(s => s.id !== sessionId));
        toast.success('Session revoked successfully');
      }
    } catch (error: any) {
      toast.error('Failed to revoke session');
    }
  };

  const handleRevokeAllSessions = async () => {
    if (!confirm('Are you sure you want to revoke all sessions? You will need to login again.')) {
      return;
    }

    try {
      const response = await profileService.revokeAllSessions();
      if (response.success) {
        toast.success('All sessions revoked successfully');
        // The user will likely be logged out after this
      }
    } catch (error: any) {
      toast.error('Failed to revoke all sessions');
    }
  };

  return (
    <div className={`bg-white rounded-lg shadow-sm border ${className}`}>
      <div className="p-6">
        <div className="flex items-center space-x-3 mb-6">
          <Shield className="text-blue-600" size={24} />
          <h2 className="text-xl font-semibold text-gray-900">Security Settings</h2>
        </div>

        <div className="space-y-8">
          {/* Password Section */}
          <div className="border-b border-gray-200 pb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Password</h3>
                <p className="text-sm text-gray-600">Change your account password</p>
              </div>
              <Button
                variant="outline"
                onClick={() => setShowPasswordForm(true)}
              >
                <Lock size={16} className="mr-2" />
                Change Password
              </Button>
            </div>
          </div>

          {/* Two-Factor Authentication */}
          <div className="border-b border-gray-200 pb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Two-Factor Authentication</h3>
                <p className="text-sm text-gray-600">
                  Add an extra layer of security to your account
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  security.two_factor_enabled
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {security.two_factor_enabled ? 'Enabled' : 'Disabled'}
                </span>
                {security.two_factor_enabled ? (
                  <Button
                    variant="outline"
                    onClick={handleDisableTwoFactor}
                    className="text-red-600 border-red-300 hover:bg-red-50"
                  >
                    Disable
                  </Button>
                ) : (
                  <Button
                    onClick={handleSetupTwoFactor}
                    isLoading={isLoading}
                  >
                    <Smartphone size={16} className="mr-2" />
                    Enable 2FA
                  </Button>
                )}
              </div>
            </div>

            {security.two_factor_enabled && (
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Shield size={16} className="text-green-600" />
                  <span className="text-sm text-green-800">
                    Two-factor authentication is active
                  </span>
                </div>
                <div className="mt-2 text-sm text-green-700">
                  Backup codes available: {security.backup_codes_count}
                </div>
              </div>
            )}
          </div>

          {/* Active Sessions */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Active Sessions</h3>
                <p className="text-sm text-gray-600">Manage your active sessions</p>
              </div>
              <Button
                variant="outline"
                onClick={handleRevokeAllSessions}
                className="text-red-600 border-red-300 hover:bg-red-50"
              >
                Revoke All Sessions
              </Button>
            </div>

            <div className="space-y-3">
              {activeSessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <Monitor size={20} className="text-gray-500" />
                    <div>
                      <div className="font-medium text-gray-900">
                        {session.browser} on {session.os}
                        {session.is_current && (
                          <span className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                            Current
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600">
                        {session.location && `${session.location} • `}
                        {session.ip_address} • Last active {session.last_activity}
                      </div>
                    </div>
                  </div>
                  {!session.is_current && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRevokeSession(session.id)}
                      className="text-red-600 hover:bg-red-50"
                    >
                      Revoke
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Password Change Modal */}
      <Modal
        isOpen={showPasswordForm}
        onClose={() => setShowPasswordForm(false)}
        title="Change Password"
      >
        <form onSubmit={passwordForm.handleSubmit(handlePasswordChange)} className="space-y-4">
          <div className="relative">
            <Input
              label="Current Password"
              type={showPassword.current ? 'text' : 'password'}
              {...passwordForm.register('current_password', { required: 'Current password is required' })}
              error={passwordForm.formState.errors.current_password?.message}
            />
            <button
              type="button"
              onClick={() => setShowPassword(prev => ({ ...prev, current: !prev.current }))}
              className="absolute right-3 top-8 text-gray-400 hover:text-gray-600"
            >
              {showPassword.current ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          <div className="relative">
            <Input
              label="New Password"
              type={showPassword.new ? 'text' : 'password'}
              {...passwordForm.register('new_password', { 
                required: 'New password is required',
                minLength: { value: 8, message: 'Password must be at least 8 characters' }
              })}
              error={passwordForm.formState.errors.new_password?.message}
            />
            <button
              type="button"
              onClick={() => setShowPassword(prev => ({ ...prev, new: !prev.new }))}
              className="absolute right-3 top-8 text-gray-400 hover:text-gray-600"
            >
              {showPassword.new ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          <div className="relative">
            <Input
              label="Confirm New Password"
              type={showPassword.confirm ? 'text' : 'password'}
              {...passwordForm.register('confirm_password', { 
                required: 'Please confirm your password',
                validate: value => value === passwordForm.watch('new_password') || 'Passwords do not match'
              })}
              error={passwordForm.formState.errors.confirm_password?.message}
            />
            <button
              type="button"
              onClick={() => setShowPassword(prev => ({ ...prev, confirm: !prev.confirm }))}
              className="absolute right-3 top-8 text-gray-400 hover:text-gray-600"
            >
              {showPassword.confirm ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowPasswordForm(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={isLoading}
            >
              Change Password
            </Button>
          </div>
        </form>
      </Modal>

      {/* Two-Factor Setup Modal */}
      <Modal
        isOpen={showTwoFactorSetup}
        onClose={() => setShowTwoFactorSetup(false)}
        title="Setup Two-Factor Authentication"
      >
        {twoFactorData && (
          <div className="space-y-4">
            <div className="text-center">
              <div className="mb-4">
                <img
                  src={twoFactorData.qr_code}
                  alt="QR Code"
                  className="mx-auto border rounded"
                />
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Scan this QR code with your authenticator app, or enter the secret manually:
              </p>
              <code className="bg-gray-100 px-3 py-1 rounded text-sm break-all">
                {twoFactorData.secret}
              </code>
            </div>

            <form onSubmit={twoFactorForm.handleSubmit(handleVerifyTwoFactor)}>
              <Input
                label="Verification Code"
                {...twoFactorForm.register('verification_code', { required: 'Verification code is required' })}
                error={twoFactorForm.formState.errors.verification_code?.message}
                placeholder="Enter 6-digit code"
              />

              <div className="flex justify-end space-x-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowTwoFactorSetup(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  isLoading={isLoading}
                >
                  Verify & Enable
                </Button>
              </div>
            </form>
          </div>
        )}
      </Modal>

      {/* Backup Codes Modal */}
      <Modal
        isOpen={showBackupCodes}
        onClose={() => setShowBackupCodes(false)}
        title="Backup Codes"
      >
        <div className="space-y-4">
          <div className="bg-yellow-50 p-4 rounded-lg">
            <div className="flex items-start space-x-2">
              <AlertTriangle size={20} className="text-yellow-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-yellow-800">Save these backup codes</h4>
                <p className="text-sm text-yellow-700 mt-1">
                  Store these codes in a safe place. You can use them to access your account if you lose your authenticator device.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {backupCodes.map((code, index) => (
              <code
                key={index}
                className="bg-gray-100 px-3 py-2 rounded text-sm text-center font-mono"
              >
                {code}
              </code>
            ))}
          </div>

          <div className="flex justify-end pt-4">
            <Button onClick={() => setShowBackupCodes(false)}>
              I've Saved These Codes
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default SecuritySettings;