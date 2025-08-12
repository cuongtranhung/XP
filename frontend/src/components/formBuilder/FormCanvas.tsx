/**
 * Form Canvas
 * Main canvas area where form fields are dropped and arranged
 */

import React, { useState, memo } from 'react';
import { useFormContext } from 'react-hook-form';
import { Trash2, Copy, GripVertical } from '../icons';
import { useFormBuilderContext } from '../../contexts/FormBuilderContext';
import FieldPropertiesPanel from './FieldPropertiesPanel';
import FormFieldRenderer from './FormFieldRenderer';
import Input from '../common/Input';
import { FormField } from '../../types/formBuilder';

const FormCanvas: React.FC = memo(() => {
  const formContext = useFormContext();
  const {
    fields,
    selectedField,
    isDragging,
    addField,
    updateField,
    deleteField,
    selectField,
    reorderFields
  } = useFormBuilderContext();
  
  // Safely use form context
  const register = formContext?.register || (() => ({}));
  // const watch = formContext?.watch || (() => undefined);

  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [draggingFieldIndex, setDraggingFieldIndex] = useState<number | null>(null);

  // Form metadata (watching for potential future use)
  // const formName = watch('name');
  // const formDescription = watch('description');

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Drag over:', index);
    // Set dropEffect to copy to allow drop
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('[FormCanvas] Drop event triggered at index:', dropIndex);
    console.log('[FormCanvas] Current fields count:', fields.length);
    console.log('[FormCanvas] DataTransfer types:', e.dataTransfer.types);
    
    // Try to get fieldType from different possible keys
    const fieldType = e.dataTransfer.getData('fieldType') || 
                     e.dataTransfer.getData('text/plain') ||
                     e.dataTransfer.getData('text');
    console.log('[FormCanvas] Field type from dataTransfer:', fieldType);
    
    // Also try to get JSON data
    const jsonData = e.dataTransfer.getData('application/json');
    if (jsonData) {
      console.log('[FormCanvas] JSON data:', jsonData);
    }
    
    if (fieldType && fieldType !== '') {
      // Adding new field from sidebar
      console.log('[FormCanvas] Adding field:', fieldType, 'at position:', dropIndex);
      console.log('[FormCanvas] Before addField - fields:', fields);
      addField(fieldType as any, dropIndex);
      console.log('[FormCanvas] After addField call');
    } else if (draggingFieldIndex !== null && draggingFieldIndex !== dropIndex) {
      // Reordering existing fields
      console.log('[FormCanvas] Reordering fields from', draggingFieldIndex, 'to', dropIndex);
      reorderFields(draggingFieldIndex, dropIndex);
    } else {
      console.log('[FormCanvas] No valid drop data found');
    }
    
    setDragOverIndex(null);
    setDraggingFieldIndex(null);
  };

  const handleFieldDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.effectAllowed = 'move';
    setDraggingFieldIndex(index);
  };

  const handleFieldDragEnd = () => {
    setDraggingFieldIndex(null);
    setDragOverIndex(null);
  };

  const handleFieldClick = (field: FormField) => {
    selectField(field);
  };

  const handleDuplicateField = (field: FormField) => {
    // Simply add a new field at the next position
    // The addField function in context will generate unique id and fieldKey
    console.log('Duplicating field:', field.fieldType, 'at position:', field.position + 1);
    addField(field.fieldType, field.position + 1);
    
    // Optionally update the label after adding
    setTimeout(() => {
      const allFields = [...fields].sort((a, b) => a.position - b.position);
      const newField = allFields[field.position + 1];
      if (newField) {
        updateField(newField.id, {
          label: `${field.label} (Copy)`
        });
      }
    }, 100);
  };

  const renderDropZone = (index: number) => {
    const isActive = dragOverIndex === index;
    
    return (
      <div
        className={`relative transition-all duration-200 ${
          isActive ? 'h-20 my-2' : 'h-2'
        } ${isDragging ? 'h-4' : ''}`}
        onDragOver={(e) => handleDragOver(e, index)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, index)}
      >
        {(isActive || isDragging) && (
          <div className={`absolute inset-0 border-2 border-dashed ${
            isActive ? 'border-blue-400 bg-blue-50' : 'border-gray-300 bg-gray-50'
          } rounded-lg flex items-center justify-center`}>
            <p className={`text-sm ${isActive ? 'text-blue-600' : 'text-gray-400'}`}>
              {isActive ? 'Drop field here' : ''}
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-full">
      <div 
        className="flex-1 overflow-y-auto"
        onDragOver={(e) => {
          e.preventDefault();
          if (e.dataTransfer) {
            e.dataTransfer.dropEffect = 'copy';
          }
        }}
        onDrop={(e) => {
          // Fallback drop handler for the main canvas
          if (fields.length === 0 && dragOverIndex === null) {
            e.preventDefault();
            e.stopPropagation();
            console.log('[FormCanvas] Main canvas fallback drop');
            handleDrop(e, 0);
          }
        }}
      >
        <div className="max-w-3xl mx-auto p-8">
          {/* Form Header */}
          <div className="mb-8">
            <Input
              {...register('name')}
              placeholder="Form Name"
              className="text-2xl font-bold border-0 border-b-2 rounded-none px-0 focus:ring-0 focus:border-blue-500"
            />
            <Input
              {...register('description')}
              placeholder="Form Description (optional)"
              className="mt-2 border-0 border-b rounded-none px-0 focus:ring-0 focus:border-blue-500"
            />
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            {renderDropZone(0)}
            
            {fields.length === 0 ? (
              <div 
                className={`py-12 text-center border-2 border-dashed rounded-lg transition-all ${
                  dragOverIndex === 0 ? 'border-blue-400 bg-blue-50' : 'border-gray-300'
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleDragOver(e, 0);
                }}
                onDragLeave={handleDragLeave}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('[FormCanvas] Empty canvas drop event');
                  handleDrop(e, 0);
                }}
              >
                <p className="text-gray-500">
                  {dragOverIndex === 0 ? 'Drop field here' : 'Drag and drop fields from the left sidebar to start building your form'}
                </p>
              </div>
            ) : (
              fields.map((field, index) => (
                <div key={field.id}>
                  <div
                    className={`relative group ${
                      selectedField?.id === field.id
                        ? 'ring-2 ring-blue-500 rounded-lg'
                        : ''
                    }`}
                    onClick={() => handleFieldClick(field)}
                    draggable
                    onDragStart={(e) => handleFieldDragStart(e, index)}
                    onDragEnd={handleFieldDragEnd}
                  >
                    {/* Field Actions */}
                    <div className="absolute -left-10 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity cursor-move">
                      <GripVertical className="w-5 h-5 text-gray-400" />
                    </div>
                    
                    <div className="absolute -right-2 -top-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      <div className="flex items-center space-x-1 bg-white rounded-lg shadow-md border border-gray-200 p-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDuplicateField(field);
                          }}
                          className="p-1 hover:bg-gray-100 rounded"
                          title="Duplicate field"
                        >
                          <Copy className="w-4 h-4 text-gray-600" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteField(field.id);
                          }}
                          className="p-1 hover:bg-red-50 rounded"
                          title="Delete field"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      </div>
                    </div>

                    {/* Field Preview */}
                    <div className="bg-white p-4 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors cursor-pointer">
                      <FormFieldRenderer field={field} preview />
                    </div>
                  </div>
                  
                  {renderDropZone(index + 1)}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Properties Panel */}
      {selectedField && (
        <div className="w-96 border-l border-gray-200 bg-white overflow-y-auto">
          <FieldPropertiesPanel
            field={selectedField}
            onUpdate={(updates) => updateField(selectedField.id, updates)}
            onClose={() => selectField(undefined)}
          />
        </div>
      )}
    </div>
  );
});

FormCanvas.displayName = 'FormCanvas';

export default FormCanvas;