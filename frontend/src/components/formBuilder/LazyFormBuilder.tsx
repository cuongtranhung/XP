/**
 * Lazy Form Builder Components
 * Splits heavy form builder components into separate bundles
 */

import React, { lazy, Suspense } from 'react';

// Loading component for form builder sections
const SectionLoader: React.FC = () => (
  <div className="flex items-center justify-center p-8">
    <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
  </div>
);

// Lazy load form builder components
export const LazyFormCanvas = lazy(() => import('./FormCanvas'));
export const LazyFormPreview = lazy(() => import('./FormPreview'));
export const LazyFormSettings = lazy(() => import('./FormSettings'));
export const LazyWebhookSettings = lazy(() => import('./WebhookSettings'));

// Wrapper components with Suspense
export const FormCanvasLazy: React.FC = () => (
  <Suspense fallback={<SectionLoader />}>
    <LazyFormCanvas />
  </Suspense>
);

export const FormPreviewLazy: React.FC = () => (
  <Suspense fallback={<SectionLoader />}>
    <LazyFormPreview />
  </Suspense>
);

export const FormSettingsLazy: React.FC = () => (
  <Suspense fallback={<SectionLoader />}>
    <LazyFormSettings />
  </Suspense>
);

interface WebhookSettingsLazyProps {
  formId: string;
}

export const WebhookSettingsLazy: React.FC<WebhookSettingsLazyProps> = ({ formId }) => (
  <Suspense fallback={<SectionLoader />}>
    <LazyWebhookSettings formId={formId} />
  </Suspense>
);