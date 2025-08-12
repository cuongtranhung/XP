#!/usr/bin/env node

/**
 * Script Generator cho PostgreSQL Database
 * Tự động tạo các file SQL script từ database hiện tại
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:@abcd1234@192.168.5.3:5432/postgres'
});

async function generateSchemaScript() {
  try {
    console.log('🚀 Generating schema scripts...');
    
    // 1. Get all tables
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    let fullScript = `-- Generated Schema Script\n-- Date: ${new Date().toISOString()}\n\n`;
    
    for (const table of tablesResult.rows) {
      const tableName = table.table_name;
      console.log(`📋 Processing table: ${tableName}`);
      
      // Get table structure
      const columnsResult = await pool.query(`
        SELECT 
          column_name,
          data_type,
          character_maximum_length,
          is_nullable,
          column_default,
          ordinal_position
        FROM information_schema.columns 
        WHERE table_name = $1 AND table_schema = 'public'
        ORDER BY ordinal_position
      `, [tableName]);
      
      // Generate CREATE TABLE statement
      fullScript += `-- Table: ${tableName}\n`;
      fullScript += `CREATE TABLE IF NOT EXISTS ${tableName} (\n`;
      
      const columns = [];
      for (const col of columnsResult.rows) {
        let columnDef = `    ${col.column_name} `;
        
        // Data type
        if (col.data_type === 'character varying') {
          columnDef += `VARCHAR(${col.character_maximum_length})`;
        } else if (col.data_type === 'integer') {
          columnDef += 'INTEGER';
        } else if (col.data_type === 'boolean') {
          columnDef += 'BOOLEAN';
        } else if (col.data_type === 'timestamp with time zone') {
          columnDef += 'TIMESTAMP WITH TIME ZONE';
        } else {
          columnDef += col.data_type.toUpperCase();
        }
        
        // Nullable
        if (col.is_nullable === 'NO') {
          columnDef += ' NOT NULL';
        }
        
        // Default value
        if (col.column_default) {
          columnDef += ` DEFAULT ${col.column_default}`;
        }
        
        columns.push(columnDef);
      }
      
      fullScript += columns.join(',\n') + '\n';
      fullScript += ');\n\n';
      
      // Get indexes
      const indexesResult = await pool.query(`
        SELECT 
          indexname,
          indexdef
        FROM pg_indexes 
        WHERE tablename = $1 AND schemaname = 'public'
        AND indexname != $1 || '_pkey'
      `, [tableName]);
      
      for (const index of indexesResult.rows) {
        fullScript += `${index.indexdef};\n`;
      }
      
      fullScript += '\n';
    }
    
    // Get foreign key constraints
    const fkResult = await pool.query(`
      SELECT
        tc.table_name,
        tc.constraint_name,
        tc.constraint_type,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
    `);
    
    if (fkResult.rows.length > 0) {
      fullScript += '-- Foreign Key Constraints\n';
      for (const fk of fkResult.rows) {
        fullScript += `ALTER TABLE ${fk.table_name} ADD CONSTRAINT ${fk.constraint_name} `;
        fullScript += `FOREIGN KEY (${fk.column_name}) `;
        fullScript += `REFERENCES ${fk.foreign_table_name}(${fk.foreign_column_name}) ON DELETE CASCADE;\n`;
      }
      fullScript += '\n';
    }
    
    // Save to file
    const outputPath = path.join(__dirname, '../database/generated-schema.sql');
    fs.writeFileSync(outputPath, fullScript);
    console.log(`✅ Schema script generated: ${outputPath}`);
    
    // Also create individual table scripts
    const tablesDir = path.join(__dirname, '../database/tables');
    if (!fs.existsSync(tablesDir)) {
      fs.mkdirSync(tablesDir, { recursive: true });
    }
    
    // Generate insert scripts for data
    await generateDataScript();
    
  } catch (error) {
    console.error('❌ Error generating schema script:', error);
  } finally {
    await pool.end();
  }
}

async function generateDataScript() {
  console.log('📊 Generating data insert scripts...');
  
  const tablesResult = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name
  `);
  
  let dataScript = `-- Generated Data Script\n-- Date: ${new Date().toISOString()}\n\n`;
  
  for (const table of tablesResult.rows) {
    const tableName = table.table_name;
    
    // Get data
    const dataResult = await pool.query(`SELECT * FROM ${tableName} LIMIT 100`);
    
    if (dataResult.rows.length > 0) {
      dataScript += `-- Data for table: ${tableName}\n`;
      
      const columns = Object.keys(dataResult.rows[0]);
      dataScript += `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES\n`;
      
      const values = [];
      for (const row of dataResult.rows) {
        const rowValues = columns.map(col => {
          const value = row[col];
          if (value === null) return 'NULL';
          if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
          if (value instanceof Date) return `'${value.toISOString()}'`;
          if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
          return value;
        });
        values.push(`    (${rowValues.join(', ')})`);
      }
      
      dataScript += values.join(',\n') + ';\n\n';
    }
  }
  
  // Save data script
  const dataOutputPath = path.join(__dirname, '../database/generated-data.sql');
  fs.writeFileSync(dataOutputPath, dataScript);
  console.log(`✅ Data script generated: ${dataOutputPath}`);
}

// Run the generator
if (require.main === module) {
  generateSchemaScript();
}

module.exports = { generateSchemaScript };