// useToast Hook
// Simple wrapper around react-hot-toast for consistent toast notifications

import { toast, ToastOptions } from 'react-hot-toast';

export interface ToastHook {
  success: (message: string, options?: ToastOptions) => string;
  error: (message: string, options?: ToastOptions) => string;
  loading: (message: string, options?: ToastOptions) => string;
  info: (message: string, options?: ToastOptions) => string;
  warning: (message: string, options?: ToastOptions) => string;
  dismiss: (toastId?: string) => void;
  promise: <T>(
    promise: Promise<T>,
    msgs: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: any) => string);
    },
    options?: ToastOptions
  ) => Promise<T>;
}

export const useToast = (): ToastHook => {
  return {
    success: (message: string, options?: ToastOptions) => {
      return toast.success(message, {
        duration: 4000,
        ...options
      });
    },

    error: (message: string, options?: ToastOptions) => {
      return toast.error(message, {
        duration: 6000,
        ...options
      });
    },

    loading: (message: string, options?: ToastOptions) => {
      return toast.loading(message, options);
    },

    info: (message: string, options?: ToastOptions) => {
      return toast(message, {
        icon: 'ℹ️',
        duration: 4000,
        ...options
      });
    },

    warning: (message: string, options?: ToastOptions) => {
      return toast(message, {
        icon: '⚠️',
        duration: 5000,
        style: {
          background: '#fef3c7',
          color: '#92400e',
          border: '1px solid #fbbf24'
        },
        ...options
      });
    },

    dismiss: (toastId?: string) => {
      toast.dismiss(toastId);
    },

    promise: async <T>(
      promise: Promise<T>,
      msgs: {
        loading: string;
        success: string | ((data: T) => string);
        error: string | ((error: any) => string);
      },
      options?: ToastOptions
    ) => {
      return toast.promise(promise, msgs, {
        loading: { duration: Infinity },
        success: { duration: 4000 },
        error: { duration: 6000 },
        ...options
      });
    }
  };
};

export default useToast;