-- Create todos table for task management
CREATE TABLE IF NOT EXISTS todos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    category VARCHAR(50),
    due_date TIMESTAMP,
    completed_at TIMESTAMP,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_todos_user_id ON todos(user_id);
CREATE INDEX IF NOT EXISTS idx_todos_assigned_to ON todos(assigned_to);
CREATE INDEX IF NOT EXISTS idx_todos_status ON todos(status);
CREATE INDEX IF NOT EXISTS idx_todos_priority ON todos(priority);
CREATE INDEX IF NOT EXISTS idx_todos_due_date ON todos(due_date);
CREATE INDEX IF NOT EXISTS idx_todos_category ON todos(category);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_todos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_todos_updated_at
    BEFORE UPDATE ON todos
    FOR EACH ROW
    EXECUTE PROCEDURE update_todos_updated_at();

-- Insert sample data
INSERT INTO todos (title, description, priority, status, category, user_id, assigned_to, due_date) VALUES
('Complete user authentication system', 'Implement JWT authentication with refresh tokens', 'high', 'completed', 'Development', 2, 2, '2025-08-10 10:00:00'),
('Fix group management bugs', 'Resolve issues with group member search functionality', 'medium', 'completed', 'Bug Fix', 2, 2, '2025-08-11 15:00:00'),
('Implement todo management system', 'Create comprehensive todo system with categories and priorities', 'high', 'in_progress', 'Feature', 2, 2, '2025-08-15 18:00:00'),
('Review form builder performance', 'Optimize form builder for better loading times', 'medium', 'pending', 'Performance', 2, NULL, '2025-08-20 12:00:00'),
('Update API documentation', 'Document all new API endpoints and update existing ones', 'low', 'pending', 'Documentation', 2, NULL, '2025-08-25 14:00:00'),
('Setup monitoring dashboard', 'Configure application monitoring and alerting', 'high', 'pending', 'Infrastructure', 2, NULL, '2025-08-18 09:00:00');