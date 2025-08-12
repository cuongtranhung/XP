import React, { useState, useRef } from 'react';
import Button from './Button';
import { optimizeImageForAvatar, validateAvatarImage, getImageDimensions, AVATAR_STANDARDS } from '../../utils/imageUtils';

interface AvatarUploadProps {
  currentAvatar?: string | null;
  onImageChange: (file: File | null, optimizedDataUrl?: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
  className?: string;
}

const AvatarUpload: React.FC<AvatarUploadProps> = ({
  currentAvatar,
  onImageChange,
  isLoading = false,
  disabled = false,
  className = '',
}) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentAvatar || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = () => {
    if (disabled || isLoading) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    
    if (!file) return;

    try {
      // Validate image
      const validation = validateAvatarImage(file);
      if (!validation.valid) {
        alert(`Invalid image:\n${validation.errors.join('\n')}`);
        return;
      }

      // Get original dimensions for info
      const originalDimensions = await getImageDimensions(file);
      console.log(`📸 Original image: ${originalDimensions.width}x${originalDimensions.height} (${Math.round(file.size / 1024)}KB)`);

      // Optimize image
      const optimizedDataUrl = await optimizeImageForAvatar(file);
      
      // Set preview to optimized image
      setPreviewUrl(optimizedDataUrl);

      // Calculate compression ratio
      const originalSize = file.size;
      const optimizedSize = Math.round(optimizedDataUrl.length * 0.75); // Approximate base64 to bytes
      const compressionRatio = Math.round((1 - optimizedSize / originalSize) * 100);
      
      console.log(`✅ Avatar optimized: ${compressionRatio}% size reduction`);
      console.log(`📏 Final dimensions: ${AVATAR_STANDARDS.maxWidth}x${AVATAR_STANDARDS.maxHeight}`);
      console.log(`💾 Final size: ~${Math.round(optimizedSize / 1024)}KB`);

      // Pass both original file and optimized data URL
      onImageChange(file, optimizedDataUrl);

    } catch (error) {
      console.error('Image optimization failed:', error);
      alert('Failed to process image. Please try a different image.');
    }
  };

  const handleRemoveAvatar = () => {
    if (disabled || isLoading) return;
    
    setPreviewUrl(null);
    onImageChange(null, undefined);
    
    // Clear the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return '';
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  return (
    <div className={`flex flex-col items-center space-y-4 ${className}`}>
      {/* Avatar Preview */}
      <div className="relative">
        <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-200 border-2 border-gray-300">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Avatar preview"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-500 text-xl font-medium">
              {getInitials(currentAvatar || '')}
            </div>
          )}
        </div>
        
        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-white bg-opacity-75 rounded-full flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        )}
      </div>

      {/* Upload Controls */}
      <div className="flex space-x-2">
        <Button
          type="button"
          onClick={handleFileSelect}
          disabled={disabled || isLoading}
          variant="outline"
          size="sm"
        >
          {previewUrl ? 'Change' : 'Upload'} Photo
        </Button>
        
        {previewUrl && (
          <Button
            type="button"
            onClick={handleRemoveAvatar}
            disabled={disabled || isLoading}
            variant="outline"
            size="sm"
            className="text-red-600 hover:text-red-700 border-red-300 hover:border-red-400"
          >
            Remove
          </Button>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled || isLoading}
      />

      {/* Help text */}
      <p className="text-sm text-gray-500 text-center max-w-xs">
        Upload a profile photo. Images will be automatically resized to 200x200 pixels and optimized. 
        Supported formats: JPEG, PNG, WebP, GIF. Max upload size: 10MB.
      </p>
    </div>
  );
};

export default AvatarUpload;