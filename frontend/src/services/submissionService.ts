/**
 * Form submission service for handling form data submission
 */

import { apiService } from './api';

export interface SubmissionData {
  [key: string]: any;
}

export interface SubmissionResponse {
  id: string;
  success: boolean;
  message?: string;
}

/**
 * Submit form data to the backend
 */
export const submitForm = async (
  formId: string, 
  data: SubmissionData
): Promise<SubmissionResponse> => {
  try {
    const response = await apiService.post(`/api/forms/${formId}/submit`, {
      data,
      submittedAt: new Date().toISOString()
    });

    return {
      id: response.data.id || 'generated-id',
      success: true,
      message: 'Form submitted successfully'
    };
  } catch (error: any) {
    throw new Error(error?.response?.data?.message || 'Failed to submit form');
  }
};

export default {
  submitForm
};