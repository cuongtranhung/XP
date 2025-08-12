import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence, useAnimation, useMotionValue, useTransform } from 'framer-motion';
import { useGesture } from '@use-gesture/react';
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
  MessageSquare
} from 'lucide-react';
import { GalleryImage, GalleryState, GalleryConfig, GalleryCallbacks } from './types';
import { useImagePreloader } from './hooks/useImagePreloader';
import { useGalleryKeyboard } from './hooks/useGalleryKeyboard';
import { ImageNotesPanel } from './ImageNotesPanel';
import styles from './ImageGallery.module.css';

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
  preloadCount: 2,
  animationDuration: 300,
  maxZoom: 4,
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

  // Notes panel state
  const [notesVisible, setNotesVisible] = useState(false);
  
  // Gallery version fixed to v2
  const galleryVersion = 'v2';

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const controls = useAnimation();

  // Motion values for smooth animations
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const scale = useMotionValue(1);
  const rotate = useMotionValue(0);

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
      
      // Reset transforms
      x.set(0);
      y.set(0);
      scale.set(1);
      rotate.set(0);
      
      onImageChange?.(newIndex);
    }
  }, [state.currentIndex, images.length, onImageChange, x, y, scale, rotate]);

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
  }, [state.zoom, config.minZoom, config.maxZoom, scale, x, y]);

  // Rotation handling
  const handleRotate = useCallback((degrees: number) => {
    const newRotation = (state.rotation + degrees) % 360;
    setState(prev => ({ ...prev, rotation: newRotation }));
    rotate.set(newRotation);
  }, [state.rotation, rotate]);

  // Reset transform
  const resetTransform = useCallback(() => {
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
  }, [x, y, scale, rotate]);

  // Fullscreen handling
  const toggleFullscreen = useCallback(() => {
    if (!config.enableFullscreen) return;
    
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setState(prev => ({ ...prev, isFullscreen: true }));
    } else {
      document.exitFullscreen();
      setState(prev => ({ ...prev, isFullscreen: false }));
    }
  }, [config.enableFullscreen]);

  // Download handling
  const handleDownload = useCallback(async () => {
    const currentImage = images[state.currentIndex];
    if (onDownload) {
      onDownload(currentImage);
    } else {
      try {
        const response = await fetch(currentImage.url);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = currentImage.originalName;
        a.click();
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error('Download failed:', error);
      }
    }
  }, [images, state.currentIndex, onDownload]);

  // Share handling
  const handleShare = useCallback(async () => {
    const currentImage = images[state.currentIndex];
    if (onShare) {
      onShare(currentImage);
    } else if (navigator.share) {
      try {
        await navigator.share({
          title: currentImage.originalName,
          text: currentImage.caption || '',
          url: window.location.href
        });
      } catch (error) {
        console.error('Share failed:', error);
      }
    } else {
      // Fallback: copy URL to clipboard
      navigator.clipboard.writeText(window.location.href);
    }
  }, [images, state.currentIndex, onShare]);

  // Notes panel handling
  const toggleNotes = useCallback(() => {
    setNotesVisible(prev => !prev);
  }, []);

  // Gesture handling
  const bind = useGesture({
    onDrag: ({ offset: [ox, oy], velocity: [vx], direction: [dx], cancel, last }) => {
      if (!config.enableTouch) return;
      
      // Swipe navigation when not zoomed
      if (state.zoom === 1) {
        if (last && Math.abs(vx) > 0.5) {
          if (dx > 0 && state.currentIndex > 0) {
            navigateImage('prev');
          } else if (dx < 0 && state.currentIndex < images.length - 1) {
            navigateImage('next');
          }
          cancel();
        }
      } else {
        // Pan when zoomed
        x.set(ox);
        y.set(oy);
        setState(prev => ({ ...prev, position: { x: ox, y: oy } }));
      }
    },
    onPinch: ({ offset: [distance] }) => {
      if (!config.enableTouch || !config.enableZoom) return;
      
      const newZoom = Math.max(config.minZoom, Math.min(config.maxZoom, distance));
      scale.set(newZoom);
      setState(prev => ({ ...prev, zoom: newZoom }));
    },
    onWheel: ({ event, delta: [, dy] }) => {
      if (!config.enableZoom) return;
      event.preventDefault();
      
      const zoomDelta = dy > 0 ? -config.zoomStep : config.zoomStep;
      handleZoom(zoomDelta);
    }
  }, {
    drag: { 
      from: () => [x.get(), y.get()],
      bounds: state.zoom > 1 ? undefined : { left: 0, right: 0, top: 0, bottom: 0 }
    },
    pinch: { from: () => [scale.get(), 0] }
  });

  // Keyboard handling
  useGalleryKeyboard({
    enabled: config.enableKeyboard,
    onNavigate: navigateImage,
    onZoom: handleZoom,
    onRotate: handleRotate,
    onToggleFullscreen: toggleFullscreen,
    onReset: resetTransform,
    onClose: onClose || (() => {})
  });

  // Listen for custom navigation events
  useEffect(() => {
    const handleNavigateTo = (e: CustomEvent) => {
      const { index } = e.detail;
      if (index >= 0 && index < images.length) {
        setState(prev => ({ 
          ...prev, 
          currentIndex: index,
          isLoading: true 
        }));
        resetTransform();
        onImageChange?.(index);
      }
    };

    window.addEventListener('gallery:navigate-to', handleNavigateTo as EventListener);
    return () => {
      window.removeEventListener('gallery:navigate-to', handleNavigateTo as EventListener);
    };
  }, [images.length, onImageChange, resetTransform]);

  const currentImage = images[state.currentIndex];
  const showPrevButton = state.currentIndex > 0;
  const showNextButton = state.currentIndex < images.length - 1;

  return (
    <AnimatePresence>
      <motion.div
        ref={containerRef}
        className={`${styles.gallery} ${className || ''}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: config.animationDuration / 1000 }}
        data-theme={config.theme}
        data-layout={config.layout}
        data-fullscreen={state.isFullscreen}
      >
        {/* Backdrop */}
        <motion.div 
          className={styles.backdrop}
          initial={{ backdropFilter: 'blur(0px)' }}
          animate={{ backdropFilter: 'blur(20px)' }}
          onClick={onClose}
        />

        {/* Main content */}
        <div className={styles.content} style={{
          position: 'relative',
          width: '100%',
          height: '100%'
        }}>
          {/* Image viewer container - Full width now */}
          <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative'
          }}>
            {/* Close button - floating - VERSION 2.0 */}
            <motion.button
              className={styles.closeButton}
              onClick={onClose}
              whileHover={{ scale: 1.1, rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              title="Close Gallery (ESC) 🔴"
              style={{
                position: 'absolute',
                top: '20px',
                left: '20px',
                zIndex: 1000,
                background: 'rgba(255, 0, 0, 0.9)',
                border: 'none',
                borderRadius: '50%',
                width: '48px',
                height: '48px',
                cursor: 'pointer',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0',
                margin: '0',
                outline: 'none',
                boxShadow: '0 4px 12px rgba(255, 0, 0, 0.3)',
                backdropFilter: 'blur(10px)'
              }}
            >
              <X 
                size={20} 
                style={{
                  strokeWidth: 2.5,
                  display: 'block'
                }}
              />
              {/* Version Badge - Always show v2 */}
              <span style={{
                position: 'absolute',
                top: '-6px',
                right: '-6px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                fontSize: '9px',
                padding: '2px 5px',
                borderRadius: '6px',
                fontWeight: 'bold',
                lineHeight: '1',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
              }}>
                v2
              </span>
            </motion.button>

            {/* Image viewer */}
            <div className={styles.viewer} {...bind()} style={{
              flex: '1 1 auto',
              position: 'relative',
              zIndex: 1
            }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={state.currentIndex}
                className={styles.imageContainer}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: config.animationDuration / 1000 }}
              >
                {currentImage && (
                  <motion.img
                    ref={imageRef}
                    src={currentImage.url}
                    alt={currentImage.alt || currentImage.originalName}
                    className={styles.image}
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
                    }}
                    onError={() => {
                      setState(prev => ({ 
                        ...prev, 
                        isLoading: false,
                        error: 'Failed to load image'
                      }));
                    }}
                  />
                )}
              </motion.div>
            </AnimatePresence>

            {/* Navigation arrows */}
            {showPrevButton && (
              <motion.button
                className={`${styles.navButton} ${styles.navPrev}`}
                onClick={() => navigateImage('prev')}
                whileHover={{ x: -5 }}
                whileTap={{ scale: 0.95 }}
                title="Previous (←)"
              >
                <ChevronLeft size={32} />
              </motion.button>
            )}
            
            {showNextButton && (
              <motion.button
                className={`${styles.navButton} ${styles.navNext}`}
                onClick={() => navigateImage('next')}
                whileHover={{ x: 5 }}
                whileTap={{ scale: 0.95 }}
                title="Next (→)"
              >
                <ChevronRight size={32} />
              </motion.button>
            )}

            {/* Control panel - Perfectly centered */}
            <motion.div 
              className={styles.controls}
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
                justifyContent: 'center',
                gap: '12px',
                background: 'rgba(0, 0, 0, 0.7)',
                borderRadius: '24px',
                padding: '12px 20px',
                backdropFilter: 'blur(15px)',
                whiteSpace: 'nowrap',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
              }}
            >
            {config.enableZoom && (
              <div className={styles.controlGroup}>
                <motion.button
                  className={styles.controlButton}
                  onClick={() => handleZoom(-config.zoomStep)}
                  disabled={state.zoom <= config.minZoom}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  title="Zoom Out (-)"
                >
                  <ZoomOut size={20} />
                </motion.button>
                
                <span className={styles.zoomLevel}>
                  {Math.round(state.zoom * 100)}%
                </span>
                
                <motion.button
                  className={styles.controlButton}
                  onClick={() => handleZoom(config.zoomStep)}
                  disabled={state.zoom >= config.maxZoom}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  title="Zoom In (+)"
                >
                  <ZoomIn size={20} />
                </motion.button>
              </div>
            )}

            {config.enableRotation && (
              <div className={styles.controlGroup}>
                <motion.button
                  className={styles.controlButton}
                  onClick={() => handleRotate(-config.rotationStep)}
                  whileHover={{ scale: 1.05, rotate: -90 }}
                  whileTap={{ scale: 0.95 }}
                  title="Rotate Left (Shift+R)"
                >
                  <RotateCcw size={20} />
                </motion.button>
                
                <motion.button
                  className={styles.controlButton}
                  onClick={() => handleRotate(config.rotationStep)}
                  whileHover={{ scale: 1.05, rotate: 90 }}
                  whileTap={{ scale: 0.95 }}
                  title="Rotate Right (R)"
                >
                  <RotateCw size={20} />
                </motion.button>
              </div>
            )}

            <motion.button
              className={`${styles.controlButton} ${styles.resetButton}`}
              onClick={resetTransform}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              title="Reset (Space)"
            >
              Reset
            </motion.button>
            
            {config.enableDownload && (
              <motion.button
                className={styles.controlButton}
                onClick={handleDownload}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                title="Download"
              >
                <Download size={20} />
              </motion.button>
            )}
            
            {/* Notes toggle button */}
            <motion.button
              className={`${styles.controlButton} ${notesVisible ? styles.active : ''}`}
              onClick={toggleNotes}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              title={notesVisible ? "Close Notes" : "Open Notes"}
              style={{
                backgroundColor: notesVisible ? 'rgba(59, 130, 246, 0.8)' : undefined,
                color: notesVisible ? 'white' : undefined
              }}
            >
              <MessageSquare size={20} />
            </motion.button>
          </motion.div>
          </div>

          {/* Thumbnails - Perfectly centered V2 */}
          {config.enableThumbnails && images.length > 1 && (
            <motion.div 
              className={styles.thumbnails}
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              style={{
                position: 'fixed',
                bottom: '110px',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 999,
                maxWidth: '90vw',
                overflowX: 'auto',
                overflowY: 'hidden',
                background: 'rgba(0, 0, 0, 0.7)',
                borderRadius: '16px',
                padding: '10px',
                backdropFilter: 'blur(15px)',
                scrollbarWidth: 'thin',
                scrollbarColor: 'rgba(255,255,255,0.4) transparent',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                display: 'flex',
                justifyContent: 'center'
              }}
            >
              <div 
                className={styles.thumbnailsInner}
                style={{
                  display: 'flex',
                  gap: '8px',
                  paddingBottom: '4px',
                  alignItems: 'center',
                  justifyContent: 'flex-start'
                }}
              >
                {images.map((image, index) => (
                  <motion.button
                    key={image.id}
                    className={`${styles.thumbnail} ${index === state.currentIndex ? styles.active : ''}`}
                    onClick={() => {
                      setState(prev => ({ 
                        ...prev, 
                        currentIndex: index,
                        isLoading: true 
                      }));
                      resetTransform();
                      onImageChange?.(index);
                    }}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    style={{
                      minWidth: '60px',
                      width: '60px',
                      height: '60px',
                      border: index === state.currentIndex ? '2px solid #3b82f6' : '1px solid rgba(255,255,255,0.3)',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      background: 'rgba(255,255,255,0.1)',
                      cursor: 'pointer',
                      flexShrink: 0
                    }}
                  >
                    <img 
                      src={image.thumbnailUrl || image.url} 
                      alt={`Thumbnail ${index + 1}`}
                      loading="lazy"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                      }}
                    />
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

            {/* Loading indicator */}
            {state.isLoading && (
              <div className={styles.loading}>
                <Loader2 className={styles.spinner} size={48} />
              </div>
            )}

            {/* Error state */}
            {state.error && (
              <motion.div 
                className={styles.error}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <p>{state.error}</p>
                <button onClick={() => setState(prev => ({ ...prev, error: null }))}>
                  Dismiss
                </button>
              </motion.div>
            )}
            </div>
          </div>

        {/* Image Notes Panel - Overlay Mode */}
        <AnimatePresence>
          {notesVisible && currentImage && (
            <>
              {/* Notes Panel - Full height right sidebar */}
              <ImageNotesPanel
                attachmentId={currentImage.id}
                attachmentName={currentImage.originalName}
                isVisible={notesVisible}
                onToggle={toggleNotes}
              />
            </>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
};

export default ImageGallery;