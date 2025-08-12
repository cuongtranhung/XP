# 🎨 Dynamic Form Builder - Component Architecture

## 📋 Overview

This document outlines the complete component architecture for a world-class Dynamic Form Builder, including React components, state management, hooks, and UI patterns.

---

## 🏗️ Component Structure

```
src/
├── components/
│   └── formBuilder/
│       ├── core/
│       │   ├── FormBuilder.tsx
│       │   ├── FormBuilderProvider.tsx
│       │   ├── FormBuilderContext.tsx
│       │   └── FormBuilderReducer.ts
│       │
│       ├── canvas/
│       │   ├── FormCanvas.tsx
│       │   ├── DropZone.tsx
│       │   ├── GridSystem.tsx
│       │   └── ResizeHandles.tsx
│       │
│       ├── fields/
│       │   ├── base/
│       │   │   ├── BaseField.tsx
│       │   │   ├── FieldWrapper.tsx
│       │   │   └── FieldRegistry.ts
│       │   │
│       │   ├── basic/
│       │   │   ├── TextField.tsx
│       │   │   ├── NumberField.tsx
│       │   │   ├── EmailField.tsx
│       │   │   ├── TextAreaField.tsx
│       │   │   └── PhoneField.tsx
│       │   │
│       │   ├── choice/
│       │   │   ├── SelectField.tsx
│       │   │   ├── RadioField.tsx
│       │   │   ├── CheckboxField.tsx
│       │   │   └── ToggleField.tsx
│       │   │
│       │   ├── datetime/
│       │   │   ├── DateField.tsx
│       │   │   ├── TimeField.tsx
│       │   │   ├── DateTimeField.tsx
│       │   │   └── DateRangeField.tsx
│       │   │
│       │   ├── advanced/
│       │   │   ├── FileUploadField.tsx
│       │   │   ├── SignatureField.tsx
│       │   │   ├── RichTextField.tsx
│       │   │   ├── ColorPickerField.tsx
│       │   │   ├── RatingField.tsx
│       │   │   ├── SliderField.tsx
│       │   │   └── MatrixField.tsx
│       │   │
│       │   └── layout/
│       │       ├── SectionField.tsx
│       │       ├── ColumnField.tsx
│       │       ├── HeadingField.tsx
│       │       ├── ParagraphField.tsx
│       │       └── DividerField.tsx
│       │
│       ├── editor/
│       │   ├── FieldEditor.tsx
│       │   ├── PropertyPanel.tsx
│       │   ├── ValidationEditor.tsx
│       │   ├── ConditionalLogicEditor.tsx
│       │   ├── CalculationEditor.tsx
│       │   └── StyleEditor.tsx
│       │
│       ├── renderer/
│       │   ├── FormRenderer.tsx
│       │   ├── FormPage.tsx
│       │   ├── FormNavigation.tsx
│       │   ├── FormProgress.tsx
│       │   └── FormSubmission.tsx
│       │
│       ├── toolbar/
│       │   ├── FormBuilderToolbar.tsx
│       │   ├── UndoRedoButtons.tsx
│       │   ├── PreviewButton.tsx
│       │   ├── SaveButton.tsx
│       │   └── PublishButton.tsx
│       │
│       ├── sidebar/
│       │   ├── ElementPalette.tsx
│       │   ├── FormSettings.tsx
│       │   ├── ThemeSelector.tsx
│       │   └── IntegrationPanel.tsx
│       │
│       ├── preview/
│       │   ├── FormPreview.tsx
│       │   ├── DevicePreview.tsx
│       │   └── AccessibilityChecker.tsx
│       │
│       └── common/
│           ├── DragHandle.tsx
│           ├── ErrorBoundary.tsx
│           ├── LoadingSpinner.tsx
│           ├── ConfirmDialog.tsx
│           └── Toast.tsx
│
├── hooks/
│   ├── useFormBuilder.ts
│   ├── useFieldDragDrop.ts
│   ├── useFormValidation.ts
│   ├── useConditionalLogic.ts
│   ├── useFormCalculations.ts
│   ├── useFormCollaboration.ts
│   ├── useFormAnalytics.ts
│   └── useFormAutosave.ts
│
├── services/
│   ├── formBuilderService.ts
│   ├── validationService.ts
│   ├── calculationEngine.ts
│   ├── conditionalLogicEngine.ts
│   └── collaborationService.ts
│
├── store/
│   ├── formBuilderStore.ts
│   ├── fieldStore.ts
│   └── collaborationStore.ts
│
├── types/
│   ├── form.types.ts
│   ├── field.types.ts
│   ├── validation.types.ts
│   └── collaboration.types.ts
│
└── utils/
    ├── fieldFactory.ts
    ├── validators.ts
    ├── formatters.ts
    └── exporters.ts
```

---

## 🎯 Core Components

### FormBuilder Component

```typescript
import React, { useCallback, useEffect } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { FormBuilderProvider } from './FormBuilderProvider';
import { FormBuilderToolbar } from '../toolbar/FormBuilderToolbar';
import { ElementPalette } from '../sidebar/ElementPalette';
import { FormCanvas } from '../canvas/FormCanvas';
import { PropertyPanel } from '../editor/PropertyPanel';
import { useFormBuilder } from '../../hooks/useFormBuilder';
import { ErrorBoundary } from '../common/ErrorBoundary';
import styles from './FormBuilder.module.css';

interface FormBuilderProps {
  formId?: string;
  initialData?: FormDefinition;
  onSave?: (form: FormDefinition) => Promise<void>;
  onPublish?: (form: FormDefinition) => Promise<void>;
  collaborationEnabled?: boolean;
  autoSaveInterval?: number;
}

export const FormBuilder: React.FC<FormBuilderProps> = ({
  formId,
  initialData,
  onSave,
  onPublish,
  collaborationEnabled = false,
  autoSaveInterval = 30000, // 30 seconds
}) => {
  const {
    form,
    selectedField,
    isDirty,
    isLoading,
    isSaving,
    collaborators,
    save,
    publish,
  } = useFormBuilder({
    formId,
    initialData,
    onSave,
    onPublish,
    collaborationEnabled,
    autoSaveInterval,
  });

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 's':
            e.preventDefault();
            save();
            break;
          case 'z':
            e.preventDefault();
            if (e.shiftKey) {
              // Redo
            } else {
              // Undo
            }
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [save]);

  if (isLoading) {
    return <div className={styles.loading}>Loading form...</div>;
  }

  return (
    <ErrorBoundary>
      <FormBuilderProvider form={form}>
        <DndProvider backend={HTML5Backend}>
          <div className={styles.formBuilder}>
            <FormBuilderToolbar
              isDirty={isDirty}
              isSaving={isSaving}
              onSave={save}
              onPublish={publish}
              collaborators={collaborators}
            />
            
            <div className={styles.mainContent}>
              <ElementPalette className={styles.sidebar} />
              
              <FormCanvas 
                className={styles.canvas}
                selectedFieldId={selectedField?.id}
              />
              
              {selectedField && (
                <PropertyPanel
                  field={selectedField}
                  className={styles.propertyPanel}
                />
              )}
            </div>
          </div>
        </DndProvider>
      </FormBuilderProvider>
    </ErrorBoundary>
  );
};
```

### FormBuilderProvider & Context

