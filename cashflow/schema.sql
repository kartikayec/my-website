-- SmartNiwas Cash Flow Schema for Cloudflare D1 SQLite

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user', -- admin, user
    name TEXT,
    password_changed INTEGER NOT NULL DEFAULT 0
);

-- Payments Table (Payment commitments)
CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    amount REAL NOT NULL,
    frequency TEXT NOT NULL, -- monthly, quarterly, annual, one-time
    next_due_date TEXT NOT NULL, -- YYYY-MM-DD
    status TEXT NOT NULL DEFAULT 'active', -- active, inactive
    notes TEXT,
    user_id INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Settings Table (e.g. alert settings, contacts)
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
);

-- Email Logs Table (Cron mailing audit trail)
CREATE TABLE IF NOT EXISTS email_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payment_id INTEGER,
    recipient TEXT NOT NULL,
    subject TEXT NOT NULL,
    sent_at TEXT DEFAULT CURRENT_TIMESTAMP,
    status TEXT NOT NULL, -- Success, Failed
    error_message TEXT,
    FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL
);
