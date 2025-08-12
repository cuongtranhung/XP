import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'react-hot-toast';
import UserSearchModal from '../UserSearchModal';
import groupManagementService from '../../../services/groupManagementService';
import { UserForGroupAssignment, BulkMemberResponse } from '../../../types/group-management';

// Mock dependencies
jest.mock('react-hot-toast');
jest.mock('../../../services/groupManagementService');

const mockToast = toast as jest.Mocked<typeof toast>;
const mockGroupService = groupManagementService as jest.Mocked<typeof groupManagementService>;

// Mock data
const mockUsers: UserForGroupAssignment[] = [
  {
    id: 1,
    email: 'john@example.com',
    full_name: 'John Doe',
    department: 'Engineering',
    position: 'Developer',
    is_approved: true,
    is_blocked: false
  },
  {
    id: 2,
    email: 'jane@example.com',
    full_name: 'Jane Smith',
    department: 'Marketing',
    position: 'Manager',
    is_approved: true,
    is_blocked: false
  },
  {
    id: 3,
    email: 'blocked@example.com',
    full_name: 'Blocked User',
    department: 'Engineering',
    is_approved: false,
    is_blocked: true
  }
];

const mockSuccessResponse: BulkMemberResponse = {
  success: true,
  message: 'Processed 2 user assignments',
  data: {
    successful: [
      { user_id: '1', success: true, message: 'User added successfully' },
      { user_id: '2', success: true, message: 'User added successfully' }
    ],
    failed: [],
    summary: {
      total: 2,
      successful_count: 2,
      failed_count: 0
    }
  }
};

