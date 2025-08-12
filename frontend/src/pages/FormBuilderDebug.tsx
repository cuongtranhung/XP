/**
 * Debug version of Form Builder - simplest possible implementation
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';

const FormBuilderDebug: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('[FormBuilderDebug] Component mounted with ID:', id);
    
    const loadForm = async () => {
      if (!id || id === 'new') {
        console.log('[FormBuilderDebug] New form, skipping load');
        setLoading(false);
        return;
      }

      try {
        const token = localStorage.getItem('token');
        console.log('[FormBuilderDebug] Loading form from API:', `/api/forms/${id}`);
        
        const response = await fetch(`/api/forms/${id}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        console.log('[FormBuilderDebug] Response status:', response.status);

        if (response.ok) {
          const data = await response.json();
          console.log('[FormBuilderDebug] Form data loaded:', data);
          console.log('[FormBuilderDebug] Fields count:', data.fields?.length);
          console.log('[FormBuilderDebug] Fields:', data.fields);
          setFormData(data);
        } else {
          setError(`Failed to load form: ${response.status}`);
        }
      } catch (err) {
        console.error('[FormBuilderDebug] Error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadForm();
  }, [id]);

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/forms')}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-semibold">
                Form Builder Debug
              </h1>
              <p className="text-sm text-gray-500">
                ID: {id || 'new'} | Status: {loading ? 'Loading...' : 'Ready'}
              </p>
            </div>
          </div>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Save className="w-4 h-4 inline-block mr-2" />
            Save
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading form data...</p>
            </div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="text-red-800 font-semibold">Error</h3>
            <p className="text-red-600">{error}</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4">
              Form: {formData?.name || 'Untitled Form'}
            </h2>
            
            <div className="mb-6">
              <h3 className="text-md font-medium mb-2">Form Details:</h3>
              <div className="bg-gray-50 rounded p-3 text-sm">
                <p><strong>ID:</strong> {formData?.id || 'N/A'}</p>
                <p><strong>Name:</strong> {formData?.name || 'N/A'}</p>
                <p><strong>Slug:</strong> {formData?.slug || 'N/A'}</p>
                <p><strong>Status:</strong> {formData?.status || 'N/A'}</p>
                <p><strong>Fields Count:</strong> {formData?.fields?.length || 0}</p>
              </div>
            </div>

            <div>
              <h3 className="text-md font-medium mb-2">Fields:</h3>
              {formData?.fields && formData.fields.length > 0 ? (
                <div className="space-y-2">
                  {formData.fields.map((field: any, index: number) => (
                    <div key={field.id || index} className="bg-gray-50 rounded p-3">
                      <p className="font-medium">{index + 1}. {field.label || 'Unnamed Field'}</p>
                      <p className="text-sm text-gray-600">
                        Type: {field.fieldType || field.type} | 
                        Key: {field.fieldKey} | 
                        Required: {field.required ? 'Yes' : 'No'}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No fields found</p>
              )}
            </div>

            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded">
              <h4 className="font-medium text-yellow-800 mb-2">Debug Info:</h4>
              <pre className="text-xs overflow-auto">
                {JSON.stringify({ id, formData }, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FormBuilderDebug;