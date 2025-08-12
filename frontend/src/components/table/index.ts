/**
 * Table Components Module
 * Central export point for all table-related components
 */

export { default as TableHeader } from './TableHeader';
export { default as TableFilters } from './TableFilters';
export { default as TableContent } from './TableContent';
export { default as TableModals } from './TableModals';
export { default as TablePagination } from './TablePagination';

// Re-export types if needed
export type { TableHeaderProps } from './TableHeader';
export type { TableFiltersProps } from './TableFilters';
export type { TableContentProps } from './TableContent';
export type { TableModalsProps } from './TableModals';
export type { TablePaginationProps } from './TablePagination';