/**
 * Unit tests for FormBuilder component
 */

// Mock the API service to avoid import.meta.env issues
jest.mock('../../../services/api', () => ({
  apiService: {
    getCurrentUser: jest.fn(),
    login: jest.fn(),
    register: jest.fn(),
    logout: jest.fn(),
    getToken: jest.fn(),
    setToken: jest.fn(),
    clearAuth: jest.fn(),
    setLogoutContext: jest.fn(),
    clearLogoutContext: jest.fn(),
  },
}));

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormBuilder } from '../FormBuilder';
import { FormBuilderProvider } from '../../../contexts/FormBuilderContext';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../../../contexts/AuthContext';
import { FieldType } from '../../../types/formBuilder';

// Mock modules
jest.mock('../../../hooks/useFormCollaboration', () => ({
  useFormCollaboration: () => ({
    connected: false,
    collaborators: [],
    locked: false,
    hasLock: false,
    showCursors: false,
    setShowCursors: jest.fn(),
    emitFieldAdd: jest.fn(),
    emitFieldUpdate: jest.fn(),
    emitFieldDelete: jest.fn(),
    emitFieldReorder: jest.fn(),
    emitFormUpdate: jest.fn(),
    emitCursorMove: jest.fn(),
    emitSelectionChange: jest.fn(),
    requestLock: jest.fn(),
    releaseLock: jest.fn(),
  }),
}));

