import en from './en';
import vi from './vi';

export const translations = {
  en,
  vi
};

export type TranslationKeys = typeof en;
export type LanguageCode = keyof typeof translations;