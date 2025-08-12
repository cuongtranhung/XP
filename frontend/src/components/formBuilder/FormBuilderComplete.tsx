/**
 * Complete Form Builder Integration
 * Combines all 4 phases into a unified experience
 */

import React, { useState, useCallback, useEffect } from 'react';
import { DndContext, DragEndEvent, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  Save, 
  Download, 
  Share2, 
  Settings,
  Eye,
  Code,
  Smartphone,
  Monitor,
  Tablet
} from 'lucide-react';
import { clsx } from 'clsx';

// Context
import { FormBuilderProvider, useFormBuilderContext } from '../../contexts/FormBuilderContext';

// Phase 1 - UI/UX Foundation
import { EnhancedFormBuilderSidebar } from './enhanced/EnhancedFormBuilderSidebar';
import { EnhancedFormCanvas } from './enhanced/EnhancedFormCanvas';
import { MobileNavigation } from './enhanced/MobileNavigation';
import { useMediaQuery } from '../../hooks/useMediaQuery';

// Phase 2 - Enhanced Workflows
import { FormTemplateLibrary } from './enhanced/FormTemplateLibrary';
import { EnhancedPropertiesPanel } from './enhanced/EnhancedPropertiesPanel';
import { QuickActionToolbar } from './enhanced/QuickActionToolbar';

// Phase 3 - Mobile Excellence
import { MobileBottomSheet } from './enhanced/MobileBottomSheet';
import { 
  PWAInstallBanner,
  OfflineIndicator,
  ServiceWorkerUpdateNotification,
  registerServiceWorker
} from './enhanced/PWAInstaller';
import { useMobileGestures, useHapticFeedback } from '../../hooks/useMobileGestures';
import { useNativeShare, useOfflineStatus } from '../../hooks/usePWA';

// Phase 4 - Accessibility
import { AccessibleFormBuilder } from './enhanced/AccessibleFormBuilder';
import { AccessibleFieldList } from './enhanced/AccessibleFieldCard';
import { VoiceCommands } from './enhanced/VoiceCommands';
import { KeyboardShortcutsHelp, KeyboardShortcutsButton } from './enhanced/KeyboardShortcutsHelp';
import { useAnnouncer } from '../../hooks/useScreenReader';
import { useKeyboardNavigation } from '../../hooks/useAccessibility';
import { useFieldReorder } from '../../hooks/useFieldReorder';

// Import styles
import '../../styles/accessibility.css';
import '../../styles/enhanced-drag-drop.css';

type MobilePanel = 'fields' | 'canvas' | 'properties' | 'preview';

interface FormBuilderCompleteProps {
  formId?: string;
  onSave?: (formData: any) => void;
  className?: string;
}