```typescript
import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { FormDefinition, FormField, FormAction } from '../../types/form.types';
import { formBuilderReducer } from './FormBuilderReducer';
import { v4 as uuidv4 } from 'uuid';

interface FormBuilderContextValue {
  form: FormDefinition;
  dispatch: React.Dispatch<FormAction>;
  
  // Field operations
  addField: (field: Partial<FormField>, position?: number) => void;
  updateField: (fieldId: string, updates: Partial<FormField>) => void;
  deleteField: (fieldId: string) => void;
  moveField: (fromIndex: number, toIndex: number) => void;
  duplicateField: (fieldId: string) => void;
  
  // Form operations
  updateForm: (updates: Partial<FormDefinition>) => void;
  addStep: (step: FormStep) => void;
  updateStep: (stepId: string, updates: Partial<FormStep>) => void;
  deleteStep: (stepId: string) => void;
  
  // Selection
  selectField: (fieldId: string | null) => void;
  selectedFieldId: string | null;
  
  // History
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const FormBuilderContext = createContext<FormBuilderContextValue | null>(null);

export const useFormBuilderContext = () => {
  const context = useContext(FormBuilderContext);
  if (!context) {
    throw new Error('useFormBuilderContext must be used within FormBuilderProvider');
  }
  return context;
};

interface FormBuilderProviderProps {
  form: FormDefinition;
  children: React.ReactNode;
}

export const FormBuilderProvider: React.FC<FormBuilderProviderProps> = ({
  form: initialForm,
  children,
}) => {
  const [state, dispatch] = useReducer(formBuilderReducer, {
    form: initialForm,
    selectedFieldId: null,
    history: [initialForm],
    historyIndex: 0,
  });

  const addField = useCallback((field: Partial<FormField>, position?: number) => {
    const newField: FormField = {
      id: uuidv4(),
      fieldKey: field.fieldKey || `field_${Date.now()}`,
      fieldType: field.fieldType || 'text',
      label: field.label || 'New Field',
      position: position ?? state.form.fields.length,
      required: false,
      validation: {},
      ...field,
    };

    dispatch({ type: 'ADD_FIELD', payload: { field: newField } });
  }, [state.form.fields.length]);

  const updateField = useCallback((fieldId: string, updates: Partial<FormField>) => {
    dispatch({ type: 'UPDATE_FIELD', payload: { fieldId, updates } });
  }, []);

  const deleteField = useCallback((fieldId: string) => {
    dispatch({ type: 'DELETE_FIELD', payload: { fieldId } });
  }, []);

  const moveField = useCallback((fromIndex: number, toIndex: number) => {
    dispatch({ type: 'MOVE_FIELD', payload: { fromIndex, toIndex } });
  }, []);

  const duplicateField = useCallback((fieldId: string) => {
    const field = state.form.fields.find(f => f.id === fieldId);
    if (field) {
      const duplicatedField = {
        ...field,
        id: uuidv4(),
        fieldKey: `${field.fieldKey}_copy`,
        label: `${field.label} (Copy)`,
        position: field.position + 1,
      };
      dispatch({ type: 'ADD_FIELD', payload: { field: duplicatedField } });
    }
  }, [state.form.fields]);

  const updateForm = useCallback((updates: Partial<FormDefinition>) => {
    dispatch({ type: 'UPDATE_FORM', payload: updates });
  }, []);

  const selectField = useCallback((fieldId: string | null) => {
    dispatch({ type: 'SELECT_FIELD', payload: { fieldId } });
  }, []);

  const undo = useCallback(() => {
    dispatch({ type: 'UNDO' });
  }, []);

  const redo = useCallback(() => {
    dispatch({ type: 'REDO' });
  }, []);

  const value: FormBuilderContextValue = {
    form: state.form,
    dispatch,
    addField,
    updateField,
    deleteField,
    moveField,
    duplicateField,
    updateForm,
    selectField,
    selectedFieldId: state.selectedFieldId,
    undo,
    redo,
    canUndo: state.historyIndex > 0,
    canRedo: state.historyIndex < state.history.length - 1,
  };

  return (
    <FormBuilderContext.Provider value={value}>
      {children}
    </FormBuilderContext.Provider>
  );
};
```

### Base Field Component

```typescript
import React, { forwardRef, useImperativeHandle } from 'react';
import { FieldWrapper } from './FieldWrapper';
import { useFieldValidation } from '../../../hooks/useFieldValidation';
import { FormField, FieldValue } from '../../../types/field.types';
import styles from './BaseField.module.css';

export interface BaseFieldProps {
  field: FormField;
  value: FieldValue;
  onChange: (value: FieldValue) => void;
  onBlur: () => void;
  onFocus: () => void;
  error?: string;
  touched?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  className?: string;
}

export interface BaseFieldRef {
  focus: () => void;
  blur: () => void;
  validate: () => Promise<boolean>;
  reset: () => void;
}

export abstract class BaseField<T extends FieldValue = FieldValue> 
  extends React.Component<BaseFieldProps> {
  
  protected inputRef: React.RefObject<any> = React.createRef();

  abstract renderInput(): React.ReactNode;

  focus = () => {
    this.inputRef.current?.focus();
  };

  blur = () => {
    this.inputRef.current?.blur();
  };

  validate = async (): Promise<boolean> => {
    // Validation logic handled by hook
    return true;
  };

  reset = () => {
    this.props.onChange(this.props.field.defaultValue || '');
  };

  render() {
    const { field, error, touched, className } = this.props;

    return (
      <FieldWrapper
        field={field}
        error={error}
        touched={touched}
        className={className}
      >
        {this.renderInput()}
      </FieldWrapper>
    );
  }
}

// Functional component version with hooks
export const BaseFieldFC = forwardRef<BaseFieldRef, BaseFieldProps>(
  ({ field, value, onChange, onBlur, onFocus, error, touched, disabled, readonly }, ref) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const { validate, clearError } = useFieldValidation(field, value);

    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus(),
      blur: () => inputRef.current?.blur(),
      validate,
      reset: () => onChange(field.defaultValue || ''),
    }));

    return (
      <FieldWrapper field={field} error={error} touched={touched}>
        <input
          ref={inputRef}
          type="text"
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          onFocus={onFocus}
          disabled={disabled}
          readOnly={readonly}
          className={styles.input}
        />
      </FieldWrapper>
    );
  }
);
```

### Field Registry & Factory

