/**
 * Enhanced Form Canvas - Phase 1 Implementation
 * Responsive canvas with improved drop zones and visual feedback
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DragOverlay } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { clsx } from 'clsx';
import { Plus, Eye, Settings, Trash2, Copy, GripVertical } from 'lucide-react';
import { useFormBuilderContext } from '../../../contexts/FormBuilderContext';
import { EnhancedFieldPreview } from './EnhancedFieldPreview';
import { SortableField } from './SortableField';

interface EnhancedFormCanvasProps {
  isMobile?: boolean;
  className?: string;
  isDragging?: boolean;
  activeId?: string | null;
  draggedField?: any;
}

export const EnhancedFormCanvas: React.FC<EnhancedFormCanvasProps> = ({ 
  isMobile = false,
  className,
  isDragging = false,
  activeId = null,
  draggedField = null
}) => {
  const { 
    form, 
    fields, 
    selectedField, 
    selectField, 
    deleteField, 
    reorderFields,
    addField,
    updateField,
    saveForm
  } = useFormBuilderContext();
  
  // Add duplicateField method since it's not in the context
  const duplicateField = (fieldId: string) => {
    const field = fields.find(f => f.id === fieldId);
    if (field) {
      const newField = {
        ...field,
        id: `field-${Date.now()}`,
        label: `${field.label} (Copy)`,
        position: field.position + 1
      };
      // Use addFieldAtPosition from context if available
      // For now, we'll use a simple approach
      console.log('Duplicating field:', newField);
    }
  };

  const showDropZone = isDragging;

  const handleFieldSelect = (fieldId: string) => {
    const field = fields.find(f => f.id === fieldId);
    if (field) {
      selectField(field);
    }
  };

  const handleFieldAction = (action: 'edit' | 'duplicate' | 'delete' | 'toggle-visibility' | 'move-up' | 'move-down', fieldId: string) => {
    const fieldIndex = fields.findIndex(f => f.id === fieldId);
    const field = fields.find(f => f.id === fieldId);
    
    switch (action) {
      case 'edit':
        if (field) {
          selectField(field);
        }
        break;
      case 'duplicate':
        duplicateField(fieldId);
        break;
      case 'delete':
        deleteField(fieldId);
        break;
      case 'toggle-visibility':
        // Implement toggle visibility logic
        console.log('Toggle visibility for field:', fieldId);
        break;
      case 'move-up':
        if (fieldIndex > 0) {
          reorderFields(fieldIndex, fieldIndex - 1);
          // Haptic feedback for successful move
          if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            navigator.vibrate(50); // Light haptic feedback
          }
        }
        break;
      case 'move-down':
        if (fieldIndex < fields.length - 1) {
          reorderFields(fieldIndex, fieldIndex + 1);
          // Haptic feedback for successful move
          if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            navigator.vibrate(50); // Light haptic feedback
          }
        }
        break;
    }
  };

  // Empty state when no fields
  if (!fields.length && !isDragging) {
    return (
      <motion.div 
        className={clsx(
          "flex-1 flex items-center justify-center p-8",
          className
        )}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <motion.div
          className="text-center max-w-md mx-auto"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
        >
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Plus className="w-12 h-12 text-gray-400" />
          </div>
          
          <h3 className="text-xl font-semibold text-gray-900 mb-3">
            Start Building Your Form
          </h3>
          
          <p className="text-gray-600 mb-6 leading-relaxed">
            {isMobile 
              ? "Tap the menu button and select fields from the sidebar to add them to your form."
              : "Drag and drop fields from the sidebar to build your form. You can also reorder fields by dragging them up or down."
            }
          </p>
          
          <div className="flex items-center justify-center space-x-4 text-sm text-gray-500">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-blue-200 rounded-full"></div>
              <span>{isMobile ? 'Tap to add' : 'Drag to add'}</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-200 rounded-full"></div>
              <span>Click to edit</span>
            </div>
          </div>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      className={clsx(
        "flex-1 flex flex-col bg-gray-50",
        className
      )}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.1 }}
    >
      {/* Form Header */}
      <motion.div 
        className="bg-white border-b border-gray-200 p-6"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {form?.name || 'Untitled Form'}
              </h2>
              <p className="text-gray-600 text-sm">
                {form?.description || 'Form description will appear here'}
              </p>
            </div>
            
            <div className="flex items-center space-x-3">
              <motion.button
                className="flex items-center space-x-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Eye className="w-4 h-4" />
                <span className="text-sm font-medium">Preview</span>
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Canvas Area */}
      <div className="flex-1 overflow-y-auto">
        <div className={clsx(
          "max-w-4xl mx-auto p-6",
          isMobile ? "px-4 py-4" : "px-6 py-8"
        )}>
          <SortableContext items={fields.map(f => f.id)} strategy={verticalListSortingStrategy}>
              <motion.div 
                className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
                initial={{ scale: 0.98, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                {/* Enhanced Drop zone indicator */}
                <AnimatePresence>
                  {showDropZone && fields.length === 0 && (
                    <motion.div
                      className="relative"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ type: "spring", stiffness: 300 }}
                    >
                      {/* Large drop zone */}
                      <motion.div
                        className={clsx(
                          "border-3 border-dashed rounded-2xl flex items-center justify-center relative overflow-hidden",
                          "bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50",
                          "border-blue-300 hover:border-blue-400 transition-colors",
                          isMobile ? "h-48 mx-4 my-6" : "h-64 mx-8 my-8"
                        )}
                        animate={{
                          borderColor: ["rgb(147 197 253)", "rgb(99 102 241)", "rgb(147 197 253)"],
                        }}
                        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                      >
                        {/* Animated background */}
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-r from-blue-400/10 to-purple-400/10"
                          animate={{
                            background: [
                              "linear-gradient(90deg, rgb(96 165 250 / 0.1) 0%, rgb(168 85 247 / 0.1) 100%)",
                              "linear-gradient(90deg, rgb(168 85 247 / 0.1) 0%, rgb(96 165 250 / 0.1) 100%)",
                              "linear-gradient(90deg, rgb(96 165 250 / 0.1) 0%, rgb(168 85 247 / 0.1) 100%)"
                            ]
                          }}
                          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                        />

                        {/* Content */}
                        <div className="text-center z-10 relative">
                          <motion.div
                            className="mb-4"
                            animate={{ y: [0, -10, 0] }}
                            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                          >
                            <div className="w-16 h-16 mx-auto bg-white rounded-2xl shadow-lg flex items-center justify-center mb-4">
                              <Plus className="w-8 h-8 text-blue-500" />
                            </div>
                          </motion.div>
                          
                          <h3 className="text-xl font-bold text-gray-900 mb-2">
                            Drop your field here
                          </h3>
                          
                          <p className="text-blue-600 font-medium mb-1">
                            Large drop zone for easy targeting
                          </p>
                          
                          <p className="text-gray-500 text-sm">
                            {isMobile 
                              ? "Tap the + button next to any field type to add it"
                              : "Drag from sidebar or use + buttons for quick adding"
                            }
                          </p>

                          {/* Visual indicators */}
                          <div className="flex items-center justify-center space-x-6 mt-6">
                            <div className="flex items-center space-x-2">
                              <div className="w-4 h-4 bg-blue-400 rounded-full animate-pulse"></div>
                              <span className="text-sm text-gray-600">Drag & Drop</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <div className="w-4 h-4 bg-green-400 rounded-full animate-pulse"></div>
                              <span className="text-sm text-gray-600">Quick Add</span>
                            </div>
                          </div>
                        </div>

                        {/* Corner decorations */}
                        <div className="absolute top-4 left-4 w-6 h-6 border-l-2 border-t-2 border-blue-400 rounded-tl-lg opacity-50"></div>
                        <div className="absolute top-4 right-4 w-6 h-6 border-r-2 border-t-2 border-blue-400 rounded-tr-lg opacity-50"></div>
                        <div className="absolute bottom-4 left-4 w-6 h-6 border-l-2 border-b-2 border-blue-400 rounded-bl-lg opacity-50"></div>
                        <div className="absolute bottom-4 right-4 w-6 h-6 border-r-2 border-b-2 border-blue-400 rounded-br-lg opacity-50"></div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Fields List */}
                <div className="divide-y divide-gray-100">
                  {fields.map((field, index) => (
                    <motion.div
                      key={field.id}
                      className="relative group"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 * index }}
                      layout
                    >
                      <SortableField
                        field={field}
                        isSelected={selectedField?.id === field.id}
                        isMobile={isMobile}
                        onSelect={() => handleFieldSelect(field.id)}
                        onAction={handleFieldAction}
                        canMoveUp={index > 0}
                        canMoveDown={index < fields.length - 1}
                        fieldIndex={index}
                        totalFields={fields.length}
                      />
                      
                      {/* Enhanced Drop zone between fields */}
                      <AnimatePresence>
                        {showDropZone && (
                          <motion.div
                            className={clsx(
                              "relative border-2 border-dashed border-transparent rounded-xl transition-all duration-200",
                              "hover:border-blue-300 hover:bg-blue-50/50",
                              isMobile ? "h-12 -my-2 mx-2" : "h-16 -my-3 mx-4"
                            )}
                            initial={{ opacity: 0, scaleY: 0, height: 0 }}
                            animate={{ opacity: 1, scaleY: 1, height: isMobile ? 48 : 64 }}
                            exit={{ opacity: 0, scaleY: 0, height: 0 }}
                            transition={{ duration: 0.3, type: "spring" }}
                            whileHover={{ 
                              borderColor: "rgb(59 130 246)",
                              backgroundColor: "rgb(59 130 246 / 0.05)"
                            }}
                          >
                            {/* Drop indicator */}
                            <motion.div
                              className="absolute inset-0 flex items-center justify-center"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: 0.2 }}
                            >
                              <div className="flex items-center space-x-3">
                                <motion.div
                                  className="h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent flex-1"
                                  style={{ width: "120px" }}
                                  initial={{ scaleX: 0 }}
                                  animate={{ scaleX: 1 }}
                                  transition={{ delay: 0.3, duration: 0.3 }}
                                />
                                <motion.div
                                  className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center shadow-md"
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  transition={{ delay: 0.4, type: "spring", stiffness: 500 }}
                                >
                                  <Plus className="w-3 h-3 text-white" />
                                </motion.div>
                                <motion.div
                                  className="h-0.5 bg-gradient-to-r from-blue-400 via-blue-400 to-transparent flex-1"
                                  style={{ width: "120px" }}
                                  initial={{ scaleX: 0 }}
                                  animate={{ scaleX: 1 }}
                                  transition={{ delay: 0.3, duration: 0.3 }}
                                />
                              </div>
                            </motion.div>

                            {/* Hover text */}
                            <motion.div
                              className="absolute top-full left-1/2 transform -translate-x-1/2 mt-1"
                              initial={{ opacity: 0, y: -5 }}
                              animate={{ opacity: 0, y: 0 }}
                              whileHover={{ opacity: 1 }}
                              transition={{ duration: 0.2 }}
                            >
                              <span className="text-xs text-blue-600 bg-white px-2 py-1 rounded-md shadow-sm border">
                                Drop here to insert
                              </span>
                            </motion.div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  ))}
                </div>

                {/* Enhanced Bottom drop zone */}
                <AnimatePresence>
                  {showDropZone && fields.length > 0 && (
                    <motion.div
                      className="relative"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ type: "spring", stiffness: 300, delay: 0.1 }}
                    >
                      <motion.div
                        className={clsx(
                          "border-3 border-dashed rounded-xl flex items-center justify-center relative overflow-hidden",
                          "bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50",
                          "border-blue-300 hover:border-blue-400 transition-all duration-200",
                          "group cursor-pointer",
                          isMobile ? "h-20 mx-4 my-4" : "h-24 mx-6 my-6"
                        )}
                        whileHover={{ 
                          scale: 1.02,
                          borderColor: "rgb(59 130 246)",
                          backgroundColor: "rgb(59 130 246 / 0.05)"
                        }}
                        animate={{
                          borderColor: ["rgb(147 197 253)", "rgb(99 102 241)", "rgb(147 197 253)"],
                        }}
                        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                      >
                        {/* Animated gradient background */}
                        <motion.div
                          className="absolute inset-0 opacity-30"
                          animate={{
                            background: [
                              "linear-gradient(90deg, rgb(59 130 246 / 0.1) 0%, rgb(99 102 241 / 0.1) 100%)",
                              "linear-gradient(90deg, rgb(99 102 241 / 0.1) 0%, rgb(59 130 246 / 0.1) 100%)",
                              "linear-gradient(90deg, rgb(59 130 246 / 0.1) 0%, rgb(99 102 241 / 0.1) 100%)"
                            ]
                          }}
                          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                        />

                        {/* Content */}
                        <div className="flex items-center space-x-4 text-blue-600 z-10 relative">
                          <motion.div
                            className="w-10 h-10 bg-white rounded-xl shadow-md flex items-center justify-center"
                            animate={{ 
                              y: [0, -8, 0],
                              rotate: [0, 5, -5, 0] 
                            }}
                            transition={{ 
                              duration: 2.5, 
                              repeat: Infinity, 
                              ease: "easeInOut" 
                            }}
                          >
                            <Plus className="w-5 h-5 text-blue-500" />
                          </motion.div>
                          
                          <div className="text-left">
                            <p className="font-bold text-blue-700">
                              Drop here to add to end
                            </p>
                            <p className="text-sm text-blue-500">
                              Large target area for easy drops
                            </p>
                          </div>

                          {/* Arrow indicators */}
                          <div className="flex space-x-1">
                            {[0, 1, 2].map((i) => (
                              <motion.div
                                key={i}
                                className="w-2 h-2 bg-blue-400 rounded-full"
                                animate={{ 
                                  scale: [1, 1.5, 1],
                                  opacity: [0.4, 1, 0.4]
                                }}
                                transition={{ 
                                  duration: 1.5, 
                                  repeat: Infinity, 
                                  delay: i * 0.2,
                                  ease: "easeInOut"
                                }}
                              />
                            ))}
                          </div>
                        </div>

                        {/* Pulse effect on hover */}
                        <motion.div
                          className="absolute inset-0 bg-blue-400 rounded-xl opacity-0 group-hover:opacity-10"
                          animate={{ 
                            scale: [1, 1.05, 1],
                            opacity: [0, 0.1, 0]
                          }}
                          transition={{ 
                            duration: 2, 
                            repeat: Infinity, 
                            ease: "easeInOut" 
                          }}
                        />
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Form footer */}
                {fields.length > 0 && (
                  <motion.div 
                    className="p-6 bg-gray-50 border-t border-gray-100"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-500">
                        {fields.length} {fields.length === 1 ? 'field' : 'fields'} in this form
                      </p>
                      
                      <motion.button
                        className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium shadow-sm hover:bg-blue-700 transition-colors"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={async () => {
                          if (saveForm) {
                            try {
                              await saveForm();
                            } catch (error) {
                              console.error('Error saving form:', error);
                            }
                          }
                        }}
                      >
                        Save Form
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            </SortableContext>

            {/* Drag overlay for field reordering */}
            <DragOverlay>
              {activeId && draggedField ? (
                <motion.div
                  className="bg-white rounded-lg shadow-xl border border-gray-200 p-4 cursor-grabbing transform rotate-3"
                  initial={{ scale: 1.05 }}
                  animate={{ scale: 1.1 }}
                >
                  <EnhancedFieldPreview field={draggedField} isDragging />
                </motion.div>
              ) : null}
            </DragOverlay>
        </div>
      </div>
    </motion.div>
  );
};

export default EnhancedFormCanvas;