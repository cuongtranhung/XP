import React, { useState } from 'react';
import { Form, Field, FieldType } from '../../types/formBuilder';

interface FormRendererProps {
  form: Form;
  onSubmit?: (data: Record<string, any>) => void;
  readonly?: boolean;
}

export const FormRenderer: React.FC<FormRendererProps> = ({ 
  form, 
  onSubmit,
  readonly = false 
}) => {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleFieldChange = (fieldKey: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [fieldKey]: value
    }));
    
    // Clear error when field is modified
    if (errors[fieldKey]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldKey];
        return newErrors;
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    form.fields?.forEach(field => {
      const key = field.key || field.fieldKey;
      if (!key) return;
      
      if (field.required && !formData[key]) {
        newErrors[key] = `${field.label} is required`;
      }
      
      // Add more validation based on field type
      if (field.type === FieldType.Email && formData[key]) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData[key] as string)) {
          newErrors[key] = 'Please enter a valid email address';
        }
      }
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateForm() && onSubmit) {
      onSubmit(formData);
    }
  };

  const renderField = (field: Field) => {
    const fieldKey = field.key || field.fieldKey || '';
    const baseClassName = "mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm";
    const errorClassName = errors[fieldKey] ? "border-red-300" : "";
    
    switch (field.type) {
      case FieldType.Text:
      case FieldType.Email:
      case FieldType.Number:
      case FieldType.Tel:
      case FieldType.Url:
        return (
          <input
            type={field.type}
            id={fieldKey}
            name={fieldKey}
            value={formData[fieldKey] || ''}
            onChange={(e) => handleFieldChange(fieldKey, e.target.value)}
            disabled={readonly}
            required={field.required}
            placeholder={field.placeholder}
            className={`${baseClassName} ${errorClassName}`}
          />
        );
        
      case FieldType.Textarea:
        return (
          <textarea
            id={fieldKey}
            name={fieldKey}
            value={formData[fieldKey] || ''}
            onChange={(e) => handleFieldChange(fieldKey, e.target.value)}
            disabled={readonly}
            required={field.required}
            placeholder={field.placeholder}
            rows={4}
            className={`${baseClassName} ${errorClassName}`}
          />
        );
        
      case FieldType.Select:
      case FieldType.Dropdown:
        return (
          <select
            id={fieldKey}
            name={fieldKey}
            value={formData[fieldKey] || ''}
            onChange={(e) => handleFieldChange(fieldKey, e.target.value)}
            disabled={readonly}
            required={field.required}
            className={`${baseClassName} ${errorClassName}`}
          >
            <option value="">Select an option</option>
            {field.options?.map((option: any, index: number) => {
              const optionValue = typeof option === 'string' ? option : option.value;
              const optionLabel = typeof option === 'string' ? option : option.label;
              return (
                <option key={optionValue || index} value={optionValue}>
                  {optionLabel}
                </option>
              );
            })}
          </select>
        );
        
      case FieldType.Checkbox:
        return (
          <div className="flex items-center">
            <input
              type="checkbox"
              id={fieldKey}
              name={fieldKey}
              checked={formData[fieldKey] || false}
              onChange={(e) => handleFieldChange(fieldKey, e.target.checked)}
              disabled={readonly}
              required={field.required}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            {field.label && (
              <label htmlFor={fieldKey} className="ml-2 block text-sm text-gray-900">
                {field.label}
              </label>
            )}
          </div>
        );
        
      case FieldType.Radio:
        return (
          <div className="space-y-2">
            {field.options?.map((option: any, index: number) => {
              const optionValue = typeof option === 'string' ? option : option.value;
              const optionLabel = typeof option === 'string' ? option : option.label;
              return (
                <div key={optionValue || index} className="flex items-center">
                  <input
                    type="radio"
                    id={`${fieldKey}-${optionValue}`}
                    name={fieldKey}
                    value={optionValue}
                    checked={formData[fieldKey] === optionValue}
                    onChange={(e) => handleFieldChange(fieldKey, e.target.value)}
                    disabled={readonly}
                    required={field.required}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <label 
                    htmlFor={`${fieldKey}-${optionValue}`} 
                    className="ml-2 block text-sm text-gray-900"
                  >
                    {optionLabel}
                  </label>
                </div>
              );
            })}
          </div>
        );
        
      default:
        return (
          <div className="text-sm text-gray-500">
            Unsupported field type: {field.type}
          </div>
        );
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            {form.title}
          </h3>
          {form.description && (
            <p className="mt-1 text-sm text-gray-600">
              {form.description}
            </p>
          )}
          
          <div className="mt-6 space-y-6">
            {form.fields?.map(field => {
              const fieldKey = field.key || field.fieldKey || '';
              return (
              <div key={field.id || fieldKey}>
                {field.type !== FieldType.Checkbox && field.label && (
                  <label htmlFor={fieldKey} className="block text-sm font-medium text-gray-700">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                )}
                {renderField(field)}
                {field.helpText && (
                  <p className="mt-1 text-sm text-gray-500">{field.helpText}</p>
                )}
                {errors[fieldKey] && (
                  <p className="mt-1 text-sm text-red-600">{errors[fieldKey]}</p>
                )}
              </div>
              );
            })}
          </div>
        </div>
        
        {!readonly && onSubmit && (
          <div className="px-4 py-3 bg-gray-50 text-right sm:px-6">
            <button
              type="submit"
              className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Submit
            </button>
          </div>
        )}
      </div>
    </form>
  );
};

export default FormRenderer;