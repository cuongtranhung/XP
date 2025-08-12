/**
 * Skip Links Component
 * Provides keyboard navigation shortcuts for screen reader users
 * WCAG 2.1 Criterion 2.4.1 - Bypass Blocks (Level A)
 */

import React from 'react';

interface SkipLinksProps {
  mainContentId?: string;
  navigationId?: string;
  searchId?: string;
}

export const SkipLinks: React.FC<SkipLinksProps> = ({
  mainContentId = 'main-content',
  navigationId = 'main-navigation',
  searchId = 'search'
}) => {
  return (
    <div className="skip-links">
      <a href={`#${mainContentId}`} className="skip-link">
        Skip to main content
      </a>
      <a href={`#${navigationId}`} className="skip-link">
        Skip to navigation
      </a>
      <a href={`#${searchId}`} className="skip-link">
        Skip to search
      </a>
      
      <style>{`
        .skip-links {
          position: absolute;
          top: -40px;
          left: 0;
          background: #000;
          color: #fff;
          padding: 8px;
          text-decoration: none;
          z-index: 100000;
        }
        
        .skip-link {
          position: absolute;
          left: -10000px;
          top: auto;
          width: 1px;
          height: 1px;
          overflow: hidden;
          color: #fff;
          background: #000;
          padding: 0.5rem 1rem;
          text-decoration: none;
          border-radius: 0 0 4px 0;
          z-index: 100000;
        }
        
        .skip-link:focus {
          position: fixed;
          left: 0;
          top: 0;
          width: auto;
          height: auto;
          overflow: visible;
        }
      `}</style>
    </div>
  );
};