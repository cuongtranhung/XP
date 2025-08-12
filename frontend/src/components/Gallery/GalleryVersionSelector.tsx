import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Layout } from 'lucide-react';

interface GalleryVersionSelectorProps {
  currentVersion: 'v1' | 'v2';
  onVersionChange: (version: 'v1' | 'v2') => void;
  className?: string;
}

export const GalleryVersionSelector: React.FC<GalleryVersionSelectorProps> = ({
  currentVersion,
  onVersionChange,
  className = ''
}) => {
  return (
    <div className={`gallery-version-selector ${className}`} style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '4px',
      background: 'rgba(255, 255, 255, 0.1)',
      borderRadius: '20px',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(255, 255, 255, 0.2)'
    }}>
      {/* Version 1.0 - Classic */}
      <motion.label
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '6px 12px',
          borderRadius: '16px',
          cursor: 'pointer',
          background: currentVersion === 'v1' ? 'rgba(59, 130, 246, 0.3)' : 'transparent',
          border: currentVersion === 'v1' ? '1px solid rgba(59, 130, 246, 0.5)' : '1px solid transparent',
          transition: 'all 0.2s ease',
          fontSize: '12px',
          fontWeight: '500',
          color: currentVersion === 'v1' ? '#60a5fa' : 'rgba(255, 255, 255, 0.7)'
        }}
      >
        <input
          type="radio"
          name="gallery-version"
          value="v1"
          checked={currentVersion === 'v1'}
          onChange={() => onVersionChange('v1')}
          style={{
            width: '14px',
            height: '14px',
            margin: 0,
            marginRight: '2px',
            cursor: 'pointer',
            accentColor: '#3b82f6'
          }}
        />
        <Layout size={14} />
        <span>Classic</span>
      </motion.label>

      {/* Version 2.0 - Modern */}
      <motion.label
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '6px 12px',
          borderRadius: '16px',
          cursor: 'pointer',
          background: currentVersion === 'v2' ? 'rgba(168, 85, 247, 0.3)' : 'transparent',
          border: currentVersion === 'v2' ? '1px solid rgba(168, 85, 247, 0.5)' : '1px solid transparent',
          transition: 'all 0.2s ease',
          fontSize: '12px',
          fontWeight: '500',
          color: currentVersion === 'v2' ? '#c084fc' : 'rgba(255, 255, 255, 0.7)',
          position: 'relative'
        }}
      >
        <input
          type="radio"
          name="gallery-version"
          value="v2"
          checked={currentVersion === 'v2'}
          onChange={() => onVersionChange('v2')}
          style={{
            width: '14px',
            height: '14px',
            margin: 0,
            marginRight: '2px',
            cursor: 'pointer',
            accentColor: '#a855f7'
          }}
        />
        <Sparkles size={14} />
        <span>Modern</span>
        <span style={{
          position: 'absolute',
          top: '-4px',
          right: '-4px',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          fontSize: '8px',
          padding: '2px 4px',
          borderRadius: '4px',
          fontWeight: 'bold',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          Beta
        </span>
      </motion.label>
    </div>
  );
};

export default GalleryVersionSelector;