jest.mock('../../../services/formService', () => ({
  createForm: jest.fn().mockResolvedValue({ id: 'test-form-id' }),
  updateForm: jest.fn().mockResolvedValue({}),
  getForm: jest.fn().mockResolvedValue({
    id: 'test-form-id',
    title: 'Test Form',
    description: 'Test Description',
    fields: [],
    settings: {},
  }),
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User',
};

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BrowserRouter>
    <QueryClientProvider client={queryClient}>
      <AuthProvider value={{ user: mockUser, token: 'test-token', login: jest.fn(), logout: jest.fn(), loading: false }}>
        <FormBuilderProvider>
          {children}
        </FormBuilderProvider>
      </AuthProvider>
    </QueryClientProvider>
  </BrowserRouter>
);

describe('FormBuilder Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render form builder interface', () => {
    render(
      <TestWrapper>
        <FormBuilder />
      </TestWrapper>
    );

    expect(screen.getByText('Form Elements')).toBeInTheDocument();
    expect(screen.getByText('Drag and drop to add fields')).toBeInTheDocument();
  });

  it('should display available field types', () => {
    render(
      <TestWrapper>
        <FormBuilder />
      </TestWrapper>
    );

    expect(screen.getByText('Text Input')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Number')).toBeInTheDocument();
    expect(screen.getByText('Date')).toBeInTheDocument();
    expect(screen.getByText('Dropdown')).toBeInTheDocument();
    expect(screen.getByText('Checkbox')).toBeInTheDocument();
    expect(screen.getByText('Radio Buttons')).toBeInTheDocument();
    expect(screen.getByText('Text Area')).toBeInTheDocument();
    expect(screen.getByText('File Upload')).toBeInTheDocument();
  });

  it('should add field when field type is clicked', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <FormBuilder />
      </TestWrapper>
    );

    const textFieldButton = screen.getByText('Text Input');
    await user.click(textFieldButton);

    await waitFor(() => {
      expect(screen.getByText('New text field')).toBeInTheDocument();
    });
  });

  it('should allow editing field properties', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <FormBuilder />
      </TestWrapper>
    );

    // Add a text field
    await user.click(screen.getByText('Text Input'));
    
    // Click on the field to select it
    const field = await screen.findByText('New text field');
    await user.click(field);

    // Edit field label
    const labelInput = screen.getByLabelText('Label');
    await user.clear(labelInput);
    await user.type(labelInput, 'Full Name');

    // Edit field key
    const keyInput = screen.getByLabelText('Field Key');
    await user.clear(keyInput);
    await user.type(keyInput, 'full_name');

    // Toggle required
    const requiredCheckbox = screen.getByLabelText('Required');
    await user.click(requiredCheckbox);

    // Verify changes
    expect(screen.getByText('Full Name')).toBeInTheDocument();
  });

  it('should delete field when delete button is clicked', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <FormBuilder />
      </TestWrapper>
    );

    // Add a field
    await user.click(screen.getByText('Text Input'));
    const field = await screen.findByText('New text field');

    // Click delete button
    const deleteButton = screen.getByLabelText('Delete field');
    await user.click(deleteButton);

    // Confirm deletion
    await waitFor(() => {
      expect(field).not.toBeInTheDocument();
    });
  });

  it('should show preview mode', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <FormBuilder />
      </TestWrapper>
    );

    // Add some fields
    await user.click(screen.getByText('Text Input'));
    await user.click(screen.getByText('Email'));

    // Switch to preview mode
    const previewButton = screen.getByText('Preview');
    await user.click(previewButton);

    // Verify preview mode
    expect(screen.getByText('Form Preview')).toBeInTheDocument();
    expect(screen.getByText('Back to Editor')).toBeInTheDocument();
  });

  it('should save form', async () => {
    const user = userEvent.setup();
    const formService = require('../../../services/formService');
    
    render(
      <TestWrapper>
        <FormBuilder />
      </TestWrapper>
    );

    // Add form title
    const titleInput = screen.getByPlaceholderText('Untitled Form');
    await user.type(titleInput, 'Contact Form');

    // Add description
    const descInput = screen.getByPlaceholderText('Add a description...');
    await user.type(descInput, 'Contact us for more information');

    // Add a field
    await user.click(screen.getByText('Text Input'));

    // Save form
    const saveButton = screen.getByText('Save');
    await user.click(saveButton);

    await waitFor(() => {
      expect(formService.createForm).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Contact Form',
          description: 'Contact us for more information',
          fields: expect.any(Array),
        })
      );
    });
  });

  it('should handle conditional logic', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <FormBuilder />
      </TestWrapper>
    );

    // Add a radio field
    await user.click(screen.getByText('Radio Buttons'));
    const radioField = await screen.findByText('New radio field');
    await user.click(radioField);

    // Add options
    const addOptionButton = screen.getByText('Add Option');
    await user.click(addOptionButton);
    await user.click(addOptionButton);

    // Add a text field
    await user.click(screen.getByText('Text Input'));
    const textField = await screen.findAllByText('New text field');
    await user.click(textField[textField.length - 1]);

    // Enable conditional logic
    const conditionalToggle = screen.getByLabelText('Enable Conditional Logic');
    await user.click(conditionalToggle);

    // Set condition
    expect(screen.getByText('Show this field when')).toBeInTheDocument();
  });

  it('should duplicate field', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <FormBuilder />
      </TestWrapper>
    );

    // Add a field
    await user.click(screen.getByText('Text Input'));
    await screen.findByText('New text field');

    // Duplicate field
    const duplicateButton = screen.getByLabelText('Duplicate field');
    await user.click(duplicateButton);

    // Verify duplication
    const textFields = screen.getAllByText('New text field');
    expect(textFields).toHaveLength(2);
  });

  it('should handle form settings', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <FormBuilder />
      </TestWrapper>
    );

    // Open settings
    const settingsButton = screen.getByText('Settings');
    await user.click(settingsButton);

    // Toggle settings
    const multipleSubmissionsToggle = screen.getByLabelText('Allow Multiple Submissions');
    await user.click(multipleSubmissionsToggle);

    const authRequiredToggle = screen.getByLabelText('Require Authentication');
    await user.click(authRequiredToggle);

    // Close settings
    const closeButton = screen.getByLabelText('Close settings');
    await user.click(closeButton);

    expect(screen.queryByText('Form Settings')).not.toBeInTheDocument();
  });

  it('should validate field properties', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <FormBuilder />
      </TestWrapper>
    );

    // Add a field
    await user.click(screen.getByText('Text Input'));
    const field = await screen.findByText('New text field');
    await user.click(field);

    // Try to set invalid field key
    const keyInput = screen.getByLabelText('Field Key');
    await user.clear(keyInput);
    await user.type(keyInput, 'invalid key!');

    // Should show error
    expect(screen.getByText('Field key can only contain letters, numbers, and underscores')).toBeInTheDocument();
  });

  it('should handle field validation rules', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <FormBuilder />
      </TestWrapper>
    );

    // Add a text field
    await user.click(screen.getByText('Text Input'));
    const field = await screen.findByText('New text field');
    await user.click(field);

    // Add validation rules
    const minLengthInput = screen.getByLabelText('Min Length');
    await user.type(minLengthInput, '5');

    const maxLengthInput = screen.getByLabelText('Max Length');
    await user.type(maxLengthInput, '50');

    const patternInput = screen.getByLabelText('Pattern (RegEx)');
    await user.type(patternInput, '^[A-Za-z]+$');

    expect(minLengthInput).toHaveValue(5);
    expect(maxLengthInput).toHaveValue(50);
    expect(patternInput).toHaveValue('^[A-Za-z]+$');
  });
});