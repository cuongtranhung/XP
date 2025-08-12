/**
 * TypeScript Type Definitions for Table Components
 * Comprehensive type definitions for all table-related components
 */

// Form and Field Types
export interface FormField {
  id: string;
  fieldKey: string;
  label: string;
  fieldType: 'text' | 'number' | 'email' | 'tel' | 'url' | 'textarea' | 
             'select' | 'radio' | 'checkbox' | 'date' | 'file';
  required?: boolean;
  options?: FieldOption[];
  validationRules?: ValidationRule[];
  placeholder?: string;
  defaultValue?: any;
  description?: string;
  order?: number;
}

export interface FieldOption {
  label: string;
  value: string;
  disabled?: boolean;
}

export interface ValidationRule {
  type: 'required' | 'minLength' | 'maxLength' | 'pattern' | 'min' | 'max' | 'custom';
  value?: any;
  message: string;
  validator?: (value: any) => boolean;
}

export interface Form {
  id: string;
  name: string;
  description?: string;
  fields: FormField[];
  status: 'active' | 'inactive' | 'archived';
  createdAt: string;
  updatedAt: string;
  settings?: FormSettings;
}

export interface FormSettings {
  allowMultipleSubmissions?: boolean;
  requireAuthentication?: boolean;
  sendEmailNotifications?: boolean;
  customTheme?: any;
}

// Submission Types
export interface Submission {
  id: string;
  formId: string;
  data: Record<string, any>;
  status: 'submitted' | 'completed' | 'draft' | 'processing' | 'failed';
  createdAt: string;
  updatedAt: string;
  submittedBy?: string;
  metadata?: SubmissionMetadata;
}

export interface SubmissionMetadata {
  ipAddress?: string;
  userAgent?: string;
  referrer?: string;
  duration?: number;
}

// Column Configuration Types
export interface ColumnConfig {
  id: string;
  key: string;
  label: string;
  width: number;
  minWidth?: number;
  maxWidth?: number;
  sortable?: boolean;
  resizable?: boolean;
  locked?: boolean;
  visible?: boolean;
  align?: 'left' | 'center' | 'right';
  formatter?: (value: any) => string;
}

// Filter Types
export interface FilterCondition {
  field: string;
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 
            'greaterThan' | 'lessThan' | 'between' | 'in' | 'notIn' | 
            'isEmpty' | 'isNotEmpty';
  value: any;
  caseSensitive?: boolean;
}

export interface FilterGroup {
  operator: 'AND' | 'OR';
  conditions: (FilterCondition | FilterGroup)[];
}

// Sort Types
export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  field: string;
  direction: SortDirection;
}

// Pagination Types
export interface PaginationConfig {
  currentPage: number;
  itemsPerPage: number;
  totalItems: number;
  totalPages: number;
}

// Cell Types
export interface CellPosition {
  row: number;
  column: number;
}

export interface CellEdit {
  submissionId: string;
  fieldKey: string;
  oldValue: any;
  newValue: any;
  timestamp: number;
}

// Bulk Operation Types
export interface BulkOperation {
  type: 'edit' | 'delete' | 'export' | 'status';
  selectedIds: string[];
  data?: any;
}

export interface BulkEditConfig {
  field: string;
  value: any;
  operation: 'replace' | 'append' | 'prepend' | 'increment' | 'decrement';
}

// Import/Export Types
export interface ImportConfig {
  format: 'csv' | 'xlsx' | 'json';
  mapping?: Record<string, string>;
  skipHeader?: boolean;
  validateBeforeImport?: boolean;
  reverseOrder?: boolean;
}

export interface ExportConfig {
  format: 'csv' | 'xlsx' | 'json' | 'pdf';
  fields?: string[];
  includeHeaders?: boolean;
  dateFormat?: string;
  filename?: string;
}

// Table State Types
export interface TableState {
  // Data
  form: Form | null;
  submissions: Submission[];
  loading: boolean;
  error: string | null;
  
  // Filtering & Sorting
  searchQuery: string;
  filters: FilterGroup | null;
  sortConfig: SortConfig;
  
  // Pagination
  pagination: PaginationConfig;
  
  // Selection
  selectedSubmissions: Set<string>;
  
  // View Options
  viewMode: 'table' | 'grid' | 'card';
  columnConfigs: ColumnConfig[];
  visibleColumns: Set<string>;
  
  // Features
  enableVirtualScrolling: boolean;
  enableResizableColumns: boolean;
  enableInfiniteScroll: boolean;
  enableKeyboardNavigation: boolean;
  enableAutoSave: boolean;
}

// Event Handler Types
export type CellSaveHandler = (
  submissionId: string, 
  fieldKey: string, 
  value: any
) => Promise<void>;

export type SubmissionSelectHandler = (submissionId: string) => void;

export type ColumnResizeHandler = (columnId: string, width: number) => void;

export type ColumnReorderHandler = (columns: ColumnConfig[]) => void;

export type SortHandler = (field: string) => void;

export type FilterApplyHandler = (filters: FilterGroup) => void;

export type ExportHandler = (config: ExportConfig) => void;

export type ImportHandler = (data: any[], config: ImportConfig) => Promise<void>;

export type BulkOperationHandler = (operation: BulkOperation) => Promise<void>;

