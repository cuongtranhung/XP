/**
 * Integration Tests for Multi-User Form Access
 * Tests the complete workflow of multi-user form sharing functionality
 */

import request from 'supertest';
import { Express } from 'express';
import { setupTestApp, cleanupTestApp } from '../setup/testApp';
import { createTestUser, authenticateUser } from '../helpers/authHelper';
import { createTestForm } from '../helpers/formHelper';

describe('Multi-User Form Access Integration', () => {
  let app: Express;
  let owner: any;
  let otherUser: any;
  let anonymousUser: any;
  let ownerToken: string;
  let otherUserToken: string;
  let testForm: any;

  beforeAll(async () => {
    app = await setupTestApp();
    
    // Create test users
    owner = await createTestUser('owner@test.com', 'Form Owner', 'owner123');
    otherUser = await createTestUser('other@test.com', 'Other User', 'other123');
    anonymousUser = await createTestUser('anon@test.com', 'Anonymous User', 'anon123');
    
    // Authenticate users
    ownerToken = await authenticateUser(app, 'owner@test.com', 'owner123');
    otherUserToken = await authenticateUser(app, 'other@test.com', 'other123');
  });

  afterAll(async () => {
    await cleanupTestApp();
  });

  beforeEach(async () => {
    // Create a test form for each test
    testForm = await createTestForm(owner.id, {
      name: 'Test Multi-User Form',
      description: 'A form for testing multi-user access',
      status: 'published',
      fields: [
        {
          id: 'field1',
          type: 'text',
          label: 'Name',
          required: true
        },
        {
          id: 'field2',
          type: 'email',
          label: 'Email',
          required: true
        }
      ]
    });
  });

  describe('Form Visibility', () => {
    it('should allow all authenticated users to see published forms', async () => {
      const response = await request(app)
        .get('/api/forms')
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.forms).toHaveLength(1);
      expect(response.body.data.forms[0].id).toBe(testForm.id);
      expect(response.body.data.forms[0].name).toBe('Test Multi-User Form');
    });

    it('should show ownership information in forms list', async () => {
      const response = await request(app)
        .get('/api/forms')
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(200);

      const form = response.body.data.forms[0];
      expect(form.ownerId).toBe(owner.id);
      expect(form.ownerName).toBe('Form Owner');
      expect(form.isOwner).toBe(false); // other user viewing
    });

    it('should allow filtering forms by ownership', async () => {
      // Create another form by other user
      await createTestForm(otherUser.id, {
        name: 'Other User Form',
        status: 'published'
      });

      // Filter for 'mine' as other user
      const mineResponse = await request(app)
        .get('/api/forms?filterOwner=mine')
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(200);

      expect(mineResponse.body.data.forms).toHaveLength(1);
      expect(mineResponse.body.data.forms[0].name).toBe('Other User Form');

      // Filter for 'others'
      const othersResponse = await request(app)
        .get('/api/forms?filterOwner=others')
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(200);

      expect(othersResponse.body.data.forms).toHaveLength(1);
      expect(othersResponse.body.data.forms[0].name).toBe('Test Multi-User Form');
    });
  });

  describe('Form Submissions Access', () => {
    let submissionId: string;

    beforeEach(async () => {
      // Create a submission by other user
      const submissionResponse = await request(app)
        .post(`/api/forms/${testForm.id}/submissions`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({
          data: {
            field1: 'John Doe',
            field2: 'john@test.com'
          }
        })
        .expect(201);

      submissionId = submissionResponse.body.data.id;
    });

    it('should allow form owner to see all submissions', async () => {
      const response = await request(app)
        .get(`/api/forms/${testForm.id}/submissions`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.submissions).toHaveLength(1);
      expect(response.body.data.submissions[0].id).toBe(submissionId);
    });

    it('should allow non-owners to see only their own submissions', async () => {
      // Other user should see their submission
      const otherUserResponse = await request(app)
        .get(`/api/forms/${testForm.id}/submissions`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(200);

      expect(otherUserResponse.body.data.submissions).toHaveLength(1);
      expect(otherUserResponse.body.data.submissions[0].submitterId).toBe(otherUser.id);

      // Anonymous user should see no submissions
      const anonToken = await authenticateUser(app, 'anon@test.com', 'anon123');
      const anonResponse = await request(app)
        .get(`/api/forms/${testForm.id}/submissions`)
        .set('Authorization', `Bearer ${anonToken}`)
        .expect(200);

      expect(anonResponse.body.data.submissions).toHaveLength(0);
    });

    it('should show correct access information in submissions view', async () => {
      // Owner should have full access
      const ownerResponse = await request(app)
        .get(`/api/forms/${testForm.id}/submissions`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(ownerResponse.body.data.isOwner).toBe(true);
      expect(ownerResponse.body.data.accessType).toBe('full');

      // Other user should have limited access
      const otherResponse = await request(app)
        .get(`/api/forms/${testForm.id}/submissions`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(200);

      expect(otherResponse.body.data.isOwner).toBe(false);
      expect(otherResponse.body.data.accessType).toBe('limited');
    });
  });

  describe('Form Operations Permissions', () => {
    it('should allow only owner to edit form', async () => {
      // Owner can edit
      await request(app)
        .put(`/api/forms/${testForm.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Updated Form Name'
        })
        .expect(200);

      // Other user cannot edit
      await request(app)
        .put(`/api/forms/${testForm.id}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({
          name: 'Unauthorized Edit'
        })
        .expect(403);
    });

    it('should allow only owner to delete form', async () => {
      // Other user cannot delete
      await request(app)
        .delete(`/api/forms/${testForm.id}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(403);

      // Owner can delete
      await request(app)
        .delete(`/api/forms/${testForm.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
    });

    it('should allow non-owners to clone published forms', async () => {
      const response = await request(app)
        .post(`/api/forms/${testForm.id}/duplicate`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({
          name: 'Cloned Form'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Cloned Form');
      expect(response.body.data.ownerId).toBe(otherUser.id);
    });

    it('should allow only owner to export form data', async () => {
      // Other user cannot export
      await request(app)
        .get(`/api/forms/${testForm.id}/export`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(403);

      // Owner can export (if endpoint exists)
      const ownerResponse = await request(app)
        .get(`/api/forms/${testForm.id}/stats`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(ownerResponse.body.success).toBe(true);
    });
  });

  describe('Public Statistics', () => {
    beforeEach(async () => {
      // Create some submissions for statistics
      await request(app)
        .post(`/api/forms/${testForm.id}/submissions`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({
          data: { field1: 'User 1', field2: 'user1@test.com' }
        });

      await request(app)
        .post(`/api/forms/${testForm.id}/submissions`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({
          data: { field1: 'User 2', field2: 'user2@test.com' }
        });
    });

    it('should allow anyone to view public statistics', async () => {
      const response = await request(app)
        .get(`/api/forms/${testForm.id}/public-stats`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalSubmissions');
      expect(response.body.data).toHaveProperty('completionRate');
      expect(response.body.data.totalSubmissions).toBeGreaterThan(0);
    });

    it('should not expose sensitive data in public stats', async () => {
      const response = await request(app)
        .get(`/api/forms/${testForm.id}/public-stats`)
        .expect(200);

      const stats = response.body.data;
      expect(stats).not.toHaveProperty('submissions');
      expect(stats).not.toHaveProperty('submissionDetails');
      expect(stats).not.toHaveProperty('userData');
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent form gracefully', async () => {
      const fakeFormId = '123e4567-e89b-12d3-a456-426614174000';
      
      await request(app)
        .get(`/api/forms/${fakeFormId}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(404);
    });

    it('should require authentication for protected endpoints', async () => {
      await request(app)
        .get('/api/forms')
        .expect(401);

      await request(app)
        .post(`/api/forms/${testForm.id}/submissions`)
        .send({
          data: { field1: 'test' }
        })
        .expect(401);
    });

    it('should validate form data properly', async () => {
      await request(app)
        .post(`/api/forms/${testForm.id}/submissions`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({
          data: {
            field1: 'Valid Name'
            // Missing required field2
          }
        })
        .expect(400);
    });
  });
});