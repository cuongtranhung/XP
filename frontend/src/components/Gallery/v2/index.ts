// Gallery v2.0 - Modern Version (Beta)
export { default as ImageGallery } from './ImageGallery';
export { default as ImageNotesPanel } from './ImageNotesPanel';
export * from './types';
export * from './hooks/useImagePreloader';
export * from './hooks/useGalleryKeyboard';

// Version metadata
export const GALLERY_V2_INFO = {
  version: '2.0.0-beta',
  name: 'Modern Gallery',
  releaseDate: '2024-12-01',
  status: 'beta',
  features: [
    '✨ Advanced animations with spring physics',
    '🎨 Modern glassmorphism design',
    '⚡ Performance optimized with virtual scrolling',
    '♿ WCAG 2.1 AAA accessibility',
    '📱 Mobile-first responsive design',
    '🖼️ AI-powered image enhancements',
    '🌍 Multi-language support',
    '🎯 Smart gesture controls',
    '🔍 Advanced zoom with focal points',
    '💫 Smooth transitions and effects'
  ],
  performance: {
    loadTime: 'Ultra Fast',
    animations: 'Buttery Smooth (60fps)',
    mobile: 'Excellent'
  },
  newInV2: [
    'Double-tap to zoom',
    'Pinch gesture improvements',
    'Swipe velocity navigation',
    'Picture-in-Picture mode',
    'Smart image preloading',
    'WebP/AVIF support',
    'Haptic feedback (mobile)'
  ]
};