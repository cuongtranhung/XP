import React, { useState, useEffect } from 'react';
import apiService from '../../services/api';

interface AuthenticatedImageProps {
  src: string;
  alt: string;
  className?: string;
  fallback?: React.ReactNode;
  onError?: () => void;
}

export const AuthenticatedImage: React.FC<AuthenticatedImageProps> = ({
  src,
  alt,
  className = '',
  fallback,
  onError
}) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const loadImage = async () => {
      try {
        setLoading(true);
        setError(false);

        // If src is already a blob URL or data URL, use it directly
        if (src.startsWith('blob:') || src.startsWith('data:')) {
          setImageUrl(src);
          setLoading(false);
          return;
        }

        // Extract attachment ID from URL like /api/comment-attachments/123/download
        const match = src.match(/\/api\/comment-attachments\/([^\/]+)\/download/);
        if (!match) {
          // Not a comment attachment URL, use as is
          setImageUrl(src);
          setLoading(false);
          return;
        }

        const attachmentId = match[1];
        
        // Fetch the image with authentication
        const response = await apiService.get(`/api/comment-attachments/${attachmentId}/download`, {
          responseType: 'json'
        });

        if (response.data.success && response.data.downloadUrl) {
          // Use the presigned URL directly
          setImageUrl(response.data.downloadUrl);
        } else {
          throw new Error('Failed to get download URL');
        }
      } catch (err) {
        console.error('Failed to load authenticated image:', err);
        setError(true);
        onError?.();
      } finally {
        setLoading(false);
      }
    };

    loadImage();
  }, [src, onError]);

  if (loading) {
    return (
      <div className={`${className} bg-gray-100 animate-pulse flex items-center justify-center`}>
        <div className="text-gray-400 text-xs">Loading...</div>
      </div>
    );
  }

  if (error || !imageUrl) {
    if (fallback) {
      return <>{fallback}</>;
    }
    return (
      <div className={`${className} bg-gray-100 flex items-center justify-center`}>
        <div className="text-gray-400 text-xs">IMG</div>
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={alt}
      className={className}
      onError={() => {
        setError(true);
        onError?.();
      }}
    />
  );
};