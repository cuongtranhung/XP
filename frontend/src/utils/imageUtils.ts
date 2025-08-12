// Image processing utilities for avatar optimization

interface ImageOptimizationOptions {
  maxWidth: number;
  maxHeight: number;
  quality: number; // 0-1, for JPEG compression
  format: 'jpeg' | 'png' | 'webp';
}

// Default avatar optimization settings
export const AVATAR_STANDARDS: ImageOptimizationOptions = {
  maxWidth: 200,
  maxHeight: 200,
  quality: 0.8, // 80% quality
  format: 'jpeg'
};

/**
 * Resize and compress an image file to meet avatar standards
 * @param file - Original image file
 * @param options - Optimization options (optional, uses AVATAR_STANDARDS by default)
 * @returns Promise<string> - Optimized base64 data URL
 */
export const optimizeImageForAvatar = (
  file: File, 
  options: Partial<ImageOptimizationOptions> = {}
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const opts = { ...AVATAR_STANDARDS, ...options };
    
    // Create image element
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      reject(new Error('Cannot get canvas context'));
      return;
    }

    img.onload = () => {
      try {
        // Calculate new dimensions while maintaining aspect ratio
        const { width: newWidth, height: newHeight } = calculateNewDimensions(
          img.width,
          img.height,
          opts.maxWidth,
          opts.maxHeight
        );

        // Set canvas dimensions
        canvas.width = newWidth;
        canvas.height = newHeight;

        // Draw and resize image
        ctx.drawImage(img, 0, 0, newWidth, newHeight);

        // Convert to optimized format
        const mimeType = `image/${opts.format}`;
        const quality = opts.format === 'jpeg' ? opts.quality : undefined;
        
        const optimizedDataUrl = canvas.toDataURL(mimeType, quality);
        
        console.log(`🖼️ Image optimized: ${img.width}x${img.height} → ${newWidth}x${newHeight}`);
        console.log(`📦 Size reduced: ${file.size} bytes → ${getBase64Size(optimizedDataUrl)} bytes`);
        
        resolve(optimizedDataUrl);
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    // Load image from file
    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    reader.readAsDataURL(file);
  });
};

/**
 * Calculate new dimensions while maintaining aspect ratio
 */
const calculateNewDimensions = (
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } => {
  let { width, height } = { width: originalWidth, height: originalHeight };

  // If image is smaller than max dimensions, keep original size
  if (width <= maxWidth && height <= maxHeight) {
    return { width, height };
  }

  // Calculate aspect ratio
  const aspectRatio = width / height;

  // Determine which dimension to constrain
  if (width > height) {
    // Landscape or square
    width = Math.min(width, maxWidth);
    height = width / aspectRatio;
    
    // Check if height exceeds max
    if (height > maxHeight) {
      height = maxHeight;
      width = height * aspectRatio;
    }
  } else {
    // Portrait
    height = Math.min(height, maxHeight);
    width = height * aspectRatio;
    
    // Check if width exceeds max
    if (width > maxWidth) {
      width = maxWidth;
      height = width / aspectRatio;
    }
  }

  return {
    width: Math.round(width),
    height: Math.round(height)
  };
};

/**
 * Estimate file size from base64 data URL
 */
const getBase64Size = (dataUrl: string): number => {
  // Remove data URL prefix
  const base64String = dataUrl.split(',')[1] || '';
  
  // Base64 encoding adds ~33% overhead, so actual size is ~75% of base64 length
  return Math.round(base64String.length * 0.75);
};

/**
 * Validate if image meets avatar requirements
 */
export const validateAvatarImage = (file: File): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  // Check file type
  if (!file.type.startsWith('image/')) {
    errors.push('File must be an image');
  }

  // Check supported formats
  const supportedFormats = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  if (!supportedFormats.includes(file.type.toLowerCase())) {
    errors.push('Supported formats: JPEG, PNG, WebP, GIF');
  }

  // Check file size (max 10MB for input, will be compressed)
  const maxInputSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxInputSize) {
    errors.push('File size must be less than 10MB');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Get image dimensions from file
 */
export const getImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight
      });
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };
    
    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    reader.readAsDataURL(file);
  });
};