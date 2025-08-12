-- Migration: Setup table partitioning for activity logs
-- Description: Partition activity logs by month for better performance with large datasets
-- Author: System
-- Date: 2025-08-04
-- Note: This is optional and should be used when expecting large volumes of data

-- Function to create monthly partitions for activity logs
CREATE OR REPLACE FUNCTION create_activity_log_partition(
    partition_date DATE
) RETURNS TEXT AS $$
DECLARE
    partition_name TEXT;
    start_date DATE;
    end_date DATE;
    create_sql TEXT;
BEGIN
    -- Generate partition name (e.g., user_activity_logs_2025_01)
    partition_name := 'user_activity_logs_' || TO_CHAR(partition_date, 'YYYY_MM');
    
    -- Calculate partition boundaries
    start_date := DATE_TRUNC('month', partition_date);
    end_date := start_date + INTERVAL '1 month';
    
    -- Check if partition already exists
    IF EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE tablename = partition_name
    ) THEN
        RETURN 'Partition ' || partition_name || ' already exists';
    END IF;
    
    -- Create partition table
    create_sql := format(
        'CREATE TABLE %I PARTITION OF user_activity_logs 
         FOR VALUES FROM (%L) TO (%L)',
        partition_name,
        start_date,
        end_date
    );
    
    EXECUTE create_sql;
    
    -- Create partition-specific indexes
    EXECUTE format('CREATE INDEX %I ON %I(user_id, created_at DESC)', 
                  'idx_' || partition_name || '_user_created', partition_name);
    EXECUTE format('CREATE INDEX %I ON %I(action_type)', 
                  'idx_' || partition_name || '_action_type', partition_name);
    EXECUTE format('CREATE INDEX %I ON %I(ip_address)', 
                  'idx_' || partition_name || '_ip_address', partition_name);
    
    RETURN 'Created partition ' || partition_name || ' for period ' || start_date || ' to ' || end_date;
END;
$$ LANGUAGE plpgsql;

-- Function to automatically create partitions for the next N months
CREATE OR REPLACE FUNCTION setup_future_partitions(months_ahead INTEGER DEFAULT 3)
RETURNS TEXT[] AS $$
DECLARE
    results TEXT[] := '{}';
    current_month DATE;
    i INTEGER;
    result TEXT;
BEGIN
    current_month := DATE_TRUNC('month', NOW());
    
    FOR i IN 0..months_ahead LOOP
        SELECT create_activity_log_partition(current_month + (i || ' months')::INTERVAL) INTO result;
        results := array_append(results, result);
    END LOOP;
    
    RETURN results;
END;
$$ LANGUAGE plpgsql;

-- Function to drop old partitions (for data retention)
CREATE OR REPLACE FUNCTION drop_old_activity_partitions(months_to_keep INTEGER DEFAULT 12)
RETURNS TEXT[] AS $$
DECLARE
    partition_record RECORD;
    cutoff_date DATE;
    results TEXT[] := '{}';
    drop_sql TEXT;
BEGIN
    cutoff_date := DATE_TRUNC('month', NOW() - (months_to_keep || ' months')::INTERVAL);
    
    FOR partition_record IN
        SELECT schemaname, tablename
        FROM pg_tables
        WHERE tablename LIKE 'user_activity_logs_%'
        AND tablename ~ '^user_activity_logs_\d{4}_\d{2}$'
    LOOP
        -- Extract date from partition name
        DECLARE
            partition_date DATE;
            date_part TEXT;
        BEGIN
            date_part := regexp_replace(partition_record.tablename, '^user_activity_logs_(\d{4})_(\d{2})$', '\1-\2-01');
            partition_date := date_part::DATE;
            
            IF partition_date < cutoff_date THEN
                drop_sql := format('DROP TABLE %I.%I CASCADE', 
                                 partition_record.schemaname, 
                                 partition_record.tablename);
                EXECUTE drop_sql;
                results := array_append(results, 'Dropped partition ' || partition_record.tablename);
            END IF;
        EXCEPTION
            WHEN OTHERS THEN
                results := array_append(results, 'Error processing ' || partition_record.tablename || ': ' || SQLERRM);
        END;
    END LOOP;
    
    RETURN results;
END;
$$ LANGUAGE plpgsql;

-- Convert existing table to partitioned table (if not already partitioned)
-- WARNING: This requires downtime and should be done during maintenance window
-- For now, we'll create a function that can be run manually if needed

CREATE OR REPLACE FUNCTION convert_to_partitioned_table()
RETURNS TEXT AS $$
DECLARE
    table_exists BOOLEAN;
    is_partitioned BOOLEAN;
BEGIN
    -- Check if table exists and if it's already partitioned
    SELECT EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE tablename = 'user_activity_logs'
    ) INTO table_exists;
    
    IF NOT table_exists THEN
        RETURN 'Table user_activity_logs does not exist';
    END IF;
    
    SELECT EXISTS (
        SELECT 1 FROM pg_partitioned_table pt
        JOIN pg_class c ON pt.partrelid = c.oid
        WHERE c.relname = 'user_activity_logs'
    ) INTO is_partitioned;
    
    IF is_partitioned THEN
        RETURN 'Table user_activity_logs is already partitioned';
    END IF;
    
    RETURN 'Table exists but is not partitioned. Manual conversion required during maintenance window.';
END;
$$ LANGUAGE plpgsql;

-- Create initial partitions for current and next few months
-- This will only work if the table is already partitioned
-- Comment out the following lines if table is not yet partitioned:

-- SELECT setup_future_partitions(6); -- Create partitions for next 6 months

-- Schedule automatic partition management (requires pg_cron extension)
-- Uncomment and modify these if pg_cron is available:

-- Example cron jobs (commented out):
-- CREATE new partition each month:
-- SELECT cron.schedule('create-monthly-partition', '0 0 1 * *', 'SELECT create_activity_log_partition(NOW() + INTERVAL ''2 months'');');

-- Cleanup old partitions quarterly:
-- SELECT cron.schedule('cleanup-old-partitions', '0 2 1 */3 *', 'SELECT drop_old_activity_partitions(12);');

-- Refresh materialized view daily:
-- SELECT cron.schedule('refresh-activity-stats', '0 1 * * *', 'SELECT refresh_activity_stats();');

-- Comments for documentation
COMMENT ON FUNCTION create_activity_log_partition IS 'Creates a monthly partition for activity logs table';
COMMENT ON FUNCTION setup_future_partitions IS 'Creates partitions for the next N months';
COMMENT ON FUNCTION drop_old_activity_partitions IS 'Drops old partitions beyond retention period';
COMMENT ON FUNCTION convert_to_partitioned_table IS 'Checks if table can be converted to partitioned (manual process required)';

-- Create helper view to show partition information
CREATE OR REPLACE VIEW activity_log_partition_info AS
SELECT 
    schemaname,
    tablename,
    regexp_replace(tablename, '^user_activity_logs_(\d{4})_(\d{2})$', '\1-\2-01')::DATE as partition_month,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE tablename LIKE 'user_activity_logs_%'
AND tablename ~ '^user_activity_logs_\d{4}_\d{2}$'
ORDER BY partition_month DESC;

COMMENT ON VIEW activity_log_partition_info IS 'Shows information about activity log partitions and their sizes';