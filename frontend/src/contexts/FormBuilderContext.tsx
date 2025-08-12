/**
 * Form Builder Context
 * Manages state and actions for the form builder interface
 */

import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  Form,
  FormField,
  FormStep,
  FieldType,
  FieldTypeDefinition,
  FormBuilderContextType,
  FormSettings
} from '../types/formBuilder';

const FormBuilderContext = createContext<FormBuilderContextType | undefined>(undefined);

export const useFormBuilderContext = () => {
  const context = useContext(FormBuilderContext);
  if (!context) {
    throw new Error('useFormBuilderContext must be used within FormBuilderProvider');
  }
  return context;
};

interface FormBuilderProviderProps {
  children: ReactNode;
  initialForm?: Form;
  initialFields?: FormField[];
  initialSteps?: FormStep[];
}

export const FormBuilderProvider: React.FC<FormBuilderProviderProps> = ({
  children,
  initialForm,
  initialFields = [],
  initialSteps = []
}) => {
  console.log('[FormBuilderProvider] Initializing with:', {
    formId: initialForm?.id,
    fieldsCount: initialFields.length,
    stepsCount: initialSteps.length,
    initialFields: initialFields,
    formName: initialForm?.name
  });
  
  const [form, setForm] = useState<Form | undefined>(initialForm);
  const [fields, setFields] = useState<FormField[]>(initialFields);
  const [steps, setSteps] = useState<FormStep[]>(initialSteps);
  const [selectedField, setSelectedField] = useState<FormField | undefined>();
  const [selectedStep, setSelectedStep] = useState<FormStep | undefined>();
  const [draggedField, setDraggedField] = useState<FieldTypeDefinition | undefined>();
  const [isDragging, setIsDragging] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [formSettings, setFormSettings] = useState<FormSettings>(initialForm?.settings || {
    id: initialForm?.id || 'default',
    title: initialForm?.name || 'Untitled Form',
    description: initialForm?.description || '',
    theme: 'default',
    multiPage: false
  });

  // Field management
  const addField = useCallback((fieldTypeOrField: FieldType | FormField, position?: number) => {
    console.log('[FormBuilderContext] addField called:', { fieldTypeOrField, position });
    
    setFields(prevFields => {
      console.log('[FormBuilderContext] Previous fields:', prevFields);
      
      let newField: FormField;
      
      if (typeof fieldTypeOrField === 'string') {
        // Creating from FieldType
        const fieldType = fieldTypeOrField as FieldType;
        newField = {
          id: uuidv4(),
          fieldKey: `field_${Date.now()}`,
          fieldType,
          label: `New ${fieldType} field`,
          placeholder: '',
          position: position ?? prevFields.length,
          required: false,
          hidden: false,
          validation: undefined, // Don't send empty object
          options: fieldType === 'select' || fieldType === 'radio' || fieldType === 'checkbox_group' 
            ? [
                { label: 'Option 1', value: 'option1' },
                { label: 'Option 2', value: 'option2' },
                { label: 'Option 3', value: 'option3' }
              ]
            : undefined
        };
      } else {
        // Using provided FormField
        newField = { ...fieldTypeOrField, position: position ?? prevFields.length };
      }

      console.log('[FormBuilderContext] New field created:', newField);
      
      const updatedFields = [...prevFields];
      
      // Insert at specific position or append
      if (position !== undefined && position >= 0 && position <= updatedFields.length) {
        // Update positions of existing fields
        updatedFields.forEach(field => {
          if (field.position >= position) {
            field.position += 1;
          }
        });
        updatedFields.splice(position, 0, newField);
      } else {
        updatedFields.push(newField);
      }

      const sortedFields = updatedFields.sort((a, b) => a.position - b.position);
      console.log('[FormBuilderContext] Updated fields:', sortedFields);
      
      // Auto-select the new field after state update
      setTimeout(() => setSelectedField(newField), 0);
      
      return sortedFields;
    });
  }, []);

  const updateField = useCallback((fieldId: string, updates: Partial<FormField>) => {
    setFields(prevFields =>
      prevFields.map(field =>
        field.id === fieldId ? { ...field, ...updates } : field
      )
    );

    // Update selected field if it's the one being updated
    if (selectedField?.id === fieldId) {
      setSelectedField(prev => prev ? { ...prev, ...updates } : undefined);
    }
  }, [selectedField]);

  const deleteField = useCallback((fieldId: string) => {
    setFields(prevFields => {
      const deletedField = prevFields.find(f => f.id === fieldId);
      if (!deletedField) return prevFields;

      // Update positions of remaining fields
      return prevFields
        .filter(field => field.id !== fieldId)
        .map(field => ({
          ...field,
          position: field.position > deletedField.position ? field.position - 1 : field.position
        }))
        .sort((a, b) => a.position - b.position);
    });

    // Clear selection if deleted field was selected
    if (selectedField?.id === fieldId) {
      setSelectedField(undefined);
    }
  }, [selectedField]);

  const selectField = useCallback((field: FormField | undefined) => {
    setSelectedField(field);
    setSelectedStep(undefined); // Clear step selection
  }, []);

  const reorderFields = useCallback((dragIndex: number, dropIndex: number) => {
    if (dragIndex === dropIndex) return;

    setFields(prevFields => {
      const reorderedFields = [...prevFields];
      const [draggedField] = reorderedFields.splice(dragIndex, 1);
      if (draggedField) {
        reorderedFields.splice(dropIndex, 0, draggedField);
      }

      // Update positions
      return reorderedFields.map((field, index) => ({
        ...field,
        position: index
      }));
    });
  }, []);

  // Step management
  const addStep = useCallback((stepData: Omit<FormStep, 'id'>) => {
    const newStep: FormStep = {
      ...stepData,
      id: uuidv4(),
      position: stepData.position ?? steps.length,
      fields: []
    };

    setSteps(prevSteps => [...prevSteps, newStep].sort((a, b) => a.position - b.position));
    setSelectedStep(newStep);
  }, [steps.length]);

  const updateStep = useCallback((stepId: string, updates: Partial<FormStep>) => {
    setSteps(prevSteps =>
      prevSteps.map(step =>
        step.id === stepId ? { ...step, ...updates } : step
      )
    );

    if (selectedStep?.id === stepId) {
      setSelectedStep(prev => prev ? { ...prev, ...updates } : undefined);
    }
  }, [selectedStep]);

  const deleteStep = useCallback((stepId: string) => {
    setSteps(prevSteps => {
      const deletedStep = prevSteps.find(s => s.id === stepId);
      if (!deletedStep) return prevSteps;

      // Move fields from deleted step to no step
      setFields(prevFields =>
        prevFields.map(field =>
          field.stepId === stepId ? { ...field, stepId: undefined } : field
        )
      );

      // Update positions of remaining steps
      return prevSteps
        .filter(step => step.id !== stepId)
        .map(step => ({
          ...step,
          position: step.position > deletedStep.position ? step.position - 1 : step.position
        }))
        .sort((a, b) => a.position - b.position);
    });

    if (selectedStep?.id === stepId) {
      setSelectedStep(undefined);
    }
  }, [selectedStep]);

  const selectStep = useCallback((step: FormStep | undefined) => {
    setSelectedStep(step);
    setSelectedField(undefined); // Clear field selection
  }, []);

  // Additional methods for collaboration
  const updateForm = useCallback((updates: Partial<Form>) => {
    setForm(prev => prev ? { ...prev, ...updates } : undefined);
  }, []);

  const updateFormSettings = useCallback((updates: Partial<FormSettings>) => {
    setFormSettings(prev => ({ ...prev, ...updates }));
  }, []);

  const addFieldAtPosition = useCallback((field: FormField, position: number) => {
    setFields(prevFields => {
      const newFields = [...prevFields];
      newFields.splice(position, 0, field);
      return newFields.map((f, index) => ({ ...f, position: index }));
    });
  }, []);

  // Method to set all fields (used when loading form)
  const setAllFields = useCallback((newFields: FormField[]) => {
    console.log('[FormBuilderContext] setAllFields called with:', newFields);
    setFields(newFields);
  }, []);

  // Save form method
  const saveForm = useCallback(async () => {
    if (!form?.id) {
      console.error('[FormBuilderContext] Cannot save form: no form ID');
      // TODO: Replace with toast notification
      console.log('❌ Error: No form ID found!');
      return;
    }

    try {
      console.log('[FormBuilderContext] Saving form...', { formId: form.id, fieldsCount: fields.length });
      
      // Import formService instead of apiService
      const { updateForm } = await import('../services/formService');
      
      const updateData = {
        title: form.name,
        description: form.description,
        fields: fields
      };
      
      console.log('[FormBuilderContext] Calling updateForm...', updateData);
      await updateForm(form.id, updateData);
      
      console.log('[FormBuilderContext] Form saved successfully!');
      // TODO: Replace with toast notification
      console.log('✅ Form saved successfully!');
      
      // Note: formService.updateForm doesn't return data, just void
      // So we keep the current form state as is
      
      return { success: true }; // Return success indicator for UI
      
    } catch (error) {
      console.error('[FormBuilderContext] Error saving form:', error);
      // TODO: Replace with toast notification
      console.log('❌ Error saving form:', error.message);
      throw error;
    }
  }, [form, fields]);

  const value: FormBuilderContextType = useMemo(() => ({
    form,
    fields,
    steps,
    selectedField,
    selectedStep,
    draggedField,
    isDragging,
    isPreviewMode,
    formSettings,
    addField,
    updateField,
    deleteField,
    selectField,
    reorderFields,
    addStep,
    updateStep,
    deleteStep,
    selectStep,
    setDraggedField,
    setIsDragging,
    setIsPreviewMode,
    updateForm,
    updateFormSettings,
    addFieldAtPosition,
    setAllFields,
    saveForm
  }), [
    form,
    fields,
    steps,
    selectedField,
    selectedStep,
    draggedField,
    isDragging,
    isPreviewMode,
    formSettings,
    addField,
    updateField,
    deleteField,
    selectField,
    reorderFields,
    addStep,
    updateStep,
    deleteStep,
    selectStep,
    setDraggedField,
    setIsDragging,
    setIsPreviewMode,
    updateForm,
    updateFormSettings,
    addFieldAtPosition,
    setAllFields,
    saveForm
  ]);

  return (
    <FormBuilderContext.Provider value={value}>
      {children}
    </FormBuilderContext.Provider>
  );
};