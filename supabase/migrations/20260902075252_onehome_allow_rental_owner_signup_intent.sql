-- Keep OneHome owner signup inside the canonical profile update path.
alter table public.profiles
  drop constraint if exists profiles_signup_intent_chk;

alter table public.profiles
  add constraint profiles_signup_intent_chk
  check (
    signup_intent is null
    or signup_intent = any (array['hiring'::text, 'working'::text, 'rental_owner'::text])
  );

-- The owner handoff updates its own profile and requests only the row id back.
-- Preserve the table-wide read restriction while allowing that narrow RETURNING.
grant select (id) on table public.profiles to authenticated;