```typescript
import React from 'react';
import { FormField } from '../../types/field.types';
import { BaseFieldProps } from './base/BaseField';

// Import all field components
import { TextField } from './basic/TextField';
import { NumberField } from './basic/NumberField';
import { EmailField } from './basic/EmailField';
import { SelectField } from './choice/SelectField';
import { RadioField } from './choice/RadioField';
import { CheckboxField } from './choice/CheckboxField';
import { DateField } from './datetime/DateField';
import { FileUploadField } from './advanced/FileUploadField';
import { SignatureField } from './advanced/SignatureField';
// ... import other fields

export type FieldComponent = React.ComponentType<BaseFieldProps>;

interface FieldTypeConfig {
  component: FieldComponent;
  icon: React.ComponentType;
  category: string;
  label: string;
  defaultProps?: Partial<FormField>;
  validationRules?: string[];
  supportedFeatures?: string[];
}

class FieldRegistry {
  private static instance: FieldRegistry;
  private fieldTypes: Map<string, FieldTypeConfig> = new Map();

  private constructor() {
    this.registerDefaults();
  }

  static getInstance(): FieldRegistry {
    if (!FieldRegistry.instance) {
      FieldRegistry.instance = new FieldRegistry();
    }
    return FieldRegistry.instance;
  }

  register(type: string, config: FieldTypeConfig) {
    this.fieldTypes.set(type, config);
  }

  get(type: string): FieldTypeConfig | undefined {
    return this.fieldTypes.get(type);
  }

  getAll(): Map<string, FieldTypeConfig> {
    return new Map(this.fieldTypes);
  }

  getByCategory(category: string): Map<string, FieldTypeConfig> {
    const filtered = new Map<string, FieldTypeConfig>();
    this.fieldTypes.forEach((config, type) => {
      if (config.category === category) {
        filtered.set(type, config);
      }
    });
    return filtered;
  }

  private registerDefaults() {
    // Basic fields
    this.register('text', {
      component: TextField,
      icon: TextIcon,
      category: 'basic',
      label: 'Text Input',
      defaultProps: {
        placeholder: 'Enter text...',
      },
      validationRules: ['required', 'minLength', 'maxLength', 'pattern'],
      supportedFeatures: ['placeholder', 'defaultValue', 'validation', 'conditional'],
    });

    this.register('number', {
      component: NumberField,
      icon: NumberIcon,
      category: 'basic',
      label: 'Number',
      defaultProps: {
        placeholder: 'Enter number...',
      },
      validationRules: ['required', 'min', 'max'],
      supportedFeatures: ['placeholder', 'defaultValue', 'validation', 'calculation'],
    });

    // Choice fields
    this.register('select', {
      component: SelectField,
      icon: SelectIcon,
      category: 'choice',
      label: 'Dropdown',
      defaultProps: {
        placeholder: 'Select an option...',
        options: [
          { label: 'Option 1', value: 'option1' },
          { label: 'Option 2', value: 'option2' },
        ],
      },
      validationRules: ['required'],
      supportedFeatures: ['options', 'defaultValue', 'validation', 'conditional'],
    });

    // Advanced fields
    this.register('file', {
      component: FileUploadField,
      icon: FileIcon,
      category: 'advanced',
      label: 'File Upload',
      defaultProps: {
        accept: '*',
        maxSize: 5242880, // 5MB
        multiple: false,
      },
      validationRules: ['required', 'fileSize', 'fileType'],
      supportedFeatures: ['validation', 'multiple'],
    });

    // ... register other field types
  }
}

export const fieldRegistry = FieldRegistry.getInstance();

// Field Factory
export class FieldFactory {
  static create(field: FormField, props: Omit<BaseFieldProps, 'field'>): React.ReactElement | null {
    const config = fieldRegistry.get(field.fieldType);
    if (!config) {
      console.error(`Unknown field type: ${field.fieldType}`);
      return null;
    }

    const Component = config.component;
    return <Component field={field} {...props} />;
  }

  static getIcon(fieldType: string): React.ComponentType | null {
    const config = fieldRegistry.get(fieldType);
    return config?.icon || null;
  }

  static getDefaultProps(fieldType: string): Partial<FormField> {
    const config = fieldRegistry.get(fieldType);
    return config?.defaultProps || {};
  }
}
```

### Drag & Drop System

```typescript
import React, { useRef } from 'react';
import { useDrag, useDrop, DropTargetMonitor } from 'react-dnd';
import { useFormBuilderContext } from '../core/FormBuilderContext';
import { FormField } from '../../types/field.types';
import styles from './DragDropField.module.css';

interface DragItem {
  type: string;
  field?: FormField;
  fieldType?: string;
  index?: number;
}

interface DragDropFieldProps {
  field: FormField;
  index: number;
  children: React.ReactNode;
}

export const DragDropField: React.FC<DragDropFieldProps> = ({
  field,
  index,
  children,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const { moveField, addField } = useFormBuilderContext();

  const [{ isDragging }, drag, preview] = useDrag({
    type: 'field',
    item: { type: 'field', field, index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [{ isOver, canDrop }, drop] = useDrop({
    accept: ['field', 'new-field'],
    hover: (item: DragItem, monitor: DropTargetMonitor) => {
      if (!ref.current) return;

      if (item.type === 'field' && item.index !== undefined) {
        const dragIndex = item.index;
        const hoverIndex = index;

        if (dragIndex === hoverIndex) return;

        const hoverBoundingRect = ref.current.getBoundingClientRect();
        const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
        const clientOffset = monitor.getClientOffset();
        const hoverClientY = clientOffset!.y - hoverBoundingRect.top;

        if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) return;
        if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) return;

        moveField(dragIndex, hoverIndex);
        item.index = hoverIndex;
      }
    },
    drop: (item: DragItem) => {
      if (item.type === 'new-field' && item.fieldType) {
        const newField = {
          fieldType: item.fieldType,
          label: `New ${item.fieldType} field`,
          position: index + 1,
        };
        addField(newField, index + 1);
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  });

  drag(drop(ref));

  return (
    <div
      ref={ref}
      className={`
        ${styles.dragDropField}
        ${isDragging ? styles.dragging : ''}
        ${isOver && canDrop ? styles.dragOver : ''}
      `}
    >
      <div className={styles.dragHandle}>
        <DragHandleIcon />
      </div>
      {children}
    </div>
  );
};
```

### Form Canvas with Grid System

```typescript
import React, { useCallback } from 'react';
import { useDrop } from 'react-dnd';
import { useFormBuilderContext } from '../core/FormBuilderContext';
import { DragDropField } from './DragDropField';
import { FieldFactory } from '../fields/FieldRegistry';
import { GridSystem } from './GridSystem';
import styles from './FormCanvas.module.css';

interface FormCanvasProps {
  className?: string;
  selectedFieldId?: string;
}

export const FormCanvas: React.FC<FormCanvasProps> = ({
  className,
  selectedFieldId,
}) => {
  const { form, addField, selectField } = useFormBuilderContext();
  const [formData, setFormData] = useState<Record<string, any>>({});

  const [{ isOver }, drop] = useDrop({
    accept: 'new-field',
    drop: (item: any) => {
      if (form.fields.length === 0) {
        addField({
          fieldType: item.fieldType,
          label: `New ${item.fieldType} field`,
          position: 0,
        });
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  const handleFieldClick = useCallback((fieldId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    selectField(fieldId);
  }, [selectField]);

  const handleCanvasClick = useCallback(() => {
    selectField(null);
  }, [selectField]);

  const handleFieldChange = useCallback((fieldId: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [fieldId]: value,
    }));
  }, []);

  return (
    <div
      ref={drop}
      className={`${styles.formCanvas} ${className} ${isOver ? styles.dragOver : ''}`}
      onClick={handleCanvasClick}
    >
      <div className={styles.formHeader}>
        <h1 className={styles.formTitle}>{form.name}</h1>
        {form.description && (
          <p className={styles.formDescription}>{form.description}</p>
        )}
      </div>

      <GridSystem>
        {form.fields.length === 0 ? (
          <div className={styles.emptyState}>
            <EmptyStateIcon />
            <p>Drag and drop form elements here to get started</p>
          </div>
        ) : (
          <div className={styles.fieldsContainer}>
            {form.fields.map((field, index) => (
              <DragDropField key={field.id} field={field} index={index}>
                <div
                  className={`
                    ${styles.fieldContainer}
                    ${selectedFieldId === field.id ? styles.selected : ''}
                  `}
                  onClick={(e) => handleFieldClick(field.id, e)}
                  style={{
                    gridColumn: `span ${field.width || 12}`,
                  }}
                >
                  {FieldFactory.create(field, {
                    value: formData[field.id] || '',
                    onChange: (value) => handleFieldChange(field.id, value),
                    onBlur: () => {},
                    onFocus: () => {},
                    disabled: false,
                    readonly: false,
                  })}
                </div>
              </DragDropField>
            ))}
          </div>
        )}
      </GridSystem>

      {form.settings?.multiPage && form.steps && (
        <FormStepIndicator
          steps={form.steps}
          currentStep={0}
          className={styles.stepIndicator}
        />
      )}
    </div>
  );
};
```

