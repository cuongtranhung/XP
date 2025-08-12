/**
 * Unit Tests for SearchInput Component
 * Testing search suggestions, keyboard navigation, and accessibility
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchInput, UserSearchInput, RoleSearchInput } from '../../components/search/SearchInput';

// Mock fetch
global.fetch = jest.fn();

const mockUsers = [
  { id: '1', firstName: 'John', lastName: 'Doe', email: 'john@test.com' },
  { id: '2', firstName: 'Jane', lastName: 'Smith', email: 'jane@test.com' },
  { id: '3', firstName: 'Bob', lastName: 'Johnson', email: 'bob@test.com' }
];

const mockRoles = [
  { id: '1', name: 'Administrator', description: 'Full system access', level: 'admin' },
  { id: '2', name: 'Manager', description: 'Team management', level: 'manager' },
  { id: '3', name: 'User', description: 'Basic access', level: 'user' }
];

describe('SearchInput', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });

  const defaultProps = {
    searchFn: jest.fn(),
    renderSuggestion: (item: any) => <div>{item.name}</div>,
    getSuggestionKey: (item: any) => item.id,
    placeholder: 'Search test'
  };

  it('should render input with correct attributes', () => {
    render(<SearchInput {...defaultProps} />);
    
    const input = screen.getByRole('combobox');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-autocomplete', 'list');
    expect(input).toHaveAttribute('aria-haspopup', 'listbox');
    expect(input).toHaveAttribute('placeholder', 'Search test');
  });

  it('should show loading indicator when searching', async () => {
    const searchFn = jest.fn(() => new Promise(() => {})); // Never resolves
    render(<SearchInput {...defaultProps} searchFn={searchFn} />);
    
    const input = screen.getByRole('combobox');
    await userEvent.type(input, 'test query');
    
    await waitFor(() => {
      expect(screen.getByText('Loading suggestions')).toBeInTheDocument();
    });
  });

  it('should display suggestions when search returns results', async () => {
    const mockItems = [{ id: '1', name: 'Item 1' }, { id: '2', name: 'Item 2' }];
    const searchFn = jest.fn().mockResolvedValue(mockItems);
    
    render(<SearchInput {...defaultProps} searchFn={searchFn} />);
    
    const input = screen.getByRole('combobox');
    await userEvent.type(input, 'test');
    
    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
      expect(screen.getByText('Item 1')).toBeInTheDocument();
      expect(screen.getByText('Item 2')).toBeInTheDocument();
    });
  });

  it('should handle keyboard navigation', async () => {
    const mockItems = [{ id: '1', name: 'Item 1' }, { id: '2', name: 'Item 2' }];
    const searchFn = jest.fn().mockResolvedValue(mockItems);
    const onSelect = jest.fn();
    
    render(<SearchInput {...defaultProps} searchFn={searchFn} onSelect={onSelect} />);
    
    const input = screen.getByRole('combobox');
    await userEvent.type(input, 'test');
    
    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });
    
    // Navigate down
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');
    
    // Navigate down again
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true');
    
    // Select with Enter
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith(mockItems[1]);
  });

  it('should close suggestions on Escape key', async () => {
    const mockItems = [{ id: '1', name: 'Item 1' }];
    const searchFn = jest.fn().mockResolvedValue(mockItems);
    
    render(<SearchInput {...defaultProps} searchFn={searchFn} />);
    
    const input = screen.getByRole('combobox');
    await userEvent.type(input, 'test');
    
    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });
    
    fireEvent.keyDown(input, { key: 'Escape' });
    
    await waitFor(() => {
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
  });

  it('should handle mouse selection', async () => {
    const mockItems = [{ id: '1', name: 'Item 1' }];
    const searchFn = jest.fn().mockResolvedValue(mockItems);
    const onSelect = jest.fn();
    
    render(<SearchInput {...defaultProps} searchFn={searchFn} onSelect={onSelect} />);
    
    const input = screen.getByRole('combobox');
    await userEvent.type(input, 'test');
    
    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });
    
    const option = screen.getByRole('option');
    fireEvent.click(option);
    
    expect(onSelect).toHaveBeenCalledWith(mockItems[0]);
  });

  it('should display error message when search fails', async () => {
    const searchFn = jest.fn().mockRejectedValue(new Error('Search failed'));
    
    render(<SearchInput {...defaultProps} searchFn={searchFn} />);
    
    const input = screen.getByRole('combobox');
    await userEvent.type(input, 'test');
    
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Search failed')).toBeInTheDocument();
    });
  });

  it('should clear search when clear button is clicked', async () => {
    const onChange = jest.fn();
    render(<SearchInput {...defaultProps} onChange={onChange} />);
    
    const input = screen.getByRole('combobox');
    await userEvent.type(input, 'test');
    
    const clearButton = screen.getByLabelText('Clear search');
    fireEvent.click(clearButton);
    
    expect(input).toHaveValue('');
    expect(onChange).toHaveBeenLastCalledWith('');
  });

  it('should close suggestions when clicking outside', async () => {
    const mockItems = [{ id: '1', name: 'Item 1' }];
    const searchFn = jest.fn().mockResolvedValue(mockItems);
    
    render(
      <div>
        <SearchInput {...defaultProps} searchFn={searchFn} />
        <div data-testid="outside">Outside</div>
      </div>
    );
    
    const input = screen.getByRole('combobox');
    await userEvent.type(input, 'test');
    
    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });
    
    const outsideElement = screen.getByTestId('outside');
    fireEvent.mouseDown(outsideElement);
    
    await waitFor(() => {
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
  });

  it('should handle debouncing correctly', async () => {
    const searchFn = jest.fn().mockResolvedValue([]);
    render(<SearchInput {...defaultProps} searchFn={searchFn} debounceTime={100} />);
    
    const input = screen.getByRole('combobox');
    
    // Type quickly
    await userEvent.type(input, 'a');
    await userEvent.type(input, 'b');
    await userEvent.type(input, 'c');
    
    // Should not have called search function yet
    expect(searchFn).not.toHaveBeenCalled();
    
    // Wait for debounce
    await waitFor(() => {
      expect(searchFn).toHaveBeenCalledWith('abc');
    }, { timeout: 200 });
    
    // Should only be called once due to debouncing
    expect(searchFn).toHaveBeenCalledTimes(1);
  });

  it('should respect minChars setting', async () => {
    const searchFn = jest.fn().mockResolvedValue([]);
    render(<SearchInput {...defaultProps} searchFn={searchFn} minChars={3} />);
    
    const input = screen.getByRole('combobox');
    
    // Type less than minChars
    await userEvent.type(input, 'ab');
    
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 400)); // Wait for debounce
    });
    
    expect(searchFn).not.toHaveBeenCalled();
    
    // Type enough characters
    await userEvent.type(input, 'c');
    
    await waitFor(() => {
      expect(searchFn).toHaveBeenCalledWith('abc');
    });
  });
});

describe('UserSearchInput', () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ users: mockUsers })
    });
  });

  it('should render user search input', () => {
    render(<UserSearchInput />);
    
    const input = screen.getByTestId('user-search-input');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('placeholder', 'Search users...');
  });

  it('should fetch and display user suggestions', async () => {
    render(<UserSearchInput />);
    
    const input = screen.getByRole('combobox');
    await userEvent.type(input, 'john');
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/users/search?q=john');
    });
    
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('john@test.com')).toBeInTheDocument();
    });
  });

  it('should call onSelect when user is selected', async () => {
    const onSelect = jest.fn();
    render(<UserSearchInput onSelect={onSelect} />);
    
    const input = screen.getByRole('combobox');
    await userEvent.type(input, 'john');
    
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
    
    const userOption = screen.getByText('John Doe').closest('[role="option"]');
    fireEvent.click(userOption!);
    
    expect(onSelect).toHaveBeenCalledWith(mockUsers[0]);
  });
});

describe('RoleSearchInput', () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ roles: mockRoles })
    });
  });

  it('should render role search input', () => {
    render(<RoleSearchInput />);
    
    const input = screen.getByTestId('role-search-input');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('placeholder', 'Search roles...');
  });

  it('should fetch and display role suggestions', async () => {
    render(<RoleSearchInput />);
    
    const input = screen.getByRole('combobox');
    await userEvent.type(input, 'admin');
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/roles/search?q=admin');
    });
    
    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
      expect(screen.getByText('Full system access')).toBeInTheDocument();
    });
  });

  it('should call onSelect when role is selected', async () => {
    const onSelect = jest.fn();
    render(<RoleSearchInput onSelect={onSelect} />);
    
    const input = screen.getByRole('combobox');
    await userEvent.type(input, 'admin');
    
    await waitFor(() => {
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });
    
    const roleOption = screen.getByText('Administrator').closest('[role="option"]');
    fireEvent.click(roleOption!);
    
    expect(onSelect).toHaveBeenCalledWith(mockRoles[0]);
  });

  it('should handle fetch errors gracefully', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));
    
    render(<RoleSearchInput />);
    
    const input = screen.getByRole('combobox');
    await userEvent.type(input, 'admin');
    
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/Failed to search roles/)).toBeInTheDocument();
    });
  });
});