import request from 'supertest';
import express from 'express';
import { Pool } from 'pg';
import { groupRoutes } from '../../routes/groupRoutes';

// Mock dependencies
jest.mock('../../services/GroupService');
jest.mock('../../../middleware/auth', () => ({
  authMiddleware: (req: any, res: any, next: any) => {
    req.user = { id: 'test-user-123' };
    next();
  },
  requirePermissions: () => (req: any, res: any, next: any) => next()
}));

const app = express();
app.use(express.json());
app.use('/api/groups', groupRoutes);

// Mock database connection
const mockPool = {
  query: jest.fn(),
  connect: jest.fn(),
  end: jest.fn()
};

// Mock Group Service
const mockGroupService = {
  getAllGroups: jest.fn(),
  getGroupById: jest.fn(),
  createGroup: jest.fn(),
  updateGroup: jest.fn(),
  deleteGroup: jest.fn(),
  getGroupMembers: jest.fn(),
  addUserToGroup: jest.fn(),
  removeUserFromGroup: jest.fn(),
  updateUserRoleInGroup: jest.fn(),
  searchUsersForAssignment: jest.fn()
};

// Mock data
const mockGroup = {
  id: 'group-123',
  name: 'test_group',
  display_name: 'Test Group',
  description: 'Test description',
  group_type: 'custom',
  is_active: true,
  is_system: false,
  member_count: 2,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z'
};

const mockMembers = [
  {
    id: 1,
    email: 'john@example.com',
    full_name: 'John Doe',
    department: 'Engineering',
    role_in_group: 'member',
    joined_at: '2024-01-01T00:00:00Z'
  },
  {
    id: 2,
    email: 'jane@example.com',
    full_name: 'Jane Smith',
    department: 'Marketing',
    role_in_group: 'manager',
    joined_at: '2024-01-02T00:00:00Z'
  }
];

