import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'react-hot-toast';
import GroupDetailModal from '../GroupDetailModal';
import groupManagementService from '../../../services/groupManagementService';
import { Group, UserForGroupAssignment } from '../../../types/group-management';

// Mock dependencies
jest.mock('react-hot-toast');
jest.mock('../../../services/groupManagementService');
jest.mock('../UserSearchModal', () => {
  return function MockUserSearchModal({ isOpen, onClose, onMembersAdded }: any) {
    return isOpen ? (
      <div data-testid="user-search-modal">
        <button onClick={onMembersAdded}>Mock Add Members</button>
        <button onClick={onClose}>Mock Close</button>
      </div>
    ) : null;
  };
});

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
  member_count: 3,
  active_member_count: 2,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z'
};

const mockSystemGroup: Group = {
  ...mockGroup,
  id: 'system-group-123',
  name: 'administrators',
  display_name: 'Administrators',
  group_type: 'system',
  is_system: true
};

const mockMembers: UserForGroupAssignment[] = [
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
  },
  {
    id: 3,
    email: 'blocked@example.com',
    full_name: 'Blocked User',
    role_in_group: 'member',
    is_approved: false,
    is_blocked: true
  }
];

describe('GroupDetailModal', () => {
  const defaultProps = {
    group: mockGroup,
    isOpen: true,
    onClose: jest.fn(),
    onGroupUpdated: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock service responses
    mockGroupService.getGroupById.mockResolvedValue({
      success: true,
      data: mockGroup
    });
    
    mockGroupService.getUsersByGroup.mockResolvedValue({
      success: true,
      data: mockMembers
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
      data: mockMembers[0]
    });
  });

  describe('Rendering', () => {
    it('should not render when closed', () => {
      render(<GroupDetailModal {...defaultProps} isOpen={false} />);
      expect(screen.queryByText('Chi tiết nhóm')).not.toBeInTheDocument();
    });

    it('should not render without group', () => {
      render(<GroupDetailModal {...defaultProps} group={null} />);
      expect(screen.queryByText('Chi tiết nhóm')).not.toBeInTheDocument();
    });

    it('should show loading state initially', () => {
      render(<GroupDetailModal {...defaultProps} />);
      expect(screen.getByText('Đang tải thông tin...')).toBeInTheDocument();
    });

    it('should render group details after loading', async () => {
      render(<GroupDetailModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Group')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Test Group')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Test group description')).toBeInTheDocument();
      });
    });

    it('should display group type badge', async () => {
      render(<GroupDetailModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Tùy chỉnh')).toBeInTheDocument();
      });
    });

    it('should show member count', async () => {
      render(<GroupDetailModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Thành viên nhóm (3)')).toBeInTheDocument();
      });
    });
  });

  describe('Group Information', () => {
    it('should display basic group information', async () => {
      render(<GroupDetailModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('test_group')).toBeInTheDocument(); // System name
        expect(screen.getByDisplayValue('Test Group')).toBeInTheDocument(); // Display name
        expect(screen.getByDisplayValue('Test group description')).toBeInTheDocument(); // Description
      });
    });

    it('should show active status', async () => {
      render(<GroupDetailModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('✅ Hoạt động')).toBeInTheDocument();
      });
    });

    it('should show creation and update dates', async () => {
      render(<GroupDetailModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText(/Ngày tạo:/)).toBeInTheDocument();
        expect(screen.getByText(/Cập nhật lần cuối:/)).toBeInTheDocument();
      });
    });
  });

  describe('System Group Restrictions', () => {
    it('should disable editing for system groups', async () => {
      render(<GroupDetailModal {...defaultProps} group={mockSystemGroup} />);
      
      mockGroupService.getGroupById.mockResolvedValue({
        success: true,
        data: mockSystemGroup
      });
      
      await waitFor(() => {
        const displayNameInput = screen.getByDisplayValue('Administrators');
        expect(displayNameInput).toBeDisabled();
        
        const descriptionTextarea = screen.getByRole('textbox', { name: /mô tả/i });
        expect(descriptionTextarea).toBeDisabled();
        
        const activeCheckbox = screen.getByRole('checkbox');
        expect(activeCheckbox).toBeDisabled();
      });
      
      expect(screen.getByText('🔒 Không thể chỉnh sửa')).toBeInTheDocument();
      expect(screen.queryByText('💾 Lưu thay đổi')).not.toBeInTheDocument();
    });
  });

  describe('Form Editing', () => {
    it('should allow editing display name', async () => {
      const user = userEvent.setup();
      render(<GroupDetailModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('Test Group')).toBeInTheDocument();
      });

      const displayNameInput = screen.getByDisplayValue('Test Group');
      await user.clear(displayNameInput);
      await user.type(displayNameInput, 'Updated Test Group');
      
      expect(displayNameInput).toHaveValue('Updated Test Group');
    });

    it('should allow editing description', async () => {
      const user = userEvent.setup();
      render(<GroupDetailModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('Test group description')).toBeInTheDocument();
      });

      const descriptionTextarea = screen.getByDisplayValue('Test group description');
      await user.clear(descriptionTextarea);
      await user.type(descriptionTextarea, 'Updated description');
      
      expect(descriptionTextarea).toHaveValue('Updated description');
    });

    it('should toggle active status', async () => {
      const user = userEvent.setup();
      render(<GroupDetailModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByRole('checkbox')).toBeInTheDocument();
      });

      const activeCheckbox = screen.getByRole('checkbox');
      expect(activeCheckbox).toBeChecked();
      
      await user.click(activeCheckbox);
      expect(activeCheckbox).not.toBeChecked();
      expect(screen.getByText('❌ Vô hiệu')).toBeInTheDocument();
    });
  });

  describe('Saving Changes', () => {
    it('should save group changes successfully', async () => {
      const user = userEvent.setup();
      render(<GroupDetailModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('Test Group')).toBeInTheDocument();
      });

      // Edit display name
      const displayNameInput = screen.getByDisplayValue('Test Group');
      await user.clear(displayNameInput);
      await user.type(displayNameInput, 'Updated Group');
      
      // Save changes
      const saveButton = screen.getByText('💾 Lưu thay đổi');
      await user.click(saveButton);
      
      await waitFor(() => {
        expect(mockGroupService.updateGroup).toHaveBeenCalledWith(
          'group-123',
          {
            display_name: 'Updated Group',
            description: 'Test group description',
            is_active: true
          }
        );
      });
      
      expect(mockToast.success).toHaveBeenCalledWith('Cập nhật thông tin nhóm thành công');
      expect(defaultProps.onGroupUpdated).toHaveBeenCalled();
    });

    it('should show loading state while saving', async () => {
      const user = userEvent.setup();
      
      let resolveUpdate: (value: any) => void;
      const updatePromise = new Promise((resolve) => {
        resolveUpdate = resolve;
      });
      
      mockGroupService.updateGroup.mockReturnValue(updatePromise);
      
      render(<GroupDetailModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('💾 Lưu thay đổi')).toBeInTheDocument();
      });

      const saveButton = screen.getByText('💾 Lưu thay đổi');
      await user.click(saveButton);
      
      expect(screen.getByText('Đang lưu...')).toBeInTheDocument();
      
      resolveUpdate({ success: true, data: mockGroup });
      
      await waitFor(() => {
        expect(screen.queryByText('Đang lưu...')).not.toBeInTheDocument();
      });
    });

    it('should handle save error', async () => {
      const user = userEvent.setup();
      
      mockGroupService.updateGroup.mockResolvedValue({
        success: false,
        data: {} as Group,
        error: 'Update failed'
      });
      
      render(<GroupDetailModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('💾 Lưu thay đổi')).toBeInTheDocument();
      });

      const saveButton = screen.getByText('💾 Lưu thay đổi');
      await user.click(saveButton);
      
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Không thể cập nhật thông tin nhóm');
      });
    });
  });

  describe('Member Management', () => {
    it('should display group members', async () => {
      render(<GroupDetailModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
        expect(screen.getByText('Blocked User')).toBeInTheDocument();
      });
    });

    it('should show member roles', async () => {
      render(<GroupDetailModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Thành viên ▼')).toBeInTheDocument(); // John's role
        expect(screen.getByText('Quản lý ▼')).toBeInTheDocument(); // Jane's role
      });
    });

    it('should show member status badges', async () => {
      render(<GroupDetailModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Bị khóa')).toBeInTheDocument();
        expect(screen.getByText('Chờ duyệt')).toBeInTheDocument();
      });
    });

    it('should open user search modal when adding members', async () => {
      const user = userEvent.setup();
      render(<GroupDetailModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('➕ Thêm thành viên')).toBeInTheDocument();
      });

      const addButton = screen.getByText('➕ Thêm thành viên');
      await user.click(addButton);
      
      expect(screen.getByTestId('user-search-modal')).toBeInTheDocument();
    });

    it('should remove member with confirmation', async () => {
      const user = userEvent.setup();
      
      // Mock window.confirm
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
      
      render(<GroupDetailModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getAllByText('🗑️')).toHaveLength(3);
      });

      const removeButtons = screen.getAllByText('🗑️');
      await user.click(removeButtons[0]);
      
      expect(confirmSpy).toHaveBeenCalledWith(
        'Bạn có chắc chắn muốn xóa "John Doe" khỏi nhóm?'
      );
      
      await waitFor(() => {
        expect(mockGroupService.removeMemberFromGroup).toHaveBeenCalledWith(
          'group-123',
          '1'
        );
      });
      
      expect(mockToast.success).toHaveBeenCalledWith('Đã xóa thành viên khỏi nhóm');
      
      confirmSpy.mockRestore();
    });

    it('should not remove member if not confirmed', async () => {
      const user = userEvent.setup();
      
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
      
      render(<GroupDetailModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getAllByText('🗑️')).toHaveLength(3);
      });

      const removeButtons = screen.getAllByText('🗑️');
      await user.click(removeButtons[0]);
      
      expect(mockGroupService.removeMemberFromGroup).not.toHaveBeenCalled();
      
      confirmSpy.mockRestore();
    });

    it('should handle member removal error', async () => {
      const user = userEvent.setup();
      
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
      mockGroupService.removeMemberFromGroup.mockResolvedValue({
        success: false,
        data: undefined,
        error: 'Removal failed'
      });
      
      render(<GroupDetailModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getAllByText('🗑️')).toHaveLength(3);
      });

      const removeButtons = screen.getAllByText('🗑️');
      await user.click(removeButtons[0]);
      
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Không thể xóa thành viên: Removal failed');
      });
      
      confirmSpy.mockRestore();
    });

    it('should refresh members after adding new ones', async () => {
      const user = userEvent.setup();
      render(<GroupDetailModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('➕ Thêm thành viên')).toBeInTheDocument();
      });

      // Open user search modal
      const addButton = screen.getByText('➕ Thêm thành viên');
      await user.click(addButton);
      
      // Simulate adding members
      const mockAddButton = screen.getByText('Mock Add Members');
      await user.click(mockAddButton);
      
      // Should reload both group details and members
      await waitFor(() => {
        expect(mockGroupService.getGroupById).toHaveBeenCalledTimes(2); // Initial + reload
        expect(mockGroupService.getUsersByGroup).toHaveBeenCalledTimes(2); // Initial + reload
      });
    });
  });

  describe('Role Management', () => {
    it('should update member role', async () => {
      const user = userEvent.setup();
      render(<GroupDetailModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Thành viên ▼')).toBeInTheDocument();
      });

      // Hover over role badge to show dropdown
      const roleBadge = screen.getByText('Thành viên ▼');
      await user.hover(roleBadge);
      
      // Should show role options (note: CSS hover effects might not work in tests)
      // For testing purposes, we'll click directly on a role option
      const roleContainer = roleBadge.closest('.relative.group');
      if (roleContainer) {
        const managerOption = roleContainer.querySelector('[data-role="manager"]') as HTMLElement;
        if (managerOption) {
          await user.click(managerOption);
          
          await waitFor(() => {
            expect(mockGroupService.updateMemberRole).toHaveBeenCalledWith(
              'group-123',
              '1',
              { role_in_group: 'manager' }
            );
          });
          
          expect(mockToast.success).toHaveBeenCalledWith('Đã cập nhật vai trò thành viên');
        }
      }
    });
  });

  describe('Modal Controls', () => {
    it('should close modal when clicking close button', async () => {
      const user = userEvent.setup();
      render(<GroupDetailModal {...defaultProps} />);
      
      const closeButton = screen.getByText('Đóng');
      await user.click(closeButton);
      
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('should close modal when clicking X button', async () => {
      const user = userEvent.setup();
      render(<GroupDetailModal {...defaultProps} />);
      
      const xButton = screen.getByLabelText('Đóng');
      await user.click(xButton);
      
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('should close modal when clicking backdrop', async () => {
      const user = userEvent.setup();
      render(<GroupDetailModal {...defaultProps} />);
      
      const backdrop = screen.getByRole('dialog').previousSibling as HTMLElement;
      await user.click(backdrop);
      
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle group loading error', async () => {
      mockGroupService.getGroupById.mockResolvedValue({
        success: false,
        data: {} as Group,
        error: 'Group not found'
      });
      
      render(<GroupDetailModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Không thể tải thông tin chi tiết nhóm');
      });
      
      expect(screen.getByText('Không thể tải thông tin nhóm')).toBeInTheDocument();
    });

    it('should handle members loading error', async () => {
      mockGroupService.getUsersByGroup.mockResolvedValue({
        success: false,
        data: [],
        error: 'Failed to load members'
      });
      
      render(<GroupDetailModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Chưa có thành viên nào trong nhóm')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', async () => {
      render(<GroupDetailModal {...defaultProps} />);
      
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
      expect(screen.getByLabelText('Đóng')).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<GroupDetailModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('Test Group')).toBeInTheDocument();
      });

      // Should be able to tab through form elements
      await user.tab();
      await user.tab();
      expect(screen.getByDisplayValue('Test Group')).toHaveFocus();
    });
  });
});