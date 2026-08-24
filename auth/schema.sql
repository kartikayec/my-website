-- SmartNiwas D1 Database Schema for Centralized Auth & Identity
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT CHECK(role IN ('admin', 'regular')) NOT NULL DEFAULT 'regular',
    must_change_password BOOLEAN NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS auth_tokens (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT CHECK(type IN ('INVITE', 'PASSWORD_RESET', 'SESSION')) NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
