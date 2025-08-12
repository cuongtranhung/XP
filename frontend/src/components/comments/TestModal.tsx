import React from 'react';

export const TestModal: React.FC = () => {
  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(255, 0, 0, 0.8)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <div style={{
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '10px',
        border: '3px solid red'
      }}>
        <h1 style={{ color: 'red', fontSize: '24px' }}>TEST MODAL WORKING!</h1>
        <p>If you see this, React modal rendering works</p>
      </div>
    </div>
  );
};