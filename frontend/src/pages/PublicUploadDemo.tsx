/**
 * Public Upload Module Demo Page
 * Tests Form Builder file upload integration without authentication
 */

import React, { useState } from 'react';
import DemoFileField from '../components/formBuilder/DemoFileField';
import FormFieldRenderer from '../components/formBuilder/FormFieldRenderer';
import { FormField, FieldType } from '../types/formBuilder';

const PublicUploadDemo: React.FC = () => {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Demo form fields with file upload
  const demoFields: FormField[] = [
    {
      id: '1',
      fieldKey: 'document-upload',
      fieldType: FieldType.File,
      label: 'Document Upload (Test)',
      placeholder: 'Upload your documents for testing',
      position: 1,
      required: false, // Make optional for demo
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
      label: 'Image Upload (Test)',
      placeholder: 'Upload test images',
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
      label: 'Test Name',
      placeholder: 'Enter test name',
      position: 3,
      required: false,
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

  const handleTestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('Demo form data:', formData);
    alert('Demo form submitted! Check console for data. (Note: Files won\'t actually upload without authentication)');
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Public Upload Demo</h1>
            <p className="text-gray-600">
              Testing Form Builder file upload components (UI only - no authentication required)
            </p>
            
            <div className="mt-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
              <h3 className="font-medium text-amber-900 mb-2">⚠️ Demo Mode:</h3>
              <ul className="text-sm text-amber-800 space-y-1">
                <li>• This is a UI-only demo without authentication</li>
                <li>• Files won't actually upload to MEGA S4 storage</li>
                <li>• For full functionality, use <a href="/upload-demo" className="underline font-medium">/upload-demo</a> after login</li>
                <li>• File selection and validation still work normally</li>
              </ul>
            </div>

            <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h3 className="font-medium text-blue-900 mb-2">🧪 Test Features:</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Drag & drop file selection</li>
                <li>• File type validation (images, PDFs, docs)</li>
                <li>• File size validation (10MB for images, 50MB for documents)</li>
                <li>• Multi-file upload support (up to 3 files for documents)</li>
                <li>• Real-time form data tracking</li>
              </ul>
            </div>
          </div>

          <form onSubmit={handleTestSubmit} className="space-y-8">
            {demoFields.map(field => (
              <div key={field.id}>
                {/* Show label for all fields */}
                {field.fieldType !== 'checkbox' && field.fieldType !== 'section' && (
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                )}
                
                {/* Use DemoFileField for file/image types, FormFieldRenderer for others */}
                {(field.fieldType === 'file' || field.fieldType === 'image') ? (
                  <DemoFileField
                    field={field}
                    value={formData[field.fieldKey]}
                    onChange={(value) => handleFieldChange(field.fieldKey, value)}
                    onBlur={() => handleFieldBlur(field.fieldKey)}
                    error={errors[field.fieldKey]}
                    preview={false}
                  />
                ) : (
                  <FormFieldRenderer
                    field={field}
                    value={formData[field.fieldKey]}
                    onChange={(value) => handleFieldChange(field.fieldKey, value)}
                    onBlur={() => handleFieldBlur(field.fieldKey)}
                    error={errors[field.fieldKey]}
                    preview={false}
                  />
                )}
              </div>
            ))}

            <div className="pt-6 border-t border-gray-200">
              <div className="flex justify-between items-center">
                <div className="text-sm text-gray-600">
                  Demo form - UI testing only
                </div>
                <button
                  type="submit"
                  className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                >
                  Test Form Submit
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

          <div className="mt-6 p-4 bg-green-50 rounded-lg border border-green-200">
            <h3 className="font-medium text-green-900 mb-2">🎯 How to Test Full Upload:</h3>
            <ol className="text-sm text-green-800 space-y-1 list-decimal list-inside">
              <li>Go to <a href="/login" className="underline font-medium">Login Page</a></li>
              <li>Create account or login with existing credentials</li>
              <li>Visit <a href="/upload-demo" className="underline font-medium">Full Upload Demo</a></li>
              <li>Test actual file upload to MEGA S4 storage</li>
            </ol>
          </div>

          <div className="mt-6 p-4 bg-gray-100 rounded-lg">
            <h3 className="font-medium text-gray-900 mb-2">🔧 Technical Info:</h3>
            <ul className="text-sm text-gray-700 space-y-1">
              <li>• Component: MegaS4FileField</li>
              <li>• Storage: MEGA S4 (when authenticated)</li>
              <li>• Backend: http://localhost:5000</li>
              <li>• Frontend: http://localhost:3000</li>
              <li>• Form Builder Integration: ✅ Complete</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicUploadDemo;