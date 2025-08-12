import React from 'react';
import { FormBuilderProvider } from '../../contexts/FormBuilderContext';
import FormBuilderSidebar from './FormBuilderSidebar';
import FormCanvas from './FormCanvas';
import { Form } from '../../types/formBuilder';

interface FormBuilderProps {
  form?: Form;
  onSave?: (form: Form) => void;
  onCancel?: () => void;
}

export const FormBuilder: React.FC<FormBuilderProps> = ({ 
  form, 
  onSave, 
  onCancel 
}) => {
  return (
    <FormBuilderProvider initialForm={form}>
      <div className="flex h-full">
        <div className="w-80 border-r border-gray-200 bg-white">
          <FormBuilderSidebar />
        </div>
        <div className="flex-1">
          <FormCanvas />
        </div>
      </div>
    </FormBuilderProvider>
  );
};

export default FormBuilder;