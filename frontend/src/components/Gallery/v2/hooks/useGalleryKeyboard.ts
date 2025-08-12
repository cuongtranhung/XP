import { useEffect } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';

interface UseGalleryKeyboardProps {
  enabled: boolean;
  onNavigate: (direction: 'prev' | 'next') => void;
  onZoom: (delta: number) => void;
  onRotate: (degrees: number) => void;
  onToggleFullscreen: () => void;
  onReset: () => void;
  onClose: () => void;
}

export const useGalleryKeyboard = ({
  enabled,
  onNavigate,
  onZoom,
  onRotate,
  onToggleFullscreen,
  onReset,
  onClose
}: UseGalleryKeyboardProps) => {
  // Navigation
  useHotkeys('left,a', () => onNavigate('prev'), { enabled }, [onNavigate]);
  useHotkeys('right,d', () => onNavigate('next'), { enabled }, [onNavigate]);
  
  // Zoom
  useHotkeys('up,w,+,=', () => onZoom(0.25), { enabled }, [onZoom]);
  useHotkeys('down,s,-,_', () => onZoom(-0.25), { enabled }, [onZoom]);
  
  // Rotation
  useHotkeys('r', () => onRotate(90), { enabled }, [onRotate]);
  useHotkeys('shift+r', () => onRotate(-90), { enabled }, [onRotate]);
  
  // Fullscreen
  useHotkeys('f', onToggleFullscreen, { enabled }, [onToggleFullscreen]);
  
  // Reset
  useHotkeys('space', (e) => {
    e.preventDefault();
    onReset();
  }, { enabled }, [onReset]);
  
  // Close
  useHotkeys('escape', onClose, { enabled }, [onClose]);

  // Number keys for quick navigation
  for (let i = 1; i <= 9; i++) {
    useHotkeys(`${i}`, () => {
      // Navigate to image at index i-1
      const event = new CustomEvent('gallery:navigate-to', { detail: { index: i - 1 } });
      window.dispatchEvent(event);
    }, { enabled }, []);
  }

  return null;
};