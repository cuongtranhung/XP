/**
 * Demo Navigation Page
 * Quick access to all demo and test pages
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Upload, 
  Palette, 
  TestTube, 
  Zap, 
  FileText, 
  MessageSquare,
  BarChart3,
  Database,
  Users,
  Settings,
  Monitor
} from 'lucide-react';

const DemoNavigation: React.FC = () => {
  const demoPages = [
    {
      title: 'Parallel Upload Demo',
      description: 'Test multiple file upload with toast notifications',
      icon: <Upload className="w-6 h-6" />,
      path: '/upload-demo',
      color: 'bg-blue-500',
      featured: false
    },
    {
      title: 'Upload UI Components',
      description: 'View all upload component variants and designs',
      icon: <Palette className="w-6 h-6" />,
      path: '/upload-ui-demo',
      color: 'bg-purple-500',
      featured: false
    },
    {
      title: 'R2 Upload Test',
      description: 'Test Cloudflare R2 upload functionality',
      icon: <Upload className="w-6 h-6" />,
      path: '/r2-upload-test',
      color: 'bg-orange-500',
      featured: true
    },
    {
      title: 'Form Builder',
      description: 'Enhanced form builder with drag & drop',
      icon: <FileText className="w-6 h-6" />,
      path: '/forms/new',
      color: 'bg-green-500'
    },
    {
      title: 'Form Builder Showcase',
      description: 'Simple form builder demo',
      icon: <TestTube className="w-6 h-6" />,
      path: '/showcase',
      color: 'bg-orange-500'
    },
    {
      title: 'Form Analytics',
      description: 'View form submission analytics',
      icon: <BarChart3 className="w-6 h-6" />,
      path: '/forms',
      color: 'bg-indigo-500'
    },
    {
      title: 'User Management',
      description: 'Manage users and permissions',
      icon: <Users className="w-6 h-6" />,
      path: '/user-management',
      color: 'bg-pink-500'
    },
    {
      title: 'Monitoring Dashboard',
      description: 'System monitoring and metrics',
      icon: <Monitor className="w-6 h-6" />,
      path: '/monitoring',
      color: 'bg-red-500'
    },
    {
      title: 'Permission Tests',
      description: 'Test role-based permissions',
      icon: <Settings className="w-6 h-6" />,
      path: '/permission-test',
      color: 'bg-gray-500'
    }
  ];

  const featuredPages = demoPages.filter(page => page.featured);
  const otherPages = demoPages.filter(page => !page.featured);

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            🚀 Demo & Testing Center
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Interactive demos and testing pages for all features and components.
            Perfect for testing, development, and showcasing capabilities.
          </p>
        </div>

        {/* Featured Demos */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 flex items-center gap-3">
            <Zap className="w-8 h-8 text-yellow-500" />
            Featured Demos
          </h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            {featuredPages.map((page, index) => (
              <Link
                key={index}
                to={page.path}
                className="group relative overflow-hidden rounded-2xl bg-white shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:scale-105"
              >
                <div className="p-8">
                  <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full ${page.color} text-white mb-6`}>
                    {page.icon}
                  </div>
                  
                  <h3 className="text-2xl font-bold text-gray-900 mb-3 group-hover:text-blue-600 transition-colors">
                    {page.title}
                  </h3>
                  
                  <p className="text-gray-600 text-lg leading-relaxed">
                    {page.description}
                  </p>
                  
                  <div className="mt-6">
                    <span className="inline-flex items-center text-blue-600 font-semibold group-hover:text-blue-800">
                      Try it now 
                      <svg className="ml-2 w-5 h-5 transform group-hover:translate-x-1 transition-transform" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </span>
                  </div>
                </div>
                
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-transparent to-blue-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
              </Link>
            ))}
          </div>
        </div>

        {/* All Demos Grid */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-8 flex items-center gap-3">
            <Database className="w-8 h-8 text-gray-500" />
            All Demos & Features
          </h2>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {demoPages.map((page, index) => (
              <Link
                key={index}
                to={page.path}
                className="group bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-200 p-6 hover:bg-gray-50"
              >
                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-lg ${page.color} text-white mb-4`}>
                  {page.icon}
                </div>
                
                <h3 className="font-bold text-gray-900 mb-2 group-hover:text-blue-600">
                  {page.title}
                </h3>
                
                <p className="text-sm text-gray-600 line-clamp-2">
                  {page.description}
                </p>
                
                <div className="mt-4 flex items-center text-blue-600 text-sm font-medium">
                  <span>Explore</span>
                  <svg className="ml-1 w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Quick Test Instructions */}
        <div className="mt-16 bg-white rounded-2xl shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
            <TestTube className="w-8 h-8 text-green-500" />
            Quick Testing Guide
          </h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">🚀 Upload Demo Testing</h3>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-blue-500">1.</span>
                  <span>Visit <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">/upload-demo</code></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500">2.</span>
                  <span>Select multiple files (5-10 files recommended)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500">3.</span>
                  <span>Watch parallel upload with toast notifications</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500">4.</span>
                  <span>Test pause/resume/cancel/retry functions</span>
                </li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">🎨 UI Demo Testing</h3>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-purple-500">1.</span>
                  <span>Visit <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">/upload-ui-demo</code></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-500">2.</span>
                  <span>Switch between different component variants</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-500">3.</span>
                  <span>Test drag & drop, mobile view, dark mode</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-500">4.</span>
                  <span>View file states and animations</span>
                </li>
              </ul>
            </div>
          </div>
          
          <div className="mt-8 p-4 bg-blue-50 rounded-lg">
            <p className="text-blue-800 font-medium">
              💡 Pro Tip: Open browser DevTools to monitor network requests and see the parallel upload behavior in action!
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default DemoNavigation;