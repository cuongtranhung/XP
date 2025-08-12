import React, { useState } from 'react';
import apiService from '../../services/api';

const TestFormsAPI: React.FC = () => {
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const testAPI = async () => {
    setLoading(true);
    console.log('🧪 Testing Forms API...');
    
    try {
      // Log current state
      const token = localStorage.getItem('auth_token');
      console.log('Token exists:', !!token);
      console.log('Token preview:', token ? token.substring(0, 30) + '...' : 'None');
      
      // Make the API call
      console.log('Making API call to /api/forms...');
      const response = await apiService.get('/api/forms?page=1&limit=20');
      
      console.log('✅ API Success:', response);
      setResult('SUCCESS: ' + JSON.stringify(response.data, null, 2));
    } catch (error: any) {
      console.error('❌ API Error:', error);
      setResult('ERROR: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      left: '10px',
      background: '#0f172a',
      color: '#fff',
      padding: '15px',
      borderRadius: '8px',
      fontSize: '12px',
      fontFamily: 'monospace',
      maxWidth: '400px',
      border: '2px solid #f59e0b',
      zIndex: 10000
    }}>
      <h4 style={{ margin: '0 0 10px 0', color: '#f59e0b' }}>🧪 Forms API Test</h4>
      
      <button 
        onClick={testAPI}
        disabled={loading}
        style={{
          background: loading ? '#64748b' : '#f59e0b',
          color: '#000',
          border: 'none',
          padding: '8px 16px',
          borderRadius: '4px',
          cursor: loading ? 'not-allowed' : 'pointer',
          width: '100%',
          fontWeight: 'bold'
        }}
      >
        {loading ? 'Testing...' : 'Test Forms API Now'}
      </button>
      
      {result && (
        <pre style={{
          marginTop: '10px',
          padding: '10px',
          background: '#1e293b',
          borderRadius: '4px',
          fontSize: '10px',
          maxHeight: '200px',
          overflow: 'auto',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all'
        }}>
          {result}
        </pre>
      )}
      
      <div style={{ marginTop: '10px', fontSize: '10px', color: '#94a3b8' }}>
        Check browser console for details
      </div>
    </div>
  );
};

export default TestFormsAPI;