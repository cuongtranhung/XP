/**
 * Form Builder Page
 * Main page for creating and editing forms
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FormProvider, useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import AppLayout from '../components/layout/AppLayout';
import FormBuilderSidebar from '../components/formBuilder/FormBuilderSidebar';
import FormCanvas from '../components/formBuilder/FormCanvas';
import FormPreview from '../components/formBuilder/FormPreview';
import FormSettings from '../components/formBuilder/FormSettings';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Button from '../components/common/Button';
import { useFormBuilder } from '../hooks/useFormBuilder';
import { FormBuilderProvider } from '../contexts/FormBuilderContext';
import { Form } from '../types/formBuilder';

interface FormBuilderPageProps {}

const FormBuilderPage: React.FC<FormBuilderPageProps> = () => {
  const { formId } = useParams<{ formId?: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(formId);
  
  const [activeTab, setActiveTab] = useState<'builder' | 'preview' | 'settings'>('builder');
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  const {
    form,
    fields,
    steps,
    loading,
    error,
    createForm,
    updateForm,
    publishForm,
    loadForm
  } = useFormBuilder();

  const methods = useForm<{
    name: string;
    description?: string;
    category?: string;
    tags?: string[];
    settings?: any;
  }>({
    defaultValues: {
      name: '',
      description: '',
      category: '',
      tags: [],
      settings: {}
    }
  });

  const { handleSubmit, reset, watch } = methods;
  const watchedName = watch('name');

  // Load existing form for editing
  useEffect(() => {
    if (isEdit && formId) {
      loadForm(formId);
    }
  }, [isEdit, formId, loadForm]);

  // Reset form when data loads
  useEffect(() => {
    if (form && isEdit) {
      reset({
        name: form.name,
        description: form.description,
        category: form.category,
        tags: form.tags,
        settings: form.settings
      });
    }
  }, [form, isEdit, reset]);

  const handleSave = async (data: any) => {
    return handleSaveWithPublish(data, false);
  };

  const handleSaveWithPublish = async (data: any, publish = false) => {
    try {
      setIsSaving(true);

      const formData = {
        ...data,
        fields,
        steps,
        status: publish ? 'published' : 'draft'
      };

      let savedForm: Form;

      if (isEdit && formId) {
        savedForm = await updateForm(formId, formData);
        if (publish) {
          await publishForm(formId);
        }
      } else {
        savedForm = await createForm(formData);
        if (publish) {
          await publishForm(savedForm.id);
        }
      }

      toast.success(
        publish 
          ? 'Form published successfully!' 
          : isEdit 
            ? 'Form updated successfully!' 
            : 'Form created successfully!'
      );

      if (!isEdit) {
        navigate(`/forms/${savedForm.id}/edit`);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to save form');
    } finally {
      setIsSaving(false);
      setIsPublishing(false);
    }
  };

  const handlePublish = async (data: any) => {
    setIsPublishing(true);
    await handleSaveWithPublish(data, true);
  };

  const handlePreview = () => {
    if (fields.length === 0) {
      toast.error('Add at least one field to preview the form');
      return;
    }
    setActiveTab('preview');
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <LoadingSpinner size="lg" />
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Error</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={() => navigate('/forms')}>
              Back to Forms
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <FormBuilderProvider>
      <AppLayout>
        <div className="flex h-full">
          {/* Header */}
          <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200">
            <div className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center space-x-4">
                <Button
                  variant="ghost"
                  onClick={() => navigate('/forms')}
                  className="text-gray-600"
                >
                  ← Back to Forms
                </Button>
                <div>
                  <h1 className="text-xl font-semibold text-gray-900">
                    {isEdit ? 'Edit Form' : 'Create Form'}
                  </h1>
                  <p className="text-sm text-gray-500">
                    {watchedName || 'Untitled Form'}
                  </p>
                </div>
              </div>

              {/* Tab Navigation */}
              <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
                <button
                  onClick={() => setActiveTab('builder')}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeTab === 'builder'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Builder
                </button>
                <button
                  onClick={handlePreview}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeTab === 'preview'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Preview
                </button>
                <button
                  onClick={() => setActiveTab('settings')}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeTab === 'settings'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Settings
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-3">
                <FormProvider {...methods}>
                  <form onSubmit={handleSubmit(handleSave)}>
                    <Button
                      type="submit"
                      variant="outline"
                      disabled={isSaving || isPublishing}
                      isLoading={isSaving && !isPublishing}
                    >
                      {isEdit ? 'Save Changes' : 'Save Draft'}
                    </Button>
                  </form>
                </FormProvider>

                <FormProvider {...methods}>
                  <form onSubmit={handleSubmit(handlePublish)}>
                    <Button
                      type="submit"
                      disabled={isSaving || isPublishing || fields.length === 0}
                      isLoading={isPublishing}
                    >
                      {isEdit ? 'Update & Publish' : 'Publish Form'}
                    </Button>
                  </form>
                </FormProvider>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 pt-20">
            {activeTab === 'builder' && (
              <div className="flex h-full">
                {/* Sidebar with field types */}
                <div className="w-80 border-r border-gray-200 bg-gray-50">
                  <FormBuilderSidebar />
                </div>

                {/* Main canvas area */}
                <div className="flex-1 bg-white">
                  <FormProvider {...methods}>
                    <FormCanvas />
                  </FormProvider>
                </div>
              </div>
            )}

            {activeTab === 'preview' && (
              <div className="flex-1 bg-gray-50 p-8">
                <div className="max-w-2xl mx-auto">
                  <FormPreview />
                </div>
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="flex-1 bg-white">
                <FormProvider {...methods}>
                  <FormSettings />
                </FormProvider>
              </div>
            )}
          </div>
        </div>
      </AppLayout>
    </FormBuilderProvider>
  );
};

export default FormBuilderPage;