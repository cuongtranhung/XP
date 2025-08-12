import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useFormBuilder } from '../../hooks/useFormBuilder';
import apiService from '../../services/api';

const FormsDebug: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const { forms, loading, error, loadForms } = useFormBuilder();
  const [debugInfo, setDebugInfo] = useState<any>({});
  const [apiTest, setApiTest] = useState<string>('');

  useEffect(() => {
    const gatherDebugInfo = async () => {
      const info = {
        timestamp: new Date().toISOString(),
        auth: {
          isAuthenticated,
          hasUser: !!user,
          userId: user?.id,
          email: user?.email,
          token: apiService.getToken() ? 'Present' : 'Missing'
        },
        formsHook: {
          formsCount: forms.length,
          loading,
          error,
          hasLoadFormsFunction: typeof loadForms === 'function'
        },
        environment: {
          baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
          mode: import.meta.env.MODE,
        },
        browser: {
          userAgent: navigator.userAgent,
          url: window.location.href,
          pathname: window.location.pathname,
        }
      };
      
      setDebugInfo(info);

      // Test API directly
      try {
        const response = await apiService.get('/api/forms');
        setApiTest(JSON.stringify(response.data, null, 2));
      } catch (err: any) {
        setApiTest(`API Error: ${err.response?.data?.message || err.message}`);
      }
    };

    gatherDebugInfo();
  }, [user, isAuthenticated, forms, loading, error, loadForms]);

  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      width: '400px',
      maxHeight: '90vh',
      overflow: 'auto',
      background: 'rgba(0, 0, 0, 0.9)',
      color: 'white',
      padding: '15px',
      borderRadius: '8px',
      fontSize: '12px',
      fontFamily: 'monospace',
      zIndex: 9999,
      border: '2px solid #ff6b6b'
    }}>
      <h3 style={{ color: '#ff6b6b', margin: '0 0 10px 0' }}>🔧 Forms Debug Panel</h3>
      
      <div style={{ marginBottom: '15px' }}>
        <h4 style={{ color: '#4ecdc4', margin: '0 0 5px 0' }}>Authentication:</h4>
        <div>Authenticated: {debugInfo.auth?.isAuthenticated ? '✅' : '❌'}</div>
        <div>User: {debugInfo.auth?.hasUser ? '✅' : '❌'}</div>
        <div>Token: {debugInfo.auth?.token}</div>
      </div>

      <div style={{ marginBottom: '15px' }}>
        <h4 style={{ color: '#4ecdc4', margin: '0 0 5px 0' }}>Forms Hook:</h4>
        <div>Forms Count: {debugInfo.formsHook?.formsCount}</div>
        <div>Loading: {debugInfo.formsHook?.loading ? '🔄' : '✅'}</div>
        <div>Error: {debugInfo.formsHook?.error || 'None'}</div>
      </div>

      <div style={{ marginBottom: '15px' }}>
        <h4 style={{ color: '#4ecdc4', margin: '0 0 5px 0' }}>Environment:</h4>
        <div>API URL: {debugInfo.environment?.baseURL}</div>
        <div>Mode: {debugInfo.environment?.mode}</div>
      </div>

      <div style={{ marginBottom: '15px' }}>
        <h4 style={{ color: '#4ecdc4', margin: '0 0 5px 0' }}>API Test:</h4>
        <pre style={{ 
          background: '#333', 
          padding: '8px', 
          borderRadius: '4px',
          fontSize: '10px',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word'
        }}>
          {apiTest || 'Testing...'}
        </pre>
      </div>

      <div style={{ marginBottom: '15px' }}>
        <h4 style={{ color: '#4ecdc4', margin: '0 0 5px 0' }}>Actions:</h4>
        <button 
          onClick={() => loadForms()}
          style={{
            background: '#45b7d1',
            color: 'white',
            border: 'none',
            padding: '5px 10px',
            borderRadius: '4px',
            cursor: 'pointer',
            marginRight: '5px'
          }}
        >
          Test loadForms()
        </button>
        <button 
          onClick={() => window.location.reload()}
          style={{
            background: '#96ceb4',
            color: 'white',
            border: 'none',
            padding: '5px 10px',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Reload Page
        </button>
      </div>
    </div>
  );
};

export default FormsDebug;