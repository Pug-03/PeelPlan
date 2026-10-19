-- Profiles and shop applications for Google sign-up + onboarding.
-- Apply with the Supabase CLI (`supabase db push`) or paste into the SQL editor.
--
-- Write model: clients may only edit cosmetic profile fields directly. Everything with rules
-- (birth date, terms consent, shop application) goes through SECURITY DEFINER functions.

create type public.shop_status as enum ('pending', 'approved', 'rejected');

-- Bump when the Terms or Privacy Policy change; consent is recorded against a version.
create function public.current_terms_version() returns text language sql immutable as $$ select '2026-10-19' $$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 80),
  avatar_url text,
  birth_date date,
  is_shop boolean not null default false,
  accepted_terms_at timestamptz,
  terms_version text,
  onboarded_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.shops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  owner_name text not null check (char_length(owner_name) between 2 and 120),
  product_types text[] not null default '{}' check (
    product_types <@ array['die-cut', 'sheet', 'holographic', 'clear', 'vinyl', 'custom']::text[]
    and cardinality(product_types) between 1 and 6
  ),
  description text not null default '' check (char_length(description) <= 1000),
  status public.shop_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Requests from the app arrive as the `anon` / `authenticated` database roles (set by PostgREST,
-- not forgeable by clients). Dashboard, SQL editor and service-role sessions are trusted.
create function public.is_client_request() returns boolean language sql stable as $$
  select current_user in ('anon', 'authenticated')
$$;

-- Create a profile row for every new auth user, seeded from the Google account.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''), 80),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Age rules live in the database so no client can bypass them.
-- Keep these numbers in sync with src/config/onboarding.ts.
create function public.check_profile_age() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.birth_date is not null then
    if new.birth_date > current_date - interval '13 years' then
      raise exception 'User must be at least 13 years old' using errcode = 'check_violation';
    end if;
    if new.birth_date < current_date - interval '120 years' then
      raise exception 'Birth date is not plausible' using errcode = 'check_violation';
    end if;
  end if;
  -- Once set, a birth date can only be corrected by staff (keeps the 20+ shop rule honest).
  if tg_op = 'UPDATE' and public.is_client_request() and old.birth_date is not null
     and new.birth_date is distinct from old.birth_date then
    raise exception 'Birth date cannot be changed' using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger profiles_age before insert or update of birth_date on public.profiles
  for each row execute function public.check_profile_age();

create function public.check_shop_rules() returns trigger
language plpgsql set search_path = '' as $$
declare
  dob date;
begin
  if public.is_client_request() then
    if tg_op = 'INSERT' then
      new.status := 'pending';
    elsif new.status is distinct from old.status then
      raise exception 'Shop status can only be changed by an admin' using errcode = 'insufficient_privilege';
    elsif old.status = 'approved' and (new.name, new.owner_name, new.description, new.product_types)
          is distinct from (old.name, old.owner_name, old.description, old.product_types) then
      -- Edited content goes back to review instead of skipping moderation.
      new.status := 'pending';
    end if;
  end if;
  select birth_date into dob from public.profiles where id = new.owner_id;
  if dob is null or dob > current_date - interval '20 years' then
    raise exception 'Shop owners must be at least 20 years old' using errcode = 'check_violation';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger shops_rules before insert or update on public.shops
  for each row execute function public.check_shop_rules();

-- Row Level Security.
alter table public.profiles enable row level security;
alter table public.shops enable row level security;

create policy "profiles: read own" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "profiles: update own" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "shops: read own" on public.shops for select to authenticated using (auth.uid() = owner_id);
create policy "shops: update own" on public.shops for update to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- Column privileges: direct client writes are limited to cosmetic fields.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;
revoke insert, update, delete on public.shops from anon, authenticated;
grant update (name, description, product_types) on public.shops to authenticated;
revoke select on public.shops from anon;

-- Public shop directory: no owner identity or legal name.
create view public.shops_public with (security_invoker = false) as
  select id, name, product_types, description, created_at from public.shops where status = 'approved';
grant select on public.shops_public to anon, authenticated;

-- One-shot onboarding: profile + optional shop application in a single transaction.
create function public.complete_onboarding(
  p_display_name text,
  p_birth_date date,
  p_is_shop boolean,
  p_shop_name text default null,
  p_owner_name text default null,
  p_product_types text[] default null,
  p_description text default ''
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = 'insufficient_privilege';
  end if;
  if p_birth_date is null then
    raise exception 'Birth date required' using errcode = 'check_violation';
  end if;
  update public.profiles
     set display_name = left(trim(p_display_name), 80),
         birth_date = p_birth_date,
         is_shop = p_is_shop,
         accepted_terms_at = now(),
         terms_version = public.current_terms_version(),
         onboarded_at = now()
   where id = uid and onboarded_at is null;
  if not found then
    raise exception 'Already onboarded' using errcode = 'unique_violation';
  end if;
  if p_is_shop then
    insert into public.shops (owner_id, name, owner_name, product_types, description)
    values (uid, trim(p_shop_name), trim(p_owner_name), p_product_types, coalesce(p_description, ''));
  end if;
end;
$$;

revoke execute on function public.complete_onboarding from public, anon;
grant execute on function public.complete_onboarding to authenticated;

-- Right to erasure (PDPA s.33): deleting the auth user cascades to profile and shop.
create function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = 'insufficient_privilege';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke execute on function public.delete_my_account from public, anon;
grant execute on function public.delete_my_account to authenticated;
