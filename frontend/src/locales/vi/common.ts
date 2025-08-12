export default {
  // Navigation
  navigation: {
    dashboard: 'Trang chủ',
    forms: 'Biểu mẫu',
    settings: 'Cài đặt',
    profile: 'Hồ sơ',
    logout: 'Đăng xuất'
  },

  // Actions
  actions: {
    create: 'Tạo mới',
    edit: 'Chỉnh sửa',
    delete: 'Xóa',
    cancel: 'Hủy',
    save: 'Lưu',
    submit: 'Gửi',
    view: 'Xem',
    preview: 'Xem trước',
    duplicate: 'Sao chép',
    publish: 'Xuất bản',
    archive: 'Lưu trữ',
    restore: 'Khôi phục',
    search: 'Tìm kiếm',
    filter: 'Lọc',
    export: 'Xuất',
    import: 'Nhập',
    refresh: 'Làm mới',
    close: 'Đóng',
    back: 'Quay lại',
    next: 'Tiếp theo',
    previous: 'Trước',
    continue: 'Tiếp tục',
    confirm: 'Xác nhận',
    download: 'Tải xuống',
    upload: 'Tải lên',
    copy: 'Sao chép',
    share: 'Chia sẻ',
    help: 'Trợ giúp'
  },

  // Status
  status: {
    published: 'Đã xuất bản',
    draft: 'Bản nháp',
    archived: 'Đã lưu trữ',
    active: 'Hoạt động',
    inactive: 'Không hoạt động',
    pending: 'Chờ xử lý',
    approved: 'Đã duyệt',
    rejected: 'Đã từ chối',
    loading: 'Đang tải...',
    success: 'Thành công',
    error: 'Lỗi',
    warning: 'Cảnh báo',
    info: 'Thông tin'
  },

  // Common UI elements
  ui: {
    allStatus: 'Tất cả trạng thái',
    noResults: 'Không tìm thấy kết quả',
    searchPlaceholder: 'Tìm kiếm...',
    selectLanguage: 'Chọn ngôn ngữ',
    language: 'Ngôn ngữ',
    theme: 'Giao diện',
    lightMode: 'Sáng',
    darkMode: 'Tối',
    systemMode: 'Hệ thống',
    notifications: 'Thông báo',
    account: 'Tài khoản',
    preferences: 'Tùy chọn',
    aboutUs: 'Về chúng tôi',
    contactUs: 'Liên hệ',
    privacyPolicy: 'Chính sách bảo mật',
    termsOfService: 'Điều khoản dịch vụ'
  },

  // Messages
  messages: {
    confirmDelete: 'Bạn có chắc chắn muốn xóa mục này không?',
    confirmArchive: 'Bạn có chắc chắn muốn lưu trữ mục này không?',
    deleteSuccess: 'Đã xóa thành công',
    deleteError: 'Không thể xóa',
    saveSuccess: 'Đã lưu thay đổi thành công',
    saveError: 'Không thể lưu thay đổi',
    loadingError: 'Không thể tải dữ liệu',
    networkError: 'Lỗi kết nối mạng',
    unexpectedError: 'Đã xảy ra lỗi không mong muốn',
    noPermission: 'Bạn không có quyền thực hiện hành động này',
    sessionExpired: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
  },

  // Time and dates
  time: {
    now: 'Bây giờ',
    today: 'Hôm nay',
    yesterday: 'Hôm qua',
    tomorrow: 'Ngày mai',
    thisWeek: 'Tuần này',
    thisMonth: 'Tháng này',
    thisYear: 'Năm này',
    ago: '{{time}} trước',
    in: 'trong {{time}}',
    minutes: 'phút',
    hours: 'giờ',
    days: 'ngày',
    weeks: 'tuần',
    months: 'tháng',
    years: 'năm'
  },

  // Validation
  validation: {
    required: 'Trường này là bắt buộc',
    email: 'Vui lòng nhập địa chỉ email hợp lệ',
    password: 'Mật khẩu phải có ít nhất 8 ký tự',
    passwordConfirm: 'Mật khẩu không khớp',
    minLength: 'Phải có ít nhất {{min}} ký tự',
    maxLength: 'Không được quá {{max}} ký tự',
    min: 'Phải ít nhất {{min}}',
    max: 'Không được quá {{max}}',
    url: 'Vui lòng nhập URL hợp lệ',
    phone: 'Vui lòng nhập số điện thoại hợp lệ'
  }
};