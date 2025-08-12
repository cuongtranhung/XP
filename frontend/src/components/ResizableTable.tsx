/**
 * Resizable and Reorderable Table Component
 * Supports column resizing and drag-and-drop reordering
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from '../components/icons';

interface Column {
  id: string;
  key: string;
  label: string;
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  resizable?: boolean;
  sortable?: boolean;
  visible?: boolean;
}

interface ResizableTableProps {
  columns: Column[];
  data: any[];
  onColumnResize?: (columnId: string, width: number) => void;
  onColumnReorder?: (columns: Column[]) => void;
  renderCell?: (value: any, column: Column, row: any, rowIndex: number) => React.ReactNode;
  onSort?: (columnKey: string, direction: 'asc' | 'desc') => void;
  className?: string;
}

// Sortable Header Component
const SortableHeader: React.FC<{
  column: Column;
  isResizing: boolean;
  onResizeStart: (e: React.MouseEvent) => void;
  onSort?: () => void;
  sortDirection?: 'asc' | 'desc' | null;
}> = ({ column, isResizing, onResizeStart, onSort, sortDirection }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  };

  return (
    <th
      ref={setNodeRef}
      style={{
        ...style,
        width: column.width || 150,
        minWidth: column.minWidth || 100,
        maxWidth: column.maxWidth || 500,
        position: 'relative',
      }}
      className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider select-none ${
        column.sortable ? 'cursor-pointer hover:bg-gray-100' : ''
      }`}
      onClick={column.sortable ? onSort : undefined}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <div
            {...attributes}
            {...listeners}
            className="mr-2 cursor-move touch-none"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="w-4 h-4 text-gray-400" />
          </div>
          <span>{column.label}</span>
          {sortDirection && (
            <span className="ml-1">
              {sortDirection === 'asc' ? '↑' : '↓'}
            </span>
          )}
        </div>
        
        {/* Resize Handle */}
        {column.resizable !== false && (
          <div
            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 transition-colors"
            style={{ touchAction: 'none' }}
            onMouseDown={onResizeStart}
            onClick={(e) => e.stopPropagation()}
          />
        )}
      </div>
    </th>
  );
};

const ResizableTable: React.FC<ResizableTableProps> = ({
  columns: initialColumns,
  data,
  onColumnResize,
  onColumnReorder,
  renderCell,
  onSort,
  className = '',
}) => {
  const [columns, setColumns] = useState(initialColumns);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [resizing, setResizing] = useState<{
    columnId: string;
    startX: number;
    startWidth: number;
  } | null>(null);
  const [sortState, setSortState] = useState<{
    columnKey: string;
    direction: 'asc' | 'desc';
  } | null>(null);

  const tableRef = useRef<HTMLTableElement>(null);

  // Update columns when props change
  useEffect(() => {
    setColumns(initialColumns);
  }, [initialColumns]);

  // DnD Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle column reordering
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = columns.findIndex((col) => col.id === active.id);
      const newIndex = columns.findIndex((col) => col.id === over.id);

      const newColumns = arrayMove(columns, oldIndex, newIndex);
      setColumns(newColumns);
      onColumnReorder?.(newColumns);
    }

    setActiveId(null);
  };

  // Handle column resizing
  const handleResizeStart = useCallback((columnId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const column = columns.find((col) => col.id === columnId);
    if (!column) return;

    setResizing({
      columnId,
      startX: e.clientX,
      startWidth: column.width || 150,
    });
  }, [columns]);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!resizing) return;

    const column = columns.find((col) => col.id === resizing.columnId);
    if (!column) return;

    const diff = e.clientX - resizing.startX;
    const newWidth = Math.max(
      column.minWidth || 100,
      Math.min(column.maxWidth || 500, resizing.startWidth + diff)
    );

    setColumns((prev) =>
      prev.map((col) =>
        col.id === resizing.columnId ? { ...col, width: newWidth } : col
      )
    );

    onColumnResize?.(resizing.columnId, newWidth);
  }, [resizing, onColumnResize]);

  const handleResizeEnd = useCallback(() => {
    setResizing(null);
  }, []);

  // Add resize event listeners
  useEffect(() => {
    if (resizing) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      return () => {
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
    
    return () => {}; // Explicit return for when resizing is false
  }, [resizing, handleResizeMove, handleResizeEnd]);

  // Handle sorting
  const handleSort = useCallback((columnKey: string) => {
    let newDirection: 'asc' | 'desc' = 'asc';
    
    if (sortState?.columnKey === columnKey) {
      newDirection = sortState.direction === 'asc' ? 'desc' : 'asc';
    }

    setSortState({ columnKey, direction: newDirection });
    onSort?.(columnKey, newDirection);
  }, [sortState, onSort]);

  // Filter visible columns
  const visibleColumns = useMemo(
    () => columns.filter((col) => col.visible !== false),
    [columns]
  );

  return (
    <div className={`overflow-x-auto ${className}`}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <table ref={tableRef} className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <SortableContext
                items={visibleColumns.map((col) => col.id)}
                strategy={horizontalListSortingStrategy}
              >
                {visibleColumns.map((column) => (
                  <SortableHeader
                    key={column.id}
                    column={column}
                    isResizing={resizing?.columnId === column.id}
                    onResizeStart={(e) => handleResizeStart(column.id, e)}
                    onSort={column.sortable ? () => handleSort(column.key) : undefined}
                    sortDirection={
                      sortState?.columnKey === column.key
                        ? sortState.direction
                        : null
                    }
                  />
                ))}
              </SortableContext>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((row, rowIndex) => (
              <tr key={row.id || rowIndex} className="hover:bg-gray-50">
                {visibleColumns.map((column) => (
                  <td
                    key={`${row.id || rowIndex}-${column.id}`}
                    className="px-6 py-4 text-sm text-gray-900"
                    style={{
                      width: column.width || 150,
                      minWidth: column.minWidth || 100,
                      maxWidth: column.maxWidth || 500,
                    }}
                  >
                    {renderCell
                      ? renderCell(row[column.key], column, row, rowIndex)
                      : row[column.key] || '-'}
                  </td>
                ))}
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td
                  colSpan={visibleColumns.length}
                  className="px-6 py-12 text-center text-gray-500"
                >
                  No data available
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <DragOverlay>
          {activeId ? (
            <div className="bg-white shadow-lg rounded px-4 py-2 opacity-80">
              {columns.find((col) => col.id === activeId)?.label}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
};

export default ResizableTable;