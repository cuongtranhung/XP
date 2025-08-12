/**
 * Translation Helper Utilities
 * Provides utilities for managing and working with translations
 */

import { translations } from '../locales';
import { SupportedLocale, formatNumber, formatCurrency, formatDate } from './i18n';

/**
 * Get all translation keys (useful for development and testing)
 */
export function getAllTranslationKeys(locale: SupportedLocale = 'en'): string[] {
  const keys: string[] = [];
  
  function extractKeys(obj: any, prefix = ''): void {
    Object.keys(obj).forEach(key => {
      const newKey = prefix ? `${prefix}.${key}` : key;
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        extractKeys(obj[key], newKey);
      } else {
        keys.push(newKey);
      }
    });
  }
  
  extractKeys(translations[locale]);
  return keys.sort();
}

/**
 * Find missing translation keys between locales
 */
export function findMissingTranslations(
  sourceLocale: SupportedLocale = 'en',
  targetLocale: SupportedLocale = 'vi'
): string[] {
  const sourceKeys = new Set(getAllTranslationKeys(sourceLocale));
  const targetKeys = new Set(getAllTranslationKeys(targetLocale));
  
  return Array.from(sourceKeys).filter(key => !targetKeys.has(key));
}

/**
 * Find extra translation keys (keys in target but not in source)
 */
export function findExtraTranslations(
  sourceLocale: SupportedLocale = 'en',
  targetLocale: SupportedLocale = 'vi'
): string[] {
  const sourceKeys = new Set(getAllTranslationKeys(sourceLocale));
  const targetKeys = new Set(getAllTranslationKeys(targetLocale));
  
  return Array.from(targetKeys).filter(key => !sourceKeys.has(key));
}

/**
 * Translation coverage statistics
 */
export interface TranslationCoverage {
  totalKeys: number;
  translatedKeys: number;
  missingKeys: string[];
  extraKeys: string[];
  coveragePercentage: number;
}

export function getTranslationCoverage(
  sourceLocale: SupportedLocale = 'en',
  targetLocale: SupportedLocale = 'vi'
): TranslationCoverage {
  const sourceKeys = getAllTranslationKeys(sourceLocale);
  const missingKeys = findMissingTranslations(sourceLocale, targetLocale);
  const extraKeys = findExtraTranslations(sourceLocale, targetLocale);
  
  const totalKeys = sourceKeys.length;
  const translatedKeys = totalKeys - missingKeys.length;
  const coveragePercentage = totalKeys > 0 ? (translatedKeys / totalKeys) * 100 : 0;
  
  return {
    totalKeys,
    translatedKeys,
    missingKeys,
    extraKeys,
    coveragePercentage
  };
}

/**
 * Pluralization helper (basic implementation)
 * For more complex pluralization, consider using a library like pluralize
 */
export function pluralize(
  count: number,
  singular: string,
  plural?: string,
  locale: SupportedLocale = 'en'
): string {
  if (count === 1) {
    return `1 ${singular}`;
  }
  
  const pluralForm = plural || `${singular}s`;
  const formattedCount = formatNumber(count, locale);
  
  return `${formattedCount} ${pluralForm}`;
}

/**
 * Create translation key from path
 * Useful for dynamic key generation
 */
export function createTranslationKey(...parts: string[]): string {
  return parts.filter(Boolean).join('.');
}

/**
 * Translation validation helper
 * Checks if a translation exists for a given key
 */
export function hasTranslation(key: string, locale: SupportedLocale): boolean {
  try {
    const keys = key.split('.');
    let current: any = translations[locale];
    
    for (const k of keys) {
      if (current && typeof current === 'object' && k in current) {
        current = current[k];
      } else {
        return false;
      }
    }
    
    return typeof current === 'string';
  } catch {
    return false;
  }
}

/**
 * Format relative time (simple implementation)
 */
export function formatRelativeTime(
  date: Date,
  locale: SupportedLocale = 'en'
): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return locale === 'vi' ? 'Hôm nay' : 'Today';
  } else if (diffDays === 1) {
    return locale === 'vi' ? 'Hôm qua' : 'Yesterday';
  } else if (diffDays < 7) {
    return locale === 'vi' ? `${diffDays} ngày trước` : `${diffDays} days ago`;
  } else {
    return formatDate(date, locale);
  }
}

/**
 * Create localized route path
 */
export function createLocalizedPath(path: string, locale: SupportedLocale): string {
  // For now, we're not adding locale to the path
  // But this function is ready for when we want to implement localized URLs
  return path;
}

/**
 * Development helper to log missing translations
 */
export function logMissingTranslation(key: string, locale: SupportedLocale): void {
  if (process.env.NODE_ENV === 'development') {
    console.warn(`[i18n] Missing translation: ${key} (${locale})`);
  }
}

/**
 * Create translation report for development
 */
export function createTranslationReport(): string {
  const locales = Object.keys(translations) as SupportedLocale[];
  let report = '# Translation Coverage Report\n\n';
  
  for (let i = 1; i < locales.length; i++) {
    const targetLocale = locales[i];
    const coverage = getTranslationCoverage('en', targetLocale);
    
    report += `## ${targetLocale.toUpperCase()} Coverage: ${coverage.coveragePercentage.toFixed(1)}%\n\n`;
    report += `- Total keys: ${coverage.totalKeys}\n`;
    report += `- Translated: ${coverage.translatedKeys}\n`;
    report += `- Missing: ${coverage.missingKeys.length}\n`;
    report += `- Extra: ${coverage.extraKeys.length}\n\n`;
    
    if (coverage.missingKeys.length > 0) {
      report += '### Missing Keys:\n';
      coverage.missingKeys.forEach(key => {
        report += `- ${key}\n`;
      });
      report += '\n';
    }
    
    if (coverage.extraKeys.length > 0) {
      report += '### Extra Keys:\n';
      coverage.extraKeys.forEach(key => {
        report += `- ${key}\n`;
      });
      report += '\n';
    }
  }
  
  return report;
}