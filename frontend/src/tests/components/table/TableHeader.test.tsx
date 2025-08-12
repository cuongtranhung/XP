/**
 * Unit Tests for TableHeader Component
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import TableHeader from '../../../components/table/TableHeader';

describe('TableHeader Component', () => {
  const mockHandlers = {
    onBack: jest.fn(),
    onRefresh: jest.fn(),
    onAddRow: jest.fn(),
    onImport: jest.fn(),
    onExport: jest.fn(),
    onUndo: jest.fn(),
    onRedo: jest.fn(),
    onToggleVirtualScrolling: jest.fn(),
    onToggleResizableColumns: jest.fn(),
    onToggleInfiniteScroll: jest.fn(),
    onColumnVisibilityChange: jest.fn()
  };

  const defaultProps = {
    formName: 'Test Form',
    ...mockHandlers,
    canUndo: true,
    canRedo: true,
    historySize: 5,
    isRefreshing: false,
    isCreatingNewRow: false,
    enableVirtualScrolling: false,
    enableResizableColumns: false,
    enableInfiniteScroll: false,
    columnConfigs: [
      { id: 'col1', key: 'col1', label: 'Column 1', width: 150 },
      { id: 'col2', key: 'col2', label: 'Column 2', width: 150 }
    ],
    visibleColumns: new Set(['col1', 'col2'])
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render form name correctly', () => {
      render(<TableHeader {...defaultProps} />);
      expect(screen.getByText('Test Form - Data Table')).toBeInTheDocument();
    });

    it('should render description text', () => {
      render(<TableHeader {...defaultProps} />);
      expect(screen.getByText(/View and manage form submissions/)).toBeInTheDocument();
    });

    it('should render all action buttons', () => {
      render(<TableHeader {...defaultProps} />);
      
      expect(screen.getByText('Back to Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Refresh')).toBeInTheDocument();
      expect(screen.getByText('Add Row')).toBeInTheDocument();
      expect(screen.getByText('Import')).toBeInTheDocument();
      expect(screen.getByText('Export Table')).toBeInTheDocument();
    });

    it('should show undo/redo buttons', () => {
      render(<TableHeader {...defaultProps} />);
      
      expect(screen.getByLabelText('Undo last action')).toBeInTheDocument();
      expect(screen.getByLabelText('Redo last action')).toBeInTheDocument();
    });

    it('should show feature toggle buttons', () => {
      render(<TableHeader {...defaultProps} />);
      
      expect(screen.getByLabelText('Toggle virtual scrolling')).toBeInTheDocument();
      expect(screen.getByLabelText('Toggle resizable columns')).toBeInTheDocument();
      expect(screen.getByLabelText('Toggle infinite scroll')).toBeInTheDocument();
    });
  });

  describe('Button States', () => {
    it('should disable undo when canUndo is false', () => {
      render(<TableHeader {...defaultProps} canUndo={false} />);
      
      const undoButton = screen.getByLabelText('Undo last action');
      expect(undoButton).toBeDisabled();
    });

    it('should disable redo when canRedo is false', () => {
      render(<TableHeader {...defaultProps} canRedo={false} />);
      
      const redoButton = screen.getByLabelText('Redo last action');
      expect(redoButton).toBeDisabled();
    });

    it('should show refreshing state', () => {
      render(<TableHeader {...defaultProps} isRefreshing={true} />);
      
      expect(screen.getByText('Refreshing...')).toBeInTheDocument();
      const refreshButton = screen.getByLabelText('Refresh table data');
      expect(refreshButton).toBeDisabled();
    });

    it('should show creating new row state', () => {
      render(<TableHeader {...defaultProps} isCreatingNewRow={true} />);
      
      expect(screen.getByText('Adding...')).toBeInTheDocument();
      const addButton = screen.getByLabelText('Add new row to table');
      expect(addButton).toBeDisabled();
    });

    it('should show history size in undo tooltip', () => {
      render(<TableHeader {...defaultProps} historySize={10} />);
      
      const undoButton = screen.getByLabelText('Undo last action');
      expect(undoButton).toHaveAttribute('title', 'Undo (10 actions)');
    });
  });

  describe('User Interactions', () => {
    it('should call onBack when back button clicked', async () => {
      render(<TableHeader {...defaultProps} />);
      
      const backButton = screen.getByText('Back to Dashboard');
      await userEvent.click(backButton);
      
      expect(mockHandlers.onBack).toHaveBeenCalledTimes(1);
    });

    it('should call onRefresh when refresh button clicked', async () => {
      render(<TableHeader {...defaultProps} />);
      
      const refreshButton = screen.getByText('Refresh');
      await userEvent.click(refreshButton);
      
      expect(mockHandlers.onRefresh).toHaveBeenCalledTimes(1);
    });

    it('should call onAddRow when add row button clicked', async () => {
      render(<TableHeader {...defaultProps} />);
      
      const addButton = screen.getByText('Add Row');
      await userEvent.click(addButton);
      
      expect(mockHandlers.onAddRow).toHaveBeenCalledTimes(1);
    });

    it('should call onImport when import button clicked', async () => {
      render(<TableHeader {...defaultProps} />);
      
      const importButton = screen.getByText('Import');
      await userEvent.click(importButton);
      
      expect(mockHandlers.onImport).toHaveBeenCalledTimes(1);
    });

    it('should call onUndo when undo button clicked', async () => {
      render(<TableHeader {...defaultProps} />);
      
      const undoButton = screen.getByLabelText('Undo last action');
      await userEvent.click(undoButton);
      
      expect(mockHandlers.onUndo).toHaveBeenCalledTimes(1);
    });

    it('should call onRedo when redo button clicked', async () => {
      render(<TableHeader {...defaultProps} />);
      
      const redoButton = screen.getByLabelText('Redo last action');
      await userEvent.click(redoButton);
      
      expect(mockHandlers.onRedo).toHaveBeenCalledTimes(1);
    });
  });

  describe('Export Menu', () => {
    it('should show export menu on button click', async () => {
      render(<TableHeader {...defaultProps} />);
      
      const exportButton = screen.getByText('Export Table');
      await userEvent.click(exportButton);
      
      expect(screen.getByText('Export as CSV')).toBeInTheDocument();
      expect(screen.getByText('Export as Excel')).toBeInTheDocument();
      expect(screen.getByText('Export as JSON')).toBeInTheDocument();
    });

    it('should call onExport with correct format', async () => {
      render(<TableHeader {...defaultProps} />);
      
      const exportButton = screen.getByText('Export Table');
      await userEvent.click(exportButton);
      
      const csvOption = screen.getByText('Export as CSV');
      await userEvent.click(csvOption);
      
      expect(mockHandlers.onExport).toHaveBeenCalledWith('csv');
    });
  });

  describe('Feature Toggles', () => {
    it('should toggle virtual scrolling', async () => {
      render(<TableHeader {...defaultProps} />);
      
      const toggleButton = screen.getByLabelText('Toggle virtual scrolling');
      await userEvent.click(toggleButton);
      
      expect(mockHandlers.onToggleVirtualScrolling).toHaveBeenCalledTimes(1);
    });

    it('should toggle resizable columns', async () => {
      render(<TableHeader {...defaultProps} />);
      
      const toggleButton = screen.getByLabelText('Toggle resizable columns');
      await userEvent.click(toggleButton);
      
      expect(mockHandlers.onToggleResizableColumns).toHaveBeenCalledTimes(1);
    });

    it('should toggle infinite scroll', async () => {
      render(<TableHeader {...defaultProps} />);
      
      const toggleButton = screen.getByLabelText('Toggle infinite scroll');
      await userEvent.click(toggleButton);
      
      expect(mockHandlers.onToggleInfiniteScroll).toHaveBeenCalledTimes(1);
    });

    it('should show active state for enabled features', () => {
      render(<TableHeader {...defaultProps} enableVirtualScrolling={true} />);
      
      const toggleButton = screen.getByLabelText('Toggle virtual scrolling');
      expect(toggleButton).toHaveClass('bg-purple-600');
    });
  });

  describe('Column Visibility', () => {
    it('should not render column visibility toggle when no columns', () => {
      render(<TableHeader {...defaultProps} columnConfigs={[]} />);
      
      // ColumnVisibilityToggle component should not be rendered
      expect(screen.queryByText('Columns')).not.toBeInTheDocument();
    });

    it('should render column visibility toggle with columns', () => {
      const { container } = render(<TableHeader {...defaultProps} />);
      
      // Check if ColumnVisibilityToggle is rendered (it would have columns button)
      const columnsElements = container.querySelectorAll('[class*="column"]');
      expect(columnsElements.length).toBeGreaterThan(0);
    });
  });
});