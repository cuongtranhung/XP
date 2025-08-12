import {
  Comment,
  CommentCreateData,
  CommentUpdateData,
  CommentFilter,
  CommentPagination,
  CommentsResponse,
  CommentCountResponse,
  CommentStatsResponse,
  CommentActionResponse
} from '../types/comment.types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

class CommentService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = `${API_BASE_URL}/comments`;
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || `HTTP error! status: ${response.status}`);
    }
    return response.json();
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    // Add auth token if available
    const token = localStorage.getItem('authToken');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  /**
   * Get comments for a submission
   */
  async getComments(
    submissionId: string,
    filter?: CommentFilter,
    pagination?: CommentPagination
  ): Promise<CommentsResponse> {
    const params = new URLSearchParams();
    
    if (filter?.user_id) params.append('user_id', filter.user_id);
    if (filter?.parent_id !== undefined) params.append('parent_id', filter.parent_id || 'null');
    if (filter?.include_deleted) params.append('include_deleted', 'true');
    
    if (pagination?.page) params.append('page', pagination.page.toString());
    if (pagination?.limit) params.append('limit', pagination.limit.toString());
    if (pagination?.sort_by) params.append('sort_by', pagination.sort_by);
    if (pagination?.sort_order) params.append('sort_order', pagination.sort_order);

    const response = await fetch(
      `${this.baseUrl}/submission/${submissionId}?${params.toString()}`,
      {
        method: 'GET',
        headers: this.getHeaders(),
      }
    );

    return this.handleResponse<CommentsResponse>(response);
  }

  /**
   * Get a single comment by ID
   */
  async getComment(commentId: string): Promise<CommentActionResponse> {
    const response = await fetch(`${this.baseUrl}/${commentId}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    return this.handleResponse<CommentActionResponse>(response);
  }

  /**
   * Create a new comment
   */
  async createComment(
    submissionId: string,
    data: CommentCreateData
  ): Promise<CommentActionResponse> {
    const response = await fetch(`${this.baseUrl}/submission/${submissionId}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });

    return this.handleResponse<CommentActionResponse>(response);
  }

  /**
   * Update a comment
   */
  async updateComment(
    commentId: string,
    data: CommentUpdateData
  ): Promise<CommentActionResponse> {
    const response = await fetch(`${this.baseUrl}/${commentId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });

    return this.handleResponse<CommentActionResponse>(response);
  }

  /**
   * Delete a comment (soft delete)
   */
  async deleteComment(commentId: string): Promise<CommentActionResponse> {
    const response = await fetch(`${this.baseUrl}/${commentId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    return this.handleResponse<CommentActionResponse>(response);
  }

  /**
   * Restore a deleted comment
   */
  async restoreComment(commentId: string): Promise<CommentActionResponse> {
    const response = await fetch(`${this.baseUrl}/${commentId}/restore`, {
      method: 'POST',
      headers: this.getHeaders(),
    });

    return this.handleResponse<CommentActionResponse>(response);
  }

  /**
   * Get comment count for a submission
   */
  async getCommentCount(submissionId: string): Promise<CommentCountResponse> {
    const response = await fetch(`${this.baseUrl}/submission/${submissionId}/count`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    return this.handleResponse<CommentCountResponse>(response);
  }

  /**
   * Get comment counts for multiple submissions
   */
  async getCommentCounts(submissionIds: string[]): Promise<Map<string, number>> {
    const response = await fetch(`${this.baseUrl}/counts`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ submission_ids: submissionIds }),
    });

    const data = await this.handleResponse<{ success: boolean; data: Record<string, number> }>(response);
    return new Map(Object.entries(data.data));
  }

  /**
   * Get comment statistics for a submission
   */
  async getCommentStats(submissionId: string): Promise<CommentStatsResponse> {
    const response = await fetch(`${this.baseUrl}/submission/${submissionId}/stats`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    return this.handleResponse<CommentStatsResponse>(response);
  }

  /**
   * Get user's comments
   */
  async getUserComments(
    userId: string,
    pagination?: CommentPagination
  ): Promise<CommentsResponse> {
    const params = new URLSearchParams();
    
    if (pagination?.page) params.append('page', pagination.page.toString());
    if (pagination?.limit) params.append('limit', pagination.limit.toString());
    if (pagination?.sort_by) params.append('sort_by', pagination.sort_by);
    if (pagination?.sort_order) params.append('sort_order', pagination.sort_order);

    const response = await fetch(
      `${this.baseUrl}/user/${userId}?${params.toString()}`,
      {
        method: 'GET',
        headers: this.getHeaders(),
      }
    );

    return this.handleResponse<CommentsResponse>(response);
  }
}

// Export singleton instance
export const commentService = new CommentService();

// Export class for testing
export default CommentService;