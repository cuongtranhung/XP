/**
 * Form Builder Sidebar
 * Contains draggable field types organized by category
 */

import React, { memo, useCallback } from 'react';
import { 
  Type, 
  AtSign, 
  Phone, 
  Calendar, 
  FileText,
  List,
  CheckSquare,
  ToggleLeft,
  Upload,
  Star,
  Sliders,
  Code,
  CreditCard,
  MapPin,
  Hash,
  Link,
  Clock,
  Image,
  Pen
} from '../icons';
import { useFormBuilderContext } from '../../contexts/FormBuilderContext';
import { FieldTypeDefinition, FieldCategory, FieldType } from '../../types/formBuilder';

const fieldTypes: FieldTypeDefinition[] = [
  // Basic Fields
  {
    type: 'text' as FieldType,
    label: 'Text Input',
    icon: 'Type',
    category: FieldCategory.Basic,
    description: 'Single line text input'
  },
  {
    type: 'textarea' as FieldType,
    label: 'Text Area',
    icon: 'FileText',
    category: FieldCategory.Basic,
    description: 'Multi-line text input'
  },
  {
    type: 'email' as FieldType,
    label: 'Email',
    icon: 'AtSign',
    category: FieldCategory.Basic,
    description: 'Email address input'
  },
  {
    type: 'number' as FieldType,
    label: 'Number',
    icon: 'Hash',
    category: FieldCategory.Basic,
    description: 'Numeric input'
  },
  {
    type: 'tel' as FieldType,
    label: 'Phone',
    icon: 'Phone',
    category: FieldCategory.Basic,
    description: 'Phone number input'
  },
  {
    type: 'url' as FieldType,
    label: 'URL',
    icon: 'Link',
    category: FieldCategory.Basic,
    description: 'Website URL input'
  },
  {
    type: 'date' as FieldType,
    label: 'Date',
    icon: 'Calendar',
    category: FieldCategory.Basic,
    description: 'Date picker'
  },
  {
    type: 'time' as FieldType,
    label: 'Time',
    icon: 'Clock',
    category: FieldCategory.Basic,
    description: 'Time picker'
  },
  {
    type: 'select' as FieldType,
    label: 'Dropdown',
    icon: 'List',
    category: FieldCategory.Basic,
    description: 'Select from options'
  },
  {
    type: 'radio' as FieldType,
    label: 'Radio Buttons',
    icon: 'ToggleLeft',
    category: FieldCategory.Basic,
    description: 'Single choice selection'
  },
  {
    type: 'checkbox' as FieldType,
    label: 'Checkbox',
    icon: 'CheckSquare',
    category: FieldCategory.Basic,
    description: 'Single checkbox'
  },
  {
    type: 'checkbox_group' as FieldType,
    label: 'Checkbox Group',
    icon: 'CheckSquare',
    category: FieldCategory.Basic,
    description: 'Multiple choice selection'
  },
  // Advanced Fields
  {
    type: 'file' as FieldType,
    label: 'File Upload',
    icon: 'Upload',
    category: FieldCategory.Advanced,
    description: 'Upload files'
  },
  {
    type: 'image' as FieldType,
    label: 'Image Upload',
    icon: 'Image',
    category: FieldCategory.Advanced,
    description: 'Upload images'
  },
  {
    type: 'rating' as FieldType,
    label: 'Rating',
    icon: 'Star',
    category: FieldCategory.Advanced,
    description: 'Star rating input'
  },
  {
    type: 'range' as FieldType,
    label: 'Range Slider',
    icon: 'Sliders',
    category: FieldCategory.Advanced,
    description: 'Numeric range slider'
  },
  {
    type: 'signature' as FieldType,
    label: 'Signature',
    icon: 'Pen',
    category: FieldCategory.Advanced,
    description: 'Digital signature pad'
  },
  {
    type: 'address' as FieldType,
    label: 'Address',
    icon: 'MapPin',
    category: FieldCategory.Advanced,
    description: 'Complete address input'
  },
  // Layout Fields
  {
    type: 'section' as FieldType,
    label: 'Section',
    icon: 'FileText',
    category: FieldCategory.Layout,
    description: 'Section divider'
  },
  {
    type: 'html' as FieldType,
    label: 'HTML Block',
    icon: 'Code',
    category: FieldCategory.Layout,
    description: 'Custom HTML content'
  },
  // Payment Fields
  {
    type: 'payment' as FieldType,
    label: 'Payment',
    icon: 'CreditCard',
    category: FieldCategory.Payment,
    description: 'Payment collection'
  }
];

const iconComponents: Record<string, React.FC<{ className?: string }>> = {
  Type,
  AtSign,
  Phone,
  Calendar,
  FileText,
  List,
  CheckSquare,
  ToggleLeft,
  Upload,
  Star,
  Sliders,
  Code,
  CreditCard,
  MapPin,
  Hash,
  Link,
  Clock,
  Image,
  Pen
};

const categoryLabels: Record<FieldCategory, string> = {
  basic: 'Basic Fields',
  advanced: 'Advanced Fields',
  layout: 'Layout',
  payment: 'Payment'
};

const FormBuilderSidebar: React.FC = memo(() => {
  const { setDraggedField, setIsDragging, addField } = useFormBuilderContext();

  const handleDragStart = useCallback((e: React.DragEvent, fieldType: FieldTypeDefinition) => {
    console.log('Drag started:', fieldType.type);
    e.dataTransfer.effectAllowed = 'copy';
    // Set data in multiple formats for better compatibility
    e.dataTransfer.setData('fieldType', fieldType.type);
    e.dataTransfer.setData('text/plain', fieldType.type);
    e.dataTransfer.setData('text', fieldType.type);
    e.dataTransfer.setData('application/json', JSON.stringify(fieldType));
    console.log('DataTransfer set with fieldType:', fieldType.type);
    setDraggedField(fieldType);
    setIsDragging(true);
  }, [setDraggedField, setIsDragging]);

  const handleDragEnd = useCallback(() => {
    console.log('Drag ended');
    setDraggedField(undefined);
    setIsDragging(false);
  }, [setDraggedField, setIsDragging]);

  const handleClick = useCallback((fieldType: FieldTypeDefinition) => {
    console.log('Field clicked:', fieldType.type);
    // Add field at the end when clicked (for testing convenience)
    addField(fieldType.type as any);
  }, [addField]);

  const renderFieldsByCategory = useCallback((category: FieldCategory) => {
    const categoryFields = fieldTypes.filter(field => field.category === category);
    
    if (categoryFields.length === 0) return null;

    return (
      <div key={category} className="mb-6">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-4">
          {categoryLabels[category]}
        </h3>
        <div className="space-y-1 px-2">
          {categoryFields.map(fieldType => {
            const IconComponent = iconComponents[fieldType.icon];
            
            return (
              <div
                key={fieldType.type}
                draggable
                onDragStart={(e) => handleDragStart(e, fieldType)}
                onDragEnd={handleDragEnd}
                onClick={() => handleClick(fieldType)}
                className="flex items-center p-3 bg-white rounded-lg border border-gray-200 cursor-move hover:border-blue-300 hover:shadow-sm transition-all duration-200 group"
              >
                <div className="flex-shrink-0 w-8 h-8 bg-gray-50 rounded-md flex items-center justify-center group-hover:bg-blue-50 transition-colors">
                  {IconComponent && (
                    <IconComponent className="w-4 h-4 text-gray-600 group-hover:text-blue-600" />
                  )}
                </div>
                <div className="ml-3 flex-1">
                  <p className="text-sm font-medium text-gray-900">{fieldType.label}</p>
                  <p className="text-xs text-gray-500">{fieldType.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }, [handleDragStart, handleDragEnd, handleClick]);

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Form Elements</h2>
        <p className="text-sm text-gray-500 mt-1">Drag and drop to add fields</p>
      </div>
      
      <div className="py-4">
        {(['basic', 'advanced', 'layout', 'payment'] as FieldCategory[]).map(category =>
          renderFieldsByCategory(category)
        )}
      </div>
    </div>
  );
});

FormBuilderSidebar.displayName = 'FormBuilderSidebar';

export default FormBuilderSidebar;