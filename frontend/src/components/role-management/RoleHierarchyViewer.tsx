import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { Role } from '../../types/role-management';
import roleManagementService from '../../services/roleManagementService';
import { LoadingSpinner } from '../common/LoadingSpinner';
import RoleBadge from './RoleBadge';

interface RoleNode {
  role: Role;
  children: RoleNode[];
  userCount: number;
  level: number;
}

interface RoleHierarchyViewerProps {
  className?: string;
}

const RoleHierarchyViewer: React.FC<RoleHierarchyViewerProps> = ({ className = '' }) => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [hierarchy, setHierarchy] = useState<RoleNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'tree' | 'pyramid' | 'list'>('tree');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // Load roles and build hierarchy
  useEffect(() => {
    loadRolesAndBuildHierarchy();
  }, []);

  const loadRolesAndBuildHierarchy = async () => {
    try {
      setLoading(true);
      const response = await roleManagementService.getRoles({});
      
      if (response.success && response.data) {
        const rolesData = response.data;
        setRoles(rolesData);
        
        // Build hierarchy based on priority levels
        const hierarchyData = await buildHierarchy(rolesData);
        setHierarchy(hierarchyData);
        
        // Auto-expand top level nodes
        const topLevelIds = hierarchyData.map(node => node.role.id);
        setExpandedNodes(new Set(topLevelIds));
      }
    } catch (error) {
      console.error('Error loading roles:', error);
      toast.error('Không thể tải cấu trúc vai trò');
    } finally {
      setLoading(false);
    }
  };

  const buildHierarchy = async (roles: Role[]): Promise<RoleNode[]> => {
    // Sort roles by priority (highest first)
    const sortedRoles = [...roles].sort((a, b) => b.priority - a.priority);
    
    // Define priority tiers
    const tiers = {
      superAdmin: { min: 900, max: 1000, level: 0 },
      admin: { min: 700, max: 899, level: 1 },
      manager: { min: 400, max: 699, level: 2 },
      user: { min: 100, max: 399, level: 3 },
      guest: { min: 1, max: 99, level: 4 }
    };
    
    // Group roles by tier
    const hierarchy: RoleNode[] = [];
    const processedRoles = new Set<string>();
    
    // Process each tier
    Object.values(tiers).forEach(tier => {
      const tierRoles = sortedRoles.filter(role => 
        role.priority >= tier.min && 
        role.priority <= tier.max && 
        !processedRoles.has(role.id)
      );
      
      tierRoles.forEach(role => {
        processedRoles.add(role.id);
        
        // Get user count for this role
        const userCount = Math.floor(Math.random() * 50); // Mock data - in real app, fetch from API
        
        const node: RoleNode = {
          role,
          children: [],
          userCount,
          level: tier.level
        };
        
        // Find parent node (role with next higher priority in previous tier)
        if (tier.level > 0) {
          const parentNode = findParentNode(hierarchy, role, tier.level - 1);
          if (parentNode) {
            parentNode.children.push(node);
          } else {
            hierarchy.push(node);
          }
        } else {
          hierarchy.push(node);
        }
      });
    });
    
    return hierarchy;
  };

  const findParentNode = (nodes: RoleNode[], role: Role, targetLevel: number): RoleNode | null => {
    for (const node of nodes) {
      if (node.level === targetLevel && node.role.priority > role.priority) {
        return node;
      }
      const found = findParentNode(node.children, role, targetLevel);
      if (found) return found;
    }
    return null;
  };

  const toggleNodeExpansion = (nodeId: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  const renderTreeNode = (node: RoleNode, depth: number = 0): JSX.Element => {
    const isExpanded = expandedNodes.has(node.role.id);
    const hasChildren = node.children.length > 0;
    
    return (
      <div key={node.role.id} className={`${depth > 0 ? 'ml-6' : ''}`}>
        <div className="flex items-center space-x-2 p-3 hover:bg-gray-50 rounded-lg">
          {/* Expand/Collapse Button */}
          {hasChildren && (
            <button
              onClick={() => toggleNodeExpansion(node.role.id)}
              className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-gray-700"
            >
              {isExpanded ? '▼' : '▶'}
            </button>
          )}
          {!hasChildren && <div className="w-6" />}
          
          {/* Role Badge */}
          <RoleBadge role={node.role} size="sm" />
          
          {/* Role Info */}
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <span className="font-medium text-gray-900">{node.role.display_name}</span>
              <span className="text-xs text-gray-500">Priority: {node.role.priority}</span>
              {node.role.is_system && (
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  🔒 Hệ thống
                </span>
              )}
            </div>
            {node.role.description && (
              <p className="text-sm text-gray-600 mt-1">{node.role.description}</p>
            )}
          </div>
          
          {/* User Count */}
          <div className="text-right">
            <div className="text-lg font-semibold text-gray-700">{node.userCount}</div>
            <div className="text-xs text-gray-500">users</div>
          </div>
        </div>
        
        {/* Children */}
        {isExpanded && hasChildren && (
          <div className="border-l-2 border-gray-200 ml-3">
            {node.children.map(child => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const renderPyramidView = () => {
    // Group roles by priority level
    const levels: { [key: string]: Role[] } = {
      'Super Admin (900-1000)': roles.filter(r => r.priority >= 900),
      'Admin (700-899)': roles.filter(r => r.priority >= 700 && r.priority < 900),
      'Manager (400-699)': roles.filter(r => r.priority >= 400 && r.priority < 700),
      'User (100-399)': roles.filter(r => r.priority >= 100 && r.priority < 400),
      'Guest (1-99)': roles.filter(r => r.priority < 100)
    };
    
    return (
      <div className="space-y-4">
        {Object.entries(levels).map(([levelName, levelRoles]) => {
          if (levelRoles.length === 0) return null;
          
          return (
            <div key={levelName} className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-3">{levelName}</h4>
              <div className="flex flex-wrap gap-2">
                {levelRoles.map(role => (
                  <div key={role.id} className="bg-white border rounded-lg p-3">
                    <RoleBadge role={role} size="sm" />
                    <div className="mt-1 text-xs text-gray-600">
                      {role.display_name}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderListView = () => {
    const sortedRoles = [...roles].sort((a, b) => b.priority - a.priority);
    
    return (
      <div className="space-y-2">
        {sortedRoles.map(role => {
          const level = 
            role.priority >= 900 ? 0 :
            role.priority >= 700 ? 1 :
            role.priority >= 400 ? 2 :
            role.priority >= 100 ? 3 : 4;
          
          return (
            <div 
              key={role.id} 
              className="flex items-center space-x-3 p-3 bg-white border rounded-lg hover:bg-gray-50"
              style={{ marginLeft: `${level * 24}px` }}
            >
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${
                  level === 0 ? 'bg-red-500' :
                  level === 1 ? 'bg-orange-500' :
                  level === 2 ? 'bg-yellow-500' :
                  level === 3 ? 'bg-green-500' : 'bg-gray-500'
                }`} />
                <RoleBadge role={role} size="sm" />
              </div>
              <div className="flex-1">
                <div className="font-medium text-gray-900">{role.display_name}</div>
                <div className="text-xs text-gray-500">
                  Priority: {role.priority} • {role.is_system ? 'Hệ thống' : 'Tùy chỉnh'}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border ${className}`}>
        <div className="p-6">
          <div className="flex justify-center items-center py-12">
            <LoadingSpinner size="lg" />
            <span className="ml-3 text-gray-600">Đang tải cấu trúc vai trò...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm border ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-medium text-gray-900">
              🏗️ Cấu Trúc Phân Cấp Vai Trò
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Visualize vai trò theo cấp độ ưu tiên và quan hệ
            </p>
          </div>
          
          {/* View Mode Selector */}
          <div className="flex bg-gray-100 rounded-md p-1">
            <button
              onClick={() => setViewMode('tree')}
              className={`px-3 py-1 text-xs font-medium rounded ${
                viewMode === 'tree'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              🌳 Cây
            </button>
            <button
              onClick={() => setViewMode('pyramid')}
              className={`px-3 py-1 text-xs font-medium rounded ${
                viewMode === 'pyramid'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              📊 Kim tự tháp
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1 text-xs font-medium rounded ${
                viewMode === 'list'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              📋 Danh sách
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {viewMode === 'tree' && (
          <div className="space-y-2">
            {hierarchy.length > 0 ? (
              hierarchy.map(node => renderTreeNode(node))
            ) : (
              <p className="text-gray-500 text-center py-8">
                Không có dữ liệu cấu trúc vai trò
              </p>
            )}
          </div>
        )}
        
        {viewMode === 'pyramid' && renderPyramidView()}
        
        {viewMode === 'list' && renderListView()}
      </div>

      {/* Legend */}
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
        <div className="flex items-center justify-between text-xs text-gray-600">
          <div className="flex items-center space-x-4">
            <span className="font-medium">Chú thích:</span>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              <span>Super Admin</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
              <span>Admin</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
              <span>Manager</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>User</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
              <span>Guest</span>
            </div>
          </div>
          <div>
            Tổng: {roles.length} vai trò
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoleHierarchyViewer;