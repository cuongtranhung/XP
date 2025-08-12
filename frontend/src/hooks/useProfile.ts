import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserProfile, ProfileUpdateData, UserPreferences } from '../types/profile';
import { profileService } from '../services/profileService';
import toast from 'react-hot-toast';

export const useProfile = () => {
  const queryClient = useQueryClient();

  // Get current profile
  const {
    data: profile,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['profile', 'current'],
    queryFn: async () => {
      const response = await profileService.getCurrentProfile();
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: (data: ProfileUpdateData) => profileService.updateProfile(data),
    onSuccess: (response) => {
      queryClient.setQueryData(['profile', 'current'], response.data);
      toast.success('Profile updated successfully!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update profile');
    }
  });

  // Update preferences mutation
  const updatePreferencesMutation = useMutation({
    mutationFn: (preferences: Partial<UserPreferences>) => 
      profileService.updatePreferences(preferences),
    onSuccess: (response) => {
      // Update the profile query cache
      queryClient.setQueryData(['profile', 'current'], (old: UserProfile) => ({
        ...old,
        preferences: response.data
      }));
      toast.success('Preferences updated successfully!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update preferences');
    }
  });

  // Upload avatar mutation
  const uploadAvatarMutation = useMutation({
    mutationFn: (file: File) => profileService.uploadAvatar(file),
    onSuccess: (response, variables) => {
      // Update the profile query cache with new avatar URL
      queryClient.setQueryData(['profile', 'current'], (old: UserProfile) => ({
        ...old,
        avatar_url: response.data.avatar_url
      }));
      toast.success('Avatar updated successfully!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to upload avatar');
    }
  });

  // Remove avatar mutation
  const removeAvatarMutation = useMutation({
    mutationFn: () => profileService.removeAvatar(),
    onSuccess: () => {
      // Update the profile query cache to remove avatar
      queryClient.setQueryData(['profile', 'current'], (old: UserProfile) => ({
        ...old,
        avatar_url: null
      }));
      toast.success('Avatar removed successfully!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to remove avatar');
    }
  });

  // Change password mutation
  const changePasswordMutation = useMutation({
    mutationFn: (data: { current_password: string; new_password: string; confirm_password: string }) =>
      profileService.changePassword(data),
    onSuccess: () => {
      toast.success('Password changed successfully!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to change password');
    }
  });

  return {
    // Data
    profile,
    isLoading,
    error,
    
    // Actions
    refetchProfile: refetch,
    updateProfile: updateProfileMutation.mutate,
    updatePreferences: updatePreferencesMutation.mutate,
    uploadAvatar: uploadAvatarMutation.mutate,
    removeAvatar: removeAvatarMutation.mutate,
    changePassword: changePasswordMutation.mutate,
    
    // Loading states
    isUpdatingProfile: updateProfileMutation.isPending,
    isUpdatingPreferences: updatePreferencesMutation.isPending,
    isUploadingAvatar: uploadAvatarMutation.isPending,
    isRemovingAvatar: removeAvatarMutation.isPending,
    isChangingPassword: changePasswordMutation.isPending,
    
    // Utils
    invalidateProfile: () => queryClient.invalidateQueries({ queryKey: ['profile'] }),
  };
};

export const useActiveSessions = () => {
  const queryClient = useQueryClient();

  const {
    data: sessions,
    isLoading,
    error
  } = useQuery({
    queryKey: ['profile', 'sessions'],
    queryFn: async () => {
      const response = await profileService.getActiveSessions();
      return response.data;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  const revokeSessionMutation = useMutation({
    mutationFn: (sessionId: string) => profileService.revokeSession(sessionId),
    onSuccess: (_, sessionId) => {
      queryClient.setQueryData(['profile', 'sessions'], (old: any[]) => 
        old?.filter(session => session.id !== sessionId) || []
      );
      toast.success('Session revoked successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to revoke session');
    }
  });

  const revokeAllSessionsMutation = useMutation({
    mutationFn: () => profileService.revokeAllSessions(),
    onSuccess: () => {
      toast.success('All sessions revoked successfully');
      // Note: User will likely be logged out after this
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to revoke all sessions');
    }
  });

  return {
    sessions,
    isLoading,
    error,
    revokeSession: revokeSessionMutation.mutate,
    revokeAllSessions: revokeAllSessionsMutation.mutate,
    isRevokingSession: revokeSessionMutation.isPending,
    isRevokingAllSessions: revokeAllSessionsMutation.isPending,
  };
};

export const useTwoFactorAuth = () => {
  const queryClient = useQueryClient();

  const setupMutation = useMutation({
    mutationFn: () => profileService.setupTwoFactor(),
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to setup 2FA');
    }
  });

  const verifyMutation = useMutation({
    mutationFn: (verificationCode: string) => profileService.verifyTwoFactor(verificationCode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success('Two-factor authentication enabled!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Invalid verification code');
    }
  });

  const disableMutation = useMutation({
    mutationFn: (password: string) => profileService.disableTwoFactor(password),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success('Two-factor authentication disabled');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to disable 2FA');
    }
  });

  const regenerateCodesMutation = useMutation({
    mutationFn: () => profileService.regenerateBackupCodes(),
    onSuccess: () => {
      toast.success('Backup codes regenerated');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to regenerate codes');
    }
  });

  return {
    setup2FA: setupMutation.mutate,
    verify2FA: verifyMutation.mutate,
    disable2FA: disableMutation.mutate,
    regenerateBackupCodes: regenerateCodesMutation.mutate,
    
    isSettingUp: setupMutation.isPending,
    isVerifying: verifyMutation.isPending,
    isDisabling: disableMutation.isPending,
    isRegenerating: regenerateCodesMutation.isPending,
    
    setupData: setupMutation.data?.data,
    backupCodes: regenerateCodesMutation.data?.data?.backup_codes,
  };
};