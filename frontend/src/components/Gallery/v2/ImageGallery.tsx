import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence, useAnimation, useMotionValue, useTransform, useSpring } from 'framer-motion';
import { 
  ChevronLeft, 
  ChevronRight, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  RotateCcw,
  Maximize2,
  Minimize2,
  Download,
  Share2,
  X,
  Grid,
  Loader2,
  MessageSquare,
  Sparkles,
  Eye,
  EyeOff,
  Info,
  Heart,
  Layers,
  Move,
  Expand
} from 'lucide-react';
import { GalleryImage, GalleryState, GalleryConfig, GalleryCallbacks } from './types';
import { useImagePreloader } from './hooks/useImagePreloader';
import { useGalleryKeyboard } from './hooks/useGalleryKeyboard';
import { useAccessibility } from './hooks/useAccessibility';
import { useAdvancedGestures } from './hooks/useAdvancedGestures';
import { ImageNotesPanel } from './ImageNotesPanel';
import styles from './ImageGallery.module.css';
import stylesV2 from './ImageGallery.v2.module.css';

interface ImageGalleryProps {
  images: GalleryImage[];
  initialIndex?: number;
  config?: Partial<GalleryConfig>;
  className?: string;
  onClose?: () => void;
  onImageChange?: (index: number) => void;
  onDownload?: (image: GalleryImage) => void;
  onShare?: (image: GalleryImage) => void;
}

const defaultConfig: GalleryConfig = {
  enableKeyboard: true,
  enableTouch: true,
  enableZoom: true,
  enableRotation: true,
  enableFullscreen: true,
  enableThumbnails: true,
  enableDownload: true,
  enableShare: true,
  preloadCount: 3, // Increased for better performance
  animationDuration: 400, // Slightly longer for smoother animations
  maxZoom: 5, // Higher max zoom
  minZoom: 0.5,
  zoomStep: 0.25,
  rotationStep: 90,
  theme: 'auto',
  layout: 'modal'
};

