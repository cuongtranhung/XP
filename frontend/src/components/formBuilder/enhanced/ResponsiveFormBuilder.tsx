/**
 * Enhanced Responsive Form Builder - Phase 1 Implementation
 * Mobile-first responsive design with modern UI/UX improvements
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Plus, Eye, Settings, Save } from 'lucide-react';
import { clsx } from 'clsx';
import { useFormBuilderContext } from '../../../contexts/FormBuilderContext';
import { EnhancedFormBuilderSidebar } from './EnhancedFormBuilderSidebar';
import { EnhancedFormCanvas } from './EnhancedFormCanvas';
import { MobileNavigation } from './MobileNavigation';
import { useMediaQuery } from '../../../hooks/useMediaQuery';

interface ResponsiveFormBuilderProps {
  className?: string;
}

type ViewMode = 'build' | 'preview' | 'settings';
type MobilePanel = 'fields' | 'canvas' | 'properties' | 'preview';

export const ResponsiveFormBuilder: React.FC<ResponsiveFormBuilderProps> = ({ 
  className 
}) => {
  const { selectedField, form } = useFormBuilderContext();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const isTablet = useMediaQuery('(max-width: 1024px)');
  
  // Mobile state management
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [mobileActivePanel, setMobileActivePanel] = useState<MobilePanel>('canvas');
  
  // Desktop state management
  const [viewMode, setViewMode] = useState<ViewMode>('build');
  const [isPropertiesPanelOpen, setIsPropertiesPanelOpen] = useState(false);

  // Auto-open properties panel when field is selected
  useEffect(() => {
    if (selectedField && !isMobile) {
      setIsPropertiesPanelOpen(true);
    }
  }, [selectedField, isMobile]);

  // Handle mobile sidebar toggle
  const toggleMobileSidebar = () => {
    setIsMobileSidebarOpen(!isMobileSidebarOpen);
  };

  // Handle mobile panel switching
  const handleMobilePanelChange = (panel: MobilePanel) => {
    setMobileActivePanel(panel);
    if (panel === 'fields') {
      setIsMobileSidebarOpen(true);
    } else {
      setIsMobileSidebarOpen(false);
    }
  };

  if (isMobile) {
    return (
      <motion.div 
        className={clsx("h-screen flex flex-col bg-gray-50", className)}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {/* Mobile Header */}
        <motion.header 
          className="bg-white border-b border-gray-200 px-4 py-3 shadow-sm"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <motion.button
                onClick={toggleMobileSidebar}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {isMobileSidebarOpen ? (
                  <X className="w-5 h-5 text-gray-600" />
                ) : (
                  <Menu className="w-5 h-5 text-gray-600" />
                )}
              </motion.button>
              <div>
                <h1 className="text-lg font-semibold text-gray-900 truncate max-w-40">
                  {form?.name || 'New Form'}
                </h1>
                <p className="text-xs text-gray-500">Form Builder</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <motion.button
                className="p-2 bg-blue-600 text-white rounded-lg shadow-sm"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Save className="w-4 h-4" />
              </motion.button>
            </div>
          </div>
        </motion.header>

        {/* Mobile Content */}
        <div className="flex-1 relative overflow-hidden">
          <AnimatePresence mode="wait">
            {mobileActivePanel === 'canvas' && (
              <motion.div
                key="canvas"
                className="absolute inset-0"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <EnhancedFormCanvas isMobile={true} />
              </motion.div>
            )}
            
            {mobileActivePanel === 'properties' && selectedField && (
              <motion.div
                key="properties"
                className="absolute inset-0 bg-white"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                {/* Mobile Properties Panel - to be implemented */}
                <div className="p-4">
                  <h2 className="text-lg font-semibold">Field Properties</h2>
                  <p className="text-gray-600">{selectedField.fieldType} field</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Mobile Sidebar Overlay */}
          <AnimatePresence>
            {isMobileSidebarOpen && (
              <>
                <motion.div
                  className="absolute inset-0 bg-black bg-opacity-50 z-40"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={toggleMobileSidebar}
                />
                <motion.div
                  className="absolute left-0 top-0 bottom-0 w-80 bg-white z-50 shadow-xl"
                  initial={{ x: -320 }}
                  animate={{ x: 0 }}
                  exit={{ x: -320 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                >
                  <EnhancedFormBuilderSidebar 
                    isMobile={true}
                    onClose={toggleMobileSidebar}
                  />
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Mobile Bottom Navigation */}
        <MobileNavigation
          activePanel={mobileActivePanel}
          onPanelChange={handleMobilePanelChange}
          hasSelectedField={!!selectedField}
        />
      </motion.div>
    );
  }

  // Desktop/Tablet Layout
  return (
    <motion.div 
      className={clsx("flex h-screen bg-gray-50", className)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Desktop Sidebar */}
      <motion.aside 
        className={clsx(
          "transition-all duration-300 bg-white border-r border-gray-200 shadow-sm",
          isTablet ? "w-72" : "w-80"
        )}
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <EnhancedFormBuilderSidebar />
      </motion.aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Desktop Header */}
        <motion.header 
          className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  {form?.name || 'New Form'}
                </h1>
                <p className="text-sm text-gray-500">Form Builder</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {/* View Mode Toggle */}
              <div className="flex items-center bg-gray-100 rounded-lg p-1">
                {[
                  { mode: 'build' as ViewMode, icon: Plus, label: 'Build' },
                  { mode: 'preview' as ViewMode, icon: Eye, label: 'Preview' },
                  { mode: 'settings' as ViewMode, icon: Settings, label: 'Settings' }
                ].map(({ mode, icon: Icon, label }) => (
                  <motion.button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className={clsx(
                      "px-4 py-2 rounded-md text-sm font-medium transition-all duration-200",
                      viewMode === mode
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                    )}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Icon className="w-4 h-4 inline-block mr-2" />
                    {label}
                  </motion.button>
                ))}
              </div>

              <motion.button
                className="px-4 py-2 bg-blue-600 text-white rounded-lg shadow-sm hover:bg-blue-700 transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Save className="w-4 h-4 inline-block mr-2" />
                Save
              </motion.button>
            </div>
          </div>
        </motion.header>

        {/* Desktop Content */}
        <div className="flex-1 flex overflow-hidden">
          <motion.main 
            className="flex-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <EnhancedFormCanvas />
          </motion.main>

          {/* Desktop Properties Panel */}
          <AnimatePresence>
            {isPropertiesPanelOpen && selectedField && (
              <motion.aside
                className="w-96 bg-white border-l border-gray-200 shadow-sm"
                initial={{ x: 384, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 384, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              >
                {/* Enhanced Properties Panel - to be implemented */}
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">Field Properties</h2>
                    <button
                      onClick={() => setIsPropertiesPanelOpen(false)}
                      className="p-1 hover:bg-gray-100 rounded-lg"
                    >
                      <X className="w-5 h-5 text-gray-500" />
                    </button>
                  </div>
                  <p className="text-gray-600">{selectedField.fieldType} field</p>
                </div>
              </motion.aside>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};

export default ResponsiveFormBuilder;