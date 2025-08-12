import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { UserProfile, ProfileUpdateData, ProfileFormSection } from '../../types/profile';
import { profileService } from '../../services/profileService';
import Button from '../common/Button';
import Input from '../common/Input';
import AvatarUpload from '../common/AvatarUpload';
import { User, Mail, Phone, MapPin, Globe, Calendar, Briefcase } from 'lucide-react';

interface ProfileFormProps {
  profile: UserProfile;
  onProfileUpdate: (profile: UserProfile) => void;
  className?: string;
}

const ProfileForm: React.FC<ProfileFormProps> = ({
  profile,
  onProfileUpdate,
  className = ''
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [activeSection, setActiveSection] = useState<ProfileFormSection>('basic_info');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile.avatar_url || null);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    setValue,
    watch,
    reset
  } = useForm<ProfileUpdateData>({
    defaultValues: {
      full_name: profile.full_name || '',
      first_name: profile.first_name || '',
      last_name: profile.last_name || '',
      phone: profile.phone || '',
      department: profile.department || '',
      position: profile.position || '',
      bio: profile.bio || '',
      location: profile.location || '',
      website: profile.website || '',
      date_of_birth: profile.date_of_birth || '',
      gender: profile.gender || 'prefer_not_to_say',
      social_links: {
        linkedin: profile.social_links?.linkedin || '',
        twitter: profile.social_links?.twitter || '',
        github: profile.social_links?.github || '',
        facebook: profile.social_links?.facebook || ''
      }
    }
  });

  const sections = [
    { id: 'basic_info', label: 'Basic Info', icon: User },
    { id: 'contact_info', label: 'Contact', icon: Mail },
    { id: 'professional_info', label: 'Professional', icon: Briefcase }
  ] as const;

  const handleAvatarChange = async (file: File | null, optimizedDataUrl?: string) => {
    if (file && optimizedDataUrl) {
      setAvatarFile(file);
      setAvatarPreview(optimizedDataUrl);
      
      try {
        setIsLoading(true);
        const response = await profileService.updateAvatarFromDataUrl(
          optimizedDataUrl, 
          file.name
        );
        
        if (response.success) {
          // Update the avatar preview with the server URL
          setAvatarPreview(response.data.avatar_url);
          
          // Update the profile
          const updatedProfile = { ...profile, avatar_url: response.data.avatar_url };
          onProfileUpdate(updatedProfile);
          
          toast.success('Avatar updated successfully!');
        }
      } catch (error) {
        console.error('Avatar upload failed:', error);
        toast.error('Failed to upload avatar');
        // Reset to previous avatar
        setAvatarPreview(profile.avatar_url || null);
      } finally {
        setIsLoading(false);
        setAvatarFile(null);
      }
    } else if (file === null) {
      // Handle avatar removal
      try {
        setIsLoading(true);
        const response = await profileService.removeAvatar();
        
        if (response.success) {
          setAvatarPreview(null);
          const updatedProfile = { ...profile, avatar_url: null };
          onProfileUpdate(updatedProfile);
          toast.success('Avatar removed successfully!');
        }
      } catch (error) {
        console.error('Avatar removal failed:', error);
        toast.error('Failed to remove avatar');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const onSubmit = async (data: ProfileUpdateData) => {
    try {
      setIsLoading(true);
      const response = await profileService.updateProfile(data);
      
      if (response.success) {
        onProfileUpdate(response.data);
        toast.success('Profile updated successfully!');
        reset(data); // Reset form state to mark as clean
      }
    } catch (error: any) {
      console.error('Profile update failed:', error);
      toast.error(error.response?.data?.message || 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const renderBasicInfo = () => (
    <div className="space-y-6">
      {/* Avatar Upload */}
      <div className="flex justify-center">
        <AvatarUpload
          currentAvatar={avatarPreview}
          onImageChange={handleAvatarChange}
          isLoading={isLoading}
          className="mb-6"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Input
          label="Full Name"
          {...register('full_name', { required: 'Full name is required' })}
          error={errors.full_name?.message}
          leftIcon={<User size={20} />}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="First Name"
            {...register('first_name')}
            error={errors.first_name?.message}
          />
          <Input
            label="Last Name"
            {...register('last_name')}
            error={errors.last_name?.message}
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Gender
          </label>
          <select
            {...register('gender')}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="prefer_not_to_say">Prefer not to say</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>

        <Input
          label="Date of Birth"
          type="date"
          {...register('date_of_birth')}
          error={errors.date_of_birth?.message}
          leftIcon={<Calendar size={20} />}
        />

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Bio
          </label>
          <textarea
            {...register('bio')}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            placeholder="Tell us about yourself..."
          />
          {errors.bio && (
            <p className="text-red-600 text-sm mt-1">{errors.bio.message}</p>
          )}
        </div>
      </div>
    </div>
  );

  const renderContactInfo = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Input
          label="Email"
          type="email"
          value={profile.email}
          disabled
          leftIcon={<Mail size={20} />}
          className="bg-gray-50"
        />

        <Input
          label="Phone"
          type="tel"
          {...register('phone')}
          error={errors.phone?.message}
          leftIcon={<Phone size={20} />}
        />

        <Input
          label="Location"
          {...register('location')}
          error={errors.location?.message}
          leftIcon={<MapPin size={20} />}
          placeholder="City, Country"
        />

        <Input
          label="Website"
          type="url"
          {...register('website')}
          error={errors.website?.message}
          leftIcon={<Globe size={20} />}
          placeholder="https://example.com"
        />
      </div>

      {/* Social Links */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-4">Social Links</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="LinkedIn"
            {...register('social_links.linkedin')}
            placeholder="https://linkedin.com/in/username"
          />
          <Input
            label="Twitter"
            {...register('social_links.twitter')}
            placeholder="https://twitter.com/username"
          />
          <Input
            label="GitHub"
            {...register('social_links.github')}
            placeholder="https://github.com/username"
          />
          <Input
            label="Facebook"
            {...register('social_links.facebook')}
            placeholder="https://facebook.com/username"
          />
        </div>
      </div>
    </div>
  );

  const renderProfessionalInfo = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Input
          label="Department"
          {...register('department')}
          error={errors.department?.message}
          leftIcon={<Briefcase size={20} />}
        />

        <Input
          label="Position"
          {...register('position')}
          error={errors.position?.message}
          leftIcon={<Briefcase size={20} />}
        />
      </div>
    </div>
  );

  const renderActiveSection = () => {
    switch (activeSection) {
      case 'basic_info':
        return renderBasicInfo();
      case 'contact_info':
        return renderContactInfo();
      case 'professional_info':
        return renderProfessionalInfo();
      default:
        return renderBasicInfo();
    }
  };

  return (
    <div className={`bg-white rounded-lg shadow-sm border ${className}`}>
      {/* Section Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8 px-6 pt-6">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeSection === section.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon size={16} />
                <span>{section.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Form Content */}
      <form onSubmit={handleSubmit(onSubmit)} className="p-6">
        {renderActiveSection()}

        {/* Form Actions */}
        <div className="flex items-center justify-end space-x-4 mt-8 pt-6 border-t border-gray-200">
          <Button
            type="button"
            variant="outline"
            onClick={() => reset()}
            disabled={!isDirty || isLoading}
          >
            Reset
          </Button>
          <Button
            type="submit"
            disabled={!isDirty || isLoading}
            isLoading={isLoading}
          >
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ProfileForm;