### Property Panel

```typescript
import React, { useState } from 'react';
import { useFormBuilderContext } from '../core/FormBuilderContext';
import { FormField } from '../../types/field.types';
import { GeneralSettings } from './GeneralSettings';
import { ValidationSettings } from './ValidationSettings';
import { ConditionalLogicEditor } from './ConditionalLogicEditor';
import { AdvancedSettings } from './AdvancedSettings';
import { StyleEditor } from './StyleEditor';
import styles from './PropertyPanel.module.css';

interface PropertyPanelProps {
  field: FormField;
  className?: string;
}

type TabType = 'general' | 'validation' | 'logic' | 'style' | 'advanced';

export const PropertyPanel: React.FC<PropertyPanelProps> = ({
  field,
  className,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('general');
  const { updateField, deleteField, duplicateField } = useFormBuilderContext();

  const handleFieldUpdate = (updates: Partial<FormField>) => {
    updateField(field.id, updates);
  };

  const tabs = [
    { id: 'general', label: 'General', icon: <SettingsIcon /> },
    { id: 'validation', label: 'Validation', icon: <ValidationIcon /> },
    { id: 'logic', label: 'Logic', icon: <LogicIcon /> },
    { id: 'style', label: 'Style', icon: <StyleIcon /> },
    { id: 'advanced', label: 'Advanced', icon: <AdvancedIcon /> },
  ];

  return (
    <div className={`${styles.propertyPanel} ${className}`}>
      <div className={styles.header}>
        <h3 className={styles.title}>Field Properties</h3>
        <div className={styles.actions}>
          <button
            onClick={() => duplicateField(field.id)}
            className={styles.actionButton}
            title="Duplicate field"
          >
            <DuplicateIcon />
          </button>
          <button
            onClick={() => deleteField(field.id)}
            className={styles.actionButton}
            title="Delete field"
          >
            <DeleteIcon />
          </button>
        </div>
      </div>

      <div className={styles.tabs}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`${styles.tab} ${activeTab === tab.id ? styles.active : ''}`}
            onClick={() => setActiveTab(tab.id as TabType)}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className={styles.content}>
        {activeTab === 'general' && (
          <GeneralSettings field={field} onChange={handleFieldUpdate} />
        )}
        {activeTab === 'validation' && (
          <ValidationSettings field={field} onChange={handleFieldUpdate} />
        )}
        {activeTab === 'logic' && (
          <ConditionalLogicEditor field={field} onChange={handleFieldUpdate} />
        )}
        {activeTab === 'style' && (
          <StyleEditor field={field} onChange={handleFieldUpdate} />
        )}
        {activeTab === 'advanced' && (
          <AdvancedSettings field={field} onChange={handleFieldUpdate} />
        )}
      </div>
    </div>
  );
};
```

---

## 🪝 Custom Hooks

### useFormBuilder Hook

```typescript
import { useState, useEffect, useCallback, useRef } from 'react';
import { FormDefinition, FormField } from '../types/form.types';
import { formBuilderService } from '../services/formBuilderService';
import { useFormAutosave } from './useFormAutosave';
import { useFormCollaboration } from './useFormCollaboration';
import { useFormHistory } from './useFormHistory';

interface UseFormBuilderOptions {
  formId?: string;
  initialData?: FormDefinition;
  onSave?: (form: FormDefinition) => Promise<void>;
  onPublish?: (form: FormDefinition) => Promise<void>;
  collaborationEnabled?: boolean;
  autoSaveInterval?: number;
}

export const useFormBuilder = ({
  formId,
  initialData,
  onSave,
  onPublish,
  collaborationEnabled = false,
  autoSaveInterval = 30000,
}: UseFormBuilderOptions) => {
  const [form, setForm] = useState<FormDefinition | null>(initialData || null);
  const [selectedField, setSelectedField] = useState<FormField | null>(null);
  const [isLoading, setIsLoading] = useState(!initialData);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // History management
  const { 
    addToHistory, 
    undo, 
    redo, 
    canUndo, 
    canRedo 
  } = useFormHistory(form);

  // Collaboration
  const { 
    collaborators, 
    fieldLocks,
    broadcastChange 
  } = useFormCollaboration(formId, collaborationEnabled);

  // Auto-save
  const { isDirty, markClean } = useFormAutosave(
    form,
    autoSaveInterval,
    async (formToSave) => {
      if (onSave) {
        await onSave(formToSave);
        markClean();
      }
    }
  );

  // Load form
  useEffect(() => {
    if (formId && !initialData) {
      loadForm();
    }
  }, [formId]);

  const loadForm = async () => {
    try {
      setIsLoading(true);
      const loadedForm = await formBuilderService.getForm(formId!);
      setForm(loadedForm);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  };

  // Save form
  const save = useCallback(async () => {
    if (!form || !onSave) return;

    try {
      setIsSaving(true);
      await onSave(form);
      markClean();
      // Show success toast
    } catch (err) {
      setError(err as Error);
      // Show error toast
    } finally {
      setIsSaving(false);
    }
  }, [form, onSave, markClean]);

  // Publish form
  const publish = useCallback(async () => {
    if (!form || !onPublish) return;

    try {
      setIsSaving(true);
      await onPublish(form);
      // Show success toast
    } catch (err) {
      setError(err as Error);
      // Show error toast
    } finally {
      setIsSaving(false);
    }
  }, [form, onPublish]);

  // Field operations
  const updateForm = useCallback((updates: Partial<FormDefinition>) => {
    setForm(prev => {
      if (!prev) return prev;
      const updated = { ...prev, ...updates };
      addToHistory(updated);
      if (collaborationEnabled) {
        broadcastChange('form', updates);
      }
      return updated;
    });
  }, [addToHistory, broadcastChange, collaborationEnabled]);

  const addField = useCallback((field: FormField) => {
    setForm(prev => {
      if (!prev) return prev;
      const updated = {
        ...prev,
        fields: [...prev.fields, field],
      };
      addToHistory(updated);
      if (collaborationEnabled) {
        broadcastChange('field-add', field);
      }
      return updated;
    });
  }, [addToHistory, broadcastChange, collaborationEnabled]);

  const updateField = useCallback((fieldId: string, updates: Partial<FormField>) => {
    setForm(prev => {
      if (!prev) return prev;
      const updated = {
        ...prev,
        fields: prev.fields.map(f => 
          f.id === fieldId ? { ...f, ...updates } : f
        ),
      };
      addToHistory(updated);
      if (collaborationEnabled) {
        broadcastChange('field-update', { fieldId, updates });
      }
      return updated;
    });
  }, [addToHistory, broadcastChange, collaborationEnabled]);

  const deleteField = useCallback((fieldId: string) => {
    setForm(prev => {
      if (!prev) return prev;
      const updated = {
        ...prev,
        fields: prev.fields.filter(f => f.id !== fieldId),
      };
      addToHistory(updated);
      if (collaborationEnabled) {
        broadcastChange('field-delete', { fieldId });
      }
      return updated;
    });
    
    // Clear selection if deleted field was selected
    if (selectedField?.id === fieldId) {
      setSelectedField(null);
    }
  }, [addToHistory, broadcastChange, collaborationEnabled, selectedField]);

  return {
    form,
    selectedField,
    setSelectedField,
    isLoading,
    isSaving,
    isDirty,
    error,
    collaborators,
    fieldLocks,
    save,
    publish,
    updateForm,
    addField,
    updateField,
    deleteField,
    undo,
    redo,
    canUndo,
    canRedo,
  };
};
```

