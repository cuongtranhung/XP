/**
 * Table Skeleton Component
 * Shows loading placeholder with shimmer effect
 */

import React from 'react';

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  showHeader?: boolean;
}

const TableSkeleton: React.FC<TableSkeletonProps> = ({ 
  rows = 10, 
  columns = 5,
  showHeader = true 
}) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <style>{`
        @keyframes shimmer {
          0% {
            background-position: -1000px 0;
          }
          100% {
            background-position: 1000px 0;
          }
        }
        
        .skeleton-shimmer {
          animation: shimmer 2s infinite linear;
          background: linear-gradient(
            90deg,
            #f0f0f0 0%,
            #f8f8f8 20%,
            #f0f0f0 40%,
            #f0f0f0 100%
          );
          background-size: 1000px 100%;
        }
        
        .skeleton-cell {
          height: 20px;
          border-radius: 4px;
          margin: 4px 0;
        }
        
        .skeleton-header {
          height: 16px;
          border-radius: 4px;
          margin: 6px 0;
          width: 80%;
        }
      `}</style>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          {/* Header Skeleton */}
          {showHeader && (
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 w-12">
                  <div className="skeleton-shimmer skeleton-header w-4 h-4 mx-auto"></div>
                </th>
                <th className="px-6 py-3 w-16">
                  <div className="skeleton-shimmer skeleton-header w-8"></div>
                </th>
                {Array.from({ length: columns }).map((_, index) => (
                  <th key={`header-${index}`} className="px-6 py-3 text-left">
                    <div className="skeleton-shimmer skeleton-header"></div>
                  </th>
                ))}
                <th className="px-6 py-3">
                  <div className="skeleton-shimmer skeleton-header w-20"></div>
                </th>
              </tr>
            </thead>
          )}
          
          {/* Body Skeleton */}
          <tbody className="bg-white divide-y divide-gray-200">
            {Array.from({ length: rows }).map((_, rowIndex) => (
              <tr key={`row-${rowIndex}`} className="hover:bg-gray-50">
                {/* Checkbox */}
                <td className="px-4 py-4 w-12">
                  <div className="skeleton-shimmer w-4 h-4 mx-auto rounded"></div>
                </td>
                
                {/* Row Number */}
                <td className="px-6 py-4 w-16">
                  <div className="skeleton-shimmer skeleton-cell w-8"></div>
                </td>
                
                {/* Data Cells */}
                {Array.from({ length: columns }).map((_, colIndex) => (
                  <td key={`cell-${rowIndex}-${colIndex}`} className="px-6 py-4">
                    <div 
                      className="skeleton-shimmer skeleton-cell" 
                      style={{ 
                        width: `${Math.random() * 40 + 60}%`,
                        animationDelay: `${(rowIndex * columns + colIndex) * 0.05}s`
                      }}
                    ></div>
                  </td>
                ))}
                
                {/* Actions */}
                <td className="px-6 py-4">
                  <div className="flex space-x-2">
                    <div className="skeleton-shimmer w-8 h-8 rounded"></div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Pagination Skeleton */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <div className="skeleton-shimmer skeleton-cell w-32"></div>
          <div className="flex space-x-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={`page-${index}`} className="skeleton-shimmer w-8 h-8 rounded"></div>
            ))}
          </div>
          <div className="skeleton-shimmer skeleton-cell w-32"></div>
        </div>
      </div>
    </div>
  );
};

export default TableSkeleton;