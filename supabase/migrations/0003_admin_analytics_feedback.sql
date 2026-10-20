-- Admin area, first-party visit statistics and site feedback.
-- Apply after 0002 with `supabase db push` or paste into the SQL editor.
--
-- Granting admin: there is deliberately no way to do this from the app. In the SQL editor (or with the
-- service role) run, for the account's auth user id:
--
--   update public.profiles set is_admin = true where id = '<auth user uuid>';
--   -- find the id: select id, email from auth.users where email = 'you@example.com';
--
-- and `set is_admin = false` to remove it. The app checks access with public.is_admin().
--
-- Privacy model (PDPA): page_views hold no IP, no user id, no cookies and no full URLs: only a path,
-- locale, referring host, device class and a random per-tab id. They are written through track_view()
-- (anyone) and read back only as aggregates through admin_visitor_stats() (admins). Feedback is
-- insert-only for visitors through submit_feedback(); only admins read it or change its status.
--
-- Same conventions as 0002: Supabase grants anon/authenticated ALL on new tables and EXECUTE on new
-- functions by default, so everything below revokes first and grants back only what is needed.
-- Errors raised for the app are short kebab-case codes ('not-admin', 'rate-limited', ...).

/* ======================================================================================
   1. Admin flag
   ====================================================================================== */

alter table public.profiles add column is_admin boolean not null default false;

-- Column privileges already keep clients away (they may only update display_name, avatar_url), but a
-- trigger makes the rule explicit and survives a future grant by mistake.
create function public.guard_profile_admin() returns trigger
language plpgsql set search_path = '' as $$
begin
  if public.is_client_request() and new.is_admin is distinct from old.is_admin then
    raise exception 'Admin access can only be changed by staff' using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger profiles_admin_guard before update of is_admin on public.profiles
  for each row execute function public.guard_profile_admin();

-- True when the signed-in user is an admin. SECURITY DEFINER so policies and RPCs can ask without the
-- caller reading profiles; it only ever answers for auth.uid().
create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false)
$$;

/* ======================================================================================
   2. Shop moderation
   ====================================================================================== */

-- Why staff rejected or paused a shop. The owner reads it through "shops: read own" (0001); only
-- set_shop_status() writes it (no column grant to clients).
alter table public.shops add column status_reason text check (char_length(status_reason) <= 500);

