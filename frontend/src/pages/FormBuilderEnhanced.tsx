/**
 * Enhanced Form Builder Page
 * Uses the FormBuilderComplete with all UX improvements
 */

import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
// import { FormBuilderComplete } from '../components/formBuilder/FormBuilderComplete';
import { FormBuilderCompleteSimple } from '../components/formBuilder/FormBuilderCompleteSimple';

const FormBuilderEnhanced: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  console.log('[FormBuilderEnhanced] Rendering with ID:', id);

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Simple Header with Back Button */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/forms')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Back to forms"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-semibold text-gray-900">
            {id === 'new' ? 'Create New Form' : 'Edit Form'}
          </h1>
        </div>
      </div>

      {/* Enhanced Form Builder with all improvements */}
      <div className="flex-1 overflow-hidden">
        <FormBuilderCompleteSimple formId={id} />
      </div>
    </div>
  );
};

export default FormBuilderEnhanced;