import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { megaS4Service } from '../services/MegaS4Service';

// Simple auth middleware for demo
const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // For development, allow all requests
  if (process.env.NODE_ENV === 'development') {
    (req as any).user = {
      id: 'dev-user',
      email: 'dev@example.com',
      role: 'admin',
    };
    return next();
  }
  
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({
      success: false,
      error: 'No authorization token provided',
    });
  }
  
  next();
};

const router = Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.MEGA_S4_MAX_FILE_SIZE || '104857600'), // 100MB default
  },
});

/**
 * Upload a single file to MEGA S4
 * POST /api/mega-s4/upload/single
 */
router.post(
  '/upload/single',
  authMiddleware,
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file provided',
        });
      }

      const metadata = {
        uploadedBy: (req as any).user?.id || 'anonymous',
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        uploadedAt: new Date(),
      };

      const result = await megaS4Service.uploadFile(req.file, metadata);

      if (result.success) {
        // Here you would typically save the file info to your database
        // For now, we'll just return the result
        return res.json({
          success: true,
          file: {
            key: result.key,
            url: result.url,
            size: result.size,
            etag: result.etag,
            originalName: req.file.originalname,
            mimeType: req.file.mimetype,
            validation: result.validation,
          },
        });
      } else {
        return res.status(400).json({
          success: false,
          error: result.error,
          validation: result.validation,
        });
      }
    } catch (error) {
      console.error('Upload error:', error);
      
      // Handle Multer errors
      if (error instanceof Error && error.message === 'File too large') {
        return res.status(400).json({
          success: false,
          error: `File exceeds maximum size limit of ${(parseInt(process.env.MEGA_S4_MAX_FILE_SIZE || '104857600') / 1048576).toFixed(0)}MB`,
        });
      }
      
      return res.status(500).json({
        success: false,
        error: 'Failed to upload file',
      });
    }
  }
);

/**
 * Upload multiple files to MEGA S4
 * POST /api/mega-s4/upload/multiple
 */
router.post(
  '/upload/multiple',
  authMiddleware,
  upload.array('files', 10), // Max 10 files
  async (req: Request, res: Response) => {
    try {
      const files = req.files as Express.Multer.File[];
      
      if (!files || files.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No files provided',
        });
      }

      const uploadPromises = files.map(file => {
        const metadata = {
          uploadedBy: (req as any).user?.id || 'anonymous',
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          uploadedAt: new Date(),
        };
        return megaS4Service.uploadFile(file, metadata);
      });

      const results = await Promise.all(uploadPromises);
      
      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);

      return res.json({
        success: true,
        uploaded: successful.length,
        failed: failed.length,
        files: successful.map((result, index) => ({
          key: result.key,
          url: result.url,
          size: result.size,
          etag: result.etag,
          originalName: files[index].originalname,
          mimeType: files[index].mimetype,
        })),
        errors: failed.map(r => r.error),
      });
    } catch (error) {
      console.error('Multiple upload error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to upload files',
      });
    }
  }
);

/**
 * Generate presigned URL for direct browser upload
 * POST /api/mega-s4/upload/presigned-url
 */
router.post('/upload/presigned-url', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { fileName, mimeType, metadata } = req.body;

    if (!fileName || !mimeType) {
      return res.status(400).json({
        success: false,
        error: 'fileName and mimeType are required',
      });
    }

    const presignedData = await megaS4Service.generatePresignedUploadUrl(
      fileName,
      mimeType,
      {
        'uploaded-by': (req as any).user?.id || 'anonymous',
        ...metadata,
      }
    );

    return res.json({
      success: true,
      uploadUrl: presignedData.url,
      key: presignedData.key,
      expiresIn: parseInt(process.env.MEGA_S4_PRESIGNED_URL_EXPIRY || '3600'),
    });
  } catch (error) {
    console.error('Presigned URL error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate upload URL',
    });
  }
});

/**
 * Download a file from MEGA S4
 * GET /api/mega-s4/download/:key
 */
router.get('/download/:key(*)', authMiddleware, async (req: Request, res: Response) => {
  try {
    const key = req.params.key;

    // Check if file exists
    const exists = await megaS4Service.fileExists(key);
    if (!exists) {
      return res.status(404).json({
        success: false,
        error: 'File not found',
      });
    }

    // Get file metadata
    const metadata = await megaS4Service.getFileMetadata(key);
    
    // Stream the file
    const { stream, metadata: fileMetadata } = await megaS4Service.downloadFile(key);

    // Set headers
    res.setHeader('Content-Type', fileMetadata['mime-type'] || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${fileMetadata['original-name'] || 'download'}"`
    );

    // Pipe the stream to response
    stream.pipe(res);
  } catch (error) {
    console.error('Download error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to download file',
    });
  }
});

