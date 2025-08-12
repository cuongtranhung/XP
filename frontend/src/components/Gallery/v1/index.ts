// Gallery v1.0 - Classic Version
export { default as ImageGallery } from './ImageGallery';
export { default as ImageNotesPanel } from './ImageNotesPanel';
export * from './types';
export * from './hooks/useImagePreloader';
export * from './hooks/useGalleryKeyboard';

// Version metadata
export const GALLERY_V1_INFO = {
  version: '1.0.0',
  name: 'Classic Gallery',
  releaseDate: '2024-01-01',
  features: [
    'Basic zoom & pan controls',
    'Keyboard navigation (Arrow keys, ESC)',
    'Touch gestures support',
    'Image notes panel',
    'Thumbnail navigation',
    'Download functionality',
    'Fullscreen mode',
    'Image rotation'
  ],
  performance: {
    loadTime: 'Fast',
    animations: 'Smooth',
    mobile: 'Good'
  }
};