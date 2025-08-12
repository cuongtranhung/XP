import React, { useState } from 'react';

interface AvatarProps {
  src?: string | null;
  alt?: string;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const Avatar: React.FC<AvatarProps> = ({
  src,
  alt = 'Avatar',
  name = '',
  size = 'md',
  className = '',
}) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  const sizeClasses = {
    xs: 'w-6 h-6 text-xs',
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-12 h-12 text-lg',
    xl: 'w-16 h-16 text-xl',
  };

  const getInitials = (fullName: string) => {
    if (!fullName) return '';
    return fullName
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  const baseClasses = `inline-flex items-center justify-center rounded-full overflow-hidden ${sizeClasses[size]} ${className}`;

  const handleImageLoad = () => {
    setImageLoading(false);
    setImageError(false);
  };

  const handleImageError = () => {
    setImageLoading(false);
    setImageError(true);
    console.log('Avatar image failed to load:', src?.substring(0, 100));
  };

  // Show image if src exists, hasn't errored, and is valid
  if (src && src.trim() && !imageError) {
    return (
      <div className={`${baseClasses} relative`}>
        <img
          src={src}
          alt={alt}
          className={`w-full h-full object-cover rounded-full ${imageLoading ? 'opacity-0' : 'opacity-100'}`}
          onLoad={handleImageLoad}
          onError={handleImageError}
          style={{ transition: 'opacity 0.3s ease' }}
        />
        {imageLoading && (
          <div className="absolute inset-0 bg-gray-100 rounded-full flex items-center justify-center">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-gray-600"></div>
          </div>
        )}
      </div>
    );
  }

  // Fallback to initials
  const initials = getInitials(name);
  
  return (
    <div className={`${baseClasses} bg-gray-100 border border-gray-300 text-gray-600 font-medium`}>
      {initials || (
        <svg className="w-1/2 h-1/2 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
        </svg>
      )}
    </div>
  );
};

export default Avatar;