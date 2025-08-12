import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Layout, Settings, Save, Check } from 'lucide-react';

interface GallerySettingsProps {
  className?: string;
  onClose?: () => void;
}

export const GallerySettings: React.FC<GallerySettingsProps> = ({ 
  className = '',
  onClose 
}) => {
  const [galleryVersion, setGalleryVersion] = useState<'v1' | 'v2'>('v1');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // Load saved preference from localStorage
    const savedVersion = localStorage.getItem('galleryVersion');
    if (savedVersion === 'v2') {
      setGalleryVersion('v2');
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem('galleryVersion', galleryVersion);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose?.();
    }, 1500);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className={`gallery-settings ${className}`}
      style={{
        background: 'white',
        borderRadius: '12px',
        padding: '24px',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.1)',
        maxWidth: '500px',
        width: '100%'
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '24px'
      }}>
        <Settings size={24} color="#3b82f6" />
        <h2 style={{
          fontSize: '20px',
          fontWeight: '600',
          color: '#1f2937',
          margin: 0
        }}>
          Gallery Settings
        </h2>
      </div>

      <div style={{
        marginBottom: '24px'
      }}>
        <label style={{
          display: 'block',
          fontSize: '14px',
          fontWeight: '500',
          color: '#6b7280',
          marginBottom: '12px'
        }}>
          Choose Default Gallery Version
        </label>

        <div style={{
          display: 'flex',
          gap: '12px',
          flexDirection: 'column'
        }}>
          {/* Version 1.0 - Classic */}
          <motion.label
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '16px',
              borderRadius: '8px',
              cursor: 'pointer',
              background: galleryVersion === 'v1' ? '#eff6ff' : '#f9fafb',
              border: galleryVersion === 'v1' ? '2px solid #3b82f6' : '2px solid #e5e7eb',
              transition: 'all 0.2s ease'
            }}
          >
            <input
              type="radio"
              name="gallery-version-settings"
              value="v1"
              checked={galleryVersion === 'v1'}
              onChange={() => setGalleryVersion('v1')}
              style={{
                width: '18px',
                height: '18px',
                marginRight: '12px',
                accentColor: '#3b82f6'
              }}
            />
            <div style={{ flex: 1 }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '4px'
              }}>
                <Layout size={18} color="#3b82f6" />
                <span style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#1f2937'
                }}>
                  Gallery v1.0 - Classic
                </span>
              </div>
              <p style={{
                fontSize: '14px',
                color: '#6b7280',
                margin: 0
              }}>
                Traditional gallery with familiar controls and layout
              </p>
            </div>
          </motion.label>

          {/* Version 2.0 - Modern */}
          <motion.label
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '16px',
              borderRadius: '8px',
              cursor: 'pointer',
              background: galleryVersion === 'v2' ? '#f0f9ff' : '#f9fafb',
              border: galleryVersion === 'v2' ? '2px solid #06b6d4' : '2px solid #e5e7eb',
              transition: 'all 0.2s ease'
            }}
          >
            <input
              type="radio"
              name="gallery-version-settings"
              value="v2"
              checked={galleryVersion === 'v2'}
              onChange={() => setGalleryVersion('v2')}
              style={{
                width: '18px',
                height: '18px',
                marginRight: '12px',
                accentColor: '#06b6d4'
              }}
            />
            <div style={{ flex: 1 }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '4px'
              }}>
                <Sparkles size={18} color="#06b6d4" />
                <span style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#1f2937'
                }}>
                  Gallery v2.0 - Modern ✨
                </span>
              </div>
              <p style={{
                fontSize: '14px',
                color: '#6b7280',
                margin: 0
              }}>
                Advanced features with gestures, animations, and accessibility
              </p>
            </div>
          </motion.label>
        </div>
      </div>

      {/* Feature Comparison */}
      <div style={{
        background: '#f9fafb',
        borderRadius: '8px',
        padding: '16px',
        marginBottom: '24px'
      }}>
        <h3 style={{
          fontSize: '14px',
          fontWeight: '600',
          color: '#4b5563',
          marginTop: 0,
          marginBottom: '12px'
        }}>
          Feature Comparison
        </h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '16px',
          fontSize: '13px'
        }}>
          <div>
            <strong style={{ color: '#3b82f6' }}>v1.0 Classic:</strong>
            <ul style={{ margin: '8px 0', paddingLeft: '20px', color: '#6b7280' }}>
              <li>Simple navigation</li>
              <li>Basic zoom controls</li>
              <li>Thumbnail grid</li>
              <li>Standard animations</li>
            </ul>
          </div>
          <div>
            <strong style={{ color: '#06b6d4' }}>v2.0 Modern:</strong>
            <ul style={{ margin: '8px 0', paddingLeft: '20px', color: '#6b7280' }}>
              <li>Gesture controls</li>
              <li>Pinch to zoom</li>
              <li>Glassmorphism UI</li>
              <li>WCAG 2.1 AAA</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{
        display: 'flex',
        gap: '12px',
        justifyContent: 'flex-end'
      }}>
        {onClose && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onClose}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: '1px solid #e5e7eb',
              background: 'white',
              color: '#6b7280',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            Cancel
          </motion.button>
        )}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleSave}
          disabled={saved}
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            border: 'none',
            background: saved ? '#10b981' : '#3b82f6',
            color: 'white',
            fontSize: '14px',
            fontWeight: '500',
            cursor: saved ? 'default' : 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          {saved ? (
            <>
              <Check size={16} />
              Saved!
            </>
          ) : (
            <>
              <Save size={16} />
              Save Settings
            </>
          )}
        </motion.button>
      </div>
    </motion.div>
  );
};

export default GallerySettings;