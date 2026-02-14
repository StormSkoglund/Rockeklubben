-- Migration: convert bookings to timestamp ranges and prevent overlapping bookings
-- Run this in Supabase SQL editor for existing projects.

-- 1) Remove the old UNIQUE(date) constraint so multiple bookings per day are allowed
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_date_key;

-- 2) Add start_ts/end_ts columns (timestamptz)
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS start_ts timestamptz,
  ADD COLUMN IF NOT EXISTS end_ts timestamptz;

-- 3) Backfill existing rows: set start_ts to midnight and end_ts to start + 1 hour (or adjust as needed)
UPDATE public.bookings
SET start_ts = (date::timestamptz),
    end_ts = (date::timestamptz + interval '01:00')
WHERE start_ts IS NULL OR end_ts IS NULL;

-- 4) Make sure columns are not null going forward
ALTER TABLE public.bookings
  ALTER COLUMN start_ts SET NOT NULL,
  ALTER COLUMN end_ts SET NOT NULL;

-- 5) Create exclusion constraint to prevent overlapping time ranges (requires gist)
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_no_time_overlap EXCLUDE USING gist (tstzrange(start_ts, end_ts) WITH &&);

-- 6) Optional: drop legacy `date` column if you prefer (keep if you want to show only-day UI)
-- ALTER TABLE public.bookings DROP COLUMN IF EXISTS date;

-- Verification: attempt to insert overlapping rows will now fail with a constraint error
-- Example (this will fail if overlap exists):
-- INSERT INTO public.bookings (start_ts, end_ts, user_name) VALUES ('2026-02-14 10:00','2026-02-14 11:00','SQL Test');
