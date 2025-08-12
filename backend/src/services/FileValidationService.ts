import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { fileTypeFromBuffer } from 'file-type';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  fileInfo?: {
    detectedMimeType?: string;
    actualExtension?: string;
    size: number;
    checksum: string;
  };
}

export interface ValidationConfig {
  maxFileSize: number;
  allowedMimeTypes: string[];
  allowedExtensions: string[];
  scanForViruses: boolean;
  checkMimeTypeMatch: boolean;
  maxFilenameLength: number;
  blockedExtensions: string[];
  enableAdvancedScanning: boolean;
}

export class FileValidationService {
  private config: ValidationConfig;

  constructor(config: Partial<ValidationConfig> = {}) {
    this.config = {
      maxFileSize: parseInt(process.env.MEGA_S4_MAX_FILE_SIZE || '104857600'), // 100MB
      allowedMimeTypes: (process.env.MEGA_S4_ALLOWED_FILE_TYPES || '').split(',').filter(Boolean),
      allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.mp4', '.mov'],
      scanForViruses: process.env.MEGA_S4_ENABLE_VIRUS_SCAN === 'true',
      checkMimeTypeMatch: true,
      maxFilenameLength: 255,
      blockedExtensions: ['.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js', '.jar', '.sh', '.php'],
      enableAdvancedScanning: process.env.MEGA_S4_ENABLE_ADVANCED_SCAN === 'true',
      ...config,
    };
  }

  /**
   * Comprehensive file validation
   */
  async validateFile(file: Express.Multer.File | Buffer, originalName: string, declaredMimeType: string): Promise<ValidationResult> {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      fileInfo: {
        size: Buffer.isBuffer(file) ? file.length : file.size,
        checksum: '',
      },
    };

    const buffer = Buffer.isBuffer(file) ? file : file.buffer;
    result.fileInfo!.checksum = crypto.createHash('sha256').update(buffer).digest('hex');

    // 1. Basic size validation
    await this.validateFileSize(result);

    // 2. Filename validation
    await this.validateFilename(originalName, result);

    // 3. File type detection and validation
    await this.validateFileType(buffer, originalName, declaredMimeType, result);

    // 4. Content-based security scanning
    await this.performSecurityScanning(buffer, originalName, result);

    // 5. Virus scanning (if enabled)
    if (this.config.scanForViruses) {
      await this.performVirusScanning(buffer, result);
    }

    // 6. Advanced content analysis (if enabled)
    if (this.config.enableAdvancedScanning) {
      await this.performAdvancedScanning(buffer, originalName, result);
    }

