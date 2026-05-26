-- Migration: Photo Moderation
-- Run this on existing databases to enable the moderation system.
-- psql -U postgres -d djapp -f migration_moderation.sql

-- 1. Add reports counter
ALTER TABLE event_photos
  ADD COLUMN IF NOT EXISTS reports INTEGER NOT NULL DEFAULT 0;

-- 2. New photos must wait for DJ approval (change default to false)
ALTER TABLE event_photos
  ALTER COLUMN approved SET DEFAULT false;

-- 3. Mark existing photos as already approved so they keep appearing
UPDATE event_photos SET approved = true WHERE approved = true;
