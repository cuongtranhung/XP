/**
 * Unit Tests for EditableCell Component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import EditableCell from '../../components/EditableCell';

describe('EditableCell Component', () => {
  const mockOnSave = jest.fn();
  
  const defaultProps = {
    value: 'Test Value',
    fieldType: 'text',
    fieldKey: 'testField',
    submissionId: 'sub-123',
    onSave: mockOnSave,
    disabled: false
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the cell with initial value', () => {
      render(<EditableCell {...defaultProps} />);
      expect(screen.getByText('Test Value')).toBeInTheDocument();
    });

    it('should show "Click to edit" for empty values', () => {
      render(<EditableCell {...defaultProps} value={null} />);
      expect(screen.getByText('Click to edit')).toBeInTheDocument();
    });

    it('should render checkbox correctly', () => {
      render(<EditableCell {...defaultProps} fieldType="checkbox" value={true} />);
      expect(screen.getByText('✓')).toBeInTheDocument();
    });

    it('should render date correctly', () => {
      const date = '2024-01-15';
      render(<EditableCell {...defaultProps} fieldType="date" value={date} />);
      expect(screen.getByText(new Date(date).toLocaleDateString())).toBeInTheDocument();
    });

    it('should render select options', () => {
      const options = [
        { label: 'Option 1', value: 'opt1' },
        { label: 'Option 2', value: 'opt2' }
      ];
      render(
        <EditableCell 
          {...defaultProps} 
          fieldType="select" 
          value="opt1"
          options={options}
        />
      );
      expect(screen.getByText('opt1')).toBeInTheDocument();
    });
  });

  describe('Edit Mode', () => {
    it('should enter edit mode on click', async () => {
      render(<EditableCell {...defaultProps} />);
      const cell = screen.getByText('Test Value');
      
      await userEvent.click(cell);
      
      const input = screen.getByRole('textbox');
      expect(input).toBeInTheDocument();
      expect(input).toHaveValue('Test Value');
    });

    it('should not enter edit mode when disabled', async () => {
      render(<EditableCell {...defaultProps} disabled={true} />);
      const cell = screen.getByText('Test Value');
      
      await userEvent.click(cell);
      
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('should save on Enter key', async () => {
      render(<EditableCell {...defaultProps} />);
      const cell = screen.getByText('Test Value');
      
      await userEvent.click(cell);
      const input = screen.getByRole('textbox');
      
      await userEvent.clear(input);
      await userEvent.type(input, 'New Value');
      await userEvent.keyboard('{Enter}');
      
      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith('sub-123', 'testField', 'New Value');
      });
    });

    it('should cancel on Escape key', async () => {
      render(<EditableCell {...defaultProps} />);
      const cell = screen.getByText('Test Value');
      
      await userEvent.click(cell);
      const input = screen.getByRole('textbox');
      
      await userEvent.clear(input);
      await userEvent.type(input, 'New Value');
      await userEvent.keyboard('{Escape}');
      
      expect(mockOnSave).not.toHaveBeenCalled();
      expect(screen.getByText('Test Value')).toBeInTheDocument();
    });

    it('should save on blur', async () => {
      render(<EditableCell {...defaultProps} />);
      const cell = screen.getByText('Test Value');
      
      await userEvent.click(cell);
      const input = screen.getByRole('textbox');
      
      await userEvent.clear(input);
      await userEvent.type(input, 'New Value');
      fireEvent.blur(input);
      
      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith('sub-123', 'testField', 'New Value');
      });
    });
  });

  describe('Field Types', () => {
    it('should handle number input', async () => {
      render(<EditableCell {...defaultProps} fieldType="number" value={42} />);
      const cell = screen.getByText('42');
      
      await userEvent.click(cell);
      const input = screen.getByRole('spinbutton');
      
      await userEvent.clear(input);
      await userEvent.type(input, '100');
      await userEvent.keyboard('{Enter}');
      
      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith('sub-123', 'testField', '100');
      });
    });

    it('should handle checkbox toggle', async () => {
      render(<EditableCell {...defaultProps} fieldType="checkbox" value={false} />);
      const cell = screen.getByText('✗');
      
      await userEvent.click(cell);
      const checkbox = screen.getByRole('checkbox');
      
      await userEvent.click(checkbox);
      fireEvent.blur(checkbox);
      
      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith('sub-123', 'testField', true);
      });
    });

    it('should handle select change', async () => {
      const options = [
        { label: 'Option 1', value: 'opt1' },
        { label: 'Option 2', value: 'opt2' }
      ];
      
      render(
        <EditableCell 
          {...defaultProps} 
          fieldType="select" 
          value="opt1"
          options={options}
        />
      );
      
      const cell = screen.getByText('opt1');
      await userEvent.click(cell);
      
      const select = screen.getByRole('combobox');
      await userEvent.selectOptions(select, 'opt2');
      fireEvent.blur(select);
      
      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith('sub-123', 'testField', 'opt2');
      });
    });
  });

  describe('Error Handling', () => {
    it('should show error state on save failure', async () => {
      const mockFailingSave = jest.fn().mockRejectedValue(new Error('Save failed'));
      
      render(<EditableCell {...defaultProps} onSave={mockFailingSave} />);
      const cell = screen.getByText('Test Value');
      
      await userEvent.click(cell);
      const input = screen.getByRole('textbox');
      
      await userEvent.clear(input);
      await userEvent.type(input, 'New Value');
      await userEvent.keyboard('{Enter}');
      
      await waitFor(() => {
        expect(screen.getByText('Failed to save - click to retry')).toBeInTheDocument();
      });
    });

    it('should revert value on save failure', async () => {
      const mockFailingSave = jest.fn().mockRejectedValue(new Error('Save failed'));
      
      render(<EditableCell {...defaultProps} onSave={mockFailingSave} />);
      const cell = screen.getByText('Test Value');
      
      await userEvent.click(cell);
      const input = screen.getByRole('textbox');
      
      await userEvent.clear(input);
      await userEvent.type(input, 'New Value');
      await userEvent.keyboard('{Enter}');
      
      await waitFor(() => {
        expect(input).toHaveValue('Test Value');
      });
    });
  });

  describe('New Row Mode', () => {
    it('should start in edit mode for new rows', () => {
      render(<EditableCell {...defaultProps} isNewRow={true} />);
      
      const input = screen.getByRole('textbox');
      expect(input).toBeInTheDocument();
    });

    it('should remain in edit mode after save for new rows', async () => {
      render(<EditableCell {...defaultProps} isNewRow={true} />);
      
      const input = screen.getByRole('textbox');
      await userEvent.type(input, 'New Value');
      await userEvent.keyboard('{Enter}');
      
      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalled();
        expect(screen.getByRole('textbox')).toBeInTheDocument();
      });
    });
  });
});