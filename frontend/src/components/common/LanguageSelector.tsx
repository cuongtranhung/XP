/**
 * Language Selector Component
 * Allows users to switch between supported languages
 */

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Globe, Check } from '../icons';
import { useI18n } from '../../contexts/I18nContext';
import { SupportedLocale } from '../../utils/i18n';

export interface LanguageSelectorProps {
  variant?: 'default' | 'compact' | 'icon-only' | 'dropdown';
  showFlag?: boolean;
  showNativeName?: boolean;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  placement?: 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end';
}

/**
 * Language Selector Component
 */
const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  variant = 'default',
  showFlag = true,
  showNativeName = true,
  className = '',
  buttonClassName = '',
  menuClassName = '',
  placement = 'bottom-end'
}) => {
  const { locale, setLocale, supportedLocales, t, isLoading } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const localeOptions = Object.values(supportedLocales);
  const currentLocaleConfig = supportedLocales[locale];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setFocusedIndex(-1);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
    
    // Return cleanup function even when not open
    return () => {};
  }, [isOpen]);

  // Keyboard navigation
  const handleKeyDown = (event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'Escape':
        setIsOpen(false);
        setFocusedIndex(-1);
        buttonRef.current?.focus();
        break;
      case 'ArrowDown':
        event.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
          setFocusedIndex(0);
        } else {
          setFocusedIndex((prev) => (prev + 1) % localeOptions.length);
        }
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
          setFocusedIndex(localeOptions.length - 1);
        } else {
          setFocusedIndex((prev) => (prev - 1 + localeOptions.length) % localeOptions.length);
        }
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
          setFocusedIndex(0);
        } else if (focusedIndex >= 0) {
          handleLocaleChange(localeOptions[focusedIndex].code);
        }
        break;
    }
  };

  const handleLocaleChange = (newLocale: SupportedLocale) => {
    setLocale(newLocale);
    setIsOpen(false);
    setFocusedIndex(-1);
    buttonRef.current?.focus();
  };

  const getButtonContent = () => {
    switch (variant) {
      case 'icon-only':
        return (
          <>
            <Globe className="w-4 h-4" />
            <span className="sr-only">{t('common.ui.selectLanguage')}</span>
          </>
        );
      case 'compact':
        return (
          <>
            {showFlag && <span className="text-sm">{currentLocaleConfig.flag}</span>}
            <span className="text-sm font-medium">{currentLocaleConfig.code.toUpperCase()}</span>
            <ChevronDown className="w-3 h-3 text-gray-400" />
          </>
        );
      default:
        return (
          <>
            {showFlag && <span className="text-sm">{currentLocaleConfig.flag}</span>}
            <span className="text-sm font-medium">
              {showNativeName ? currentLocaleConfig.nativeName : currentLocaleConfig.name}
            </span>
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </>
        );
    }
  };

  const getMenuPlacement = () => {
    const baseClasses = 'absolute z-50 mt-1 min-w-max';
    switch (placement) {
      case 'bottom-start':
        return `${baseClasses} left-0 top-full`;
      case 'bottom-end':
        return `${baseClasses} right-0 top-full`;
      case 'top-start':
        return `${baseClasses} left-0 bottom-full mb-1`;
      case 'top-end':
        return `${baseClasses} right-0 bottom-full mb-1`;
      default:
        return `${baseClasses} right-0 top-full`;
    }
  };

  if (variant === 'dropdown') {
    return (
      <div className={`relative ${className}`}>
        <select
          value={locale}
          onChange={(e) => handleLocaleChange(e.target.value as SupportedLocale)}
          disabled={isLoading}
          className={`
            appearance-none bg-white border border-gray-300 rounded-md px-3 py-2 text-sm
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
            disabled:opacity-50 disabled:cursor-not-allowed
            ${buttonClassName}
          `}
        >
          {localeOptions.map((option) => (
            <option key={option.code} value={option.code}>
              {showFlag && `${option.flag} `}
              {showNativeName ? option.nativeName : option.name}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        disabled={isLoading}
        className={`
          inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700
          bg-white border border-gray-300 rounded-md shadow-sm
          hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-colors duration-200
          ${variant === 'icon-only' ? 'p-2' : ''}
          ${buttonClassName}
        `}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={t('common.ui.selectLanguage')}
      >
        {getButtonContent()}
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          className={`
            ${getMenuPlacement()}
            bg-white border border-gray-200 rounded-md shadow-lg py-1
            focus:outline-none
            ${menuClassName}
          `}
          role="listbox"
          aria-label={t('common.ui.selectLanguage')}
        >
          {localeOptions.map((option, index) => (
            <button
              key={option.code}
              type="button"
              onClick={() => handleLocaleChange(option.code)}
              className={`
                w-full text-left px-4 py-2 text-sm flex items-center gap-3
                hover:bg-gray-100 focus:bg-gray-100 focus:outline-none
                transition-colors duration-150
                ${focusedIndex === index ? 'bg-gray-100' : ''}
                ${locale === option.code ? 'text-blue-600 bg-blue-50' : 'text-gray-700'}
              `}
              role="option"
              aria-selected={locale === option.code}
            >
              {showFlag && <span className="text-base">{option.flag}</span>}
              <span className="flex-1">
                {showNativeName ? option.nativeName : option.name}
              </span>
              {locale === option.code && (
                <Check className="w-4 h-4 text-blue-600" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LanguageSelector;