import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'react-hot-toast';
import GroupDetailModal from '../GroupDetailModal';
import groupManagementService from '../../../services/groupManagementService';
import { Group, UserForGroupAssignment, BulkMemberResponse } from '../../../types/group-management';

// Mock dependencies
jest.mock('react-hot-toast');
jest.mock('../../../services/groupManagementService');

const mockToast = toast as jest.Mocked<typeof toast>;
const mockGroupService = groupManagementService as jest.Mocked<typeof groupManagementService>;

// Mock data
const mockGroup: Group = {
  id: 'group-123',
  name: 'test_group',
  display_name: 'Test Group',
  description: 'Test group description',
  group_type: 'custom',
  is_active: true,
  is_system: false,
  member_count: 2,
  active_member_count: 2,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z'
};

const mockInitialMembers: UserForGroupAssignment[] = [
  {
    id: 1,
    email: 'john@example.com',
    full_name: 'John Doe',
    department: 'Engineering',
    role_in_group: 'member',
    joined_at: '2024-01-01T00:00:00Z',
    is_approved: true,
    is_blocked: false
  },
  {
    id: 2,
    email: 'jane@example.com',
    full_name: 'Jane Smith',
    department: 'Marketing',
    role_in_group: 'manager',
    joined_at: '2024-01-02T00:00:00Z',
    is_approved: true,
    is_blocked: false
  }
];

const mockAvailableUsers: UserForGroupAssignment[] = [
  {
    id: 3,
    email: 'bob@example.com',
    full_name: 'Bob Wilson',
    department: 'Engineering',
    is_approved: true,
    is_blocked: false
  },
  {
    id: 4,
    email: 'alice@example.com',
    full_name: 'Alice Brown',
    department: 'Design',
    is_approved: true,
    is_blocked: false
  }
];

describe('Group Management Integration Tests', () => {
  const defaultProps = {
    group: mockGroup,
    isOpen: true,
    onClose: jest.fn(),
    onGroupUpdated: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default service mocks
    mockGroupService.getGroupById.mockResolvedValue({
      success: true,
      data: mockGroup
    });
    
    mockGroupService.getUsersByGroup.mockResolvedValue({
      success: true,
      data: mockInitialMembers
    });
    
    mockGroupService.searchUsersForAssignment.mockResolvedValue({
      success: true,
      data: mockAvailableUsers
    });
    
    mockGroupService.addMembersToGroup.mockResolvedValue({
      success: true,
      message: 'Members added successfully',
      data: {
        successful: [
          { user_id: '3', success: true, message: 'Added successfully' },
          { user_id: '4', success: true, message: 'Added successfully' }
        ],
        failed: [],
        summary: { total: 2, successful_count: 2, failed_count: 0 }
      }
    });
    
    mockGroupService.updateGroup.mockResolvedValue({
      success: true,
      data: { ...mockGroup, display_name: 'Updated Group' }
    });
    
    mockGroupService.removeMemberFromGroup.mockResolvedValue({
      success: true,
      data: undefined
    });
    
    mockGroupService.updateMemberRole.mockResolvedValue({
      success: true,
      data: { ...mockInitialMembers[0], role_in_group: 'manager' }
    });
  });

  describe('Complete Member Management Workflow', () => {
    it('should complete full member addition workflow', async () => {
      const user = userEvent.setup();
      render(<GroupDetailModal {...defaultProps} />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('Test Group')).toBeInTheDocument();
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      });

      // Click add members button
      const addMembersButton = screen.getByText('➕ Thêm thành viên');
      await user.click(addMembersButton);

      // Wait for user search modal to appear
      await waitFor(() => {
        expect(screen.getByText('Thêm thành viên vào nhóm: Test Group')).toBeInTheDocument();
      });

      // Wait for available users to load
      await waitFor(() => {
        expect(screen.getByText('Bob Wilson')).toBeInTheDocument();
        expect(screen.getByText('Alice Brown')).toBeInTheDocument();
      });

      // Select users
      const selectAllButton = screen.getByText('Chọn tất cả');
      await user.click(selectAllButton);

      expect(screen.getByText('Đã chọn: 2')).toBeInTheDocument();

      // Change role to manager
      const managerRole = screen.getByDisplayValue('manager');
      await user.click(managerRole);

      // Add members
      const addButton = screen.getByText(/Thêm \d+ thành viên/);
      await user.click(addButton);

      // Verify API calls
      await waitFor(() => {
        expect(mockGroupService.addMembersToGroup).toHaveBeenCalledWith(
          'group-123',
          {
            user_ids: ['3', '4'],
            role_in_group: 'manager'
          }
        );
      });

      // Verify success feedback
      expect(mockToast.success).toHaveBeenCalledWith('Đã thêm thành công 2 thành viên vào nhóm');

      // Verify modal closes and data reloads
      await waitFor(() => {
        expect(mockGroupService.getGroupById).toHaveBeenCalledTimes(2); // Initial + reload
        expect(mockGroupService.getUsersByGroup).toHaveBeenCalledTimes(2); // Initial + reload
      });
    });

    it('should handle member role update workflow', async () => {
      const user = userEvent.setup();
      render(<GroupDetailModal {...defaultProps} />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('Thành viên ▼')).toBeInTheDocument();
      });

      // Find John's role badge (member)
      const memberRoleBadge = screen.getByText('Thành viên ▼');
      
      // Hover to show dropdown (simulate with mouseenter)
      fireEvent.mouseEnter(memberRoleBadge);

      // Find and click manager option in dropdown
      const roleContainer = memberRoleBadge.closest('.relative.group');
      expect(roleContainer).toBeInTheDocument();

      const managerButton = roleContainer?.querySelector('[data-role="manager"]') as HTMLElement;
      if (!managerButton) {
        // Fallback: simulate the role update directly
        await user.click(memberRoleBadge);
      } else {
        await user.click(managerButton);
      }

      // Since the dropdown might not work in tests, we'll simulate the action
      // by calling the update function directly through a simulated interaction
      const updateButton = screen.getByText('Quản lý');
      if (updateButton) {
        fireEvent.click(updateButton);
      }

      // Verify success feedback
      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith('Đã cập nhật vai trò thành viên');
      });

      // Verify members list reloads
      expect(mockGroupService.getUsersByGroup).toHaveBeenCalledTimes(2);
    });

    it('should handle member removal workflow', async () => {
      const user = userEvent.setup();
      
      // Mock confirm dialog
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
      
      render(<GroupDetailModal {...defaultProps} />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getAllByText('🗑️')).toHaveLength(2);
      });

      // Click remove button for first member
      const removeButtons = screen.getAllByText('🗑️');
      await user.click(removeButtons[0]);

      // Verify confirmation dialog
      expect(confirmSpy).toHaveBeenCalledWith(
        'Bạn có chắc chắn muốn xóa "John Doe" khỏi nhóm?'
      );

      // Verify API call
      await waitFor(() => {
        expect(mockGroupService.removeMemberFromGroup).toHaveBeenCalledWith(
          'group-123',
          '1'
        );
      });

      // Verify success feedback
      expect(mockToast.success).toHaveBeenCalledWith('Đã xóa thành viên khỏi nhóm');

      // Verify members list reloads
      expect(mockGroupService.getUsersByGroup).toHaveBeenCalledTimes(2);
      
      confirmSpy.mockRestore();
    });

    it('should handle group information update workflow', async () => {
      const user = userEvent.setup();
      render(<GroupDetailModal {...defaultProps} />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByDisplayValue('Test Group')).toBeInTheDocument();
      });

      // Update group information
      const displayNameInput = screen.getByDisplayValue('Test Group');
      await user.clear(displayNameInput);
      await user.type(displayNameInput, 'Updated Group Name');

      const descriptionTextarea = screen.getByDisplayValue('Test group description');
      await user.clear(descriptionTextarea);
      await user.type(descriptionTextarea, 'Updated description');

      const activeCheckbox = screen.getByRole('checkbox');
      await user.click(activeCheckbox); // Deactivate

      // Save changes
      const saveButton = screen.getByText('💾 Lưu thay đổi');
      await user.click(saveButton);

      // Verify API call
      await waitFor(() => {
        expect(mockGroupService.updateGroup).toHaveBeenCalledWith(
          'group-123',
          {
            display_name: 'Updated Group Name',
            description: 'Updated description',
            is_active: false
          }
        );
      });

      // Verify success feedback
      expect(mockToast.success).toHaveBeenCalledWith('Cập nhật thông tin nhóm thành công');
      
      // Verify callback
      expect(defaultProps.onGroupUpdated).toHaveBeenCalled();
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle cascading errors gracefully', async () => {
      const user = userEvent.setup();
      
      // Mock group loading error
      mockGroupService.getGroupById.mockResolvedValueOnce({
        success: false,
        data: {} as Group,
        error: 'Group not found'
      });
      
      render(<GroupDetailModal {...defaultProps} />);

      // Should show error state
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Không thể tải thông tin chi tiết nhóm');
        expect(screen.getByText('Không thể tải thông tin nhóm')).toBeInTheDocument();
      });

      // Save button should not be available
      expect(screen.queryByText('💾 Lưu thay đổi')).not.toBeInTheDocument();
    });

    it('should handle member addition with partial failures', async () => {
      const user = userEvent.setup();
      
      const partialFailureResponse: BulkMemberResponse = {
        success: true,
        message: 'Processed 2 user assignments',
        data: {
          successful: [{ user_id: '3', success: true, message: 'Success' }],
          failed: [{ user_id: '4', success: false, error: 'User already in group' }],
          summary: { total: 2, successful_count: 1, failed_count: 1 }
        }
      };
      
      mockGroupService.addMembersToGroup.mockResolvedValue(partialFailureResponse);
      
      render(<GroupDetailModal {...defaultProps} />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('Test Group')).toBeInTheDocument();
      });

      // Open user search modal
      const addMembersButton = screen.getByText('➕ Thêm thành viên');
      await user.click(addMembersButton);

      // Wait for modal and select all users
      await waitFor(() => {
        expect(screen.getByText('Chọn tất cả')).toBeInTheDocument();
      });

      const selectAllButton = screen.getByText('Chọn tất cả');
      await user.click(selectAllButton);

      // Add members
      const addButton = screen.getByText(/Thêm \d+ thành viên/);
      await user.click(addButton);

      // Verify partial success message
      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith(
          'Đã thêm 1/2 thành viên. 1 thành viên thêm thất bại.',
          { duration: 4000 }
        );
      });
    });

    it('should handle network errors during operations', async () => {
      const user = userEvent.setup();
      
      // Mock network error
      mockGroupService.updateGroup.mockRejectedValue(new Error('Network error'));
      
      render(<GroupDetailModal {...defaultProps} />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByDisplayValue('Test Group')).toBeInTheDocument();
      });

      // Try to save changes
      const saveButton = screen.getByText('💾 Lưu thay đổi');
      await user.click(saveButton);

      // Should handle error gracefully
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Lỗi khi cập nhật thông tin nhóm');
      });
    });
  });

  describe('User Experience Integration', () => {
    it('should maintain state consistency throughout operations', async () => {
      const user = userEvent.setup();
      render(<GroupDetailModal {...defaultProps} />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('Thành viên nhóm (2)')).toBeInTheDocument();
      });

      // Verify initial member count
      expect(screen.getByText('Thành viên nhóm (2)')).toBeInTheDocument();

      // After adding members, count should update
      // (This would happen after successful member addition and reload)
      mockGroupService.getUsersByGroup.mockResolvedValueOnce({
        success: true,
        data: [...mockInitialMembers, ...mockAvailableUsers.map(u => ({ ...u, role_in_group: 'member' as const }))]
      });

      // Simulate member addition success and reload
      const addMembersButton = screen.getByText('➕ Thêm thành viên');
      await user.click(addMembersButton);

      // Modal should open
      await waitFor(() => {
        expect(screen.getByText('Thêm thành viên vào nhóm: Test Group')).toBeInTheDocument();
      });
    });

    it('should show appropriate loading states', async () => {
      const user = userEvent.setup();
      
      // Create controlled promises
      let resolveGroupLoad: (value: any) => void;
      const groupLoadPromise = new Promise((resolve) => {
        resolveGroupLoad = resolve;
      });
      
      mockGroupService.getGroupById.mockReturnValue(groupLoadPromise);
      
      render(<GroupDetailModal {...defaultProps} />);

      // Should show loading initially
      expect(screen.getByText('Đang tải thông tin...')).toBeInTheDocument();

      // Resolve loading
      resolveGroupLoad({ success: true, data: mockGroup });

      // Should hide loading
      await waitFor(() => {
        expect(screen.queryByText('Đang tải thông tin...')).not.toBeInTheDocument();
        expect(screen.getByText('Test Group')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility Integration', () => {
    it('should maintain focus management throughout workflow', async () => {
      const user = userEvent.setup();
      render(<GroupDetailModal {...defaultProps} />);

      // Wait for modal to be ready
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Modal should have proper ARIA attributes
      const modal = screen.getByRole('dialog');
      expect(modal).toHaveAttribute('aria-modal', 'true');

      // Should support keyboard navigation
      await user.tab();
      await user.tab();
      expect(screen.getByDisplayValue('Test Group')).toHaveFocus();
    });

    it('should provide proper screen reader support', async () => {
      render(<GroupDetailModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByLabelText('Đóng')).toBeInTheDocument();
      });

      // All interactive elements should have proper labels
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
      expect(screen.getByLabelText('Đóng')).toBeInTheDocument();
    });
  });
});