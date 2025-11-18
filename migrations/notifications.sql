-- Notification tokens table
-- Stores tokens for users who have granted notification permission
CREATE TABLE IF NOT EXISTS notification_tokens (
  fid BIGINT PRIMARY KEY,
  token TEXT NOT NULL,
  address TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for querying by address
CREATE INDEX IF NOT EXISTS idx_notification_tokens_address ON notification_tokens(address);

-- Table to track sent notifications (prevent duplicates)
CREATE TABLE IF NOT EXISTS sent_notifications (
  id SERIAL PRIMARY KEY,
  fid BIGINT NOT NULL,
  notification_type TEXT NOT NULL,
  sent_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(fid, notification_type)
);

-- Add FID column to discount actions table for correlation with notification tokens
ALTER TABLE clankton_discount_actions
ADD COLUMN IF NOT EXISTS fid TEXT;
