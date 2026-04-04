-- Flip Thursday alternating bands to the correct parity scheme
-- Warfart on odd ISO weeks, Verdiløse Menn on even ISO weeks
-- Applies to the next 52 weeks from today.

UPDATE public.bookings
SET user_name = CASE
  WHEN (CAST(to_char(start_ts, 'IW') AS int) % 2) = 1 THEN 'Warfart'
  ELSE 'Verdiløse Menn'
END
WHERE start_ts >= now()::date
  AND start_ts < (now()::date + INTERVAL '53 weeks')
  AND EXTRACT('isodow' FROM start_ts)::int = 4
  AND user_name IN ('Warfart', 'Verdiløse Menn');