describe('Group Routes Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default successful responses
    mockGroupService.getAllGroups.mockResolvedValue({
      success: true,
      data: [mockGroup]
    });
    
    mockGroupService.getGroupById.mockResolvedValue({
      success: true,
      data: mockGroup
    });
    
    mockGroupService.createGroup.mockResolvedValue({
      success: true,
      data: { ...mockGroup, id: 'new-group-123' }
    });
    
    mockGroupService.updateGroup.mockResolvedValue({
      success: true,
      data: { ...mockGroup, display_name: 'Updated Group' }
    });
    
    mockGroupService.deleteGroup.mockResolvedValue({
      success: true,
      message: 'Group deleted successfully'
    });
    
    mockGroupService.getGroupMembers.mockResolvedValue({
      success: true,
      data: {
        items: mockMembers,
        pagination: {
          total: 2,
          page: 1,
          limit: 10,
          totalPages: 1
        }
      }
    });
    
    mockGroupService.addUserToGroup.mockResolvedValue({
      success: true,
      message: 'User added to group'
    });
    
    mockGroupService.removeUserFromGroup.mockResolvedValue({
      success: true,
      message: 'User removed from group'
    });
    
    mockGroupService.updateUserRoleInGroup.mockResolvedValue({
      success: true,
      data: { ...mockMembers[0], role_in_group: 'manager' }
    });
    
    mockGroupService.searchUsersForAssignment.mockResolvedValue({
      success: true,
      data: [
        {
          id: 3,
          email: 'bob@example.com',
          full_name: 'Bob Wilson',
          department: 'Engineering'
        }
      ]
    });
  });

  describe('Group CRUD Operations', () => {
    it('should handle complete group lifecycle', async () => {
      // 1. Create a new group
      const createResponse = await request(app)
        .post('/api/groups')
        .send({
          name: 'new_test_group',
          display_name: 'New Test Group',
          description: 'New test description',
          group_type: 'custom'
        });

      expect(createResponse.status).toBe(201);
      expect(createResponse.body.success).toBe(true);

      // 2. Get all groups
      const getAllResponse = await request(app)
        .get('/api/groups');

      expect(getAllResponse.status).toBe(200);
      expect(getAllResponse.body.success).toBe(true);
      expect(Array.isArray(getAllResponse.body.data)).toBe(true);

      // 3. Get specific group
      const getByIdResponse = await request(app)
        .get('/api/groups/group-123');

      expect(getByIdResponse.status).toBe(200);
      expect(getByIdResponse.body.success).toBe(true);
      expect(getByIdResponse.body.data.id).toBe('group-123');

      // 4. Update group
      const updateResponse = await request(app)
        .put('/api/groups/group-123')
        .send({
          display_name: 'Updated Test Group',
          description: 'Updated description'
        });

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.success).toBe(true);

      // 5. Delete group
      const deleteResponse = await request(app)
        .delete('/api/groups/group-123');

      expect(deleteResponse.status).toBe(200);
      expect(deleteResponse.body.success).toBe(true);
    });

    it('should validate input data properly', async () => {
      // Test validation errors
      const invalidCreateResponse = await request(app)
        .post('/api/groups')
        .send({
          name: 'a', // Too short
          display_name: '', // Empty
          group_type: 'invalid' // Invalid type
        });

      expect(invalidCreateResponse.status).toBe(400);
      expect(invalidCreateResponse.body.success).toBe(false);
      expect(invalidCreateResponse.body.error).toBe('Validation failed');
      expect(Array.isArray(invalidCreateResponse.body.details)).toBe(true);
    });
  });

  describe('Member Management Operations', () => {
    it('should handle complete member lifecycle', async () => {
      // 1. Get group members
      const getMembersResponse = await request(app)
        .get('/api/groups/group-123/members');

      expect(getMembersResponse.status).toBe(200);
      expect(getMembersResponse.body.success).toBe(true);
      expect(getMembersResponse.body.data.items).toHaveLength(2);

      // 2. Search available users
      const searchResponse = await request(app)
        .get('/api/groups/group-123/available-users')
        .query({ search: 'bob', department: 'Engineering' });

      expect(searchResponse.status).toBe(200);
      expect(searchResponse.body.success).toBe(true);

      // 3. Add members to group (bulk)
      const addMembersResponse = await request(app)
        .post('/api/groups/group-123/members')
        .send({
          user_ids: ['3', '4'],
          role_in_group: 'member'
        });

      expect(addMembersResponse.status).toBe(200);
      expect(addMembersResponse.body.success).toBe(true);
      expect(addMembersResponse.body.data.summary.total).toBe(2);

      // 4. Update member role
      const updateRoleResponse = await request(app)
        .put('/api/groups/group-123/members/1')
        .send({
          role_in_group: 'manager'
        });

      expect(updateRoleResponse.status).toBe(200);
      expect(updateRoleResponse.body.success).toBe(true);

      // 5. Remove member
      const removeMemberResponse = await request(app)
        .delete('/api/groups/group-123/members/2');

      expect(removeMemberResponse.status).toBe(200);
      expect(removeMemberResponse.body.success).toBe(true);
    });

    it('should handle bulk member addition with mixed results', async () => {
      // Mock mixed success/failure response
      const mockBulkResponse = {
        success: true,
        message: 'Processed 3 user assignments',
        data: {
          successful: [
            { user_id: '3', success: true, message: 'Added successfully' },
            { user_id: '4', success: true, message: 'Added successfully' }
          ],
          failed: [
            { user_id: '5', success: false, error: 'User already in group' }
          ],
          summary: {
            total: 3,
            successful_count: 2,
            failed_count: 1
          }
        }
      };

      // Mock the service to return mixed results
      mockGroupService.addUserToGroup
        .mockResolvedValueOnce({ success: true, message: 'Added successfully' })
        .mockResolvedValueOnce({ success: true, message: 'Added successfully' })
        .mockResolvedValueOnce({ success: false, error: 'User already in group' });

      const response = await request(app)
        .post('/api/groups/group-123/members')
        .send({
          user_ids: ['3', '4', '5'],
          role_in_group: 'member'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.successful).toHaveLength(2);
      expect(response.body.data.failed).toHaveLength(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors properly', async () => {
      mockGroupService.getGroupById.mockResolvedValue({
        success: false,
        error: 'Group not found'
      });

      const response = await request(app)
        .get('/api/groups/nonexistent-123');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should handle validation errors', async () => {
      const response = await request(app)
        .post('/api/groups/invalid-uuid/members')
        .send({
          user_ids: ['1'],
          role_in_group: 'member'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should handle internal server errors', async () => {
      mockGroupService.getAllGroups.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/groups');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Internal server error');
    });
  });

  describe('Query Parameters and Filtering', () => {
    it('should handle group filtering', async () => {
      const response = await request(app)
        .get('/api/groups')
        .query({
          group_type: 'custom',
          is_active: 'true',
          search: 'test'
        });

      expect(response.status).toBe(200);
      expect(mockGroupService.getAllGroups).toHaveBeenCalledWith({
        group_type: 'custom',
        is_active: true,
        search: 'test'
      });
    });

    it('should handle member pagination', async () => {
      const response = await request(app)
        .get('/api/groups/group-123/members')
        .query({
          page: '2',
          limit: '5'
        });

      expect(response.status).toBe(200);
      expect(mockGroupService.getGroupMembers).toHaveBeenCalledWith(
        'group-123',
        { page: 2, limit: 5 }
      );
    });

    it('should handle user search parameters', async () => {
      const response = await request(app)
        .get('/api/groups/group-123/available-users')
        .query({
          search: 'john',
          department: 'Engineering',
          limit: '10'
        });

      expect(response.status).toBe(200);
      expect(mockGroupService.searchUsersForAssignment).toHaveBeenCalledWith(
        'group-123',
        'john',
        'Engineering',
        10
      );
    });
  });

  describe('Security and Permissions', () => {
    it('should include user context in requests', async () => {
      await request(app)
        .post('/api/groups')
        .send({
          name: 'security_test',
          display_name: 'Security Test Group'
        });

      expect(mockGroupService.createGroup).toHaveBeenCalledWith(
        expect.any(Object),
        'test-user-123'
      );
    });

    it('should prevent system group modification', async () => {
      const systemGroup = {
        ...mockGroup,
        is_system: true,
        group_type: 'system'
      };

      // Test creating system group (should be blocked by validation)
      const response = await request(app)
        .post('/api/groups')
        .send({
          name: 'administrators',
          display_name: 'Administrators',
          group_type: 'system' // This should be rejected
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('API Response Consistency', () => {
    it('should return consistent response format', async () => {
      const response = await request(app)
        .get('/api/groups/group-123');

      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('data');
      expect(response.body.success).toBe(true);
    });

    it('should return consistent error format', async () => {
      mockGroupService.getGroupById.mockResolvedValue({
        success: false,
        error: 'Not found'
      });

      const response = await request(app)
        .get('/api/groups/group-123');

      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('error');
      expect(response.body.success).toBe(false);
    });
  });
});