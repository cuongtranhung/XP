/**
 * Enhanced Form Builder Complete
 * Simplified version with improved UX features
 */

import React, { useState, useEffect } from 'react';
import { FormBuilderProvider, useFormBuilderContext } from '../../contexts/FormBuilderContext';
import { EnhancedFormCanvas } from './enhanced/EnhancedFormCanvas';
import { EnhancedFormBuilderSidebar } from './enhanced/EnhancedFormBuilderSidebar';
import { DndContext, DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { Save, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface FormBuilderCompleteSimpleProps {
  formId?: string;
}

interface DragState {
  isDragging: boolean;
  activeId: string | null;
  draggedField: any;
}

const FormBuilderContent: React.FC<{ formId?: string }> = ({ formId }) => {
  const { fields, reorderFields, form, saveForm } = useFormBuilderContext();
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    activeId: null,
    draggedField: null
  });

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setDragState({
      isDragging: true,
      activeId: active.id as string,
      draggedField: active.data.current || null
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const activeIndex = fields.findIndex(f => f.id === active.id);
      const overIndex = fields.findIndex(f => f.id === over.id);
      if (activeIndex !== -1 && overIndex !== -1) {
        reorderFields(activeIndex, overIndex);
      }
    }
    setDragState({
      isDragging: false,
      activeId: null,
      draggedField: null
    });
  };

  const handleSave = async () => {
    console.log('[FormBuilderCompleteSimple] handleSave called!');
    console.log('[FormBuilderCompleteSimple] saveForm exists?', !!saveForm);
    console.log('[FormBuilderCompleteSimple] Current form:', form);
    console.log('[FormBuilderCompleteSimple] Current fields count:', fields.length);
    
    setIsSaving(true);
    try {
      if (saveForm) {
        console.log('[FormBuilderCompleteSimple] Calling saveForm...');
        const result = await saveForm();
        // TODO: Replace with toast notification
        console.log('✅ Form saved successfully!', result);
      } else {
        console.error('[FormBuilderCompleteSimple] saveForm method not found in context');
        console.log('❌ saveForm method not found!');
      }
    } catch (error) {
      console.error('Error saving form:', error);
      console.log('❌ Error saving form:', error.message);
    } finally {
      setIsSaving(false);
    }
  };
  
  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="h-full flex flex-col bg-gray-50">
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
                <h2 className="text-xl font-semibold">
                  Enhanced Form Builder
                </h2>
                <p className="text-sm text-gray-500">
                  {formId === 'new' ? 'Create New Form' : 'Edit Form'}
                </p>
              </div>
            </div>
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4 inline-block mr-2" />
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          <div className="w-80 bg-white border-r border-gray-200 overflow-y-auto">
            <EnhancedFormBuilderSidebar />
          </div>

          {/* Canvas */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-4xl mx-auto">
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-medium mb-4">Form Fields</h3>
                {fields && fields.length > 0 ? (
                  <EnhancedFormCanvas 
                    isDragging={dragState.isDragging}
                    activeId={dragState.activeId}
                    draggedField={dragState.draggedField}
                  />
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <p>No fields yet. Drag fields from the sidebar to start building your form.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </DndContext>
  );
};

export const FormBuilderCompleteSimple: React.FC<FormBuilderCompleteSimpleProps> = ({ formId }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [formData, setFormData] = useState<any>(null);
  const [fieldsData, setFieldsData] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      if (formId && formId !== 'new') {
        try {
          // Direct API call to get form data
          const token = localStorage.getItem('token');
          const response = await fetch(`/api/forms/${formId}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (response.ok) {
            const responseData = await response.json();
            // API returns {success: true, data: {...}}
            const data = responseData.data || responseData;
            setFormData(data);
            setFieldsData(data.fields || []);
          }
        } catch (error) {
          console.error('Error loading form:', error);
        }
      }
      
      setIsLoading(false);
    };

    fetchData();
  }, [formId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading form...</p>
        </div>
      </div>
    );
  }

  return (
    <FormBuilderProvider 
      initialForm={formData}
      initialFields={fieldsData}
      initialSteps={[]}
    >
      <FormBuilderContent formId={formId} />
    </FormBuilderProvider>
  );
};

export default FormBuilderCompleteSimple;