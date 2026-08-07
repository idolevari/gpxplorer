-- ---------------------------------------------------------------------------
-- service_role table grants
--
-- Discovered by Task 8's import script: service_role has BYPASSRLS, which
-- skips policies, but GRANT and RLS are two different gates (see the
-- comment in 20260725123515_init_schema.sql). Without an explicit GRANT,
-- PostgREST rejects service_role with "permission denied for table trips"
-- before RLS is ever consulted -- BYPASSRLS never even comes into play.
-- The admin client (api/db.py get_admin_client) needs full CRUD on these
-- tables to do backend/import work on a user's behalf.
-- ---------------------------------------------------------------------------

grant usage on schema public to service_role;

grant select, insert, update, delete
  on public.profiles, public.trips, public.trip_days
  to service_role;
