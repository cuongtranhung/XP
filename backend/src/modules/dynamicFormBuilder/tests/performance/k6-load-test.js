/**
 * k6 Load Test for Dynamic Form Builder API
 * 
 * Run with: k6 run k6-load-test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { randomString, randomItem } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Test configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';

// Custom metrics
const errorRate = new Rate('errors');
const formCreationTime = new Trend('form_creation_time');
const submissionTime = new Trend('submission_time');
const formLoadTime = new Trend('form_load_time');
const exportTime = new Trend('export_time');

// Test options
export const options = {
  stages: [
    { duration: '1m', target: 10 },   // Ramp up to 10 users
    { duration: '3m', target: 50 },   // Ramp up to 50 users
    { duration: '5m', target: 100 },  // Ramp up to 100 users
    { duration: '3m', target: 100 },  // Stay at 100 users
    { duration: '2m', target: 0 },    // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'], // 95% of requests under 500ms
    errors: ['rate<0.05'], // Error rate under 5%
    form_creation_time: ['p(95)<1000'], // 95% of form creations under 1s
    submission_time: ['p(95)<300'], // 95% of submissions under 300ms
  },
};

// Helper function to create auth headers
function getAuthHeaders(token) {
  return {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  };
}

// User registration and login
export function setup() {
  const uniqueId = Date.now() + Math.random();
  const userData = {
    email: `loadtest_${uniqueId}@example.com`,
    password: 'LoadTest123!',
    name: 'Load Test User',
  };

  // Register user
  const registerRes = http.post(
    `${BASE_URL}/api/auth/register`,
    JSON.stringify(userData),
    { headers: { 'Content-Type': 'application/json' } }
  );

  check(registerRes, {
    'registration successful': (r) => r.status === 201,
  });

  // Login
  const loginRes = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({
      email: userData.email,
      password: userData.password,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  const token = loginRes.json('data.token');
  
  return { token, userData };
}

export default function (data) {
  const { token } = data;
  const headers = getAuthHeaders(token);

  // Scenario 1: Create a form
  const formData = {
    title: `Load Test Form ${randomString(8)}`,
    description: 'Form created during load testing',
    fields: [
      {
        id: randomString(16),
        type: 'text',
        label: 'Name',
        key: 'name',
        required: true,
        position: 0,
      },
      {
        id: randomString(16),
        type: 'email',
        label: 'Email',
        key: 'email',
        required: true,
        position: 1,
      },
      {
        id: randomString(16),
        type: 'textarea',
        label: 'Message',
        key: 'message',
        required: false,
        position: 2,
      },
    ],
    settings: {
      submitButtonText: 'Submit',
      allowMultipleSubmissions: true,
    },
  };

  const createFormRes = http.post(
    `${BASE_URL}/api/forms`,
    JSON.stringify(formData),
    headers
  );

  formCreationTime.add(createFormRes.timings.duration);
  
  const formCreated = check(createFormRes, {
    'form created': (r) => r.status === 201,
  });

  errorRate.add(!formCreated);

  if (!formCreated) {
    return;
  }

  const formId = createFormRes.json('data.id');
  sleep(1);

  // Scenario 2: Load the form
  const loadFormRes = http.get(
    `${BASE_URL}/api/forms/${formId}`,
    headers
  );

  formLoadTime.add(loadFormRes.timings.duration);

  check(loadFormRes, {
    'form loaded': (r) => r.status === 200,
  });

  sleep(0.5);

  // Scenario 3: Update the form
  const updateData = {
    title: `Updated ${formData.title}`,
    fields: [
      ...formData.fields,
      {
        id: randomString(16),
        type: 'select',
        label: 'Country',
        key: 'country',
        required: true,
        position: 3,
        options: [
          { label: 'USA', value: 'us' },
          { label: 'Canada', value: 'ca' },
          { label: 'Mexico', value: 'mx' },
        ],
      },
    ],
  };

  const updateFormRes = http.put(
    `${BASE_URL}/api/forms/${formId}`,
    JSON.stringify(updateData),
    headers
  );

  check(updateFormRes, {
    'form updated': (r) => r.status === 200,
  });

  sleep(1);

  // Scenario 4: Publish the form
  const publishRes = http.post(
    `${BASE_URL}/api/forms/${formId}/publish`,
    null,
    headers
  );

  check(publishRes, {
    'form published': (r) => r.status === 200,
  });

  // Scenario 5: Submit to the form (multiple submissions)
  for (let i = 0; i < 3; i++) {
    const submissionData = {
      name: `Test User ${i}`,
      email: `test${i}@example.com`,
      message: `Test message ${i}`,
      country: randomItem(['us', 'ca', 'mx']),
    };

    const submitRes = http.post(
      `${BASE_URL}/api/forms/${formId}/submit`,
      JSON.stringify(submissionData),
      { headers: { 'Content-Type': 'application/json' } }
    );

    submissionTime.add(submitRes.timings.duration);

    const submitted = check(submitRes, {
      'submission successful': (r) => r.status === 201,
    });

    errorRate.add(!submitted);
    sleep(0.5);
  }

  // Scenario 6: Get form submissions
  const getSubmissionsRes = http.get(
    `${BASE_URL}/api/forms/${formId}/submissions?page=1&limit=10`,
    headers
  );

  check(getSubmissionsRes, {
    'submissions retrieved': (r) => r.status === 200,
    'has submissions': (r) => r.json('data.length') > 0,
  });

  sleep(1);

  // Scenario 7: Export submissions
  const exportRes = http.get(
    `${BASE_URL}/api/forms/${formId}/submissions/export?format=csv`,
    headers
  );

  exportTime.add(exportRes.timings.duration);

  check(exportRes, {
    'export successful': (r) => r.status === 200,
    'is CSV': (r) => r.headers['Content-Type'].includes('csv'),
  });

  // Scenario 8: Get form analytics
  const analyticsRes = http.get(
    `${BASE_URL}/api/forms/${formId}/submissions/analytics`,
    headers
  );

  check(analyticsRes, {
    'analytics retrieved': (r) => r.status === 200,
    'has metrics': (r) => r.json('data.totalSubmissions') >= 3,
  });

  sleep(2);

  // Scenario 9: Delete the form (cleanup)
  const deleteRes = http.del(
    `${BASE_URL}/api/forms/${formId}`,
    null,
    headers
  );

  check(deleteRes, {
    'form deleted': (r) => r.status === 200,
  });
}

export function teardown(data) {
  // Cleanup: Delete the test user
  // In a real scenario, you might want to implement a cleanup endpoint
  console.log('Test completed');
}