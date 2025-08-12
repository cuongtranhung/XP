import React from 'react';
import AppLayout from '../layout/AppLayout';

const MinimalFormsTest: React.FC = () => {
  console.log('🧪 MinimalFormsTest rendering...');
  
  return (
    <AppLayout>
      <div style={{
        padding: '40px',
        background: '#f0f9ff',
        border: '3px solid #3b82f6',
        borderRadius: '12px',
        margin: '20px'
      }}>
        <h1 style={{
          fontSize: '2rem',
          color: '#1e40af',
          marginBottom: '20px',
          textAlign: 'center'
        }}>
          🧪 MINIMAL FORMS TEST
        </h1>
        
        <div style={{
          background: '#e0f2fe',
          padding: '20px',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          <h2>✅ SUCCESS: AppLayout is working!</h2>
          <p>If you can see this page with navigation header, AppLayout is rendering correctly.</p>
        </div>

        <div style={{
          background: '#fff3cd',
          padding: '20px',
          borderRadius: '8px',
          border: '1px solid #ffeaa7'
        }}>
          <h3>🔍 Debug Info:</h3>
          <ul>
            <li>Component: MinimalFormsTest</li>
            <li>Timestamp: {new Date().toISOString()}</li>
            <li>Location: {window.location.href}</li>
            <li>User Agent: {navigator.userAgent.substring(0, 50)}...</li>
          </ul>
        </div>

        <div style={{
          textAlign: 'center',
          marginTop: '30px'
        }}>
          <button 
            onClick={() => console.log('🧪 Test button clicked!')}
            style={{
              background: '#10b981',
              color: 'white',
              padding: '12px 24px',
              border: 'none',
              borderRadius: '6px',
              fontSize: '16px',
              cursor: 'pointer'
            }}
          >
            Test Button (Check Console)
          </button>
        </div>
      </div>
    </AppLayout>
  );
};

export default MinimalFormsTest;