-- Approve / reject / send back to review. Runs as the function owner, so 0001's check_shop_rules()
-- trigger treats it as trusted (is_client_request() is false) and lets the status change through.
create function public.set_shop_status(p_shop_id uuid, p_status public.shop_status, p_reason text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_reason text := nullif(left(trim(coalesce(p_reason, '')), 500), '');
begin
  if not public.is_admin() then
    raise exception 'not-admin' using errcode = 'insufficient_privilege';
  end if;
  if p_status = 'rejected' and v_reason is null then
    raise exception 'reason-required' using errcode = 'check_violation';
  end if;
  update public.shops
     set status = p_status,
         status_reason = case when p_status = 'approved' then null else v_reason end
   where id = p_shop_id;
  if not found then
    raise exception 'not-found' using errcode = 'no_data_found';
  end if;
end;
$$;

-- Every shop with what a reviewer needs. Counts are computed here so admins never get blanket read
-- access to products or orders.
create function public.admin_list_shops() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'not-admin' using errcode = 'insufficient_privilege';
  end if;
  return coalesce((
    select jsonb_agg(
             to_jsonb(s) || jsonb_build_object(
               'product_count', (select count(*) from public.products p where p.shop_id = s.id),
               'order_count', (select count(*) from public.orders o where o.shop_id = s.id),
               'recent_order_count', (select count(*) from public.orders o where o.shop_id = s.id and o.created_at > now() - interval '30 days')
             )
             order by s.created_at desc)
      from public.shops s
  ), '[]'::jsonb);
end;
$$;

/* ======================================================================================
   3. Visit statistics (cookieless, first-party)
   ====================================================================================== */

create table public.page_views (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  path text not null check (path like '/%' and char_length(path) <= 200),
  locale text check (locale in ('th', 'en')),
  referrer_host text check (referrer_host ~ '^[a-z0-9.-]{1,253}$'),
  device text not null check (device in ('mobile', 'tablet', 'desktop')),
  -- Random per-tab id from sessionStorage: counts unique visits per day, identifies nobody.
  session_id text not null check (session_id ~ '^[A-Za-z0-9_-]{8,64}$')
);
create index page_views_created_idx on public.page_views (created_at);
create index page_views_session_idx on public.page_views (session_id, created_at);

alter table public.page_views enable row level security;
create policy "page_views: admins read" on public.page_views for select to authenticated using (public.is_admin());
revoke all on public.page_views from anon, authenticated;
-- Raw rows stay readable for admins in SQL tooling; the app itself only calls admin_visitor_stats().
grant select on public.page_views to authenticated;

-- Record one view. Callable by anyone; inputs are cleaned rather than rejected so a bad value never
-- breaks a page. Silently ignores admin pages and sessions sending more than 120 views in 10 minutes.
create function public.track_view(
  p_path text,
  p_locale text default null,
  p_referrer_host text default null,
  p_device text default 'desktop',
  p_session_id text default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_path text := left(split_part(split_part(coalesce(p_path, ''), '?', 1), '#', 1), 200);
  v_ref text := lower(left(coalesce(p_referrer_host, ''), 253));
begin
  if p_session_id is null or p_session_id !~ '^[A-Za-z0-9_-]{8,64}$' then
    return;
  end if;
  if v_path not like '/%' then
    v_path := '/' || left(v_path, 199);
  end if;
  if v_path ~ '^/admin(/|$)' then
    return;
  end if;
  if (select count(*) from public.page_views
       where session_id = p_session_id and created_at > now() - interval '10 minutes') >= 120 then
    return;
  end if;
  insert into public.page_views (path, locale, referrer_host, device, session_id)
  values (
    v_path,
    case when p_locale in ('th', 'en') then p_locale end,
    case when v_ref ~ '^[a-z0-9.-]{1,253}$' then v_ref end,
    case when p_device in ('mobile', 'tablet', 'desktop') then p_device else 'desktop' end,
    p_session_id
  );
end;
$$;

-- Aggregates for the admin page. Mirrors aggregate() in src/features/analytics/stats.ts:
--   views = rows; visits = distinct (Bangkok day, session); referrers/devices/locales count visits.
create function public.admin_visitor_stats(p_days integer default 30) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_days integer := least(greatest(coalesce(p_days, 30), 1), 400);
  v_today date := (now() at time zone 'Asia/Bangkok')::date;
  v_from date := v_today - (v_days - 1);
  v_out jsonb;
begin
  if not public.is_admin() then
    raise exception 'not-admin' using errcode = 'insufficient_privilege';
  end if;
  with v as (
    select (created_at at time zone 'Asia/Bangkok')::date as day, path, locale, referrer_host, device, session_id
      from public.page_views
     where created_at >= (v_from::timestamp at time zone 'Asia/Bangkok')
  ),
  days as (
    select g::date as day from generate_series(v_from::timestamp, v_today::timestamp, interval '1 day') g
  ),
  daily as (
    select d.day, count(v.session_id) as views, count(distinct v.session_id) as visits
      from days d left join v on v.day = d.day
     group by d.day
  ),
  pages as (
    select path as key, count(*) as n from v group by path order by n desc, path limit 10
  ),
  refs as (
    select referrer_host as key, count(distinct (day, session_id)) as n
      from v where referrer_host is not null group by referrer_host order by n desc, referrer_host limit 10
  ),
  devices as (
    select device as key, count(distinct (day, session_id)) as n from v group by device order by n desc, device
  ),
  locales as (
    select locale as key, count(distinct (day, session_id)) as n
      from v where locale is not null group by locale order by n desc, locale
  )
  select jsonb_build_object(
    'days', (select coalesce(jsonb_agg(jsonb_build_object('date', to_char(day, 'YYYY-MM-DD'), 'views', views, 'visits', visits) order by day), '[]') from daily),
    'topPages', (select coalesce(jsonb_agg(jsonb_build_object('key', key, 'count', n) order by n desc, key), '[]') from pages),
    'referrers', (select coalesce(jsonb_agg(jsonb_build_object('key', key, 'count', n) order by n desc, key), '[]') from refs),
    'devices', (select coalesce(jsonb_agg(jsonb_build_object('key', key, 'count', n) order by n desc, key), '[]') from devices),
    'locales', (select coalesce(jsonb_agg(jsonb_build_object('key', key, 'count', n) order by n desc, key), '[]') from locales)
  ) into v_out;
  return v_out;
end;
$$;

/* ======================================================================================
   4. Site feedback ("found a problem or have an idea?")
   ====================================================================================== */

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  kind text not null check (kind in ('bug', 'idea', 'other')),
  message text not null check (char_length(message) between 10 and 2000),
  -- Optional, only to reply. Not linked to an account.
  email text check (char_length(email) <= 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$'),
  path text not null check (path like '/%' and char_length(path) <= 200),
  device text not null check (device in ('mobile', 'tablet', 'desktop')),
  locale text not null default '' check (char_length(locale) <= 5),
  session_id text not null check (session_id ~ '^[A-Za-z0-9_-]{8,64}$'),
  status text not null default 'new' check (status in ('new', 'in_progress', 'done'))
);
create index feedback_created_idx on public.feedback (created_at desc);
create index feedback_session_idx on public.feedback (session_id, created_at);

create trigger feedback_touch before update on public.feedback
  for each row execute function public.touch_updated_at();

alter table public.feedback enable row level security;
create policy "feedback: admins read" on public.feedback for select to authenticated using (public.is_admin());
create policy "feedback: admins update" on public.feedback for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
revoke all on public.feedback from anon, authenticated;
grant select on public.feedback to authenticated;
grant update (status) on public.feedback to authenticated;

-- Anyone may send feedback. Same rules as validateFeedback() in src/features/feedback/validate.ts,
-- plus a rate limit: 5 per tab session per hour, and a site-wide brake of 300 per hour.
create function public.submit_feedback(
  p_kind text,
  p_message text,
  p_email text default null,
  p_path text default '/',
  p_device text default 'desktop',
  p_locale text default '',
  p_session_id text default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_message text := trim(coalesce(p_message, ''));
  v_email text := nullif(trim(coalesce(p_email, '')), '');
  v_path text := left(split_part(split_part(coalesce(p_path, '/'), '?', 1), '#', 1), 200);
begin
  if p_kind is null or p_kind not in ('bug', 'idea', 'other') then
    raise exception 'bad-kind' using errcode = 'check_violation';
  end if;
  if char_length(v_message) not between 10 and 2000 then
    raise exception 'bad-message' using errcode = 'check_violation';
  end if;
  if v_email is not null and (char_length(v_email) > 254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$') then
    raise exception 'bad-email' using errcode = 'check_violation';
  end if;
  if p_session_id is null or p_session_id !~ '^[A-Za-z0-9_-]{8,64}$' then
    raise exception 'bad-session' using errcode = 'check_violation';
  end if;
  if (select count(*) from public.feedback where session_id = p_session_id and created_at > now() - interval '1 hour') >= 5
     or (select count(*) from public.feedback where created_at > now() - interval '1 hour') >= 300 then
    raise exception 'rate-limited' using errcode = 'insufficient_privilege';
  end if;
  insert into public.feedback (kind, message, email, path, device, locale, session_id)
  values (
    p_kind,
    v_message,
    v_email,
    case when v_path like '/%' then v_path else '/' end,
    case when p_device in ('mobile', 'tablet', 'desktop') then p_device else 'desktop' end,
    case when p_locale in ('th', 'en') then p_locale else '' end,
    p_session_id
  );
end;
$$;

/* ======================================================================================
   5. Chat reports: status + admin access
   ====================================================================================== */

alter table public.reports
  add column status text not null default 'open' check (status in ('open', 'handled')),
  add column handled_at timestamptz;

create function public.stamp_report_handled() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status is distinct from old.status then
    new.handled_at := case when new.status = 'handled' then now() end;
  end if;
  return new;
end;
$$;
create trigger reports_handled before update of status on public.reports
  for each row execute function public.stamp_report_handled();

create policy "reports: admins read" on public.reports for select to authenticated using (public.is_admin());
create policy "reports: admins update" on public.reports for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
-- Non-admins still can't read reports (no policy matches); inserts keep working without RETURNING.
grant select on public.reports to authenticated;
grant update (status) on public.reports to authenticated;

-- To investigate a report, admins may read that one conversation (only threads someone reported).
create function public.thread_is_reported(p_thread_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.reports r where r.thread_id = p_thread_id)
$$;
create policy "threads: admins read reported" on public.threads for select to authenticated
  using (public.is_admin() and public.thread_is_reported(id));
create policy "messages: admins read reported" on public.messages for select to authenticated
  using (public.is_admin() and public.thread_is_reported(thread_id));

/* ======================================================================================
   6. Retention (service role / pg_cron, not callable from the app)
   Visit statistics: 13 months. Finished feedback: 2 years. Matches the privacy policy, e.g.:
     select cron.schedule('purge-site-data', '30 3 * * *', $$select public.purge_site_data()$$);
   ====================================================================================== */

create function public.purge_site_data(p_views_after interval default '13 months', p_feedback_after interval default '2 years')
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  n integer;
  m integer;
begin
  delete from public.page_views where created_at < now() - p_views_after;
  get diagnostics n = row_count;
  delete from public.feedback where created_at < now() - p_feedback_after;
  get diagnostics m = row_count;
  return n + m;
end;
$$;

/* ======================================================================================
   7. Function privileges
   ====================================================================================== */

revoke execute on function
  public.set_shop_status, public.admin_list_shops, public.track_view, public.admin_visitor_stats,
  public.submit_feedback, public.purge_site_data, public.guard_profile_admin, public.stamp_report_handled
  from public, anon, authenticated;
-- Visitors (signed in or not) record views and send feedback.
grant execute on function public.track_view, public.submit_feedback to anon, authenticated;
-- Admin RPCs check is_admin() themselves; granting to authenticated only lets them ask.
grant execute on function public.set_shop_status, public.admin_list_shops, public.admin_visitor_stats to authenticated;
revoke execute on function public.thread_is_reported from public, anon;
grant execute on function public.thread_is_reported to authenticated;
-- is_admin() stays executable by everyone: policies and the app call it, and it only answers for the caller.
