/**
 * Sortable Field - Phase 1 Implementation
 * Drag-and-drop sortable field wrapper with enhanced UX
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { clsx } from 'clsx';
import { GripVertical, Copy, Settings, Trash2, Eye, EyeOff, ChevronUp, ChevronDown, ArrowUp, ArrowDown } from 'lucide-react';
import { EnhancedFieldPreview } from './EnhancedFieldPreview';

interface FormField {
  id: string;
  fieldType: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  hidden?: boolean;
  options?: Array<{ label: string; value: string | number }> | string[];
  validation?: any;
}

interface SortableFieldProps {
  field: FormField;
  isSelected?: boolean;
  isMobile?: boolean;
  onSelect: () => void;
  onAction: (action: 'edit' | 'duplicate' | 'delete' | 'toggle-visibility' | 'move-up' | 'move-down', fieldId: string) => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  fieldIndex?: number;
  totalFields?: number;
}

interface ActionButtonProps {
  icon: React.ComponentType<any>;
  label: string;
  onClick: () => void;
  variant?: 'default' | 'danger';
  disabled?: boolean;
}

const ActionButton: React.FC<ActionButtonProps> = ({ 
  icon: Icon, 
  label, 
  onClick, 
  variant = 'default',
  disabled = false 
}) => (
  <motion.button
    onClick={onClick}
    disabled={disabled}
    className={clsx(
      "flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200",
      "focus:outline-none focus:ring-2 focus:ring-offset-2",
      variant === 'danger' 
        ? "text-red-600 hover:bg-red-50 focus:ring-red-500" 
        : "text-gray-600 hover:bg-gray-100 focus:ring-gray-500",
      disabled && "opacity-50 cursor-not-allowed"
    )}
    whileHover={!disabled ? { scale: 1.1 } : {}}
    whileTap={!disabled ? { scale: 0.9 } : {}}
    title={label}
  >
    <Icon className="w-4 h-4" />
  </motion.button>
);

export const SortableField: React.FC<SortableFieldProps> = ({
  field,
  isSelected = false,
  isMobile = false,
  onSelect,
  onAction,
  canMoveUp = true,
  canMoveDown = true,
  fieldIndex = 0,
  totalFields = 1
}) => {
  const [showActions, setShowActions] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ 
    id: field.id,
    data: { field }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto'
  };

  const handleAction = (action: 'edit' | 'duplicate' | 'delete' | 'toggle-visibility' | 'move-up' | 'move-down') => {
    onAction(action, field.id);
    setShowActions(false);
  };

  const handleFieldClick = (e: React.MouseEvent) => {
    // Don't select if clicking on action buttons
    if ((e.target as HTMLElement).closest('.action-button')) {
      return;
    }
    onSelect();
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      className={clsx(
        "relative group cursor-pointer",
        isDragging && "opacity-50"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setShowActions(false);
      }}
      onClick={handleFieldClick}
      layout
    >
      <div className="p-4 relative">
        {/* Drag Handle */}
        {!isMobile && (
          <motion.div
            className={clsx(
              "absolute left-2 top-1/2 transform -translate-y-1/2 cursor-grab active:cursor-grabbing",
              "opacity-0 group-hover:opacity-100 transition-opacity duration-200",
              isDragging && "opacity-100"
            )}
            {...attributes}
            {...listeners}
            initial={{ opacity: 0, x: -10 }}
            animate={{ 
              opacity: isHovered || isDragging ? 1 : 0,
              x: isHovered || isDragging ? 0 : -10
            }}
            transition={{ duration: 0.2 }}
          >
            <div className="p-1 bg-white rounded border border-gray-200 shadow-sm">
              <GripVertical className="w-3 h-3 text-gray-400" />
            </div>
          </motion.div>
        )}

        {/* Reorder Buttons - Always visible on hover */}
        {!isMobile && totalFields > 1 && (
          <motion.div
            className={clsx(
              "absolute left-12 top-1/2 transform -translate-y-1/2",
              "flex flex-col space-y-1",
              "opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            )}
            initial={{ opacity: 0, x: -10 }}
            animate={{ 
              opacity: isHovered || isDragging ? 1 : 0,
              x: isHovered || isDragging ? 0 : -10
            }}
            transition={{ duration: 0.2 }}
          >
            {/* Move Up Button */}
            <motion.button
              onClick={() => handleAction('move-up')}
              disabled={!canMoveUp}
              className={clsx(
                "w-6 h-6 rounded-md flex items-center justify-center transition-all duration-200",
                "bg-white border border-gray-200 shadow-sm",
                canMoveUp 
                  ? "text-blue-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700" 
                  : "text-gray-300 cursor-not-allowed",
                "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
              )}
              whileHover={canMoveUp ? { scale: 1.1, y: -1 } : {}}
              whileTap={canMoveUp ? { scale: 0.9 } : {}}
              title={`Move up (${fieldIndex + 1}/${totalFields})`}
            >
              <ChevronUp className="w-4 h-4" />
            </motion.button>
            
            {/* Move Down Button */}
            <motion.button
              onClick={() => handleAction('move-down')}
              disabled={!canMoveDown}
              className={clsx(
                "w-6 h-6 rounded-md flex items-center justify-center transition-all duration-200",
                "bg-white border border-gray-200 shadow-sm",
                canMoveDown 
                  ? "text-blue-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700" 
                  : "text-gray-300 cursor-not-allowed",
                "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
              )}
              whileHover={canMoveDown ? { scale: 1.1, y: 1 } : {}}
              whileTap={canMoveDown ? { scale: 0.9 } : {}}
              title={`Move down (${fieldIndex + 1}/${totalFields})`}
            >
              <ChevronDown className="w-4 h-4" />
            </motion.button>
          </motion.div>
        )}

        {/* Field Preview */}
        <motion.div
          className={clsx(
            "ml-16 mr-12", // Increased left margin for reorder buttons
            isMobile && "ml-0 mr-0"
          )}
          layout
        >
          <EnhancedFieldPreview
            field={field}
            isSelected={isSelected}
            isDragging={isDragging}
            isMobile={isMobile}
          />
        </motion.div>

        {/* Quick Actions - Desktop */}
        {!isMobile && (
          <AnimatePresence>
            {(isHovered || showActions || isSelected) && (
              <motion.div
                className="absolute right-2 top-1/2 transform -translate-y-1/2 action-button"
                initial={{ opacity: 0, x: 10, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 10, scale: 0.9 }}
                transition={{ duration: 0.2 }}
              >
                {showActions ? (
                  <motion.div
                    className="flex items-center space-x-1 bg-white rounded-lg shadow-lg border border-gray-200 p-1"
                    initial={{ width: 0 }}
                    animate={{ width: 'auto' }}
                    exit={{ width: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  >
                    <ActionButton
                      icon={Copy}
                      label="Duplicate"
                      onClick={() => handleAction('duplicate')}
                    />
                    <ActionButton
                      icon={Settings}
                      label="Edit Properties"
                      onClick={() => handleAction('edit')}
                    />
                    <ActionButton
                      icon={field.hidden ? Eye : EyeOff}
                      label={field.hidden ? "Show" : "Hide"}
                      onClick={() => handleAction('toggle-visibility')}
                    />
                    <ActionButton
                      icon={Trash2}
                      label="Delete"
                      onClick={() => handleAction('delete')}
                      variant="danger"
                    />
                  </motion.div>
                ) : (
                  <motion.button
                    onClick={() => setShowActions(true)}
                    className="w-8 h-8 bg-white rounded-lg shadow-sm border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Settings className="w-4 h-4" />
                  </motion.button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        )}

        {/* Mobile Actions - Long Press or Context Menu */}
        {isMobile && isSelected && (
          <motion.div
            className="absolute inset-x-4 -bottom-2 z-10 action-button"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            <div className="flex flex-col space-y-2">
              {/* Primary actions */}
              <div className="flex items-center justify-center space-x-2 bg-white rounded-full shadow-lg border border-gray-200 px-4 py-2">
                <ActionButton
                  icon={Copy}
                  label="Duplicate"
                  onClick={() => handleAction('duplicate')}
                />
                <ActionButton
                  icon={Settings}
                  label="Edit"
                  onClick={() => handleAction('edit')}
                />
                <ActionButton
                  icon={field.hidden ? Eye : EyeOff}
                  label="Toggle visibility"
                  onClick={() => handleAction('toggle-visibility')}
                />
                <ActionButton
                  icon={Trash2}
                  label="Delete"
                  onClick={() => handleAction('delete')}
                  variant="danger"
                />
              </div>
              
              {/* Reorder actions - Only show if more than 1 field */}
              {totalFields > 1 && (
                <div className="flex items-center justify-center space-x-3 bg-blue-50 rounded-full shadow-md border border-blue-200 px-4 py-2">
                  <motion.button
                    onClick={() => handleAction('move-up')}
                    disabled={!canMoveUp}
                    className={clsx(
                      "flex items-center space-x-1 px-3 py-2 rounded-lg font-medium text-sm transition-all duration-200",
                      canMoveUp 
                        ? "bg-blue-600 text-white hover:bg-blue-700 shadow-sm" 
                        : "bg-gray-200 text-gray-400 cursor-not-allowed"
                    )}
                    whileHover={canMoveUp ? { scale: 1.05 } : {}}
                    whileTap={canMoveUp ? { scale: 0.95 } : {}}
                  >
                    <ArrowUp className="w-4 h-4" />
                    <span>Up</span>
                  </motion.button>
                  
                  <div className="text-xs text-blue-700 font-medium px-2">
                    {fieldIndex + 1} / {totalFields}
                  </div>
                  
                  <motion.button
                    onClick={() => handleAction('move-down')}
                    disabled={!canMoveDown}
                    className={clsx(
                      "flex items-center space-x-1 px-3 py-2 rounded-lg font-medium text-sm transition-all duration-200",
                      canMoveDown 
                        ? "bg-blue-600 text-white hover:bg-blue-700 shadow-sm" 
                        : "bg-gray-200 text-gray-400 cursor-not-allowed"
                    )}
                    whileHover={canMoveDown ? { scale: 1.05 } : {}}
                    whileTap={canMoveDown ? { scale: 0.95 } : {}}
                  >
                    <ArrowDown className="w-4 h-4" />
                    <span>Down</span>
                  </motion.button>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Field Status Indicators */}
        <div className="absolute top-2 right-2 flex items-center space-x-1">
          {field.hidden && (
            <motion.div
              className="w-2 h-2 bg-gray-400 rounded-full opacity-60"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              title="Hidden field"
            />
          )}
        </div>
      </div>

      {/* Drag Ghost Effect */}
      {isDragging && (
        <motion.div
          className="absolute inset-0 bg-blue-100 rounded-lg opacity-50 pointer-events-none"
          initial={{ scale: 0.9 }}
          animate={{ scale: 1.05 }}
          transition={{ duration: 0.2 }}
        />
      )}
    </motion.div>
  );
};

export default SortableField;