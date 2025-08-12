import React, { useState, useEffect, useMemo } from 'react';
import { ImageGallery as ImageGalleryV1 } from './v1';
import { ImageGallery as ImageGalleryV2 } from './v2';
import { GalleryVersionSelector } from './GalleryVersionSelector';
import { motion } from 'framer-motion';
import type { GalleryImage, GalleryConfig } from './types';

interface ImageGalleryWrapperProps {
  images: GalleryImage[];
  initialIndex?: number;
  config?: Partial<GalleryConfig>;
  className?: string;
  onClose?: () => void;
  onImageChange?: (index: number) => void;
  onDownload?: (image: GalleryImage) => void;
  onShare?: (image: GalleryImage) => void;
}

export const ImageGalleryWrapper: React.FC<ImageGalleryWrapperProps> = (props) => {
  // Get version from localStorage
  const [galleryVersion, setGalleryVersion] = useState<'v1' | 'v2'>(() => {
    const saved = localStorage.getItem('gallery-version');
    return (saved as 'v1' | 'v2') || 'v1';
  });

  // Handle version change
  const handleVersionChange = (version: 'v1' | 'v2') => {
    setGalleryVersion(version);
    localStorage.setItem('gallery-version', version);
    
    // Log version change
    const versionName = version === 'v1' ? 'Classic' : 'Modern (Beta)';
    console.log(`🎨 Gallery switched to ${versionName} version`);
  };

  // Check if v2 is enabled via environment or feature flag
  const isV2Enabled = useMemo(() => {
    // You can add feature flag logic here
    return true; // For now, always enable v2
  }, []);

  // Render the appropriate gallery version
  const renderGallery = () => {
    if (galleryVersion === 'v2' && isV2Enabled) {
      return <ImageGalleryV2 {...props} />;
    }
    return <ImageGalleryV1 {...props} />;
  };

  return (
    <>
      {/* Render the selected gallery version */}
      {renderGallery()}
      
      {/* Version Selector Overlay - Always visible when gallery is open */}
      {props.images && props.images.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          style={{
            position: 'fixed',
            bottom: '40px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10001, // Higher than gallery
            pointerEvents: 'auto'
          }}
        >
          <GalleryVersionSelector
            currentVersion={galleryVersion}
            onVersionChange={handleVersionChange}
          />
        </motion.div>
      )}
    </>
  );
};

export default ImageGalleryWrapper;