### useConditionalLogic Hook

```typescript
import { useEffect, useMemo } from 'react';
import { FormField, ConditionalRule } from '../types/field.types';
import { ConditionalLogicEngine } from '../services/conditionalLogicEngine';

export const useConditionalLogic = (
  fields: FormField[],
  formData: Record<string, any>
) => {
  const engine = useMemo(() => new ConditionalLogicEngine(), []);
  
  const fieldVisibility = useMemo(() => {
    const visibility: Record<string, boolean> = {};
    const fieldStates: Record<string, FieldState> = {};
    
    fields.forEach(field => {
      // Default all fields to visible
      visibility[field.id] = true;
      fieldStates[field.id] = {
        visible: true,
        disabled: false,
        required: field.required || false,
      };
      
      if (field.conditionalLogic?.rules) {
        const actions = engine.evaluate(
          field.conditionalLogic.rules,
          formData
        );
        
        actions.forEach(action => {
          switch (action.type) {
            case 'show':
              visibility[action.targetFieldId] = true;
              fieldStates[action.targetFieldId].visible = true;
              break;
            case 'hide':
              visibility[action.targetFieldId] = false;
              fieldStates[action.targetFieldId].visible = false;
              break;
            case 'enable':
              fieldStates[action.targetFieldId].disabled = false;
              break;
            case 'disable':
              fieldStates[action.targetFieldId].disabled = true;
              break;
            case 'require':
              fieldStates[action.targetFieldId].required = true;
              break;
            case 'unrequire':
              fieldStates[action.targetFieldId].required = false;
              break;
          }
        });
      }
    });
    
    return { visibility, fieldStates };
  }, [fields, formData, engine]);
  
  return fieldVisibility;
};
```

### useFormValidation Hook

```typescript
import { useState, useCallback, useMemo } from 'react';
import { FormField, ValidationResult } from '../types/validation.types';
import { ValidationEngine } from '../services/validationEngine';

export const useFormValidation = (fields: FormField[]) => {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const validationEngine = useMemo(() => new ValidationEngine(), []);

  const validateField = useCallback(async (
    field: FormField,
    value: any,
    formData: Record<string, any>
  ): Promise<ValidationResult> => {
    const result = await validationEngine.validateField(field, value, formData);
    
    if (result.errors.length > 0) {
      setErrors(prev => ({
        ...prev,
        [field.id]: result.errors[0].message,
      }));
    } else {
      setErrors(prev => {
        const next = { ...prev };
        delete next[field.id];
        return next;
      });
    }
    
    return result;
  }, [validationEngine]);

  const validateForm = useCallback(async (
    formData: Record<string, any>
  ): Promise<boolean> => {
    const validationPromises = fields.map(field => 
      validateField(field, formData[field.id], formData)
    );
    
    const results = await Promise.all(validationPromises);
    const isValid = results.every(result => result.valid);
    
    // Mark all fields as touched
    const allTouched = fields.reduce((acc, field) => ({
      ...acc,
      [field.id]: true,
    }), {});
    setTouched(allTouched);
    
    return isValid;
  }, [fields, validateField]);

  const touchField = useCallback((fieldId: string) => {
    setTouched(prev => ({
      ...prev,
      [fieldId]: true,
    }));
  }, []);

  const clearErrors = useCallback(() => {
    setErrors({});
    setTouched({});
  }, []);

  const getFieldError = useCallback((fieldId: string): string | undefined => {
    return touched[fieldId] ? errors[fieldId] : undefined;
  }, [errors, touched]);

  return {
    errors,
    touched,
    validateField,
    validateForm,
    touchField,
    clearErrors,
    getFieldError,
  };
};
```

---

## 🎨 Advanced Field Components

### File Upload Field

```typescript
import React, { useState, useRef, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { BaseFieldProps } from '../base/BaseField';
import { FieldWrapper } from '../base/FieldWrapper';
import { formatFileSize } from '../../../utils/formatters';
import { FileValidator } from '../../../services/fileValidator';
import styles from './FileUploadField.module.css';

interface FileUploadFieldProps extends BaseFieldProps {
  field: FileUploadField;
}

interface FileUploadField extends FormField {
  accept?: string;
  maxSize?: number;
  maxFiles?: number;
  multiple?: boolean;
}

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  url?: string;
  progress?: number;
  error?: string;
}

export const FileUploadField: React.FC<FileUploadFieldProps> = ({
  field,
  value,
  onChange,
  onBlur,
  error,
  touched,
  disabled,
  readonly,
}) => {
  const [files, setFiles] = useState<UploadedFile[]>(
    Array.isArray(value) ? value : []
  );
  const [uploading, setUploading] = useState(false);
  const fileValidator = useRef(new FileValidator());

  const handleDrop = useCallback(async (acceptedFiles: File[]) => {
    if (disabled || readonly) return;

    setUploading(true);
    const uploadPromises = acceptedFiles.map(async (file) => {
      // Validate file
      const validation = await fileValidator.current.validate(file, {
        maxSize: field.maxSize,
        allowedTypes: field.accept?.split(',').map(t => t.trim()),
      });

      if (!validation.valid) {
        return {
          id: Math.random().toString(36),
          name: file.name,
          size: file.size,
          type: file.type,
          error: validation.errors[0],
        };
      }

      // Upload file
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('fieldId', field.id);

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        const data = await response.json();

        return {
          id: data.id,
          name: file.name,
          size: file.size,
          type: file.type,
          url: data.url,
        };
      } catch (error) {
        return {
          id: Math.random().toString(36),
          name: file.name,
          size: file.size,
          type: file.type,
          error: 'Upload failed',
        };
      }
    });

    const uploadedFiles = await Promise.all(uploadPromises);
    const newFiles = field.multiple 
      ? [...files, ...uploadedFiles]
      : uploadedFiles;
    
    setFiles(newFiles);
    onChange(newFiles);
    setUploading(false);
  }, [field, files, onChange, disabled, readonly]);

  const removeFile = useCallback((fileId: string) => {
    const newFiles = files.filter(f => f.id !== fileId);
    setFiles(newFiles);
    onChange(newFiles);
  }, [files, onChange]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleDrop,
    accept: field.accept,
    maxSize: field.maxSize,
    multiple: field.multiple,
    disabled: disabled || readonly,
  });

  return (
    <FieldWrapper field={field} error={error} touched={touched}>
      <div
        {...getRootProps()}
        className={`
          ${styles.dropzone}
          ${isDragActive ? styles.dragActive : ''}
          ${disabled ? styles.disabled : ''}
          ${error && touched ? styles.error : ''}
        `}
      >
        <input {...getInputProps()} onBlur={onBlur} />
        
        {files.length === 0 ? (
          <div className={styles.placeholder}>
            <UploadIcon className={styles.icon} />
            <p className={styles.text}>
              {isDragActive
                ? 'Drop files here...'
                : 'Drag & drop files here, or click to select'}
            </p>
            {field.accept && (
              <p className={styles.hint}>
                Accepted formats: {field.accept}
              </p>
            )}
            {field.maxSize && (
              <p className={styles.hint}>
                Max size: {formatFileSize(field.maxSize)}
              </p>
            )}
          </div>
        ) : (
          <div className={styles.fileList}>
            {files.map(file => (
              <div key={file.id} className={styles.fileItem}>
                <FileIcon type={file.type} className={styles.fileIcon} />
                <div className={styles.fileInfo}>
                  <p className={styles.fileName}>{file.name}</p>
                  <p className={styles.fileSize}>{formatFileSize(file.size)}</p>
                  {file.error && (
                    <p className={styles.fileError}>{file.error}</p>
                  )}
                </div>
                {!disabled && !readonly && (
                  <button
                    type="button"
                    onClick={() => removeFile(file.id)}
                    className={styles.removeButton}
                  >
                    <CloseIcon />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        
        {uploading && (
          <div className={styles.uploadingOverlay}>
            <LoadingSpinner />
            <p>Uploading...</p>
          </div>
        )}
      </div>
    </FieldWrapper>
  );
};
```

