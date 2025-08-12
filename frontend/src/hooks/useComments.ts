import { useQuery, useMutation, useQueryClient, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
import { commentService } from '../services/commentService';
import {
  Comment,
  CommentCreateData,
  CommentUpdateData,
  CommentFilter,
  CommentPagination,
  CommentsResponse,
  CommentActionResponse,
  CommentCountResponse,
  CommentStatsResponse
} from '../types/comment.types';

// Query Keys
const COMMENT_QUERY_KEYS = {
  all: ['comments'] as const,
  submission: (submissionId: string) => ['comments', 'submission', submissionId] as const,
  comment: (commentId: string) => ['comments', 'comment', commentId] as const,
  count: (submissionId: string) => ['comments', 'count', submissionId] as const,
  counts: (submissionIds: string[]) => ['comments', 'counts', ...submissionIds] as const,
  stats: (submissionId: string) => ['comments', 'stats', submissionId] as const,
  user: (userId: string) => ['comments', 'user', userId] as const,
};

/**
 * Hook to fetch comments for a submission
 */
export function useComments(
  submissionId: string,
  filter?: CommentFilter,
  pagination?: CommentPagination,
  options?: UseQueryOptions<CommentsResponse, Error>
) {
  return useQuery<CommentsResponse, Error>({
    queryKey: [...COMMENT_QUERY_KEYS.submission(submissionId), filter, pagination],
    queryFn: () => commentService.getComments(submissionId, filter, pagination),
    staleTime: 30000, // 30 seconds
    ...options,
  });
}

/**
 * Hook to fetch a single comment
 */
export function useComment(
  commentId: string,
  options?: UseQueryOptions<CommentActionResponse, Error>
) {
  return useQuery<CommentActionResponse, Error>({
    queryKey: COMMENT_QUERY_KEYS.comment(commentId),
    queryFn: () => commentService.getComment(commentId),
    enabled: !!commentId,
    ...options,
  });
}

/**
 * Hook to create a comment
 */
export function useCreateComment(
  options?: UseMutationOptions<CommentActionResponse, Error, { submissionId: string; data: CommentCreateData }>
) {
  const queryClient = useQueryClient();

  return useMutation<CommentActionResponse, Error, { submissionId: string; data: CommentCreateData }>({
    mutationFn: ({ submissionId, data }) => commentService.createComment(submissionId, data),
    onSuccess: (response, variables) => {
      // Invalidate submission comments
      queryClient.invalidateQueries({
        queryKey: COMMENT_QUERY_KEYS.submission(variables.submissionId),
      });
      
      // Invalidate comment count
      queryClient.invalidateQueries({
        queryKey: COMMENT_QUERY_KEYS.count(variables.submissionId),
      });
      
      // Invalidate stats
      queryClient.invalidateQueries({
        queryKey: COMMENT_QUERY_KEYS.stats(variables.submissionId),
      });
    },
    ...options,
  });
}

/**
 * Hook to update a comment
 */
export function useUpdateComment(
  options?: UseMutationOptions<CommentActionResponse, Error, { commentId: string; data: CommentUpdateData }>
) {
  const queryClient = useQueryClient();

  return useMutation<CommentActionResponse, Error, { commentId: string; data: CommentUpdateData }>({
    mutationFn: ({ commentId, data }) => commentService.updateComment(commentId, data),
    onSuccess: (response, variables) => {
      // Invalidate specific comment
      queryClient.invalidateQueries({
        queryKey: COMMENT_QUERY_KEYS.comment(variables.commentId),
      });
      
      // Invalidate all submission comments (to update the edited comment in the list)
      queryClient.invalidateQueries({
        queryKey: COMMENT_QUERY_KEYS.all,
      });
    },
    ...options,
  });
}

/**
 * Hook to delete a comment
 */
export function useDeleteComment(
  options?: UseMutationOptions<CommentActionResponse, Error, { commentId: string; submissionId: string }>
) {
  const queryClient = useQueryClient();

  return useMutation<CommentActionResponse, Error, { commentId: string; submissionId: string }>({
    mutationFn: ({ commentId }) => commentService.deleteComment(commentId),
    onSuccess: (response, variables) => {
      // Invalidate submission comments
      queryClient.invalidateQueries({
        queryKey: COMMENT_QUERY_KEYS.submission(variables.submissionId),
      });
      
      // Invalidate comment count
      queryClient.invalidateQueries({
        queryKey: COMMENT_QUERY_KEYS.count(variables.submissionId),
      });
      
      // Invalidate stats
      queryClient.invalidateQueries({
        queryKey: COMMENT_QUERY_KEYS.stats(variables.submissionId),
      });
    },
    ...options,
  });
}

/**
 * Hook to restore a deleted comment
 */
export function useRestoreComment(
  options?: UseMutationOptions<CommentActionResponse, Error, { commentId: string; submissionId: string }>
) {
  const queryClient = useQueryClient();

  return useMutation<CommentActionResponse, Error, { commentId: string; submissionId: string }>({
    mutationFn: ({ commentId }) => commentService.restoreComment(commentId),
    onSuccess: (response, variables) => {
      // Invalidate submission comments
      queryClient.invalidateQueries({
        queryKey: COMMENT_QUERY_KEYS.submission(variables.submissionId),
      });
      
      // Invalidate comment count
      queryClient.invalidateQueries({
        queryKey: COMMENT_QUERY_KEYS.count(variables.submissionId),
      });
      
      // Invalidate stats
      queryClient.invalidateQueries({
        queryKey: COMMENT_QUERY_KEYS.stats(variables.submissionId),
      });
    },
    ...options,
  });
}

/**
 * Hook to get comment count for a submission
 */
export function useCommentCount(
  submissionId: string,
  options?: UseQueryOptions<CommentCountResponse, Error>
) {
  return useQuery<CommentCountResponse, Error>({
    queryKey: COMMENT_QUERY_KEYS.count(submissionId),
    queryFn: () => commentService.getCommentCount(submissionId),
    enabled: !!submissionId,
    staleTime: 60000, // 1 minute
    ...options,
  });
}

/**
 * Hook to get comment counts for multiple submissions
 */
export function useCommentCounts(
  submissionIds: string[],
  options?: UseQueryOptions<Map<string, number>, Error>
) {
  return useQuery<Map<string, number>, Error>({
    queryKey: COMMENT_QUERY_KEYS.counts(submissionIds),
    queryFn: () => commentService.getCommentCounts(submissionIds),
    enabled: submissionIds.length > 0,
    staleTime: 60000, // 1 minute
    ...options,
  });
}

/**
 * Hook to get comment statistics
 */
export function useCommentStats(
  submissionId: string,
  options?: UseQueryOptions<CommentStatsResponse, Error>
) {
  return useQuery<CommentStatsResponse, Error>({
    queryKey: COMMENT_QUERY_KEYS.stats(submissionId),
    queryFn: () => commentService.getCommentStats(submissionId),
    enabled: !!submissionId,
    staleTime: 60000, // 1 minute
    ...options,
  });
}

/**
 * Hook to get user's comments
 */
export function useUserComments(
  userId: string,
  pagination?: CommentPagination,
  options?: UseQueryOptions<CommentsResponse, Error>
) {
  return useQuery<CommentsResponse, Error>({
    queryKey: [...COMMENT_QUERY_KEYS.user(userId), pagination],
    queryFn: () => commentService.getUserComments(userId, pagination),
    enabled: !!userId,
    staleTime: 30000, // 30 seconds
    ...options,
  });
}