export const ImageGallery: React.FC<ImageGalleryProps> = ({ 
  images, 
  initialIndex = 0,
  config: userConfig,
  className,
  onClose,
  onImageChange,
  onDownload,
  onShare
}) => {
  const config = useMemo(() => ({ ...defaultConfig, ...userConfig }), [userConfig]);
  
  // State management
  const [state, setState] = useState<GalleryState>({
    currentIndex: initialIndex,
    isFullscreen: false,
    zoom: 1,
    rotation: 0,
    position: { x: 0, y: 0 },
    isLoading: true,
    error: null,
    isPanning: false,
    loadedImages: new Set(),
    preloadedImages: new Set()
  });

  // UI States
  const [notesVisible, setNotesVisible] = useState(false);
  const [infoVisible, setInfoVisible] = useState(false);
  const [showMinimap, setShowMinimap] = useState(false);
  const [liked, setLiked] = useState<Set<string>>(new Set());

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const controls = useAnimation();

  // Spring motion values for smooth animations
  const x = useSpring(useMotionValue(0), { stiffness: 300, damping: 30 });
  const y = useSpring(useMotionValue(0), { stiffness: 300, damping: 30 });
  const scale = useSpring(useMotionValue(1), { stiffness: 300, damping: 30 });
  const rotate = useSpring(useMotionValue(0), { stiffness: 300, damping: 30 });

  // Accessibility hook
  const {
    announce,
    setupFocusTrap,
    getGalleryProps,
    getImageProps,
    getNavButtonProps,
    getControlButtonProps,
    isHighContrast,
    prefersReducedMotion
  } = useAccessibility({
    enableAnnouncements: true,
    enableFocusTrap: true,
    enableHighContrast: true,
    enableReducedMotion: true
  });

  // Advanced gestures hook
  const {
    bind: gestureBind,
    gestureState,
    triggerHaptic,
    reset: resetGestures
  } = useAdvancedGestures({
    onZoom: (newScale) => {
      setState(prev => ({ ...prev, zoom: newScale }));
      scale.set(newScale);
    },
    onPan: (newX, newY) => {
      x.set(newX);
      y.set(newY);
      setState(prev => ({ ...prev, position: { x: newX, y: newY } }));
    },
    onSwipe: (direction) => {
      if (direction === 'left' && state.currentIndex < images.length - 1) {
        navigateImage('next');
      } else if (direction === 'right' && state.currentIndex > 0) {
        navigateImage('prev');
      } else if (direction === 'down') {
        onClose?.();
      }
    },
    onDoubleTap: (point) => {
      // Zoom to point on double tap
      const newZoom = state.zoom === 1 ? 2.5 : 1;
      handleZoom(newZoom - state.zoom);
      
      if (newZoom > 1) {
        // Calculate pan to zoom point
        const rect = imageRef.current?.getBoundingClientRect();
        if (rect) {
          const centerX = rect.width / 2;
          const centerY = rect.height / 2;
          const panX = (centerX - point.x) * (newZoom - 1);
          const panY = (centerY - point.y) * (newZoom - 1);
          x.set(panX);
          y.set(panY);
        }
      }
    },
    onLongPress: () => {
      // Show image info on long press
      setInfoVisible(true);
      triggerHaptic('medium');
    },
    enableMomentum: true,
    enableHapticFeedback: true
  });

  // Use image preloader hook
  const { isPreloaded } = useImagePreloader(images, state.currentIndex, config.preloadCount);

  // Navigation functions
  const navigateImage = useCallback((direction: 'prev' | 'next') => {
    const newIndex = direction === 'prev' 
      ? Math.max(0, state.currentIndex - 1)
      : Math.min(images.length - 1, state.currentIndex + 1);
    
    if (newIndex !== state.currentIndex) {
      setState(prev => ({ 
        ...prev, 
        currentIndex: newIndex,
        isLoading: true,
        zoom: 1,
        rotation: 0,
        position: { x: 0, y: 0 }
      }));
      
      // Reset transforms with spring animation
      x.set(0);
      y.set(0);
      scale.set(1);
      rotate.set(0);
      resetGestures();
      
      // Announce navigation
      announce(`Image ${newIndex + 1} of ${images.length}`);
      onImageChange?.(newIndex);
      triggerHaptic('light');
    }
  }, [state.currentIndex, images.length, onImageChange, x, y, scale, rotate, announce, triggerHaptic, resetGestures]);

  // Zoom handling
  const handleZoom = useCallback((delta: number) => {
    const newZoom = Math.max(config.minZoom, Math.min(config.maxZoom, state.zoom + delta));
    
    setState(prev => ({ ...prev, zoom: newZoom }));
    scale.set(newZoom);
    
    if (newZoom === 1) {
      x.set(0);
      y.set(0);
      setState(prev => ({ ...prev, position: { x: 0, y: 0 } }));
    }
    
    announce(`Zoom ${Math.round(newZoom * 100)}%`);
  }, [state.zoom, config.minZoom, config.maxZoom, scale, x, y, announce]);

  // Rotation handling
  const handleRotate = useCallback((degrees: number) => {
    const newRotation = (state.rotation + degrees) % 360;
    setState(prev => ({ ...prev, rotation: newRotation }));
    rotate.set(newRotation);
    announce(`Rotated ${newRotation} degrees`);
  }, [state.rotation, rotate, announce]);

  // Like/favorite handling
  const toggleLike = useCallback(() => {
    const currentImage = images[state.currentIndex];
    setLiked(prev => {
      const newLiked = new Set(prev);
      if (newLiked.has(currentImage.id)) {
        newLiked.delete(currentImage.id);
        announce('Removed from favorites');
      } else {
        newLiked.add(currentImage.id);
        announce('Added to favorites');
      }
      return newLiked;
    });
    triggerHaptic('medium');
  }, [state.currentIndex, images, announce, triggerHaptic]);

  // Setup focus trap when gallery opens
  useEffect(() => {
    if (containerRef.current) {
      const cleanup = setupFocusTrap(containerRef.current);
      return cleanup;
    }
  }, [setupFocusTrap]);

  // Keyboard handling
  useGalleryKeyboard({
    enabled: config.enableKeyboard,
    onNavigate: navigateImage,
    onZoom: handleZoom,
    onRotate: handleRotate,
    onToggleFullscreen: () => {
      if (!document.fullscreenElement) {
        containerRef.current?.requestFullscreen();
        setState(prev => ({ ...prev, isFullscreen: true }));
      } else {
        document.exitFullscreen();
        setState(prev => ({ ...prev, isFullscreen: false }));
      }
    },
    onReset: () => {
      x.set(0);
      y.set(0);
      scale.set(1);
      rotate.set(0);
      setState(prev => ({
        ...prev,
        zoom: 1,
        rotation: 0,
        position: { x: 0, y: 0 }
      }));
      resetGestures();
    },
    onClose: onClose || (() => {})
  });

  const currentImage = images[state.currentIndex];
  const showPrevButton = state.currentIndex > 0;
  const showNextButton = state.currentIndex < images.length - 1;
  const isImageLiked = liked.has(currentImage?.id || '');

  return (
    <AnimatePresence>
      <motion.div
        ref={containerRef}
        className={`${stylesV2.galleryV2} ${className || ''}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: prefersReducedMotion ? 0 : config.animationDuration / 1000 }}
        {...getGalleryProps()}
        data-high-contrast={isHighContrast}
        data-reduced-motion={prefersReducedMotion}
      >
        {/* Enhanced backdrop */}
        <motion.div 
          className={stylesV2.backdropV2}
          initial={{ backdropFilter: 'blur(0px)' }}
          animate={{ backdropFilter: 'blur(40px)' }}
          onClick={onClose}
        />

        {/* Main content */}
        <div className={styles.content} style={{
          position: 'relative',
          width: '100%',
          height: '100%'
        }}>
          {/* Modern close button */}
          <motion.button
            className={stylesV2.fabButton}
            onClick={onClose}
            whileHover={{ scale: 1.1, rotate: 90 }}
            whileTap={{ scale: 0.9 }}
            title="Close Modern Gallery (ESC) ✨"
            style={{
              position: 'absolute',
              top: '20px',
              left: '20px',
              zIndex: 1000,
              width: '48px',
              height: '48px'
            }}
            {...getControlButtonProps('Close gallery')}
          >
            <X size={24} />
          </motion.button>

          {/* Image viewer with gestures */}
          <div 
            className={stylesV2.imageContainerV2} 
            {...gestureBind()}
            style={{
              flex: '1 1 auto',
              position: 'relative',
              zIndex: 1
            }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={state.currentIndex}
                initial={{ opacity: 0, scale: 0.8, rotateY: 180 }}
                animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                exit={{ opacity: 0, scale: 0.8, rotateY: -180 }}
                transition={{ 
                  type: 'spring',
                  stiffness: 200,
                  damping: 20,
                  duration: prefersReducedMotion ? 0 : config.animationDuration / 1000 
                }}
              >
                {currentImage && (
                  <motion.img
                    ref={imageRef}
                    src={currentImage.url}
                    alt={currentImage.alt || currentImage.originalName}
                    className={stylesV2.imageV2}
                    style={{
                      x,
                      y,
                      scale,
                      rotate,
                      opacity: 1
                    }}
                    draggable={false}
                    onLoad={() => {
                      setState(prev => ({ 
                        ...prev, 
                        isLoading: false,
                        loadedImages: new Set(prev.loadedImages).add(state.currentIndex)
                      }));
                      announce(`Image ${state.currentIndex + 1} loaded`);
                    }}
                    onError={() => {
                      setState(prev => ({ 
                        ...prev, 
                        isLoading: false,
                        error: 'Failed to load image'
                      }));
                      announce('Failed to load image');
                    }}
                    {...getImageProps(state.currentIndex, images.length, currentImage.alt)}
                  />
                )}
              </motion.div>
            </AnimatePresence>

            {/* Modern navigation arrows */}
            {showPrevButton && (
              <motion.button
                className={`${stylesV2.navButtonV2} ${stylesV2.prev}`}
                onClick={() => navigateImage('prev')}
                whileHover={{ x: -5 }}
                whileTap={{ scale: 0.95 }}
                {...getNavButtonProps('prev', false)}
              >
                <ChevronLeft size={32} />
              </motion.button>
            )}
            
            {showNextButton && (
              <motion.button
                className={`${stylesV2.navButtonV2} ${stylesV2.next}`}
                onClick={() => navigateImage('next')}
                whileHover={{ x: 5 }}
                whileTap={{ scale: 0.95 }}
                {...getNavButtonProps('next', false)}
              >
                <ChevronRight size={32} />
              </motion.button>
            )}

            {/* Modern Control Panel with glass effect */}
            <motion.div 
              className={stylesV2.glassPanel}
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              style={{
                position: 'fixed',
                bottom: '40px',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 20px',
                maxWidth: 'calc(100% - 40px)',
                flexWrap: 'wrap',
                justifyContent: 'center'
              }}
            >
              {/* Like button */}
              <motion.button
                className={stylesV2.controlButtonV2}
                onClick={toggleLike}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                style={{
                  color: isImageLiked ? '#ff4757' : undefined
                }}
                {...getControlButtonProps('Like image', isImageLiked)}
              >
                <Heart size={20} fill={isImageLiked ? '#ff4757' : 'none'} />
              </motion.button>

              {/* Zoom controls */}
              {config.enableZoom && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <motion.button
                    className={stylesV2.controlButtonV2}
                    onClick={() => handleZoom(-config.zoomStep)}
                    disabled={state.zoom <= config.minZoom}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    {...getControlButtonProps('Zoom out')}
                  >
                    <ZoomOut size={20} />
                  </motion.button>
                  
                  <span style={{ 
                    minWidth: '60px', 
                    textAlign: 'center',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: 'rgba(255, 255, 255, 0.9)'
                  }}>
                    {Math.round(state.zoom * 100)}%
                  </span>
                  
                  <motion.button
                    className={stylesV2.controlButtonV2}
                    onClick={() => handleZoom(config.zoomStep)}
                    disabled={state.zoom >= config.maxZoom}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    {...getControlButtonProps('Zoom in')}
                  >
                    <ZoomIn size={20} />
                  </motion.button>
                </div>
              )}

              {/* Rotation controls */}
              {config.enableRotation && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <motion.button
                    className={stylesV2.controlButtonV2}
                    onClick={() => handleRotate(-config.rotationStep)}
                    whileHover={{ scale: 1.05, rotate: -90 }}
                    whileTap={{ scale: 0.95 }}
                    {...getControlButtonProps('Rotate left')}
                  >
                    <RotateCcw size={20} />
                  </motion.button>
                  
                  <motion.button
                    className={stylesV2.controlButtonV2}
                    onClick={() => handleRotate(config.rotationStep)}
                    whileHover={{ scale: 1.05, rotate: 90 }}
                    whileTap={{ scale: 0.95 }}
                    {...getControlButtonProps('Rotate right')}
                  >
                    <RotateCw size={20} />
                  </motion.button>
                </div>
              )}

              {/* Download button */}
              {config.enableDownload && (
                <motion.button
                  className={stylesV2.controlButtonV2}
                  onClick={async () => {
                    if (onDownload) {
                      onDownload(currentImage);
                    } else {
                      const a = document.createElement('a');
                      a.href = currentImage.url;
                      a.download = currentImage.originalName;
                      a.click();
                    }
                    triggerHaptic('medium');
                  }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  {...getControlButtonProps('Download image')}
                >
                  <Download size={20} />
                </motion.button>
              )}

              {/* Notes toggle */}
              <motion.button
                className={stylesV2.controlButtonV2}
                onClick={() => {
                  setNotesVisible(!notesVisible);
                  announce(notesVisible ? 'Notes closed' : 'Notes opened');
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                style={{
                  backgroundColor: notesVisible ? 'rgba(102, 126, 234, 0.3)' : undefined
                }}
                {...getControlButtonProps('Toggle notes', notesVisible)}
              >
                <MessageSquare size={20} />
              </motion.button>

              {/* Info button */}
              <motion.button
                className={stylesV2.controlButtonV2}
                onClick={() => setInfoVisible(!infoVisible)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                {...getControlButtonProps('Image information', infoVisible)}
              >
                <Info size={20} />
              </motion.button>

              {/* Fullscreen button */}
              {config.enableFullscreen && (
                <motion.button
                  className={stylesV2.controlButtonV2}
                  onClick={() => {
                    if (!document.fullscreenElement) {
                      containerRef.current?.requestFullscreen();
                    } else {
                      document.exitFullscreen();
                    }
                  }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  {...getControlButtonProps('Toggle fullscreen', state.isFullscreen)}
                >
                  {state.isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
                </motion.button>
              )}
            </motion.div>

            {/* Modern thumbnails */}
            {config.enableThumbnails && images.length > 1 && (
              <motion.div 
                className={stylesV2.thumbnailsV2}
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                {images.map((image, index) => (
                  <motion.button
                    key={image.id}
                    className={`${stylesV2.thumbnailV2} ${index === state.currentIndex ? stylesV2.active : ''}`}
                    onClick={() => {
                      setState(prev => ({ 
                        ...prev, 
                        currentIndex: index,
                        isLoading: true 
                      }));
                      x.set(0);
                      y.set(0);
                      scale.set(1);
                      rotate.set(0);
                      resetGestures();
                      onImageChange?.(index);
                    }}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <img 
                      src={image.thumbnailUrl || image.url} 
                      alt={`Thumbnail ${index + 1}`}
                      loading="lazy"
                    />
                    {liked.has(image.id) && (
                      <div style={{
                        position: 'absolute',
                        top: '4px',
                        right: '4px',
                        color: '#ff4757'
                      }}>
                        <Heart size={12} fill="#ff4757" />
                      </div>
                    )}
                  </motion.button>
                ))}
              </motion.div>
            )}

            {/* Loading indicator */}
            {state.isLoading && (
              <div className={stylesV2.loadingV2}>
                <div className={stylesV2.spinnerV2} />
              </div>
            )}

            {/* Image info overlay */}
            <AnimatePresence>
              {infoVisible && currentImage && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className={stylesV2.glassPanel}
                  style={{
                    position: 'absolute',
                    bottom: '140px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    padding: '16px 24px',
                    maxWidth: '400px'
                  }}
                >
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '600' }}>
                    {currentImage.originalName}
                  </h3>
                  <p style={{ margin: '0', fontSize: '14px', opacity: 0.8 }}>
                    Size: {Math.round((currentImage.fileSize || 0) / 1024)} KB
                  </p>
                  <p style={{ margin: '0', fontSize: '14px', opacity: 0.8 }}>
                    Type: {currentImage.mimeType}
                  </p>
                  {currentImage.caption && (
                    <p style={{ margin: '8px 0 0 0', fontSize: '14px' }}>
                      {currentImage.caption}
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Notes Panel */}
        <AnimatePresence>
          {notesVisible && currentImage && (
            <ImageNotesPanel
              attachmentId={currentImage.id}
              attachmentName={currentImage.originalName}
              isVisible={notesVisible}
              onToggle={() => setNotesVisible(false)}
            />
          )}
        </AnimatePresence>

        {/* Screen reader announcements */}
        <div 
          role="status" 
          aria-live="polite" 
          aria-atomic="true"
          style={{ position: 'absolute', left: '-9999px' }}
        >
          {announce}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ImageGallery;