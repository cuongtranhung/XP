/**
 * Form Builder Page (Without Collaboration)
 * Simplified version without realtime collaboration features
 */

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FormProvider, useForm } from 'react-hook-form';
import { 
  Save, 
  ArrowLeft, 
  Eye, 
  Settings as SettingsIcon,
  Layout
} from '../components/icons';
import { FormBuilderProvider, useFormBuilderContext } from '../contexts/FormBuilderContext';
// Import the original Form Builder components
import FormBuilderSidebar from '../components/formBuilder/FormBuilderSidebar';
import FormCanvas from '../components/formBuilder/FormCanvas';
// Keep these for settings and preview
import FormPreview from '../components/formBuilder/FormPreview';
import FormSettings from '../components/formBuilder/FormSettings';
import Button from '../components/common/Button';
import { useFormBuilder } from '../hooks/useFormBuilder';
import { Form } from '../types/formBuilder';

type TabType = 'build' | 'preview' | 'settings';

interface FormBuilderContentProps {
  parentLoading?: boolean;
}

const FormBuilderContent: React.FC<FormBuilderContentProps> = ({ parentLoading }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('build');
  const { form, loading: hookLoading, error, loadForm, createForm, updateForm } = useFormBuilder();
  const formBuilderContext = useFormBuilderContext();
  const [hasChanges, setHasChanges] = useState(false);
  
  // Use parentLoading if provided, otherwise use hookLoading
  const loading = parentLoading !== undefined ? parentLoading : hookLoading;
  
  const methods = useForm<Form>({
    defaultValues: {
      name: '',
      description: '',
      category: '',
      tags: [],
      settings: {
        multiPage: false,
        progressBar: { enabled: false, type: 'steps' as const },
        saveProgress: { enabled: false, autoSave: false },
        confirmation: {
          type: 'message' as const,
          message: 'Thank you for your submission!'
        },
        theme: 'default'
      }
    }
  });

  const { handleSubmit, reset, watch } = methods;

  // Watch for form changes
  useEffect(() => {
    const subscription = watch(() => {
      setHasChanges(true);
    });
    return () => subscription.unsubscribe();
  }, [watch]);

  // Monitor context changes
  useEffect(() => {
    if (formBuilderContext?.fields?.length > 0) {
      setHasChanges(true);
    }
  }, [formBuilderContext?.fields]);

  useEffect(() => {
    if (id && id !== 'new') {
      loadForm(id).then(() => {
        console.log('Form loaded for editing:', id);
      });
    }
  }, [id, loadForm]);

  useEffect(() => {
    if (form) {
      reset(form);
      // Fields are already initialized via FormBuilderProvider props
      // No need to call setAllFields anymore
      console.log('Form loaded with fields:', formBuilderContext?.fields?.length || 0);
    }
  }, [form, reset, formBuilderContext?.fields?.length]);

  const onSubmit = async (data: Form) => {
    try {
      // Check for duplicate fieldKeys
      const fieldKeys = new Set();
      const duplicateKeys: string[] = [];
      formBuilderContext.fields?.forEach(field => {
        if (fieldKeys.has(field.fieldKey)) {
          duplicateKeys.push(field.fieldKey);
        }
        fieldKeys.add(field.fieldKey);
      });
      
      if (duplicateKeys.length > 0) {
        console.error('Duplicate field keys found:', duplicateKeys);
        alert('Error: Duplicate field keys found. Please ensure each field has a unique key.');
        return;
      }
      
      // Clean fields data - remove undefined values
      const cleanFields = formBuilderContext.fields?.map(field => {
        const cleanField: any = {
          // Send both formats for compatibility
          id: field.id,
          type: field.fieldType,
          fieldKey: field.fieldKey || field.id,
          fieldType: field.fieldType,
          label: field.label,
          position: field.position,
          required: field.required || false,
          hidden: field.hidden || false
        };
        
        // Only add optional fields if they have values
        if (field.placeholder) cleanField.placeholder = field.placeholder;
        if (field.validation && Object.keys(field.validation).length > 0) {
          cleanField.validation = field.validation;
        }
        if (field.options && field.options.length > 0) {
          cleanField.options = field.options;
        }
        if (field.conditionalLogic && Object.keys(field.conditionalLogic).length > 0) {
          cleanField.conditionalLogic = field.conditionalLogic;
        }
        if (field.stepId) cleanField.stepId = field.stepId;
        
        return cleanField;
      }) || [];
      
      // Clean form data - remove null category
      const cleanFormData = { ...data };
      if (cleanFormData.category === null) {
        delete cleanFormData.category;
      }
      
      const formData = {
        ...cleanFormData,
        fields: cleanFields
      };

      console.log('Saving form:', formData);
      console.log('Fields being sent:', cleanFields);
      console.log('Data being sent to API:', JSON.stringify(formData, null, 2));
      
      if (id && id !== 'new') {
        // Update existing form
        await updateForm(id, formData);
      } else {
        // Create new form
        await createForm(formData);
      }
      
      setHasChanges(false);
      // Navigate to forms list after save
      navigate('/forms');
    } catch (error: any) {
      console.error('Failed to save form:', error);
      console.error('Update form error details:', error.response?.data);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={() => navigate('/forms')}>
            Back to Forms
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/forms')}
              className="flex items-center"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                {id && id !== 'new' ? 'Edit Form' : 'Create New Form'}
              </h1>
              {form?.name && (
                <p className="text-sm text-gray-500">{form.name}</p>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Tab Navigation */}
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setActiveTab('build')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'build'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Layout className="w-4 h-4 inline-block mr-2" />
                Build
              </button>
              <button
                onClick={() => setActiveTab('preview')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'preview'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Eye className="w-4 h-4 inline-block mr-2" />
                Preview
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'settings'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <SettingsIcon className="w-4 h-4 inline-block mr-2" />
                Settings
              </button>
            </div>

            {/* Save Button */}
            <Button
              onClick={handleSubmit(onSubmit)}
              disabled={loading || !hasChanges}
              className="flex items-center"
            >
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        <FormProvider {...methods}>
          {activeTab === 'build' && (
            <>
              {/* Left Sidebar - Field Types */}
              <div className="w-80 bg-white border-r border-gray-200 overflow-y-auto">
                <FormBuilderSidebar />
              </div>

              {/* Center - Form Canvas */}
              <div className="flex-1 overflow-y-auto p-6">
                <FormCanvas />
              </div>

              {/* Right Sidebar - Field Properties */}
              {formBuilderContext?.selectedField && (
                <div className="w-80 bg-white border-l border-gray-200 overflow-y-auto p-6">
                  <h3 className="text-lg font-semibold mb-4">Field Properties</h3>
                  {/* Field properties editor can be added here */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Field Type
                      </label>
                      <p className="text-sm text-gray-600">
                        {formBuilderContext.selectedField.fieldType}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Label
                      </label>
                      <p className="text-sm text-gray-600">
                        {formBuilderContext.selectedField.label}
                      </p>
                    </div>
                    {formBuilderContext.selectedField.required && (
                      <div>
                        <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                          Required
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === 'preview' && (
            <div className="flex-1 overflow-y-auto">
              <FormPreview />
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="flex-1 overflow-y-auto">
              <FormSettings />
            </div>
          )}
        </FormProvider>
      </div>
    </div>
  );
};

const FormBuilder: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { form, fields, loading, loadForm } = useFormBuilder();
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (id && id !== 'new') {
      loadForm(id).then(() => {
        setIsInitialized(true);
      });
    } else {
      setIsInitialized(true);
    }
  }, [id, loadForm]);

  if (loading || !isInitialized) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // For edit mode, use form data; for new forms, use empty arrays
  const initialForm = form || undefined;
  const initialFields = form?.fields || fields || [];

  return (
    <FormBuilderProvider initialForm={initialForm} initialFields={initialFields}>
      <FormBuilderContent parentLoading={loading} />
    </FormBuilderProvider>
  );
};

export default FormBuilder;