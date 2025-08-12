import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import apiService from '../../services/api';

const CheckAuth: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const [tokenInfo, setTokenInfo] = useState<any>({});

  useEffect(() => {
    const checkToken = () => {
      const tokenFromStorage = localStorage.getItem('auth_token');
      const tokenFromApi = apiService.getToken();
      
      setTokenInfo({
        hasUser: !!user,
        isAuthenticated,
        tokenInStorage: !!tokenFromStorage,
        tokenInApi: !!tokenFromApi,
        tokenPreview: tokenFromStorage ? tokenFromStorage.substring(0, 20) + '...' : 'None',
        userId: user?.id,
        userEmail: user?.email
      });
    };

    checkToken();
  }, [user, isAuthenticated]);

  return (
    <div style={{
      position: 'fixed',
      bottom: '10px',
      right: '10px',
      background: '#1a1a1a',
      color: '#fff',
      padding: '15px',
      borderRadius: '8px',
      fontSize: '12px',
      fontFamily: 'monospace',
      minWidth: '300px',
      border: '2px solid #4ade80',
      zIndex: 10000
    }}>
      <h4 style={{ margin: '0 0 10px 0', color: '#4ade80' }}>🔐 Auth Status</h4>
      <div>Authenticated: {tokenInfo.isAuthenticated ? '✅' : '❌'}</div>
      <div>User: {tokenInfo.hasUser ? '✅' : '❌'} {tokenInfo.userEmail}</div>
      <div>Token in Storage: {tokenInfo.tokenInStorage ? '✅' : '❌'}</div>
      <div>Token in API: {tokenInfo.tokenInApi ? '✅' : '❌'}</div>
      <div style={{ marginTop: '10px', fontSize: '10px', color: '#94a3b8' }}>
        Token: {tokenInfo.tokenPreview}
      </div>
      <button 
        onClick={() => {
          console.log('Full token check:', {
            localStorage: localStorage.getItem('auth_token'),
            apiService: apiService.getToken(),
            user,
            headers: apiService
          });
        }}
        style={{
          marginTop: '10px',
          background: '#4ade80',
          color: '#000',
          border: 'none',
          padding: '5px 10px',
          borderRadius: '4px',
          cursor: 'pointer',
          width: '100%'
        }}
      >
        Log Full Auth Info
      </button>
    </div>
  );
};

export default CheckAuth;