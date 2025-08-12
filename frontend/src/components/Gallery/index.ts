// Main Gallery exports with version switching
export { ImageGalleryWrapper as ImageGallery } from './ImageGalleryWrapper';
export { ImageGalleryWrapper } from './ImageGalleryWrapper';

// Export individual versions if needed
export { ImageGallery as ImageGalleryV1 } from './v1';
export { ImageGallery as ImageGalleryV2 } from './v2';

// Export types
export type { 
  GalleryImage, 
  GalleryState, 
  GalleryConfig,
  GalleryCallbacks,
  ImageTransform,
  NavigationDirection 
} from './types';

// Export version info
export { GALLERY_V1_INFO } from './v1';
export { GALLERY_V2_INFO } from './v2';

// Export version selector component
export { GalleryVersionSelector } from './GalleryVersionSelector';

// Default export
import { ImageGalleryWrapper } from './ImageGalleryWrapper';
export default ImageGalleryWrapper;