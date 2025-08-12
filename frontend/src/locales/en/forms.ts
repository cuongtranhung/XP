export default {
  // Page titles and headers
  title: 'Forms',
  createForm: 'Create Form',
  editForm: 'Edit Form',
  formBuilder: 'Form Builder',
  formSettings: 'Form Settings',
  formSubmissions: 'Form Submissions',
  submissionDetails: 'Submission Details',

  // Form list
  list: {
    title: 'Forms',
    createButton: 'Create Form',
    searchPlaceholder: 'Search forms...',
    noForms: 'No forms found',
    noFormsSubtext: 'Get started by creating your first form',
    tryAdjustFilters: 'Try adjusting your search or filters',
    columns: {
      name: 'Form Name',
      status: 'Status',
      submissions: 'Submissions',
      created: 'Created',
      lastModified: 'Last Modified',
      actions: 'Actions'
    }
  },

  // Form actions
  actions: {
    edit: 'Design',
    preview: 'Preview',
    submissions: 'Submissions',
    tableView: 'View as Table',
    duplicate: 'Duplicate',
    publish: 'Publish',
    archive: 'Archive',
    restore: 'Restore',
    delete: 'Delete',
    share: 'Share',
    embed: 'Embed',
    export: 'Export'
  },

  // Form builder
  builder: {
    title: 'Form Builder',
    elements: 'Elements',
    properties: 'Properties',
    preview: 'Preview',
    settings: 'Settings',
    saveForm: 'Save Form',
    publishForm: 'Publish Form',
    previewForm: 'Preview Form',
    
    // Form elements
    elementTypes: {
      text: 'Text Input',
      textarea: 'Text Area',
      email: 'Email',
      number: 'Number',
      phone: 'Phone',
      date: 'Date',
      time: 'Time',
      select: 'Dropdown',
      multiselect: 'Multi-Select',
      radio: 'Radio Buttons',
      checkbox: 'Checkboxes',
      file: 'File Upload',
      image: 'Image Upload',
      rating: 'Rating',
      slider: 'Slider',
      divider: 'Divider',
      heading: 'Heading',
      paragraph: 'Paragraph'
    },

    // Properties panel
    fieldProperties: {
      general: 'General',
      label: 'Label',
      placeholder: 'Placeholder',
      description: 'Description',
      required: 'Required',
      validation: 'Validation',
      options: 'Options',
      appearance: 'Appearance',
      advanced: 'Advanced',
      defaultValue: 'Default Value',
      minLength: 'Minimum Length',
      maxLength: 'Maximum Length',
      min: 'Minimum Value',
      max: 'Maximum Value',
      step: 'Step',
      multiple: 'Allow Multiple',
      accept: 'Accepted File Types',
      maxFileSize: 'Max File Size',
      width: 'Width',
      height: 'Height',
      alignment: 'Alignment'
    }
  },

  // Form settings
  settings: {
    title: 'Form Settings',
    basic: 'Basic Settings',
    advanced: 'Advanced Settings',
    notifications: 'Notifications',
    integrations: 'Integrations',
    
    // Basic settings
    formName: 'Form Name',
    formDescription: 'Form Description',
    formSlug: 'Form URL',
    formStatus: 'Form Status',
    allowMultipleSubmissions: 'Allow Multiple Submissions',
    requireAuth: 'Require Authentication',
    
    // Advanced settings
    submitButtonText: 'Submit Button Text',
    successMessage: 'Success Message',
    redirectUrl: 'Redirect URL after submission',
    customCss: 'Custom CSS',
    customJs: 'Custom JavaScript',
    
    // Notifications
    emailNotifications: 'Email Notifications',
    notifyOnSubmission: 'Notify on New Submission',
    notificationEmail: 'Notification Email',
    autoReply: 'Auto-Reply to Submitter',
    autoReplySubject: 'Auto-Reply Subject',
    autoReplyMessage: 'Auto-Reply Message'
  },

  // Submissions
  submissions: {
    title: 'Form Submissions',
    noSubmissions: 'No submissions yet',
    noSubmissionsSubtext: 'Submissions will appear here once your form receives responses',
    totalSubmissions: 'Total Submissions',
    exportSubmissions: 'Export Submissions',
    viewSubmission: 'View Submission',
    deleteSubmission: 'Delete Submission',
    submittedAt: 'Submitted At',
    submittedBy: 'Submitted By',
    ipAddress: 'IP Address',
    userAgent: 'User Agent',
    
    // Table view
    tableView: {
      title: 'Submissions Table View',
      exportCsv: 'Export as CSV',
      exportExcel: 'Export as Excel',
      showColumns: 'Show Columns',
      pagination: {
        showing: 'Showing {{start}} to {{end}} of {{total}} submissions',
        itemsPerPage: 'Items per page'
      }
    }
  },

  // Messages
  messages: {
    formSaved: 'Form saved successfully',
    formPublished: 'Form published successfully',
    formArchived: 'Form archived successfully',
    formDeleted: 'Form deleted successfully',
    formDuplicated: 'Form duplicated successfully',
    submissionDeleted: 'Submission deleted successfully',
    saveError: 'Failed to save form',
    publishError: 'Failed to publish form',
    loadError: 'Failed to load forms',
    deleteError: 'Failed to delete form',
    confirmDelete: 'Are you sure you want to delete this form? This action cannot be undone and all submissions will be permanently deleted.',
    confirmDeleteSubmission: 'Are you sure you want to delete this submission? This action cannot be undone.',
    confirmArchive: 'Are you sure you want to archive this form?',
    confirmPublish: 'Are you sure you want to publish this form? It will be accessible to the public.',
    duplicateSuccess: 'Form has been duplicated successfully'
  }
};