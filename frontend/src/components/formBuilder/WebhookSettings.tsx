/**
 * Webhook Settings Component
 * Configure webhooks for form submissions
 */

import React, { useState, useEffect } from 'react';
import { 
  Webhook, 
  Plus, 
  Trash2, 
  Edit2, 
  Send,
  Clock
} from '../icons';
import Button from '../common/Button';
import Input from '../common/Input';
import Badge from '../common/Badge';
import api from '../../services/api';

interface WebhookConfig {
  id: string;
  url: string;
  events: string[];
  headers?: Record<string, string>;
  retryCount: number;
  status: 'active' | 'inactive' | 'error';
  lastTriggered?: string;
  lastStatus?: number;
  secret?: string;
}

interface WebhookSettingsProps {
  formId: string;
}

const WebhookSettings: React.FC<WebhookSettingsProps> = ({ formId }) => {
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);

  // Form state for add/edit modal
  const [webhookForm, setWebhookForm] = useState({
    url: '',
    events: ['submission.created'],
    headers: {} as Record<string, string>,
    retryCount: 3,
    secret: ''
  });

  const [newHeader, setNewHeader] = useState({ key: '', value: '' });

  useEffect(() => {
    if (formId && formId !== 'new') {
      fetchWebhooks();
    }
  }, [formId]);

  const fetchWebhooks = async () => {
    if (!formId || formId === 'new') {
      setWebhooks([]);
      return;
    }
    
    try {
      setLoading(true);
      const response = await api.get(`/forms/${formId}/webhooks`);
      setWebhooks(response.data);
    } catch (error) {
      console.error('Failed to fetch webhooks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveWebhook = async () => {
    try {
      if (editingWebhook) {
        await api.put(`/forms/${formId}/webhooks/${editingWebhook.id}`, webhookForm);
      } else {
        await api.post(`/forms/${formId}/webhooks`, webhookForm);
      }
      
      fetchWebhooks();
      resetForm();
    } catch (error) {
      console.error('Failed to save webhook:', error);
    }
  };

  const handleDeleteWebhook = async (webhookId: string) => {
    if (!window.confirm('Are you sure you want to delete this webhook?')) {
      return;
    }

    try {
      await api.delete(`/forms/${formId}/webhooks/${webhookId}`);
      fetchWebhooks();
    } catch (error) {
      console.error('Failed to delete webhook:', error);
    }
  };

  const handleTestWebhook = async (webhookId: string) => {
    try {
      setTesting(webhookId);
      const response = await api.post(`/forms/${formId}/webhooks/${webhookId}/test`);
      
      // Update webhook status based on test result
      setWebhooks(prev => prev.map(w => 
        w.id === webhookId 
          ? { ...w, lastStatus: response.data.status, lastTriggered: new Date().toISOString() }
          : w
      ));
    } catch (error) {
      console.error('Failed to test webhook:', error);
    } finally {
      setTesting(null);
    }
  };

  const handleEditWebhook = (webhook: WebhookConfig) => {
    setEditingWebhook(webhook);
    setWebhookForm({
      url: webhook.url,
      events: webhook.events,
      headers: webhook.headers || {},
      retryCount: webhook.retryCount,
      secret: webhook.secret || ''
    });
    setShowAddModal(true);
  };

  const resetForm = () => {
    setWebhookForm({
      url: '',
      events: ['submission.created'],
      headers: {},
      retryCount: 3,
      secret: ''
    });
    setNewHeader({ key: '', value: '' });
    setShowAddModal(false);
    setEditingWebhook(null);
  };

  const addHeader = () => {
    if (newHeader.key && newHeader.value) {
      setWebhookForm(prev => ({
        ...prev,
        headers: {
          ...prev.headers,
          [newHeader.key]: newHeader.value
        }
      }));
      setNewHeader({ key: '', value: '' });
    }
  };

  const removeHeader = (key: string) => {
    setWebhookForm(prev => {
      const headers = { ...prev.headers };
      delete headers[key];
      return { ...prev, headers };
    });
  };

  const getStatusBadge = (webhook: WebhookConfig) => {
    if (webhook.lastStatus && webhook.lastStatus >= 200 && webhook.lastStatus < 300) {
      return <Badge variant="success">Active</Badge>;
    } else if (webhook.lastStatus) {
      return <Badge variant="error">Error {webhook.lastStatus}</Badge>;
    }
    return <Badge variant="default">Not tested</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Webhook className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-medium text-gray-900">Webhooks</h3>
        </div>
        <Button
          size="sm"
          onClick={() => setShowAddModal(true)}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Webhook
        </Button>
      </div>

      {/* Webhooks List */}
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      ) : webhooks.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <Webhook className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">No webhooks configured</p>
          <p className="text-sm text-gray-500 mt-1">
            Add a webhook to receive form submission notifications
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {webhooks.map(webhook => (
            <div key={webhook.id} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <p className="font-medium text-gray-900">{webhook.url}</p>
                    {getStatusBadge(webhook)}
                  </div>
                  
                  <div className="flex flex-wrap gap-2 mb-3">
                    {webhook.events.map(event => (
                      <Badge key={event} variant="default">{event}</Badge>
                    ))}
                  </div>

                  {webhook.lastTriggered && (
                    <p className="text-sm text-gray-500">
                      Last triggered: {new Date(webhook.lastTriggered).toLocaleString()}
                    </p>
                  )}
                </div>

                <div className="flex items-center space-x-2 ml-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleTestWebhook(webhook.id)}
                    disabled={testing === webhook.id}
                  >
                    {testing === webhook.id ? (
                      <Clock className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEditWebhook(webhook)}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteWebhook(webhook.id)}
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {editingWebhook ? 'Edit Webhook' : 'Add Webhook'}
            </h3>

            <div className="space-y-4">
              {/* URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Webhook URL
                </label>
                <Input
                  type="url"
                  placeholder="https://example.com/webhook"
                  value={webhookForm.url}
                  onChange={(e) => setWebhookForm(prev => ({ ...prev, url: e.target.value }))}
                  className="w-full"
                />
              </div>

              {/* Events */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Trigger Events
                </label>
                <div className="space-y-2">
                  {[
                    { value: 'submission.created', label: 'New Submission' },
                    { value: 'submission.updated', label: 'Submission Updated' },
                    { value: 'submission.deleted', label: 'Submission Deleted' },
                    { value: 'submission.completed', label: 'Submission Completed' }
                  ].map(event => (
                    <label key={event.value} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={webhookForm.events.includes(event.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setWebhookForm(prev => ({
                              ...prev,
                              events: [...prev.events, event.value]
                            }));
                          } else {
                            setWebhookForm(prev => ({
                              ...prev,
                              events: prev.events.filter(ev => ev !== event.value)
                            }));
                          }
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">{event.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Secret */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Webhook Secret (optional)
                </label>
                <Input
                  type="password"
                  placeholder="Secret for webhook signature"
                  value={webhookForm.secret}
                  onChange={(e) => setWebhookForm(prev => ({ ...prev, secret: e.target.value }))}
                  className="w-full"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Used to sign webhook payloads for verification
                </p>
              </div>

              {/* Headers */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Custom Headers (optional)
                </label>
                
                {Object.entries(webhookForm.headers).map(([key, value]) => (
                  <div key={key} className="flex items-center space-x-2 mb-2">
                    <Input
                      value={key}
                      disabled
                      className="flex-1"
                    />
                    <Input
                      value={value}
                      disabled
                      className="flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeHeader(key)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}

                <div className="flex items-center space-x-2">
                  <Input
                    placeholder="Header name"
                    value={newHeader.key}
                    onChange={(e) => setNewHeader(prev => ({ ...prev, key: e.target.value }))}
                    className="flex-1"
                  />
                  <Input
                    placeholder="Header value"
                    value={newHeader.value}
                    onChange={(e) => setNewHeader(prev => ({ ...prev, value: e.target.value }))}
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addHeader}
                  >
                    Add
                  </Button>
                </div>
              </div>

              {/* Retry Count */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Retry Count
                </label>
                <Input
                  type="number"
                  min="0"
                  max="5"
                  value={webhookForm.retryCount}
                  onChange={(e) => setWebhookForm(prev => ({ ...prev, retryCount: parseInt(e.target.value) }))}
                  className="w-full"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Number of retry attempts on failure (0-5)
                </p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end space-x-3 mt-6">
              <Button
                variant="outline"
                onClick={resetForm}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveWebhook}
                disabled={!webhookForm.url || webhookForm.events.length === 0}
              >
                {editingWebhook ? 'Update' : 'Add'} Webhook
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WebhookSettings;