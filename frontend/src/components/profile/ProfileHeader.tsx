import React from 'react';
import { UserProfile } from '../../types/profile';
import Avatar from '../common/Avatar';
import { MapPin, Mail, Phone, Globe, Calendar, Briefcase } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ProfileHeaderProps {
  profile: UserProfile;
  isOwner?: boolean;
  className?: string;
}

const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  profile,
  isOwner = false,
  className = ''
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-gray-100 text-gray-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className={`bg-white rounded-lg shadow-sm border overflow-hidden ${className}`}>
      {/* Cover Image */}
      <div className="h-32 bg-gradient-to-r from-blue-500 to-purple-600 relative">
        {profile.cover_image_url && (
          <img
            src={profile.cover_image_url}
            alt="Cover"
            className="w-full h-full object-cover"
          />
        )}
        
        {/* Status Badge */}
        <div className="absolute top-4 right-4">
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(profile.status)}`}>
            {profile.status}
          </span>
        </div>
      </div>

      {/* Profile Info */}
      <div className="px-6 pb-6">
        {/* Avatar and Basic Info */}
        <div className="flex items-start space-x-6 -mt-12">
          <Avatar
            src={profile.avatar_url}
            name={profile.full_name}
            size="xl"
            className="border-4 border-white shadow-lg"
          />
          
          <div className="flex-1 pt-12">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {profile.full_name}
                </h1>
                <p className="text-gray-600">@{profile.username}</p>
                
                {profile.position && profile.department && (
                  <div className="flex items-center space-x-2 mt-2 text-gray-600">
                    <Briefcase size={16} />
                    <span className="text-sm">
                      {profile.position} at {profile.department}
                    </span>
                  </div>
                )}
              </div>
              
              {/* Verification Badge */}
              {profile.is_verified && (
                <div className="flex items-center space-x-1 text-blue-600">
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-sm font-medium">Verified</span>
                </div>
              )}
            </div>

            {/* Bio */}
            {profile.bio && (
              <p className="text-gray-700 mt-3 max-w-2xl leading-relaxed">
                {profile.bio}
              </p>
            )}

            {/* Contact Information Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
              {profile.email && (
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <Mail size={16} className="text-gray-400" />
                  <span>{profile.email}</span>
                </div>
              )}
              
              {profile.phone && (
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <Phone size={16} className="text-gray-400" />
                  <span>{profile.phone}</span>
                </div>
              )}
              
              {profile.location && (
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <MapPin size={16} className="text-gray-400" />
                  <span>{profile.location}</span>
                </div>
              )}
              
              {profile.website && (
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <Globe size={16} className="text-gray-400" />
                  <a
                    href={profile.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    Website
                  </a>
                </div>
              )}
            </div>

            {/* Social Links */}
            {profile.social_links && (
              <div className="flex items-center space-x-4 mt-4">
                {profile.social_links.linkedin && (
                  <a
                    href={profile.social_links.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800"
                  >
                    LinkedIn
                  </a>
                )}
                {profile.social_links.twitter && (
                  <a
                    href={profile.social_links.twitter}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-600"
                  >
                    Twitter
                  </a>
                )}
                {profile.social_links.github && (
                  <a
                    href={profile.social_links.github}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-800 hover:text-black"
                  >
                    GitHub
                  </a>
                )}
                {profile.social_links.facebook && (
                  <a
                    href={profile.social_links.facebook}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800"
                  >
                    Facebook
                  </a>
                )}
              </div>
            )}

            {/* Metadata */}
            <div className="flex items-center space-x-6 mt-6 text-sm text-gray-500">
              <div className="flex items-center space-x-1">
                <Calendar size={16} />
                <span>Joined {formatDistanceToNow(new Date(profile.created_at))} ago</span>
              </div>
              
              {profile.last_login && (
                <div className="flex items-center space-x-1">
                  <span>Last active {formatDistanceToNow(new Date(profile.last_login))} ago</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileHeader;