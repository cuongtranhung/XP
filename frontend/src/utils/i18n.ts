/**
 * Core internationalization utilities
 * Supports English and Vietnamese with extensible architecture
 */

export type SupportedLocale = 'en' | 'vi';

export interface TranslationResource {
  [key: string]: string | TranslationResource;
}

export interface LocaleConfig {
  code: SupportedLocale;
  name: string;
  nativeName: string;
  flag: string;
  direction: 'ltr' | 'rtl';
  dateFormat: string;
  currency: string;
}

export const SUPPORTED_LOCALES: Record<SupportedLocale, LocaleConfig> = {
  en: {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    flag: '🇺🇸',
    direction: 'ltr',
    dateFormat: 'MM/dd/yyyy',
    currency: 'USD'
  },
  vi: {
    code: 'vi',
    name: 'Vietnamese',
    nativeName: 'Tiếng Việt',
    flag: '🇻🇳',
    direction: 'ltr',
    dateFormat: 'dd/MM/yyyy',
    currency: 'VND'
  }
};

export const DEFAULT_LOCALE: SupportedLocale = 'en';

/**
 * Storage key for persisting language preference
 */
export const LOCALE_STORAGE_KEY = 'app-locale';

/**
 * Get nested value from object using dot notation
 */
export function getNestedValue(obj: TranslationResource, path: string): string | undefined {
  return path.split('.').reduce((current: any, key: string) => {
    return current?.[key];
  }, obj) as string | undefined;
}

/**
 * Replace placeholders in translation string
 */
export function interpolate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return values[key]?.toString() || match;
  });
}

/**
 * Format number according to locale
 */
export function formatNumber(value: number, locale: SupportedLocale): string {
  return new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US').format(value);
}

/**
 * Format currency according to locale
 */
export function formatCurrency(value: number, locale: SupportedLocale): string {
  const config = SUPPORTED_LOCALES[locale];
  return new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US', {
    style: 'currency',
    currency: config.currency
  }).format(value);
}

/**
 * Format date according to locale
 */
export function formatDate(date: Date, locale: SupportedLocale): string {
  return new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-US').format(date);
}

/**
 * Detect browser language preference
 */
export function detectBrowserLocale(): SupportedLocale {
  const browserLang = navigator.language.toLowerCase();
  
  if (browserLang.startsWith('vi')) return 'vi';
  return 'en'; // Default fallback
}

/**
 * Get stored locale preference
 */
export function getStoredLocale(): SupportedLocale | null {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored && Object.keys(SUPPORTED_LOCALES).includes(stored)) {
      return stored as SupportedLocale;
    }
  } catch (error) {
    console.warn('Failed to read locale from storage:', error);
  }
  return null;
}

/**
 * Store locale preference
 */
export function setStoredLocale(locale: SupportedLocale): void {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch (error) {
    console.warn('Failed to store locale:', error);
  }
}

/**
 * Get initial locale based on storage, browser, or default
 */
export function getInitialLocale(): SupportedLocale {
  return getStoredLocale() || detectBrowserLocale() || DEFAULT_LOCALE;
}

/**
 * Validate if locale is supported
 */
export function isValidLocale(locale: string): locale is SupportedLocale {
  return Object.keys(SUPPORTED_LOCALES).includes(locale);
}