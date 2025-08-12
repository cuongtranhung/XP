/**
 * Table Grouping Component
 * Allows grouping table data by field values with collapsible groups
 */

import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Layers } from '../icons';
import { Submission, FormField, GroupConfig, GroupedData } from '../../types/table.types';

interface TableGroupingProps {
  submissions: Submission[];
  fields: FormField[];
  groupConfig: GroupConfig | null;
  onGroupChange: (config: GroupConfig | null) => void;
  renderRow: (submission: Submission, index: number) => React.ReactNode;
}

const TableGrouping: React.FC<TableGroupingProps> = ({
  submissions,
  fields,
  groupConfig,
  onGroupChange,
  renderRow
}) => {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [showGroupMenu, setShowGroupMenu] = useState(false);

  // Group submissions by the selected field
  const groupedData = useMemo(() => {
    if (!groupConfig || !groupConfig.field) {
      return null;
    }

    const groups = new Map<string, GroupedData>();
    
    submissions.forEach(submission => {
      const groupValue = submission.data[groupConfig.field] || 'No Value';
      const groupKey = String(groupValue);
      
      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          key: groupKey,
          value: groupValue,
          items: [],
          aggregations: {},
          isCollapsed: collapsedGroups.has(groupKey)
        });
      }
      
      groups.get(groupKey)!.items.push(submission);
    });

    // Calculate aggregations if configured
    if (groupConfig.aggregations) {
      groups.forEach(group => {
        groupConfig.aggregations?.forEach(agg => {
          const values = group.items
            .map(item => item.data[agg.field])
            .filter(val => val !== null && val !== undefined);
          
          switch (agg.type) {
            case 'count':
              group.aggregations![agg.field] = group.items.length;
              break;
            case 'sum':
              group.aggregations![agg.field] = values.reduce((sum, val) => sum + Number(val), 0);
              break;
            case 'avg':
              group.aggregations![agg.field] = values.length > 0
                ? values.reduce((sum, val) => sum + Number(val), 0) / values.length
                : 0;
              break;
            case 'min':
              group.aggregations![agg.field] = Math.min(...values.map(Number));
              break;
            case 'max':
              group.aggregations![agg.field] = Math.max(...values.map(Number));
              break;
          }
        });
      });
    }

    // Sort groups if specified
    const sortedGroups = Array.from(groups.values()).sort((a, b) => {
      if (groupConfig.order === 'desc') {
        return b.value > a.value ? 1 : -1;
      }
      return a.value > b.value ? 1 : -1;
    });

    return sortedGroups;
  }, [submissions, groupConfig, collapsedGroups]);

  const toggleGroup = (groupKey: string) => {
    setCollapsedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupKey)) {
        newSet.delete(groupKey);
      } else {
        newSet.add(groupKey);
      }
      return newSet;
    });
  };

  const toggleAllGroups = (collapse: boolean) => {
    if (collapse && groupedData) {
      setCollapsedGroups(new Set(groupedData.map(g => g.key)));
    } else {
      setCollapsedGroups(new Set());
    }
  };

  const handleGroupByField = (fieldKey: string | null) => {
    if (fieldKey === null) {
      onGroupChange(null);
    } else {
      onGroupChange({
        field: fieldKey,
        order: 'asc',
        collapsed: new Set(),
        aggregations: [
          { field: fieldKey, type: 'count', label: 'Count' }
        ]
      });
    }
    setShowGroupMenu(false);
  };

  const getFieldLabel = (fieldKey: string) => {
    const field = fields.find(f => f.fieldKey === fieldKey);
    return field?.label || fieldKey;
  };

  return (
    <div className="w-full">
      {/* Grouping Controls */}
      <div className="bg-white border border-gray-200 rounded-lg p-3 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Layers className="w-5 h-5 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Group By:</span>
            
            <div className="relative">
              <button
                onClick={() => setShowGroupMenu(!showGroupMenu)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {groupConfig ? getFieldLabel(groupConfig.field) : 'None'}
                <ChevronDown className="w-4 h-4 inline-block ml-2" />
              </button>
              
              {showGroupMenu && (
                <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
                  <button
                    onClick={() => handleGroupByField(null)}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    None
                  </button>
                  <div className="border-t border-gray-200"></div>
                  {fields.map(field => (
                    <button
                      key={field.id}
                      onClick={() => handleGroupByField(field.fieldKey)}
                      className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 ${
                        groupConfig?.field === field.fieldKey
                          ? 'bg-blue-50 text-blue-600'
                          : 'text-gray-700'
                      }`}
                    >
                      {field.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          {groupConfig && groupedData && (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500">
                {groupedData.length} groups, {submissions.length} items
              </span>
              <button
                onClick={() => toggleAllGroups(collapsedGroups.size < groupedData.length)}
                className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded"
                title={collapsedGroups.size < groupedData.length ? 'Collapse all' : 'Expand all'}
              >
                {collapsedGroups.size < groupedData.length ? 'Collapse All' : 'Expand All'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Grouped Table Content */}
      {groupedData ? (
        <div className="space-y-4">
          {groupedData.map((group, groupIndex) => (
            <div key={group.key} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              {/* Group Header */}
              <div
                className="px-4 py-3 bg-gray-50 border-b border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => toggleGroup(group.key)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {collapsedGroups.has(group.key) ? (
                      <ChevronRight className="w-5 h-5 text-gray-500" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-500" />
                    )}
                    <span className="font-medium text-gray-900">
                      {getFieldLabel(groupConfig.field)}: {group.value}
                    </span>
                    <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
                      {group.items.length} items
                    </span>
                  </div>
                  
                  {/* Aggregations */}
                  {groupConfig.aggregations && Object.keys(group.aggregations!).length > 0 && (
                    <div className="flex items-center space-x-4">
                      {groupConfig.aggregations.map(agg => (
                        <div key={agg.field} className="text-sm text-gray-600">
                          <span className="font-medium">{agg.label || agg.type}:</span>{' '}
                          <span className="text-gray-900">
                            {typeof group.aggregations![agg.field] === 'number'
                              ? group.aggregations![agg.field].toLocaleString()
                              : group.aggregations![agg.field]}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Group Items */}
              {!collapsedGroups.has(group.key) && (
                <div className="divide-y divide-gray-200">
                  {group.items.map((submission, index) => (
                    <div key={submission.id} className="hover:bg-gray-50">
                      {renderRow(submission, index)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        // Non-grouped table content
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="divide-y divide-gray-200">
            {submissions.map((submission, index) => (
              <div key={submission.id} className="hover:bg-gray-50">
                {renderRow(submission, index)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TableGrouping;