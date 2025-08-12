import { GroupService } from '../../services/GroupService';
import { query, transaction } from '../../config/database';
import { AuditService } from '../../services/AuditService';

// Mock dependencies
jest.mock('../../config/database');
jest.mock('../../services/AuditService');
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-1234')
}));

const mockQuery = query as jest.MockedFunction<typeof query>;
const mockTransaction = transaction as jest.MockedFunction<typeof transaction>;
const mockAuditService = AuditService as jest.MockedClass<typeof AuditService>;

describe('GroupService', () => {
  let groupService: GroupService;
  let mockAuditLogAction: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuditLogAction = jest.fn();
    mockAuditService.prototype.logAction = mockAuditLogAction;
    groupService = new GroupService();
  });

  describe('getAllGroups', () => {
    it('should fetch all groups successfully', async () => {
      const mockGroups = [
        {
          id: 'group-1',
          name: 'test_group',
          display_name: 'Test Group',
          group_type: 'custom',
          is_active: true,
          member_count: 5
        }
      ];

      mockQuery.mockResolvedValue({ rows: mockGroups });

      const result = await groupService.getAllGroups();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockGroups);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM user_groups_summary'),
        []
      );
    });

    it('should apply filters correctly', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await groupService.getAllGroups({
        group_type: 'department',
        is_active: true
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE group_type = $1 AND is_active = $2'),
        ['department', true]
      );
    });

    it('should handle database errors', async () => {
      const dbError = new Error('Database connection failed');
      mockQuery.mockRejectedValue(dbError);

      const result = await groupService.getAllGroups();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database connection failed');
    });
  });

  describe('createGroup', () => {
    const mockGroupData = {
      name: 'new_group',
      display_name: 'New Group',
      description: 'Test description',
      group_type: 'custom'
    };

    it('should create group successfully', async () => {
      // Mock name uniqueness check
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const mockCreatedGroup = {
        id: 'mock-uuid-1234',
        ...mockGroupData,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      };

      mockTransaction.mockResolvedValue(mockCreatedGroup);

      const result = await groupService.createGroup(mockGroupData, 'user-123');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockCreatedGroup);
      expect(result.message).toBe('Group created successfully');

      // Verify name uniqueness check
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT id FROM user_groups WHERE name = $1',
        ['new_group']
      );
    });

    it('should reject duplicate group names', async () => {
      mockQuery.mockResolvedValue({ rows: [{ id: 'existing-group' }] });

      const result = await groupService.createGroup(mockGroupData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Group with this name already exists');
    });

    it('should handle transaction errors', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      mockTransaction.mockRejectedValue(new Error('Transaction failed'));

      const result = await groupService.createGroup(mockGroupData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Transaction failed');
    });
  });

  describe('getGroupById', () => {
    it('should fetch group by ID successfully', async () => {
      const mockGroup = {
        id: 'group-123',
        name: 'test_group',
        display_name: 'Test Group'
      };

      mockQuery.mockResolvedValue({ rows: [mockGroup] });

      const result = await groupService.getGroupById('group-123');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockGroup);
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM user_groups WHERE id = $1',
        ['group-123']
      );
    });

    it('should handle group not found', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await groupService.getGroupById('non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Group not found');
    });
  });

  describe('updateGroup', () => {
    const groupId = 'group-123';
    const updates = {
      display_name: 'Updated Group',
      description: 'Updated description',
      is_active: false
    };

    it('should update group successfully', async () => {
      const mockUpdatedGroup = {
        id: groupId,
        ...updates,
        updated_at: new Date()
      };

      mockTransaction.mockResolvedValue(mockUpdatedGroup);

      const result = await groupService.updateGroup(groupId, updates, 'user-123');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockUpdatedGroup);
      expect(result.message).toBe('Group updated successfully');
      expect(mockAuditLogAction).toHaveBeenCalledWith({
        user_id: 'user-123',
        action: 'UPDATE_GROUP',
        entity_type: 'group',
        entity_id: groupId,
        new_values: updates
      });
    });

    it('should handle group not found during update', async () => {
      mockTransaction.mockRejectedValue(new Error('Group not found'));

      const result = await groupService.updateGroup(groupId, updates);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Group not found');
    });
  });

  describe('deleteGroup', () => {
    const groupId = 'group-123';

    it('should delete group successfully', async () => {
      mockTransaction.mockImplementation(async (callback) => {
        const mockClient = {
          query: jest.fn()
            .mockResolvedValueOnce({ rows: [{ name: 'Test Group' }] }) // Group info
            .mockResolvedValueOnce({ rowCount: 2 }) // Delete members
            .mockResolvedValueOnce({ rowCount: 1 }) // Delete group
        };
        return callback(mockClient);
      });

      const result = await groupService.deleteGroup(groupId, 'user-123');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Group deleted successfully');
      expect(mockAuditLogAction).toHaveBeenCalledWith({
        user_id: 'user-123',
        action: 'DELETE_GROUP',
        entity_type: 'group',
        entity_id: groupId,
        old_values: { name: 'Test Group' }
      });
    });
  });

  describe('addUserToGroup', () => {
    const addData = {
      user_id: 'user-456',
      group_id: 'group-123',
      role_in_group: 'member'
    };

    it('should add user to group successfully', async () => {
      // Mock group and user existence checks
      mockQuery
        .mockResolvedValueOnce({ rows: [{ name: 'Test Group' }] }) // Group check
        .mockResolvedValueOnce({ rows: [{ email: 'user@test.com' }] }); // User check

      const mockMember = {
        user_id: 'user-456',
        group_id: 'group-123',
        role_in_group: 'member',
        joined_at: new Date()
      };

      mockTransaction.mockImplementation(async (callback) => {
        const mockClient = {
          query: jest.fn()
            .mockResolvedValueOnce({ rows: [] }) // Check existing membership
            .mockResolvedValueOnce({ rows: [mockMember] }) // Insert new member
        };
        return callback(mockClient);
      });

      const result = await groupService.addUserToGroup(addData, 'admin-123');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockMember);
      expect(result.message).toBe('User added to group successfully');
    });

    it('should handle group not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }); // Group not found

      const result = await groupService.addUserToGroup(addData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Group not found or inactive');
    });

    it('should handle user not found', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ name: 'Test Group' }] }) // Group exists
        .mockResolvedValueOnce({ rows: [] }); // User not found

      const result = await groupService.addUserToGroup(addData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('User not found');
    });

    it('should update role if user already exists in group', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ name: 'Test Group' }] })
        .mockResolvedValueOnce({ rows: [{ email: 'user@test.com' }] });

      const existingMember = {
        user_id: 'user-456',
        group_id: 'group-123',
        role_in_group: 'member'
      };

      mockTransaction.mockImplementation(async (callback) => {
        const mockClient = {
          query: jest.fn()
            .mockResolvedValueOnce({ rows: [existingMember] }) // Existing membership
            .mockResolvedValueOnce({ rowCount: 1 }) // Update role
        };
        return callback(mockClient);
      });

      const updateData = { ...addData, role_in_group: 'manager' };
      const result = await groupService.addUserToGroup(updateData);

      expect(result.success).toBe(true);
    });
  });

  describe('removeUserFromGroup', () => {
    it('should remove user from group successfully', async () => {
      mockTransaction.mockImplementation(async (callback) => {
        const mockClient = {
          query: jest.fn()
            .mockResolvedValueOnce({ rows: [{ name: 'Test Group' }] }) // Group info
            .mockResolvedValueOnce({ rowCount: 1 }) // Delete membership
        };
        return callback(mockClient);
      });

      const result = await groupService.removeUserFromGroup('user-456', 'group-123', 'admin-123');

      expect(result.success).toBe(true);
      expect(result.message).toBe('User removed from group successfully');
    });

    it('should handle user not in group', async () => {
      mockTransaction.mockImplementation(async (callback) => {
        const mockClient = {
          query: jest.fn()
            .mockResolvedValueOnce({ rows: [{ name: 'Test Group' }] })
            .mockResolvedValueOnce({ rowCount: 0 }) // No rows deleted
        };
        return callback(mockClient);
      });

      mockTransaction.mockRejectedValue(new Error('User is not a member of this group'));

      const result = await groupService.removeUserFromGroup('user-456', 'group-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('User is not a member of this group');
    });
  });

  describe('getGroupMembers', () => {
    const groupId = 'group-123';
    const pagination = { page: 1, limit: 10 };

    it('should fetch group members with pagination', async () => {
      const mockMembers = [
        {
          id: 123,
          email: 'user1@test.com',
          full_name: 'User One',
          role_in_group: 'member',
          joined_at: new Date()
        },
        {
          id: 456,
          email: 'user2@test.com',
          full_name: 'User Two',
          role_in_group: 'manager',
          joined_at: new Date()
        }
      ];

      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '25' }] }) // Total count
        .mockResolvedValueOnce({ rows: mockMembers }); // Members

      const result = await groupService.getGroupMembers(groupId, pagination);

      expect(result.success).toBe(true);
      expect(result.data.items).toEqual(mockMembers);
      expect(result.data.total).toBe(25);
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(10);
      expect(result.data.total_pages).toBe(3);
    });
  });

  describe('searchUsersForAssignment', () => {
    const groupId = 'group-123';

    it('should search available users successfully', async () => {
      const mockUsers = [
        {
          id: 789,
          email: 'available@test.com',
          full_name: 'Available User',
          department: 'Engineering'
        }
      ];

      mockQuery.mockResolvedValue({ rows: mockUsers });

      const result = await groupService.searchUsersForAssignment(
        groupId,
        'available',
        'Engineering',
        20
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockUsers);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('NOT IN'),
        expect.arrayContaining([groupId, '%available%', 'Engineering', 20])
      );
    });

    it('should handle search without filters', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await groupService.searchUsersForAssignment(groupId);

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('should handle search errors gracefully', async () => {
      mockQuery.mockRejectedValue(new Error('Search failed'));

      const result = await groupService.searchUsersForAssignment(groupId);

      expect(result.success).toBe(false);
      expect(result.data).toEqual([]);
      expect(result.error).toBe('Search failed');
    });
  });

  describe('updateUserRoleInGroup', () => {
    it('should update user role successfully', async () => {
      const mockUpdatedMember = {
        user_id: 'user-456',
        group_id: 'group-123',
        role_in_group: 'manager'
      };

      mockTransaction.mockResolvedValue(mockUpdatedMember);

      const result = await groupService.updateUserRoleInGroup(
        'user-456',
        'group-123',
        'manager',
        'admin-123'
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockUpdatedMember);
      expect(result.message).toBe('User role in group updated successfully');
    });
  });

  describe('getGroupHierarchy', () => {
    it('should fetch group hierarchy successfully', async () => {
      const mockHierarchy = [
        {
          id: 'parent-1',
          name: 'parent_group',
          level: 0,
          parent_group_id: null
        },
        {
          id: 'child-1',
          name: 'child_group',
          level: 1,
          parent_group_id: 'parent-1'
        }
      ];

      mockQuery.mockResolvedValue({ rows: mockHierarchy });

      const result = await groupService.getGroupHierarchy();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(expect.any(Array));
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WITH RECURSIVE group_tree'),
        []
      );
    });

    it('should fetch hierarchy for specific group', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await groupService.getGroupHierarchy('group-123');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = $1'),
        ['group-123']
      );
    });
  });
});