### Signature Field

```typescript
import React, { useRef, useState, useCallback, useEffect } from 'react';
import SignaturePad from 'signature_pad';
import { BaseFieldProps } from '../base/BaseField';
import { FieldWrapper } from '../base/FieldWrapper';
import styles from './SignatureField.module.css';

interface SignatureFieldProps extends BaseFieldProps {
  field: SignatureField;
}

interface SignatureField extends FormField {
  penColor?: string;
  backgroundColor?: string;
  width?: number;
  height?: number;
}

export const SignatureField: React.FC<SignatureFieldProps> = ({
  field,
  value,
  onChange,
  onBlur,
  error,
  touched,
  disabled,
  readonly,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const signaturePadRef = useRef<SignaturePad | null>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  useEffect(() => {
    if (!canvasRef.current) return;

    signaturePadRef.current = new SignaturePad(canvasRef.current, {
      penColor: field.penColor || '#000000',
      backgroundColor: field.backgroundColor || '#ffffff',
      onEnd: handleSignatureEnd,
    });

    // Load existing signature
    if (value && typeof value === 'string') {
      signaturePadRef.current.fromDataURL(value);
      setIsEmpty(false);
    }

    // Handle resize
    const handleResize = () => {
      if (signaturePadRef.current && canvasRef.current) {
        const canvas = canvasRef.current;
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        canvas.width = canvas.offsetWidth * ratio;
        canvas.height = canvas.offsetHeight * ratio;
        canvas.getContext('2d')?.scale(ratio, ratio);
        signaturePadRef.current.clear();
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
      signaturePadRef.current?.off();
    };
  }, [field.penColor, field.backgroundColor, value]);

  const handleSignatureEnd = useCallback(() => {
    if (signaturePadRef.current) {
      const dataUrl = signaturePadRef.current.toDataURL();
      onChange(dataUrl);
      setIsEmpty(signaturePadRef.current.isEmpty());
    }
  }, [onChange]);

  const handleClear = useCallback(() => {
    if (signaturePadRef.current) {
      signaturePadRef.current.clear();
      onChange('');
      setIsEmpty(true);
    }
  }, [onChange]);

  const handleUndo = useCallback(() => {
    if (signaturePadRef.current) {
      const data = signaturePadRef.current.toData();
      if (data.length > 0) {
        data.pop();
        signaturePadRef.current.fromData(data);
        handleSignatureEnd();
      }
    }
  }, [handleSignatureEnd]);

  return (
    <FieldWrapper field={field} error={error} touched={touched}>
      <div className={styles.signatureContainer}>
        <canvas
          ref={canvasRef}
          className={`
            ${styles.signatureCanvas}
            ${disabled || readonly ? styles.disabled : ''}
            ${error && touched ? styles.error : ''}
          `}
          onBlur={onBlur}
          style={{
            width: field.width || '100%',
            height: field.height || 200,
          }}
        />
        
        {!isEmpty && !disabled && !readonly && (
          <div className={styles.controls}>
            <button
              type="button"
              onClick={handleUndo}
              className={styles.controlButton}
            >
              <UndoIcon />
              Undo
            </button>
            <button
              type="button"
              onClick={handleClear}
              className={styles.controlButton}
            >
              <ClearIcon />
              Clear
            </button>
          </div>
        )}
        
        {isEmpty && (
          <div className={styles.placeholder}>
            <SignatureIcon />
            <p>Sign here</p>
          </div>
        )}
      </div>
    </FieldWrapper>
  );
};
```

### Matrix/Grid Field

```typescript
import React, { useMemo, useCallback } from 'react';
import { BaseFieldProps } from '../base/BaseField';
import { FieldWrapper } from '../base/FieldWrapper';
import styles from './MatrixField.module.css';

interface MatrixFieldProps extends BaseFieldProps {
  field: MatrixField;
}

interface MatrixField extends FormField {
  rows: MatrixOption[];
  columns: MatrixOption[];
  inputType: 'radio' | 'checkbox' | 'text' | 'number' | 'select';
  allowMultiple?: boolean;
}

interface MatrixOption {
  label: string;
  value: string;
}

interface MatrixValue {
  [rowValue: string]: string | string[] | undefined;
}

export const MatrixField: React.FC<MatrixFieldProps> = ({
  field,
  value = {},
  onChange,
  onBlur,
  error,
  touched,
  disabled,
  readonly,
}) => {
  const matrixValue = value as MatrixValue;

  const handleCellChange = useCallback((
    rowValue: string,
    columnValue: string,
    checked?: boolean
  ) => {
    const newValue = { ...matrixValue };

    switch (field.inputType) {
      case 'radio':
        newValue[rowValue] = columnValue;
        break;
      
      case 'checkbox':
        const currentValues = Array.isArray(newValue[rowValue]) 
          ? newValue[rowValue] as string[]
          : [];
        
        if (checked) {
          newValue[rowValue] = [...currentValues, columnValue];
        } else {
          newValue[rowValue] = currentValues.filter(v => v !== columnValue);
        }
        break;
      
      default:
        newValue[rowValue] = columnValue;
    }

    onChange(newValue);
  }, [matrixValue, onChange, field.inputType]);

  const renderCell = useCallback((row: MatrixOption, column: MatrixOption) => {
    const cellValue = matrixValue[row.value];
    const cellId = `${field.id}_${row.value}_${column.value}`;

    switch (field.inputType) {
      case 'radio':
        return (
          <input
            type="radio"
            id={cellId}
            name={`${field.id}_${row.value}`}
            value={column.value}
            checked={cellValue === column.value}
            onChange={() => handleCellChange(row.value, column.value)}
            disabled={disabled || readonly}
            className={styles.radioInput}
          />
        );
      
      case 'checkbox':
        const checkedValues = Array.isArray(cellValue) ? cellValue : [];
        return (
          <input
            type="checkbox"
            id={cellId}
            value={column.value}
            checked={checkedValues.includes(column.value)}
            onChange={(e) => handleCellChange(row.value, column.value, e.target.checked)}
            disabled={disabled || readonly}
            className={styles.checkboxInput}
          />
        );
      
      case 'text':
      case 'number':
        return (
          <input
            type={field.inputType}
            id={cellId}
            value={cellValue || ''}
            onChange={(e) => handleCellChange(row.value, e.target.value)}
            disabled={disabled || readonly}
            className={styles.textInput}
          />
        );
      
      default:
        return null;
    }
  }, [field, matrixValue, handleCellChange, disabled, readonly]);

  return (
    <FieldWrapper field={field} error={error} touched={touched}>
      <div className={styles.matrixContainer} onBlur={onBlur}>
        <table className={styles.matrixTable}>
          <thead>
            <tr>
              <th className={styles.cornerCell}></th>
              {field.columns.map(column => (
                <th key={column.value} className={styles.columnHeader}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {field.rows.map(row => (
              <tr key={row.value}>
                <th className={styles.rowHeader}>
                  {row.label}
                </th>
                {field.columns.map(column => (
                  <td key={column.value} className={styles.matrixCell}>
                    {renderCell(row, column)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </FieldWrapper>
  );
};
```

