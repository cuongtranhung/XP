import * as XLSX from 'xlsx';
import { Group, UserForGroupAssignment } from '../types/group-management';
import groupManagementService from './groupManagementService';

class ExportService {
  /**
   * Export groups data to Excel
   */
  async exportGroupsToExcel(groups: Group[], filename: string = 'groups_export'): Promise<void> {
    try {
      // Prepare data for export
      const exportData = groups.map(group => ({
        'ID': group.id,
        'Tên nhóm': group.name,
        'Tên hiển thị': group.display_name || '',
        'Mô tả': group.description || '',
        'Loại nhóm': this.getGroupTypeText(group.group_type),
        'Trạng thái': group.is_active ? 'Hoạt động' : 'Không hoạt động',
        'Nhóm hệ thống': group.is_system ? 'Có' : 'Không',
        'Số thành viên': group.member_count || 0,
        'Ngày tạo': group.created_at ? new Date(group.created_at).toLocaleDateString('vi-VN') : '',
        'Ngày cập nhật': group.updated_at ? new Date(group.updated_at).toLocaleDateString('vi-VN') : ''
      }));

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);

      // Set column widths
      const colWidths = [
        { wch: 15 }, // ID
        { wch: 20 }, // Tên nhóm
        { wch: 30 }, // Tên hiển thị
        { wch: 40 }, // Mô tả
        { wch: 15 }, // Loại nhóm
        { wch: 15 }, // Trạng thái
        { wch: 15 }, // Nhóm hệ thống
        { wch: 12 }, // Số thành viên
        { wch: 15 }, // Ngày tạo
        { wch: 15 }  // Ngày cập nhật
      ];
      ws['!cols'] = colWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Danh sách nhóm');

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const fullFilename = `${filename}_${timestamp}.xlsx`;

      // Download file
      XLSX.writeFile(wb, fullFilename);
      
      return Promise.resolve();
    } catch (error) {
      console.error('Error exporting groups to Excel:', error);
      throw new Error('Không thể xuất dữ liệu ra Excel');
    }
  }

  /**
   * Export group members to Excel
   */
  async exportGroupMembersToExcel(
    groupId: string, 
    groupName: string,
    members: UserForGroupAssignment[],
    filename?: string
  ): Promise<void> {
    try {
      // Prepare data for export
      const exportData = members.map(member => ({
        'ID': member.id,
        'Email': member.email,
        'Họ tên': member.full_name || 'Chưa có tên',
        'Phòng ban': member.department || '',
        'Chức vụ': member.position || '',
        'Vai trò trong nhóm': this.getRoleText(member.role_in_group),
        'Trạng thái': member.is_blocked ? 'Bị khóa' : 
                     member.is_approved === false ? 'Chờ duyệt' : 'Hoạt động',
        'Ngày tham gia': member.joined_at ? 
          new Date(member.joined_at).toLocaleDateString('vi-VN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          }) : ''
      }));

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);

      // Set column widths
      const colWidths = [
        { wch: 15 }, // ID
        { wch: 30 }, // Email
        { wch: 25 }, // Họ tên
        { wch: 20 }, // Phòng ban
        { wch: 20 }, // Chức vụ
        { wch: 18 }, // Vai trò trong nhóm
        { wch: 15 }, // Trạng thái
        { wch: 20 }  // Ngày tham gia
      ];
      ws['!cols'] = colWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Thành viên nhóm');

      // Generate filename
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const fullFilename = filename || `thanh_vien_${groupName}_${timestamp}.xlsx`;

      // Download file
      XLSX.writeFile(wb, fullFilename);
      
      return Promise.resolve();
    } catch (error) {
      console.error('Error exporting group members to Excel:', error);
      throw new Error('Không thể xuất dữ liệu thành viên ra Excel');
    }
  }

  /**
   * Export comprehensive group report with statistics
   */
  async exportComprehensiveReport(): Promise<void> {
    try {
      // Get all groups and statistics
      const [groupsResponse, statsResponse] = await Promise.all([
        groupManagementService.getGroups(),
        groupManagementService.getGroupStatistics()
      ]);

      if (!groupsResponse.success || !statsResponse.success) {
        throw new Error('Không thể tải dữ liệu để xuất báo cáo');
      }

      const groups = groupsResponse.data;
      const statistics = statsResponse.data;

      // Create workbook
      const wb = XLSX.utils.book_new();

      // Sheet 1: Statistics Summary
      const summaryData = [
        ['Thống kê tổng quan', ''],
        ['Tổng số nhóm', statistics.totalGroups],
        ['Tổng số thành viên', statistics.totalMembers],
        ['', ''],
        ['Theo loại nhóm', ''],
        ['Nhóm hệ thống', `${statistics.groupsByType.system?.total || 0} (Hoạt động: ${statistics.groupsByType.system?.active || 0})`],
        ['Nhóm phòng ban', `${statistics.groupsByType.department?.total || 0} (Hoạt động: ${statistics.groupsByType.department?.active || 0})`],
        ['Nhóm dự án', `${statistics.groupsByType.project?.total || 0} (Hoạt động: ${statistics.groupsByType.project?.active || 0})`],
        ['Nhóm tùy chỉnh', `${statistics.groupsByType.custom?.total || 0} (Hoạt động: ${statistics.groupsByType.custom?.active || 0})`],
        ['', ''],
        ['Theo trạng thái', ''],
        ['Nhóm hoạt động', statistics.groupsByStatus.active || 0],
        ['Nhóm không hoạt động', statistics.groupsByStatus.inactive || 0]
      ];

      const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
      summaryWs['!cols'] = [{ wch: 25 }, { wch: 30 }];
      XLSX.utils.book_append_sheet(wb, summaryWs, 'Thống kê tổng quan');

      // Sheet 2: All Groups
      const groupsData = groups.map(group => ({
        'ID': group.id,
        'Tên nhóm': group.name,
        'Tên hiển thị': group.display_name || '',
        'Mô tả': group.description || '',
        'Loại nhóm': this.getGroupTypeText(group.group_type),
        'Trạng thái': group.is_active ? 'Hoạt động' : 'Không hoạt động',
        'Nhóm hệ thống': group.is_system ? 'Có' : 'Không',
        'Số thành viên': group.member_count || 0,
        'Ngày tạo': group.created_at ? new Date(group.created_at).toLocaleDateString('vi-VN') : '',
        'Ngày cập nhật': group.updated_at ? new Date(group.updated_at).toLocaleDateString('vi-VN') : ''
      }));

      const groupsWs = XLSX.utils.json_to_sheet(groupsData);
      groupsWs['!cols'] = [
        { wch: 15 }, { wch: 20 }, { wch: 30 }, { wch: 40 }, 
        { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, 
        { wch: 15 }, { wch: 15 }
      ];
      XLSX.utils.book_append_sheet(wb, groupsWs, 'Danh sách nhóm');

      // Generate filename
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const filename = `bao_cao_nhom_tong_hop_${timestamp}.xlsx`;

      // Download file
      XLSX.writeFile(wb, filename);
      
      return Promise.resolve();
    } catch (error) {
      console.error('Error exporting comprehensive report:', error);
      throw new Error('Không thể xuất báo cáo tổng hợp');
    }
  }

  private getGroupTypeText(type: string): string {
    switch (type) {
      case 'system': return 'Hệ thống';
      case 'department': return 'Phòng ban';
      case 'project': return 'Dự án';
      case 'custom': return 'Tùy chỉnh';
      default: return type;
    }
  }

  private getRoleText(role?: string): string {
    switch (role) {
      case 'owner': return 'Chủ sở hữu';
      case 'manager': return 'Quản lý';
      case 'member': return 'Thành viên';
      default: return 'Thành viên';
    }
  }
}

const exportService = new ExportService();
export default exportService;