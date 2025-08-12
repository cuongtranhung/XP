/**
 * React Query Hooks for Table Data
 * Intelligent caching and background refetching
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import toast from 'react-hot-toast';

interface FetchSubmissionsParams {
  formId: string;
  page: number;
  limit: number;
  status?: string;
  search?: string;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
}

interface UpdateSubmissionParams {
  formId: string;
  submissionId: string;
  data: any;
}

// Query keys factory
export const tableQueryKeys = {
  all: ['table'] as const,
  forms: () => [...tableQueryKeys.all, 'forms'] as const,
  form: (id: string) => [...tableQueryKeys.forms(), id] as const,
  submissions: (formId: string) => [...tableQueryKeys.form(formId), 'submissions'] as const,
  submission: (formId: string, submissionId: string) => 
    [...tableQueryKeys.submissions(formId), submissionId] as const,
  submissionsList: (formId: string, params: Omit<FetchSubmissionsParams, 'formId'>) => 
    [...tableQueryKeys.submissions(formId), 'list', params] as const,
};

/**
 * Fetch form details with caching
 */
export function useFormQuery(formId: string | undefined) {
  return useQuery({
    queryKey: tableQueryKeys.form(formId || ''),
    queryFn: async () => {
      if (!formId) throw new Error('Form ID is required');
      const response = await api.get(`/api/forms/${formId}`);
      return response.data.data || response.data;
    },
    enabled: !!formId,
    staleTime: 5 * 60 * 1000, // Consider data stale after 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes (formerly cacheTime)
    refetchOnWindowFocus: false, // Don't refetch on window focus
  });
}

/**
 * Fetch submissions with intelligent caching
 */
export function useSubmissionsQuery(params: FetchSubmissionsParams) {
  const { formId, ...queryParams } = params;
  
  return useQuery({
    queryKey: tableQueryKeys.submissionsList(formId, queryParams),
    queryFn: async () => {
      const response = await api.get(`/api/forms/${formId}/submissions`, {
        params: queryParams
      });
      
      if (response.data.data) {
        return {
          submissions: response.data.data.submissions || [],
          pagination: response.data.data.pagination || { pages: 1 }
        };
      } else {
        return {
          submissions: response.data.submissions || [],
          pagination: response.data.pagination || { pages: 1 }
        };
      }
    },
    enabled: !!formId,
    staleTime: 30 * 1000, // Consider data stale after 30 seconds
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    refetchInterval: 60 * 1000, // Refetch every minute
    refetchOnWindowFocus: true, // Refetch when window regains focus
  });
}

/**
 * Update submission mutation with optimistic updates
 */
export function useUpdateSubmissionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ formId, submissionId, data }: UpdateSubmissionParams) => {
      const response = await api.put(
        `/api/forms/${formId}/submissions/${submissionId}`,
        { data, partial: true }
      );
      return response.data;
    },
    onMutate: async ({ formId, submissionId, data }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ 
        queryKey: tableQueryKeys.submissions(formId) 
      });

      // Snapshot the previous value
      const previousSubmissions = queryClient.getQueryData(
        tableQueryKeys.submissions(formId)
      );

      // Optimistically update the cache
      queryClient.setQueriesData(
        { queryKey: tableQueryKeys.submissions(formId) },
        (old: any) => {
          if (!old) return old;
          
          return {
            ...old,
            submissions: old.submissions?.map((sub: any) =>
              sub.id === submissionId
                ? { ...sub, data, updatedAt: new Date().toISOString() }
                : sub
            )
          };
        }
      );

      // Return a context with the previous data
      return { previousSubmissions, formId };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousSubmissions) {
        queryClient.setQueryData(
          tableQueryKeys.submissions(variables.formId),
          context.previousSubmissions
        );
      }
      
      toast.error('Failed to update. Please try again.', {
        duration: 4000,
        position: 'bottom-right'
      });
    },
    onSuccess: (data, variables) => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ 
        queryKey: tableQueryKeys.submission(variables.formId, variables.submissionId) 
      });
      
      toast.success('Updated successfully', {
        duration: 2000,
        position: 'bottom-right'
      });
    },
  });
}

/**
 * Create submission mutation
 */
