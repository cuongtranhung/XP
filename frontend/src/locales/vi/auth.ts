export default {
  // Login page
  login: {
    title: 'Đăng nhập',
    subtitle: 'Chào mừng trở lại! Vui lòng đăng nhập vào tài khoản của bạn',
    email: 'Địa chỉ email',
    emailPlaceholder: 'Nhập email của bạn',
    password: 'Mật khẩu',
    passwordPlaceholder: 'Nhập mật khẩu của bạn',
    rememberMe: 'Ghi nhớ đăng nhập',
    forgotPassword: 'Quên mật khẩu?',
    signIn: 'Đăng nhập',
    noAccount: 'Chưa có tài khoản?',
    signUp: 'Đăng ký',
    signInWith: 'Hoặc đăng nhập với',
    google: 'Google',
    facebook: 'Facebook',
    github: 'GitHub'
  },

  // Register page
  register: {
    title: 'Tạo tài khoản',
    subtitle: 'Bắt đầu với tài khoản miễn phí của bạn',
    fullName: 'Họ và tên',
    fullNamePlaceholder: 'Nhập họ và tên của bạn',
    email: 'Địa chỉ email',
    emailPlaceholder: 'Nhập email của bạn',
    password: 'Mật khẩu',
    passwordPlaceholder: 'Tạo mật khẩu',
    confirmPassword: 'Xác nhận mật khẩu',
    confirmPasswordPlaceholder: 'Xác nhận mật khẩu của bạn',
    agreeTerms: 'Tôi đồng ý với Điều khoản dịch vụ và Chính sách bảo mật',
    createAccount: 'Tạo tài khoản',
    haveAccount: 'Đã có tài khoản?',
    signIn: 'Đăng nhập',
    signUpWith: 'Hoặc đăng ký với'
  },

  // Forgot password
  forgotPassword: {
    title: 'Đặt lại mật khẩu',
    subtitle: 'Nhập email của bạn để nhận liên kết đặt lại mật khẩu',
    email: 'Địa chỉ email',
    emailPlaceholder: 'Nhập email của bạn',
    sendLink: 'Gửi liên kết đặt lại',
    backToLogin: 'Quay lại đăng nhập',
    checkEmail: 'Kiểm tra email của bạn',
    checkEmailText: 'Chúng tôi đã gửi liên kết đặt lại mật khẩu đến địa chỉ email của bạn.',
    resendLink: 'Gửi lại liên kết',
    linkExpires: 'Liên kết này sẽ hết hạn trong 24 giờ'
  },

  // Reset password
  resetPassword: {
    title: 'Đặt lại mật khẩu',
    subtitle: 'Nhập mật khẩu mới của bạn',
    password: 'Mật khẩu mới',
    passwordPlaceholder: 'Nhập mật khẩu mới',
    confirmPassword: 'Xác nhận mật khẩu',
    confirmPasswordPlaceholder: 'Xác nhận mật khẩu mới',
    resetPassword: 'Đặt lại mật khẩu',
    backToLogin: 'Quay lại đăng nhập'
  },

  // Profile
  profile: {
    title: 'Cài đặt hồ sơ',
    personalInfo: 'Thông tin cá nhân',
    fullName: 'Họ và tên',
    email: 'Địa chỉ email',
    phone: 'Số điện thoại',
    avatar: 'Ảnh đại diện',
    changeAvatar: 'Thay đổi ảnh',
    removeAvatar: 'Xóa ảnh',
    
    // Security
    security: 'Bảo mật',
    currentPassword: 'Mật khẩu hiện tại',
    newPassword: 'Mật khẩu mới',
    confirmNewPassword: 'Xác nhận mật khẩu mới',
    changePassword: 'Đổi mật khẩu',
    lastLogin: 'Đăng nhập lần cuối',
    accountCreated: 'Tài khoản được tạo',
    
    // Preferences
    preferences: 'Tùy chọn',
    language: 'Ngôn ngữ',
    timezone: 'Múi giờ',
    dateFormat: 'Định dạng ngày',
    timeFormat: 'Định dạng thời gian',
    emailNotifications: 'Thông báo email',
    pushNotifications: 'Thông báo đẩy',
    
    // Account
    account: 'Cài đặt tài khoản',
    deleteAccount: 'Xóa tài khoản',
    deleteAccountWarning: 'Hành động này là vĩnh viễn và không thể hoàn tác',
    confirmDeleteAccount: 'Nhập "DELETE" để xác nhận xóa tài khoản'
  },

  // Messages
  messages: {
    loginSuccess: 'Chào mừng trở lại!',
    loginError: 'Email hoặc mật khẩu không hợp lệ',
    registerSuccess: 'Tạo tài khoản thành công',
    registerError: 'Không thể tạo tài khoản',
    resetLinkSent: 'Đã gửi liên kết đặt lại mật khẩu',
    resetLinkError: 'Không thể gửi liên kết đặt lại',
    passwordResetSuccess: 'Đặt lại mật khẩu thành công',
    passwordResetError: 'Không thể đặt lại mật khẩu',
    profileUpdateSuccess: 'Cập nhật hồ sơ thành công',
    profileUpdateError: 'Không thể cập nhật hồ sơ',
    passwordChangeSuccess: 'Đổi mật khẩu thành công',
    passwordChangeError: 'Không thể đổi mật khẩu',
    invalidCurrentPassword: 'Mật khẩu hiện tại không chính xác',
    weakPassword: 'Mật khẩu quá yếu',
    emailExists: 'Tài khoản với email này đã tồn tại',
    invalidEmail: 'Vui lòng nhập địa chỉ email hợp lệ',
    invalidResetToken: 'Mã đặt lại không hợp lệ hoặc đã hết hạn',
    accountDeleted: 'Xóa tài khoản thành công'
  },

  // Validation messages
  validation: {
    emailRequired: 'Email là bắt buộc',
    emailInvalid: 'Vui lòng nhập địa chỉ email hợp lệ',
    passwordRequired: 'Mật khẩu là bắt buộc',
    passwordMinLength: 'Mật khẩu phải có ít nhất 8 ký tự',
    passwordsNoMatch: 'Mật khẩu không khớp',
    fullNameRequired: 'Họ và tên là bắt buộc',
    termsRequired: 'Bạn phải đồng ý với các điều khoản và điều kiện',
    currentPasswordRequired: 'Mật khẩu hiện tại là bắt buộc',
    newPasswordRequired: 'Mật khẩu mới là bắt buộc'
  }
};