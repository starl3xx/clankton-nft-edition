-- =============================================================================
-- Migration: Fix discount_action enum
-- =============================================================================
-- The production database has an enum type for the action column that's missing
-- newer values (farcaster_pro, early_fid). This migration adds them.
--
-- Run this in your Vercel Postgres dashboard or via:
--   psql $DATABASE_URL -f migrations/002_fix_action_enum.sql
-- =============================================================================

-- Add missing enum values if they don't exist
-- PostgreSQL 9.1+ supports IF NOT EXISTS for enum values via this pattern:

DO $$
BEGIN
    -- Check if the type exists and add values
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'discount_action') THEN
        -- Add farcaster_pro if not exists
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'farcaster_pro' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'discount_action')) THEN
            ALTER TYPE discount_action ADD VALUE 'farcaster_pro';
        END IF;

        -- Add early_fid if not exists
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'early_fid' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'discount_action')) THEN
            ALTER TYPE discount_action ADD VALUE 'early_fid';
        END IF;
    END IF;
END
$$;