---

## 🔧 Utility Functions

### Field Validators

```typescript
// validators.ts
export interface ValidationRule {
  validate: (value: any, field: FormField, formData?: any) => boolean | Promise<boolean>;
  message: string | ((field: FormField) => string);
}

export const validators = {
  required: (message?: string): ValidationRule => ({
    validate: (value) => {
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === 'string') return value.trim().length > 0;
      return value != null && value !== '';
    },
    message: message || ((field) => `${field.label} is required`),
  }),

  minLength: (min: number, message?: string): ValidationRule => ({
    validate: (value) => {
      if (!value) return true;
      return String(value).length >= min;
    },
    message: message || ((field) => `${field.label} must be at least ${min} characters`),
  }),

  maxLength: (max: number, message?: string): ValidationRule => ({
    validate: (value) => {
      if (!value) return true;
      return String(value).length <= max;
    },
    message: message || ((field) => `${field.label} must be no more than ${max} characters`),
  }),

  pattern: (regex: RegExp, message?: string): ValidationRule => ({
    validate: (value) => {
      if (!value) return true;
      return regex.test(String(value));
    },
    message: message || ((field) => `${field.label} has invalid format`),
  }),

  email: (message?: string): ValidationRule => ({
    validate: (value) => {
      if (!value) return true;
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value));
    },
    message: message || 'Please enter a valid email address',
  }),

  min: (min: number, message?: string): ValidationRule => ({
    validate: (value) => {
      if (!value && value !== 0) return true;
      return Number(value) >= min;
    },
    message: message || ((field) => `${field.label} must be at least ${min}`),
  }),

  max: (max: number, message?: string): ValidationRule => ({
    validate: (value) => {
      if (!value && value !== 0) return true;
      return Number(value) <= max;
    },
    message: message || ((field) => `${field.label} must be no more than ${max}`),
  }),

  fileSize: (maxSize: number, message?: string): ValidationRule => ({
    validate: (value) => {
      if (!value) return true;
      const files = Array.isArray(value) ? value : [value];
      return files.every(file => file.size <= maxSize);
    },
    message: message || `File size must not exceed ${formatFileSize(maxSize)}`,
  }),

  fileType: (allowedTypes: string[], message?: string): ValidationRule => ({
    validate: (value) => {
      if (!value) return true;
      const files = Array.isArray(value) ? value : [value];
      return files.every(file => allowedTypes.includes(file.type));
    },
    message: message || `File type must be one of: ${allowedTypes.join(', ')}`,
  }),

  custom: (
    validator: (value: any, field: FormField, formData?: any) => boolean | Promise<boolean>,
    message: string
  ): ValidationRule => ({
    validate: validator,
    message,
  }),

  requiredIf: (
    condition: (formData: any) => boolean,
    message?: string
  ): ValidationRule => ({
    validate: async (value, field, formData) => {
      if (!condition(formData)) return true;
      return validators.required(message).validate(value, field, formData);
    },
    message: message || ((field) => `${field.label} is required`),
  }),

  matchField: (fieldKey: string, message?: string): ValidationRule => ({
    validate: (value, field, formData) => {
      if (!value || !formData) return true;
      return value === formData[fieldKey];
    },
    message: message || 'Fields do not match',
  }),
};
```

### Form Export Utilities

```typescript
// exporters.ts
export class FormExporter {
  static async exportToJSON(form: FormDefinition): Promise<string> {
    return JSON.stringify(form, null, 2);
  }

  static async exportToHTML(form: FormDefinition): Promise<string> {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${this.escapeHtml(form.name)}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    .form-field { margin-bottom: 20px; }
    label { display: block; margin-bottom: 5px; font-weight: bold; }
    input, select, textarea { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
    button { background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; }
  </style>
</head>
<body>
  <h1>${this.escapeHtml(form.name)}</h1>
  ${form.description ? `<p>${this.escapeHtml(form.description)}</p>` : ''}
  <form id="${form.id}" method="POST" action="/submit/${form.id}">
    ${form.fields.map(field => this.renderFieldHTML(field)).join('\n')}
    <button type="submit">Submit</button>
  </form>
</body>
</html>`;
    return html;
  }

  static async exportToPDF(form: FormDefinition): Promise<Blob> {
    // Use a PDF library like jsPDF
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.text(form.name, 20, 20);
    
    if (form.description) {
      doc.setFontSize(12);
      doc.text(form.description, 20, 35);
    }
    
    let yPosition = 50;
    form.fields.forEach(field => {
      doc.setFontSize(14);
      doc.text(field.label + (field.required ? ' *' : ''), 20, yPosition);
      yPosition += 15;
      
      if (field.helpText) {
        doc.setFontSize(10);
        doc.text(field.helpText, 20, yPosition);
        yPosition += 10;
      }
      
      yPosition += 10;
    });
    
    return doc.output('blob');
  }

  private static escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  private static renderFieldHTML(field: FormField): string {
    const required = field.required ? 'required' : '';
    const placeholder = field.placeholder ? `placeholder="${this.escapeHtml(field.placeholder)}"` : '';
    
    let input = '';
    switch (field.fieldType) {
      case 'text':
      case 'email':
      case 'number':
      case 'date':
      case 'time':
        input = `<input type="${field.fieldType}" name="${field.fieldKey}" id="${field.id}" ${required} ${placeholder}>`;
        break;
      
      case 'textarea':
        input = `<textarea name="${field.fieldKey}" id="${field.id}" rows="4" ${required} ${placeholder}></textarea>`;
        break;
      
      case 'select':
        input = `
          <select name="${field.fieldKey}" id="${field.id}" ${required}>
            ${field.placeholder ? `<option value="">${this.escapeHtml(field.placeholder)}</option>` : ''}
            ${field.options?.map(opt => 
              `<option value="${opt.value}">${this.escapeHtml(opt.label)}</option>`
            ).join('')}
          </select>`;
        break;
      
      // Add other field types...
    }
    
    return `
      <div class="form-field">
        <label for="${field.id}">${this.escapeHtml(field.label)}${field.required ? ' *' : ''}</label>
        ${input}
        ${field.helpText ? `<small>${this.escapeHtml(field.helpText)}</small>` : ''}
      </div>`;
  }
}
```

---

## 🎨 Styling & Themes

### CSS Module Example

```scss
// FormBuilder.module.scss
.formBuilder {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: var(--bg-primary);
  color: var(--text-primary);
}

