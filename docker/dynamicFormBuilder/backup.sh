#!/bin/sh
# Dynamic Form Builder Backup Script

# Configuration
DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-xp_formbuilder}"
DB_USER="${DB_USER:-formbuilder}"
BACKUP_DIR="/backups"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Generate backup filename with timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/formbuilder_backup_$TIMESTAMP.sql.gz"

# Perform backup
echo "Starting backup of $DB_NAME at $(date)"
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    --no-owner --no-privileges --verbose \
    | gzip > "$BACKUP_FILE"

# Check if backup was successful
if [ $? -eq 0 ]; then
    echo "Backup completed successfully: $BACKUP_FILE"
    
    # Get file size
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "Backup size: $SIZE"
    
    # Create latest symlink
    ln -sf "$BACKUP_FILE" "$BACKUP_DIR/formbuilder_backup_latest.sql.gz"
    
    # Clean up old backups
    echo "Cleaning up backups older than $RETENTION_DAYS days"
    find "$BACKUP_DIR" -name "formbuilder_backup_*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete
    
    # List remaining backups
    echo "Current backups:"
    ls -lh "$BACKUP_DIR"/formbuilder_backup_*.sql.gz
else
    echo "Backup failed at $(date)"
    exit 1
fi

# Export form submissions as JSON (additional backup)
if [ "${EXPORT_SUBMISSIONS:-true}" = "true" ]; then
    echo "Exporting form submissions as JSON"
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "\
        COPY (
            SELECT jsonb_build_object(
                'form_id', fs.form_id,
                'form_title', f.title,
                'submission_id', fs.id,
                'data', fs.data,
                'submitted_at', fs.submitted_at,
                'files', COALESCE(
                    jsonb_agg(
                        jsonb_build_object(
                            'field_key', fsf.field_key,
                            'filename', fsf.filename,
                            'original_name', fsf.original_name,
                            'size', fsf.size
                        )
                    ) FILTER (WHERE fsf.id IS NOT NULL),
                    '[]'::jsonb
                )
            )
            FROM form_submissions fs
            JOIN forms f ON fs.form_id = f.id
            LEFT JOIN form_submission_files fsf ON fs.id = fsf.submission_id
            WHERE fs.submitted_at >= CURRENT_DATE - INTERVAL '30 days'
            GROUP BY fs.id, fs.form_id, f.title, fs.data, fs.submitted_at
            ORDER BY fs.submitted_at DESC
        ) TO STDOUT WITH (FORMAT CSV, HEADER FALSE)
    " | gzip > "$BACKUP_DIR/submissions_export_$TIMESTAMP.json.gz"
fi

echo "Backup process completed at $(date)"