    result.valid = result.errors.length === 0;
    return result;
  }

  /**
   * Validate file size
   */
  private async validateFileSize(result: ValidationResult): Promise<void> {
    if (result.fileInfo!.size === 0) {
      result.errors.push('File is empty');
      return;
    }

    if (result.fileInfo!.size > this.config.maxFileSize) {
      result.errors.push(
        `File size ${(result.fileInfo!.size / 1048576).toFixed(2)}MB exceeds maximum allowed size of ${(
          this.config.maxFileSize / 1048576
        ).toFixed(2)}MB`
      );
    }

    // Warning for very large files
    if (result.fileInfo!.size > this.config.maxFileSize * 0.8) {
      result.warnings.push('File size is approaching the maximum limit');
    }
  }

  /**
   * Validate filename and extension
   */
  private async validateFilename(originalName: string, result: ValidationResult): Promise<void> {
    // Check filename length
    if (originalName.length > this.config.maxFilenameLength) {
      result.errors.push(`Filename exceeds maximum length of ${this.config.maxFilenameLength} characters`);
    }

    // Check for dangerous characters
    const dangerousChars = /[<>:"|?*\x00-\x1f]/;
    if (dangerousChars.test(originalName)) {
      result.errors.push('Filename contains dangerous characters');
    }

    // Check extension
    const extension = path.extname(originalName).toLowerCase();
    
    // Check blocked extensions
    if (this.config.blockedExtensions.includes(extension)) {
      result.errors.push(`File extension ${extension} is not allowed for security reasons`);
    }

    // Check allowed extensions (if configured)
    if (this.config.allowedExtensions.length > 0 && !this.config.allowedExtensions.includes(extension)) {
      result.errors.push(`File extension ${extension} is not in the allowed list: ${this.config.allowedExtensions.join(', ')}`);
    }

    // Check for double extensions (potential security risk)
    const doubleExtPattern = /\.[a-zA-Z]{2,4}\.[a-zA-Z]{2,4}$/;
    if (doubleExtPattern.test(originalName)) {
      result.warnings.push('File has multiple extensions, which could be a security risk');
    }
  }

  /**
   * Validate and detect actual file type
   */
  private async validateFileType(buffer: Buffer, originalName: string, declaredMimeType: string, result: ValidationResult): Promise<void> {
    try {
      // Detect actual file type from content
      const detectedType = await fileTypeFromBuffer(buffer);
      
      if (detectedType) {
        result.fileInfo!.detectedMimeType = detectedType.mime;
        result.fileInfo!.actualExtension = `.${detectedType.ext}`;

        // Check if detected type is allowed
        if (this.config.allowedMimeTypes.length > 0 && !this.config.allowedMimeTypes.includes(detectedType.mime)) {
          result.errors.push(`Detected file type ${detectedType.mime} is not allowed`);
        }

        // Check MIME type mismatch
        if (this.config.checkMimeTypeMatch && declaredMimeType !== detectedType.mime) {
          const expectedExt = path.extname(originalName).toLowerCase();
          const actualExt = `.${detectedType.ext}`;
          
          if (expectedExt !== actualExt) {
            result.warnings.push(
              `File extension (${expectedExt}) doesn't match detected type (${actualExt}). Declared: ${declaredMimeType}, Detected: ${detectedType.mime}`
            );
          }
        }
      } else {
        // Could not detect file type
        result.warnings.push('Could not detect file type from content');
        
        // If we can't detect the type, rely on declared MIME type validation
        if (this.config.allowedMimeTypes.length > 0 && !this.config.allowedMimeTypes.includes(declaredMimeType)) {
          result.errors.push(`Declared file type ${declaredMimeType} is not allowed`);
        }
      }
    } catch (error) {
      result.warnings.push(`Error detecting file type: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Perform basic security scanning on file content
   */
  private async performSecurityScanning(buffer: Buffer, originalName: string, result: ValidationResult): Promise<void> {
    const content = buffer.toString('binary');
    
    // Check for embedded executables
    const executableSignatures = [
      'MZ', // Windows PE
      '\x7fELF', // Linux ELF
      '\xca\xfe\xba\xbe', // Java class files
      '\xfe\xed\xfa', // Mach-O executables
    ];

    for (const signature of executableSignatures) {
      if (content.includes(signature)) {
        result.errors.push('File contains executable code signatures');
        break;
      }
    }

    // Check for script content in non-script files
    const scriptPatterns = [
      /<script[^>]*>/i,
      /javascript:/i,
      /vbscript:/i,
      /onload\s*=/i,
      /onerror\s*=/i,
      /eval\s*\(/i,
      /document\.write/i,
    ];

    const extension = path.extname(originalName).toLowerCase();
    const nonScriptExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.doc', '.docx'];
    
    if (nonScriptExtensions.includes(extension)) {
      for (const pattern of scriptPatterns) {
        if (pattern.test(content)) {
          result.errors.push('Non-script file contains script content - potential security risk');
          break;
        }
      }
    }

    // Check for suspicious strings
    const suspiciousPatterns = [
      /cmd\.exe/i,
      /powershell/i,
      /\/bin\/sh/i,
      /\/bin\/bash/i,
      /<\?php/i,
      /<%.*%>/i,
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(content)) {
        result.warnings.push('File contains potentially suspicious content');
        break;
      }
    }
  }

  /**
   * Perform virus scanning (mock implementation)
   * In production, integrate with ClamAV or similar
   */
  private async performVirusScanning(buffer: Buffer, result: ValidationResult): Promise<void> {
    try {
      // Mock virus scanning - in production, use actual antivirus
      const suspiciousBytes = [
        Buffer.from([0x4d, 0x5a]), // PE header
        Buffer.from('EICAR-STANDARD-ANTIVIRUS-TEST-FILE'), // EICAR test signature
      ];

      for (const suspicious of suspiciousBytes) {
        if (buffer.includes(suspicious)) {
          result.errors.push('File flagged by virus scanner');
          return;
        }
      }

      // Simulate scan time
      await new Promise(resolve => setTimeout(resolve, 100));
      
      result.warnings.push('Virus scan completed - no threats detected');
    } catch (error) {
      result.warnings.push(`Virus scanning failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Perform advanced content analysis
   */
  private async performAdvancedScanning(buffer: Buffer, originalName: string, result: ValidationResult): Promise<void> {
    const extension = path.extname(originalName).toLowerCase();

    try {
      switch (extension) {
        case '.pdf':
          await this.validatePdfContent(buffer, result);
          break;
        case '.jpg':
        case '.jpeg':
        case '.png':
        case '.gif':
        case '.webp':
          await this.validateImageContent(buffer, result);
          break;
        case '.doc':
        case '.docx':
          await this.validateOfficeDocument(buffer, result);
          break;
        default:
          // Generic content analysis
          await this.performGenericContentAnalysis(buffer, result);
      }
    } catch (error) {
      result.warnings.push(`Advanced scanning failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate PDF content
   */
  private async validatePdfContent(buffer: Buffer, result: ValidationResult): Promise<void> {
    const content = buffer.toString('binary');
    
    // Check PDF header
    if (!content.startsWith('%PDF-')) {
      result.errors.push('Invalid PDF header');
      return;
    }

    // Check for embedded JavaScript
    if (content.includes('/JavaScript') || content.includes('/JS')) {
      result.warnings.push('PDF contains JavaScript - potential security risk');
    }

    // Check for forms
    if (content.includes('/AcroForm')) {
      result.warnings.push('PDF contains forms');
    }

    // Check for external links
    if (content.includes('/URI')) {
      result.warnings.push('PDF contains external links');
    }
  }

  /**
   * Validate image content
   */
  private async validateImageContent(buffer: Buffer, result: ValidationResult): Promise<void> {
    // Check for EXIF data (potential privacy concern)
    if (buffer.includes(Buffer.from('Exif'))) {
      result.warnings.push('Image contains EXIF metadata - may contain location or device information');
    }

    // Basic image validation
    const content = buffer.toString('binary');
    
    // Check for embedded scripts in SVG
    if (content.includes('<script') || content.includes('javascript:')) {
      result.errors.push('Image contains embedded scripts - security risk');
    }
  }

  /**
   * Validate Office documents
   */
  private async validateOfficeDocument(buffer: Buffer, result: ValidationResult): Promise<void> {
    const content = buffer.toString('binary');
    
    // Check for macros
    if (content.includes('vbaProject') || content.includes('macros')) {
      result.warnings.push('Office document contains macros - potential security risk');
    }

    // Check for external links
    if (content.includes('http://') || content.includes('https://')) {
      result.warnings.push('Office document contains external links');
    }
  }

  /**
   * Generic content analysis
   */
  private async performGenericContentAnalysis(buffer: Buffer, result: ValidationResult): Promise<void> {
    const content = buffer.toString('utf8', 0, Math.min(buffer.length, 4096)); // Check first 4KB
    
    // Check for potentially dangerous content
    const dangerousPatterns = [
      /password\s*[:=]\s*[^\s]+/i,
      /api[_-]?key\s*[:=]\s*[^\s]+/i,
      /secret\s*[:=]\s*[^\s]+/i,
      /token\s*[:=]\s*[^\s]+/i,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(content)) {
        result.warnings.push('File may contain sensitive information (passwords, API keys, etc.)');
        break;
      }
    }

    // Check file entropy (detect encrypted/packed files)
    const entropy = this.calculateEntropy(buffer);
    if (entropy > 7.5) {
      result.warnings.push('File has high entropy - may be encrypted or packed');
    }
  }

  /**
   * Calculate entropy of buffer (measure of randomness)
   */
  private calculateEntropy(buffer: Buffer): number {
    const frequencies: { [byte: number]: number } = {};
    
    for (let i = 0; i < buffer.length; i++) {
      const byte = buffer[i];
      frequencies[byte] = (frequencies[byte] || 0) + 1;
    }

    let entropy = 0;
    const length = buffer.length;

    for (const freq of Object.values(frequencies)) {
      const probability = freq / length;
      entropy -= probability * Math.log2(probability);
    }

    return entropy;
  }

  /**
   * Get validation summary
   */
  getValidationSummary(result: ValidationResult): string {
    const summary = [];
    
    if (result.valid) {
      summary.push('✅ File validation passed');
    } else {
      summary.push(`❌ File validation failed with ${result.errors.length} errors`);
    }

    if (result.warnings.length > 0) {
      summary.push(`⚠️ ${result.warnings.length} warnings found`);
    }

    if (result.fileInfo) {
      summary.push(`📊 Size: ${(result.fileInfo.size / 1024 / 1024).toFixed(2)}MB`);
      if (result.fileInfo.detectedMimeType) {
        summary.push(`🔍 Detected type: ${result.fileInfo.detectedMimeType}`);
      }
    }

    return summary.join(' | ');
  }
}

// Export singleton instance
export const fileValidationService = new FileValidationService();