const FormBuilderContent: React.FC = () => {
  const {
    fields,
    selectedField,
    formSettings,
    addField,
    updateField,
    deleteField,
    selectField,
    reorderFields,
    updateFormSettings
  } = useFormBuilderContext();
  
  console.log('[FormBuilderContent] Current fields:', fields);
  console.log('[FormBuilderContent] Fields count:', fields?.length);

  const [showTemplates, setShowTemplates] = useState(false);
  const [showProperties, setShowProperties] = useState(false);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [mobilePanel, setMobilePanel] = useState<'fields' | 'canvas' | 'properties'>('canvas');
  
  const isMobile = useMediaQuery('(max-width: 768px)');
  const isTablet = useMediaQuery('(max-width: 1024px)');
  const announcer = useAnnouncer();
  const haptic = useHapticFeedback();
  const { canShare, shareForm } = useNativeShare();
  const { isOffline } = useOfflineStatus();

  // Field reorder shortcuts
  const fieldReorder = useFieldReorder({
    fields,
    selectedFieldId: selectedField?.id,
    onMoveUp: (fieldId) => {
      const fieldIndex = fields.findIndex(f => f.id === fieldId);
      if (fieldIndex > 0) {
        reorderFields(fieldIndex, fieldIndex - 1);
        announcer.announce(`Moved ${fields[fieldIndex].label} up`);
      }
    },
    onMoveDown: (fieldId) => {
      const fieldIndex = fields.findIndex(f => f.id === fieldId);
      if (fieldIndex < fields.length - 1) {
        reorderFields(fieldIndex, fieldIndex + 1);
        announcer.announce(`Moved ${fields[fieldIndex].label} down`);
      }
    },
    onSelectNext: () => {
      const currentIndex = selectedField ? fields.findIndex(f => f.id === selectedField.id) : -1;
      const nextIndex = currentIndex < fields.length - 1 ? currentIndex + 1 : 0;
      if (fields[nextIndex]) {
        selectField(fields[nextIndex]);
        announcer.announce(`Selected ${fields[nextIndex].label}`);
      }
    },
    onSelectPrevious: () => {
      const currentIndex = selectedField ? fields.findIndex(f => f.id === selectedField.id) : -1;
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : fields.length - 1;
      if (fields[prevIndex]) {
        selectField(fields[prevIndex]);
        announcer.announce(`Selected ${fields[prevIndex].label}`);
      }
    },
    isEnabled: true
  });

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const oldIndex = fields.findIndex(f => f.id === active.id);
      const newIndex = fields.findIndex(f => f.id === over.id);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        reorderFields(oldIndex, newIndex);
        announcer.announce(`Moved field from position ${oldIndex + 1} to ${newIndex + 1}`);
        haptic.success();
      }
    }
  };

  // Handle field actions
  const handleFieldAction = useCallback((action: string, fieldId: string) => {
    const field = fields.find(f => f.id === fieldId);
    if (!field) return;

    switch (action) {
      case 'duplicate':
        const newField = { ...field, id: `${field.id}-copy-${Date.now()}` };
        addField(newField);
        announcer.announceSuccess(`Duplicated ${field.label}`);
        haptic.success();
        break;
        
      case 'delete':
        deleteField(fieldId);
        announcer.announceSuccess(`Deleted ${field.label}`);
        haptic.warning();
        break;
        
      case 'edit':
        selectField(field);
        setShowProperties(true);
        announcer.announce(`Editing ${field.label}`);
        break;
        
      case 'toggle-visibility':
        updateField(fieldId, { hidden: !field.hidden });
        announcer.announce(`${field.hidden ? 'Shown' : 'Hidden'} ${field.label}`);
        break;
        
      default:
        break;
    }
  }, [fields, addField, deleteField, selectField, updateField, announcer, haptic]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Show help with ? key
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        // Don't trigger if user is typing in input/textarea
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA' && target.contentEditable !== 'true') {
          e.preventDefault();
          setShowKeyboardHelp(true);
          announcer.announce('Opened keyboard shortcuts help');
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [announcer]);

  // Handle voice commands
  const handleVoiceCommand = useCallback((command: string) => {
    switch (command) {
      case 'add-field':
        // Open field library
        if (isMobile) {
          setMobilePanel('fields');
        }
        announcer.announce('Opening field library');
        break;
        
      case 'save-form':
        handleSave();
        break;
        
      case 'show-properties':
        setShowProperties(true);
        break;
        
      case 'hide-properties':
        setShowProperties(false);
        break;
        
      case 'show-shortcuts':
        setShowKeyboardHelp(true);
        break;
        
      default:
        break;
    }
  }, [isMobile, announcer]);

  // Save form
  const handleSave = useCallback(() => {
    const formData = {
      settings: formSettings,
      fields,
      timestamp: new Date().toISOString()
    };
    
    // Save to localStorage for offline support
    localStorage.setItem(`form-${formSettings.id || 'draft'}`, JSON.stringify(formData));
    
    announcer.announceSuccess('Form saved successfully');
    haptic.success();
    
    // Trigger save callback if provided
    // onSave?.(formData);
  }, [formSettings, fields, announcer, haptic]);

  // Share form
  const handleShare = useCallback(async () => {
    if (canShare) {
      const success = await shareForm(
        formSettings.id || 'draft',
        formSettings.title || 'Untitled Form'
      );
      
      if (success) {
        announcer.announceSuccess('Form shared successfully');
        haptic.success();
      }
    }
  }, [canShare, shareForm, formSettings, announcer, haptic]);

  // Preview mode switcher
  const PreviewModeSwitcher = () => (
    <div className="flex items-center space-x-2 bg-gray-100 rounded-lg p-1">
      <button
        onClick={() => setPreviewMode('desktop')}
        className={clsx(
          "p-2 rounded transition-colors",
          previewMode === 'desktop'
            ? "bg-white text-gray-900 shadow-sm"
            : "text-gray-600 hover:text-gray-900"
        )}
        aria-label="Desktop preview"
        aria-pressed={previewMode === 'desktop'}
      >
        <Monitor className="w-4 h-4" />
      </button>
      <button
        onClick={() => setPreviewMode('tablet')}
        className={clsx(
          "p-2 rounded transition-colors",
          previewMode === 'tablet'
            ? "bg-white text-gray-900 shadow-sm"
            : "text-gray-600 hover:text-gray-900"
        )}
        aria-label="Tablet preview"
        aria-pressed={previewMode === 'tablet'}
      >
        <Tablet className="w-4 h-4" />
      </button>
      <button
        onClick={() => setPreviewMode('mobile')}
        className={clsx(
          "p-2 rounded transition-colors",
          previewMode === 'mobile'
            ? "bg-white text-gray-900 shadow-sm"
            : "text-gray-600 hover:text-gray-900"
        )}
        aria-label="Mobile preview"
        aria-pressed={previewMode === 'mobile'}
      >
        <Smartphone className="w-4 h-4" />
      </button>
    </div>
  );

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-semibold text-gray-900">
              {formSettings.title || 'Untitled Form'}
            </h1>
            {isOffline && (
              <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded-full">
                Offline Mode
              </span>
            )}
          </div>

          <div className="flex items-center space-x-3">
            {!isMobile && <PreviewModeSwitcher />}
            
            <button
              onClick={() => setShowTemplates(true)}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Templates
            </button>
            
            {!isMobile && (
              <KeyboardShortcutsButton 
                onClick={() => setShowKeyboardHelp(true)}
              />
            )}
            
            <button
              onClick={handleShare}
              className="p-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Share form"
              disabled={!canShare}
            >
              <Share2 className="w-5 h-5" />
            </button>
            
            <motion.button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Save className="w-4 h-4 inline-block mr-2" />
              Save
            </motion.button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {isMobile ? (
          // Mobile Layout
          <>
            <AnimatePresence mode="wait">
              {mobilePanel === 'fields' && (
                <motion.div
                  className="w-full h-full"
                  initial={{ x: -100, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -100, opacity: 0 }}
                >
                  <EnhancedFormBuilderSidebar
                    isMobile
                    onClose={() => setMobilePanel('canvas')}
                  />
                </motion.div>
              )}
              
              {mobilePanel === 'canvas' && (
                <motion.div
                  className="w-full h-full"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <DndContext
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={fields.map(f => f.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <EnhancedFormCanvas
                        isMobile={isMobile}
                      />
                    </SortableContext>
                  </DndContext>
                </motion.div>
              )}
              
              {mobilePanel === 'properties' && selectedField && (
                <motion.div
                  className="w-full h-full"
                  initial={{ x: 100, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: 100, opacity: 0 }}
                >
                  <EnhancedPropertiesPanel
                    field={selectedField}
                    onUpdate={(updates) => updateField(selectedField.id, updates)}
                    onClose={() => setMobilePanel('canvas')}
                    isMobile
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Mobile Navigation */}
            <MobileNavigation
              activePanel={mobilePanel}
              onPanelChange={setMobilePanel}
              fieldCount={fields.length}
            />
          </>
        ) : (
          // Desktop/Tablet Layout
          <>
            {/* Sidebar */}
            <aside className="w-80 bg-white border-r border-gray-200 overflow-y-auto">
              <EnhancedFormBuilderSidebar />
            </aside>

            {/* Canvas */}
            <main className="flex-1 overflow-y-auto">
              <DndContext
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={fields.map(f => f.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <EnhancedFormCanvas
                    isMobile={isMobile}
                  />
                </SortableContext>
              </DndContext>
            </main>

            {/* Properties Panel */}
            <AnimatePresence>
              {showProperties && selectedField && (
                <EnhancedPropertiesPanel
                  field={selectedField}
                  onUpdate={(updates) => updateField(selectedField.id, updates)}
                  onClose={() => setShowProperties(false)}
                />
              )}
            </AnimatePresence>
          </>
        )}
      </div>

      {/* Template Library Modal */}
      <AnimatePresence>
        {showTemplates && (
          <motion.div
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowTemplates(false)}
          >
            <motion.div
              className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <FormTemplateLibrary
                onSelectTemplate={(template) => {
                  // Load template fields
                  announcer.announceSuccess(`Loaded ${template.name} template`);
                  setShowTemplates(false);
                }}
                onCreateCustom={() => setShowTemplates(false)}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Voice Commands */}
      <VoiceCommands onCommand={handleVoiceCommand} />

      {/* Keyboard Shortcuts Help */}
      <KeyboardShortcutsHelp 
        isOpen={showKeyboardHelp}
        onClose={() => setShowKeyboardHelp(false)}
      />
    </div>
  );
};

export const FormBuilderComplete: React.FC<FormBuilderCompleteProps> = ({
  formId,
  onSave,
  className
}) => {
  const [formData, setFormData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Load form data if formId is provided
  useEffect(() => {
    const loadFormData = async () => {
      console.log('[FormBuilderComplete] Loading form with ID:', formId);
      if (formId && formId !== 'new') {
        try {
          const response = await fetch(`/api/forms/${formId}`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          });
          if (response.ok) {
            const data = await response.json();
            console.log('[FormBuilderComplete] Form data loaded:', data);
            console.log('[FormBuilderComplete] Fields count:', data.fields?.length);
            setFormData(data);
          } else {
            console.error('[FormBuilderComplete] Failed to load form, status:', response.status);
          }
        } catch (error) {
          console.error('[FormBuilderComplete] Failed to load form:', error);
        }
      }
      setLoading(false);
    };

    loadFormData();
  }, [formId]);

  // Register service worker
  useEffect(() => {
    registerServiceWorker();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // For new forms, create empty initial data
  const initialFormData = formId === 'new' ? null : formData;
  const initialFields = formId === 'new' ? [] : (formData?.fields || []);
  const initialSteps = formId === 'new' ? [] : (formData?.steps || []);

  console.log('[FormBuilderComplete] Rendering with data:', {
    formId,
    hasFormData: !!initialFormData,
    fieldsCount: initialFields.length,
    formName: initialFormData?.name
  });

  return (
    <FormBuilderProvider 
      initialForm={initialFormData}
      initialFields={initialFields}
      initialSteps={initialSteps}
    >
      <AccessibleFormBuilder className={className}>
        {/* PWA Components */}
        <PWAInstallBanner />
        <OfflineIndicator />
        <ServiceWorkerUpdateNotification />
        
        {/* Main Form Builder */}
        <FormBuilderContent />
      </AccessibleFormBuilder>
    </FormBuilderProvider>
  );
};

export default FormBuilderComplete;