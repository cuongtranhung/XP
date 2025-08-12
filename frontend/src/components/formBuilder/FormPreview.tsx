/**
 * Form Preview Component
 * Previews the form as it would appear to end users
 */

import React, { useState } from 'react';
import { useFormBuilderContext } from '../../contexts/FormBuilderContext';
import FormFieldRenderer from './FormFieldRenderer';
import Button from '../common/Button';
import { CheckCircle } from '../icons';

const FormPreview: React.FC = () => {
  const { form, fields, steps } = useFormBuilderContext();
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [currentStep, setCurrentStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

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

  const validateField = (field: any) => {
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateCurrentStep()) {
      // In a real app, this would submit to the API
      console.log('Form submitted:', formData);
      setSubmitted(true);
    }
  };

  if (submitted) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {form?.settings?.confirmation?.title || 'Thank You!'}
        </h2>
        <p className="text-gray-600 mb-6">
          {form?.settings?.confirmation?.message || 'Your submission has been received.'}
        </p>
        <Button
          variant="outline"
          onClick={() => {
            setSubmitted(false);
            setFormData({});
            setCurrentStep(0);
          }}
        >
          Submit Another Response
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
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
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
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
                >
                  Next
                </Button>
              ) : (
                <Button type="submit">
                  Submit
                </Button>
              )}
            </>
          ) : (
            <>
              <div />
              <Button type="submit">
                Submit
              </Button>
            </>
          )}
        </div>
      </form>
    </div>
  );
};

export default FormPreview;