/**
 * Integration tests for User Management Module
 * These tests run against the actual running server
 */

import axios from 'axios';

const API_BASE = 'http://localhost:5000/api/user-management';

describe('User Management Integration Tests', () => {
  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await axios.get(`${API_BASE}/health`);
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('status', 'healthy');
      expect(response.data).toHaveProperty('module', 'user-management');
      expect(response.data).toHaveProperty('timestamp');
    });
  });

  describe('Users API', () => {
    it('should list users', async () => {
      const response = await axios.get(`${API_BASE}/users`);
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('success', true);
      expect(response.data).toHaveProperty('data');
      expect(Array.isArray(response.data.data)).toBe(true);
      expect(response.data.data.length).toBeGreaterThan(0);
      
      // Check user structure
      const user = response.data.data[0];
      expect(user).toHaveProperty('id');
      expect(user).toHaveProperty('email');
      expect(user).toHaveProperty('username');
      expect(user).toHaveProperty('is_approved');
      expect(user).toHaveProperty('is_blocked');
      expect(user).toHaveProperty('status');
    });

    it('should get user by ID', async () => {
      // First get the list to find a valid user ID
      const listResponse = await axios.get(`${API_BASE}/users`);
      const userId = listResponse.data.data[0].id;
      
      const response = await axios.get(`${API_BASE}/users/${userId}`);
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('success', true);
      expect(response.data).toHaveProperty('data');
      expect(response.data.data).toHaveProperty('id', userId);
      expect(response.data.data).toHaveProperty('roles');
      expect(response.data.data).toHaveProperty('groups');
    });

    it('should return 404 for non-existent user', async () => {
      try {
        await axios.get(`${API_BASE}/users/99999`);
        fail('Should have thrown 404 error');
      } catch (error: any) {
        expect(error.response.status).toBe(404);
        expect(error.response.data).toHaveProperty('success', false);
        expect(error.response.data).toHaveProperty('message', 'User not found');
      }
    });

    it('should toggle user approval status', async () => {
      // Get a user that is not approved
      const listResponse = await axios.get(`${API_BASE}/users`);
      const user = listResponse.data.data.find((u: any) => !u.is_approved) || listResponse.data.data[0];
      const userId = user.id;
      const originalApprovalStatus = user.is_approved;
      
      const response = await axios.put(`${API_BASE}/users/${userId}/toggle-approval`);
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('success', true);
      expect(response.data).toHaveProperty('message');
      expect(response.data.data).toHaveProperty('is_approved', !originalApprovalStatus);
      
      // Toggle back to original state
      await axios.put(`${API_BASE}/users/${userId}/toggle-approval`);
    });

    it('should toggle user block status', async () => {
      // Get a user to test with
      const listResponse = await axios.get(`${API_BASE}/users`);
      const user = listResponse.data.data[0];
      const userId = user.id;
      const originalBlockStatus = user.is_blocked;
      
      const response = await axios.put(`${API_BASE}/users/${userId}/toggle-block`);
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('success', true);
      expect(response.data).toHaveProperty('message');
      expect(response.data.data).toHaveProperty('is_blocked', !originalBlockStatus);
      
      // The status should change based on block status
      if (!originalBlockStatus) {
        // User was unblocked, now blocked -> should be inactive
        expect(response.data.data).toHaveProperty('status', 'inactive');
      } else {
        // User was blocked, now unblocked -> should be active
        expect(response.data.data).toHaveProperty('status', 'active');
      }
      
      // Toggle back to original state
      await axios.put(`${API_BASE}/users/${userId}/toggle-block`);
    });
  });

  describe('Roles API', () => {
    it('should return roles endpoint placeholder', async () => {
      const response = await axios.get(`${API_BASE}/roles`);
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('success', true);
      expect(response.data).toHaveProperty('message', 'Role routes - To be implemented');
    });
  });

  describe('Groups API', () => {
    it('should return groups endpoint placeholder', async () => {
      const response = await axios.get(`${API_BASE}/groups`);
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('success', true);
      expect(response.data).toHaveProperty('message', 'Group routes - To be implemented');
    });
  });

  describe('Audit Logs API', () => {
    it('should return audit logs endpoint placeholder', async () => {
      const response = await axios.get(`${API_BASE}/audit-logs`);
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('success', true);
      expect(response.data).toHaveProperty('message', 'Audit routes - To be implemented');
    });
  });
});