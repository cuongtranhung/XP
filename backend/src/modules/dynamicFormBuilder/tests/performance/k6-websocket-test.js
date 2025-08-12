/**
 * k6 WebSocket Performance Test for Real-time Collaboration
 * 
 * Run with: k6 run k6-websocket-test.js
 */

import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { randomString } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Test configuration
const WS_URL = __ENV.WS_URL || 'ws://localhost:5000';
const API_URL = __ENV.API_URL || 'http://localhost:5000';

// Custom metrics
const wsErrorRate = new Rate('ws_errors');
const wsConnectionTime = new Trend('ws_connection_time');
const fieldOperationTime = new Trend('field_operation_time');
const cursorUpdateTime = new Trend('cursor_update_time');
const messageCount = new Counter('ws_messages');
const conflictCount = new Counter('conflicts');

// Test options
export const options = {
  stages: [
    { duration: '30s', target: 20 },   // Ramp up to 20 concurrent users
    { duration: '1m', target: 50 },    // Ramp up to 50 users
    { duration: '2m', target: 100 },   // Ramp up to 100 users
    { duration: '2m', target: 100 },   // Stay at 100 users
    { duration: '1m', target: 0 },     // Ramp down
  ],
  thresholds: {
    ws_errors: ['rate<0.05'],                    // Error rate under 5%
    ws_connection_time: ['p(95)<1000'],          // 95% connect under 1s
    field_operation_time: ['p(95)<200'],         // 95% operations under 200ms
    cursor_update_time: ['p(95)<50'],            // 95% cursor updates under 50ms
  },
};

// Helper to measure WebSocket operation time
function measureWsOperation(socket, event, data, responseEvent) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let responded = false;

    const handleResponse = (msg) => {
      const message = JSON.parse(msg);
      if (message.event === responseEvent || message.event === 'form:error' || message.event === 'form:conflict') {
        responded = true;
        const duration = Date.now() - startTime;
        
        if (message.event === 'form:conflict') {
          conflictCount.add(1);
        }
        
        resolve({ success: message.event !== 'form:error', duration });
      }
    };

    socket.on('message', handleResponse);
    
    socket.send(JSON.stringify({
      event: event,
      data: data,
    }));

    // Timeout after 5 seconds
    socket.setTimeout(() => {
      if (!responded) {
        resolve({ success: false, duration: 5000 });
      }
    }, 5000);
  });
}

export default function () {
  // Create a test form ID for this VU
  const formId = `test-form-${__VU}-${Date.now()}`;
  const userId = `user-${__VU}`;
  const token = `mock-token-${userId}`; // In real test, get actual token

  const connectionStart = Date.now();
  
  const response = ws.connect(WS_URL, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  }, function (socket) {
    const connectionTime = Date.now() - connectionStart;
    wsConnectionTime.add(connectionTime);

    socket.on('open', () => {
      check(socket, { 'WebSocket connected': (s) => s.readyState === 1 });

      // Join form room
      socket.send(JSON.stringify({
        event: 'form:join',
        data: formId,
      }));

      messageCount.add(1);
    });

    socket.on('message', (data) => {
      messageCount.add(1);
      // Handle incoming messages
      const message = JSON.parse(data);
      
      if (message.event === 'form:collaborators') {
        // Successfully joined room
        performCollaborationTest(socket, formId);
      }
    });

    socket.on('error', (e) => {
      wsErrorRate.add(1);
      console.error('WebSocket error:', e);
    });

    socket.on('close', () => {
      // Connection closed
    });

    // Keep connection open for test duration
    socket.setTimeout(function () {
      socket.close();
    }, 30000);
  });

  check(response, { 'WebSocket connection successful': (r) => r && r.status === 101 });
}

