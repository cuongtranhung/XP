/**
 * Unit tests for FormRenderer component
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormRenderer } from '../FormRenderer';
import { Form, FieldType, FormStatus } from '../../../types/formBuilder';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import toast from 'react-hot-toast';

// No external service mocks needed - FormRenderer only uses passed props

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BrowserRouter>
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  </BrowserRouter>
);

const mockForm: Form = {
  id: 'test-form-id',
  title: 'Test Form',
  description: 'This is a test form',
  fields: [
    {
      id: 'field-1',
      type: FieldType.Text,
      label: 'Name',
      key: 'name',
      required: true,
      placeholder: 'Enter your name',
      position: 0,
    },
    {
      id: 'field-2',
      type: FieldType.Email,
      label: 'Email',
      key: 'email',
      required: true,
      placeholder: 'Enter your email',
      position: 1,
    },
    {
      id: 'field-3',
      type: FieldType.Number,
      label: 'Age',
      key: 'age',
      required: false,
      position: 2,
      validation: {
        min: 18,
        max: 100,
      },
    },
  ],
  settings: {
    submitButtonText: 'Submit Form',
    successMessage: 'Thank you for your submission!',
  },
  status: FormStatus.Active,
  userId: 'user-id',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('FormRenderer Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render form with all fields', () => {
    render(
      <TestWrapper>
        <FormRenderer form={mockForm} />
      </TestWrapper>
    );

    expect(screen.getByText('Test Form')).toBeInTheDocument();
    expect(screen.getByText('This is a test form')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter your name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter your email')).toBeInTheDocument();
    expect(screen.getByRole('spinbutton')).toBeInTheDocument(); // number input for age
    // Submit button is not shown without onSubmit prop
    expect(screen.queryByText('Submit')).not.toBeInTheDocument();
  });

  it('should validate required fields', async () => {
    const user = userEvent.setup();
    const mockSubmit = jest.fn();
    
    render(
      <TestWrapper>
        <FormRenderer form={mockForm} onSubmit={mockSubmit} />
      </TestWrapper>
    );

    // Try to submit without filling required fields
    const submitButton = screen.getByText('Submit');
    await user.click(submitButton);

    // Check for validation errors
    await waitFor(() => {
      expect(screen.getByText('Name is required')).toBeInTheDocument();
      expect(screen.getByText('Email is required')).toBeInTheDocument();
    });
  });

  it('should validate email format', async () => {
    const user = userEvent.setup();
    const mockSubmit = jest.fn();
    
    render(
      <TestWrapper>
        <FormRenderer form={mockForm} onSubmit={mockSubmit} />
      </TestWrapper>
    );

    const nameInput = screen.getByPlaceholderText('Enter your name');
    const emailInput = screen.getByPlaceholderText('Enter your email');

    await user.type(nameInput, 'John Doe');
    await user.type(emailInput, 'invalid-email');

    const submitButton = screen.getByText('Submit');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
    });
  });

  it('should submit form with valid data', async () => {
    const user = userEvent.setup();
    const mockSubmit = jest.fn();
    
    render(
      <TestWrapper>
        <FormRenderer form={mockForm} onSubmit={mockSubmit} />
      </TestWrapper>
    );

    const nameInput = screen.getByPlaceholderText('Enter your name');
    const emailInput = screen.getByPlaceholderText('Enter your email');
    const ageInput = screen.getByRole('spinbutton'); // number input

    await user.type(nameInput, 'John Doe');
    await user.type(emailInput, 'john@example.com');
    await user.type(ageInput, '25');

    const submitButton = screen.getByText('Submit');
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith({
        name: 'John Doe',
        email: 'john@example.com',
        age: '25',
      });
    });
  });

  it('should not render submit button without onSubmit prop', () => {
    render(
      <TestWrapper>
        <FormRenderer form={mockForm} />
      </TestWrapper>
    );

    // Submit button should not be rendered without onSubmit prop
    expect(screen.queryByText('Submit')).not.toBeInTheDocument();
  });

  it('should render form in readonly mode', () => {
    render(
      <TestWrapper>
        <FormRenderer form={mockForm} readonly={true} />
      </TestWrapper>
    );

    const nameInput = screen.getByPlaceholderText('Enter your name');
    const emailInput = screen.getByPlaceholderText('Enter your email');
    const ageInput = screen.getByRole('spinbutton'); // number input

    expect(nameInput).toBeDisabled();
    expect(emailInput).toBeDisabled();
    expect(ageInput).toBeDisabled();
    // No submit button in readonly mode
    expect(screen.queryByText('Submit')).not.toBeInTheDocument();
  });

  it('should render different field types correctly', () => {
    const formWithVariousFields: Form = {
      ...mockForm,
      fields: [
        {
          id: 'field-1',
          type: FieldType.Select,
          label: 'Country',
          key: 'country',
          required: true,
          position: 0,
          options: [
            { label: 'USA', value: 'us' },
            { label: 'Canada', value: 'ca' },
            { label: 'Mexico', value: 'mx' },
          ],
        },
        {
          id: 'field-2',
          type: FieldType.Radio,
          label: 'Gender',
          key: 'gender',
          required: true,
          position: 1,
          options: [
            { label: 'Male', value: 'male' },
            { label: 'Female', value: 'female' },
            { label: 'Other', value: 'other' },
          ],
        },
        {
          id: 'field-3',
          type: FieldType.Checkbox,
          label: 'I agree to terms',
          key: 'terms',
          required: true,
          position: 2,
        },
        {
          id: 'field-4',
          type: FieldType.Textarea,
          label: 'Comments',
          key: 'comments',
          required: false,
          position: 3,
          placeholder: 'Enter your comments',
        },
      ],
    };

    render(
      <TestWrapper>
        <FormRenderer form={formWithVariousFields} />
      </TestWrapper>
    );

    // Select field - check by role
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    // Radio buttons - check by role and name
    expect(screen.getByRole('radio', { name: 'Male' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Female' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Other' })).toBeInTheDocument();
    // Checkbox - check by role
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
    // Textarea - check by placeholder
    expect(screen.getByPlaceholderText('Enter your comments')).toBeInTheDocument();
  });

  it('should handle select and radio field interactions', async () => {
    const user = userEvent.setup();
    const mockSubmit = jest.fn();
    
    const formWithVariousFields: Form = {
      ...mockForm,
      fields: [
        {
          id: 'field-1',
          type: FieldType.Select,
          label: 'Country',
          key: 'country',
          required: false,
          position: 0,
          options: [
            { label: 'USA', value: 'us' },
            { label: 'Canada', value: 'ca' },
          ],
        },
        {
          id: 'field-2',
          type: FieldType.Radio,
          label: 'Gender',
          key: 'gender',
          required: false,
          position: 1,
          options: [
            { label: 'Male', value: 'male' },
            { label: 'Female', value: 'female' },
          ],
        },
      ],
    };

    render(
      <TestWrapper>
        <FormRenderer form={formWithVariousFields} onSubmit={mockSubmit} />
      </TestWrapper>
    );

    // Select a country
    const countrySelect = screen.getByRole('combobox');
    await user.selectOptions(countrySelect, 'ca');

    // Select a gender
    const maleRadio = screen.getByRole('radio', { name: 'Male' });
    await user.click(maleRadio);

    // Submit the form
    const submitButton = screen.getByText('Submit');
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith({
        country: 'ca',
        gender: 'male',
      });
    });
  });

  it('should handle checkbox field interactions', async () => {
    const user = userEvent.setup();
    const mockSubmit = jest.fn();
    
    const formWithCheckbox: Form = {
      ...mockForm,
      fields: [
        {
          id: 'field-1',
          type: FieldType.Checkbox,
          label: 'I agree to terms',
          key: 'terms',
          required: false,
          position: 0,
        },
        {
          id: 'field-2',
          type: FieldType.Checkbox,
          label: 'Subscribe to newsletter',
          key: 'newsletter',
          required: false,
          position: 1,
        },
      ],
    };

    render(
      <TestWrapper>
        <FormRenderer form={formWithCheckbox} onSubmit={mockSubmit} />
      </TestWrapper>
    );

    const termsCheckbox = screen.getByRole('checkbox', { name: 'I agree to terms' });
    const newsletterCheckbox = screen.getByRole('checkbox', { name: 'Subscribe to newsletter' });
    
    // Check both boxes
    await user.click(termsCheckbox);
    await user.click(newsletterCheckbox);
    
    // Submit the form
    const submitButton = screen.getByText('Submit');
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith({
        terms: true,
        newsletter: true,
      });
    });
  });

  it('should handle textarea field interactions', async () => {
    const user = userEvent.setup();
    const mockSubmit = jest.fn();
    
    const formWithTextarea: Form = {
      ...mockForm,
      fields: [
        {
          id: 'field-1',
          type: FieldType.Textarea,
          label: 'Comments',
          key: 'comments',
          required: false,
          position: 0,
          placeholder: 'Enter your comments',
        },
      ],
    };

    render(
      <TestWrapper>
        <FormRenderer form={formWithTextarea} onSubmit={mockSubmit} />
      </TestWrapper>
    );

    const commentsTextarea = screen.getByPlaceholderText('Enter your comments');
    await user.type(commentsTextarea, 'This is a test comment');

    const submitButton = screen.getByText('Submit');
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith({
        comments: 'This is a test comment',
      });
    });
  });

  it('should clear validation errors when field is modified', async () => {
    const user = userEvent.setup();
    const mockSubmit = jest.fn();
    
    render(
      <TestWrapper>
        <FormRenderer form={mockForm} onSubmit={mockSubmit} />
      </TestWrapper>
    );

    // Submit without filling required fields to trigger errors
    const submitButton = screen.getByText('Submit');
    await user.click(submitButton);

    // Check that error appears
    await waitFor(() => {
      expect(screen.getByText('Name is required')).toBeInTheDocument();
    });

    // Type in the field to clear the error
    const nameInput = screen.getByPlaceholderText('Enter your name');
    await user.type(nameInput, 'J');

    // Error should be cleared
    await waitFor(() => {
      expect(screen.queryByText('Name is required')).not.toBeInTheDocument();
    });
  });
});