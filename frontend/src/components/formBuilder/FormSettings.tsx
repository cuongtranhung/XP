/**
 * Form Settings Component
 * Configures form-wide settings and options
 */

import React from 'react';
import { useFormContext } from 'react-hook-form';
import { Settings, Eye, Bell, Shield, Globe, Zap } from '../icons';
import Input from '../common/Input';
import WebhookSettings from './WebhookSettings';

const FormSettings: React.FC = () => {
  const { watch, setValue } = useFormContext();
  const settings = watch('settings') || {};

  const handleNestedChange = (path: string, value: any) => {
    setValue(`settings.${path}`, value);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center">
            <Settings className="w-6 h-6 text-gray-600 mr-3" />
            <h2 className="text-xl font-semibold text-gray-900">Form Settings</h2>
          </div>
        </div>

        <div className="p-6 space-y-8">
          {/* Visibility Settings */}
          <section>
            <div className="flex items-center mb-4">
              <Eye className="w-5 h-5 text-gray-600 mr-2" />
              <h3 className="text-lg font-medium text-gray-900">Visibility</h3>
            </div>
            <div className="space-y-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.requireAuth || false}
                  onChange={(e) => handleNestedChange('requireAuth', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">
                  Require authentication to access this form
                </span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.singleSubmission || false}
                  onChange={(e) => handleNestedChange('singleSubmission', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">
                  Allow only one submission per user
                </span>
              </label>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Form Availability
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Start Date</label>
                    <Input
                      type="datetime-local"
                      value={settings.startDate || ''}
                      onChange={(e) => handleNestedChange('startDate', e.target.value)}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">End Date</label>
                    <Input
                      type="datetime-local"
                      value={settings.endDate || ''}
                      onChange={(e) => handleNestedChange('endDate', e.target.value)}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Submission Limit
                </label>
                <Input
                  type="number"
                  placeholder="No limit"
                  value={settings.submissionLimit || ''}
                  onChange={(e) => handleNestedChange('submissionLimit', e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full"
                  min="1"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Maximum number of submissions allowed for this form
                </p>
              </div>
            </div>
          </section>

          {/* Notifications */}
          <section>
            <div className="flex items-center mb-4">
              <Bell className="w-5 h-5 text-gray-600 mr-2" />
              <h3 className="text-lg font-medium text-gray-900">Notifications</h3>
            </div>
            <div className="space-y-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.emailNotifications || false}
                  onChange={(e) => handleNestedChange('emailNotifications', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">
                  Send email notification on new submission
                </span>
              </label>

              {settings.emailNotifications && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notification Email
                  </label>
                  <Input
                    type="email"
                    placeholder="admin@example.com"
                    value={settings.notificationEmail || ''}
                    onChange={(e) => handleNestedChange('notificationEmail', e.target.value)}
                    className="w-full"
                  />
                </div>
              )}

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.respondentNotification || false}
                  onChange={(e) => handleNestedChange('respondentNotification', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">
                  Send confirmation email to respondent
                </span>
              </label>
            </div>
          </section>

          {/* Security */}
          <section>
            <div className="flex items-center mb-4">
              <Shield className="w-5 h-5 text-gray-600 mr-2" />
              <h3 className="text-lg font-medium text-gray-900">Security</h3>
            </div>
            <div className="space-y-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.captchaEnabled || false}
                  onChange={(e) => handleNestedChange('captchaEnabled', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">
                  Enable CAPTCHA verification
                </span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.honeypot || false}
                  onChange={(e) => handleNestedChange('honeypot', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">
                  Enable honeypot spam protection
                </span>
              </label>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Allowed Domains (one per line)
                </label>
                <textarea
                  placeholder="example.com&#10;app.example.com"
                  value={settings.allowedDomains?.join('\n') || ''}
                  onChange={(e) => handleNestedChange('allowedDomains', e.target.value.split('\n').filter(d => d.trim()))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Restrict form access to specific domains (leave empty to allow all)
                </p>
              </div>
            </div>
          </section>

          {/* Confirmation */}
          <section>
            <div className="flex items-center mb-4">
              <Zap className="w-5 h-5 text-gray-600 mr-2" />
              <h3 className="text-lg font-medium text-gray-900">Confirmation</h3>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Success Message Title
                </label>
                <Input
                  placeholder="Thank You!"
                  value={settings.confirmation?.title || ''}
                  onChange={(e) => handleNestedChange('confirmation.title', e.target.value)}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Success Message
                </label>
                <textarea
                  placeholder="Your submission has been received."
                  value={settings.confirmation?.message || ''}
                  onChange={(e) => handleNestedChange('confirmation.message', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Redirect URL (optional)
                </label>
                <Input
                  type="url"
                  placeholder="https://example.com/thank-you"
                  value={settings.confirmation?.redirectUrl || ''}
                  onChange={(e) => handleNestedChange('confirmation.redirectUrl', e.target.value)}
                  className="w-full"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Redirect users to this URL after successful submission
                </p>
              </div>
            </div>
          </section>

          {/* Branding */}
          <section>
            <div className="flex items-center mb-4">
              <Globe className="w-5 h-5 text-gray-600 mr-2" />
              <h3 className="text-lg font-medium text-gray-900">Branding</h3>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Custom CSS
                </label>
                <textarea
                  placeholder=".form-container { background: #f5f5f5; }"
                  value={settings.customCss || ''}
                  onChange={(e) => handleNestedChange('customCss', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  rows={4}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Add custom CSS to style your form
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Logo URL
                </label>
                <Input
                  type="url"
                  placeholder="https://example.com/logo.png"
                  value={settings.logoUrl || ''}
                  onChange={(e) => handleNestedChange('logoUrl', e.target.value)}
                  className="w-full"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Primary Color
                  </label>
                  <Input
                    type="color"
                    value={settings.primaryColor || '#3b82f6'}
                    onChange={(e) => handleNestedChange('primaryColor', e.target.value)}
                    className="w-full h-10"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Background Color
                  </label>
                  <Input
                    type="color"
                    value={settings.backgroundColor || '#ffffff'}
                    onChange={(e) => handleNestedChange('backgroundColor', e.target.value)}
                    className="w-full h-10"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Webhooks */}
          <section>
            <WebhookSettings formId={watch('id')} />
          </section>
        </div>
      </div>
    </div>
  );
};

export default FormSettings;