async function performCollaborationTest(socket, formId) {
  // Test 1: Add fields rapidly
  for (let i = 0; i < 5; i++) {
    const fieldData = {
      formId: formId,
      field: {
        id: randomString(16),
        type: 'text',
        label: `Field ${i}`,
        key: `field_${i}`,
        position: i,
      },
      position: i,
    };

    const result = await measureWsOperation(
      socket,
      'form:field:add',
      fieldData,
      'form:field:added'
    );

    fieldOperationTime.add(result.duration);
    wsErrorRate.add(!result.success);
    
    sleep(0.1);
  }

  // Test 2: Update fields concurrently
  const updatePromises = [];
  for (let i = 0; i < 3; i++) {
    const updateData = {
      formId: formId,
      fieldId: `field_${i}`,
      updates: {
        label: `Updated Field ${i}`,
        required: true,
      },
    };

    updatePromises.push(
      measureWsOperation(
        socket,
        'form:field:update',
        updateData,
        'form:field:updated'
      )
    );
  }

  const updateResults = await Promise.all(updatePromises);
  updateResults.forEach(result => {
    fieldOperationTime.add(result.duration);
    wsErrorRate.add(!result.success);
  });

  // Test 3: Rapid cursor movements
  for (let i = 0; i < 20; i++) {
    const cursorData = {
      formId: formId,
      x: Math.random() * 1000,
      y: Math.random() * 1000,
    };

    const result = await measureWsOperation(
      socket,
      'form:cursor:move',
      cursorData,
      'collaborator:cursor:moved'
    );

    cursorUpdateTime.add(result.duration);
    sleep(0.05); // 50ms between cursor updates
  }

  // Test 4: Field reordering
  const reorderData = {
    formId: formId,
    fromIndex: 0,
    toIndex: 4,
  };

  const reorderResult = await measureWsOperation(
    socket,
    'form:field:reorder',
    reorderData,
    'form:field:reordered'
  );

  fieldOperationTime.add(reorderResult.duration);
  wsErrorRate.add(!reorderResult.success);

  // Test 5: Selection changes
  for (let i = 0; i < 5; i++) {
    const selectionData = {
      formId: formId,
      fieldId: `field_${i}`,
    };

    socket.send(JSON.stringify({
      event: 'form:selection:change',
      data: selectionData,
    }));

    sleep(0.2);
  }

  // Test 6: Form locking
  const lockResult = await measureWsOperation(
    socket,
    'form:lock:request',
    formId,
    'form:lock:acquired'
  );

  if (lockResult.success) {
    sleep(1); // Hold lock for 1 second
    
    socket.send(JSON.stringify({
      event: 'form:lock:release',
      data: formId,
    }));
  }

  // Keep sending presence pings
  const pingInterval = setInterval(() => {
    socket.send(JSON.stringify({
      event: 'presence:ping',
      data: {},
    }));
  }, 30000);

  // Clean up on socket close
  socket.on('close', () => {
    clearInterval(pingInterval);
  });
}

export function handleSummary(data) {
  return {
    'stdout': generateTextSummary(data),
    'summary.html': htmlReport(data),
  };
}

function generateTextSummary(data) {
  const { metrics } = data;
  
  return `
=== WebSocket Collaboration Performance Test Results ===

Connection Metrics:
- Total connections: ${metrics.ws_connection_time.values.count}
- Average connection time: ${metrics.ws_connection_time.values.avg.toFixed(2)}ms
- P95 connection time: ${metrics.ws_connection_time.values['p(95)'].toFixed(2)}ms

Operation Metrics:
- Total messages: ${metrics.ws_messages.values.count}
- Error rate: ${(metrics.ws_errors.values.rate * 100).toFixed(2)}%
- Conflicts detected: ${metrics.conflicts.values.count}

Field Operations:
- Average time: ${metrics.field_operation_time.values.avg.toFixed(2)}ms
- P95 time: ${metrics.field_operation_time.values['p(95)'].toFixed(2)}ms

Cursor Updates:
- Average time: ${metrics.cursor_update_time.values.avg.toFixed(2)}ms
- P95 time: ${metrics.cursor_update_time.values['p(95)'].toFixed(2)}ms

Throughput:
- Messages per second: ${(metrics.ws_messages.values.count / data.state.testRunDurationMs * 1000).toFixed(2)}
`;
}