/**
 * Get presigned download URL
 * GET /api/mega-s4/download-url/:key
 */
router.get('/download-url/:key(*)', authMiddleware, async (req: Request, res: Response) => {
  try {
    const key = req.params.key;
    const expiresIn = parseInt(req.query.expiresIn as string) || 3600;

    // Check if file exists
    const exists = await megaS4Service.fileExists(key);
    if (!exists) {
      return res.status(404).json({
        success: false,
        error: 'File not found',
      });
    }

    const url = await megaS4Service.generatePresignedDownloadUrl(key, expiresIn);

    return res.json({
      success: true,
      downloadUrl: url,
      expiresIn,
    });
  } catch (error) {
    console.error('Download URL error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate download URL',
    });
  }
});

/**
 * Delete a file from MEGA S4
 * DELETE /api/mega-s4/delete/:key
 */
router.delete('/delete/:key(*)', authMiddleware, async (req: Request, res: Response) => {
  try {
    const key = req.params.key;

    // Check if file exists
    const exists = await megaS4Service.fileExists(key);
    if (!exists) {
      return res.status(404).json({
        success: false,
        error: 'File not found',
      });
    }

    // Delete the file
    const deleted = await megaS4Service.deleteFile(key);

    if (deleted) {
      // Here you would also delete from your database
      return res.json({
        success: true,
        message: 'File deleted successfully',
      });
    } else {
      return res.status(500).json({
        success: false,
        error: 'Failed to delete file',
      });
    }
  } catch (error) {
    console.error('Delete error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete file',
    });
  }
});

/**
 * List files in a specific path
 * GET /api/mega-s4/list
 */
router.get('/list', authMiddleware, async (req: Request, res: Response) => {
  try {
    const prefix = (req.query.prefix as string) || '';
    const maxKeys = parseInt(req.query.maxKeys as string) || 100;

    const files = await megaS4Service.listFiles(prefix, maxKeys);

    return res.json({
      success: true,
      files,
      count: files.length,
    });
  } catch (error) {
    console.error('List files error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to list files',
    });
  }
});

/**
 * Get file metadata
 * GET /api/mega-s4/metadata/:key
 */
router.get('/metadata/:key(*)', authMiddleware, async (req: Request, res: Response) => {
  try {
    const key = req.params.key;

    const metadata = await megaS4Service.getFileMetadata(key);
    
    if (metadata) {
      return res.json({
        success: true,
        metadata,
      });
    } else {
      return res.status(404).json({
        success: false,
        error: 'File not found',
      });
    }
  } catch (error) {
    console.error('Metadata error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get file metadata',
    });
  }
});

/**
 * Copy a file within MEGA S4
 * POST /api/mega-s4/copy
 */
router.post('/copy', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { sourceKey, destinationKey } = req.body;

    if (!sourceKey || !destinationKey) {
      return res.status(400).json({
        success: false,
        error: 'sourceKey and destinationKey are required',
      });
    }

    const copied = await megaS4Service.copyFile(sourceKey, destinationKey);

    if (copied) {
      return res.json({
        success: true,
        message: 'File copied successfully',
        destinationKey,
      });
    } else {
      return res.status(500).json({
        success: false,
        error: 'Failed to copy file',
      });
    }
  } catch (error) {
    console.error('Copy error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to copy file',
    });
  }
});

/**
 * Move a file within MEGA S4
 * POST /api/mega-s4/move
 */
router.post('/move', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { sourceKey, destinationKey } = req.body;

    if (!sourceKey || !destinationKey) {
      return res.status(400).json({
        success: false,
        error: 'sourceKey and destinationKey are required',
      });
    }

    const moved = await megaS4Service.moveFile(sourceKey, destinationKey);

    if (moved) {
      return res.json({
        success: true,
        message: 'File moved successfully',
        destinationKey,
      });
    } else {
      return res.status(500).json({
        success: false,
        error: 'Failed to move file',
      });
    }
  } catch (error) {
    console.error('Move error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to move file',
    });
  }
});

/**
 * Calculate storage usage
 * GET /api/mega-s4/usage
 */
router.get('/usage', authMiddleware, async (req: Request, res: Response) => {
  try {
    const prefix = (req.query.prefix as string) || '';

    const usage = await megaS4Service.calculateStorageUsage(prefix);

    return res.json({
      success: true,
      usage: {
        totalSize: usage.totalSize,
        totalSizeMB: (usage.totalSize / 1048576).toFixed(2),
        totalSizeGB: (usage.totalSize / 1073741824).toFixed(2),
        fileCount: usage.fileCount,
      },
    });
  } catch (error) {
    console.error('Usage calculation error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to calculate storage usage',
    });
  }
});

export default router;