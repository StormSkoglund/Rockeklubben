# Rockeklubben Scheduler (Vite + React + TypeScript)

Simple calendar where users drag names onto dates and bookings are saved to Supabase.

## Quick start

1. Copy `.env.example` → `.env` and add your Supabase `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
2. Run:
   - npm install
   - npm run dev
3. Open http://localhost:5173

## Supabase setup

- Run the SQL in `supabase/migrations/create_bookings_table.sql` (Supabase SQL editor) to create the `bookings` table.
  - New schema uses `start_ts` / `end_ts` (timestamps) and an exclusion constraint to prevent overlapping bookings.
  - If you upgraded from the older single-day schema, run `supabase/migrations/alter_bookings_for_time_slots.sql` to migrate existing table.
- For testing run `supabase/migrations/policies_for_testing.sql` to enable permissive RLS policies (see warnings in that file).
- Important: use the **anon** key (never the service role key) for this client app.

SQL note: the table now stores hourly `start_ts` / `end_ts` and enforces no overlapping time ranges using a GIST exclusion constraint.

### Troubleshooting: "Failed to save booking"

- Common causes:
  - Invalid `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` in `.env` (check Dashboard → Settings → API).
  - `bookings` table not created or RLS policies blocking anon access.
  - DB-level UNIQUE constraint rejection (date already booked) or invalid date format.
- How to diagnose:
  1. Open browser DevTools Console — look for Supabase error details.
  2. Check the notice banner in the app (appears when Supabase returns errors).
  3. Run the verification SQL in Supabase SQL editor: `SELECT * FROM public.bookings LIMIT 5;` or check `pg_policies`.
  4. Ensure `.env` values are correct and restart the dev server.

## Behavior

- Drag a name from the left column onto a date to create a booking.
- Client prevents visible double-booking; the DB has a UNIQUE constraint to prevent race-condition double-booking.
- If DB rejects the insert, the UI removes the calendar event and shows an error.
- Realtime updates: bookings made in one browser appear in other open sessions automatically.
- Undo toast: after creating/rescheduling a booking you get an "Undo" toast to quickly cancel it.
- Cancel / Reschedule: click an existing booking to cancel it or pick a new date to reschedule.

## Files

- `src/components/Calendar.tsx` — FullCalendar + drop handling
- `src/components/DraggableNames.tsx` — external draggable names
- `src/lib/supabase.ts` — Supabase client
- `supabase/migrations/create_bookings_table.sql` — SQL to create `bookings` table

## Next steps (optional)

- Add auth (Supabase Auth)
- Real-time updates using `supabase.channel` / Realtime
- Allow cancelling/rescheduling bookings
