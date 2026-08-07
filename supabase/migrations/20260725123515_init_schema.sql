-- GPXplorer v0 schema: auth, trips, sharing.
--
-- Core structural decision: a TRIP is a journey and a TRIP_DAY is one leg of it.
-- The cross-Israel ride is one trip with nine days, not nine trips.
--
-- Every metric column is nullable on purpose. A missing metric means UNKNOWABLE,
-- not zero -- a campervan route reconstructed from photographs genuinely has no
-- moving time, and writing 0 there would poison every average computed over it.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

-- Decides which metrics are meaningful. Climbing is the whole story on a bike
-- and noise in a campervan; max speed on a motorway says nothing.
create type public.activity_type as enum (
  'cycling', 'hiking', 'running', 'campervan', 'motorcycle', 'other'
);

create type public.visibility as enum ('private', 'unlisted', 'public');

-- Decides which metrics are KNOWABLE, independently of activity type.
-- The two intersect: a recorded campervan trip can report average driving speed;
-- a reconstructed one cannot, because speed is not recoverable from photographs.
create type public.fidelity as enum ('recorded', 'reconstructed', 'hybrid');

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  handle       text not null unique,
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now()
);

comment on table public.profiles is
  'One row per authenticated user. Accounts exist only for people KEEPING trips; reading never requires one.';

