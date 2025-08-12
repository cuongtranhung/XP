import React from 'react';
import { Role, UserRole } from '../../types/role-management';

interface RoleBadgeProps {
  role: Role;
  userRole?: UserRole; // For expiration info
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showPriority?: boolean;
  showExpiration?: boolean;
  className?: string;
  onClick?: () => void;
}

const RoleBadge: React.FC<RoleBadgeProps> = ({
  role,
  userRole,
  size = 'sm',
  showPriority = false,
  showExpiration = true,
  className = '',
  onClick
}) => {
  // Color coding based on priority
  const getPriorityColor = (priority: number): string => {
    if (priority >= 900) return 'bg-red-100 text-red-800 border-red-200';
    if (priority >= 500) return 'bg-orange-100 text-orange-800 border-orange-200';
    if (priority >= 100) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-gray-100 text-gray-800 border-gray-200';
  };

  // Size classes
  const getSizeClasses = (size: string): string => {
    switch (size) {
      case 'xs': return 'px-1.5 py-0.5 text-xs';
      case 'sm': return 'px-2 py-1 text-xs';
      case 'md': return 'px-2.5 py-1 text-sm';
      case 'lg': return 'px-3 py-1.5 text-sm';
      default: return 'px-2 py-1 text-xs';
    }
  };

  // Check if role is expired
  const isExpired = userRole?.expires_at && new Date(userRole.expires_at) < new Date();
  
  // Calculate days remaining
  const getDaysRemaining = (): number | null => {
    if (!userRole?.expires_at) return null;
    const expiryDate = new Date(userRole.expires_at);
    const now = new Date();
    const diffTime = expiryDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const daysRemaining = getDaysRemaining();

  // Override color if expired
  const colorClass = isExpired 
    ? 'bg-gray-100 text-gray-500 border-gray-200' 
    : role.is_system 
      ? 'bg-blue-100 text-blue-800 border-blue-200'
      : getPriorityColor(role.priority);

  const sizeClass = getSizeClasses(size);
  
  const badgeClasses = `
    inline-flex items-center
    ${sizeClass}
    font-medium
    border
    rounded-full
    ${colorClass}
    ${onClick ? 'cursor-pointer hover:opacity-80' : ''}
    ${className}
  `.trim();

  const renderContent = () => (
    <>
      {/* System role indicator */}
      {role.is_system && <span className="mr-1">🔒</span>}
      
      {/* Role name */}
      <span>{role.display_name}</span>
      
      {/* Priority indicator */}
      {showPriority && (
        <span className="ml-1 opacity-75 text-xs">
          ({role.priority})
        </span>
      )}
      
      {/* Expiration indicator */}
      {showExpiration && userRole?.expires_at && (
        <span className="ml-1">
          {isExpired ? (
            <span className="text-red-500" title="Đã hết hạn">⏰</span>
          ) : daysRemaining !== null && daysRemaining <= 7 ? (
            <span className="text-orange-500" title={`Còn ${daysRemaining} ngày`}>
              ⏰ {daysRemaining}d
            </span>
          ) : (
            <span className="text-gray-400" title={`Hết hạn: ${new Date(userRole.expires_at).toLocaleDateString('vi-VN')}`}>
              ⏰
            </span>
          )}
        </span>
      )}
    </>
  );

  if (onClick) {
    return (
      <button 
        className={badgeClasses}
        onClick={onClick}
        title={role.description || role.display_name}
      >
        {renderContent()}
      </button>
    );
  }

  return (
    <span 
      className={badgeClasses}
      title={role.description || role.display_name}
    >
      {renderContent()}
    </span>
  );
};

export default RoleBadge;