export function useCreateSubmissionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ formId, data }: { formId: string; data: any }) => {
      const submissionData = {
        data,
        status: 'completed',
        metadata: {
          source: 'table_view',
          device: { type: 'desktop' }
        }
      };

      const response = await api.post(`/api/forms/${formId}/submissions`, submissionData);
      return response.data;
    },
    onSuccess: (data, variables) => {
      // Invalidate and refetch submissions list
      queryClient.invalidateQueries({ 
        queryKey: tableQueryKeys.submissions(variables.formId) 
      });
      
      toast.success('New row added successfully!', {
        duration: 3000,
        position: 'bottom-right'
      });
    },
    onError: () => {
      toast.error('Failed to save new row. Please try again.', {
        duration: 4000,
        position: 'bottom-right'
      });
    }
  });
}

/**
 * Delete submission mutation
 */
export function useDeleteSubmissionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ formId, submissionId }: { formId: string; submissionId: string }) => {
      const response = await api.delete(`/api/forms/${formId}/submissions/${submissionId}`);
      return response.data;
    },
    onSuccess: (data, variables) => {
      // Invalidate and refetch submissions list
      queryClient.invalidateQueries({ 
        queryKey: tableQueryKeys.submissions(variables.formId) 
      });
      
      toast.success('Submission deleted successfully', {
        duration: 2000,
        position: 'bottom-right'
      });
    },
    onError: () => {
      toast.error('Failed to delete submission', {
        duration: 4000,
        position: 'bottom-right'
      });
    }
  });
}

/**
 * Bulk delete mutations
 */
export function useBulkDeleteMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ formId, submissionIds }: { formId: string; submissionIds: string[] }) => {
      // Delete each submission
      const deletePromises = submissionIds.map(id => 
        api.delete(`/api/forms/${formId}/submissions/${id}`)
      );
      
      await Promise.all(deletePromises);
      return { deleted: submissionIds.length };
    },
    onSuccess: (data, variables) => {
      // Invalidate and refetch submissions list
      queryClient.invalidateQueries({ 
        queryKey: tableQueryKeys.submissions(variables.formId) 
      });
      
      toast.success(`Successfully deleted ${data.deleted} submission${data.deleted > 1 ? 's' : ''}`, {
        duration: 3000,
        position: 'bottom-right'
      });
    },
    onError: () => {
      toast.error('Failed to delete some submissions. Please try again.', {
        duration: 4000,
        position: 'bottom-right'
      });
    }
  });
}

/**
 * Import submissions mutation
 */
export function useImportSubmissionsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ formId, file }: { formId: string; file: File }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('formId', formId);
      
      const response = await api.post(`/api/forms/${formId}/submissions/import`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      return response.data;
    },
    onSuccess: (data, variables) => {
      const imported = data.data?.imported || 0;
      const failed = data.data?.failed || 0;
      
      // Invalidate and refetch submissions list
      queryClient.invalidateQueries({ 
        queryKey: tableQueryKeys.submissions(variables.formId) 
      });
      
      toast.success(
        `Import successful! ${imported} rows imported${failed > 0 ? `, ${failed} failed` : ''}`,
        {
          duration: 4000,
          position: 'bottom-right',
          icon: '📥'
        }
      );
    },
    onError: (error: any) => {
      toast.error(
        error.response?.data?.message || 'Failed to import data. Please check file format.',
        {
          duration: 5000,
          position: 'bottom-right'
        }
      );
    }
  });
}

/**
 * Prefetch submissions for next page
 */
export function usePrefetchNextPage(formId: string, currentPage: number, totalPages: number) {
  const queryClient = useQueryClient();
  
  const prefetchNextPage = () => {
    if (currentPage < totalPages) {
      queryClient.prefetchQuery({
        queryKey: tableQueryKeys.submissionsList(formId, { 
          page: currentPage + 1, 
          limit: 50 
        }),
        queryFn: async () => {
          const response = await api.get(`/api/forms/${formId}/submissions`, {
            params: { page: currentPage + 1, limit: 50 }
          });
          return response.data;
        },
        staleTime: 30 * 1000,
      });
    }
  };

  return prefetchNextPage;
}