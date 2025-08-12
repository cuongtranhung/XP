const express = require('express');
const router = express.Router();
const multer = require('multer');
const CloudflareR2Service = require('../services/cloudflareR2Service');
const authMiddleware = require('../middleware/auth');

// Initialize R2 service
const r2Service = new CloudflareR2Service();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 10 // Maximum 10 files at once
  }
});

/**
 * Upload single file
 * POST /api/upload/single
 */
router.post('/single', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file provided'
      });
    }

    // Validate file
    const validationOptions = {
      maxSize: 10 * 1024 * 1024,
      allowedMimeTypes: [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf', 
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain', 'text/csv'
      ]
    };

    try {
      r2Service.validateFile(req.file, validationOptions);
    } catch (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError.message
      });
    }

    // Upload to R2
    const result = await r2Service.uploadFile(
      req.file.buffer,
      req.file.originalname,
      {
        folder: `uploads/${req.user.id}`,
        contentType: req.file.mimetype,
        metadata: {
          userId: req.user.id.toString(),
          uploadedBy: req.user.email
        }
      }
    );

    // Log upload activity
    console.log(`File uploaded by user ${req.user.email}: ${result.key}`);

    res.json({
      success: true,
      message: 'File uploaded successfully',
      data: result
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload file'
    });
  }
});

/**
 * Upload multiple files
 * POST /api/upload/multiple
 */
router.post('/multiple', authMiddleware, upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files provided'
      });
    }

    // Validate all files
    const validationOptions = {
      maxSize: 10 * 1024 * 1024,
      allowedMimeTypes: [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain', 'text/csv'
      ]
    };

    const validationErrors = [];
    req.files.forEach((file, index) => {
      try {
        r2Service.validateFile(file, validationOptions);
      } catch (error) {
        validationErrors.push({
          file: file.originalname,
          error: error.message
        });
      }
    });

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Some files failed validation',
        errors: validationErrors
      });
    }

    // Prepare files for upload
    const filesToUpload = req.files.map(file => ({
      buffer: file.buffer,
      originalname: file.originalname,
      mimetype: file.mimetype,
      metadata: {
        userId: req.user.id.toString(),
        uploadedBy: req.user.email
      }
    }));

    // Upload files with progress tracking
    const results = await r2Service.uploadMultiple(filesToUpload, {
      folder: `uploads/${req.user.id}`,
      concurrency: 3,
      onProgress: (progress) => {
        // Could emit progress via WebSocket here
        console.log(`Upload progress: ${progress.file} - ${progress.progress}%`);
      }
    });

    // Separate successful and failed uploads
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    res.json({
      success: true,
      message: `Uploaded ${successful.length} of ${results.length} files`,
      data: {
        successful,
        failed,
        summary: {
          total: results.length,
          succeeded: successful.length,
          failed: failed.length
        }
      }
    });
  } catch (error) {
    console.error('Multiple upload error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload files'
    });
  }
});

/**
 * Generate presigned upload URL for direct client upload
 * POST /api/upload/presigned
 */
router.post('/presigned', authMiddleware, async (req, res) => {
  try {
    const { fileName, contentType } = req.body;

    if (!fileName) {
      return res.status(400).json({
        success: false,
        message: 'File name is required'
      });
    }

    const result = await r2Service.generatePresignedUploadUrl(fileName, {
      folder: `uploads/${req.user.id}`,
      contentType: contentType || 'application/octet-stream',
      expiresIn: 3600 // 1 hour
    });

    res.json({
      success: true,
      message: 'Presigned URL generated successfully',
      data: result
    });
  } catch (error) {
    console.error('Presigned URL error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate presigned URL'
    });
  }
});

/**
 * List user's uploaded files
 * GET /api/upload/list
 */
router.get('/list', authMiddleware, async (req, res) => {
  try {
    const { prefix, maxKeys, continuationToken } = req.query;

    const result = await r2Service.listFiles({
      prefix: prefix || `uploads/${req.user.id}`,
      maxKeys: parseInt(maxKeys) || 100,
      continuationToken
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('List files error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to list files'
    });
  }
});

/**
 * Delete a file
 * DELETE /api/upload/:key
 */
router.delete('/:key(*)', authMiddleware, async (req, res) => {
  try {
    const { key } = req.params;

    // Check if user owns the file (key should start with uploads/{userId}/)
    const expectedPrefix = `uploads/${req.user.id}/`;
    if (!key.startsWith(expectedPrefix)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this file'
      });
    }

    const result = await r2Service.deleteFile(key);

    res.json({
      success: true,
      message: 'File deleted successfully',
      data: result
    });
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete file'
    });
  }
});

/**
 * Get file metadata
 * GET /api/upload/metadata/:key
 */
router.get('/metadata/:key(*)', authMiddleware, async (req, res) => {
  try {
    const { key } = req.params;

    const metadata = await r2Service.getFileMetadata(key);

    res.json({
      success: true,
      data: metadata
    });
  } catch (error) {
    console.error('Get metadata error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get file metadata'
    });
  }
});

/**
 * Generate download URL for a file
 * GET /api/upload/download/:key
 */
router.get('/download/:key(*)', authMiddleware, async (req, res) => {
  try {
    const { key } = req.params;
    const { expiresIn } = req.query;

    // Check if user owns the file
    const expectedPrefix = `uploads/${req.user.id}/`;
    if (!key.startsWith(expectedPrefix)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to access this file'
      });
    }

    const url = await r2Service.generatePresignedDownloadUrl(
      key,
      parseInt(expiresIn) || 3600
    );

    res.json({
      success: true,
      data: {
        url,
        expiresIn: parseInt(expiresIn) || 3600
      }
    });
  } catch (error) {
    console.error('Generate download URL error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate download URL'
    });
  }
});

module.exports = router;