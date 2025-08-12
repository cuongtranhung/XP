/**
 * Enhanced Form Builder Sidebar - Phase 1 Implementation
 * Mobile-optimized sidebar with touch-friendly field cards
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Plus, Grid3x3, Type, Hash, Calendar, CheckSquare, FileText, Image, Mail, Phone, Link, MapPin, Clock } from 'lucide-react';
import { clsx } from 'clsx';
import { useFormBuilderContext } from '../../../contexts/FormBuilderContext';

interface EnhancedFormBuilderSidebarProps {
  isMobile?: boolean;
  onClose?: () => void;
  className?: string;
}

interface FieldType {
  id: string;
  type: string;
  label: string;
  category: 'basic' | 'advanced' | 'layout' | 'media';
  icon: React.ComponentType<any>;
  description: string;
  popular?: boolean;
}

const fieldTypes: FieldType[] = [
  // Basic Fields
  { id: 'text', type: 'text', label: 'Text Input', category: 'basic', icon: Type, description: 'Single line text field', popular: true },
  { id: 'textarea', type: 'textarea', label: 'Textarea', category: 'basic', icon: FileText, description: 'Multi-line text field', popular: true },
  { id: 'email', type: 'email', label: 'Email', category: 'basic', icon: Mail, description: 'Email address field', popular: true },
  { id: 'number', type: 'number', label: 'Number', category: 'basic', icon: Hash, description: 'Numeric input field' },
  { id: 'phone', type: 'tel', label: 'Phone', category: 'basic', icon: Phone, description: 'Phone number field' },
  { id: 'url', type: 'url', label: 'Website', category: 'basic', icon: Link, description: 'URL field' },
  
  // Advanced Fields
  { id: 'select', type: 'select', label: 'Dropdown', category: 'advanced', icon: Grid3x3, description: 'Single selection dropdown', popular: true },
  { id: 'radio', type: 'radio', label: 'Radio Button', category: 'advanced', icon: CheckSquare, description: 'Single choice selection' },
  { id: 'checkbox', type: 'checkbox', label: 'Checkbox', category: 'advanced', icon: CheckSquare, description: 'Multiple choice selection', popular: true },
  { id: 'date', type: 'date', label: 'Date', category: 'advanced', icon: Calendar, description: 'Date picker field' },
  { id: 'time', type: 'time', label: 'Time', category: 'advanced', icon: Clock, description: 'Time picker field' },
  { id: 'datetime', type: 'datetime-local', label: 'Date & Time', category: 'advanced', icon: Calendar, description: 'Date and time picker' },
  
  // Layout Fields
  { id: 'section', type: 'section', label: 'Section', category: 'layout', icon: Grid3x3, description: 'Group fields together' },
  { id: 'divider', type: 'divider', label: 'Divider', category: 'layout', icon: Grid3x3, description: 'Visual separator' },
  
  // Media Fields
  { id: 'file', type: 'file', label: 'File Upload', category: 'media', icon: Image, description: 'File attachment field' },
  { id: 'image', type: 'image', label: 'Image Upload', category: 'media', icon: Image, description: 'Image upload field' }
];

export const EnhancedFormBuilderSidebar: React.FC<EnhancedFormBuilderSidebarProps> = ({ 
  isMobile = false, 
  onClose,
  className 
}) => {
  const { addField } = useFormBuilderContext();
  const [searchQuery, setSearchQuery] = useState('');

  // Filter fields based on search only - show all fields in one list
  const filteredFields = fieldTypes.filter(field => {
    const matchesSearch = field.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         field.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesSearch;
  });

  const handleFieldDrop = (fieldType: FieldType) => {
    // Use the addField method from context which expects a FieldType string
    addField(fieldType.type as any);
    
    if (isMobile && onClose) {
      onClose();
    }
  };

  return (
    <motion.div 
      className={clsx(
        "flex flex-col h-full bg-white",
        isMobile ? "w-full" : "w-80",
        className
      )}
      initial={isMobile ? { x: -320, opacity: 0 } : { opacity: 0 }}
      animate={isMobile ? { x: 0, opacity: 1 } : { opacity: 1 }}
      exit={isMobile ? { x: -320, opacity: 0 } : { opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      {/* Header */}
      <motion.div 
        className="flex items-center justify-between p-4 border-b border-gray-200"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Plus className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Add Fields</h3>
            <p className="text-xs text-gray-500">Drag or tap to add</p>
          </div>
        </div>
        
        {isMobile && onClose && (
          <motion.button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <X className="w-5 h-5 text-gray-500" />
          </motion.button>
        )}
      </motion.div>

      {/* Search */}
      <motion.div 
        className="p-4 border-b border-gray-200"
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search fields..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </motion.div>


      {/* Fields List */}
      <div className="flex-1 overflow-y-auto p-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={`fields-${searchQuery}`}
            className="space-y-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {filteredFields.length === 0 ? (
              <motion.div
                className="text-center py-8"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
              >
                <Search className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No fields found</p>
                <p className="text-gray-400 text-xs">Try a different search term</p>
              </motion.div>
            ) : (
              filteredFields.map((field, index) => {
                const Icon = field.icon;
                return (
                  <motion.div
                    key={field.id}
                    className={clsx(
                      "group relative bg-white rounded-xl border-2 border-gray-200 transition-all duration-200",
                      "hover:border-blue-400 hover:bg-gray-50 hover:shadow-lg hover:shadow-blue-100/50",
                      isMobile 
                        ? "p-4 active:scale-95 active:bg-blue-50" 
                        : "p-4 hover:scale-[1.02]"
                    )}
                    drag={!isMobile}
                    dragSnapToOrigin
                    whileHover={!isMobile ? { y: -2, scale: 1.02 } : {}}
                    whileTap={{ scale: 0.98 }}
                    whileDrag={{ scale: 1.1, rotate: 3, zIndex: 50 }}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + (index * 0.05) }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <div className={clsx(
                          "w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200",
                          "bg-gray-100 text-gray-600 group-hover:bg-blue-100 group-hover:text-blue-600",
                          "group-hover:scale-110"
                        )}>
                          <Icon className="w-6 h-6" />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            <h4 className="font-medium text-gray-900">
                              {field.label}
                            </h4>
                            {field.popular && (
                              <span className="px-2 py-0.5 text-xs bg-gradient-to-r from-orange-100 to-yellow-100 text-orange-700 rounded-full font-medium">
                                ⭐ Popular
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500">
                            {field.description}
                          </p>
                        </div>
                      </div>

                      {/* Add Button - Always visible */}
                      <motion.button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFieldDrop(field);
                        }}
                        className={clsx(
                          "ml-3 flex items-center justify-center rounded-lg font-medium text-sm transition-all duration-200",
                          "bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg",
                          isMobile ? "w-10 h-10" : "w-8 h-8 group-hover:w-20"
                        )}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        aria-label={`Add ${field.label} field`}
                      >
                        <Plus className={clsx(
                          "transition-all duration-200",
                          isMobile ? "w-5 h-5" : "w-4 h-4 group-hover:w-4 group-hover:h-4"
                        )} />
                        {!isMobile && (
                          <motion.span
                            className="ml-2 whitespace-nowrap overflow-hidden"
                            initial={{ opacity: 0, width: 0 }}
                            animate={{ opacity: 0, width: 0 }}
                            whileHover={{ opacity: 1, width: "auto" }}
                            transition={{ duration: 0.2 }}
                          >
                            Add
                          </motion.span>
                        )}
                      </motion.button>
                    </div>

                    {/* Drag indicator for desktop */}
                    {!isMobile && (
                      <motion.div
                        className="absolute -left-1 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
                        initial={{ x: -10 }}
                        animate={{ x: 0 }}
                        transition={{ delay: 0.1 }}
                      >
                        <div className="w-1 h-8 bg-gradient-to-b from-blue-400 to-blue-600 rounded-full"></div>
                      </motion.div>
                    )}

                  </motion.div>
                );
              })
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer */}
      <motion.div 
        className="p-4 border-t border-gray-200 bg-gray-50"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        <p className="text-xs text-gray-500 text-center">
          {isMobile ? 'Tap fields to add them to your form' : 'Drag fields to add them to your form'}
        </p>
      </motion.div>
    </motion.div>
  );
};

export default EnhancedFormBuilderSidebar;