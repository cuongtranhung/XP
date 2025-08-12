/**
 * Accessible Field Card - Phase 4 Implementation
 * WCAG 2.1 AAA compliant field card component
 */

import React, { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  GripVertical, 
  Copy, 
  Trash2, 
  Settings,
  Eye,
  EyeOff,
  Lock,
  Unlock
} from 'lucide-react';
import { clsx } from 'clsx';
import { useDragDropAnnouncer } from '../../../hooks/useScreenReader';
import { useKeyboardNavigation } from '../../../hooks/useAccessibility';

interface FormField {
  id: string;
  fieldType: string;
  label: string;
  required?: boolean;
  visible?: boolean;
  description?: string;
  validation?: any;
}

interface AccessibleFieldCardProps {
  field: FormField;
  index: number;
  total: number;
  isSelected: boolean;
  isDragging?: boolean;
  onSelect: () => void;
  onAction: (action: string, fieldId: string) => void;
  onKeyboardMove?: (direction: 'up' | 'down') => void;
  className?: string;
}

export const AccessibleFieldCard: React.FC<AccessibleFieldCardProps> = ({
  field,
  index,
  total,
  isSelected,
  isDragging = false,
  onSelect,
  onAction,
  onKeyboardMove,
  className
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const { getDraggableProps } = useDragDropAnnouncer();

  // Generate comprehensive field description for screen readers
  const getFieldDescription = () => {
    const parts = [
      field.fieldType,
      'field',
      field.label,
      `${index + 1} of ${total}`,
      field.required ? 'required' : 'optional',
      field.visible === false ? 'hidden' : null,
      isSelected ? 'selected' : null
    ].filter(Boolean);
    
    return parts.join(', ');
  };

  // Handle keyboard interactions
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        onSelect();
        setAnnouncement(`Selected ${field.label}`);
        break;
      
      case 'Delete':
        e.preventDefault();
        onAction('delete', field.id);
        setAnnouncement(`Deleted ${field.label}`);
        break;
      
      case 'd':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          onAction('duplicate', field.id);
          setAnnouncement(`Duplicated ${field.label}`);
        }
        break;
      
      case 'e':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          onAction('edit', field.id);
          setAnnouncement(`Editing ${field.label} properties`);
        }
        break;
      
      case 'ArrowUp':
        if (e.altKey && onKeyboardMove) {
          e.preventDefault();
          onKeyboardMove('up');
          setAnnouncement(`Moved ${field.label} up`);
        }
        break;
      
      case 'ArrowDown':
        if (e.altKey && onKeyboardMove) {
          e.preventDefault();
          onKeyboardMove('down');
          setAnnouncement(`Moved ${field.label} down`);
        }
        break;
      
      case '?':
        if (e.shiftKey) {
          e.preventDefault();
          setAnnouncement(
            'Field card keyboard shortcuts: ' +
            'Enter or Space to select, ' +
            'Delete to remove, ' +
            'Control+D to duplicate, ' +
            'Control+E to edit properties, ' +
            'Alt+Arrow keys to reorder'
          );
        }
        break;
    }
  };

  // Quick action buttons with proper ARIA
  const QuickActionButton: React.FC<{
    icon: React.ComponentType<any>;
    label: string;
    action: string;
    variant?: 'default' | 'danger';
  }> = ({ icon: Icon, label, action, variant = 'default' }) => {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          onAction(action, field.id);
        }}
        className={clsx(
          "p-1.5 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1",
          variant === 'danger'
            ? "hover:bg-red-100 focus:ring-red-500 text-red-600"
            : "hover:bg-gray-100 focus:ring-blue-500 text-gray-600"
        )}
        aria-label={`${label} ${field.label}`}
        tabIndex={isSelected ? 0 : -1}
      >
        <Icon className="w-4 h-4" aria-hidden="true" />
      </button>
    );
  };

  return (
    <>
      <motion.div
        ref={cardRef}
        className={clsx(
          "group relative bg-white rounded-lg border-2 transition-all",
          isSelected 
            ? "border-blue-500 shadow-lg ring-2 ring-blue-200" 
            : "border-gray-200 hover:border-gray-300 hover:shadow-md",
          isDragging && "opacity-50 cursor-move",
          isFocused && "ring-2 ring-offset-2 ring-blue-500",
          className
        )}
        onClick={onSelect}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        tabIndex={0}
        role="button"
        aria-label={getFieldDescription()}
        aria-selected={isSelected}
        aria-setsize={total}
        aria-posinset={index + 1}
        {...getDraggableProps(field.label, isDragging)}
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.98 }}
      >
        <div className="flex items-center p-3 space-x-3">
          {/* Drag Handle */}
          <div 
            className="flex-shrink-0 cursor-move text-gray-400 hover:text-gray-600"
            aria-label="Drag handle"
            role="img"
          >
            <GripVertical className="w-5 h-5" aria-hidden="true" />
          </div>

          {/* Field Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-medium text-gray-900 truncate">
                {field.label}
              </h3>
              {field.required && (
                <span 
                  className="text-red-500 text-sm" 
                  aria-label="Required field"
                  role="img"
                >
                  *
                </span>
              )}
              {field.visible === false && (
                <EyeOff 
                  className="w-3 h-3 text-gray-400" 
                  aria-label="Hidden field"
                  role="img"
                />
              )}
            </div>
            <p className="text-xs text-gray-500 truncate">
              {field.fieldType}
              {field.description && ` - ${field.description}`}
            </p>
          </div>

          {/* Quick Actions */}
          <div 
            className={clsx(
              "flex items-center space-x-1",
              "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
              isSelected && "opacity-100",
              "transition-opacity"
            )}
            role="toolbar"
            aria-label="Field actions"
          >
            <QuickActionButton 
              icon={Copy} 
              label="Duplicate" 
              action="duplicate"
            />
            <QuickActionButton 
              icon={Settings} 
              label="Edit properties" 
              action="edit"
            />
            <QuickActionButton 
              icon={field.visible !== false ? EyeOff : Eye} 
              label={field.visible !== false ? "Hide" : "Show"} 
              action="toggle-visibility"
            />
            <QuickActionButton 
              icon={Trash2} 
              label="Delete" 
              action="delete"
              variant="danger"
            />
          </div>
        </div>

        {/* Field Status Indicators */}
        <div className="absolute top-2 right-2 flex space-x-1">
          {field.validation && Object.keys(field.validation).length > 0 && (
            <span 
              className="w-2 h-2 bg-green-500 rounded-full"
              aria-label="Has validation rules"
              role="img"
            />
          )}
          {field.required && (
            <span 
              className="w-2 h-2 bg-red-500 rounded-full"
              aria-label="Required field indicator"
              role="img"
            />
          )}
        </div>
      </motion.div>

      {/* Screen Reader Announcement */}
      {announcement && (
        <div 
          role="status" 
          aria-live="polite" 
          aria-atomic="true"
          className="sr-only"
        >
          {announcement}
        </div>
      )}
    </>
  );
};

