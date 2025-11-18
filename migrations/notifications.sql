-- Notifications setup for Farcaster miniapp
-- Neynar handles notification token storage automatically
-- We only need to track sent notifications to prevent duplicates

-- Table to track sent notifications (prevent duplicates)
CREATE TABLE IF NOT EXISTS sent_notifications (
  id SERIAL PRIMARY KEY,
  fid BIGINT NOT NULL,
  notification_type TEXT NOT NULL,
  sent_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(fid, notification_type)
);

-- Add FID column to discount actions table
-- This allows us to target notifications to engaged users
ALTER TABLE clankton_discount_actions
ADD COLUMN IF NOT EXISTS fid TEXT;
