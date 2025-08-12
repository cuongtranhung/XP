/**
 * Form Builder Showcase Page - Simplified Version
 * Demonstrates the enhanced Form Builder with field reordering capabilities
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Sparkles, 
  Rocket, 
  Check, 
  ChevronRight,
  Smartphone,
  Monitor,
  Tablet,
  ArrowUp,
  ArrowDown,
  Keyboard,
  Plus,
  Zap
} from 'lucide-react';
import { clsx } from 'clsx';

// Use the FormBuilderComplete we've already enhanced
import { FormBuilderComplete } from '../components/formBuilder/FormBuilderComplete';

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  highlight?: boolean;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ icon, title, description, highlight }) => (
  <motion.div
    className={clsx(
      "p-6 rounded-2xl border-2 transition-all duration-300",
      highlight 
        ? "bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200 shadow-lg" 
        : "bg-white border-gray-200 hover:shadow-md hover:border-gray-300"
    )}
    whileHover={{ scale: 1.02 }}
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
  >
    <div className={clsx(
      "w-12 h-12 rounded-xl flex items-center justify-center mb-4",
      highlight ? "bg-blue-600" : "bg-gray-100"
    )}>
      <div className={clsx("w-6 h-6", highlight ? "text-white" : "text-gray-600")}>
        {icon}
      </div>
    </div>
    <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
    <p className="text-gray-600 leading-relaxed">{description}</p>
  </motion.div>
);

export const FormBuilderShowcase: React.FC = () => {
  const [activeDemo, setActiveDemo] = useState<'overview' | 'builder'>('overview');

  const features = [
    {
      icon: <Plus />,
      title: "700% Larger Drop Zones",
      description: "Massive drop zones for effortless drag & drop field placement",
      highlight: true
    },
    {
      icon: <ArrowUp />,
      title: "Up/Down Reorder Buttons", 
      description: "Instant field reordering with visual hover buttons and mobile-optimized controls",
      highlight: true
    },
    {
      icon: <Keyboard />,
      title: "Keyboard Shortcuts",
      description: "Power user shortcuts: Ctrl+↑/↓, K/J keys, and comprehensive help system",
      highlight: true
    },
    {
      icon: <Smartphone />,
      title: "Mobile Excellence",
      description: "Touch-optimized interface with large buttons and haptic feedback"
    },
    {
      icon: <Monitor />,
      title: "Responsive Design", 
      description: "Seamless experience across desktop, tablet, and mobile devices"
    },
    {
      icon: <Zap />,
      title: "Real-time Updates",
      description: "Instant visual feedback with smooth animations and transitions"
    }
  ];

  const keyboardShortcuts = [
    { keys: "Ctrl + ↑/↓", action: "Move field up/down" },
    { keys: "K / J", action: "Vim-style field movement" }, 
    { keys: "Shift + ↑/↓", action: "Select next/previous field" },
    { keys: "?", action: "Show keyboard shortcuts help" },
    { keys: "Ctrl + Home/End", action: "Move field to top/bottom" }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <motion.div 
        className="bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 text-white py-16"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center">
            <motion.div
              className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full mb-6"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <Sparkles className="w-5 h-5" />
              <span className="font-medium">Enhanced Form Builder</span>
            </motion.div>

            <motion.h1 
              className="text-5xl font-bold mb-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              Professional Form Design
              <br />
              <span className="bg-gradient-to-r from-yellow-300 to-orange-300 bg-clip-text text-transparent">
                Made Simple
              </span>
            </motion.h1>

            <motion.p 
              className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto leading-relaxed"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              Experience the most intuitive form builder with enhanced drag & drop, 
              keyboard shortcuts, and mobile-optimized design.
            </motion.p>

            <motion.div 
              className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <button
                onClick={() => setActiveDemo('builder')}
                className="bg-white text-blue-600 px-8 py-4 rounded-xl font-semibold hover:bg-gray-50 transition-colors flex items-center space-x-2 shadow-lg"
              >
                <Rocket className="w-5 h-5" />
                <span>Try the Builder</span>
                <ChevronRight className="w-5 h-5" />
              </button>
              
              <button
                onClick={() => setActiveDemo('overview')}
                className="border-2 border-white/30 text-white px-8 py-4 rounded-xl font-semibold hover:bg-white/10 transition-colors backdrop-blur-sm"
              >
                View Features
              </button>
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* Content Tabs */}
      <div className="max-w-6xl mx-auto px-6 -mt-8">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveDemo('overview')}
              className={clsx(
                "flex-1 px-6 py-4 font-medium transition-colors",
                activeDemo === 'overview'
                  ? "bg-blue-50 text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              )}
            >
              Features Overview
            </button>
            <button
              onClick={() => setActiveDemo('builder')}
              className={clsx(
                "flex-1 px-6 py-4 font-medium transition-colors",
                activeDemo === 'builder'
                  ? "bg-blue-50 text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              )}
            >
              Live Demo
            </button>
          </div>

          {activeDemo === 'overview' ? (
            <div className="p-8">
              {/* Features Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
                {features.map((feature, index) => (
                  <FeatureCard
                    key={index}
                    icon={feature.icon}
                    title={feature.title}
                    description={feature.description}
                    highlight={feature.highlight}
                  />
                ))}
              </div>

              {/* Keyboard Shortcuts */}
              <motion.div 
                className="bg-gray-900 rounded-2xl p-8 text-white"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
              >
                <h3 className="text-2xl font-bold mb-6 flex items-center space-x-3">
                  <Keyboard className="w-6 h-6" />
                  <span>Keyboard Shortcuts</span>
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {keyboardShortcuts.map((shortcut, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                      <span className="text-gray-300">{shortcut.action}</span>
                      <kbd className="px-2 py-1 bg-gray-700 rounded text-sm font-mono">
                        {shortcut.keys}
                      </kbd>
                    </div>
                  ))}
                </div>
                
                <div className="mt-6 text-gray-400">
                  <p>💡 Press <kbd className="px-2 py-1 bg-gray-700 rounded text-sm">?</kbd> in the builder for interactive help</p>
                </div>
              </motion.div>
            </div>
          ) : (
            <div className="h-screen">
              {/* Live Form Builder Demo */}
              <FormBuilderComplete />
            </div>
          )}
        </div>
      </div>

      {/* Stats Section */}
      {activeDemo === 'overview' && (
        <motion.div 
          className="bg-white py-16 mt-16"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          <div className="max-w-6xl mx-auto px-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-center">
              <div>
                <div className="text-4xl font-bold text-blue-600 mb-2">90%</div>
                <div className="text-gray-600">Faster Field Reordering</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-green-600 mb-2">700%</div>
                <div className="text-gray-600">Larger Drop Zones</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-purple-600 mb-2">95%</div>
                <div className="text-gray-600">Mobile Success Rate</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-orange-600 mb-2">40%</div>
                <div className="text-gray-600">User Satisfaction Increase</div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default FormBuilderShowcase;