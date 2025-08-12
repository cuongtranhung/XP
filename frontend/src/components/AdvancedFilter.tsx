/**
 * Advanced Filter Component
 * Multi-condition filtering with AND/OR logic
 */

import React, { useState } from 'react';
import { X, Plus, Filter } from './icons';
import Button from './common/Button';

export interface FilterCondition {
  id: string;
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater' | 'less' | 'between' | 'empty' | 'not_empty';
  value: any;
  value2?: any; // For between operator
}

export interface FilterGroup {
  id: string;
  logic: 'AND' | 'OR';
  conditions: FilterCondition[];
}

interface AdvancedFilterProps {
  fields: Array<{ key: string; label: string; type: string }>;
  onApply: (filters: FilterGroup) => void;
  onClose: () => void;
  initialFilters?: FilterGroup;
}

const AdvancedFilter: React.FC<AdvancedFilterProps> = ({
  fields,
  onApply,
  onClose,
  initialFilters
}) => {
  const [filterGroup, setFilterGroup] = useState<FilterGroup>(
    initialFilters || {
      id: 'root',
      logic: 'AND',
      conditions: []
    }
  );

  const operators = {
    text: [
      { value: 'contains', label: 'Contains' },
      { value: 'not_contains', label: 'Does not contain' },
      { value: 'equals', label: 'Equals' },
      { value: 'not_equals', label: 'Not equals' },
      { value: 'empty', label: 'Is empty' },
      { value: 'not_empty', label: 'Is not empty' }
    ],
    number: [
      { value: 'equals', label: '=' },
      { value: 'not_equals', label: '≠' },
      { value: 'greater', label: '>' },
      { value: 'less', label: '<' },
      { value: 'between', label: 'Between' },
      { value: 'empty', label: 'Is empty' },
      { value: 'not_empty', label: 'Is not empty' }
    ],
    date: [
      { value: 'equals', label: 'On' },
      { value: 'greater', label: 'After' },
      { value: 'less', label: 'Before' },
      { value: 'between', label: 'Between' },
      { value: 'empty', label: 'Is empty' },
      { value: 'not_empty', label: 'Is not empty' }
    ],
    select: [
      { value: 'equals', label: 'Is' },
      { value: 'not_equals', label: 'Is not' },
      { value: 'empty', label: 'Is empty' },
      { value: 'not_empty', label: 'Is not empty' }
    ],
    checkbox: [
      { value: 'equals', label: 'Is checked' },
      { value: 'not_equals', label: 'Is not checked' }
    ]
  };

  const addCondition = () => {
    const newCondition: FilterCondition = {
      id: Date.now().toString(),
      field: fields[0]?.key || '',
      operator: 'equals',
      value: ''
    };

    setFilterGroup({
      ...filterGroup,
      conditions: [...filterGroup.conditions, newCondition]
    });
  };

  const removeCondition = (conditionId: string) => {
    setFilterGroup({
      ...filterGroup,
      conditions: filterGroup.conditions.filter(c => c.id !== conditionId)
    });
  };

  const updateCondition = (conditionId: string, updates: Partial<FilterCondition>) => {
    setFilterGroup({
      ...filterGroup,
      conditions: filterGroup.conditions.map(c =>
        c.id === conditionId ? { ...c, ...updates } : c
      )
    });
  };

  const getFieldType = (fieldKey: string) => {
    const field = fields.find(f => f.key === fieldKey);
    return field?.type || 'text';
  };

  const getOperatorOptions = (fieldKey: string) => {
    const fieldType = getFieldType(fieldKey);
    switch (fieldType) {
      case 'number':
        return operators.number;
      case 'date':
        return operators.date;
      case 'select':
      case 'radio':
        return operators.select;
      case 'checkbox':
        return operators.checkbox;
      default:
        return operators.text;
    }
  };

  const handleApply = () => {
    // Remove empty conditions
    const validConditions = filterGroup.conditions.filter(c => {
      if (c.operator === 'empty' || c.operator === 'not_empty') return true;
      if (c.operator === 'between') return c.value && c.value2;
      return c.value !== '' && c.value !== undefined && c.value !== null;
    });

    onApply({
      ...filterGroup,
      conditions: validConditions
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center">
            <Filter className="w-5 h-5 text-gray-600 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">Advanced Filters</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
          {/* Logic Selector */}
          <div className="mb-4">
            <label className="text-sm font-medium text-gray-700 mr-3">
              Match conditions:
            </label>
            <div className="inline-flex rounded-lg border border-gray-300">
              <button
                className={`px-4 py-2 text-sm font-medium ${
                  filterGroup.logic === 'AND'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                } rounded-l-lg transition-colors`}
                onClick={() => setFilterGroup({ ...filterGroup, logic: 'AND' })}
              >
                All (AND)
              </button>
              <button
                className={`px-4 py-2 text-sm font-medium ${
                  filterGroup.logic === 'OR'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                } rounded-r-lg transition-colors`}
                onClick={() => setFilterGroup({ ...filterGroup, logic: 'OR' })}
              >
                Any (OR)
              </button>
            </div>
          </div>

          {/* Conditions */}
          <div className="space-y-3">
            {filterGroup.conditions.map((condition, index) => (
              <div key={condition.id} className="flex items-center space-x-3">
                {index > 0 && (
                  <span className="text-xs font-medium text-gray-500 w-10">
                    {filterGroup.logic}
                  </span>
                )}
                {index === 0 && <div className="w-10" />}

                {/* Field Selector */}
                <select
                  value={condition.field}
                  onChange={(e) => updateCondition(condition.id, { 
                    field: e.target.value,
                    operator: 'equals',
                    value: ''
                  })}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {fields.map(field => (
                    <option key={field.key} value={field.key}>
                      {field.label}
                    </option>
                  ))}
                </select>

                {/* Operator Selector */}
                <select
                  value={condition.operator}
                  onChange={(e) => updateCondition(condition.id, { 
                    operator: e.target.value as any,
                    value: '',
                    value2: undefined
                  })}
                  className="w-40 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {getOperatorOptions(condition.field).map(op => (
                    <option key={op.value} value={op.value}>
                      {op.label}
                    </option>
                  ))}
                </select>

                {/* Value Input(s) */}
                {condition.operator !== 'empty' && condition.operator !== 'not_empty' && (
                  <>
                    <input
                      type={getFieldType(condition.field) === 'number' ? 'number' : 'text'}
                      value={condition.value || ''}
                      onChange={(e) => updateCondition(condition.id, { value: e.target.value })}
                      placeholder="Value"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    
                    {condition.operator === 'between' && (
                      <>
                        <span className="text-gray-500">and</span>
                        <input
                          type={getFieldType(condition.field) === 'number' ? 'number' : 'text'}
                          value={condition.value2 || ''}
                          onChange={(e) => updateCondition(condition.id, { value2: e.target.value })}
                          placeholder="Value"
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </>
                    )}
                  </>
                )}

                {/* Remove Button */}
                <button
                  onClick={() => removeCondition(condition.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}

            {/* Add Condition Button */}
            <button
              onClick={addCondition}
              className="flex items-center px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Condition
            </button>
          </div>

          {/* Preview */}
          {filterGroup.conditions.length > 0 && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-700 mb-2">Filter Preview:</p>
              <p className="text-sm text-gray-600">
                Show rows where {filterGroup.logic === 'AND' ? 'all' : 'any'} of the following conditions are met:
              </p>
              <ul className="mt-2 space-y-1">
                {filterGroup.conditions.map(condition => {
                  const field = fields.find(f => f.key === condition.field);
                  return (
                    <li key={condition.id} className="text-sm text-gray-600 ml-4">
                      • <span className="font-medium">{field?.label}</span> {condition.operator.replace('_', ' ')} 
                      {condition.operator !== 'empty' && condition.operator !== 'not_empty' && (
                        <>
                          {' '}<span className="font-medium">{condition.value}</span>
                          {condition.operator === 'between' && condition.value2 && (
                            <> and <span className="font-medium">{condition.value2}</span></>
                          )}
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={() => setFilterGroup({ ...filterGroup, conditions: [] })}
            className="text-sm text-gray-600 hover:text-gray-800 transition-colors"
            disabled={filterGroup.conditions.length === 0}
          >
            Clear All
          </button>
          <div className="flex space-x-3">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleApply}
              disabled={filterGroup.conditions.length === 0}
            >
              Apply Filters
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdvancedFilter;