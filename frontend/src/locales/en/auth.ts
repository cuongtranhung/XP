export default {
  // Login page
  login: {
    title: 'Sign In',
    subtitle: 'Welcome back! Please sign in to your account',
    email: 'Email Address',
    emailPlaceholder: 'Enter your email',
    password: 'Password',
    passwordPlaceholder: 'Enter your password',
    rememberMe: 'Remember me',
    forgotPassword: 'Forgot password?',
    signIn: 'Sign In',
    noAccount: "Don't have an account?",
    signUp: 'Sign up',
    signInWith: 'Or sign in with',
    google: 'Google',
    facebook: 'Facebook',
    github: 'GitHub'
  },

  // Register page
  register: {
    title: 'Create Account',
    subtitle: 'Get started with your free account',
    fullName: 'Full Name',
    fullNamePlaceholder: 'Enter your full name',
    email: 'Email Address',
    emailPlaceholder: 'Enter your email',
    password: 'Password',
    passwordPlaceholder: 'Create a password',
    confirmPassword: 'Confirm Password',
    confirmPasswordPlaceholder: 'Confirm your password',
    agreeTerms: 'I agree to the Terms of Service and Privacy Policy',
    createAccount: 'Create Account',
    haveAccount: 'Already have an account?',
    signIn: 'Sign in',
    signUpWith: 'Or sign up with'
  },

  // Forgot password
  forgotPassword: {
    title: 'Reset Password',
    subtitle: 'Enter your email to receive a password reset link',
    email: 'Email Address',
    emailPlaceholder: 'Enter your email',
    sendLink: 'Send Reset Link',
    backToLogin: 'Back to Login',
    checkEmail: 'Check your email',
    checkEmailText: 'We have sent a password reset link to your email address.',
    resendLink: 'Resend link',
    linkExpires: 'This link will expire in 24 hours'
  },

  // Reset password
  resetPassword: {
    title: 'Reset Password',
    subtitle: 'Enter your new password',
    password: 'New Password',
    passwordPlaceholder: 'Enter new password',
    confirmPassword: 'Confirm Password',
    confirmPasswordPlaceholder: 'Confirm new password',
    resetPassword: 'Reset Password',
    backToLogin: 'Back to Login'
  },

  // Profile
  profile: {
    title: 'Profile Settings',
    personalInfo: 'Personal Information',
    fullName: 'Full Name',
    email: 'Email Address',
    phone: 'Phone Number',
    avatar: 'Profile Picture',
    changeAvatar: 'Change Picture',
    removeAvatar: 'Remove Picture',
    
    // Security
    security: 'Security',
    currentPassword: 'Current Password',
    newPassword: 'New Password',
    confirmNewPassword: 'Confirm New Password',
    changePassword: 'Change Password',
    lastLogin: 'Last Login',
    accountCreated: 'Account Created',
    
    // Preferences
    preferences: 'Preferences',
    language: 'Language',
    timezone: 'Timezone',
    dateFormat: 'Date Format',
    timeFormat: 'Time Format',
    emailNotifications: 'Email Notifications',
    pushNotifications: 'Push Notifications',
    
    // Account
    account: 'Account Settings',
    deleteAccount: 'Delete Account',
    deleteAccountWarning: 'This action is permanent and cannot be undone',
    confirmDeleteAccount: 'Type "DELETE" to confirm account deletion'
  },

  // Messages
  messages: {
    loginSuccess: 'Welcome back!',
    loginError: 'Invalid email or password',
    registerSuccess: 'Account created successfully',
    registerError: 'Failed to create account',
    resetLinkSent: 'Password reset link sent',
    resetLinkError: 'Failed to send reset link',
    passwordResetSuccess: 'Password reset successfully',
    passwordResetError: 'Failed to reset password',
    profileUpdateSuccess: 'Profile updated successfully',
    profileUpdateError: 'Failed to update profile',
    passwordChangeSuccess: 'Password changed successfully',
    passwordChangeError: 'Failed to change password',
    invalidCurrentPassword: 'Current password is incorrect',
    weakPassword: 'Password is too weak',
    emailExists: 'An account with this email already exists',
    invalidEmail: 'Please enter a valid email address',
    invalidResetToken: 'Invalid or expired reset token',
    accountDeleted: 'Account deleted successfully'
  },

  // Validation messages
  validation: {
    emailRequired: 'Email is required',
    emailInvalid: 'Please enter a valid email address',
    passwordRequired: 'Password is required',
    passwordMinLength: 'Password must be at least 8 characters',
    passwordsNoMatch: 'Passwords do not match',
    fullNameRequired: 'Full name is required',
    termsRequired: 'You must agree to the terms and conditions',
    currentPasswordRequired: 'Current password is required',
    newPasswordRequired: 'New password is required'
  }
};