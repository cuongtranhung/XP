import React, { useState, useEffect, useRef, memo } from 'react';
import { useIntersectionObserver } from '../../hooks/usePerformance';

interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  placeholder?: string;
  blur?: boolean;
  priority?: boolean;
  onLoad?: () => void;
  onError?: () => void;
}

/**
 * Optimized image component with lazy loading, blur placeholder, and WebP support
 */
const OptimizedImageComponent: React.FC<OptimizedImageProps> = ({
  src,
  placeholder,
  blur = true,
  priority = false,
  onLoad,
  onError,
  className = '',
  alt = '',
  ...props
}) => {
  const [imageSrc, setImageSrc] = useState<string>(
    placeholder || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"%3E%3Crect width="1" height="1" fill="%23f3f4f6"/%3E%3C/svg%3E'
  );
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const isVisible = useIntersectionObserver(imgRef, { threshold: 0.01 });
  
  useEffect(() => {
    // Load immediately if priority or already visible
    if (!priority && !isVisible) return;
    
    // Create new image to preload
    const img = new Image();
    
    // Try WebP format first if supported
    const supportsWebP = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      return canvas.toDataURL('image/webp').indexOf('image/webp') === 5;
    };
    
    // Convert image URL to WebP if not already and if supported
    let optimizedSrc = src;
    if (supportsWebP() && !src.includes('.webp') && !src.includes('data:')) {
      // For local images, try WebP version
      optimizedSrc = src.replace(/\.(jpg|jpeg|png)$/i, '.webp');
    }
    
    img.onload = () => {
      setImageSrc(optimizedSrc);
      setIsLoaded(true);
      setHasError(false);
      onLoad?.();
    };
    
    img.onerror = () => {
      // Fallback to original source if WebP fails
      if (optimizedSrc !== src) {
        img.src = src;
      } else {
        setHasError(true);
        onError?.();
      }
    };
    
    img.src = optimizedSrc;
    
    // Set loading priority
    if (priority && imgRef.current) {
      imgRef.current.loading = 'eager';
      imgRef.current.fetchPriority = 'high';
    }
  }, [src, isVisible, priority, onLoad, onError]);
  
  // Error fallback
  if (hasError) {
    return (
      <div 
        className={`bg-gray-200 flex items-center justify-center ${className}`}
        style={{ aspectRatio: '16/9' }}
      >
        <svg 
          className="w-12 h-12 text-gray-400"
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" 
          />
        </svg>
      </div>
    );
  }
  
  return (
    <div className={`relative ${className}`}>
      <img
        ref={imgRef}
        src={imageSrc}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        className={`
          transition-all duration-300
          ${blur && !isLoaded ? 'filter blur-lg scale-110' : ''}
          ${isLoaded ? 'opacity-100' : 'opacity-0'}
          ${className}
        `}
        {...props}
      />
      
      {/* Skeleton loader */}
      {!isLoaded && (
        <div 
          className="absolute inset-0 bg-gray-200 animate-pulse"
          style={{ zIndex: -1 }}
        />
      )}
    </div>
  );
};

// Export memoized component
export const OptimizedImage = memo(OptimizedImageComponent);

// Responsive image component with srcset
export const ResponsiveImage = memo(function ResponsiveImage({
  src,
  alt = '',
  sizes = '100vw',
  className = '',
  ...props
}: {
  src: string;
  alt?: string;
  sizes?: string;
  className?: string;
} & React.ImgHTMLAttributes<HTMLImageElement>) {
  // Generate srcset for different resolutions
  const generateSrcSet = (baseSrc: string) => {
    const widths = [320, 640, 768, 1024, 1280, 1536];
    const srcSet = widths
      .map(w => {
        // For local images, assume they have size variants
        const sizedSrc = baseSrc.replace(/(\.[^.]+)$/, `-${w}w$1`);
        return `${sizedSrc} ${w}w`;
      })
      .join(', ');
    
    return srcSet;
  };
  
  return (
    <OptimizedImage
      src={src}
      alt={alt}
      srcSet={generateSrcSet(src)}
      sizes={sizes}
      className={className}
      {...props}
    />
  );
});

export default OptimizedImage;