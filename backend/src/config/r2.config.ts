import { S3Client } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

dotenv.config();

// Validate required environment variables
const requiredEnvVars = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID', 
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME'
];

requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    console.warn(`Missing environment variable: ${varName}. R2 storage will not be available.`);
  }
});

// R2 Configuration
export const r2Config = {
  accountId: process.env.R2_ACCOUNT_ID || '',
  accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  bucketName: process.env.R2_BUCKET_NAME || '',
  region: process.env.R2_REGION || 'auto',
  endpoint: process.env.R2_ENDPOINT || `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  publicUrl: process.env.R2_PUBLIC_URL || null,
  
  // Storage settings
  maxFileSize: parseInt(process.env.STORAGE_MAX_FILE_SIZE || '10485760'),
  allowedMimeTypes: (process.env.STORAGE_ALLOWED_MIME_TYPES || 'image/jpeg,image/png,image/gif,image/webp,application/pdf').split(','),
  enableLocalBackup: process.env.ENABLE_LOCAL_BACKUP === 'true',
  localStoragePath: process.env.LOCAL_STORAGE_PATH || './uploads',
  
  // Check if R2 is properly configured
  isConfigured: () => {
    return !!(
      process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET_NAME
    );
  }
};

// Create S3 Client for R2 (only if configured)
export const r2Client = r2Config.isConfigured() ? new S3Client({
  region: r2Config.region,
  endpoint: r2Config.endpoint,
  credentials: {
    accessKeyId: r2Config.accessKeyId,
    secretAccessKey: r2Config.secretAccessKey,
  },
  // R2 requires these specific settings
  forcePathStyle: true,
}) : null;

export default r2Config;