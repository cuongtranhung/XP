/**
 * Internationalization Context
 * Provides language switching and translation functionality
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  SupportedLocale, 
  TranslationResource,
  getInitialLocale, 
  setStoredLocale,
  isValidLocale,
  SUPPORTED_LOCALES
} from '../utils/i18n';
import { translations, TranslationKeys } from '../locales';

interface I18nContextValue {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
  formatMessage: (key: string, values?: Record<string, string | number>) => string;
  isLoading: boolean;
  supportedLocales: typeof SUPPORTED_LOCALES;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

export interface I18nProviderProps {
  children: ReactNode;
  fallbackLocale?: SupportedLocale;
  onLocaleChange?: (locale: SupportedLocale) => void;
}

/**
 * I18n Provider Component
 * Manages locale state and provides translation functions
 */
export const I18nProvider: React.FC<I18nProviderProps> = ({
  children,
  fallbackLocale = 'en',
  onLocaleChange
}) => {
  const [locale, setLocaleState] = useState<SupportedLocale>(getInitialLocale());
  const [isLoading, setIsLoading] = useState(false);

  // Handle locale change
  const setLocale = (newLocale: SupportedLocale) => {
    if (!isValidLocale(newLocale)) {
      console.warn(`Invalid locale: ${newLocale}, falling back to ${fallbackLocale}`);
      newLocale = fallbackLocale;
    }

    setIsLoading(true);
    setLocaleState(newLocale);
    setStoredLocale(newLocale);
    
    // Update document language
    document.documentElement.lang = newLocale;
    
    // Call external callback if provided
    onLocaleChange?.(newLocale);
    
    // Simulate loading for potential async translation loading
    setTimeout(() => setIsLoading(false), 100);
  };

  // Initialize document language on mount
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = SUPPORTED_LOCALES[locale].direction;
  }, [locale]);

  // Get nested translation value
  const getNestedValue = (obj: TranslationResource, path: string): string | undefined => {
    return path.split('.').reduce((current: any, key: string) => {
      return current?.[key];
    }, obj) as string | undefined;
  };

  // Interpolate values in translation string
  const interpolate = (template: string, values: Record<string, string | number> = {}): string => {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return values[key]?.toString() || match;
    });
  };

  // Main translation function
  const t = (key: string, values: Record<string, string | number> = {}): string => {
    try {
      const currentTranslations = translations[locale] as TranslationKeys;
      const fallbackTranslations = translations[fallbackLocale] as TranslationKeys;
      
      // Try current locale first
      let translation = getNestedValue(currentTranslations, key);
      
      // Fall back to fallback locale if not found
      if (!translation && locale !== fallbackLocale) {
        translation = getNestedValue(fallbackTranslations, key);
      }
      
      // Return key if no translation found (useful for development)
      if (!translation) {
        console.warn(`Translation missing for key: ${key} in locale: ${locale}`);
        return key;
      }
      
      // Interpolate values if provided
      return Object.keys(values).length > 0 ? interpolate(translation, values) : translation;
    } catch (error) {
      console.error(`Translation error for key: ${key}`, error);
      return key;
    }
  };

  // Alias for t function (some prefer formatMessage)
  const formatMessage = t;

  const contextValue: I18nContextValue = {
    locale,
    setLocale,
    t,
    formatMessage,
    isLoading,
    supportedLocales: SUPPORTED_LOCALES
  };

  return (
    <I18nContext.Provider value={contextValue}>
      {children}
    </I18nContext.Provider>
  );
};

/**
 * Hook to use i18n functionality
 * Must be used within I18nProvider
 */
export const useI18n = (): I18nContextValue => {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};

/**
 * Hook for translation function only (most common use case)
 */
export const useTranslation = () => {
  const { t, locale, isLoading } = useI18n();
  return { t, locale, isLoading };
};

/**
 * Hook for form-specific translations
 * Provides shortcuts for common form translation patterns
 */
export const useFormTranslations = () => {
  const { t, locale, isLoading } = useI18n();
  
  const tForm = (key: string, values?: Record<string, string | number>) => t(`forms.${key}`, values);
  const tCommon = (key: string, values?: Record<string, string | number>) => t(`common.${key}`, values);
  const tAuth = (key: string, values?: Record<string, string | number>) => t(`auth.${key}`, values);
  const tValidation = (key: string, values?: Record<string, string | number>) => t(`common.validation.${key}`, values);
  
  return {
    t,
    tForm,
    tCommon,
    tAuth,
    tValidation,
    locale,
    isLoading
  };
};

export default I18nContext;