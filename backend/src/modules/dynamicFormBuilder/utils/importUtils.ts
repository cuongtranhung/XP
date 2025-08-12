/**
 * Import Utilities for Form Submissions
 * Handles CSV, XLSX, and JSON import formats
 */

import * as ExcelJS from 'exceljs';
import { parse } from 'csv-parse/sync';
import { v4 as uuidv4 } from 'uuid';

export interface ImportedSubmission {
  data: Record<string, any>;
  metadata?: Record<string, any>;
  status?: 'draft' | 'completed' | 'processing' | 'failed';
  submittedAt?: Date;
  userEmail?: string;
  userName?: string;
}

export interface ImportResult {
  submissions: ImportedSubmission[];
  errors: Array<{ row: number; error: string }>;
}

/**
 * Import submissions from CSV format
 */
export async function importFromCSV(buffer: Buffer, formFields?: any[]): Promise<ImportResult> {
  const submissions: ImportedSubmission[] = [];
  const errors: Array<{ row: number; error: string }> = [];

  try {
    // Parse CSV
    const content = buffer.toString('utf-8');
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      cast: true,
      cast_date: true
    });

    // Reverse the records to read from bottom to top
    records.reverse();

    // Process each record (now from bottom to top)
    records.forEach((record: any, index: number) => {
      try {
        const submission: ImportedSubmission = {
          data: {},
          status: 'completed'
        };

        // Extract metadata fields if present
        const metadataFields = ['User Agent', 'IP Address', 'Referrer'];
        const systemFields = ['Submission ID', 'Status', 'Submitted By', 'Submitted At'];
        
        for (const [key, value] of Object.entries(record)) {
          if (systemFields.includes(key)) {
            // Handle system fields
            if (key === 'Status' && isValidStatus(value as string)) {
              submission.status = value as any;
            } else if (key === 'Submitted By') {
              // Try to extract email if present
              const emailMatch = String(value).match(/[\w._%+-]+@[\w.-]+\.[A-Za-z]{2,}/);
              if (emailMatch) {
                submission.userEmail = emailMatch[0];
              } else {
                submission.userName = String(value);
              }
            } else if (key === 'Submitted At') {
              submission.submittedAt = new Date(value as string);
            }
          } else if (metadataFields.includes(key)) {
            // Handle metadata fields
            if (!submission.metadata) submission.metadata = {};
            const metadataKey = key.toLowerCase().replace(' ', '');
            submission.metadata[metadataKey] = value;
          } else {
            // Regular form field - find the field key
            const field = formFields?.find(f => f.label === key || f.fieldKey === key);
            const fieldKey = field?.fieldKey || key.toLowerCase().replace(/\s+/g, '_');
            submission.data[fieldKey] = parseFieldValue(value, field?.type);
          }
        }

        submissions.push(submission);
      } catch (error) {
        // Calculate original row number (before reverse)
        const originalRowNumber = records.length - index + 1; // +1 for header
        errors.push({ 
          row: originalRowNumber,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });
  } catch (error) {
    throw new Error(`Failed to parse CSV: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return { submissions, errors };
}

/**
 * Import submissions from XLSX format
 */
export async function importFromXLSX(buffer: Buffer, formFields?: any[]): Promise<ImportResult> {
  const submissions: ImportedSubmission[] = [];
  const errors: Array<{ row: number; error: string }> = [];

  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new Error('No worksheet found in the Excel file');
    }

    // Get headers from first row
    const headers: string[] = [];
    worksheet.getRow(1).eachCell((cell) => {
      headers.push(String(cell.value || ''));
    });

    // Collect all data rows first (excluding header)
    const dataRows: Array<{ row: ExcelJS.Row; rowNumber: number }> = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header row
      dataRows.push({ row, rowNumber });
    });

    // Reverse the data rows to read from bottom to top
    dataRows.reverse();

    // Process data rows (now from bottom to top)
    dataRows.forEach(({ row, rowNumber }) => {

      try {
        const submission: ImportedSubmission = {
          data: {},
          status: 'completed'
        };

        const metadataFields = ['User Agent', 'IP Address', 'Referrer'];
        const systemFields = ['Submission ID', 'Status', 'Submitted By', 'Submitted At'];

        row.eachCell((cell, colNumber) => {
          const header = headers[colNumber - 1];
          const value = cell.value;

          if (!header || value === null || value === undefined) return;

          if (systemFields.includes(header)) {
            // Handle system fields
            if (header === 'Status' && isValidStatus(String(value))) {
              submission.status = String(value) as any;
            } else if (header === 'Submitted By') {
              const emailMatch = String(value).match(/[\w._%+-]+@[\w.-]+\.[A-Za-z]{2,}/);
              if (emailMatch) {
                submission.userEmail = emailMatch[0];
              } else {
                submission.userName = String(value);
              }
            } else if (header === 'Submitted At') {
              submission.submittedAt = new Date(value as string);
            }
          } else if (metadataFields.includes(header)) {
            // Handle metadata fields
            if (!submission.metadata) submission.metadata = {};
            const metadataKey = header.toLowerCase().replace(' ', '');
            submission.metadata[metadataKey] = value;
          } else {
            // Regular form field
            const field = formFields?.find(f => f.label === header || f.fieldKey === header);
            const fieldKey = field?.fieldKey || header.toLowerCase().replace(/\s+/g, '_');
            submission.data[fieldKey] = parseFieldValue(value, field?.type);
          }
        });

        // Only add if there's actual data
        if (Object.keys(submission.data).length > 0) {
          submissions.push(submission);
        }
      } catch (error) {
        errors.push({ 
          row: rowNumber,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });
  } catch (error) {
    throw new Error(`Failed to parse Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return { submissions, errors };
}

/**
 * Import submissions from JSON format
 */
export function importFromJSON(buffer: Buffer, formFields?: any[]): ImportResult {
  const submissions: ImportedSubmission[] = [];
  const errors: Array<{ row: number; error: string }> = [];

  try {
    const content = buffer.toString('utf-8');
    const data = JSON.parse(content);

    // Handle both array of submissions and export format with metadata
    let rawSubmissions: any[] = [];
    
    if (Array.isArray(data)) {
      rawSubmissions = data;
    } else if (data.submissions && Array.isArray(data.submissions)) {
      rawSubmissions = data.submissions;
    } else {
      throw new Error('Invalid JSON format. Expected an array of submissions or an object with submissions array');
    }

    // Reverse the submissions to read from bottom to top
    rawSubmissions.reverse();

    rawSubmissions.forEach((item, index) => {
      try {
        const submission: ImportedSubmission = {
          data: item.data || {},
          metadata: item.metadata,
          status: item.status || 'completed'
        };

        // Handle various field formats
        if (item.submittedBy) {
          const emailMatch = String(item.submittedBy).match(/[\w._%+-]+@[\w.-]+\.[A-Za-z]{2,}/);
          if (emailMatch) {
            submission.userEmail = emailMatch[0];
          } else {
            submission.userName = String(item.submittedBy);
          }
        }

        if (item.userEmail) submission.userEmail = item.userEmail;
        if (item.userName) submission.userName = item.userName;
        if (item.submittedAt) submission.submittedAt = new Date(item.submittedAt);

        // Validate and transform data fields
        if (formFields && formFields.length > 0) {
          const transformedData: Record<string, any> = {};
          
          for (const [key, value] of Object.entries(submission.data)) {
            const field = formFields.find(f => f.fieldKey === key || f.label === key);
            const fieldKey = field?.fieldKey || key;
            transformedData[fieldKey] = parseFieldValue(value, field?.type);
          }
          
          submission.data = transformedData;
        }

        submissions.push(submission);
      } catch (error) {
        // Calculate original row number (before reverse)
        const originalRowNumber = rawSubmissions.length - index;
        errors.push({ 
          row: originalRowNumber,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });
  } catch (error) {
    throw new Error(`Failed to parse JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return { submissions, errors };
}

/**
 * Parse field value based on field type
 */
function parseFieldValue(value: any, fieldType?: string): any {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  switch (fieldType) {
    case 'number':
      const num = Number(value);
      return isNaN(num) ? null : num;
    
    case 'boolean':
    case 'checkbox':
      if (typeof value === 'boolean') return value;
      if (typeof value === 'string') {
        const lower = value.toLowerCase();
        return lower === 'true' || lower === 'yes' || lower === '1';
      }
      return Boolean(value);
    
    case 'date':
      if (value instanceof Date) return value.toISOString();
      const date = new Date(value);
      return isNaN(date.getTime()) ? null : date.toISOString();
    
    case 'array':
    case 'multiselect':
      if (Array.isArray(value)) return value;
      if (typeof value === 'string') {
        // Try to parse as JSON array first
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) return parsed;
        } catch {}
        // Otherwise split by comma
        return value.split(',').map(v => v.trim()).filter(v => v);
      }
      return [value];
    
    default:
      return String(value);
  }
}

/**
 * Check if status is valid
 */
function isValidStatus(status: string): boolean {
  const validStatuses = ['draft', 'completed', 'processing', 'failed', 'submitted'];
  return validStatuses.includes(status.toLowerCase());
}

/**
 * Main import function that routes to appropriate format handler
 */
export async function importSubmissions(
  format: 'csv' | 'xlsx' | 'json',
  buffer: Buffer,
  formFields?: any[]
): Promise<ImportResult> {
  switch (format) {
    case 'csv':
      return importFromCSV(buffer, formFields);
    case 'xlsx':
      return importFromXLSX(buffer, formFields);
    case 'json':
      return importFromJSON(buffer, formFields);
    default:
      throw new Error(`Unsupported import format: ${format}`);
  }
}