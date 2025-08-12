import request from 'supertest';
import express from 'express';
import { groupRoutes } from '../../routes/groupRoutes';
import { GroupService } from '../../services/GroupService';
import { authMiddleware, requirePermissions } from '../../middleware/auth';

// Mock dependencies
jest.mock('../../services/GroupService');
jest.mock('../../middleware/auth');

const MockGroupService = GroupService as jest.MockedClass<typeof GroupService>;
const mockAuthMiddleware = authMiddleware as jest.MockedFunction<typeof authMiddleware>;
const mockRequirePermissions = requirePermissions as jest.MockedFunction<typeof requirePermissions>;

// Create test app
const app = express();
app.use(express.json());
app.use('/api/groups', groupRoutes);

describe('Group Routes', () => {
  let mockGroupService: jest.Mocked<GroupService>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock auth middleware to pass through
    mockAuthMiddleware.mockImplementation((req, res, next) => {
      (req as any).user = { id: 'test-user-123' };
      next();
    });
    
    // Mock permissions to pass through
    mockRequirePermissions.mockImplementation(() => (req, res, next) => next());
    
    // Mock GroupService instance
    mockGroupService = {
      getAllGroups: jest.fn(),
      getGroupById: jest.fn(),
      createGroup: jest.fn(),
      updateGroup: jest.fn(),
      deleteGroup: jest.fn(),
      getGroupMembers: jest.fn(),
      addUserToGroup: jest.fn(),
      removeUserFromGroup: jest.fn(),
      updateUserRoleInGroup: jest.fn(),
      searchUsersForAssignment: jest.fn(),
      getUserGroups: jest.fn(),
      getGroupHierarchy: jest.fn()
    } as any;
    
    MockGroupService.mockImplementation(() => mockGroupService);
  });

  describe('GET /', () => {
    it('should fetch all groups successfully', async () => {
      const mockGroups = [
        {
          id: 'group-1',
          name: 'test_group',
          display_name: 'Test Group',
          member_count: 5
        }
      ];

      mockGroupService.getAllGroups.mockResolvedValue({
        success: true,
        data: mockGroups
      });

      const response = await request(app)
        .get('/api/groups')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockGroups);
      expect(mockGroupService.getAllGroups).toHaveBeenCalledWith({
        group_type: undefined,
        is_active: undefined,
        search: undefined
      });
    });

    it('should apply filters correctly', async () => {
      mockGroupService.getAllGroups.mockResolvedValue({
        success: true,
        data: []
      });

      await request(app)
        .get('/api/groups?group_type=department&is_active=true&search=marketing')
        .expect(200);

      expect(mockGroupService.getAllGroups).toHaveBeenCalledWith({
        group_type: 'department',
        is_active: true,
        search: 'marketing'
      });
    });

    it('should handle service errors', async () => {
      mockGroupService.getAllGroups.mockResolvedValue({
        success: false,
        error: 'Database error'
      });

      const response = await request(app)
        .get('/api/groups')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Database error');
    });

    it('should validate query parameters', async () => {
      const response = await request(app)
        .get('/api/groups?group_type=invalid&is_active=not_boolean')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Invalid group type' }),
          expect.objectContaining({ msg: 'is_active must be a boolean' })
        ])
      );
    });
  });

  describe('GET /:id', () => {
    it('should fetch group by ID successfully', async () => {
      const mockGroup = {
        id: 'group-123',
        name: 'test_group',
        display_name: 'Test Group'
      };

      mockGroupService.getGroupById.mockResolvedValue({
        success: true,
        data: mockGroup
      });

      const response = await request(app)
        .get('/api/groups/123e4567-e89b-12d3-a456-426614174000')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockGroup);
    });

    it('should handle group not found', async () => {
      mockGroupService.getGroupById.mockResolvedValue({
        success: false,
        error: 'Group not found'
      });

      const response = await request(app)
        .get('/api/groups/123e4567-e89b-12d3-a456-426614174000')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Group not found');
    });

    it('should validate UUID parameter', async () => {
      const response = await request(app)
        .get('/api/groups/invalid-uuid')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Group ID must be a valid UUID' })
        ])
      );
    });
  });

  describe('POST /', () => {
    const validGroupData = {
      name: 'new_group',
      display_name: 'New Group',
      description: 'Test description',
      group_type: 'custom'
    };

    it('should create group successfully', async () => {
      const mockCreatedGroup = {
        id: 'new-group-123',
        ...validGroupData,
        is_active: true,
        created_at: new Date()
      };

      mockGroupService.createGroup.mockResolvedValue({
        success: true,
        data: mockCreatedGroup,
        message: 'Group created successfully'
      });

      const response = await request(app)
        .post('/api/groups')
        .send(validGroupData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockCreatedGroup);
      expect(mockGroupService.createGroup).toHaveBeenCalledWith(
        expect.objectContaining(validGroupData),
        'test-user-123'
      );
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/groups')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: expect.stringContaining('Group name') }),
          expect.objectContaining({ msg: expect.stringContaining('Display name') })
        ])
      );
    });

    it('should validate field lengths', async () => {
      const response = await request(app)
        .post('/api/groups')
        .send({
          name: 'a', // Too short
          display_name: 'b', // Too short
          description: 'x'.repeat(1001) // Too long
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.details.length).toBeGreaterThan(0);
    });

    it('should reject system group type', async () => {
      const response = await request(app)
        .post('/api/groups')
        .send({
          ...validGroupData,
          group_type: 'system'
        })
        .expect(400);

      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ 
            msg: 'Invalid group type (system groups cannot be created via API)' 
          })
        ])
      );
    });

    it('should handle service errors', async () => {
      mockGroupService.createGroup.mockResolvedValue({
        success: false,
        error: 'Group name already exists'
      });

      const response = await request(app)
        .post('/api/groups')
        .send(validGroupData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Group name already exists');
    });
  });

  describe('PUT /:id', () => {
    const groupId = '123e4567-e89b-12d3-a456-426614174000';
    const updateData = {
      display_name: 'Updated Group',
      description: 'Updated description',
      is_active: false
    };

    it('should update group successfully', async () => {
      const mockUpdatedGroup = {
        id: groupId,
        ...updateData,
        updated_at: new Date()
      };

      mockGroupService.updateGroup.mockResolvedValue({
        success: true,
        data: mockUpdatedGroup,
        message: 'Group updated successfully'
      });

      const response = await request(app)
        .put(`/api/groups/${groupId}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockUpdatedGroup);
    });

    it('should validate optional fields', async () => {
      const response = await request(app)
        .put(`/api/groups/${groupId}`)
        .send({
          display_name: 'a', // Too short
          is_active: 'not_boolean'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.details.length).toBeGreaterThan(0);
    });
  });

  describe('DELETE /:id', () => {
    const groupId = '123e4567-e89b-12d3-a456-426614174000';

    it('should delete group successfully', async () => {
      mockGroupService.deleteGroup.mockResolvedValue({
        success: true,
        message: 'Group deleted successfully'
      });

      const response = await request(app)
        .delete(`/api/groups/${groupId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Group deleted successfully');
    });

    it('should handle group not found', async () => {
      mockGroupService.deleteGroup.mockResolvedValue({
        success: false,
        error: 'Group not found'
      });

      const response = await request(app)
        .delete(`/api/groups/${groupId}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /:id/members', () => {
    const groupId = '123e4567-e89b-12d3-a456-426614174000';

    it('should fetch group members successfully', async () => {
      const mockMembersResponse = {
        items: [
          {
            id: 123,
            email: 'user@test.com',
            full_name: 'Test User',
            role_in_group: 'member'
          }
        ],
        total: 1,
        page: 1,
        limit: 10,
        total_pages: 1
      };

      mockGroupService.getGroupMembers.mockResolvedValue({
        success: true,
        data: mockMembersResponse
      });

      const response = await request(app)
        .get(`/api/groups/${groupId}/members?page=1&limit=10`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockMembersResponse);
      expect(mockGroupService.getGroupMembers).toHaveBeenCalledWith(
        groupId,
        { page: 1, limit: 10 }
      );
    });

    it('should validate pagination parameters', async () => {
      const response = await request(app)
        .get(`/api/groups/${groupId}/members?page=0&limit=101`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Page must be a positive integer' }),
          expect.objectContaining({ msg: 'Limit must be between 1 and 100' })
        ])
      );
    });
  });

  describe('POST /:id/members', () => {
    const groupId = '123e4567-e89b-12d3-a456-426614174000';

    it('should add members to group successfully', async () => {
      const memberData = {
        user_ids: ['user-1', 'user-2'],
        role_in_group: 'member'
      };

      mockGroupService.addUserToGroup
        .mockResolvedValueOnce({
          success: true,
          message: 'User added to group successfully'
        })
        .mockResolvedValueOnce({
          success: true,
          message: 'User added to group successfully'
        });

      const response = await request(app)
        .post(`/api/groups/${groupId}/members`)
        .send(memberData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.summary.successful_count).toBe(2);
      expect(response.body.data.summary.failed_count).toBe(0);
    });

    it('should handle mixed success and failure', async () => {
      const memberData = {
        user_ids: ['user-1', 'user-2'],
        role_in_group: 'member'
      };

      mockGroupService.addUserToGroup
        .mockResolvedValueOnce({
          success: true,
          message: 'User added to group successfully'
        })
        .mockResolvedValueOnce({
          success: false,
          error: 'User not found'
        });

      const response = await request(app)
        .post(`/api/groups/${groupId}/members`)
        .send(memberData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.summary.successful_count).toBe(1);
      expect(response.body.data.summary.failed_count).toBe(1);
    });

    it('should validate request body', async () => {
      const response = await request(app)
        .post(`/api/groups/${groupId}/members`)
        .send({
          user_ids: [], // Empty array
          role_in_group: 'invalid_role'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'user_ids must be a non-empty array' }),
          expect.objectContaining({ msg: 'Invalid role in group' })
        ])
      );
    });
  });

  describe('DELETE /:id/members/:userId', () => {
    const groupId = '123e4567-e89b-12d3-a456-426614174000';
    const userId = 'user-456';

    it('should remove member from group successfully', async () => {
      mockGroupService.removeUserFromGroup.mockResolvedValue({
        success: true,
        message: 'User removed from group successfully'
      });

      const response = await request(app)
        .delete(`/api/groups/${groupId}/members/${userId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockGroupService.removeUserFromGroup).toHaveBeenCalledWith(
        userId,
        groupId,
        'test-user-123'
      );
    });

    it('should handle user not in group', async () => {
      mockGroupService.removeUserFromGroup.mockResolvedValue({
        success: false,
        error: 'User is not a member of this group'
      });

      const response = await request(app)
        .delete(`/api/groups/${groupId}/members/${userId}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /:id/members/:userId', () => {
    const groupId = '123e4567-e89b-12d3-a456-426614174000';
    const userId = 'user-456';

    it('should update member role successfully', async () => {
      const roleUpdate = { role_in_group: 'manager' };

      const mockUpdatedMember = {
        user_id: userId,
        group_id: groupId,
        role_in_group: 'manager'
      };

      mockGroupService.updateUserRoleInGroup.mockResolvedValue({
        success: true,
        data: mockUpdatedMember,
        message: 'User role in group updated successfully'
      });

      const response = await request(app)
        .put(`/api/groups/${groupId}/members/${userId}`)
        .send(roleUpdate)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockUpdatedMember);
    });

    it('should validate role field', async () => {
      const response = await request(app)
        .put(`/api/groups/${groupId}/members/${userId}`)
        .send({ role_in_group: 'invalid_role' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Invalid role in group' })
        ])
      );
    });
  });

  describe('GET /:id/available-users', () => {
    const groupId = '123e4567-e89b-12d3-a456-426614174000';

    it('should search available users successfully', async () => {
      const mockUsers = [
        {
          id: 789,
          email: 'available@test.com',
          full_name: 'Available User',
          department: 'Engineering'
        }
      ];

      mockGroupService.searchUsersForAssignment.mockResolvedValue({
        success: true,
        data: mockUsers
      });

      const response = await request(app)
        .get(`/api/groups/${groupId}/available-users?search=available&department=Engineering&limit=20`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockUsers);
      expect(mockGroupService.searchUsersForAssignment).toHaveBeenCalledWith(
        groupId,
        'available',
        'Engineering',
        20
      );
    });

    it('should use default parameters', async () => {
      mockGroupService.searchUsersForAssignment.mockResolvedValue({
        success: true,
        data: []
      });

      await request(app)
        .get(`/api/groups/${groupId}/available-users`)
        .expect(200);

      expect(mockGroupService.searchUsersForAssignment).toHaveBeenCalledWith(
        groupId,
        undefined,
        undefined,
        20
      );
    });

    it('should validate limit parameter', async () => {
      const response = await request(app)
        .get(`/api/groups/${groupId}/available-users?limit=101`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Limit must be between 1 and 100' })
        ])
      );
    });
  });

  describe('Error handling', () => {
    it('should handle internal server errors', async () => {
      mockGroupService.getAllGroups.mockRejectedValue(new Error('Unexpected error'));

      const response = await request(app)
        .get('/api/groups')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Internal server error');
    });

    it('should handle validation errors consistently', async () => {
      const response = await request(app)
        .post('/api/groups')
        .send({ name: '' })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Validation failed',
        details: expect.any(Array)
      });
    });
  });
});