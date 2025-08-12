/**
 * Form Submit Page
 * Public page for submitting forms
 */

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle, AlertCircle } from '../components/icons';
import FormFieldRenderer from '../components/formBuilder/FormFieldRenderer';
import Button from '../components/common/Button';
import { Form, FormField, FormStep } from '../types/formBuilder';
import api from '../services/api';
import toast from 'react-hot-toast';

const FormSubmit: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [form, setForm] = useState<Form | null>(null);
  const [fields, setFields] = useState<FormField[]>([]);
  const [steps, setSteps] = useState<FormStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [currentStep, setCurrentStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submissionResponse, setSubmissionResponse] = useState<any>(null);

  useEffect(() => {
    fetchForm();
  }, [slug]);

  const fetchForm = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/forms/public/${slug}`);
      const formData = response.data.data || response.data;
      
      setForm(formData);
      setFields(formData.fields || []);
      setSteps(formData.steps || []);
      
      // Initialize form data with default values
      const initialData: Record<string, any> = {};
      formData.fields?.forEach((_field: FormField) => {
        // TODO: Add defaultValue to FormField type if needed
        // if (field.defaultValue !== undefined) {
        //   initialData[field.fieldKey] = field.defaultValue;
        // }
      });
      setFormData(initialData);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load form');
    } finally {
      setLoading(false);
    }
  };

  const isMultiStep = steps.length > 0;
  const currentFields = isMultiStep
    ? fields.filter(field => field.stepId === steps[currentStep]?.id)
    : fields;

  const handleFieldChange = (fieldKey: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldKey]: value }));
    // Clear error when field is changed
    if (errors[fieldKey]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldKey];
        return newErrors;
      });
    }
  };

  const validateField = (field: FormField) => {
    const value = formData[field.fieldKey];
    
    // Required validation
    if (field.required && !value) {
      return field.validation?.messages?.required || `${field.label} is required`;
    }

    // Type-specific validation
    if (value) {
      // Email validation
      if (field.fieldType === 'email') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          return field.validation?.messages?.pattern || 'Please enter a valid email address';
        }
      }

      // URL validation
      if (field.fieldType === 'url') {
        try {
          new URL(value);
        } catch {
          return field.validation?.messages?.pattern || 'Please enter a valid URL';
        }
      }

      // Pattern validation
      if (field.validation?.pattern) {
        const regex = new RegExp(field.validation.pattern);
        if (!regex.test(value)) {
          return field.validation?.messages?.pattern || 'Invalid format';
        }
      }

      // Length validation
      if (typeof value === 'string') {
        if (field.validation?.minLength && value.length < field.validation.minLength) {
          return field.validation?.messages?.minLength || `Must be at least ${field.validation.minLength} characters`;
        }
        if (field.validation?.maxLength && value.length > field.validation.maxLength) {
          return field.validation?.messages?.maxLength || `Must be no more than ${field.validation.maxLength} characters`;
        }
      }

      // Numeric validation
      if (field.fieldType === 'number' || field.fieldType === 'range') {
        const numValue = parseFloat(value);
        if (field.validation?.min !== undefined && numValue < field.validation.min) {
          return field.validation?.messages?.min || `Must be at least ${field.validation.min}`;
        }
        if (field.validation?.max !== undefined && numValue > field.validation.max) {
          return field.validation?.messages?.max || `Must be no more than ${field.validation.max}`;
        }
      }
    }

    return null;
  };

  const validateCurrentStep = () => {
    const newErrors: Record<string, string> = {};
    let hasErrors = false;

    currentFields.forEach(field => {
      const error = validateField(field);
      if (error) {
        newErrors[field.fieldKey] = error;
        hasErrors = true;
      }
    });

    setErrors(newErrors);
    return !hasErrors;
  };

  const handleNext = () => {
    if (validateCurrentStep()) {
      if (currentStep < steps.length - 1) {
        setCurrentStep(prev => prev + 1);
      }
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateCurrentStep()) {
      return;
    }

    try {
      setSubmitting(true);
      
      // Prepare submission data
      const submissionData = {
        data: formData,
        metadata: {
          userAgent: navigator.userAgent,
          referrer: document.referrer,
          submittedAt: new Date().toISOString()
        }
      };

      const response = await api.post(`/api/forms/${form?.id}/submissions`, submissionData);
      
      // Store submission response
      setSubmissionResponse(response.data.data);
      setSubmitted(true);
      
      // Show toast notification
      toast.success('Form submitted successfully!', {
        duration: 3000,
        icon: '✅',
      });
      
      // Handle redirect if configured
      if (form?.settings?.confirmation?.redirectUrl) {
        setTimeout(() => {
          window.location.href = form.settings.confirmation!.redirectUrl!;
        }, 3000);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to submit form');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading form...</p>
        </div>
      </div>
    );
  }

  if (error && !form) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Form Not Found</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  // Handle Submit Another Response
  const handleSubmitAnother = () => {
    // Reset form state
    const resetData: Record<string, any> = {};
    fields.forEach((_field: FormField) => {
      resetData[_field.fieldKey] = '';
    });
    setFormData(resetData);
    setErrors({});
    setCurrentStep(0);
    setSubmitted(false);
    setSubmissionResponse(null);
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Show success page after submission
  if (submitted && submissionResponse) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center max-w-md w-full">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {form?.settings?.confirmation?.title || 'Thank You!'}
          </h2>
          <p className="text-gray-600 mb-4">
            {form?.settings?.confirmation?.message || 'Your submission has been received.'}
          </p>
          {submissionResponse?.confirmation?.referenceNumber && (
            <p className="text-sm text-gray-500 mb-4">
              Reference: {submissionResponse.confirmation.referenceNumber}
            </p>
          )}
          
          <button 
            type="button"
            onClick={handleSubmitAnother}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors mt-4"
          >
            Submit Another Response
          </button>
          
          {form?.settings?.confirmation?.redirectUrl && (
            <p className="text-sm text-gray-500 mt-4">
              You will be redirected shortly...
            </p>
          )}
        </div>
      </div>
    );
  }

  // TODO: Add customCss, primaryColor, backgroundColor to FormSettings type if needed
  const customStyles = null;
  // const customStyles = form?.settings?.customCss ? (
  //   <style dangerouslySetInnerHTML={{ __html: form.settings.customCss }} />
  // ) : null;

  const primaryColor = '#3b82f6'; // form?.settings?.primaryColor || '#3b82f6';
  const backgroundColor = '#ffffff'; // form?.settings?.backgroundColor || '#ffffff';

  return (
    <>
      {customStyles}
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-3xl mx-auto">
          {/* Logo */}
          {/* TODO: Add logoUrl to FormSettings type if needed */}
          {/* {form?.settings?.logoUrl && (
            <div className="text-center mb-8">
              <img 
                src={form.settings.logoUrl} 
                alt="Logo" 
                className="h-16 mx-auto"
              />
            </div>
          )} */}

          <div 
            className="bg-white rounded-lg shadow-sm border border-gray-200"
            style={{ backgroundColor }}
          >
            {/* Form Header */}
            <div className="p-6 border-b border-gray-200">
              <h1 className="text-2xl font-bold text-gray-900">
                {form?.name || 'Untitled Form'}
              </h1>
              {form?.description && (
                <p className="mt-2 text-gray-600">{form.description}</p>
              )}
            </div>

            {/* Progress Bar for Multi-step Forms */}
            {isMultiStep && (
              <div className="px-6 pt-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">
                    Step {currentStep + 1} of {steps.length}
                  </span>
                  <span className="text-sm text-gray-600">
                    {Math.round(((currentStep + 1) / steps.length) * 100)}% Complete
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="h-2 rounded-full transition-all duration-300"
                    style={{ 
                      width: `${((currentStep + 1) / steps.length) * 100}%`,
                      backgroundColor: primaryColor
                    }}
                  />
                </div>
                {steps[currentStep] && (
                  <div className="mt-4">
                    <h2 className="text-lg font-semibold text-gray-900">
                      {steps[currentStep].title}
                    </h2>
                    {steps[currentStep].description && (
                      <p className="text-sm text-gray-600 mt-1">
                        {steps[currentStep].description}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}


            {/* Form Fields */}
            <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-6">
                {currentFields.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    No fields in this {isMultiStep ? 'step' : 'form'}
                  </p>
                ) : (
                  currentFields.map(field => (
                    <FormFieldRenderer
                      key={field.id}
                      field={field}
                      value={formData[field.fieldKey]}
                      onChange={(value) => handleFieldChange(field.fieldKey, value)}
                      error={errors[field.fieldKey]}
                    />
                  ))
                )}
              </div>

              {error && (
                <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              {/* Form Actions */}
              <div className="mt-8 flex justify-between">
                {isMultiStep ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handlePrevious}
                      disabled={currentStep === 0}
                    >
                      Previous
                    </Button>
                    
                    {currentStep < steps.length - 1 ? (
                      <Button
                        type="button"
                        onClick={handleNext}
                        style={{ backgroundColor: primaryColor }}
                      >
                        Next
                      </Button>
                    ) : (
                      <Button 
                        type="submit"
                        disabled={submitting}
                        style={{ backgroundColor: primaryColor }}
                      >
                        {submitting ? 'Submitting...' : 'Submit'}
                      </Button>
                    )}
                  </>
                ) : (
                  <>
                    <div />
                    <Button 
                      type="submit"
                      disabled={submitting}
                      style={{ backgroundColor: primaryColor }}
                    >
                      {submitting ? 'Submitting...' : 'Submit'}
                    </Button>
                  </>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
};

export default FormSubmit;