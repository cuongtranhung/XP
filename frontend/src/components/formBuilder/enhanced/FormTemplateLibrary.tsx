/**
 * Form Template Library - Phase 2 Implementation
 * Pre-built templates and template management system
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  Filter, 
  Grid3x3, 
  List, 
  Star, 
  Clock, 
  Users,
  FileText,
  MessageSquare,
  UserPlus,
  Package,
  CreditCard,
  Calendar,
  HelpCircle,
  Plus,
  Download,
  Upload,
  Sparkles
} from 'lucide-react';
import { clsx } from 'clsx';

export interface FormTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: React.ComponentType<any>;
  fieldCount: number;
  estimatedTime: string;
  popularity: number;
  tags: string[];
  preview?: string;
  isPremium?: boolean;
  isNew?: boolean;
  fields: any[];
}

interface FormTemplateLibraryProps {
  onSelectTemplate: (template: FormTemplate) => void;
  onCreateCustom?: () => void;
  className?: string;
}

// Pre-built form templates
const formTemplates: FormTemplate[] = [
  {
    id: 'contact-form',
    name: 'Contact Form',
    description: 'Simple contact form with name, email, and message fields',
    category: 'Contact',
    icon: MessageSquare,
    fieldCount: 5,
    estimatedTime: '2 min',
    popularity: 95,
    tags: ['contact', 'basic', 'email'],
    fields: []
  },
  {
    id: 'registration-form',
    name: 'User Registration',
    description: 'Complete user registration with validation',
    category: 'Registration',
    icon: UserPlus,
    fieldCount: 8,
    estimatedTime: '5 min',
    popularity: 88,
    tags: ['registration', 'user', 'signup'],
    isNew: true,
    fields: []
  },
  {
    id: 'survey-form',
    name: 'Customer Survey',
    description: 'Feedback survey with rating scales and comments',
    category: 'Survey',
    icon: FileText,
    fieldCount: 12,
    estimatedTime: '8 min',
    popularity: 76,
    tags: ['survey', 'feedback', 'rating'],
    fields: []
  },
  {
    id: 'order-form',
    name: 'Order Form',
    description: 'E-commerce order form with product selection',
    category: 'E-commerce',
    icon: Package,
    fieldCount: 15,
    estimatedTime: '10 min',
    popularity: 82,
    tags: ['order', 'shopping', 'products'],
    isPremium: true,
    fields: []
  },
  {
    id: 'payment-form',
    name: 'Payment Form',
    description: 'Secure payment form with card details',
    category: 'E-commerce',
    icon: CreditCard,
    fieldCount: 9,
    estimatedTime: '6 min',
    popularity: 79,
    tags: ['payment', 'checkout', 'billing'],
    isPremium: true,
    fields: []
  },
  {
    id: 'event-registration',
    name: 'Event Registration',
    description: 'Event signup with attendee information',
    category: 'Events',
    icon: Calendar,
    fieldCount: 11,
    estimatedTime: '7 min',
    popularity: 71,
    tags: ['event', 'registration', 'booking'],
    fields: []
  },
  {
    id: 'support-ticket',
    name: 'Support Ticket',
    description: 'Help desk ticket submission form',
    category: 'Support',
    icon: HelpCircle,
    fieldCount: 7,
    estimatedTime: '4 min',
    popularity: 68,
    tags: ['support', 'ticket', 'help'],
    fields: []
  },
  {
    id: 'job-application',
    name: 'Job Application',
    description: 'Employment application with resume upload',
    category: 'HR',
    icon: Users,
    fieldCount: 14,
    estimatedTime: '12 min',
    popularity: 73,
    tags: ['job', 'application', 'hr'],
    isNew: true,
    fields: []
  }
];

const categories = [
  { id: 'all', name: 'All Templates', count: formTemplates.length },
  { id: 'contact', name: 'Contact', count: 1 },
  { id: 'registration', name: 'Registration', count: 1 },
  { id: 'survey', name: 'Survey', count: 1 },
  { id: 'e-commerce', name: 'E-commerce', count: 2 },
  { id: 'events', name: 'Events', count: 1 },
  { id: 'support', name: 'Support', count: 1 },
  { id: 'hr', name: 'HR', count: 1 }
];

export const FormTemplateLibrary: React.FC<FormTemplateLibraryProps> = ({
  onSelectTemplate,
  onCreateCustom,
  className
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'popularity' | 'name' | 'recent'>('popularity');

  // Filter and sort templates
  const filteredTemplates = useMemo(() => {
    let filtered = formTemplates;

    // Category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(t => 
        t.category.toLowerCase() === selectedCategory.toLowerCase()
      );
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        t.name.toLowerCase().includes(query) ||
        t.description.toLowerCase().includes(query) ||
        t.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Sort
    switch (sortBy) {
      case 'popularity':
        filtered.sort((a, b) => b.popularity - a.popularity);
        break;
      case 'name':
        filtered.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'recent':
        filtered.sort((a, b) => {
          if (a.isNew && !b.isNew) return -1;
          if (!a.isNew && b.isNew) return 1;
          return 0;
        });
        break;
    }

    return filtered;
  }, [searchQuery, selectedCategory, sortBy]);

  const TemplateCard: React.FC<{ template: FormTemplate; index: number }> = ({ 
    template, 
    index 
  }) => {
    const Icon = template.icon;
    
    return (
      <motion.div
        className={clsx(
          "relative bg-white rounded-xl border-2 border-gray-200 overflow-hidden cursor-pointer transition-all duration-200",
          "hover:border-blue-300 hover:shadow-lg hover:shadow-blue-100",
          viewMode === 'grid' ? "p-6" : "p-4"
        )}
        onClick={() => onSelectTemplate(template)}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
        whileHover={{ y: -4, scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        {/* Premium/New Badge */}
        {(template.isPremium || template.isNew) && (
          <motion.div
            className={clsx(
              "absolute top-3 right-3 px-2 py-1 rounded-full text-xs font-semibold",
              template.isPremium 
                ? "bg-gradient-to-r from-yellow-400 to-orange-400 text-white"
                : "bg-green-100 text-green-700"
            )}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: index * 0.05 + 0.2 }}
          >
            {template.isPremium ? (
              <div className="flex items-center space-x-1">
                <Sparkles className="w-3 h-3" />
                <span>Premium</span>
              </div>
            ) : 'New'}
          </motion.div>
        )}

        <div className={clsx(
          "flex",
          viewMode === 'grid' ? "flex-col" : "items-center space-x-4"
        )}>
          {/* Icon */}
          <motion.div
            className={clsx(
              "flex items-center justify-center rounded-lg bg-gradient-to-br from-blue-50 to-indigo-100",
              viewMode === 'grid' ? "w-14 h-14 mb-4" : "w-12 h-12 flex-shrink-0"
            )}
            whileHover={{ rotate: 5 }}
          >
            <Icon className="w-6 h-6 text-blue-600" />
          </motion.div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">
              {template.name}
            </h3>
            <p className={clsx(
              "text-sm text-gray-600",
              viewMode === 'grid' ? "mt-1 line-clamp-2" : "truncate"
            )}>
              {template.description}
            </p>
            
            {/* Metadata */}
            <div className={clsx(
              "flex items-center text-xs text-gray-500",
              viewMode === 'grid' ? "mt-4 space-x-3" : "mt-2 space-x-4"
            )}>
              <div className="flex items-center space-x-1">
                <FileText className="w-3 h-3" />
                <span>{template.fieldCount} fields</span>
              </div>
              <div className="flex items-center space-x-1">
                <Clock className="w-3 h-3" />
                <span>{template.estimatedTime}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Star className={clsx(
                  "w-3 h-3",
                  template.popularity > 80 ? "text-yellow-500" : "text-gray-400"
                )} />
                <span>{template.popularity}%</span>
              </div>
            </div>

            {/* Tags */}
            {viewMode === 'grid' && (
              <div className="flex flex-wrap gap-1 mt-3">
                {template.tags.slice(0, 3).map(tag => (
                  <span
                    key={tag}
                    className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <motion.div
      className={clsx("flex flex-col h-full", className)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Form Templates</h2>
          
          <div className="flex items-center space-x-3">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={clsx(
                  "p-2 rounded transition-colors",
                  viewMode === 'grid'
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                )}
              >
                <Grid3x3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={clsx(
                  "p-2 rounded transition-colors",
                  viewMode === 'list'
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                )}
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            {/* Custom Template Button */}
            {onCreateCustom && (
              <motion.button
                onClick={onCreateCustom}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Plus className="w-4 h-4 inline-block mr-2" />
                Create Custom
              </motion.button>
            )}
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center space-x-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="popularity">Most Popular</option>
            <option value="name">Name</option>
            <option value="recent">Recently Added</option>
          </select>
        </div>
      </div>

      {/* Categories */}
      <div className="bg-gray-50 border-b border-gray-200 px-6 py-3">
        <div className="flex items-center space-x-2 overflow-x-auto pb-2">
          {categories.map(category => (
            <motion.button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={clsx(
                "px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all",
                selectedCategory === category.id
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-white text-gray-600 hover:bg-gray-100"
              )}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {category.name}
              <span className="ml-2 opacity-70">({category.count})</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Templates Grid/List */}
      <div className="flex-1 overflow-y-auto p-6">
        {filteredTemplates.length === 0 ? (
          <motion.div
            className="text-center py-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No templates found</p>
            <p className="text-gray-400 text-sm mt-1">Try adjusting your search or filters</p>
          </motion.div>
        ) : (
          <div className={clsx(
            viewMode === 'grid' 
              ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
              : "space-y-3"
          )}>
            {filteredTemplates.map((template, index) => (
              <TemplateCard 
                key={template.id} 
                template={template} 
                index={index} 
              />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default FormTemplateLibrary;