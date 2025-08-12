import { apiService } from './api';
import { Form } from '../types/formBuilder';

interface CreateFormData {
  title: string;
  description?: string;
  fields?: any[];
}

interface UpdateFormData extends Partial<CreateFormData> {
  status?: string;
  published?: boolean;
}

export const formService = {
  async createForm(data: CreateFormData): Promise<{ id: string }> {
    const response = await apiService.post('/api/forms', data);
    return response.data;
  },

  async updateForm(id: string, data: UpdateFormData): Promise<void> {
    await apiService.put(`/api/forms/${id}`, data);
  },

  async getForm(id: string): Promise<Form> {
    const response = await apiService.get(`/api/forms/${id}`);
    return response.data;
  },

  async getForms(): Promise<Form[]> {
    const response = await apiService.get('/api/forms');
    return response.data;
  },

  async deleteForm(id: string): Promise<void> {
    await apiService.delete(`/api/forms/${id}`);
  },

  async publishForm(id: string): Promise<void> {
    await apiService.post(`/api/forms/${id}/publish`);
  },

  async unpublishForm(id: string): Promise<void> {
    await apiService.post(`/api/forms/${id}/unpublish`);
  },

  async duplicateForm(id: string): Promise<{ id: string }> {
    const response = await apiService.post(`/api/forms/${id}/duplicate`);
    return response.data;
  }
};

// Export individual functions for backward compatibility
export const createForm = formService.createForm;
export const updateForm = formService.updateForm;
export const getForm = formService.getForm;
export const getForms = formService.getForms;
export const deleteForm = formService.deleteForm;
export const publishForm = formService.publishForm;
export const unpublishForm = formService.unpublishForm;
export const duplicateForm = formService.duplicateForm;