-- Auth is Supabase-managed, so a trigger mirrors new users into profiles.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_handle text;
begin
  base_handle := lower(regexp_replace(split_part(new.email, '@', 1), '[^a-zA-Z0-9]', '', 'g'));
  if base_handle = '' then
    base_handle := 'rider';
  end if;

  insert into public.profiles (id, handle, display_name)
  values (
    new.id,
    -- suffix keeps handles unique without a retry loop
    base_handle || '-' || substr(replace(new.id::text, '-', ''), 1, 6),
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- trips
-- ---------------------------------------------------------------------------

create table public.trips (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.profiles (id) on delete cascade,
  slug          text not null,
  title         text not null,
  description   text,
  activity_type public.activity_type not null default 'other',
  visibility    public.visibility    not null default 'private',
  -- Only ever set for unlisted trips. Rotating it revokes every existing link.
  share_token   text unique,
  fidelity      public.fidelity      not null default 'recorded',
  start_date    date,
  end_date      date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  published_at  timestamptz,
  unique (owner_id, slug)
);

create index trips_owner_idx  on public.trips (owner_id);
create index trips_public_idx on public.trips (visibility) where visibility = 'public';

comment on column public.trips.share_token is
  'Unguessable 128-bit token for unlisted links. Regenerating it 404s every link previously shared.';

-- ---------------------------------------------------------------------------
-- trip_days
-- ---------------------------------------------------------------------------

create table public.trip_days (
  id                uuid primary key default gen_random_uuid(),
  trip_id           uuid not null references public.trips (id) on delete cascade,
  day_index         int  not null check (day_index >= 1),
  date              date,
  title             text,
  notes             text,

  -- Storage KEY, never a URL. Signed URLs expire and public URLs cannot be
  -- revoked; a key survives a bucket, project or region move.
  gpx_path          text,

  -- All nullable. NULL means unknowable.
  distance_m        numeric,
  moving_distance_m numeric,
  elevation_gain_m  numeric,
  elevation_loss_m  numeric,
  moving_time_s     numeric,
  stopped_time_s    numeric,
  max_speed_mps     numeric,
  avg_speed_mps     numeric,
  min_elevation_m   numeric,
  max_elevation_m   numeric,

  start_lat         double precision,
  start_lon         double precision,
  end_lat           double precision,
  end_lon           double precision,
  bbox              jsonb,

  -- ~200-point simplified polyline. Lets the map and elevation profile render
  -- straight from this row, so VIEWING a trip never touches Storage at all.
  geom_simplified   jsonb,

  created_at        timestamptz not null default now(),
  unique (trip_id, day_index)
);

create index trip_days_trip_idx on public.trip_days (trip_id, day_index);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create function public.trips_before_write()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();

  -- An unlisted trip is worthless without a token, so mint one automatically.
  if new.visibility = 'unlisted' and new.share_token is null then
    new.share_token := encode(extensions.gen_random_bytes(16), 'hex');
  end if;

  -- Leaving a token behind on a private/public trip would keep old links alive.
  if new.visibility <> 'unlisted' then
    new.share_token := null;
  end if;

  if new.visibility = 'public' and new.published_at is null then
    new.published_at := now();
  end if;

  return new;
end;
$$;

create trigger trips_before_write
  before insert or update on public.trips
  for each row execute function public.trips_before_write();

-- Rotate a link without changing anything else.
create function public.rotate_share_token(trip uuid)
returns text
language plpgsql
security invoker
as $$
declare
  fresh text;
begin
  update public.trips
     set share_token = encode(extensions.gen_random_bytes(16), 'hex')
   where id = trip
     and owner_id = (select auth.uid())
     and visibility = 'unlisted'
  returning share_token into fresh;

  if fresh is null then
    raise exception 'trip not found, not yours, or not unlisted';
  end if;
  return fresh;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- Postgres enforces access, not handler code. That is what lets the browser
-- query this database directly. Note what is ABSENT: no policy grants access to
-- an unlisted trip, because RLS cannot read a URL token. Unlisted trips are
-- reachable only through the SECURITY DEFINER functions below.
-- ---------------------------------------------------------------------------

alter table public.profiles  enable row level security;
alter table public.trips     enable row level security;
alter table public.trip_days enable row level security;

-- GRANTs and RLS are two different gates and BOTH are required. A GRANT says the
-- role may touch the table at all; a policy says which rows it then sees. Without
-- these, PostgREST returns "permission denied for table trips" before any policy
-- is ever consulted.
grant usage on schema public to anon, authenticated;

grant select on public.profiles, public.trips, public.trip_days to anon, authenticated;
grant update on public.profiles to authenticated;
grant insert, update, delete on public.trips, public.trip_days to authenticated;

create policy "profiles are publicly readable"
  on public.profiles for select using (true);

create policy "a user may update only their own profile"
  on public.profiles for update using ((select auth.uid()) = id);

create policy "public trips are readable by anyone, private only by their owner"
  on public.trips for select
  using (visibility = 'public' or owner_id = (select auth.uid()));

create policy "a user may create trips they own"
  on public.trips for insert with check (owner_id = (select auth.uid()));

create policy "a user may update their own trips"
  on public.trips for update using (owner_id = (select auth.uid()));

create policy "a user may delete their own trips"
  on public.trips for delete using (owner_id = (select auth.uid()));

create policy "trip days follow their trip's visibility"
  on public.trip_days for select
  using (exists (
    select 1 from public.trips t
    where t.id = trip_days.trip_id
      and (t.visibility = 'public' or t.owner_id = (select auth.uid()))
  ));

create policy "a user may write days on their own trips"
  on public.trip_days for all
  using (exists (
    select 1 from public.trips t
    where t.id = trip_days.trip_id and t.owner_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.trips t
    where t.id = trip_days.trip_id and t.owner_id = (select auth.uid())
  ));

-- ---------------------------------------------------------------------------
-- Unlisted access
--
-- RLS policies cannot see a URL, so a secret link cannot be expressed as a
-- policy. These functions bypass RLS for exactly one lookup, keyed on a token
-- the caller must already hold.
-- ---------------------------------------------------------------------------

create function public.get_trip_by_share_token(token text)
returns setof public.trips
language sql
security definer
stable
set search_path = public
as $$
  select * from public.trips
   where share_token = token
     and visibility = 'unlisted'
   limit 1;
$$;

create function public.get_trip_days_by_share_token(token text)
returns setof public.trip_days
language sql
security definer
stable
set search_path = public
as $$
  select d.*
    from public.trip_days d
    join public.trips t on t.id = d.trip_id
   where t.share_token = token
     and t.visibility = 'unlisted'
   order by d.day_index;
$$;

grant execute on function public.get_trip_by_share_token(text)      to anon, authenticated;
grant execute on function public.get_trip_days_by_share_token(text) to anon, authenticated;
grant execute on function public.rotate_share_token(uuid)           to authenticated;

-- ---------------------------------------------------------------------------
-- Storage
--
-- Both buckets are private. The database stores only the object key; the API
-- mints a signed URL at request time, after checking visibility. Object keys
-- are laid out as {owner_id}/{trip_id}/... so ownership is checkable from the
-- path alone.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('trip-gpx', 'trip-gpx', false),
       ('trip-photos', 'trip-photos', false)
on conflict (id) do nothing;

create policy "owners may upload into their own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id in ('trip-gpx', 'trip-photos')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "owners may read their own objects"
  on storage.objects for select to authenticated
  using (
    bucket_id in ('trip-gpx', 'trip-photos')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "owners may replace their own objects"
  on storage.objects for update to authenticated
  using (
    bucket_id in ('trip-gpx', 'trip-photos')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "owners may delete their own objects"
  on storage.objects for delete to authenticated
  using (
    bucket_id in ('trip-gpx', 'trip-photos')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
