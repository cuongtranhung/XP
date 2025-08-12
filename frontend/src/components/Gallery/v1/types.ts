/**
 * Type definitions for Image Gallery Component
 */

export interface GalleryImage {
  id: string;
  url: string;
  thumbnailUrl?: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  width?: number;
  height?: number;
  alt?: string;
  caption?: string;
  metadata?: Record<string, any>;
}

export interface GalleryState {
  currentIndex: number;
  isFullscreen: boolean;
  zoom: number;
  rotation: number;
  position: { x: number; y: number };
  isLoading: boolean;
  error: string | null;
  isPanning: boolean;
  loadedImages: Set<number>;
  preloadedImages: Set<number>;
}

export interface GalleryConfig {
  enableKeyboard: boolean;
  enableTouch: boolean;
  enableZoom: boolean;
  enableRotation: boolean;
  enableFullscreen: boolean;
  enableThumbnails: boolean;
  enableDownload: boolean;
  enableShare: boolean;
  preloadCount: number;
  animationDuration: number;
  maxZoom: number;
  minZoom: number;
  zoomStep: number;
  rotationStep: number;
  theme: 'light' | 'dark' | 'auto';
  layout: 'modal' | 'fullscreen' | 'inline';
}

export interface ImageTransform {
  scale: number;
  rotate: number;
  x: number;
  y: number;
}

export type NavigationDirection = 'prev' | 'next';

export interface GalleryCallbacks {
  onClose?: () => void;
  onImageChange?: (index: number) => void;
  onDownload?: (image: GalleryImage) => void;
  onShare?: (image: GalleryImage) => void;
  onError?: (error: Error) => void;
}