// Hook Return Types
export interface UseTableKeyboardNavigationReturn {
  activeCell: CellPosition | null;
  setActiveCell: (position: CellPosition | null) => void;
  handleKeyDown: (event: React.KeyboardEvent) => void;
  focusedElement: HTMLElement | null;
}

export interface UseUndoRedoReturn<T> {
  state: T;
  setState: (state: T | ((prev: T) => T)) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  history: T[];
  historyIndex: number;
  historySize: number;
  clearHistory: () => void;
}

export interface UseDebounceReturn<T> {
  debouncedValue: T;
  isDebouncing: boolean;
}

// Virtual Scrolling Types
export interface VirtualScrollConfig {
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
  scrollToIndex?: number;
  onScroll?: (scrollTop: number) => void;
}

export interface VirtualScrollItem {
  index: number;
  start: number;
  end: number;
  size: number;
}

// Infinite Scroll Types
export interface InfiniteScrollConfig {
  pageSize: number;
  threshold?: number;
  hasMore: boolean;
  isLoading: boolean;
  onLoadMore: (page: number) => Promise<{
    data: any[];
    hasMore: boolean;
  }>;
}

// Grouping Types
export interface GroupConfig {
  field: string;
  order?: 'asc' | 'desc';
  collapsed?: Set<string>;
  aggregations?: GroupAggregation[];
}

export interface GroupAggregation {
  field: string;
  type: 'count' | 'sum' | 'avg' | 'min' | 'max';
  label?: string;
}

export interface GroupedData {
  key: string;
  value: any;
  items: Submission[];
  aggregations?: Record<string, any>;
  isCollapsed?: boolean;
}

// Real-time Update Types
export interface RealtimeConfig {
  enabled: boolean;
  endpoint?: string;
  protocol?: 'websocket' | 'sse';
  reconnectAttempts?: number;
  reconnectDelay?: number;
}

export interface RealtimeUpdate {
  type: 'create' | 'update' | 'delete';
  submissionId?: string;
  data?: any;
  userId?: string;
  timestamp: number;
}

// Collaborative Editing Types
export interface CollaboratorPresence {
  userId: string;
  userName: string;
  color: string;
  activeCell?: CellPosition;
  lastActivity: number;
}

export interface CollaborativeEdit {
  userId: string;
  submissionId: string;
  fieldKey: string;
  isEditing: boolean;
  timestamp: number;
}

// Table View Configuration
export interface TableViewConfig {
  id: string;
  name: string;
  description?: string;
  filters?: FilterGroup;
  sortConfig?: SortConfig;
  columnConfigs?: ColumnConfig[];
  visibleColumns?: string[];
  itemsPerPage?: number;
  isDefault?: boolean;
  isShared?: boolean;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Performance Metrics
export interface TablePerformanceMetrics {
  renderTime: number;
  dataFetchTime: number;
  filterTime: number;
  sortTime: number;
  totalRows: number;
  visibleRows: number;
  memoryUsage?: number;
  fps?: number;
}

// Error Types
export interface TableError {
  code: string;
  message: string;
  field?: string;
  details?: any;
  timestamp: number;
  recoverable?: boolean;
}

// Action Types for Reducers
export type TableAction = 
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_FORM'; payload: Form }
  | { type: 'SET_SUBMISSIONS'; payload: Submission[] }
  | { type: 'UPDATE_SUBMISSION'; payload: Submission }
  | { type: 'DELETE_SUBMISSION'; payload: string }
  | { type: 'SET_SEARCH_QUERY'; payload: string }
  | { type: 'SET_FILTERS'; payload: FilterGroup | null }
  | { type: 'SET_SORT_CONFIG'; payload: SortConfig }
  | { type: 'SET_PAGINATION'; payload: Partial<PaginationConfig> }
  | { type: 'TOGGLE_SUBMISSION_SELECTION'; payload: string }
  | { type: 'SELECT_ALL_SUBMISSIONS' }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'SET_COLUMN_CONFIGS'; payload: ColumnConfig[] }
  | { type: 'UPDATE_COLUMN_CONFIG'; payload: { id: string; config: Partial<ColumnConfig> } }
  | { type: 'TOGGLE_COLUMN_VISIBILITY'; payload: string }
  | { type: 'TOGGLE_FEATURE'; payload: keyof TableState }
  | { type: 'RESET_TABLE_STATE' };

// Utility Types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type Nullable<T> = T | null;

export type Optional<T> = T | undefined;

export type AsyncResult<T> = Promise<{
  success: boolean;
  data?: T;
  error?: TableError;
}>;

// Component Prop Types (for better IDE support)
export interface BaseTableComponentProps {
  className?: string;
  style?: React.CSSProperties;
  'aria-label'?: string;
  'data-testid'?: string;
}

export interface TableComponentProps extends BaseTableComponentProps {
  form: Form;
  submissions: Submission[];
  state: TableState;
  handlers: {
    onCellSave: CellSaveHandler;
    onSubmissionSelect: SubmissionSelectHandler;
    onColumnResize: ColumnResizeHandler;
    onColumnReorder: ColumnReorderHandler;
    onSort: SortHandler;
    onFilterApply: FilterApplyHandler;
    onExport: ExportHandler;
    onImport: ImportHandler;
    onBulkOperation: BulkOperationHandler;
  };
}