describe('UserSearchModal', () => {
  const defaultProps = {
    groupId: 'group-123',
    groupName: 'Test Group',
    isOpen: true,
    onClose: jest.fn(),
    onMembersAdded: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGroupService.searchUsersForAssignment.mockResolvedValue({
      success: true,
      data: mockUsers
    });
    mockGroupService.addMembersToGroup.mockResolvedValue(mockSuccessResponse);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Rendering', () => {
    it('should not render when closed', () => {
      render(<UserSearchModal {...defaultProps} isOpen={false} />);
      expect(screen.queryByText('Thêm thành viên vào nhóm:')).not.toBeInTheDocument();
    });

    it('should render when open', async () => {
      render(<UserSearchModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Thêm thành viên vào nhóm: Test Group')).toBeInTheDocument();
      });
    });

    it('should show loading state initially', () => {
      render(<UserSearchModal {...defaultProps} />);
      expect(screen.getByText('Đang tìm kiếm...')).toBeInTheDocument();
    });

    it('should display users after loading', async () => {
      render(<UserSearchModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
        expect(screen.getByText('Blocked User')).toBeInTheDocument();
      });
    });
  });

  describe('User Search', () => {
    it('should search users on mount', async () => {
      render(<UserSearchModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(mockGroupService.searchUsersForAssignment).toHaveBeenCalledWith(
          'group-123',
          undefined,
          undefined,
          50
        );
      });
    });

    it('should debounce search input', async () => {
      jest.useFakeTimers();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      
      render(<UserSearchModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Nhập tên hoặc email...')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Nhập tên hoặc email...');
      
      await act(async () => {
        await user.type(searchInput, 'john');
      });
      
      // Should have initial call plus multiple calls during typing
      expect(mockGroupService.searchUsersForAssignment).toHaveBeenCalledTimes(6); // Initial + 4 characters typed + extra calls
      
      // Fast-forward debounce time
      await act(async () => {
        jest.advanceTimersByTime(300);
      });
      
      await waitFor(() => {
        expect(mockGroupService.searchUsersForAssignment).toHaveBeenCalledWith(
          'group-123',
          'john',
          undefined,
          50
        );
      });
      
      jest.useRealTimers();
    });

    it('should filter by department', async () => {
      const user = userEvent.setup();
      render(<UserSearchModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('Tất cả phòng ban')).toBeInTheDocument();
      });

      const departmentSelect = screen.getByDisplayValue('Tất cả phòng ban');
      
      await act(async () => {
        await user.selectOptions(departmentSelect, 'Engineering');
      });
      
      await waitFor(() => {
        expect(mockGroupService.searchUsersForAssignment).toHaveBeenCalledWith(
          'group-123',
          '',
          'Engineering',
          50
        );
      });
    });

    it('should show no results message when no users found', async () => {
      mockGroupService.searchUsersForAssignment.mockResolvedValue({
        success: true,
        data: []
      });
      
      render(<UserSearchModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Không có người dùng nào khả dụng để thêm vào nhóm')).toBeInTheDocument();
      });
    });
  });

  describe('User Selection', () => {
    it('should allow selecting users', async () => {
      const user = userEvent.setup();
      render(<UserSearchModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[0]); // First user checkbox
      
      expect(screen.getByText('Đã chọn: 1')).toBeInTheDocument();
    });

    it('should allow selecting all users', async () => {
      const user = userEvent.setup();
      render(<UserSearchModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Chọn tất cả')).toBeInTheDocument();
      });

      const selectAllButton = screen.getByText('Chọn tất cả');
      await user.click(selectAllButton);
      
      expect(screen.getByText('Đã chọn: 3')).toBeInTheDocument();
      expect(screen.getByText('Bỏ chọn tất cả')).toBeInTheDocument();
    });

    it('should allow deselecting all users', async () => {
      const user = userEvent.setup();
      render(<UserSearchModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Chọn tất cả')).toBeInTheDocument();
      });

      // Select all first
      const selectAllButton = screen.getByText('Chọn tất cả');
      await user.click(selectAllButton);
      
      expect(screen.getByText('Đã chọn: 3')).toBeInTheDocument();
      
      // Then deselect all
      const deselectAllButton = screen.getByText('Bỏ chọn tất cả');
      await user.click(deselectAllButton);
      
      expect(screen.getByText('Đã chọn: 0')).toBeInTheDocument();
    });

    it('should show user status badges', async () => {
      render(<UserSearchModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Bị khóa')).toBeInTheDocument();
        expect(screen.getByText('Chờ duyệt')).toBeInTheDocument();
      });
    });
  });

  describe('Role Selection', () => {
    it('should default to member role', () => {
      render(<UserSearchModal {...defaultProps} />);
      
      const memberRadio = screen.getByDisplayValue('member');
      expect(memberRadio).toBeChecked();
    });

    it('should allow changing role', async () => {
      const user = userEvent.setup();
      render(<UserSearchModal {...defaultProps} />);
      
      const managerRadio = screen.getByDisplayValue('manager');
      await user.click(managerRadio);
      
      expect(managerRadio).toBeChecked();
    });
  });

  describe('Adding Members', () => {
    it('should prevent adding without selection', async () => {
      const user = userEvent.setup();
      render(<UserSearchModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText(/Thêm \d+ thành viên/)).toBeInTheDocument();
      });

      const addButton = screen.getByText(/Thêm \d+ thành viên/);
      await user.click(addButton);
      
      expect(mockToast.error).toHaveBeenCalledWith('Vui lòng chọn ít nhất một người dùng');
    });

    it('should add selected members successfully', async () => {
      const user = userEvent.setup();
      render(<UserSearchModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Select first user
      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[0]);
      
      // Click add button
      const addButton = screen.getByText(/Thêm \d+ thành viên/);
      await user.click(addButton);
      
      await waitFor(() => {
        expect(mockGroupService.addMembersToGroup).toHaveBeenCalledWith(
          'group-123',
          {
            user_ids: ['1'],
            role_in_group: 'member'
          }
        );
      });

      expect(mockToast.success).toHaveBeenCalledWith('Đã thêm thành công 2 thành viên vào nhóm');
      expect(defaultProps.onMembersAdded).toHaveBeenCalled();
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('should handle partial success', async () => {
      const user = userEvent.setup();
      
      const partialSuccessResponse: BulkMemberResponse = {
        success: true,
        message: 'Processed 2 user assignments',
        data: {
          successful: [{ user_id: '1', success: true, message: 'Success' }],
          failed: [{ user_id: '2', success: false, error: 'User not found' }],
          summary: { total: 2, successful_count: 1, failed_count: 1 }
        }
      };
      
      mockGroupService.addMembersToGroup.mockResolvedValue(partialSuccessResponse);
      
      render(<UserSearchModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Select users
      const selectAllButton = screen.getByText('Chọn tất cả');
      await user.click(selectAllButton);
      
      // Add members
      const addButton = screen.getByText(/Thêm \d+ thành viên/);
      await user.click(addButton);
      
      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith(
          'Đã thêm 1/2 thành viên. 1 thành viên thêm thất bại.',
          { duration: 4000 }
        );
      });
    });

    it('should handle add members error', async () => {
      const user = userEvent.setup();
      
      mockGroupService.addMembersToGroup.mockRejectedValue(new Error('Network error'));
      
      render(<UserSearchModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Select and add user
      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[0]);
      
      const addButton = screen.getByText(/Thêm \d+ thành viên/);
      await user.click(addButton);
      
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Lỗi khi thêm thành viên vào nhóm');
      });
    });

    it('should show loading state during add operation', async () => {
      const user = userEvent.setup();
      
      // Create a promise that we can control
      let resolveAdd: (value: BulkMemberResponse) => void;
      const addPromise = new Promise<BulkMemberResponse>((resolve) => {
        resolveAdd = resolve;
      });
      
      mockGroupService.addMembersToGroup.mockReturnValue(addPromise);
      
      render(<UserSearchModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Select and add user
      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[0]);
      
      const addButton = screen.getByText(/Thêm \d+ thành viên/);
      await user.click(addButton);
      
      // Should show loading state
      expect(screen.getByText('Đang thêm...')).toBeInTheDocument();
      
      // Resolve the promise
      resolveAdd!(mockSuccessResponse);
      
      await waitFor(() => {
        expect(screen.queryByText('Đang thêm...')).not.toBeInTheDocument();
      });
    });
  });

  describe('Modal Controls', () => {
    it('should close modal when clicking close button', async () => {
      const user = userEvent.setup();
      render(<UserSearchModal {...defaultProps} />);
      
      const closeButton = screen.getByRole('button', { name: 'Đóng' });
      await user.click(closeButton);
      
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('should close modal when clicking backdrop', async () => {
      const user = userEvent.setup();
      render(<UserSearchModal {...defaultProps} />);
      
      const backdrop = screen.getByRole('dialog').previousSibling as HTMLElement;
      await user.click(backdrop);
      
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('should reset state when modal opens', async () => {
      const { rerender } = render(<UserSearchModal {...defaultProps} isOpen={false} />);
      
      rerender(<UserSearchModal {...defaultProps} isOpen={true} />);
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('')).toBeInTheDocument(); // Search input should be empty
      });
      
      const memberRadio = screen.getByDisplayValue('member');
      expect(memberRadio).toBeChecked(); // Should default to member role
    });
  });

  describe('Error Handling', () => {
    it('should handle search error', async () => {
      mockGroupService.searchUsersForAssignment.mockResolvedValue({
        success: false,
        data: [],
        error: 'Search failed'
      });
      
      render(<UserSearchModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Không thể tìm kiếm người dùng: Search failed');
      });
    });

    it('should handle search exception', async () => {
      mockGroupService.searchUsersForAssignment.mockRejectedValue(new Error('Network error'));
      
      render(<UserSearchModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Lỗi khi tìm kiếm người dùng');
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<UserSearchModal {...defaultProps} />);
      
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
      expect(screen.getByLabelText('Đóng')).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<UserSearchModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Nhập tên hoặc email...')).toBeInTheDocument();
      });

      // Should be able to tab through form elements
      await user.tab();
      expect(screen.getByPlaceholderText('Nhập tên hoặc email...')).toHaveFocus();
      
      await user.tab();
      expect(screen.getByDisplayValue('Tất cả phòng ban')).toHaveFocus();
    });
  });
});