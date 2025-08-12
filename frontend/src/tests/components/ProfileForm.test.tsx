import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProfileForm from '../../components/profile/ProfileForm';
import { UserProfile } from '../../types/profile';
import { profileService } from '../../services/profileService';
import toast from 'react-hot-toast';

// Mock services and libraries
jest.mock('../../services/profileService');
jest.mock('react-hot-toast');

const mockProfileService = profileService as jest.Mocked<typeof profileService>;
const mockToast = toast as jest.Mocked<typeof toast>;

// Mock profile data
const mockProfile: UserProfile = {
  id: '1',
  email: 'test@example.com',
  username: 'testuser',
  full_name: 'John Doe',
  first_name: 'John',
  last_name: 'Doe',
  phone: '+1234567890',
  department: 'Engineering',
  position: 'Software Developer',
  bio: 'A passionate developer',
  location: 'San Francisco, CA',
  timezone: 'America/Los_Angeles',
  language: 'en',
  avatar_url: 'https://example.com/avatar.jpg',
  cover_image_url: null,
  date_of_birth: '1990-01-01',
  gender: 'male',
  website: 'https://johndoe.com',
  social_links: {
    linkedin: 'https://linkedin.com/in/johndoe',
    twitter: 'https://twitter.com/johndoe',
    github: 'https://github.com/johndoe',
    facebook: 'https://facebook.com/johndoe'
  },
  preferences: {
    theme: 'light',
    language: 'en',
    timezone: 'America/Los_Angeles',
    date_format: 'MM/DD/YYYY',
    time_format: '12h',
    notification_settings: {
      email_notifications: true,
      push_notifications: true,
      sms_notifications: false,
      marketing_emails: true,
      security_alerts: true,
      system_updates: true,
      weekly_summary: true
    },
    privacy_settings: {
      profile_visibility: 'public',
      show_email: true,
      show_phone: false,
      show_location: true,
      show_last_seen: true,
      allow_search: true
    }
  },
  security: {
    two_factor_enabled: false,
    login_alerts: true,
    session_timeout: 30,
    backup_codes_count: 0,
    active_sessions: []
  },
  created_at: '2023-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  last_login: '2024-01-01T12:00:00Z',
  is_verified: true,
  is_active: true
};

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('ProfileForm', () => {
  const mockOnProfileUpdate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders profile form with initial values', () => {
    render(
      <TestWrapper>
        <ProfileForm
          profile={mockProfile}
          onProfileUpdate={mockOnProfileUpdate}
        />
      </TestWrapper>
    );

    // Check if form fields are populated with initial values
    expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument();
    expect(screen.getByDisplayValue('John')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Doe')).toBeInTheDocument();
    expect(screen.getByDisplayValue('+1234567890')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Engineering')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Software Developer')).toBeInTheDocument();
    expect(screen.getByDisplayValue('A passionate developer')).toBeInTheDocument();
  });

  it('displays section navigation tabs', () => {
    render(
      <TestWrapper>
        <ProfileForm
          profile={mockProfile}
          onProfileUpdate={mockOnProfileUpdate}
        />
      </TestWrapper>
    );

    expect(screen.getByText('Basic Info')).toBeInTheDocument();
    expect(screen.getByText('Contact')).toBeInTheDocument();
    expect(screen.getByText('Professional')).toBeInTheDocument();
  });

  it('switches between form sections', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <ProfileForm
          profile={mockProfile}
          onProfileUpdate={mockOnProfileUpdate}
        />
      </TestWrapper>
    );

    // Initially shows basic info section
    expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument();

    // Click on Contact tab
    await user.click(screen.getByText('Contact'));

    // Should show contact info fields
    expect(screen.getByDisplayValue('test@example.com')).toBeInTheDocument();
    expect(screen.getByDisplayValue('San Francisco, CA')).toBeInTheDocument();

    // Click on Professional tab
    await user.click(screen.getByText('Professional'));

    // Should show professional fields
    expect(screen.getByDisplayValue('Engineering')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Software Developer')).toBeInTheDocument();
  });

  it('updates profile successfully', async () => {
    const user = userEvent.setup();
    
    mockProfileService.updateProfile.mockResolvedValue({
      success: true,
      data: { ...mockProfile, full_name: 'Jane Doe' },
      message: 'Profile updated successfully'
    });

    render(
      <TestWrapper>
        <ProfileForm
          profile={mockProfile}
          onProfileUpdate={mockOnProfileUpdate}
        />
      </TestWrapper>
    );

    // Update full name
    const fullNameInput = screen.getByDisplayValue('John Doe');
    await user.clear(fullNameInput);
    await user.type(fullNameInput, 'Jane Doe');

    // Submit form
    const saveButton = screen.getByText('Save Changes');
    expect(saveButton).not.toBeDisabled();
    
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockProfileService.updateProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          full_name: 'Jane Doe'
        })
      );
      expect(mockOnProfileUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          full_name: 'Jane Doe'
        })
      );
      expect(mockToast.success).toHaveBeenCalledWith('Profile updated successfully!');
    });
  });

  it('handles profile update error', async () => {
    const user = userEvent.setup();
    
    mockProfileService.updateProfile.mockRejectedValue({
      response: { data: { message: 'Update failed' } }
    });

    render(
      <TestWrapper>
        <ProfileForm
          profile={mockProfile}
          onProfileUpdate={mockOnProfileUpdate}
        />
      </TestWrapper>
    );

    // Update full name
    const fullNameInput = screen.getByDisplayValue('John Doe');
    await user.clear(fullNameInput);
    await user.type(fullNameInput, 'Jane Doe');

    // Submit form
    const saveButton = screen.getByText('Save Changes');
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Update failed');
      expect(mockOnProfileUpdate).not.toHaveBeenCalled();
    });
  });

  it('uploads avatar successfully', async () => {
    const user = userEvent.setup();
    
    // Mock avatar upload
    mockProfileService.updateAvatarFromDataUrl.mockResolvedValue({
      success: true,
      data: {
        avatar_url: 'https://example.com/new-avatar.jpg',
        thumbnail_url: 'https://example.com/new-avatar-thumb.jpg',
        original_filename: 'avatar.jpg',
        file_size: 12345,
        mime_type: 'image/jpeg'
      },
      message: 'Avatar uploaded successfully'
    });

    render(
      <TestWrapper>
        <ProfileForm
          profile={mockProfile}
          onProfileUpdate={mockOnProfileUpdate}
        />
      </TestWrapper>
    );

    // Create a mock file
    const file = new File(['avatar content'], 'avatar.jpg', { type: 'image/jpeg' });

    // Find the hidden file input and upload file
    const fileInput = screen.getByRole('textbox', { hidden: true }) as HTMLInputElement;
    await user.upload(fileInput, file);

    await waitFor(() => {
      expect(mockProfileService.updateAvatarFromDataUrl).toHaveBeenCalled();
      expect(mockOnProfileUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          avatar_url: 'https://example.com/new-avatar.jpg'
        })
      );
      expect(mockToast.success).toHaveBeenCalledWith('Avatar updated successfully!');
    });
  });

  it('validates required fields', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <ProfileForm
          profile={mockProfile}
          onProfileUpdate={mockOnProfileUpdate}
        />
      </TestWrapper>
    );

    // Clear required field
    const fullNameInput = screen.getByDisplayValue('John Doe');
    await user.clear(fullNameInput);

    // Try to submit
    const saveButton = screen.getByText('Save Changes');
    await user.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Full name is required')).toBeInTheDocument();
      expect(mockProfileService.updateProfile).not.toHaveBeenCalled();
    });
  });

  it('disables save button when form is not dirty', () => {
    render(
      <TestWrapper>
        <ProfileForm
          profile={mockProfile}
          onProfileUpdate={mockOnProfileUpdate}
        />
      </TestWrapper>
    );

    const saveButton = screen.getByText('Save Changes');
    expect(saveButton).toBeDisabled();
  });

  it('enables save button when form is dirty', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <ProfileForm
          profile={mockProfile}
          onProfileUpdate={mockOnProfileUpdate}
        />
      </TestWrapper>
    );

    // Make a change
    const fullNameInput = screen.getByDisplayValue('John Doe');
    await user.type(fullNameInput, ' Updated');

    const saveButton = screen.getByText('Save Changes');
    expect(saveButton).not.toBeDisabled();
  });

  it('resets form to original values', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <ProfileForm
          profile={mockProfile}
          onProfileUpdate={mockOnProfileUpdate}
        />
      </TestWrapper>
    );

    // Make a change
    const fullNameInput = screen.getByDisplayValue('John Doe');
    await user.clear(fullNameInput);
    await user.type(fullNameInput, 'Jane Doe');

    // Reset form
    const resetButton = screen.getByText('Reset');
    await user.click(resetButton);

    // Should be back to original value
    expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument();
  });

  it('displays social links in contact section', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <ProfileForm
          profile={mockProfile}
          onProfileUpdate={mockOnProfileUpdate}
        />
      </TestWrapper>
    );

    // Switch to contact section
    await user.click(screen.getByText('Contact'));

    // Check social links
    expect(screen.getByDisplayValue('https://linkedin.com/in/johndoe')).toBeInTheDocument();
    expect(screen.getByDisplayValue('https://twitter.com/johndoe')).toBeInTheDocument();
    expect(screen.getByDisplayValue('https://github.com/johndoe')).toBeInTheDocument();
    expect(screen.getByDisplayValue('https://facebook.com/johndoe')).toBeInTheDocument();
  });

  it('handles avatar removal', async () => {
    const user = userEvent.setup();

    mockProfileService.removeAvatar.mockResolvedValue({
      success: true,
      message: 'Avatar removed successfully'
    });

    render(
      <TestWrapper>
        <ProfileForm
          profile={mockProfile}
          onProfileUpdate={mockOnProfileUpdate}
        />
      </TestWrapper>
    );

    // Find and click remove button (should be visible since profile has avatar)
    const removeButton = screen.getByText('Remove');
    await user.click(removeButton);

    await waitFor(() => {
      expect(mockProfileService.removeAvatar).toHaveBeenCalled();
      expect(mockOnProfileUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          avatar_url: null
        })
      );
      expect(mockToast.success).toHaveBeenCalledWith('Avatar removed successfully!');
    });
  });
});