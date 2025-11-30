-- =============================================================================
-- Database Initialization Script for Clankton NFT Mini App
-- =============================================================================
-- Run this script to set up all required tables for the application.
--
-- For Vercel Postgres, you can run this in the Vercel dashboard SQL editor
-- or via the Vercel CLI.
--
-- Usage with psql:
--   psql $DATABASE_URL -f migrations/init.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Table: clankton_discounts
-- -----------------------------------------------------------------------------
-- Summary table storing verified discount flags for each wallet address.
-- This is the source of truth for pricing calculations and EIP-712 signatures.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clankton_discounts (
  address TEXT PRIMARY KEY,

  -- Social action discounts
  casted BOOLEAN DEFAULT FALSE,          -- Cast about the mint (-2M CLANKTON)
  recast BOOLEAN DEFAULT FALSE,          -- Recast announcement (-4M CLANKTON)
  tweeted BOOLEAN DEFAULT FALSE,         -- Tweet about mint (-1M CLANKTON)

  -- Follow discounts (-500K each)
  follow_tpc BOOLEAN DEFAULT FALSE,      -- Follow @thepapercrane
  follow_star BOOLEAN DEFAULT FALSE,     -- Follow @starl3xx.eth
  follow_channel BOOLEAN DEFAULT FALSE,  -- Join /clankton channel

  -- Auto-detected discounts (-500K each)
  farcaster_pro BOOLEAN DEFAULT FALSE,   -- Farcaster Pro subscription
  early_fid BOOLEAN DEFAULT FALSE,       -- FID < 100,000

  -- Metadata
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for faster lookups by address
CREATE INDEX IF NOT EXISTS idx_clankton_discounts_address
ON clankton_discounts(address);

-- -----------------------------------------------------------------------------
-- Table: clankton_discount_actions
-- -----------------------------------------------------------------------------
-- Event log table for tracking individual discount actions.
-- Provides an audit trail and enables notification targeting.
-- Uses composite primary key for idempotent inserts.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clankton_discount_actions (
  address TEXT NOT NULL,
  action TEXT NOT NULL,
  fid TEXT,                              -- Farcaster ID for notification targeting
  created_at TIMESTAMP DEFAULT NOW(),

  PRIMARY KEY (address, action)
);

-- Index for querying by FID (for notifications)
CREATE INDEX IF NOT EXISTS idx_clankton_discount_actions_fid
ON clankton_discount_actions(fid);

-- Index for querying by action type
CREATE INDEX IF NOT EXISTS idx_clankton_discount_actions_action
ON clankton_discount_actions(action);

-- -----------------------------------------------------------------------------
-- Table: sent_notifications
-- -----------------------------------------------------------------------------
-- Tracks sent notifications to prevent duplicate sends.
-- Used by the notification trigger endpoint.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sent_notifications (
  id SERIAL PRIMARY KEY,
  fid BIGINT NOT NULL,
  notification_type TEXT NOT NULL,
  sent_at TIMESTAMP DEFAULT NOW(),

  -- Prevent duplicate notifications per user per type
  UNIQUE(fid, notification_type)
);

-- Index for faster lookups by FID
CREATE INDEX IF NOT EXISTS idx_sent_notifications_fid
ON sent_notifications(fid);

-- =============================================================================
-- Verification
-- =============================================================================
-- After running this script, verify tables were created:
--
--   SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public'
--   AND table_name LIKE 'clankton%' OR table_name = 'sent_notifications';
--
-- Expected output:
--   - clankton_discounts
--   - clankton_discount_actions
--   - sent_notifications
-- =============================================================================
