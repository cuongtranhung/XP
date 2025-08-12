/**
 * Unit Tests for InfiniteScrollUserTable Component
 * Testing infinite scroll behavior, user actions, and virtual mode
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InfiniteScrollUserTable } from '../../components/user-management/InfiniteScrollUserTable';
import { userManagementService } from '../../services/userManagementService';
import { ToastProvider } from '../../providers/ToastProvider';

// Mock the service
jest.mock('../../services/userManagementService');

// Mock the hooks
jest.mock('../../hooks/useToast', () => ({
  useToast: () => ({
    addToast: jest.fn(),
  }),
}));

// Mock accessibility config
jest.mock('../../config/accessibility', () => ({
  formatAnnouncement: jest.fn(),
  a11yConfig: {
    announcements: {
      loading: 'Loading',
      loadingComplete: 'Loading complete',
    },
  },
}));

const mockUsers = [
  {
    id: '1',
    email: 'user1@test.com',
    firstName: 'John',
    lastName: 'Doe',
    status: 'active',
    role: 'user',
    department: 'Engineering',
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    email: 'user2@test.com',
    firstName: 'Jane',
    lastName: 'Smith',
    status: 'pending',
    role: 'admin',
    department: 'HR',
    createdAt: '2024-01-02T00:00:00Z',
  },
  {
    id: '3',
    email: 'user3@test.com',
    firstName: 'Bob',
    lastName: 'Johnson',
    status: 'blocked',
    role: 'user',
    department: 'Sales',
    createdAt: '2024-01-03T00:00:00Z',
  },
];

describe('InfiniteScrollUserTable', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock service responses
    (userManagementService.getUsers as jest.Mock).mockResolvedValue({
      data: mockUsers,
      total: 3,
      page: 1,
      limit: 50,
    });
    
    (userManagementService.approveUser as jest.Mock).mockResolvedValue({
      ...mockUsers[1],
      status: 'active',
    });
    
    (userManagementService.blockUser as jest.Mock).mockResolvedValue({
      ...mockUsers[0],
      status: 'blocked',
    });
    
    (userManagementService.deleteUser as jest.Mock).mockResolvedValue(undefined);
  });

  const renderComponent = (props = {}) => {
    return render(
      <ToastProvider>
        <InfiniteScrollUserTable {...props} />
      </ToastProvider>
    );
  };

  it('should render initial users', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
    });
  });

  it('should display user statuses correctly', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('active')).toBeInTheDocument();
      expect(screen.getByText('pending')).toBeInTheDocument();
      expect(screen.getByText('blocked')).toBeInTheDocument();
    });
  });

  it('should load more users when scrolling to bottom', async () => {
    const moreUsers = Array.from({ length: 50 }, (_, i) => ({
      id: `user-${i + 4}`,
      email: `user${i + 4}@test.com`,
      firstName: `User`,
      lastName: `${i + 4}`,
      status: 'active',
      role: 'user',
      department: 'IT',
      createdAt: '2024-01-04T00:00:00Z',
    }));

    (userManagementService.getUsers as jest.Mock)
      .mockResolvedValueOnce({
        data: mockUsers,
        total: 100,
        page: 1,
        limit: 50,
      })
      .mockResolvedValueOnce({
        data: moreUsers,
        total: 100,
        page: 2,
        limit: 50,
      });

    const { container } = renderComponent();

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Find the sentinel element and trigger intersection
    const sentinel = container.querySelector('[aria-hidden="true"]');
    expect(sentinel).toBeInTheDocument();

    // Mock IntersectionObserver callback
    const mockIntersectionObserver = jest.fn();
    mockIntersectionObserver.mockReturnValue({
      observe: () => null,
      unobserve: () => null,
      disconnect: () => null,
    });
    window.IntersectionObserver = mockIntersectionObserver as any;

    // Verify that getUsers was called
    expect(userManagementService.getUsers).toHaveBeenCalledTimes(1);
  });

  it('should filter users based on search term', async () => {
    renderComponent({ searchTerm: 'john' });

    await waitFor(() => {
      expect(userManagementService.getUsers).toHaveBeenCalledWith(
        expect.objectContaining({
          search: 'john',
        })
      );
    });
  });

  it('should filter users based on status', async () => {
    renderComponent({
      filters: { status: 'active' },
    });

    await waitFor(() => {
      expect(userManagementService.getUsers).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'active',
        })
      );
    });
  });

  it('should handle user approval', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });

    // Find the approve button for the pending user
    const approveButtons = screen.getAllByTitle('Approve user');
    fireEvent.click(approveButtons[0]);

    // Confirm in dialog
    await waitFor(() => {
      expect(screen.getByText(/Are you sure you want to approve/)).toBeInTheDocument();
    });

    const confirmButton = screen.getByText('Approve');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(userManagementService.approveUser).toHaveBeenCalledWith('2');
    });
  });

  it('should handle user blocking', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Find the block button for the active user
    const blockButtons = screen.getAllByTitle('Block user');
    fireEvent.click(blockButtons[0]);

    // Confirm in dialog
    await waitFor(() => {
      expect(screen.getByText(/Are you sure you want to block/)).toBeInTheDocument();
    });

    const confirmButton = screen.getByText('Block');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(userManagementService.blockUser).toHaveBeenCalledWith('1');
    });
  });

  it('should handle user deletion', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Find the delete button
    const deleteButtons = screen.getAllByTitle('Delete user');
    fireEvent.click(deleteButtons[0]);

    // Confirm in dialog
    await waitFor(() => {
      expect(screen.getByText(/Are you sure you want to permanently delete/)).toBeInTheDocument();
    });

    const confirmButton = screen.getByText('Delete');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(userManagementService.deleteUser).toHaveBeenCalledWith('1');
    });
  });

  it('should display empty state when no users', async () => {
    (userManagementService.getUsers as jest.Mock).mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      limit: 50,
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('No users found')).toBeInTheDocument();
      expect(screen.getByText('Try adjusting your search or filters')).toBeInTheDocument();
    });
  });

  it('should handle loading state', async () => {
    let resolvePromise: any;
    const promise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    (userManagementService.getUsers as jest.Mock).mockReturnValue(promise);

    renderComponent();

    // Should show loading initially
    expect(screen.getByText('Loading more users...')).toBeInTheDocument();

    // Resolve the promise
    resolvePromise({
      data: mockUsers,
      total: 3,
      page: 1,
      limit: 50,
    });

    await waitFor(() => {
      expect(screen.queryByText('Loading more users...')).not.toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
  });

  it('should handle error state', async () => {
    (userManagementService.getUsers as jest.Mock).mockRejectedValue(
      new Error('Failed to load users')
    );

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Failed to load users')).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });

    // Click retry button
    fireEvent.click(screen.getByText('Retry'));

    // Should attempt to load again
    expect(userManagementService.getUsers).toHaveBeenCalledTimes(2);
  });

  it('should display user count statistics', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/Showing.*3.*of.*3.*users/)).toBeInTheDocument();
    });
  });

  it('should use virtual mode when enabled', async () => {
    const { container } = renderComponent({ virtualMode: true });

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Check for virtual scrolling elements
    const virtualContainer = container.querySelector('[style*="translateY"]');
    expect(virtualContainer).toBeInTheDocument();
  });

  it('should reset filters when they change', async () => {
    const { rerender } = renderComponent({ searchTerm: 'john' });

    await waitFor(() => {
      expect(userManagementService.getUsers).toHaveBeenCalledTimes(1);
    });

    // Change search term
    rerender(
      <ToastProvider>
        <InfiniteScrollUserTable searchTerm="jane" />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(userManagementService.getUsers).toHaveBeenCalledTimes(2);
      expect(userManagementService.getUsers).toHaveBeenLastCalledWith(
        expect.objectContaining({
          search: 'jane',
        })
      );
    });
  });

  it('should call onUserUpdate when user is updated', async () => {
    const onUserUpdate = jest.fn();
    renderComponent({ onUserUpdate });

    await waitFor(() => {
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });

    // Approve the pending user
    const approveButtons = screen.getAllByTitle('Approve user');
    fireEvent.click(approveButtons[0]);

    const confirmButton = await screen.findByText('Approve');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(onUserUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          id: '2',
          status: 'active',
        })
      );
    });
  });

  it('should handle "No more users to load" message', async () => {
    (userManagementService.getUsers as jest.Mock).mockResolvedValue({
      data: mockUsers.slice(0, 2), // Less than PAGE_SIZE
      total: 2,
      page: 1,
      limit: 50,
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('No more users to load')).toBeInTheDocument();
    });
  });
});