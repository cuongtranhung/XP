const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const FormSubmission = require('../models/FormSubmission');
const Form = require('../models/Form');

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only CSV and Excel files are allowed.'));
    }
  }
});

// Import submissions from CSV/Excel
router.post('/forms/:formId/submissions/import', upload.single('file'), async (req, res) => {
  const { formId } = req.params;
  const file = req.file;

  if (!file) {
    return res.status(400).json({
      success: false,
      message: 'No file uploaded'
    });
  }

  try {
    // Get form to validate fields
    const form = await Form.findById(formId);
    if (!form) {
      // Clean up uploaded file
      fs.unlinkSync(file.path);
      return res.status(404).json({
        success: false,
        message: 'Form not found'
      });
    }

    let data = [];
    const fileExtension = path.extname(file.originalname).toLowerCase();

    // Parse file based on type
    if (fileExtension === '.csv') {
      // Parse CSV
      data = await new Promise((resolve, reject) => {
        const results = [];
        fs.createReadStream(file.path)
          .pipe(csv())
          .on('data', (row) => results.push(row))
          .on('end', () => resolve(results))
          .on('error', reject);
      });
    } else if (fileExtension === '.xlsx' || fileExtension === '.xls') {
      // Parse Excel
      const workbook = XLSX.readFile(file.path);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      data = XLSX.utils.sheet_to_json(worksheet);
    }

    // Clean up uploaded file
    fs.unlinkSync(file.path);

    if (data.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No data found in file'
      });
    }

    // Validate and prepare submissions
    const submissions = [];
    const errors = [];
    const fieldKeys = form.fields.map(field => field.fieldKey);

    data.forEach((row, index) => {
      const submissionData = {};
      let hasValidData = false;

      // Map row data to form fields
      for (const key in row) {
        // Try to match column name to field key or label
        const matchingField = form.fields.find(field => 
          field.fieldKey === key || 
          field.label === key ||
          field.fieldKey.toLowerCase() === key.toLowerCase() ||
          field.label.toLowerCase() === key.toLowerCase()
        );

        if (matchingField) {
          const value = row[key];
          
          // Validate and convert data types
          if (matchingField.fieldType === 'number' && value !== '') {
            const numValue = parseFloat(value);
            if (!isNaN(numValue)) {
              submissionData[matchingField.fieldKey] = numValue;
              hasValidData = true;
            }
          } else if (matchingField.fieldType === 'checkbox') {
            submissionData[matchingField.fieldKey] = 
              value === true || value === 'true' || value === '1' || value === 'yes';
            hasValidData = true;
          } else if (value !== '' && value !== null && value !== undefined) {
            submissionData[matchingField.fieldKey] = String(value);
            hasValidData = true;
          }
        }
      }

      // Check required fields
      const missingRequired = form.fields
        .filter(field => field.required && !submissionData[field.fieldKey])
        .map(field => field.label);

      if (missingRequired.length > 0) {
        errors.push(`Row ${index + 2}: Missing required fields: ${missingRequired.join(', ')}`);
      } else if (hasValidData) {
        submissions.push({
          formId,
          data: submissionData,
          status: 'completed',
          metadata: {
            source: 'import',
            importedAt: new Date(),
            originalRow: index + 2
          }
        });
      }
    });

    if (errors.length > 0 && submissions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Import failed due to validation errors',
        errors: errors.slice(0, 10) // Return first 10 errors
      });
    }

    // Insert valid submissions
    let imported = 0;
    if (submissions.length > 0) {
      const result = await FormSubmission.insertMany(submissions);
      imported = result.length;
    }

    res.json({
      success: true,
      message: `Successfully imported ${imported} submissions`,
      data: {
        imported,
        total: data.length,
        errors: errors.slice(0, 10),
        hasMoreErrors: errors.length > 10
      }
    });

  } catch (error) {
    // Clean up file if it exists
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
    
    console.error('Import error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to import data',
      error: error.message
    });
  }
});

// Get submissions for a form
router.get('/forms/:formId/submissions', async (req, res) => {
  try {
    const { formId } = req.params;
    const { page = 1, limit = 10, status, search } = req.query;

    const query = { formId };
    
    if (status && status !== 'all') {
      query.status = status;
    }

    if (search) {
      // Search in submission data
      query.$or = [
        { 'data': { $regex: search, $options: 'i' } }
      ];
    }

    const submissions = await FormSubmission
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await FormSubmission.countDocuments(query);

    res.json({
      success: true,
      data: submissions,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching submissions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch submissions',
      error: error.message
    });
  }
});

// Create a new submission
router.post('/forms/:formId/submissions', async (req, res) => {
  try {
    const { formId } = req.params;
    const { data, status = 'completed', metadata } = req.body;

    const submission = new FormSubmission({
      formId,
      data,
      status,
      metadata
    });

    await submission.save();

    res.json({
      success: true,
      data: submission
    });
  } catch (error) {
    console.error('Error creating submission:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create submission',
      error: error.message
    });
  }
});

// Update a submission
router.put('/submissions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, status } = req.body;

    const submission = await FormSubmission.findById(id);
    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found'
      });
    }

    if (data) submission.data = data;
    if (status) submission.status = status;
    submission.updatedAt = new Date();

    await submission.save();

    res.json({
      success: true,
      data: submission
    });
  } catch (error) {
    console.error('Error updating submission:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update submission',
      error: error.message
    });
  }
});

// Delete a submission
router.delete('/submissions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const submission = await FormSubmission.findByIdAndDelete(id);
    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found'
      });
    }

    res.json({
      success: true,
      message: 'Submission deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting submission:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete submission',
      error: error.message
    });
  }
});

// Bulk delete submissions
router.post('/submissions/bulk-delete', async (req, res) => {
  try {
    const { ids } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No submission IDs provided'
      });
    }

    const result = await FormSubmission.deleteMany({
      _id: { $in: ids }
    });

    res.json({
      success: true,
      message: `Deleted ${result.deletedCount} submissions`
    });
  } catch (error) {
    console.error('Error bulk deleting submissions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete submissions',
      error: error.message
    });
  }
});

module.exports = router;