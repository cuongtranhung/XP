/**
 * Higher-Order Component for Translation
 * Provides translation functions to wrapped components
 */

import React, { ComponentType } from 'react';
import { useTranslation, useFormTranslations, useI18n } from '../../contexts/I18nContext';

export interface WithTranslationProps {
  t: ReturnType<typeof useTranslation>['t'];
  locale: ReturnType<typeof useTranslation>['locale'];
  isLoading: ReturnType<typeof useTranslation>['isLoading'];
}

export interface WithFormTranslationProps extends WithTranslationProps {
  tForm: ReturnType<typeof useFormTranslations>['tForm'];
  tCommon: ReturnType<typeof useFormTranslations>['tCommon'];
  tAuth: ReturnType<typeof useFormTranslations>['tAuth'];
  tValidation: ReturnType<typeof useFormTranslations>['tValidation'];
}

export interface WithI18nProps extends WithTranslationProps {
  setLocale: ReturnType<typeof useI18n>['setLocale'];
  supportedLocales: ReturnType<typeof useI18n>['supportedLocales'];
  formatMessage: ReturnType<typeof useI18n>['formatMessage'];
}

/**
 * HOC that provides basic translation functionality
 */
export function withTranslation<P extends WithTranslationProps>(
  Component: ComponentType<P>
) {
  const WrappedComponent = (props: Omit<P, keyof WithTranslationProps>) => {
    const { t, locale, isLoading } = useTranslation();

    return (
      <Component
        {...(props as P)}
        t={t}
        locale={locale}
        isLoading={isLoading}
      />
    );
  };

  WrappedComponent.displayName = `withTranslation(${Component.displayName || Component.name})`;
  return WrappedComponent;
}

/**
 * HOC that provides form-specific translation functionality
 */
export function withFormTranslation<P extends WithFormTranslationProps>(
  Component: ComponentType<P>
) {
  const WrappedComponent = (props: Omit<P, keyof WithFormTranslationProps>) => {
    const { t, tForm, tCommon, tAuth, tValidation, locale, isLoading } = useFormTranslations();

    return (
      <Component
        {...(props as P)}
        t={t}
        tForm={tForm}
        tCommon={tCommon}
        tAuth={tAuth}
        tValidation={tValidation}
        locale={locale}
        isLoading={isLoading}
      />
    );
  };

  WrappedComponent.displayName = `withFormTranslation(${Component.displayName || Component.name})`;
  return WrappedComponent;
}

/**
 * HOC that provides full i18n functionality including locale switching
 */
export function withI18n<P extends WithI18nProps>(
  Component: ComponentType<P>
) {
  const WrappedComponent = (props: Omit<P, keyof WithI18nProps>) => {
    const { t, locale, setLocale, formatMessage, supportedLocales, isLoading } = useI18n();

    return (
      <Component
        {...(props as P)}
        t={t}
        locale={locale}
        setLocale={setLocale}
        formatMessage={formatMessage}
        supportedLocales={supportedLocales}
        isLoading={isLoading}
      />
    );
  };

  WrappedComponent.displayName = `withI18n(${Component.displayName || Component.name})`;
  return WrappedComponent;
}