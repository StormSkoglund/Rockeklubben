-- Policies for testing (Supabase SQL editor)
-- PURPOSE: Allow anonymous (anon) client to INSERT/SELECT/UPDATE/DELETE on `bookings`
-- WARNING: These policies are permissive and should only be used for local/dev testing.

-- 1) Ensure the table exists (run the create_bookings_table.sql first if you haven't):
-- (create_bookings_table.sql already creates the table with UNIQUE(date))

-- 2) Enable Row Level Security (RLS)
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- 3) Create permissive policies for testing (anon access)
CREATE POLICY "anon_select_bookings" ON public.bookings
  FOR SELECT
  USING (true);

CREATE POLICY "anon_insert_bookings" ON public.bookings
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "anon_update_bookings" ON public.bookings
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "anon_delete_bookings" ON public.bookings
  FOR DELETE
  USING (true);

-- 4) Quick check: list policies for the bookings table
-- Run this to verify policies were created
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'bookings';

-- 5) (Optional) Example insert to test from SQL
-- INSERT INTO public.bookings (date, user_name) VALUES ('2026-02-20', 'Test User');

-- 6) Cleanup / remove permissive policies (do this when you stop testing):
-- DROP POLICY IF EXISTS "anon_select_bookings" ON public.bookings;
-- DROP POLICY IF EXISTS "anon_insert_bookings" ON public.bookings;
-- DROP POLICY IF EXISTS "anon_update_bookings" ON public.bookings;
-- DROP POLICY IF EXISTS "anon_delete_bookings" ON public.bookings;
-- ALTER TABLE public.bookings DISABLE ROW LEVEL SECURITY; -- if you want to revert to no RLS