.mainContent {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.sidebar {
  width: 280px;
  background-color: var(--bg-secondary);
  border-right: 1px solid var(--border-color);
  overflow-y: auto;
}

.canvas {
  flex: 1;
  overflow-y: auto;
  padding: 2rem;
  background-color: var(--bg-canvas);
}

.propertyPanel {
  width: 320px;
  background-color: var(--bg-secondary);
  border-left: 1px solid var(--border-color);
  overflow-y: auto;
}

// Theme variables
:root {
  // Light theme
  --bg-primary: #ffffff;
  --bg-secondary: #f8f9fa;
  --bg-canvas: #fafbfc;
  --text-primary: #212529;
  --text-secondary: #6c757d;
  --border-color: #dee2e6;
  --primary-color: #007bff;
  --success-color: #28a745;
  --danger-color: #dc3545;
  --warning-color: #ffc107;
  
  // Shadows
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.07);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
}

// Dark theme
[data-theme="dark"] {
  --bg-primary: #1a1a1a;
  --bg-secondary: #2d2d2d;
  --bg-canvas: #242424;
  --text-primary: #ffffff;
  --text-secondary: #a0a0a0;
  --border-color: #404040;
}

// Responsive breakpoints
@media (max-width: 1024px) {
  .sidebar {
    position: absolute;
    left: -280px;
    transition: left 0.3s ease;
    z-index: 100;
    
    &.open {
      left: 0;
    }
  }
  
  .propertyPanel {
    position: absolute;
    right: -320px;
    transition: right 0.3s ease;
    z-index: 100;
    
    &.open {
      right: 0;
    }
  }
}

@media (max-width: 768px) {
  .canvas {
    padding: 1rem;
  }
}
```

---

## 🚀 Performance Optimizations

### Memoization & React.memo

```typescript
// Memoized field component
export const MemoizedFormField = React.memo<FormFieldProps>(
  ({ field, value, onChange, ...props }) => {
    return <FormField field={field} value={value} onChange={onChange} {...props} />;
  },
  (prevProps, nextProps) => {
    // Custom comparison function
    return (
      prevProps.field === nextProps.field &&
      prevProps.value === nextProps.value &&
      prevProps.error === nextProps.error &&
      prevProps.touched === nextProps.touched
    );
  }
);

// Virtualized field list for large forms
import { VariableSizeList as List } from 'react-window';

export const VirtualizedFieldList: React.FC<{ fields: FormField[] }> = ({ fields }) => {
  const getItemSize = useCallback((index: number) => {
    const field = fields[index];
    // Calculate height based on field type
    switch (field.fieldType) {
      case 'textarea': return 150;
      case 'file': return 200;
      case 'matrix': return 300;
      default: return 80;
    }
  }, [fields]);

  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => (
    <div style={style}>
      <MemoizedFormField field={fields[index]} />
    </div>
  );

  return (
    <List
      height={600}
      itemCount={fields.length}
      itemSize={getItemSize}
      width="100%"
    >
      {Row}
    </List>
  );
};
```

---

## 📝 TypeScript Types

### Complete Type Definitions

```typescript
// form.types.ts
export interface FormDefinition {
  id: string;
  slug: string;
  name: string;
  description?: string;
  category?: string;
  tags?: string[];
  status: FormStatus;
  version: number;
  visibility: FormVisibility;
  
  fields: FormField[];
  steps?: FormStep[];
  
  settings: FormSettings;
  theme?: FormTheme;
  
  translations?: Record<string, FormTranslation>;
  defaultLanguage?: string;
  
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
  archivedAt?: Date;
  
  ownerId: string;
  teamId?: string;
  collaborators?: string[];
}

export interface FormField {
  id: string;
  fieldKey: string;
  fieldType: string;
  label: string;
  placeholder?: string;
  helpText?: string;
  tooltip?: string;
  
  position: number;
  row?: number;
  column?: number;
  width?: number; // Grid columns (1-12)
  
  required?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  hidden?: boolean;
  
  defaultValue?: any;
  options?: FieldOption[];
  
  validation?: ValidationRules;
  conditionalLogic?: ConditionalLogic;
  calculations?: CalculationRule[];
  
  styling?: FieldStyling;
  metadata?: Record<string, any>;
}

export interface FormStep {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  fields: string[]; // Field IDs
  
  validation?: StepValidation;
  navigation?: StepNavigation;
  conditionalLogic?: ConditionalLogic;
}

export interface FormSettings {
  submitButton?: {
    text: string;
    position: 'top' | 'bottom' | 'both';
    alignment: 'left' | 'center' | 'right';
  };
  progressBar?: {
    enabled: boolean;
    type: 'steps' | 'percentage' | 'dots';
    showLabels: boolean;
  };
  saveProgress?: {
    enabled: boolean;
    autoSave: boolean;
    interval: number; // seconds
  };
  notifications?: {
    email?: EmailNotification[];
    webhook?: WebhookNotification[];
  };
  confirmation?: {
    type: 'message' | 'redirect' | 'download';
    title?: string;
    message?: string;
    redirectUrl?: string;
    redirectDelay?: number;
  };
  security?: {
    captcha?: boolean;
    honeypot?: boolean;
    csrfProtection?: boolean;
    ipRateLimit?: RateLimit;
  };
  scheduling?: {
    startDate?: Date;
    endDate?: Date;
    timezone?: string;
  };
  quotas?: {
    maxSubmissions?: number;
    maxPerUser?: number;
    maxPerDay?: number;
  };
}

export interface ValidationRules {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  messages?: Record<string, string>;
  customValidators?: CustomValidator[];
  asyncValidators?: AsyncValidator[];
}

export interface ConditionalLogic {
  rules: ConditionalRule[];
  logicType: 'all' | 'any';
}

export interface ConditionalRule {
  id: string;
  conditions: Condition[];
  actions: Action[];
}

export interface Condition {
  fieldId: string;
  operator: ConditionOperator;
  value: any;
  compareFieldId?: string;
}

export type ConditionOperator = 
  | 'equals' 
  | 'not_equals' 
  | 'contains' 
  | 'not_contains'
  | 'starts_with' 
  | 'ends_with'
  | 'greater_than' 
  | 'less_than'
  | 'between'
  | 'in' 
  | 'not_in'
  | 'is_empty' 
  | 'is_not_empty';

export interface Action {
  type: ActionType;
  targetFieldId: string;
  value?: any;
}

export type ActionType = 
  | 'show' 
  | 'hide' 
  | 'enable' 
  | 'disable' 
  | 'require' 
  | 'unrequire'
  | 'set_value' 
  | 'add_class' 
  | 'remove_class';

export type FormStatus = 'draft' | 'published' | 'archived' | 'deleted';
export type FormVisibility = 'private' | 'public' | 'unlisted' | 'password_protected';

// Additional types...
```

---

## 🎉 Conclusion

This component architecture provides:

1. **Modular Design**: Clear separation of concerns with reusable components
2. **Type Safety**: Comprehensive TypeScript definitions
3. **Performance**: Optimized rendering with memoization and virtualization
4. **Flexibility**: Extensible field registry and plugin system
5. **Accessibility**: WCAG compliant components with ARIA support
6. **Developer Experience**: Well-documented with clear patterns

The architecture supports building complex forms with advanced features while maintaining code quality and performance.