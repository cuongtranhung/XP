/**
 * Unit Tests for TableFilters Component
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import TableFilters from '../../../components/table/TableFilters';

describe('TableFilters Component', () => {
  const mockHandlers = {
    onSearchChange: jest.fn(),
    onSearchSubmit: jest.fn(),
    onFilterStatusChange: jest.fn(),
    onApplyFilters: jest.fn(),
    onBulkEdit: jest.fn(),
    onBulkDelete: jest.fn()
  };

  const defaultProps = {
    searchQuery: '',
    filterStatus: 'all',
    selectedCount: 0,
    ...mockHandlers
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render search input', () => {
      render(<TableFilters {...defaultProps} />);
      
      const searchInput = screen.getByPlaceholderText('Search in table...');
      expect(searchInput).toBeInTheDocument();
      expect(searchInput).toHaveAttribute('aria-label', 'Search submissions in table');
    });

    it('should render status filter dropdown', () => {
      render(<TableFilters {...defaultProps} />);
      
      const statusSelect = screen.getByLabelText('Filter submissions by status');
      expect(statusSelect).toBeInTheDocument();
      
      // Check options
      expect(screen.getByText('All Status')).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Submitted' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Completed' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Draft' })).toBeInTheDocument();
    });

    it('should render apply filters button', () => {
      render(<TableFilters {...defaultProps} />);
      
      const applyButton = screen.getByText('Apply Filters');
      expect(applyButton).toBeInTheDocument();
    });

    it('should not show bulk actions when no items selected', () => {
      render(<TableFilters {...defaultProps} />);
      
      expect(screen.queryByText(/Edit/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Delete/)).not.toBeInTheDocument();
    });

    it('should show bulk actions when items are selected', () => {
      render(<TableFilters {...defaultProps} selectedCount={5} />);
      
      expect(screen.getByText('Edit (5)')).toBeInTheDocument();
      expect(screen.getByText('Delete (5)')).toBeInTheDocument();
    });
  });

  describe('Search Functionality', () => {
    it('should handle search input changes', async () => {
      render(<TableFilters {...defaultProps} />);
      
      const searchInput = screen.getByPlaceholderText('Search in table...');
      await userEvent.type(searchInput, 'test search');
      
      expect(mockHandlers.onSearchChange).toHaveBeenCalledTimes(11); // Once per character
      expect(mockHandlers.onSearchChange).toHaveBeenLastCalledWith('test search');
    });

    it('should display current search query', () => {
      render(<TableFilters {...defaultProps} searchQuery="existing query" />);
      
      const searchInput = screen.getByPlaceholderText('Search in table...');
      expect(searchInput).toHaveValue('existing query');
    });

    it('should submit search on Enter key', async () => {
      render(<TableFilters {...defaultProps} />);
      
      const searchInput = screen.getByPlaceholderText('Search in table...');
      await userEvent.type(searchInput, 'search term{Enter}');
      
      expect(mockHandlers.onSearchSubmit).toHaveBeenCalledTimes(1);
    });

    it('should not submit search on other keys', async () => {
      render(<TableFilters {...defaultProps} />);
      
      const searchInput = screen.getByPlaceholderText('Search in table...');
      await userEvent.type(searchInput, 'search term');
      
      expect(mockHandlers.onSearchSubmit).not.toHaveBeenCalled();
    });
  });

  describe('Status Filter', () => {
    it('should handle status filter changes', async () => {
      render(<TableFilters {...defaultProps} />);
      
      const statusSelect = screen.getByLabelText('Filter submissions by status');
      await userEvent.selectOptions(statusSelect, 'completed');
      
      expect(mockHandlers.onFilterStatusChange).toHaveBeenCalledWith('completed');
    });

    it('should display current filter status', () => {
      render(<TableFilters {...defaultProps} filterStatus="submitted" />);
      
      const statusSelect = screen.getByLabelText('Filter submissions by status');
      expect(statusSelect).toHaveValue('submitted');
    });

    it('should have all status options available', () => {
      render(<TableFilters {...defaultProps} />);
      
      const statusSelect = screen.getByLabelText('Filter submissions by status');
      const options = statusSelect.querySelectorAll('option');
      
      expect(options).toHaveLength(6);
      expect(options[0]).toHaveTextContent('All Status');
      expect(options[1]).toHaveTextContent('Submitted');
      expect(options[2]).toHaveTextContent('Completed');
      expect(options[3]).toHaveTextContent('Draft');
      expect(options[4]).toHaveTextContent('Processing');
      expect(options[5]).toHaveTextContent('Failed');
    });
  });

  describe('Apply Filters', () => {
    it('should call onApplyFilters when button clicked', async () => {
      render(<TableFilters {...defaultProps} />);
      
      const applyButton = screen.getByText('Apply Filters');
      await userEvent.click(applyButton);
      
      expect(mockHandlers.onApplyFilters).toHaveBeenCalledTimes(1);
    });
  });

  describe('Bulk Actions', () => {
    it('should call onBulkEdit when edit button clicked', async () => {
      render(<TableFilters {...defaultProps} selectedCount={3} />);
      
      const editButton = screen.getByText('Edit (3)');
      await userEvent.click(editButton);
      
      expect(mockHandlers.onBulkEdit).toHaveBeenCalledTimes(1);
    });

    it('should call onBulkDelete when delete button clicked', async () => {
      render(<TableFilters {...defaultProps} selectedCount={3} />);
      
      const deleteButton = screen.getByText('Delete (3)');
      await userEvent.click(deleteButton);
      
      expect(mockHandlers.onBulkDelete).toHaveBeenCalledTimes(1);
    });

    it('should update button text with selection count', () => {
      const { rerender } = render(<TableFilters {...defaultProps} selectedCount={1} />);
      
      expect(screen.getByText('Edit (1)')).toBeInTheDocument();
      expect(screen.getByText('Delete (1)')).toBeInTheDocument();
      
      rerender(<TableFilters {...defaultProps} selectedCount={10} />);
      
      expect(screen.getByText('Edit (10)')).toBeInTheDocument();
      expect(screen.getByText('Delete (10)')).toBeInTheDocument();
    });

    it('should not render bulk actions when handlers not provided', () => {
      const propsWithoutHandlers = {
        searchQuery: '',
        filterStatus: 'all',
        selectedCount: 5,
        onSearchChange: jest.fn(),
        onSearchSubmit: jest.fn(),
        onFilterStatusChange: jest.fn(),
        onApplyFilters: jest.fn()
      };
      
      render(<TableFilters {...propsWithoutHandlers} />);
      
      expect(screen.queryByText(/Edit/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Delete/)).not.toBeInTheDocument();
    });

    it('should apply correct styling to bulk action buttons', () => {
      render(<TableFilters {...defaultProps} selectedCount={3} />);
      
      const editButton = screen.getByText('Edit (3)');
      expect(editButton).toHaveClass('border-blue-300', 'text-blue-600');
      
      const deleteButton = screen.getByText('Delete (3)');
      expect(deleteButton).toHaveClass('border-red-300', 'text-red-600');
    });
  });

  describe('Layout and Styling', () => {
    it('should have proper container styling', () => {
      const { container } = render(<TableFilters {...defaultProps} />);
      
      const filterContainer = container.firstChild;
      expect(filterContainer).toHaveClass('bg-white', 'rounded-lg', 'shadow-sm', 'border', 'border-gray-200');
    });

    it('should layout elements horizontally', () => {
      const { container } = render(<TableFilters {...defaultProps} />);
      
      const flexContainer = container.querySelector('.flex.items-center.space-x-4');
      expect(flexContainer).toBeInTheDocument();
    });

    it('should apply correct icon to search input', () => {
      render(<TableFilters {...defaultProps} />);
      
      // Check for Search icon (imported from lucide-react or similar)
      const searchContainer = screen.getByPlaceholderText('Search in table...').parentElement;
      expect(searchContainer?.querySelector('svg')).toBeInTheDocument();
    });
  });
});