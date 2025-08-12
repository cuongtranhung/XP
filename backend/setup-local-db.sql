-- Create users table if not exists
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create a test user with the specified credentials
-- Password: @Abcd6789 (bcrypt hash with 12 rounds)
INSERT INTO users (email, password_hash, full_name, is_active, is_verified)
VALUES (
    'cuongtranhung@gmail.com',
    '$2a$12$m52OogB/ct6pTsv9lYNXWOtTufbGYpzdBzhnKm3qK.t4A2k9uYDG.',
    'Cuong Tran Hung',
    true,
    true
)
ON CONFLICT (email) 
DO UPDATE SET 
    password_hash = '$2a$12$m52OogB/ct6pTsv9lYNXWOtTufbGYpzdBzhnKm3qK.t4A2k9uYDG.',
    is_active = true,
    is_verified = true,
    updated_at = CURRENT_TIMESTAMP;

-- Verify the user was created
SELECT email, full_name, is_active, is_verified FROM users WHERE email = 'cuongtranhung@gmail.com';