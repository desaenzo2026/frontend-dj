-- DJ App Database Schema
-- Run: psql -U postgres -d djapp -f schema.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────
-- USERS  (DJ accounts)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  username      VARCHAR(100) UNIQUE NOT NULL,
  password_hash TEXT        NOT NULL,
  role          VARCHAR(50) NOT NULL DEFAULT 'dj',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- EVENTS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title         VARCHAR(255) NOT NULL,
  venue         VARCHAR(255),
  event_date    DATE         NOT NULL,
  start_time    TIME,
  end_time      TIME,
  notes         TEXT,
  status        VARCHAR(50)  NOT NULL DEFAULT 'upcoming'
                             CHECK (status IN ('upcoming','active','completed','cancelled')),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- SONG LISTS  (collaborative, shareable)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS song_lists (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID        REFERENCES events(id) ON DELETE CASCADE,
  name          VARCHAR(255) NOT NULL,
  share_token   VARCHAR(100) UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  is_active     BOOLEAN      NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS list_songs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id       UUID        NOT NULL REFERENCES song_lists(id) ON DELETE CASCADE,
  title         VARCHAR(255) NOT NULL,
  artist        VARCHAR(255),
  added_by      VARCHAR(100),
  position      INTEGER      NOT NULL DEFAULT 0,
  played        BOOLEAN      NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- LIVE SONG REQUESTS  (real-time ranking)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS song_requests (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title         VARCHAR(255) NOT NULL,
  artist        VARCHAR(255),
  requested_by  VARCHAR(100),
  votes         INTEGER      NOT NULL DEFAULT 0,
  status        VARCHAR(50)  NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending','played','rejected')),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- One vote per (request, voter_token) to prevent duplicates
CREATE TABLE IF NOT EXISTS request_votes (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id    UUID        NOT NULL REFERENCES song_requests(id) ON DELETE CASCADE,
  voter_token   VARCHAR(100) NOT NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (request_id, voter_token)
);

-- ─────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_events_date        ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_song_lists_event   ON song_lists(event_id);
CREATE INDEX IF NOT EXISTS idx_list_songs_list    ON list_songs(list_id);
CREATE INDEX IF NOT EXISTS idx_requests_event     ON song_requests(event_id);
CREATE INDEX IF NOT EXISTS idx_requests_votes     ON song_requests(votes DESC);
CREATE INDEX IF NOT EXISTS idx_votes_request      ON request_votes(request_id);

-- ─────────────────────────────────────────
-- AUTO-UPDATE updated_at
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER requests_updated_at
  BEFORE UPDATE ON song_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────
-- PHOTO WALL  (event photos uploaded by attendees)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_photos (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  filename      VARCHAR(255) NOT NULL,
  original_name VARCHAR(255),
  uploaded_by   VARCHAR(100),
  approved      BOOLEAN      NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_photos_event ON event_photos(event_id);
CREATE INDEX IF NOT EXISTS idx_photos_created ON event_photos(created_at DESC);
