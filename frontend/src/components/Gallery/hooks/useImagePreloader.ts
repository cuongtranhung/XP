import { useEffect, useRef } from 'react';
import { GalleryImage } from '../types';

export const useImagePreloader = (
  images: GalleryImage[],
  currentIndex: number,
  preloadCount: number = 2
) => {
  const preloadedImages = useRef<Set<number>>(new Set());
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());

  useEffect(() => {
    const preloadImage = (image: GalleryImage, index: number) => {
      if (preloadedImages.current.has(index) || imageCache.current.has(image.url)) {
        return;
      }

      const img = new Image();
      img.src = image.url;
      
      img.onload = () => {
        preloadedImages.current.add(index);
        imageCache.current.set(image.url, img);
      };

      img.onerror = () => {
        console.error(`Failed to preload image: ${image.url}`);
      };

      // Preload thumbnail as well
      if (image.thumbnailUrl) {
        const thumb = new Image();
        thumb.src = image.thumbnailUrl;
      }
    };

    // Preload current image first
    if (images[currentIndex]) {
      preloadImage(images[currentIndex], currentIndex);
    }

    // Preload surrounding images
    for (let i = 1; i <= preloadCount; i++) {
      // Preload next images
      const nextIndex = currentIndex + i;
      if (nextIndex < images.length) {
        preloadImage(images[nextIndex], nextIndex);
      }

      // Preload previous images
      const prevIndex = currentIndex - i;
      if (prevIndex >= 0) {
        preloadImage(images[prevIndex], prevIndex);
      }
    }

    // Cleanup old cached images to prevent memory leaks
    const maxCacheSize = images.length > 20 ? 20 : images.length;
    if (imageCache.current.size > maxCacheSize) {
      const keysToDelete = Array.from(imageCache.current.keys()).slice(0, imageCache.current.size - maxCacheSize);
      keysToDelete.forEach(key => imageCache.current.delete(key));
    }
  }, [images, currentIndex, preloadCount]);

  return {
    isPreloaded: (index: number) => preloadedImages.current.has(index),
    getCachedImage: (url: string) => imageCache.current.get(url)
  };
};