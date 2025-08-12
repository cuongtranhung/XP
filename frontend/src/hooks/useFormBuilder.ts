/**
 * useFormBuilder Hook
 * Manages form data and API interactions for the form builder
 */

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import {
  Form,
  FormField,
  FormStep,
  CreateFormRequest,
  UpdateFormRequest,
  ListFormsResponse
} from '../types/formBuilder';

interface UseFormBuilderReturn {
  // State
  form: Form | null;
  fields: FormField[];
  steps: FormStep[];
  forms: Form[];
  loading: boolean;
  error: string | null;
  totalForms: number;
  currentPage: number;
  totalPages: number;

  // Actions
  loadForm: (formId: string) => Promise<void>;
  loadForms: (page?: number, search?: string, status?: string, filterOwner?: string) => Promise<void>;
  createForm: (data: CreateFormRequest) => Promise<Form>;
  updateForm: (formId: string, data: UpdateFormRequest) => Promise<Form>;
  deleteForm: (formId: string, permanent?: boolean) => Promise<void>;
  duplicateForm: (formId: string, name?: string) => Promise<Form>;
  publishForm: (formId: string, versionNote?: string) => Promise<Form>;
  
  // Field management
  setFields: (fields: FormField[]) => void;
  setSteps: (steps: FormStep[]) => void;
  
  // Utility
  clearError: () => void;
  resetForm: () => void;
}

export const useFormBuilder = (): UseFormBuilderReturn => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [form, setForm] = useState<Form | null>(null);
  const [fields, setFields] = useState<FormField[]>([]);
  const [steps, setSteps] = useState<FormStep[]>([]);
  const [forms, setForms] = useState<Form[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalForms, setTotalForms] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Load single form
  const loadForm = useCallback(async (formId: string) => {
    if (!user) {
      setError('Authentication required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Load form details
      const formResponse = await api.get(`/api/forms/${formId}`);
      const formData = formResponse.data.data;
      setForm(formData);

      // Set fields from form data if available
      if (formData.fields) {
        setFields(formData.fields);
      } else {
        // If no fields in response, set empty array
        setFields([]);
      }

      // Load form steps if multi-page
      if (formData.settings?.multiPage) {
        try {
          const stepsResponse = await api.get(`/api/forms/${formId}/steps`);
          setSteps(stepsResponse.data.data || []);
        } catch {
          setSteps([]);
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error 
        ? err.message 
        : (err as any)?.response?.data?.error?.message || 'Failed to load form';
      setError(errorMessage);
      
      if ((err as any)?.response?.status === 404) {
        navigate('/forms');
      }
    } finally {
      setLoading(false);
    }
  }, [user, navigate]);

  // Load forms list
  const loadForms = useCallback(async (page = 1, search?: string, status?: string, filterOwner?: string) => {
    if (!user) {
      setError('Authentication required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(search && { search }),
        ...(status && status !== 'all' && { status }),
        ...(filterOwner && filterOwner !== 'all' && { filter_owner: filterOwner })
      });

      const response = await api.get<ListFormsResponse>(`/api/forms?${params}`);
      const { forms, pagination } = response.data.data;

      setForms(forms);
      setTotalForms(pagination.total);
      setCurrentPage(pagination.page);
      setTotalPages(pagination.pages);
    } catch (err) {
      const errorMessage = err instanceof Error 
        ? err.message 
        : (err as any)?.response?.data?.error?.message || 'Failed to load forms';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Create form
  const createForm = useCallback(async (data: CreateFormRequest): Promise<Form> => {
    if (!user) {
      throw new Error('Authentication required');
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.post<{ success: boolean; data: Form }>('/api/forms', data);
      const newForm = response.data.data;
      setForm(newForm);
      return newForm;
    } catch (err) {
      const errorMessage = err instanceof Error 
        ? err.message 
        : (err as any)?.response?.data?.error?.message || 'Failed to create form';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Update form
  const updateForm = useCallback(async (formId: string, data: UpdateFormRequest): Promise<Form> => {
    if (!user) {
      throw new Error('Authentication required');
    }

    setLoading(true);
    setError(null);

    try {
      console.log('Sending update request:', {
        url: `/api/forms/${formId}`,
        dataKeys: Object.keys(data),
        fieldsCount: data.fields?.length
      });
      
      const response = await api.put<{ success: boolean; data: Form }>(`/api/forms/${formId}`, data);
      const updatedForm = response.data.data;
      setForm(updatedForm);
      return updatedForm;
    } catch (err) {
      const error = err as any;
      console.error('Update form error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        error: error.response?.data?.error,
        validationDetails: error.response?.data?.error?.details,
        message: error.response?.data?.message || error.message
      });
      
      // Log validation errors specifically
      if (error.response?.data?.error?.details) {
        console.error('Validation errors:', error.response.data.error.details);
      }
      
      const errorMessage = error.response?.data?.error?.message || 'Failed to update form';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Delete form
  const deleteForm = useCallback(async (formId: string, permanent = false) => {
    if (!user) {
      throw new Error('Authentication required');
    }

    setLoading(true);
    setError(null);

    try {
      await api.delete(`/api/forms/${formId}${permanent ? '?permanent=true' : ''}`);
      
      // Remove from forms list if present
      setForms(prevForms => prevForms.filter(f => f.id !== formId));
      
      // Clear current form if it's the one being deleted
      if (form?.id === formId) {
        resetForm();
      }
    } catch (err) {
      const errorMessage = err instanceof Error 
        ? err.message 
        : (err as any)?.response?.data?.error?.message || 'Failed to delete form';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [user, form]);

  // Duplicate form
  const duplicateForm = useCallback(async (formId: string, name?: string): Promise<Form> => {
    if (!user) {
      throw new Error('Authentication required');
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.post<{ success: boolean; data: Form }>(
        `/api/forms/${formId}/duplicate`,
        { name }
      );
      return response.data.data;
    } catch (err) {
      const errorMessage = err instanceof Error 
        ? err.message 
        : (err as any)?.response?.data?.error?.message || 'Failed to duplicate form';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Publish form
  const publishForm = useCallback(async (formId: string, versionNote?: string): Promise<Form> => {
    if (!user) {
      throw new Error('Authentication required');
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.post<{ success: boolean; data: Form }>(
        `/api/forms/${formId}/publish`,
        { versionNote }
      );
      const publishedForm = response.data.data;
      setForm(publishedForm);
      return publishedForm;
    } catch (err) {
      const errorMessage = err instanceof Error 
        ? err.message 
        : (err as any)?.response?.data?.error?.message || 'Failed to publish form';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Utility functions
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const resetForm = useCallback(() => {
    setForm(null);
    setFields([]);
    setSteps([]);
    setError(null);
  }, []);

  return {
    // State
    form,
    fields,
    steps,
    forms,
    loading,
    error,
    totalForms,
    currentPage,
    totalPages,

    // Actions
    loadForm,
    loadForms,
    createForm,
    updateForm,
    deleteForm,
    duplicateForm,
    publishForm,
    
    // Field management
    setFields,
    setSteps,
    
    // Utility
    clearError,
    resetForm
  };
};