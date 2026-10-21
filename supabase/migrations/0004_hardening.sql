-- Hardening after the marketplace audit: payment details, moderation side effects, URL and link rules,
-- order lifecycle housekeeping, storage policies, chat rate limit, orphaned files and scheduled jobs.
-- Apply after 0003 with `supabase db push` or paste into the SQL editor.
--
-- Same conventions as 0002/0003: writes with rules go through SECURITY DEFINER functions with
-- search_path = ''; Supabase grants anon/authenticated EXECUTE on new functions by default, so every new
-- function revokes first and grants back only what is needed. Replaced functions keep their exact
-- signatures (create or replace), so the grants from earlier migrations still apply; they are re-stated
-- in section 10 anyway. Errors raised for the app are short kebab-case codes.
--
-- New error codes: 'too-many-units' (place_order), 'rate-limited' (send_message).
-- 'too-many-open-orders' now also counts orders whose slip is waiting for the shop.

/* ======================================================================================
   1. Payment details only for approved shops; moderation cancels unpaid orders (M3)
   ====================================================================================== */

-- PromptPay details for paying: only while the shop is approved, and only to the shop owner or a buyer
-- with an unpaid / slip-pending order there. Buyers keep the details they were given on the order
-- itself (orders.promptpay_id / promptpay_name, section 2), so this going quiet never strands an order.
create or replace function public.shop_payment_info(p_shop_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', s.promptpay_id, 'name', s.promptpay_name)
    from public.shops s
   where s.id = p_shop_id and s.promptpay_id is not null and s.status = 'approved'
     and (s.owner_id = auth.uid() or exists (
       select 1 from public.orders o
        where o.shop_id = s.id and o.buyer_id = auth.uid() and o.status in ('awaiting_payment', 'slip_submitted')))
$$;

-- As in 0003, plus: when staff take a shop out of 'approved' (rejected, or sent back to review =
-- paused), its orders still awaiting payment are cancelled with reason 'shop-unavailable' and their
-- stock is put back, so buyers are not left paying a shop that can no longer trade. Orders with a slip
-- already submitted (or later) are left alone: money may have moved, and the shop can still settle them.
-- Note: the automatic "back to review" on content edits (check_shop_rules) does NOT cancel anything;
-- those orders keep the PromptPay snapshot and expire normally after 3 days if unpaid.
create or replace function public.set_shop_status(p_shop_id uuid, p_status public.shop_status, p_reason text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_reason text := nullif(left(trim(coalesce(p_reason, '')), 500), '');
  v_id uuid;
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
  if p_status <> 'approved' then
    for v_id in
      select id from public.orders where shop_id = p_shop_id and status = 'awaiting_payment' order by id for update
    loop
      perform public.restore_order_stock(v_id);
      update public.orders set status = 'cancelled', cancel_reason = 'shop-unavailable' where id = v_id;
    end loop;
  end if;
end;
$$;

/* ======================================================================================
   2. PromptPay changes go back to review; orders keep what the buyer was told to pay (M4)
   ====================================================================================== */

-- 0001's shop rules, with promptpay_id / promptpay_name added to the fields whose edit sends an
-- approved shop back to review (a swapped PromptPay id is the obvious way to divert payments).
create or replace function public.check_shop_rules() returns trigger
language plpgsql set search_path = '' as $$
declare
  dob date;
begin
  if public.is_client_request() then
    if tg_op = 'INSERT' then
      new.status := 'pending';
    elsif new.status is distinct from old.status then
      raise exception 'Shop status can only be changed by an admin' using errcode = 'insufficient_privilege';
    elsif old.status = 'approved' and (new.name, new.owner_name, new.description, new.product_types, new.promptpay_id, new.promptpay_name)
          is distinct from (old.name, old.owner_name, old.description, old.product_types, old.promptpay_id, old.promptpay_name) then
      -- Edited content or payment details go back to review instead of skipping moderation.
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

-- The PromptPay account the buyer was shown when ordering (snapshot, like order_items). Null on orders
-- placed before this migration. Readable through "orders: parties read" (0002), which grants select on
-- the whole table to the buyer and the shop owner.
alter table public.orders
  add column promptpay_id text check (promptpay_id ~ '^(0[0-9]{9}|[0-9]{13})$'),
  add column promptpay_name text check (char_length(promptpay_name) between 1 and 100);

/* ======================================================================================
   3. place_order: open-order cap counts pending slips; at most 200 units per order (L2, M4)
   ====================================================================================== */

create or replace function public.place_order(p_shop_id uuid, p_lines jsonb, p_address jsonb, p_note text default '')
returns public.orders
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  v_shop public.shops;
  v_order public.orders;
  v_addr jsonb;
  v_el jsonb;
  v_line record;
  v_subtotal numeric(12, 2) := 0;
  v_shipping numeric(10, 2);
  v_units int := 0;
  v_code text;
begin
  if uid is null then
    raise exception 'not-signed-in' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.profiles where id = uid and onboarded_at is not null) then
    raise exception 'not-onboarded' using errcode = 'insufficient_privilege';
  end if;

  select * into v_shop from public.shops where id = p_shop_id for share;
  if not found or v_shop.status <> 'approved' or v_shop.promptpay_id is null then
    raise exception 'shop-unavailable' using errcode = 'check_violation';
  end if;
  if v_shop.owner_id = uid then
    raise exception 'own-shop' using errcode = 'check_violation';
  end if;
  -- Open orders reserve stock (and a pending slip still holds it), so cap how many one buyer can hold.
  if (select count(*) from public.orders where buyer_id = uid and status in ('awaiting_payment', 'slip_submitted')) >= 5 then
    raise exception 'too-many-open-orders' using errcode = 'check_violation';
  end if;

  if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) not between 1 and 50 then
    raise exception 'bad-lines' using errcode = 'check_violation';
  end if;
  for v_el in select * from jsonb_array_elements(p_lines) loop
    if jsonb_typeof(v_el) <> 'object'
       or coalesce(v_el ->> 'productId', '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or jsonb_typeof(v_el -> 'qty') is distinct from 'number'
       or (v_el ->> 'qty')::numeric not in (select generate_series(1, 99)) then
      raise exception 'bad-lines' using errcode = 'check_violation';
    end if;
  end loop;

  v_addr := jsonb_build_object(
    'name', trim(p_address ->> 'name'), 'phone', trim(p_address ->> 'phone'), 'line1', trim(p_address ->> 'line1'),
    'district', trim(p_address ->> 'district'), 'province', trim(p_address ->> 'province'), 'postcode', trim(p_address ->> 'postcode'));
  if jsonb_typeof(p_address) is distinct from 'object' or not public.address_valid(v_addr) then
    raise exception 'bad-address' using errcode = 'check_violation';
  end if;

  -- Lock the products in id order (avoids deadlocks between concurrent checkouts), then validate.
  perform 1 from public.products where id in (select pid from public.order_lines(p_lines)) order by id for update;
  for v_line in
    select l.qty, p.id, p.shop_id, p.active, p.stock, p.price_thb
      from public.order_lines(p_lines) l left join public.products p on p.id = l.pid
  loop
    if v_line.id is null or v_line.shop_id <> p_shop_id or not v_line.active then
      raise exception 'product-unavailable' using errcode = 'check_violation';
    end if;
    if v_line.qty > 99 then
      raise exception 'bad-lines' using errcode = 'check_violation';
    end if;
    if v_line.stock is not null and v_line.stock < v_line.qty then
      raise exception 'out-of-stock' using errcode = 'check_violation';
    end if;
    v_units := v_units + v_line.qty;
    v_subtotal := v_subtotal + v_line.price_thb * v_line.qty;
  end loop;
  -- One order may not reserve a shop's whole stock: 200 pieces across all lines.
  if v_units > 200 then
    raise exception 'too-many-units' using errcode = 'check_violation';
  end if;

  v_shipping := case when v_shop.free_shipping_from_thb is not null and v_subtotal >= v_shop.free_shipping_from_thb
                     then 0 else v_shop.shipping_thb end;

  loop
    select 'PP-' || string_agg(substr('23456789ABCDEFGHJKLMNPQRSTUVWXYZ', 1 + floor(random() * 32)::int, 1), '')
      into v_code from generate_series(1, 6);
    exit when not exists (select 1 from public.orders where code = v_code);
  end loop;

  insert into public.orders (code, shop_id, buyer_id, subtotal_thb, shipping_thb, total_thb, address, note, promptpay_id, promptpay_name)
  values (v_code, p_shop_id, uid, v_subtotal, v_shipping, v_subtotal + v_shipping, v_addr, left(trim(coalesce(p_note, '')), 500),
          v_shop.promptpay_id, v_shop.promptpay_name)
  returning * into v_order;

  insert into public.order_items (order_id, product_id, name, image_url, price_thb, qty, width_mm, height_mm)
  select v_order.id, p.id, p.name, p.image_url, p.price_thb, l.qty, p.width_mm, p.height_mm
    from public.order_lines(p_lines) l join public.products p on p.id = l.pid
   order by l.pos;

  -- Reserve stock now; cancelling (by either side, or expiry) puts it back.
  update public.products p set stock = p.stock - l.qty
    from public.order_lines(p_lines) l
   where p.id = l.pid and p.stock is not null;

  return v_order;
end;
$$;

/* ======================================================================================
   4. Shop links: each key must point at its own platform (links)
   ====================================================================================== */

-- On top of 0002's shop_links_valid (known keys, https, length): the host of each link must belong to
-- that key's platform. The host must be followed by '/', '?', '#' or the end, so userinfo tricks
-- ('https://shopee.co.th@evil.example') and ports are rejected. Subdomains are allowed (www., m., vt.,
-- s., web. ...). LINE also accepts lin.ee, its official short-link host for LINE Official Accounts.
create function public.shop_links_hosts_valid(p_links jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(p_links) = 'object'
     and not exists (
       select 1 from jsonb_each_text(p_links) e
        where not (e.value ~* case e.key
          when 'tiktok'    then '^https://([a-z0-9-]+\.)*tiktok\.com([/?#]|$)'
          when 'shopee'    then '^https://([a-z0-9-]+\.)*shopee\.co\.th([/?#]|$)'
          when 'lazada'    then '^https://([a-z0-9-]+\.)*lazada\.co\.th([/?#]|$)'
          when 'instagram' then '^https://([a-z0-9-]+\.)*instagram\.com([/?#]|$)'
          when 'facebook'  then '^https://([a-z0-9-]+\.)*facebook\.com([/?#]|$)'
          when 'line'      then '^https://(([a-z0-9-]+\.)*line\.me|lin\.ee)([/?#]|$)'
          else '^$' end)
     )
$$;

-- NOT VALID: enforced for every new insert/update from now on, without failing the migration on shops
-- saved earlier with an off-platform link. Validated right away below when no such row exists; otherwise
-- fix the rows listed by
--   select id, slug, links from public.shops where not public.shop_links_hosts_valid(links);
-- and then run: alter table public.shops validate constraint shops_links_hosts;
alter table public.shops add constraint shops_links_hosts check (public.shop_links_hosts_valid(links)) not valid;

/* ======================================================================================
   5. Image URLs: own storage, site paths or inline images only (L3)
   ====================================================================================== */

-- Allowed: https URLs into this project's public storage, site paths starting with exactly one '/'
-- (not '//' or '/\', which browsers treat as another host), or inline data:image/ URLs. The host can't
-- be pinned in SQL, so "own storage" means the Supabase public-object path; the bucket is pinned too.
-- Note: plain-http local Supabase URLs (http://127.0.0.1:54321/...) are rejected on purpose.
create function public.image_url_allowed(p_url text) returns boolean
language sql immutable set search_path = '' as $$
  select p_url ~ '^https://[A-Za-z0-9.-]+/storage/v1/object/public/(product-images|shop-images)/[^[:space:]<>"]+$'
      or p_url ~ '^/[^/\\]'
      or p_url ~ '^data:image/(svg\+xml|png|jpeg|webp|gif)[;,]'
$$;

-- 0002 created these as unnamed column checks, which Postgres names <table>_<column>_check.
alter table public.shops
  drop constraint if exists shops_logo_url_check,
  drop constraint if exists shops_cover_url_check,
  add constraint shops_logo_url_check check (public.image_url_allowed(logo_url) and char_length(logo_url) <= 1000) not valid,
  add constraint shops_cover_url_check check (public.image_url_allowed(cover_url) and char_length(cover_url) <= 1000) not valid;
alter table public.products
  drop constraint if exists products_image_url_check,
  add constraint products_image_url_check check (public.image_url_allowed(image_url) and char_length(image_url) <= 200000) not valid;

-- Validate the new constraints now when existing rows already comply (the usual case). Any that stay
-- NOT VALID are still enforced on writes; find the offending rows with the functions above, fix them,
-- then `alter table ... validate constraint ...`.
do $$
begin
  if not exists (select 1 from public.shops where not public.shop_links_hosts_valid(links)) then
    alter table public.shops validate constraint shops_links_hosts;
  else
    raise notice 'shops_links_hosts left NOT VALID: some shops have off-platform links';
  end if;
  if not exists (select 1 from public.shops where not public.image_url_allowed(logo_url)) then
    alter table public.shops validate constraint shops_logo_url_check;
  else
    raise notice 'shops_logo_url_check left NOT VALID: some logo_url values are outside the allowed forms';
  end if;
  if not exists (select 1 from public.shops where not public.image_url_allowed(cover_url)) then
    alter table public.shops validate constraint shops_cover_url_check;
  else
    raise notice 'shops_cover_url_check left NOT VALID: some cover_url values are outside the allowed forms';
  end if;
  if not exists (select 1 from public.products where not public.image_url_allowed(image_url)) then
    alter table public.products validate constraint products_image_url_check;
  else
    raise notice 'products_image_url_check left NOT VALID: some image_url values are outside the allowed forms';
  end if;
end;
$$;

/* ======================================================================================
   6. Order lifecycle housekeeping (M2)
   ====================================================================================== */

-- Shipped orders the buyer never confirmed are completed 21 days after shipping (what most Thai
-- marketplaces do). Counted from the 'shipped' event, not updated_at, which also moves when an account
-- is deleted. No refund or stock logic: the goods went out.
create function public.auto_complete_shipped_orders(p_after interval default '21 days') returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  n int := 0;
begin
  for v_id in
    select o.id from public.orders o
     where o.status = 'shipped'
       and coalesce((select max(e.at) from public.order_events e where e.order_id = o.id and e.status = 'shipped'), o.updated_at)
           < now() - p_after
       for update of o skip locked
  loop
    update public.orders set status = 'completed' where id = v_id;
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- Retention, widened. Orders stuck in 'slip_submitted' or 'paid' are deliberately NOT auto-cancelled or
-- auto-completed: money may have changed hands, and only the two parties know. They stay visible to both
-- sides; once nothing has happened on an order for the retention period (default 1 year since its last
-- status event), it is purged whatever its status, like closed orders. Closed orders keep 0002's rule
-- (1 year after their last update). 'awaiting_payment' and 'shipped' orders never get that old: they are
-- expired / auto-completed long before. Slip files are cleaned by the storage-cleanup Edge Function.
create or replace function public.purge_closed_orders(p_after interval default '1 year') returns integer
language sql security definer set search_path = '' as $$
  with gone as (
    delete from public.orders o
     where (o.status in ('completed', 'cancelled') and o.updated_at < now() - p_after)
        or coalesce((select max(e.at) from public.order_events e where e.order_id = o.id), o.updated_at) < now() - p_after
    returning 1
  )
  select count(*)::int from gone
$$;

/* ======================================================================================
   7. Chat rate limit (L8)
   ====================================================================================== */

create index messages_sender_idx on public.messages (sender_id, created_at);

-- As in 0002, plus: at most 20 messages per sender per minute ('rate-limited').
create or replace function public.send_message(
  p_thread_id uuid,
  p_from text,
  p_text text default null,
  p_image_path text default null,
  p_order_id uuid default null
) returns public.messages
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  v_thread public.threads;
  v_side text;
  v_text text := nullif(left(trim(coalesce(p_text, '')), 2000), '');
  v_msg public.messages;
begin
  select * into v_thread from public.threads where id = p_thread_id for update;
  if not found or uid is null then
    raise exception 'not-found' using errcode = 'no_data_found';
  end if;
  if p_from = 'buyer' and v_thread.buyer_id = uid then
    v_side := 'buyer';
  elsif p_from = 'shop' and public.owns_shop(v_thread.shop_id) then
    v_side := 'shop';
  else
    raise exception 'not-found' using errcode = 'no_data_found';
  end if;
  if (select count(*) from public.messages where sender_id = uid and created_at > now() - interval '1 minute') >= 20 then
    raise exception 'rate-limited' using errcode = 'insufficient_privilege';
  end if;
  if v_text is null and p_image_path is null then
    raise exception 'empty-message' using errcode = 'check_violation';
  end if;
  if p_image_path is not null and (
       p_image_path not like p_thread_id::text || '/%'
       or not exists (select 1 from storage.objects where bucket_id = 'chat-images' and name = p_image_path)) then
    raise exception 'bad-image' using errcode = 'check_violation';
  end if;
  if p_order_id is not null and not exists (
       select 1 from public.orders where id = p_order_id and shop_id = v_thread.shop_id and buyer_id = v_thread.buyer_id) then
    raise exception 'bad-order' using errcode = 'check_violation';
  end if;

  insert into public.messages (thread_id, sender, sender_id, body, image_path, order_id)
  values (p_thread_id, v_side, uid, v_text, p_image_path, p_order_id)
  returning * into v_msg;

  update public.threads
     set last_at = v_msg.created_at,
         last_text = coalesce(left(v_text, 140), '📷'),
         unread_shop = unread_shop + (v_side = 'buyer')::int,
         unread_buyer = unread_buyer + (v_side = 'shop')::int
   where id = p_thread_id;
  return v_msg;
end;
$$;

/* ======================================================================================
   8. Storage policies (L7, L8)
   ====================================================================================== */

-- product-images and shop-images are public buckets: /storage/v1/object/public/... serves their files
-- without any SELECT policy, so the blanket read policy only let anyone list every shop's files.
-- Shop owners keep SELECT on their own folder because the Storage API needs it to remove (and upsert)
-- objects.
drop policy if exists "market images: public read" on storage.objects;
create policy "market images: owner read" on storage.objects for select to authenticated
  using (bucket_id in ('product-images', 'shop-images') and public.owns_shop(public.path_uuid(name)));

-- Slips may be uploaded only while the order is waiting for payment (submit_slip already refuses other
-- states; this stops stray uploads into closed orders' folders).
create function public.order_awaits_slip(p_order_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.orders where id = p_order_id and buyer_id = auth.uid() and status = 'awaiting_payment')
$$;

drop policy if exists "slips: buyer upload" on storage.objects;
create policy "slips: buyer upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'slips' and public.order_awaits_slip(public.path_uuid(name)));

/* ======================================================================================
   9. Orphaned private files (M1)
   Files can't be deleted with SQL (storage.objects rows are protected, and dropping a row would not
   remove the file anyway), so the storage-cleanup Edge Function asks this for the object names and
   removes them through the Storage API. Service role only.
   ====================================================================================== */

-- Objects to remove, at most p_limit per call:
--   slips/<order_id>/...       the order no longer exists (purged), uploaded over a day ago;
--   slips/<order_id>/<file>    not the order's current slip (a rejected slip that was replaced, or an
--                              upload never submitted) and over 30 days old. Kept that long because a
--                              rejected slip can matter in a dispute about whether money was sent;
--   chat-images/<thread_id>/.. not used by any message (thread deleted, or upload never sent), over a
--                              day old.
-- The age floors also keep the function away from uploads still between upload and RPC.
create function public.storage_orphans(p_limit integer default 1000)
returns table (bucket_id text, name text)
language sql stable security definer set search_path = '' as $$
  (
    select o.bucket_id, o.name
      from storage.objects o
     where o.bucket_id = 'slips'
       and o.created_at < now() - interval '1 day'
       and not exists (select 1 from public.orders r where r.id = public.path_uuid(o.name))
    union all
    select o.bucket_id, o.name
      from storage.objects o
      join public.orders r on r.id = public.path_uuid(o.name)
     where o.bucket_id = 'slips'
       and o.created_at < now() - interval '30 days'
       and r.slip_path is distinct from o.name
    union all
    select o.bucket_id, o.name
      from storage.objects o
     where o.bucket_id = 'chat-images'
       and o.created_at < now() - interval '1 day'
       and not exists (select 1 from public.messages m where m.image_path = o.name)
  )
  limit least(greatest(coalesce(p_limit, 1000), 1), 10000)
$$;

create index messages_image_path_idx on public.messages (image_path) where image_path is not null;
create index orders_slip_path_idx on public.orders (slip_path) where slip_path is not null;

/* ======================================================================================
   10. Function privileges
   ====================================================================================== */

-- Re-stated for replaced functions (create or replace keeps grants; this is belt and braces).
revoke execute on function
  public.shop_payment_info, public.set_shop_status, public.place_order, public.send_message,
  public.purge_closed_orders, public.check_shop_rules
  from public, anon, authenticated;
grant execute on function
  public.shop_payment_info, public.set_shop_status, public.place_order, public.send_message
  to authenticated;

-- Housekeeping: service role / pg_cron only.
revoke execute on function public.auto_complete_shipped_orders, public.storage_orphans from public, anon, authenticated;
grant execute on function public.auto_complete_shipped_orders, public.storage_orphans to service_role;

-- Check-constraint helpers: pure functions, anyone may evaluate them (same as 0002's shop_links_valid).
-- RLS helper order_awaits_slip: the storage policy runs as the uploader, and it only answers for them.
revoke execute on function public.order_awaits_slip from public, anon;
grant execute on function public.order_awaits_slip to authenticated;

/* ======================================================================================
   11. Public shop directory: can this shop take payment? (cart)
   ====================================================================================== */

-- Same view as 0002, with accepts_payment appended (create or replace may only add columns at the end,
-- so existing columns, security_invoker = false and grants are unchanged). A boolean only: PromptPay
-- details themselves stay behind shop_payment_info().
create or replace view public.shops_public with (security_invoker = false) as
  select id, slug, name, description as about, city, tint, logo_url, cover_url, links,
         shipping_thb, free_shipping_from_thb, product_types, created_at,
         (promptpay_id is not null and status = 'approved') as accepts_payment
    from public.shops
   where status = 'approved';
revoke all on public.shops_public from anon, authenticated;
grant select on public.shops_public to anon, authenticated;

/* ======================================================================================
   12. Scheduled jobs (pg_cron), only if the extension is enabled. Not created here: enable it under
   Database -> Extensions, then re-run this block (it is idempotent: jobs are replaced by name).
   Times are UTC (03:00 UTC = 10:00 Bangkok). The storage-cleanup Edge Function is scheduled
   separately (it needs the service role key; see supabase/functions/storage-cleanup/index.ts).
   ====================================================================================== */

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(j.jobname)
       from cron.job j
      where j.jobname in ('expire-unpaid', 'purge-orders', 'purge-site-data', 'auto-complete-shipped');
    perform cron.schedule('expire-unpaid', '0 * * * *', 'select public.expire_unpaid_orders()');
    perform cron.schedule('auto-complete-shipped', '15 3 * * *', 'select public.auto_complete_shipped_orders()');
    perform cron.schedule('purge-orders', '0 3 * * *', 'select public.purge_closed_orders()');
    perform cron.schedule('purge-site-data', '30 3 * * *', 'select public.purge_site_data()');
  else
    raise notice 'pg_cron not enabled: housekeeping jobs not scheduled';
  end if;
end;
$$;
