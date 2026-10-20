-- Marketplace (Phase 3): shop storefronts, products, orders paid by PromptPay slip, chat, reports.
-- Apply after 0001 with `supabase db push` or paste into the SQL editor.
--
-- Money model: buyers pay the SHOP directly by PromptPay and upload the transfer slip. PeelPlan never
-- holds funds, so there is no payment table, only an order state machine both sides move along.
--
-- Write model (same as 0001): clients read through RLS, but every write with rules (orders, status
-- changes, slips, chat) goes through SECURITY DEFINER functions. Direct table writes are limited to
-- the shop owner's own storefront fields and products.
--
-- Errors raised for the app use short kebab-case messages ('out-of-stock', 'bad-state', ...), the
-- same strings the test-mode store throws, so the UI can map them to copy.
--
-- Supabase grants anon/authenticated ALL on new public tables and EXECUTE on new functions by default,
-- so every object below revokes first and then grants back only what is needed.

/* ======================================================================================
   1. Helpers
   ====================================================================================== */

-- Uuid from the first folder of a storage path ('<uuid>/file.jpg'), or null if it isn't one.
create function public.path_uuid(p_name text) returns uuid
language sql immutable set search_path = '' as $$
  select case
    when split_part(p_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then split_part(p_name, '/', 1)::uuid
  end
$$;

-- Allowed external links: known platforms only, https only.
create function public.shop_links_valid(p_links jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(p_links) = 'object'
     and not exists (
       select 1 from jsonb_each(p_links) e
       where e.key not in ('tiktok', 'shopee', 'lazada', 'instagram', 'facebook', 'line')
          or jsonb_typeof(e.value) <> 'string'
          or char_length(e.value #>> '{}') > 300
          or (e.value #>> '{}') !~ '^https://[^[:space:]<>"]+$'
     )
$$;

-- Shipping address: exactly these keys, all strings, sane lengths, Thai 5-digit postcode.
create function public.address_valid(p_addr jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(p_addr) = 'object'
     and (select array_agg(k order by k) from jsonb_object_keys(p_addr) k)
         = array['district', 'line1', 'name', 'phone', 'postcode', 'province']
     and char_length(coalesce(p_addr ->> 'name', '')) between 1 and 120
     and coalesce(p_addr ->> 'phone', '') ~ '^\+?[0-9 -]{9,20}$'
     and char_length(coalesce(p_addr ->> 'line1', '')) between 1 and 300
     and char_length(coalesce(p_addr ->> 'district', '')) between 1 and 120
     and char_length(coalesce(p_addr ->> 'province', '')) between 1 and 120
     and coalesce(p_addr ->> 'postcode', '') ~ '^[0-9]{5}$'
$$;

-- Terms / privacy gained marketplace sections (and the Seller terms): consent from now on is recorded
-- against this version. Keep in sync with legal.updated in src/messages.
create or replace function public.current_terms_version() returns text language sql immutable as $$ select '2026-10-20' $$;

/* ======================================================================================
   2. Shops: public storefront fields
   ====================================================================================== */

-- `description` (from 0001) is the storefront "about" text; the app maps it to Shop.about.
alter table public.shops
  add column slug text,
  add column city text not null default '' check (char_length(city) <= 80),
  add column tint text not null default '#E8F7B0' check (tint ~ '^#[0-9A-Fa-f]{6}$'),
  add column logo_url text check (logo_url ~ '^(https?://|/)' and char_length(logo_url) <= 1000),
  add column cover_url text check (cover_url ~ '^(https?://|/)' and char_length(cover_url) <= 1000),
  add column links jsonb not null default '{}' check (public.shop_links_valid(links)),
  -- PromptPay: Thai mobile (10 digits, starts with 0) or national/tax ID (13 digits).
  add column promptpay_id text check (promptpay_id ~ '^(0[0-9]{9}|[0-9]{13})$'),
  add column promptpay_name text check (char_length(promptpay_name) between 1 and 100),
  add column shipping_thb numeric(8, 2) not null default 40 check (shipping_thb between 0 and 1000),
  add column free_shipping_from_thb numeric(10, 2) check (free_shipping_from_thb > 0 and free_shipping_from_thb <= 100000);

-- Slugs: lowercase a-z0-9 words joined by '-', generated from the name ("Studio Kluay" -> studio-kluay,
-- then studio-kluay-2 ...). Thai-only names fall back to "shop". Owners may change it later.
create function public.slug_base(p_name text) returns text
language sql immutable set search_path = '' as $$
  select case when char_length(b) >= 2 then b else 'shop' end
    from (select rtrim(left(trim(both '-' from regexp_replace(lower(coalesce(p_name, '')), '[^a-z0-9]+', '-', 'g')), 50), '-') as b) x
$$;

create function public.set_shop_slug() returns trigger
language plpgsql set search_path = '' as $$
declare
  base text;
  n int := 2;
begin
  if new.slug is null or new.slug = '' then
    base := public.slug_base(new.name);
    new.slug := base;
    while exists (select 1 from public.shops where slug = new.slug and id <> new.id) loop
      new.slug := base || '-' || n;
      n := n + 1;
    end loop;
  end if;
  return new;
end;
$$;

create trigger shops_slug before insert or update of slug on public.shops
  for each row execute function public.set_shop_slug();

update public.shops set slug = null;  -- fires the trigger for shops created under 0001
alter table public.shops
  alter column slug set not null,
  add constraint shops_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 2 and 60),
  add constraint shops_slug_key unique (slug);

-- PromptPay id and name are set together or not at all.
alter table public.shops add constraint shops_promptpay_pair check ((promptpay_id is null) = (promptpay_name is null));

-- Owners edit storefront fields directly. 0001's trigger still applies: status is admin-only, and
-- editing name / owner_name / description / product_types of an approved shop sends it back to review.
grant update (slug, city, tint, logo_url, cover_url, links, promptpay_id, promptpay_name, shipping_thb, free_shipping_from_thb)
  on public.shops to authenticated;

-- Public directory. Never exposes owner identity, legal name or PromptPay details (buyers get those
-- through shop_payment_info() once they have an open order). Recreated because columns were added.
drop view public.shops_public;
create view public.shops_public with (security_invoker = false) as
  select id, slug, name, description as about, city, tint, logo_url, cover_url, links,
         shipping_thb, free_shipping_from_thb, product_types, created_at
    from public.shops
   where status = 'approved';
revoke all on public.shops_public from anon, authenticated;
grant select on public.shops_public to anon, authenticated;

-- RLS helpers. SECURITY DEFINER so policies can look at shops/orders/threads without the caller
-- needing (or getting) direct read access to those rows.
create function public.owns_shop(p_shop_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.shops where id = p_shop_id and owner_id = auth.uid())
$$;

create function public.shop_is_approved(p_shop_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.shops where id = p_shop_id and status = 'approved')
$$;

-- Sellers who did not apply during onboarding open their shop here. Same rules as 0001 (20+,
-- starts pending). owner_name defaults to the display name; staff confirm the legal name on review.
create function public.create_my_shop(p_name text, p_owner_name text default null, p_product_types text[] default null)
returns public.shops
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  v_shop public.shops;
begin
  if uid is null then
    raise exception 'not-signed-in' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.profiles where id = uid and onboarded_at is not null) then
    raise exception 'not-onboarded' using errcode = 'insufficient_privilege';
  end if;
  insert into public.shops (owner_id, name, owner_name, product_types)
  values (
    uid,
    trim(p_name),
    coalesce(nullif(trim(p_owner_name), ''), (select display_name from public.profiles where id = uid)),
    coalesce(p_product_types, array['die-cut'])
  )
  returning * into v_shop;
  update public.profiles set is_shop = true where id = uid;
  return v_shop;
end;
$$;

/* ======================================================================================
   3. Products
   ====================================================================================== */

create table public.products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  -- Public storage URL, a site path (/stickers/...), or an inline SVG data URL for library stickers
  -- (SVG in <img> cannot run script). Raster uploads go to the product-images bucket.
  image_url text not null check (image_url ~ '^(https?://|/|data:image/svg\+xml)' and char_length(image_url) <= 200000),
  sticker_id text check (char_length(sticker_id) <= 80),
  width_mm numeric(5, 1) not null check (width_mm between 5 and 400),
  height_mm numeric(5, 1) not null check (height_mm between 5 and 400),
  price_thb numeric(10, 2) not null check (price_thb between 1 and 100000),
  stock integer check (stock is null or stock between 0 and 100000),  -- null = made to order
  finish text not null default 'glossy' check (finish in ('glossy', 'matte', 'clear', 'holo')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_shop_idx on public.products (shop_id, created_at desc);

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();

alter table public.products enable row level security;
create policy "products: public read" on public.products for select to anon, authenticated
  using (active and public.shop_is_approved(shop_id));
create policy "products: owner read" on public.products for select to authenticated using (public.owns_shop(shop_id));
create policy "products: owner insert" on public.products for insert to authenticated with check (public.owns_shop(shop_id));
create policy "products: owner update" on public.products for update to authenticated
  using (public.owns_shop(shop_id)) with check (public.owns_shop(shop_id));
create policy "products: owner delete" on public.products for delete to authenticated using (public.owns_shop(shop_id));

revoke all on public.products from anon, authenticated;
grant select on public.products to anon, authenticated;
grant insert (shop_id, name, image_url, sticker_id, width_mm, height_mm, price_thb, stock, finish, active) on public.products to authenticated;
grant update (name, image_url, sticker_id, width_mm, height_mm, price_thb, stock, finish, active) on public.products to authenticated;
grant delete on public.products to authenticated;

/* ======================================================================================
   4. Orders
   ====================================================================================== */

create type public.order_status as enum ('awaiting_payment', 'slip_submitted', 'paid', 'shipped', 'completed', 'cancelled');

-- shop_id / buyer_id become null when either side deletes their account; the order itself is kept
-- for disputes and purged by purge_closed_orders() (see retention in the privacy policy).
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^PP-[23456789A-HJ-NP-Z]{6}$'),
  shop_id uuid references public.shops (id) on delete set null,
  buyer_id uuid references public.profiles (id) on delete set null,
  subtotal_thb numeric(12, 2) not null check (subtotal_thb >= 0),
  shipping_thb numeric(10, 2) not null check (shipping_thb >= 0),
  total_thb numeric(12, 2) not null check (total_thb = subtotal_thb + shipping_thb),
  -- PII: visible only to the buyer and the shop owner (RLS below).
  address jsonb not null check (public.address_valid(address)),
  note text not null default '' check (char_length(note) <= 500),
  status public.order_status not null default 'awaiting_payment',
  -- Storage path in the private `slips` bucket: '<order_id>/<file>'.
  slip_path text check (slip_path like id::text || '/%'),
  tracking jsonb check (
    tracking is null or (
      tracking ->> 'carrier' in ('thailand-post', 'kerry', 'flash', 'jt', 'ninjavan', 'other')
      and char_length(coalesce(tracking ->> 'number', '')) between 1 and 60
    )
  ),
  cancel_reason text check (char_length(cancel_reason) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_buyer_idx on public.orders (buyer_id, created_at desc);
create index orders_shop_idx on public.orders (shop_id, created_at desc);
create index orders_open_idx on public.orders (status, created_at) where status = 'awaiting_payment';

-- Line items are snapshots: renaming, repricing or deleting a product never changes past orders.
create table public.order_items (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  name text not null,
  image_url text not null,
  price_thb numeric(10, 2) not null,
  qty integer not null check (qty between 1 and 99),
  width_mm numeric(5, 1) not null,
  height_mm numeric(5, 1) not null
);
create index order_items_order_idx on public.order_items (order_id);

-- Status history, written by trigger on every status change.
create table public.order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  status public.order_status not null,
  actor_id uuid,
  at timestamptz not null default now()
);
create index order_events_order_idx on public.order_events (order_id, at);

create function public.log_order_event() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.order_events (order_id, status, actor_id) values (new.id, new.status, auth.uid());
  end if;
  return null;
end;
$$;
create trigger orders_events after insert or update on public.orders
  for each row execute function public.log_order_event();
create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();

create function public.is_order_party(p_order_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.orders o
     where o.id = p_order_id
       and (o.buyer_id = auth.uid() or exists (select 1 from public.shops s where s.id = o.shop_id and s.owner_id = auth.uid()))
  )
$$;

create function public.is_order_buyer(p_order_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.orders where id = p_order_id and buyer_id = auth.uid())
$$;

alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_events enable row level security;
create policy "orders: parties read" on public.orders for select to authenticated
  using (buyer_id = auth.uid() or public.owns_shop(shop_id));
create policy "order_items: parties read" on public.order_items for select to authenticated using (public.is_order_party(order_id));
create policy "order_events: parties read" on public.order_events for select to authenticated using (public.is_order_party(order_id));

revoke all on public.orders, public.order_items, public.order_events from anon, authenticated;
grant select on public.orders, public.order_items, public.order_events to authenticated;

-- Which status changes each side may make. Mirrors NEXT_STATUS in src/features/market/store.ts.
create function public.next_order_statuses(p_from public.order_status, p_side text) returns public.order_status[]
language sql immutable set search_path = '' as $$
  select (case p_side
    when 'shop' then case p_from
      when 'awaiting_payment' then array['cancelled']
      when 'slip_submitted' then array['paid', 'awaiting_payment']
      when 'paid' then array['shipped', 'cancelled']
      else array[]::text[] end
    when 'buyer' then case p_from
      when 'awaiting_payment' then array['cancelled']
      when 'shipped' then array['completed']
      else array[]::text[] end
    else array[]::text[] end)::public.order_status[]
$$;

-- Lines from the client, merged per product: [{"productId": uuid, "qty": int}, ...].
create function public.order_lines(p_lines jsonb) returns table (pid uuid, qty int, pos bigint)
language sql immutable set search_path = '' as $$
  select (x ->> 'productId')::uuid, sum((x ->> 'qty')::numeric)::int, min(i)
    from jsonb_array_elements(p_lines) with ordinality as t (x, i)
   group by 1
$$;

create function public.restore_order_stock(p_order_id uuid) returns void
language sql security definer set search_path = '' as $$
  update public.products p
     set stock = p.stock + i.qty
    from (select product_id, sum(qty)::int as qty from public.order_items where order_id = p_order_id group by 1) i
   where p.id = i.product_id and p.stock is not null
$$;

create function public.place_order(p_shop_id uuid, p_lines jsonb, p_address jsonb, p_note text default '')
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
  -- Unpaid orders reserve stock, so cap how many one buyer can hold open.
  if (select count(*) from public.orders where buyer_id = uid and status = 'awaiting_payment') >= 5 then
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
    v_subtotal := v_subtotal + v_line.price_thb * v_line.qty;
  end loop;

  v_shipping := case when v_shop.free_shipping_from_thb is not null and v_subtotal >= v_shop.free_shipping_from_thb
                     then 0 else v_shop.shipping_thb end;

  loop
    select 'PP-' || string_agg(substr('23456789ABCDEFGHJKLMNPQRSTUVWXYZ', 1 + floor(random() * 32)::int, 1), '')
      into v_code from generate_series(1, 6);
    exit when not exists (select 1 from public.orders where code = v_code);
  end loop;

  insert into public.orders (code, shop_id, buyer_id, subtotal_thb, shipping_thb, total_thb, address, note)
  values (v_code, p_shop_id, uid, v_subtotal, v_shipping, v_subtotal + v_shipping, v_addr, left(trim(coalesce(p_note, '')), 500))
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

create function public.set_order_status(
  p_order_id uuid,
  p_status public.order_status,
  p_tracking jsonb default null,
  p_cancel_reason text default null
) returns public.orders
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  v_order public.orders;
  v_allowed public.order_status[] := '{}';
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or uid is null then
    raise exception 'not-found' using errcode = 'no_data_found';
  end if;
  if v_order.buyer_id = uid then
    v_allowed := v_allowed || public.next_order_statuses(v_order.status, 'buyer');
  end if;
  if public.owns_shop(v_order.shop_id) then
    v_allowed := v_allowed || public.next_order_statuses(v_order.status, 'shop');
  end if;
  if v_order.buyer_id is distinct from uid and not public.owns_shop(v_order.shop_id) then
    raise exception 'not-found' using errcode = 'no_data_found';
  end if;
  if not (p_status = any (v_allowed)) then
    raise exception 'bad-state' using errcode = 'check_violation';
  end if;

  if p_status = 'shipped' and p_tracking is not null then
    v_order.tracking := jsonb_build_object('carrier', p_tracking ->> 'carrier', 'number', trim(p_tracking ->> 'number'));
  end if;
  if p_status = 'cancelled' then
    v_order.cancel_reason := nullif(left(trim(coalesce(p_cancel_reason, '')), 300), '');
    perform public.restore_order_stock(v_order.id);
  end if;
  if p_status = 'awaiting_payment' then
    -- Shop rejected the slip: the buyer uploads a new one.
    v_order.slip_path := null;
  end if;

  update public.orders
     set status = p_status, tracking = v_order.tracking, cancel_reason = v_order.cancel_reason, slip_path = v_order.slip_path
   where id = v_order.id
  returning * into v_order;
  return v_order;
end;
$$;

-- The buyer uploads the slip to slips/<order_id>/<file> first (storage policy below), then calls this.
create function public.submit_slip(p_order_id uuid, p_slip_path text) returns public.orders
language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders;
begin
  select * into v_order from public.orders where id = p_order_id and buyer_id = auth.uid() for update;
  if not found then
    raise exception 'not-found' using errcode = 'no_data_found';
  end if;
  if v_order.status <> 'awaiting_payment' then
    raise exception 'bad-state' using errcode = 'check_violation';
  end if;
  if p_slip_path is null or p_slip_path not like p_order_id::text || '/%'
     or not exists (select 1 from storage.objects where bucket_id = 'slips' and name = p_slip_path) then
    raise exception 'bad-slip' using errcode = 'check_violation';
  end if;
  update public.orders set slip_path = p_slip_path, status = 'slip_submitted' where id = p_order_id returning * into v_order;
  return v_order;
end;
$$;

-- PromptPay details for paying: only the shop owner, or a buyer with an unpaid / slip-pending order there.
create function public.shop_payment_info(p_shop_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', s.promptpay_id, 'name', s.promptpay_name)
    from public.shops s
   where s.id = p_shop_id and s.promptpay_id is not null
     and (s.owner_id = auth.uid() or exists (
       select 1 from public.orders o
        where o.shop_id = s.id and o.buyer_id = auth.uid() and o.status in ('awaiting_payment', 'slip_submitted')))
$$;

-- Housekeeping for the service role / pg_cron (not callable from the app), e.g.:
--   select cron.schedule('expire-unpaid', '0 * * * *', $$select public.expire_unpaid_orders()$$);
--   select cron.schedule('purge-orders', '0 3 * * *', $$select public.purge_closed_orders()$$);
create function public.expire_unpaid_orders(p_after interval default '3 days') returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  n int := 0;
begin
  for v_id in
    select id from public.orders where status = 'awaiting_payment' and created_at < now() - p_after for update skip locked
  loop
    perform public.restore_order_stock(v_id);
    update public.orders set status = 'cancelled', cancel_reason = 'expired' where id = v_id;
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- Retention: closed orders are kept 1 year for disputes, then deleted. Slip files must be removed from
-- storage through the Storage API (deleting storage.objects rows does not delete the file).
create function public.purge_closed_orders(p_after interval default '1 year') returns integer
language sql security definer set search_path = '' as $$
  with gone as (
    delete from public.orders where status in ('completed', 'cancelled') and updated_at < now() - p_after returning 1
  )
  select count(*)::int from gone
$$;

/* ======================================================================================
   5. Chat
   ====================================================================================== */

-- One thread per (shop, buyer). Unread counters per side; send_message bumps the other side's.
create table public.threads (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  buyer_name text not null default '' check (char_length(buyer_name) <= 80),
  last_at timestamptz not null default now(),
  last_text text not null default '',
  unread_buyer integer not null default 0 check (unread_buyer >= 0),
  unread_shop integer not null default 0 check (unread_shop >= 0),
  created_at timestamptz not null default now(),
  unique (shop_id, buyer_id)
);
create index threads_buyer_idx on public.threads (buyer_id, last_at desc);
create index threads_shop_idx on public.threads (shop_id, last_at desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads (id) on delete cascade,
  sender text not null check (sender in ('buyer', 'shop', 'system')),
  sender_id uuid,
  body text check (char_length(body) between 1 and 2000),
  -- Storage path in the private `chat-images` bucket: '<thread_id>/<file>'.
  image_path text check (image_path like thread_id::text || '/%'),
  order_id uuid references public.orders (id) on delete set null,
  created_at timestamptz not null default now(),
  check (body is not null or image_path is not null)
);
create index messages_thread_idx on public.messages (thread_id, created_at);

create function public.is_thread_party(p_thread_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.threads t
     where t.id = p_thread_id
       and (t.buyer_id = auth.uid() or exists (select 1 from public.shops s where s.id = t.shop_id and s.owner_id = auth.uid()))
  )
$$;

alter table public.threads enable row level security;
alter table public.messages enable row level security;
create policy "threads: parties read" on public.threads for select to authenticated
  using (buyer_id = auth.uid() or public.owns_shop(shop_id));
create policy "messages: parties read" on public.messages for select to authenticated using (public.is_thread_party(thread_id));
revoke all on public.threads, public.messages from anon, authenticated;
grant select on public.threads, public.messages to authenticated;

-- Buyer opens (or reopens) their thread with a shop. The name shown to the shop comes from the profile.
create function public.open_thread(p_shop_id uuid, p_buyer_name text default '') returns public.threads
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  v_name text;
  v_thread public.threads;
begin
  if uid is null then
    raise exception 'not-signed-in' using errcode = 'insufficient_privilege';
  end if;
  select * into v_thread from public.threads where shop_id = p_shop_id and buyer_id = uid;
  if found then
    return v_thread;
  end if;
  select coalesce(nullif(display_name, ''), left(trim(coalesce(p_buyer_name, '')), 80)) into v_name
    from public.profiles where id = uid and onboarded_at is not null;
  if not found then
    raise exception 'not-onboarded' using errcode = 'insufficient_privilege';
  end if;
  if not public.shop_is_approved(p_shop_id) then
    raise exception 'shop-unavailable' using errcode = 'check_violation';
  end if;
  if public.owns_shop(p_shop_id) then
    raise exception 'own-shop' using errcode = 'check_violation';
  end if;
  insert into public.threads (shop_id, buyer_id, buyer_name) values (p_shop_id, uid, coalesce(v_name, ''))
  on conflict (shop_id, buyer_id) do update set buyer_name = excluded.buyer_name
  returning * into v_thread;
  return v_thread;
end;
$$;

create function public.send_message(
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

create function public.mark_thread_read(p_thread_id uuid, p_side text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_side = 'buyer' then
    update public.threads set unread_buyer = 0 where id = p_thread_id and buyer_id = auth.uid() and unread_buyer > 0;
  elsif p_side = 'shop' then
    update public.threads set unread_shop = 0 where id = p_thread_id and public.owns_shop(shop_id) and unread_shop > 0;
  end if;
end;
$$;

/* ======================================================================================
   6. Reports (chat abuse). Insert-only for thread participants; read by staff in the dashboard.
   ====================================================================================== */

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid default auth.uid() references public.profiles (id) on delete set null,
  thread_id uuid references public.threads (id) on delete set null,
  reason text not null check (reason in ('spam', 'scam', 'harassment', 'counterfeit', 'other')),
  note text not null default '' check (char_length(note) <= 1000),
  created_at timestamptz not null default now()
);
alter table public.reports enable row level security;
create policy "reports: participants insert" on public.reports for insert to authenticated
  with check (reporter_id = auth.uid() and public.is_thread_party(thread_id));
revoke all on public.reports from anon, authenticated;
-- No select grant: insert without `.select()` (supabase-js default) so no RETURNING is needed.
grant insert (thread_id, reason, note) on public.reports to authenticated;

/* ======================================================================================
   7. Function privileges
   ====================================================================================== */

revoke execute on function
  public.create_my_shop, public.place_order, public.set_order_status, public.submit_slip, public.shop_payment_info,
  public.open_thread, public.send_message, public.mark_thread_read,
  public.restore_order_stock, public.expire_unpaid_orders, public.purge_closed_orders, public.log_order_event
  from public, anon, authenticated;
grant execute on function
  public.create_my_shop, public.place_order, public.set_order_status, public.submit_slip, public.shop_payment_info,
  public.open_thread, public.send_message, public.mark_thread_read
  to authenticated;
-- RLS helpers (owns_shop, shop_is_approved, is_order_party, is_order_buyer, is_thread_party, path_uuid)
-- stay executable by anon/authenticated: policies call them, and they only answer yes/no for the caller.

/* ======================================================================================
   8. Storage
   Paths:  product-images/<shop_id>/<file>   public read, shop owner writes
           shop-images/<shop_id>/<file>      public read (logo, cover), shop owner writes
           slips/<order_id>/<file>           private: the order's buyer uploads, buyer + shop read
           chat-images/<thread_id>/<file>    private: the thread's two parties upload and read
   Private files are shown with short-lived signed URLs (createSignedUrl).
   ====================================================================================== */

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('product-images', 'product-images', true, 2097152, array['image/png', 'image/jpeg', 'image/webp']),
  ('shop-images', 'shop-images', true, 2097152, array['image/png', 'image/jpeg', 'image/webp']),
  ('slips', 'slips', false, 2097152, array['image/png', 'image/jpeg', 'image/webp']),
  ('chat-images', 'chat-images', false, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy "market images: public read" on storage.objects for select to anon, authenticated
  using (bucket_id in ('product-images', 'shop-images'));
create policy "market images: owner insert" on storage.objects for insert to authenticated
  with check (bucket_id in ('product-images', 'shop-images') and public.owns_shop(public.path_uuid(name)));
create policy "market images: owner update" on storage.objects for update to authenticated
  using (bucket_id in ('product-images', 'shop-images') and public.owns_shop(public.path_uuid(name)))
  with check (bucket_id in ('product-images', 'shop-images') and public.owns_shop(public.path_uuid(name)));
create policy "market images: owner delete" on storage.objects for delete to authenticated
  using (bucket_id in ('product-images', 'shop-images') and public.owns_shop(public.path_uuid(name)));

create policy "slips: buyer upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'slips' and public.is_order_buyer(public.path_uuid(name)));
create policy "slips: parties read" on storage.objects for select to authenticated
  using (bucket_id = 'slips' and public.is_order_party(public.path_uuid(name)));

create policy "chat images: parties upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-images' and public.is_thread_party(public.path_uuid(name)));
create policy "chat images: parties read" on storage.objects for select to authenticated
  using (bucket_id = 'chat-images' and public.is_thread_party(public.path_uuid(name)));

/* ======================================================================================
   9. Realtime
   postgres_changes respects RLS, so each signed-in client only receives rows it can read.
   Equivalent to ticking the tables under Database -> Publications -> supabase_realtime.
   ====================================================================================== */

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages, public.threads, public.orders;
  end if;
end;
$$;