/**
 * Accessible Field List Container
 */
interface AccessibleFieldListProps {
  fields: FormField[];
  selectedFieldId?: string;
  onSelectField: (fieldId: string) => void;
  onFieldAction: (action: string, fieldId: string) => void;
  onReorderFields: (fromIndex: number, toIndex: number) => void;
  className?: string;
}

export const AccessibleFieldList: React.FC<AccessibleFieldListProps> = ({
  fields,
  selectedFieldId,
  onSelectField,
  onFieldAction,
  onReorderFields,
  className
}) => {
  const listRef = useRef<HTMLDivElement>(null);
  const { focusedIndex, registerItem, navigate } = useKeyboardNavigation({
    enableArrowNavigation: true,
    enableHomeEnd: true,
    enableTypeahead: true
  });

  // Handle keyboard reordering
  const handleKeyboardMove = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (newIndex >= 0 && newIndex < fields.length) {
      onReorderFields(index, newIndex);
    }
  };

  return (
    <div
      ref={listRef}
      role="listbox"
      aria-label="Form fields"
      aria-multiselectable="false"
      className={clsx("space-y-2", className)}
    >
      {/* Field count announcement */}
      <div className="sr-only" role="status" aria-live="polite">
        {fields.length} fields in the form
      </div>

      {fields.map((field, index) => (
        <div
          key={field.id}
          ref={registerItem(index)}
        >
          <AccessibleFieldCard
            field={field}
            index={index}
            total={fields.length}
            isSelected={field.id === selectedFieldId}
            onSelect={() => onSelectField(field.id)}
            onAction={onFieldAction}
            onKeyboardMove={(direction) => handleKeyboardMove(index, direction)}
          />
        </div>
      ))}

      {/* Empty state */}
      {fields.length === 0 && (
        <div 
          className="text-center py-8 text-gray-500"
          role="status"
        >
          <p>No fields added yet</p>
          <p className="text-sm mt-2">
            Drag fields from the library or press Tab to navigate to field options
          </p>
        </div>
      )}
    </div>
  );
};

export default AccessibleFieldCard;