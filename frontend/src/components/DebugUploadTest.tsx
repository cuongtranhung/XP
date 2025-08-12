import React, { useState } from 'react';
import axios from 'axios';

export const DebugUploadTest: React.FC = () => {
  const [token, setToken] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const getToken = async () => {
    try {
      const response = await axios.post('/api/auth/login', {
        email: 'cuongtranhung@gmail.com',
        password: '@Abcd6789'
      });
      
      if (response.data.success && response.data.data?.token) {
        setToken(response.data.data.token);
        setResult({ type: 'success', message: 'Token obtained', data: response.data });
        return response.data.data.token;
      }
    } catch (error: any) {
      setResult({ type: 'error', message: 'Login failed', error: error.response?.data || error.message });
      return null;
    }
  };

  const testSimpleUpload = async () => {
    setLoading(true);
    try {
      // Get token first
      let authToken = token;
      if (!authToken) {
        authToken = await getToken();
        if (!authToken) return;
      }

      // Create a simple text file
      const testContent = 'Hello, this is a test file for upload debugging!';
      const blob = new Blob([testContent], { type: 'text/plain' });
      const file = new File([blob], 'debug-test.txt', { type: 'text/plain' });

      const formData = new FormData();
      formData.append('file', file);

      // Use existing comment ID
      const commentId = '0488c09c-df7e-4dd0-abc1-72bad0cc9dd2';

      console.log('🚀 Uploading to comment:', commentId);
      console.log('🚀 File:', file.name, file.size, 'bytes');
      console.log('🚀 Token:', authToken ? 'Present' : 'Missing');

      const response = await axios.post(
        `/api/comment-attachments/comment/${commentId}`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
          timeout: 30000,
        }
      );

      setResult({ 
        type: 'success', 
        message: 'Upload successful!', 
        data: response.data,
        requestInfo: { commentId, filename: file.name, size: file.size }
      });

    } catch (error: any) {
      console.error('❌ Upload error:', error);
      setResult({ 
        type: 'error', 
        message: 'Upload failed', 
        error: error.response?.data || error.message,
        fullError: error
      });
    } finally {
      setLoading(false);
    }
  };

  const testDirectDatabase = async () => {
    try {
      const response = await axios.post('/api/debug/test-db-insert', {}, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      
      setResult({ 
        type: 'success', 
        message: 'Database test', 
        data: response.data 
      });
    } catch (error: any) {
      setResult({ 
        type: 'error', 
        message: 'Database test failed', 
        error: error.response?.data || error.message 
      });
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">🔧 Upload Debug Test</h1>
      
      <div className="space-y-4 mb-6">
        <button
          onClick={getToken}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          {token ? '🔑 Refresh Token' : '🔑 Get Token'}
        </button>
        
        <button
          onClick={testSimpleUpload}
          disabled={loading}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-300"
        >
          {loading ? '⏳ Testing...' : '🧪 Test Simple Upload'}
        </button>

        <button
          onClick={testDirectDatabase}
          className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
        >
          🗄️ Test Database Direct
        </button>
      </div>

      {token && (
        <div className="mb-4 p-3 bg-green-50 rounded">
          <p className="text-sm">✅ Token: {token.substring(0, 20)}...</p>
        </div>
      )}

      {result && (
        <div className={`p-4 rounded ${result.type === 'success' ? 'bg-green-50' : 'bg-red-50'}`}>
          <h3 className="font-bold mb-2">
            {result.type === 'success' ? '✅ Success' : '❌ Error'}
          </h3>
          <p className="mb-2">{result.message}</p>
          
          <details className="mt-2">
            <summary className="cursor-pointer font-medium">Show Details</summary>
            <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-x-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>
        </div>
      )}

      <div className="mt-6 p-4 bg-yellow-50 rounded">
        <h3 className="font-semibold mb-2">🎯 Debug Info</h3>
        <ul className="text-sm space-y-1">
          <li>• Using comment ID: 0488c09c-df7e-4dd0-abc1-72bad0cc9dd2</li>
          <li>• From submission_comments table</li>
          <li>• User ID: 2 (cuongtranhung@gmail.com)</li>
          <li>• File: Simple text file (debug-test.txt)</li>
        </ul>
      </div>
    </div>
  );
};

export default DebugUploadTest;