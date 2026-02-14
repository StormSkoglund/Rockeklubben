-- Run this in Supabase SQL editor
-- Creates bookings table using timestamp ranges and prevents overlapping bookings

create extension if not exists "pgcrypto";
create extension if not exists btree_gist;

CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_name text NOT NULL,
  start_ts timestamptz NOT NULL,
  end_ts timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Prevent overlapping time ranges (exclusion constraint)
ALTER TABLE public.bookings
  ADD CONSTRAINT IF NOT EXISTS bookings_no_time_overlap EXCLUDE USING gist (tstzrange(start_ts, end_ts) WITH &&);
