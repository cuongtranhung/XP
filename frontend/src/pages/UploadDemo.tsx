/**
 * Upload Module Demo Page
 * Tests complete Form Builder file upload integration
 */

import React, { useState } from 'react';
import FormFieldRenderer from '../components/formBuilder/FormFieldRenderer';
import { FormField, FieldType } from '../types/formBuilder';
import { useAuth } from '../contexts/AuthContext';

const UploadDemo: React.FC = () => {
  const { user } = useAuth();
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Demo form fields with file upload
  const demoFields: FormField[] = [
    {
      id: '1',
      fieldKey: 'document-upload',
      fieldType: FieldType.File,
      label: 'Document Upload',
      placeholder: 'Upload your documents',
      position: 1,
      required: true,
      hidden: false,
      validation: {
        maxSize: 50 * 1024 * 1024, // 50MB
        max: 3, // Max 3 files
        messages: {
          required: 'Please upload at least one document'
        }
      }
    },
    {
      id: '2',
      fieldKey: 'profile-image',
      fieldType: FieldType.Image,
      label: 'Profile Image',
      placeholder: 'Upload your profile picture',
      position: 2,
      required: false,
      hidden: false,
      validation: {
        maxSize: 10 * 1024 * 1024, // 10MB
        max: 1, // Single image
      }
    },
    {
      id: '3',
      fieldKey: 'user-name',
      fieldType: FieldType.Text,
      label: 'Full Name',
      placeholder: 'Enter your full name',
      position: 3,
      required: true,
      hidden: false
    }
  ];

  const handleFieldChange = (fieldKey: string, value: any) => {
    console.log(`Field ${fieldKey} changed:`, value);
    setFormData(prev => ({
      ...prev,
      [fieldKey]: value
    }));
    
    // Clear error when field is updated
    if (errors[fieldKey]) {
      setErrors(prev => {
        const { [fieldKey]: _, ...rest } = prev;
        return rest;
      });
    }
  };

  const handleFieldBlur = (fieldKey: string) => {
    console.log(`Field ${fieldKey} blurred`);
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    demoFields.forEach(field => {
      if (field.required && !formData[field.fieldKey]) {
        newErrors[field.fieldKey] = field.validation?.messages?.required || `${field.label} is required`;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('Form submission started...');
    
    if (!validateForm()) {
      console.log('Form validation failed');
      return;
    }

    try {
      // In a real form submission, you would:
      // 1. Create form submission record
      // 2. Associate uploaded files with the submission
      // 3. Process other form data

      console.log('Demo form data:', formData);
      
      // Simulate form submission
      const response = await fetch('/api/forms/demo-submission', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          formId: '550e8400-e29b-41d4-a716-446655440000', // Demo form ID
          data: formData
        })
      });

      if (response.ok) {
        alert('Form submitted successfully! Check console for details.');
      } else {
        alert('Form submission failed - this is expected in demo mode');
      }

    } catch (error) {
      console.error('Form submission error:', error);
      alert('Form submission error - this is expected in demo mode');
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Authentication Required</h1>
          <p className="text-gray-600">Please log in to test the upload demo.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Upload Module Demo</h1>
            <p className="text-gray-600">
              Testing complete Form Builder integration with MEGA S4 file uploads
            </p>
            <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h3 className="font-medium text-blue-900 mb-2">🧪 Demo Features:</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• File upload with drag & drop support</li>
                <li>• Image upload with validation</li>
                <li>• MEGA S4 secure storage integration</li>
                <li>• Form field validation and error handling</li>
                <li>• Real-time upload progress and status</li>
              </ul>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {demoFields.map(field => (
              <div key={field.id}>
                <FormFieldRenderer
                  field={field}
                  value={formData[field.fieldKey]}
                  onChange={(value) => handleFieldChange(field.fieldKey, value)}
                  onBlur={() => handleFieldBlur(field.fieldKey)}
                  error={errors[field.fieldKey]}
                  authToken={localStorage.getItem('token') || undefined}
                />
              </div>
            ))}

            <div className="pt-6 border-t border-gray-200">
              <div className="flex justify-between items-center">
                <div className="text-sm text-gray-600">
                  Demo form ID: 550e8400-e29b-41d4-a716-446655440000
                </div>
                <button
                  type="submit"
                  className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                >
                  Submit Demo Form
                </button>
              </div>
            </div>
          </form>

          <div className="mt-8 p-6 bg-gray-50 rounded-lg">
            <h3 className="font-medium text-gray-900 mb-3">📊 Current Form Data:</h3>
            <pre className="text-sm text-gray-700 whitespace-pre-wrap overflow-auto">
              {JSON.stringify(formData, null, 2)}
            </pre>
          </div>

          <div className="mt-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <h3 className="font-medium text-yellow-900 mb-2">⚠️ Demo Notes:</h3>
            <ul className="text-sm text-yellow-800 space-y-1">
              <li>• File uploads work with real MEGA S4 storage</li>
              <li>• Form submission endpoint is simulated for demo purposes</li>
              <li>• Check browser console for detailed upload logs</li>
              <li>• Authentication is required for file uploads</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadDemo;