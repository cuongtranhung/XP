import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { Role, CreateRoleRequest } from '../../types/role-management';
import roleManagementService from '../../services/roleManagementService';
import { Button } from '../common/Button';
import { LoadingSpinner } from '../common/LoadingSpinner';
import RoleBadge from './RoleBadge';

interface RoleTemplate {
  id: string;
  name: string;
  display_name: string;
  description: string;
  category: 'business' | 'technical' | 'administrative' | 'custom';
  icon: string;
  baseRole: CreateRoleRequest;
  suggestedPermissions: string[];
}

interface RoleTemplatesProps {
  className?: string;
  onApplyTemplate?: (template: RoleTemplate) => void;
}

const RoleTemplates: React.FC<RoleTemplatesProps> = ({ className = '', onApplyTemplate }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTemplate, setSelectedTemplate] = useState<RoleTemplate | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [applying, setApplying] = useState(false);

  // Predefined templates
  const templates: RoleTemplate[] = [
    // Business Templates
    {
      id: 'ceo',
      name: 'CEO',
      display_name: 'Giám Đốc Điều Hành',
      description: 'Quyền cao nhất trong hệ thống, toàn quyền quản lý',
      category: 'business',
      icon: '👔',
      baseRole: {
        name: 'ceo',
        display_name: 'Giám Đốc Điều Hành',
        description: 'Chief Executive Officer - Toàn quyền quản lý hệ thống',
        priority: 1000
      },
      suggestedPermissions: ['*']
    },
    {
      id: 'cfo',
      name: 'CFO',
      display_name: 'Giám Đốc Tài Chính',
      description: 'Quản lý tài chính, báo cáo, ngân sách',
      category: 'business',
      icon: '💰',
      baseRole: {
        name: 'cfo',
        display_name: 'Giám Đốc Tài Chính',
        description: 'Chief Financial Officer - Quản lý tài chính và ngân sách',
        priority: 950
      },
      suggestedPermissions: ['finance.*', 'reports.*', 'budget.*']
    },
    {
      id: 'sales_manager',
      name: 'Sales Manager',
      display_name: 'Quản Lý Kinh Doanh',
      description: 'Quản lý đội ngũ bán hàng và khách hàng',
      category: 'business',
      icon: '📈',
      baseRole: {
        name: 'sales_manager',
        display_name: 'Quản Lý Kinh Doanh',
        description: 'Quản lý hoạt động kinh doanh và đội ngũ bán hàng',
        priority: 600
      },
      suggestedPermissions: ['sales.*', 'customers.read', 'customers.update', 'reports.sales']
    },
    {
      id: 'hr_manager',
      name: 'HR Manager',
      display_name: 'Quản Lý Nhân Sự',
      description: 'Quản lý nhân viên và tuyển dụng',
      category: 'business',
      icon: '👥',
      baseRole: {
        name: 'hr_manager',
        display_name: 'Quản Lý Nhân Sự',
        description: 'Quản lý nhân sự và hoạt động tuyển dụng',
        priority: 550
      },
      suggestedPermissions: ['users.*', 'departments.*', 'payroll.read']
    },

    // Technical Templates
    {
      id: 'tech_lead',
      name: 'Tech Lead',
      display_name: 'Trưởng Nhóm Kỹ Thuật',
      description: 'Quản lý team dev và review code',
      category: 'technical',
      icon: '👨‍💻',
      baseRole: {
        name: 'tech_lead',
        display_name: 'Trưởng Nhóm Kỹ Thuật',
        description: 'Technical Lead - Quản lý và review kỹ thuật',
        priority: 700
      },
      suggestedPermissions: ['code.*', 'deploy.staging', 'system.read', 'team.manage']
    },
    {
      id: 'developer',
      name: 'Developer',
      display_name: 'Lập Trình Viên',
      description: 'Phát triển và maintain code',
      category: 'technical',
      icon: '💻',
      baseRole: {
        name: 'developer',
        display_name: 'Lập Trình Viên',
        description: 'Software Developer - Phát triển phần mềm',
        priority: 400
      },
      suggestedPermissions: ['code.write', 'code.read', 'deploy.dev', 'tickets.manage']
    },
    {
      id: 'qa_engineer',
      name: 'QA Engineer',
      display_name: 'Kỹ Sư Kiểm Thử',
      description: 'Kiểm thử và đảm bảo chất lượng',
      category: 'technical',
      icon: '🔍',
      baseRole: {
        name: 'qa_engineer',
        display_name: 'Kỹ Sư Kiểm Thử',
        description: 'Quality Assurance Engineer - Kiểm thử phần mềm',
        priority: 350
      },
      suggestedPermissions: ['testing.*', 'bugs.create', 'bugs.update', 'reports.quality']
    },
    {
      id: 'devops',
      name: 'DevOps',
      display_name: 'Kỹ Sư DevOps',
      description: 'Quản lý hạ tầng và deployment',
      category: 'technical',
      icon: '🔧',
      baseRole: {
        name: 'devops',
        display_name: 'Kỹ Sư DevOps',
        description: 'DevOps Engineer - Quản lý hạ tầng và triển khai',
        priority: 650
      },
      suggestedPermissions: ['infrastructure.*', 'deploy.*', 'monitoring.*', 'logs.read']
    },

    // Administrative Templates
    {
      id: 'office_admin',
      name: 'Office Admin',
      display_name: 'Quản Trị Văn Phòng',
      description: 'Quản lý hành chính văn phòng',
      category: 'administrative',
      icon: '📋',
      baseRole: {
        name: 'office_admin',
        display_name: 'Quản Trị Văn Phòng',
        description: 'Office Administrator - Quản lý hành chính',
        priority: 300
      },
      suggestedPermissions: ['office.*', 'supplies.manage', 'calendar.manage']
    },
    {
      id: 'accountant',
      name: 'Accountant',
      display_name: 'Kế Toán',
      description: 'Quản lý sổ sách kế toán',
      category: 'administrative',
      icon: '📊',
      baseRole: {
        name: 'accountant',
        display_name: 'Kế Toán',
        description: 'Accountant - Quản lý kế toán',
        priority: 450
      },
      suggestedPermissions: ['accounting.*', 'invoices.*', 'expenses.*', 'reports.financial']
    },
    {
      id: 'receptionist',
      name: 'Receptionist',
      display_name: 'Lễ Tân',
      description: 'Tiếp khách và hỗ trợ hành chính',
      category: 'administrative',
      icon: '🎯',
      baseRole: {
        name: 'receptionist',
        display_name: 'Lễ Tân',
        description: 'Receptionist - Tiếp khách và hỗ trợ',
        priority: 100
      },
      suggestedPermissions: ['visitors.manage', 'calendar.read', 'announcements.read']
    }
  ];

  // Filter templates by category
  const filteredTemplates = selectedCategory === 'all' 
    ? templates 
    : templates.filter(t => t.category === selectedCategory);

  // Handle template preview
  const handlePreview = (template: RoleTemplate) => {
    setSelectedTemplate(template);
    setIsPreviewOpen(true);
  };

  // Apply template
  const handleApplyTemplate = async (template: RoleTemplate) => {
    try {
      setApplying(true);
      
      // Create role from template
      const response = await roleManagementService.createRole(template.baseRole);
      
      if (response.success) {
        toast.success(`Đã tạo vai trò "${template.display_name}" từ template`);
        
        // Call parent callback if provided
        onApplyTemplate?.(template);
        
        // Close preview
        setIsPreviewOpen(false);
        setSelectedTemplate(null);
      } else {
        toast.error(response.error || 'Không thể áp dụng template');
      }
    } catch (error) {
      console.error('Error applying template:', error);
      toast.error('Lỗi khi áp dụng template');
    } finally {
      setApplying(false);
    }
  };

  // Get category color
  const getCategoryColor = (category: string): string => {
    switch (category) {
      case 'business': return 'bg-blue-100 text-blue-800';
      case 'technical': return 'bg-green-100 text-green-800';
      case 'administrative': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className={`bg-white rounded-lg shadow-sm border ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-medium text-gray-900">
              📑 Template Vai Trò
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Sử dụng template có sẵn để tạo vai trò nhanh chóng
            </p>
          </div>
        </div>
      </div>

      {/* Category Filter */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-gray-700">Danh mục:</span>
          <div className="flex space-x-2">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1 text-sm rounded-md ${
                selectedCategory === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Tất cả ({templates.length})
            </button>
            <button
              onClick={() => setSelectedCategory('business')}
              className={`px-3 py-1 text-sm rounded-md ${
                selectedCategory === 'business'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              👔 Kinh doanh ({templates.filter(t => t.category === 'business').length})
            </button>
            <button
              onClick={() => setSelectedCategory('technical')}
              className={`px-3 py-1 text-sm rounded-md ${
                selectedCategory === 'technical'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              💻 Kỹ thuật ({templates.filter(t => t.category === 'technical').length})
            </button>
            <button
              onClick={() => setSelectedCategory('administrative')}
              className={`px-3 py-1 text-sm rounded-md ${
                selectedCategory === 'administrative'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              📋 Hành chính ({templates.filter(t => t.category === 'administrative').length})
            </button>
          </div>
        </div>
      </div>

      {/* Templates Grid */}
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map(template => (
            <div 
              key={template.id}
              className="bg-gray-50 border rounded-lg p-4 hover:bg-gray-100 cursor-pointer"
              onClick={() => handlePreview(template)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <span className="text-2xl">{template.icon}</span>
                  <div>
                    <h4 className="font-medium text-gray-900">{template.display_name}</h4>
                    <p className="text-xs text-gray-500">{template.name}</p>
                  </div>
                </div>
                <span className={`px-2 py-1 text-xs rounded-full ${getCategoryColor(template.category)}`}>
                  {template.category}
                </span>
              </div>
              
              <p className="text-sm text-gray-600 mb-3">{template.description}</p>
              
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Priority: {template.baseRole.priority}</span>
                <span>{template.suggestedPermissions.length} permissions</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Preview Modal */}
      {isPreviewOpen && selectedTemplate && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">
                  {selectedTemplate.icon} Preview Template: {selectedTemplate.display_name}
                </h3>
                <button
                  onClick={() => setIsPreviewOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
              <div className="space-y-4">
                {/* Template Info */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-3">Thông Tin Template:</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Tên hệ thống:</span>
                      <span className="font-medium">{selectedTemplate.baseRole.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Tên hiển thị:</span>
                      <span className="font-medium">{selectedTemplate.baseRole.display_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Priority:</span>
                      <span className="font-medium">{selectedTemplate.baseRole.priority}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Danh mục:</span>
                      <span className={`px-2 py-1 text-xs rounded-full ${getCategoryColor(selectedTemplate.category)}`}>
                        {selectedTemplate.category}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3">
                    <span className="text-gray-600 text-sm">Mô tả:</span>
                    <p className="text-sm mt-1">{selectedTemplate.baseRole.description}</p>
                  </div>
                </div>

                {/* Suggested Permissions */}
                <div className="bg-blue-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-3">
                    🔑 Quyền Đề Xuất ({selectedTemplate.suggestedPermissions.length}):
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedTemplate.suggestedPermissions.map((perm, index) => (
                      <span 
                        key={index}
                        className="px-2 py-1 bg-white border border-blue-200 rounded text-xs text-blue-800"
                      >
                        {perm}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-blue-600 mt-3">
                    💡 Lưu ý: Quyền sẽ được cấu hình chi tiết ở Phase 3 (Permissions System)
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <div className="flex justify-end space-x-3">
                <Button
                  variant="outline"
                  onClick={() => setIsPreviewOpen(false)}
                  disabled={applying}
                >
                  Đóng
                </Button>
                <Button
                  onClick={() => handleApplyTemplate(selectedTemplate)}
                  disabled={applying}
                >
                  {applying ? <LoadingSpinner size="xs" /> : '✨ Áp Dụng Template'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoleTemplates;