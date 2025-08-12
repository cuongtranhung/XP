export default {
  // Page titles and headers
  title: 'Biểu mẫu',
  createForm: 'Tạo biểu mẫu',
  editForm: 'Chỉnh sửa biểu mẫu',
  formBuilder: 'Trình tạo biểu mẫu',
  formSettings: 'Cài đặt biểu mẫu',
  formSubmissions: 'Phản hồi biểu mẫu',
  submissionDetails: 'Chi tiết phản hồi',

  // Form list
  list: {
    title: 'Biểu mẫu',
    createButton: 'Tạo biểu mẫu',
    searchPlaceholder: 'Tìm kiếm biểu mẫu...',
    noForms: 'Không tìm thấy biểu mẫu',
    noFormsSubtext: 'Bắt đầu bằng cách tạo biểu mẫu đầu tiên của bạn',
    tryAdjustFilters: 'Thử điều chỉnh tìm kiếm hoặc bộ lọc của bạn',
    columns: {
      name: 'Tên biểu mẫu',
      status: 'Trạng thái',
      submissions: 'Phản hồi',
      created: 'Đã tạo',
      lastModified: 'Sửa đổi lần cuối',
      actions: 'Hành động'
    }
  },

  // Form actions
  actions: {
    edit: 'Thiết kế',
    preview: 'Xem trước',
    submissions: 'Phản hồi',
    tableView: 'Xem dạng bảng',
    duplicate: 'Sao chép',
    publish: 'Xuất bản',
    archive: 'Lưu trữ',
    restore: 'Khôi phục',
    delete: 'Xóa',
    share: 'Chia sẻ',
    embed: 'Nhúng',
    export: 'Xuất'
  },

  // Form builder
  builder: {
    title: 'Trình tạo biểu mẫu',
    elements: 'Phần tử',
    properties: 'Thuộc tính',
    preview: 'Xem trước',
    settings: 'Cài đặt',
    saveForm: 'Lưu biểu mẫu',
    publishForm: 'Xuất bản biểu mẫu',
    previewForm: 'Xem trước biểu mẫu',
    
    // Form elements
    elementTypes: {
      text: 'Nhập văn bản',
      textarea: 'Vùng văn bản',
      email: 'Email',
      number: 'Số',
      phone: 'Điện thoại',
      date: 'Ngày',
      time: 'Thời gian',
      select: 'Danh sách thả xuống',
      multiselect: 'Chọn nhiều',
      radio: 'Nút radio',
      checkbox: 'Hộp kiểm',
      file: 'Tải tệp lên',
      image: 'Tải hình ảnh lên',
      rating: 'Đánh giá',
      slider: 'Thanh trượt',
      divider: 'Phân cách',
      heading: 'Tiêu đề',
      paragraph: 'Đoạn văn'
    },

    // Properties panel
    fieldProperties: {
      general: 'Chung',
      label: 'Nhãn',
      placeholder: 'Chỗ giữ chỗ',
      description: 'Mô tả',
      required: 'Bắt buộc',
      validation: 'Xác thực',
      options: 'Tùy chọn',
      appearance: 'Giao diện',
      advanced: 'Nâng cao',
      defaultValue: 'Giá trị mặc định',
      minLength: 'Độ dài tối thiểu',
      maxLength: 'Độ dài tối đa',
      min: 'Giá trị tối thiểu',
      max: 'Giá trị tối đa',
      step: 'Bước',
      multiple: 'Cho phép nhiều',
      accept: 'Loại tệp chấp nhận',
      maxFileSize: 'Kích thước tệp tối đa',
      width: 'Chiều rộng',
      height: 'Chiều cao',
      alignment: 'Căn chỉnh'
    }
  },

  // Form settings
  settings: {
    title: 'Cài đặt biểu mẫu',
    basic: 'Cài đặt cơ bản',
    advanced: 'Cài đặt nâng cao',
    notifications: 'Thông báo',
    integrations: 'Tích hợp',
    
    // Basic settings
    formName: 'Tên biểu mẫu',
    formDescription: 'Mô tả biểu mẫu',
    formSlug: 'URL biểu mẫu',
    formStatus: 'Trạng thái biểu mẫu',
    allowMultipleSubmissions: 'Cho phép gửi nhiều lần',
    requireAuth: 'Yêu cầu xác thực',
    
    // Advanced settings
    submitButtonText: 'Văn bản nút gửi',
    successMessage: 'Thông báo thành công',
    redirectUrl: 'URL chuyển hướng sau khi gửi',
    customCss: 'CSS tùy chỉnh',
    customJs: 'JavaScript tùy chỉnh',
    
    // Notifications
    emailNotifications: 'Thông báo email',
    notifyOnSubmission: 'Thông báo khi có phản hồi mới',
    notificationEmail: 'Email thông báo',
    autoReply: 'Tự động trả lời người gửi',
    autoReplySubject: 'Tiêu đề tự động trả lời',
    autoReplyMessage: 'Tin nhắn tự động trả lời'
  },

  // Submissions
  submissions: {
    title: 'Phản hồi biểu mẫu',
    noSubmissions: 'Chưa có phản hồi',
    noSubmissionsSubtext: 'Phản hồi sẽ xuất hiện ở đây khi biểu mẫu của bạn nhận được câu trả lời',
    totalSubmissions: 'Tổng số phản hồi',
    exportSubmissions: 'Xuất phản hồi',
    viewSubmission: 'Xem phản hồi',
    deleteSubmission: 'Xóa phản hồi',
    submittedAt: 'Thời gian gửi',
    submittedBy: 'Người gửi',
    ipAddress: 'Địa chỉ IP',
    userAgent: 'User Agent',
    
    // Table view
    tableView: {
      title: 'Xem dạng bảng phản hồi',
      exportCsv: 'Xuất CSV',
      exportExcel: 'Xuất Excel',
      showColumns: 'Hiển thị cột',
      pagination: {
        showing: 'Hiển thị {{start}} đến {{end}} trong {{total}} phản hồi',
        itemsPerPage: 'Mục trên mỗi trang'
      }
    }
  },

  // Messages
  messages: {
    formSaved: 'Đã lưu biểu mẫu thành công',
    formPublished: 'Đã xuất bản biểu mẫu thành công',
    formArchived: 'Đã lưu trữ biểu mẫu thành công',
    formDeleted: 'Đã xóa biểu mẫu thành công',
    formDuplicated: 'Đã sao chép biểu mẫu thành công',
    submissionDeleted: 'Đã xóa phản hồi thành công',
    saveError: 'Không thể lưu biểu mẫu',
    publishError: 'Không thể xuất bản biểu mẫu',
    loadError: 'Không thể tải biểu mẫu',
    deleteError: 'Không thể xóa biểu mẫu',
    confirmDelete: 'Bạn có chắc chắn muốn xóa biểu mẫu này không? Hành động này không thể hoàn tác và tất cả phản hồi sẽ bị xóa vĩnh viễn.',
    confirmDeleteSubmission: 'Bạn có chắc chắn muốn xóa phản hồi này không? Hành động này không thể hoàn tác.',
    confirmArchive: 'Bạn có chắc chắn muốn lưu trữ biểu mẫu này không?',
    confirmPublish: 'Bạn có chắc chắn muốn xuất bản biểu mẫu này không? Nó sẽ có thể truy cập được bởi công chúng.',
    duplicateSuccess: 'Biểu mẫu đã được sao chép thành công'
  }
};