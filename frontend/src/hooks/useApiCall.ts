import { useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';

interface ApiCallState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

interface UseApiCallOptions {
  showSuccessToast?: boolean;
  showErrorToast?: boolean;
  successMessage?: string;
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
}

export function useApiCall<T = any>(
  initialData: T | null = null,
  options: UseApiCallOptions = {}
) {
  const {
    showSuccessToast = false,
    showErrorToast = true,
    successMessage = 'Thao tác thành công',
    onSuccess,
    onError
  } = options;

  const [state, setState] = useState<ApiCallState<T>>({
    data: initialData,
    loading: false,
    error: null
  });

  const execute = useCallback(async (apiFunction: () => Promise<T>) => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      const result = await apiFunction();
      
      setState({ data: result, loading: false, error: null });
      
      if (showSuccessToast) {
        toast.success(successMessage);
      }
      
      onSuccess?.(result);
      
      return result;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error('Unknown error occurred');
      
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        error: errorObj 
      }));
      
      if (showErrorToast) {
        const errorMessage = getErrorMessage(errorObj);
        toast.error(errorMessage);
      }
      
      onError?.(errorObj);
      
      throw errorObj;
    }
  }, [showSuccessToast, showErrorToast, successMessage, onSuccess, onError]);

  const reset = useCallback(() => {
    setState({
      data: initialData,
      loading: false,
      error: null
    });
  }, [initialData]);

  return {
    ...state,
    execute,
    reset
  };
}

// Utility function to extract meaningful error messages
function getErrorMessage(error: Error): string {
  if (error.message) {
    // Handle common API error patterns
    if (error.message.includes('Network Error') || error.message.includes('fetch')) {
      return 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng.';
    }
    
    if (error.message.includes('401') || error.message.includes('Unauthorized')) {
      return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
    }
    
    if (error.message.includes('403') || error.message.includes('Forbidden')) {
      return 'Bạn không có quyền thực hiện thao tác này.';
    }
    
    if (error.message.includes('404') || error.message.includes('Not Found')) {
      return 'Không tìm thấy dữ liệu yêu cầu.';
    }
    
    if (error.message.includes('500') || error.message.includes('Internal Server Error')) {
      return 'Lỗi máy chủ nội bộ. Vui lòng thử lại sau.';
    }
    
    return error.message;
  }
  
  return 'Đã xảy ra lỗi không xác định. Vui lòng thử lại.';
}

export default useApiCall;