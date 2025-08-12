/**
 * Export Utilities for Form Submissions
 * Handles CSV, XLSX, JSON, and PDF export formats
 */

import * as ExcelJS from 'exceljs';
const { Parser } = require('json2csv');

export interface ExportData {
  submissions: any[];
  form: any;
  fields?: string[];
  includeMetadata?: boolean;
}

/**
 * Export submissions to CSV format
 */
export async function exportToCSV(data: ExportData): Promise<Buffer> {
  try {
    const { submissions, form, fields, includeMetadata } = data;
    
    // Prepare data for CSV
    const csvData = submissions.map(submission => {
      const row: Record<string, any> = {
        'Submission ID': submission.id,
        'Status': submission.status,
        'Submitted By': submission.userEmail || submission.userName || 'Anonymous',
        'Submitted At': submission.submittedAt || submission.createdAt
      };
      
      // Add form field data
      if (submission.data) {
        Object.entries(submission.data).forEach(([key, value]) => {
          const field = form?.fields?.find((f: any) => f.fieldKey === key);
          const fieldLabel = field?.label || key;
          row[fieldLabel] = formatFieldValue(value);
        });
      }
      
      // Add metadata if requested
      if (includeMetadata && submission.metadata) {
        row['User Agent'] = submission.metadata.userAgent || '';
        row['IP Address'] = submission.metadata.ipAddress || '';
        row['Referrer'] = submission.metadata.referrer || '';
      }
      
      return row;
    });
    
    // Convert to CSV
    if (csvData.length === 0) {
      // Return empty CSV with headers only
      const headers = ['Submission ID', 'Status', 'Submitted By', 'Submitted At'];
      if (form?.fields) {
        form.fields.forEach((field: any) => {
          headers.push(field.label || field.fieldKey);
        });
      }
      const parser = new Parser({ fields: headers });
      return Buffer.from(parser.parse([]));
    }
    
    const parser = new Parser();
    const csv = parser.parse(csvData);
    return Buffer.from(csv);
  } catch (error) {
    console.error('Error exporting to CSV:', error);
    throw new Error('Failed to export to CSV format');
  }
}

/**
 * Export submissions to XLSX format
 */
export async function exportToXLSX(data: ExportData): Promise<Buffer> {
  try {
    const { submissions, form, fields, includeMetadata } = data;
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Form Submissions');
    
    // Define columns
    const columns: any[] = [
      { header: 'Submission ID', key: 'id', width: 20 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Submitted By', key: 'submittedBy', width: 25 },
      { header: 'Submitted At', key: 'submittedAt', width: 20 }
    ];
    
    // Add form field columns
    if (form?.fields) {
      form.fields.forEach((field: any) => {
        columns.push({
          header: field.label || field.fieldKey,
          key: field.fieldKey,
          width: 20
        });
      });
    }
    
    // Add metadata columns if requested
    if (includeMetadata) {
      columns.push(
        { header: 'User Agent', key: 'userAgent', width: 30 },
        { header: 'IP Address', key: 'ipAddress', width: 15 },
        { header: 'Referrer', key: 'referrer', width: 25 }
      );
    }
    
    worksheet.columns = columns;
    
    // Add header row styling
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };
    
    // Add data rows
    submissions.forEach(submission => {
      const row: Record<string, any> = {
        id: submission.id,
        status: submission.status,
        submittedBy: submission.userEmail || submission.userName || 'Anonymous',
        submittedAt: submission.submittedAt || submission.createdAt
      };
      
      // Add form field data
      if (submission.data) {
        Object.entries(submission.data).forEach(([key, value]) => {
          row[key] = formatFieldValue(value);
        });
      }
      
      // Add metadata if requested
      if (includeMetadata && submission.metadata) {
        row.userAgent = submission.metadata.userAgent || '';
        row.ipAddress = submission.metadata.ipAddress || '';
        row.referrer = submission.metadata.referrer || '';
      }
      
      worksheet.addRow(row);
    });
    
    // Apply auto-filter
    worksheet.autoFilter = {
      from: 'A1',
      to: `${String.fromCharCode(65 + columns.length - 1)}1`
    };
    
    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  } catch (error) {
    console.error('Error exporting to XLSX:', error);
    throw new Error('Failed to export to XLSX format');
  }
}

/**
 * Export submissions to JSON format
 */
export function exportToJSON(data: ExportData): Buffer {
  try {
    const { submissions, form, includeMetadata } = data;
    
    const exportData = {
      form: {
        id: form.id,
        name: form.name,
        description: form.description,
        fields: form.fields
      },
      submissions: submissions.map(submission => {
        const exportSubmission: any = {
          id: submission.id,
          status: submission.status,
          submittedBy: submission.userEmail || submission.userName || 'Anonymous',
          submittedAt: submission.submittedAt || submission.createdAt,
          data: submission.data
        };
        
        if (includeMetadata) {
          exportSubmission.metadata = submission.metadata;
        }
        
        return exportSubmission;
      }),
      exportedAt: new Date().toISOString(),
      totalCount: submissions.length
    };
    
    return Buffer.from(JSON.stringify(exportData, null, 2));
  } catch (error) {
    console.error('Error exporting to JSON:', error);
    throw new Error('Failed to export to JSON format');
  }
}

/**
 * Format field value for export
 */
function formatFieldValue(value: any): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') {
    if (value.filename) return value.originalName || value.filename;
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Main export function that routes to appropriate format handler
 */
export async function exportSubmissions(
  format: 'csv' | 'xlsx' | 'json',
  data: ExportData
): Promise<Buffer> {
  switch (format) {
    case 'csv':
      return exportToCSV(data);
    case 'xlsx':
      return exportToXLSX(data);
    case 'json':
      return exportToJSON(data);
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}