/**
 * Form Builder MEGA S4 Integration Test Component
 * Tests MEGA S4 file uploads in Form Builder context
 */

import React, { useState, useCallback } from 'react';
import { FormField, FieldType } from '../types/formBuilder';
import FormFieldRenderer from './formBuilder/FormFieldRenderer';
import axios from 'axios';

const FormBuilderMegaS4Test: React.FC = () => {
  const [authToken, setAuthToken] = useState<string>('');
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Mock form fields with file upload
  const formFields: FormField[] = [
    {
      id: '1',
      fieldKey: 'name',
      fieldType: FieldType.Text,
      label: 'Full Name',
      placeholder: 'Enter your full name',
      position: 1,
      required: true,
      hidden: false
    },
    {
      id: '2',
      fieldKey: 'email',
      fieldType: FieldType.Email,
      label: 'Email Address',
      placeholder: 'Enter your email',
      position: 2,
      required: true,
      hidden: false
    },
    {
      id: '3',
      fieldKey: 'profile-photo',
      fieldType: FieldType.Image,
      label: 'Profile Photo',
      placeholder: 'Upload your profile photo',
      position: 3,
      required: false,
      hidden: false,
      validation: {
        maxSize: 5 * 1024 * 1024, // 5MB
        max: 1 // Single file only
      }
    },
    {
      id: '4',
      fieldKey: 'documents',
      fieldType: FieldType.File,
      label: 'Supporting Documents',
      placeholder: 'Upload supporting documents',
      position: 4,
      required: false,
      hidden: false,
      validation: {
        maxSize: 10 * 1024 * 1024, // 10MB
        max: 3 // Multiple files allowed
      }
    },
    {
      id: '5',
      fieldKey: 'bio',
      fieldType: FieldType.Textarea,
      label: 'Bio',
      placeholder: 'Tell us about yourself',
      position: 5,
      required: false,
      hidden: false
    }
  ];

  // Get authentication token
  const getAuthToken = async () => {
    try {
      const response = await axios.post('http://localhost:5000/api/auth/test-login', {
        email: 'cuongtranhung@gmail.com',
        password: '@Abcd6789'
      });
      
      if (response.data.success) {
        setAuthToken(response.data.token);
        return response.data.token;
      }
    } catch (error) {
      console.error('Auth failed:', error);
      return null;
    }
  };

  const handleFieldChange = useCallback((fieldKey: string, value: any) => {
    setFormValues(prev => ({
      ...prev,
      [fieldKey]: value
    }));

    // Clear error when field is updated
    if (errors[fieldKey]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldKey];
        return newErrors;
      });
    }
  }, [errors]);

  const handleFieldBlur = useCallback((fieldKey: string) => {
    // Validation logic can be added here
    const field = formFields.find(f => f.fieldKey === fieldKey);
    if (field?.required && !formValues[fieldKey]) {
      setErrors(prev => ({
        ...prev,
        [fieldKey]: `${field.label} is required`
      }));
    }
  }, [formValues, formFields]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    const newErrors: Record<string, string> = {};
    
    formFields.forEach(field => {
      if (field.required && !formValues[field.fieldKey]) {
        newErrors[field.fieldKey] = `${field.label} is required`;
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    console.log('📝 Form submitted with values:', formValues);
    
    // Here you would typically submit to your form submission API
    alert('Form submitted successfully! Check console for values.');
  };

  const getFieldValue = (fieldKey: string) => {
    return formValues[fieldKey];
  };

  const getFieldError = (fieldKey: string) => {
    return errors[fieldKey];
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900">
            🧪 Form Builder + MEGA S4 Integration Test
          </h1>
          <p className="text-gray-600 mt-1">
            Test file uploads in Form Builder with MEGA S4 storage
          </p>
        </div>

        <div className="p-6">
          {/* Authentication Status */}
          <div className="mb-6 p-4 rounded-lg bg-blue-50 border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-900">
                  Auth Status: {authToken ? '✅ Authenticated' : '❌ Not authenticated'}
                </p>
                {authToken && (
                  <p className="text-xs text-blue-700 mt-1">
                    Token: {authToken.substring(0, 20)}...
                  </p>
                )}
              </div>
              {!authToken && (
                <button
                  onClick={getAuthToken}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                >
                  Get Auth Token
                </button>
              )}
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {formFields.map((field) => (
              <div key={field.id}>
                <FormFieldRenderer
                  field={field}
                  value={getFieldValue(field.fieldKey)}
                  onChange={(value) => handleFieldChange(field.fieldKey, value)}
                  onBlur={() => handleFieldBlur(field.fieldKey)}
                  error={getFieldError(field.fieldKey)}
                  preview={false}
                  authToken={authToken}
                />
              </div>
            ))}

            <div className="pt-6 border-t border-gray-200">
              <button
                type="submit"
                className="w-full px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
              >
                Submit Form
              </button>
            </div>
          </form>

          {/* Form Values Debug */}
          <div className="mt-8 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              📊 Current Form Values
            </h3>
            <pre className="text-sm text-gray-700 overflow-auto">
              {JSON.stringify(formValues, null, 2)}
            </pre>
          </div>

          {/* Integration Info */}
          <div className="mt-6 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
            <h3 className="text-lg font-semibold text-emerald-900 mb-2">
              🔗 Integration Features
            </h3>
            <ul className="text-sm text-emerald-700 space-y-1">
              <li>✅ MEGA S4 Object Storage integration</li>
              <li>✅ Form Builder field renderer compatibility</li>
              <li>✅ File type validation (images, documents, etc.)</li>
              <li>✅ File size validation with custom limits</li>
              <li>✅ Multiple file upload support</li>
              <li>✅ Real-time upload progress</li>
              <li>✅ Authentication token handling</li>
              <li>✅ Database persistence</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FormBuilderMegaS4Test;