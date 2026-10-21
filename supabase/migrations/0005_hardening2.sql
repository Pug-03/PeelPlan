-- Hardening after the penetration audit (352 attacks against a local replica) and the back-office audit:
-- concurrency on the open-order cap, a one-shop outage turned platform-wide, leftover table privileges
-- that let a user escalate to admin, evidence that deleted itself, moderation that could only reach
-- shops, an audit trail, admin read access for disputes, and a handful of smaller leaks.
-- Apply after 0004 with `supabase db push` or paste into the SQL editor.
--
-- Same conventions as 0002/0003/0004: writes with rules go through SECURITY DEFINER functions with
-- search_path = ''; Supabase grants anon/authenticated ALL on new tables and EXECUTE on new functions by
-- default, so everything new revokes first and grants back only what is needed. Replaced functions keep
-- their exact signatures (create or replace), so earlier grants still apply; they are re-stated in
-- section 16 anyway. Errors raised for the app are short kebab-case codes.
--
-- New error codes:
--   'account-suspended'  place_order, open_thread, send_message, create_my_shop (profiles.suspended_at)
--   'shop-unavailable'   send_message, shop side, when the shop is no longer approved (code reused)
--   'slip-rejected'      submit_slip, when the buyer re-sends a slip the shop already rejected
--   'already-reported'   file_report / direct insert into reports, one open report per thread per reporter
--   'rate-limited'       file_report / direct insert into reports, 5 reports per hour per reporter
--   'bad-reason'         file_report, reason outside the allowed set
--   'own-account'        set_user_suspended, an admin may not suspend themselves
--
-- Shape changes the frontend must follow: admin_list_shops() no longer returns promptpay_id /
-- promptpay_name (it returns has_promptpay boolean instead) and gains owner_suspended. See section 11.

/* ======================================================================================
   1. Account suspension, staff-hidden listings, and the admin guard (B5, B3)
   ====================================================================================== */

-- The Terms promise that accounts can be suspended, but 0001-0004 could only moderate whole shops.
-- A suspended account keeps reading (and can still settle orders already open) but cannot start
-- anything new: no checkout, no new thread, no message, no new shop.
alter table public.profiles add column suspended_at timestamptz;

-- A single listing can now be taken down without touching the rest of the shop.
alter table public.products add column hidden_by_staff boolean not null default false;

create index profiles_suspended_idx on public.profiles (suspended_at) where suspended_at is not null;

-- Answers only for the caller, like is_admin(): SECURITY DEFINER so RPCs (and the UI) can ask without
-- the caller reading profiles.
create function public.is_suspended() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and suspended_at is not null)
$$;

-- 0003's guard was `before update OF is_admin`, which Postgres evaluates against the columns named in
-- the UPDATE's SET list. A user-defined trigger that sets new.is_admin itself therefore never fired it
-- (verified end-to-end): full admin escalation wherever CREATE on schema public is granted. The guard
-- now fires on every row update, whatever the SET list, and covers suspended_at as well.
create or replace function public.guard_profile_admin() returns trigger
language plpgsql set search_path = '' as $$
begin
  if public.is_client_request()
     and (new.is_admin, new.suspended_at) is distinct from (old.is_admin, old.suspended_at) then
    raise exception 'Admin access and suspension can only be changed by staff' using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_admin_guard on public.profiles;
create trigger profiles_admin_guard before update on public.profiles
  for each row execute function public.guard_profile_admin();

-- Staff-hidden listings disappear from the public storefront. Owners still see their own rows through
-- "products: owner read" (0002) so they can tell why a listing is gone; hidden_by_staff is not in any
-- client column grant, so only set_product_hidden() can change it.
drop policy if exists "products: public read" on public.products;
create policy "products: public read" on public.products for select to anon, authenticated
  using (active and not hidden_by_staff and public.shop_is_approved(shop_id));

/* ======================================================================================
   2. Admin audit trail (B12)
   Nothing recorded who approved / rejected / suspended what, or why; set_shop_status() even clears
   status_reason on approval. Admin-readable only (it names staff and their reasons).
   ====================================================================================== */

create table public.admin_actions (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null check (char_length(action) between 1 and 60),
  target_type text not null check (target_type in ('shop', 'profile', 'product', 'report', 'feedback')),
  target_id uuid,
  old_status text check (char_length(old_status) <= 60),
  new_status text check (char_length(new_status) <= 60),
  reason text check (char_length(reason) <= 500),
  created_at timestamptz not null default now()
);
create index admin_actions_created_idx on public.admin_actions (created_at desc);
create index admin_actions_target_idx on public.admin_actions (target_type, target_id, created_at desc);

alter table public.admin_actions enable row level security;
create policy "admin_actions: admins read" on public.admin_actions for select to authenticated
  using (public.is_admin());
revoke all on public.admin_actions from anon, authenticated;
grant select on public.admin_actions to authenticated;

-- Internal writer: called from the moderation RPCs and the status triggers below. Never granted to
-- clients, so the trail cannot be forged from the app.
create function public.log_admin_action(
  p_action text,
  p_target_type text,
  p_target_id uuid,
  p_old_status text default null,
  p_new_status text default null,
  p_reason text default null
) returns void
language sql security definer set search_path = '' as $$
  insert into public.admin_actions (actor_id, action, target_type, target_id, old_status, new_status, reason)
  values (auth.uid(), left(p_action, 60), p_target_type, p_target_id,
          left(p_old_status, 60), left(p_new_status, 60), nullif(left(trim(coalesce(p_reason, '')), 500), ''))
$$;

-- Reports and feedback are moved along with a direct UPDATE (status only, admins only; 0003), so their
-- trail is written by trigger rather than inside an RPC.
create function public.log_status_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from old.status then
    perform public.log_admin_action('status', tg_argv[0], new.id, old.status, new.status);
  end if;
  return null;
end;
$$;

create trigger reports_log_status after update of status on public.reports
  for each row execute function public.log_status_change('report');
create trigger feedback_log_status after update of status on public.feedback
  for each row execute function public.log_status_change('feedback');

/* ======================================================================================
   3. Moderation of people and single listings (B5)
   ====================================================================================== */

-- Suspend / un-suspend an account. A reason is required to suspend (it goes in the audit trail), and an
-- admin cannot suspend themselves. Re-suspending keeps the original timestamp.
create function public.set_user_suspended(p_user_id uuid, p_suspended boolean, p_reason text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_old timestamptz;
  v_found boolean;
  v_reason text := nullif(left(trim(coalesce(p_reason, '')), 500), '');
begin
  if not public.is_admin() then
    raise exception 'not-admin' using errcode = 'insufficient_privilege';
  end if;
  if p_suspended and v_reason is null then
    raise exception 'reason-required' using errcode = 'check_violation';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'own-account' using errcode = 'check_violation';
  end if;
  select p.suspended_at, true into v_old, v_found from public.profiles p where p.id = p_user_id;
  if not coalesce(v_found, false) then
    raise exception 'not-found' using errcode = 'no_data_found';
  end if;
  update public.profiles
     set suspended_at = case when p_suspended then coalesce(v_old, now()) end
   where id = p_user_id;
  perform public.log_admin_action(
    'suspend_user', 'profile', p_user_id,
    case when v_old is null then 'active' else 'suspended' end,
    case when p_suspended then 'suspended' else 'active' end,
    v_reason);
end;
$$;

-- Hide / unhide one listing without rejecting the whole shop.
create function public.set_product_hidden(p_product_id uuid, p_hidden boolean, p_reason text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_old boolean;
  v_reason text := nullif(left(trim(coalesce(p_reason, '')), 500), '');
begin
  if not public.is_admin() then
    raise exception 'not-admin' using errcode = 'insufficient_privilege';
  end if;
  if p_hidden and v_reason is null then
    raise exception 'reason-required' using errcode = 'check_violation';
  end if;
  select p.hidden_by_staff into v_old from public.products p where p.id = p_product_id;
  if v_old is null then
    raise exception 'not-found' using errcode = 'no_data_found';
  end if;
  update public.products set hidden_by_staff = p_hidden where id = p_product_id;
  perform public.log_admin_action(
    'hide_product', 'product', p_product_id,
    case when v_old then 'hidden' else 'visible' end,
    case when p_hidden then 'hidden' else 'visible' end,
    v_reason);
end;
$$;

/* ======================================================================================
   4. place_order: serialize one buyer's checkouts, refuse suspended accounts (B1, B5)
   ====================================================================================== */

-- As in 0004, plus:
--   * an advisory lock per buyer. The open-order cap is a count-then-insert, and the only row lock taken
--     is on the products in the order, so twenty concurrent calls using twenty DIFFERENT products shared
--     no lock at all and all twenty passed a cap of 5 (1980 units reserved). The lock is transaction
--     scoped and keyed on the buyer, so unrelated buyers are never serialized against each other;
--   * suspended accounts cannot check out.
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
  -- One checkout per buyer at a time: everything below (the open-order cap especially) reads and then
  -- writes, and concurrent calls for different products share no row lock.
  perform pg_advisory_xact_lock(hashtextextended('place_order:' || uid::text, 0));
  if exists (select 1 from public.profiles where id = uid and suspended_at is not null) then
    raise exception 'account-suspended' using errcode = 'insufficient_privilege';
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
    select l.qty, p.id, p.shop_id, p.active, p.stock, p.price_thb, p.hidden_by_staff
      from public.order_lines(p_lines) l left join public.products p on p.id = l.pid
  loop
    if v_line.id is null or v_line.shop_id <> p_shop_id or not v_line.active or v_line.hidden_by_staff then
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
   5. One shop's data must not be able to freeze the platform (B2, B9)
   ====================================================================================== */

-- products.stock is capped at 100000 by a check constraint, and a shop owner may set stock directly.
-- Setting it to the ceiling while an order is open made `stock = stock + qty` violate the constraint, so
-- the buyer could not cancel, an admin could not reject the shop, and expire_unpaid_orders() aborted its
-- ENTIRE run on the first poisoned order - expiry froze for every shop. Clamp instead: stock never
-- exceeds the ceiling, and giving back less than was taken is the safe direction (the owner raised it).
create or replace function public.restore_order_stock(p_order_id uuid) returns void
language sql security definer set search_path = '' as $$
  update public.products p
     set stock = least(p.stock + i.qty, 100000)
    from (select product_id, sum(qty)::int as qty from public.order_items where order_id = p_order_id group by 1) i
   where p.id = i.product_id and p.stock is not null
$$;

-- As in 0002, plus per-order fault isolation: one order that cannot be processed is logged and skipped
-- instead of aborting the whole run for every shop.
create or replace function public.expire_unpaid_orders(p_after interval default '3 days') returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  n int := 0;
begin
  for v_id in
    select id from public.orders where status = 'awaiting_payment' and created_at < now() - p_after for update skip locked
  loop
    begin
      perform public.restore_order_stock(v_id);
      update public.orders set status = 'cancelled', cancel_reason = 'expired' where id = v_id;
      n := n + 1;
    exception when others then
      raise warning 'expire_unpaid_orders: order % skipped: %', v_id, sqlerrm;
    end;
  end loop;
  return n;
end;
$$;

-- As in 0004, plus the same per-order fault isolation.
create or replace function public.auto_complete_shipped_orders(p_after interval default '21 days') returns integer
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
    begin
      update public.orders set status = 'completed' where id = v_id;
      n := n + 1;
    exception when others then
      raise warning 'auto_complete_shipped_orders: order % skipped: %', v_id, sqlerrm;
    end;
  end loop;
  return n;
end;
$$;

-- As in 0004 (same two clauses), but row by row, because:
--   * 0004's second clause has no status filter, so a stale 'slip_submitted' / 'paid' order holding
--     decremented stock was deleted without restore_order_stock() ever running - the reservation
--     vanished and the shop's stock stayed down for good. Non-terminal orders now give the stock back
--     first. 'shipped' is excluded on purpose: the goods went out, so the stock is genuinely gone (and
--     auto_complete_shipped_orders() closes those long before the retention window anyway);
--   * one order that cannot be purged no longer aborts the whole nightly run.
create or replace function public.purge_closed_orders(p_after interval default '1 year') returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_status public.order_status;
  n int := 0;
begin
  for v_id, v_status in
    select o.id, o.status from public.orders o
     where (o.status in ('completed', 'cancelled') and o.updated_at < now() - p_after)
        or coalesce((select max(e.at) from public.order_events e where e.order_id = o.id), o.updated_at) < now() - p_after
     order by o.id
       for update of o skip locked
  loop
    begin
      if v_status in ('awaiting_payment', 'slip_submitted', 'paid') then
        perform public.restore_order_stock(v_id);
      end if;
      delete from public.orders where id = v_id;
      n := n + 1;
    exception when others then
      raise warning 'purge_closed_orders: order % skipped: %', v_id, sqlerrm;
    end;
  end loop;
  return n;
end;
$$;

/* ======================================================================================
   6. set_shop_status: fault isolation, audit trail, and telling the buyer (B2, B12, B20)
   ====================================================================================== */

-- As in 0004, plus:
--   * the cancel loop is fault-isolated, so one poisoned order no longer stops staff from rejecting a
--     shop (it used to abort the whole call, including the status change);
--   * the decision is written to admin_actions (who, what, why);
--   * messages.sender already allowed 'system' but nothing ever wrote one: the buyer now gets a system
--     message in the shop<->buyer thread when moderation cancels their order, if a thread exists.
create or replace function public.set_shop_status(p_shop_id uuid, p_status public.shop_status, p_reason text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_reason text := nullif(left(trim(coalesce(p_reason, '')), 500), '');
  v_old public.shop_status;
  v_id uuid;
  v_buyer uuid;
  v_text text := 'คำสั่งซื้อนี้ถูกยกเลิกเพราะร้านนี้ไม่พร้อมขายแล้ว / This order was cancelled because the shop can no longer trade.';
begin
  if not public.is_admin() then
    raise exception 'not-admin' using errcode = 'insufficient_privilege';
  end if;
  if p_status = 'rejected' and v_reason is null then
    raise exception 'reason-required' using errcode = 'check_violation';
  end if;
  select status into v_old from public.shops where id = p_shop_id for update;
  if not found then
    raise exception 'not-found' using errcode = 'no_data_found';
  end if;
  update public.shops
     set status = p_status,
         status_reason = case when p_status = 'approved' then null else v_reason end
   where id = p_shop_id;
  -- status_reason is cleared on approval, so the reason only survives in the audit trail.
  perform public.log_admin_action('set_shop_status', 'shop', p_shop_id, v_old::text, p_status::text, v_reason);
  if p_status <> 'approved' then
    for v_id, v_buyer in
      select id, buyer_id from public.orders
       where shop_id = p_shop_id and status = 'awaiting_payment' order by id for update
    loop
      begin
        perform public.restore_order_stock(v_id);
        update public.orders set status = 'cancelled', cancel_reason = 'shop-unavailable' where id = v_id;
        -- Only when the two sides already have a thread; opening one here would be a new conversation
        -- nobody asked for.
        insert into public.messages (thread_id, sender, sender_id, body, order_id)
        select t.id, 'system', null, v_text, v_id
          from public.threads t
         where t.shop_id = p_shop_id and t.buyer_id = v_buyer;
        update public.threads t
           set last_at = now(), last_text = left(v_text, 140), unread_buyer = t.unread_buyer + 1
         where t.shop_id = p_shop_id and t.buyer_id = v_buyer;
      exception when others then
        raise warning 'set_shop_status: order % skipped: %', v_id, sqlerrm;
      end;
    end loop;
  end if;
end;
$$;

/* ======================================================================================
   7. Chat and shop creation: suspended accounts, and shops that may no longer trade (B5, B6)
   ====================================================================================== */

-- As in 0004, plus:
--   * a rejected / paused shop can no longer message its buyers (it never checked shop status at all).
--     Buyer-side messages keep working, so an order already open can still be settled;
--   * suspended accounts cannot send.
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
  if public.is_suspended() then
    raise exception 'account-suspended' using errcode = 'insufficient_privilege';
  end if;
  -- A shop taken out of 'approved' loses the right to contact buyers; the buyer side stays open.
  if v_side = 'shop' and not public.shop_is_approved(v_thread.shop_id) then
    raise exception 'shop-unavailable' using errcode = 'check_violation';
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

-- As in 0002, plus the suspension check.
create or replace function public.open_thread(p_shop_id uuid, p_buyer_name text default '') returns public.threads
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
  if public.is_suspended() then
    raise exception 'account-suspended' using errcode = 'insufficient_privilege';
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

-- As in 0002, plus the suspension check.
create or replace function public.create_my_shop(p_name text, p_owner_name text default null, p_product_types text[] default null)
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
  if public.is_suspended() then
    raise exception 'account-suspended' using errcode = 'insufficient_privilege';
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
   8. A rejected slip cannot be re-submitted unchanged (B15)
   ====================================================================================== */

-- set_order_status() clears slip_path when the shop rejects a slip, but the file stays in the bucket and
-- submit_slip() only checked the prefix and that the object exists - so the buyer could send the exact
-- same file back. Rejected paths are remembered and refused.
alter table public.orders add column rejected_slip_paths text[] not null default '{}';

-- As in 0002, plus: a rejected slip path is remembered on the order.
create or replace function public.set_order_status(
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
  v_rejected text[];
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

  v_rejected := v_order.rejected_slip_paths;
  if p_status = 'shipped' and p_tracking is not null then
    v_order.tracking := jsonb_build_object('carrier', p_tracking ->> 'carrier', 'number', trim(p_tracking ->> 'number'));
  end if;
  if p_status = 'cancelled' then
    v_order.cancel_reason := nullif(left(trim(coalesce(p_cancel_reason, '')), 300), '');
    perform public.restore_order_stock(v_order.id);
  end if;
  if p_status = 'awaiting_payment' then
    -- Shop rejected the slip: the buyer uploads a new one, and may not re-send this file.
    if v_order.slip_path is not null and not (v_order.slip_path = any (v_rejected)) then
      v_rejected := v_rejected || v_order.slip_path;
    end if;
    v_order.slip_path := null;
  end if;

  update public.orders
     set status = p_status, tracking = v_order.tracking, cancel_reason = v_order.cancel_reason,
         slip_path = v_order.slip_path, rejected_slip_paths = v_rejected
   where id = v_order.id
  returning * into v_order;
  return v_order;
end;
$$;

-- As in 0002, plus: a path the shop already rejected is refused ('slip-rejected').
create or replace function public.submit_slip(p_order_id uuid, p_slip_path text) returns public.orders
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
  if p_slip_path = any (v_order.rejected_slip_paths) then
    raise exception 'slip-rejected' using errcode = 'check_violation';
  end if;
  update public.orders set slip_path = p_slip_path, status = 'slip_submitted' where id = p_order_id returning * into v_order;
  return v_order;
end;
$$;

/* ======================================================================================
   9. Reports: evidence that survives the reported account, and a rate limit (B4, B10)
   ====================================================================================== */

-- reports.thread_id is `on delete set null` and deleting an account cascades
-- profile -> shop -> threads -> messages, so a reported shop owner could erase the whole conversation
-- (and which shop it was about) by using "delete my account". The report now carries its own copy.
-- No foreign keys on these two columns on purpose: deleting the shop or the buyer must not null them.
alter table public.reports
  add column reported_shop_id uuid,
  add column reported_buyer_id uuid;

create table public.report_messages (
  id bigint generated always as identity primary key,
  report_id uuid not null references public.reports (id) on delete cascade,
  message_id uuid,
  sender text not null,
  sender_id uuid,
  body text,
  -- The chat-images path as it was. The file itself is kept by the storage-cleanup Edge Function only
  -- while a message still points at it, so treat this as a reference, not a guarantee.
  image_path text,
  created_at timestamptz not null
);
create index report_messages_report_idx on public.report_messages (report_id, created_at);

alter table public.report_messages enable row level security;
create policy "report_messages: admins read" on public.report_messages for select to authenticated
  using (public.is_admin());
revoke all on public.report_messages from anon, authenticated;
grant select on public.report_messages to authenticated;

-- Both the new RPC and 0002's direct-insert policy go through these triggers, so the rate limit and the
-- snapshot apply whichever path the app uses. That is deliberate: the frontend can move to file_report()
-- whenever it likes instead of needing a flay day with the migration.
create function public.guard_report_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_thread public.threads;
begin
  new.reporter_id := coalesce(new.reporter_id, auth.uid());
  -- One open report per thread per reporter, and at most 5 reports an hour.
  if exists (select 1 from public.reports r
              where r.reporter_id = new.reporter_id and r.thread_id = new.thread_id and r.status = 'open') then
    raise exception 'already-reported' using errcode = 'unique_violation';
  end if;
  if (select count(*) from public.reports r
       where r.reporter_id = new.reporter_id and r.created_at > now() - interval '1 hour') >= 5 then
    raise exception 'rate-limited' using errcode = 'insufficient_privilege';
  end if;
  select * into v_thread from public.threads where id = new.thread_id;
  if found then
    new.reported_shop_id := coalesce(new.reported_shop_id, v_thread.shop_id);
    new.reported_buyer_id := coalesce(new.reported_buyer_id, v_thread.buyer_id);
  end if;
  return new;
end;
$$;

create trigger reports_guard before insert on public.reports
  for each row execute function public.guard_report_insert();

create function public.snapshot_report_messages() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.report_messages (report_id, message_id, sender, sender_id, body, image_path, created_at)
  select new.id, m.id, m.sender, m.sender_id, m.body, m.image_path, m.created_at
    from public.messages m
   where m.thread_id = new.thread_id
   order by m.created_at
   limit 500;
  return null;
end;
$$;

create trigger reports_snapshot after insert on public.reports
  for each row execute function public.snapshot_report_messages();

-- The RPC the app should use: validates the reason, checks the caller really is in the thread, and
-- returns the new report id. 0002's "reports: participants insert" policy is LEFT IN PLACE so the
-- current frontend keeps working unchanged (see the note in section 17).
create function public.file_report(p_thread_id uuid, p_reason text, p_note text default '')
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  v_id uuid;
begin
  if uid is null then
    raise exception 'not-signed-in' using errcode = 'insufficient_privilege';
  end if;
  if p_reason is null or p_reason not in ('spam', 'scam', 'harassment', 'counterfeit', 'other') then
    raise exception 'bad-reason' using errcode = 'check_violation';
  end if;
  if not public.is_thread_party(p_thread_id) then
    raise exception 'not-found' using errcode = 'no_data_found';
  end if;
  insert into public.reports (reporter_id, thread_id, reason, note)
  values (uid, p_thread_id, p_reason, left(trim(coalesce(p_note, '')), 1000))
  returning id into v_id;
  return v_id;
end;
$$;

/* ======================================================================================
   10. What admins may see (B13, B14, B16)
   ====================================================================================== */

-- 0003 let admins read a reported thread and its messages, but chat-images SELECT was is_thread_party
-- only, so an image-only report was unreadable. Same scope as the message policy: reported threads only.
drop policy if exists "chat images: parties read" on storage.objects;
create policy "chat images: parties read" on storage.objects for select to authenticated
  using (bucket_id = 'chat-images'
         and (public.is_thread_party(public.path_uuid(name))
              or (public.is_admin() and public.thread_is_reported(public.path_uuid(name)))));

-- The Terms say staff can look into an order dispute, but no policy gave admins any read on
-- orders / order_items / order_events. This is the agreed minimum: status history, totals and the order
-- code. It deliberately does NOT return address, phone, note, slip_path, tracking, cancel_reason or the
-- PromptPay snapshot - staff resolving a dispute do not need the buyer's PII.
create function public.admin_order_summary(p_order_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_out jsonb;
begin
  if not public.is_admin() then
    raise exception 'not-admin' using errcode = 'insufficient_privilege';
  end if;
  select jsonb_build_object(
           'id', o.id,
           'code', o.code,
           'shop_id', o.shop_id,
           'status', o.status,
           'created_at', o.created_at,
           'updated_at', o.updated_at,
           'subtotal_thb', o.subtotal_thb,
           'shipping_thb', o.shipping_thb,
           'total_thb', o.total_thb,
           'item_count', coalesce((select sum(i.qty) from public.order_items i where i.order_id = o.id), 0),
           'events', coalesce((select jsonb_agg(jsonb_build_object('status', e.status, 'actor_id', e.actor_id, 'at', e.at)
                                                order by e.at)
                                 from public.order_events e where e.order_id = o.id), '[]'::jsonb)
         )
    into v_out
    from public.orders o
   where o.id = p_order_id;
  if v_out is null then
    raise exception 'not-found' using errcode = 'no_data_found';
  end if;
  return v_out;
end;
$$;

-- thread_is_reported() answered for ANY thread id, so any signed-in user could probe whether a
-- conversation had been reported (moderation state).
-- It cannot simply have its EXECUTE grant revoked: an RLS policy expression is NOT evaluated with the
-- table owner's privileges, it is permission-checked against the caller. Revoking it was tried on a
-- local replica and broke every read of public.messages, public.threads and the chat-images bucket for
-- ordinary users ("permission denied for function thread_is_reported"), i.e. it took chat down. So the
-- grant stays and the answer is gated instead: non-admins always get false and learn nothing.
create or replace function public.thread_is_reported(p_thread_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin()
     and exists (select 1 from public.reports r where r.thread_id = p_thread_id)
$$;

/* ======================================================================================
   11. admin_list_shops: no raw PromptPay id in the browser (B19)
   ====================================================================================== */

-- 0003 shipped to_jsonb(s), i.e. every raw shops column, including promptpay_id - which for many shops
-- is a 13-digit national/tax ID. Explicit column list instead, with a boolean in its place.
-- Shape change for the admin UI: promptpay_id / promptpay_name are gone; has_promptpay and
-- owner_suspended are new.
create or replace function public.admin_list_shops() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'not-admin' using errcode = 'insufficient_privilege';
  end if;
  return coalesce((
    select jsonb_agg(
             jsonb_build_object(
               'id', s.id,
               'owner_id', s.owner_id,
               'slug', s.slug,
               'name', s.name,
               'owner_name', s.owner_name,
               'description', s.description,
               'city', s.city,
               'tint', s.tint,
               'logo_url', s.logo_url,
               'cover_url', s.cover_url,
               'links', s.links,
               'shipping_thb', s.shipping_thb,
               'free_shipping_from_thb', s.free_shipping_from_thb,
               'product_types', s.product_types,
               'status', s.status,
               'status_reason', s.status_reason,
               'created_at', s.created_at,
               'updated_at', s.updated_at,
               'has_promptpay', (s.promptpay_id is not null),
               'owner_suspended', (select p.suspended_at is not null from public.profiles p where p.id = s.owner_id),
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
   12. Image URLs: no whitespace tricks, no '..', and the storage host is pinned (B8)
   ====================================================================================== */

-- ===> EDIT ME AFTER APPLYING <===
-- The storage host for this project. Browsers strip ASCII tab/LF/CR before parsing a URL, so
-- '/<TAB>/evil.example/x.png' passed 0004's '^/[^/\\]' rule and then rendered as
-- '//evil.example/x.png' - an off-site image request leaking every visitor's IP, user agent and
-- referring page. Pinning the host closes the https branch as well.
-- The default accepts ANY *.supabase.co host, so a live site never breaks on apply; replace it with
-- your own project host (e.g. 'abcdefghijklmnop.supabase.co') to pin it properly:
--   create or replace function public.storage_host() returns text
--   language sql immutable set search_path = '' as $$ select '<project-ref>.supabase.co' $$;
--   -- then re-validate: see the DO block at the end of this section.
-- One '*' is allowed as a leading wildcard label. Lowercase only.
create function public.storage_host() returns text
language sql immutable set search_path = '' as $$ select '*.supabase.co' $$;

-- storage_host() as a regex fragment: '.' escaped, a leading '*' becomes one DNS label.
create function public.storage_host_regex() returns text
language sql immutable set search_path = '' as $$
  select replace(replace(lower(trim(coalesce(public.storage_host(), '*.supabase.co'))), '.', '\.'),
                 '*', '[a-z0-9-]+')
$$;

-- Allowed: https URLs into this project's public storage (host and bucket pinned), site paths starting
-- with exactly one '/', or inline data:image/ URLs. Rejected everywhere: any whitespace character (the
-- tab/LF/CR bypass above - the app's own data URLs are percent- or base64-encoded, so they contain
-- none) and any '..' path segment.
create or replace function public.image_url_allowed(p_url text) returns boolean
language sql immutable set search_path = '' as $$
  select p_url !~ '[[:space:]]'
     and p_url !~ '(^|/)\.\.(/|$)'
     and (
       p_url ~ ('^https://' || public.storage_host_regex() || '/storage/v1/object/public/(product-images|shop-images)/[^[:space:]<>"]+$')
       or p_url ~ '^/[^/\\]'
       or p_url ~ '^data:image/(svg\+xml|png|jpeg|webp|gif)[;,]'
     )
$$;

-- The three constraints from 0004 were already VALID, so `validate constraint` alone would be a no-op
-- against the stricter function: drop and re-add NOT VALID, then validate when the rows comply.
alter table public.shops
  drop constraint if exists shops_logo_url_check,
  drop constraint if exists shops_cover_url_check,
  add constraint shops_logo_url_check check (public.image_url_allowed(logo_url) and char_length(logo_url) <= 1000) not valid,
  add constraint shops_cover_url_check check (public.image_url_allowed(cover_url) and char_length(cover_url) <= 1000) not valid;
alter table public.products
  drop constraint if exists products_image_url_check,
  add constraint products_image_url_check check (public.image_url_allowed(image_url) and char_length(image_url) <= 200000) not valid;

do $$
begin
  raise notice 'public.storage_host() returns %, which accepts any *.supabase.co host. Set it to this project''s host and re-run this block.', public.storage_host();
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
   13. shop_payment_info: an owner may always see their own PromptPay (B18)
   ====================================================================================== */

-- 0004 applied `status = 'approved'` to the whole predicate, which also hid a shop's own PromptPay
-- details from its owner while the shop was pending or paused - so the seller could not check what they
-- had entered, or correct it, exactly when staff had asked them to. The owner branch is unconditional
-- again; the buyer branch still requires an approved shop.
create or replace function public.shop_payment_info(p_shop_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', s.promptpay_id, 'name', s.promptpay_name)
    from public.shops s
   where s.id = p_shop_id and s.promptpay_id is not null
     and (s.owner_id = auth.uid()
          or (s.status = 'approved' and exists (
                select 1 from public.orders o
                 where o.shop_id = s.id and o.buyer_id = auth.uid()
                   and o.status in ('awaiting_payment', 'slip_submitted'))))
$$;

/* ======================================================================================
   14. track_view: a site-wide brake and a path whitelist (B11)
   ====================================================================================== */

-- As in 0003, plus:
--   * session_id is chosen by the client, so the per-session limit was defeated simply by rotating it
--     (300 fabricated ids produced 300 rows). A site-wide ceiling of 2000 rows per minute puts a floor
--     under the damage without touching normal traffic;
--   * `path` was any 200-char string starting with '/', so arbitrary text landed in the admin page's
--     "Top pages". Only the shapes this app actually routes are recorded now:
--     lowercase letters, digits, '/', '_', ':' and '-'. Anything else is dropped silently, like the
--     other invalid inputs here, so a bad value never breaks a page.
create or replace function public.track_view(
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
  if char_length(v_path) > 200 or v_path !~ '^/[a-z0-9/_:-]*$' then
    return;
  end if;
  if (select count(*) from public.page_views
       where session_id = p_session_id and created_at > now() - interval '10 minutes') >= 120 then
    return;
  end if;
  -- Site-wide brake: a client that rotates session_id cannot fill the table.
  if (select count(*) from public.page_views where created_at > now() - interval '1 minute') >= 2000 then
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

/* ======================================================================================
   15. Orphaned files in the PUBLIC buckets too (B7)
   ====================================================================================== */

-- As in 0004 (slips and chat-images), plus product-images/<shop_id>/ and shop-images/<shop_id>/ whose
-- folder uuid no longer matches a shops row. Those two buckets are PUBLIC: after an account is deleted
-- (profile -> shop cascade) nothing pointed at the files any more, yet every one of them stayed
-- downloadable by URL for good. Same 1-day age floor, which also keeps the function away from uploads
-- still between upload and the RPC that records them.
create or replace function public.storage_orphans(p_limit integer default 1000)
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
    union all
    select o.bucket_id, o.name
      from storage.objects o
     where o.bucket_id in ('product-images', 'shop-images')
       and o.created_at < now() - interval '1 day'
       and not exists (select 1 from public.shops s where s.id = public.path_uuid(o.name))
  )
  limit least(greatest(coalesce(p_limit, 1000), 1), 10000)
$$;

/* ======================================================================================
   16. Leftovers from 0001 (B17)
   ====================================================================================== */

-- handle_new_user() is SECURITY DEFINER and inserts into public.profiles. It only ever runs from the
-- trigger on auth.users, but Supabase's default EXECUTE grant left it callable by anon/authenticated.
revoke execute on function public.handle_new_user from public, anon, authenticated;

-- No pinned search_path: both are called from triggers and SECURITY DEFINER bodies, so a search_path a
-- caller controls should never be able to decide what they resolve to. Values unchanged.
create or replace function public.current_terms_version() returns text
language sql immutable set search_path = '' as $$ select '2026-10-20' $$;

create or replace function public.is_client_request() returns boolean
language sql stable set search_path = '' as $$
  select current_user in ('anon', 'authenticated')
$$;

/* ======================================================================================
   17. Privileges
   ====================================================================================== */

-- 0001 revoked only insert/update/delete on profiles and shops, so Supabase's default GRANT ALL left
-- anon/authenticated holding TRIGGER, TRUNCATE and REFERENCES on them - and on most other public tables
-- too. TRIGGER is a full admin escalation wherever CREATE on schema public is granted: a user trigger
-- on profiles that sets new.is_admin bypassed 0003's `before update OF is_admin` guard entirely
-- (verified end-to-end). Swept across every table and view in public, not just the two.
-- NOTE for future migrations: Supabase's default privileges grant ALL on each new public table, so a new
-- table needs `revoke all on <table> from anon, authenticated;` before its grants - as every table in
-- 0002-0005 does - or this sweep has to be repeated.
do $$
declare
  r record;
begin
  for r in
    select c.oid::regclass as rel, c.relkind
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r', 'p', 'v')
  loop
    if r.relkind = 'v' then
      execute format('revoke trigger on %s from anon, authenticated', r.rel);
    else
      execute format('revoke trigger, truncate, references on %s from anon, authenticated', r.rel);
    end if;
  end loop;
end;
$$;

-- With CREATE on schema public a client can also create its own tables and functions. Supabase does not
-- grant it to anon/authenticated by default; revoked anyway, guarded so a project where the schema is
-- owned elsewhere does not fail to apply.
do $$
begin
  revoke create on schema public from anon, authenticated;
exception when others then
  raise notice 'could not revoke create on schema public (%): check it by hand', sqlerrm;
end;
$$;

-- New functions: revoke Supabase's default EXECUTE grant, then grant back what is needed.
revoke execute on function
  public.is_suspended, public.log_admin_action, public.log_status_change, public.set_user_suspended,
  public.set_product_hidden, public.guard_report_insert, public.snapshot_report_messages,
  public.file_report, public.admin_order_summary, public.storage_host, public.storage_host_regex
  from public, anon, authenticated;

-- Re-stated for replaced functions (create or replace keeps grants; this is belt and braces).
revoke execute on function
  public.place_order, public.restore_order_stock, public.expire_unpaid_orders,
  public.auto_complete_shipped_orders, public.purge_closed_orders, public.set_shop_status,
  public.send_message, public.open_thread, public.create_my_shop, public.set_order_status,
  public.submit_slip, public.admin_list_shops, public.image_url_allowed, public.shop_payment_info,
  public.track_view, public.storage_orphans, public.current_terms_version, public.is_client_request,
  public.guard_profile_admin
  from public, anon, authenticated;

grant execute on function
  public.place_order, public.set_order_status, public.submit_slip, public.shop_payment_info,
  public.send_message, public.open_thread, public.create_my_shop, public.mark_thread_read
  to authenticated;

-- Admin RPCs check is_admin() themselves; granting to authenticated only lets them ask.
grant execute on function
  public.set_shop_status, public.admin_list_shops, public.set_user_suspended, public.set_product_hidden,
  public.admin_order_summary
  to authenticated;

-- Reporting. 0002's "reports: participants insert" policy and its column grant are LEFT IN PLACE, so
-- src/features/market/supabaseStore.ts keeps working unchanged - but the reports_guard /
-- reports_snapshot triggers mean the direct insert now also rate-limits and snapshots, so it can raise
-- 'already-reported' and 'rate-limited' where it never used to.
grant execute on function public.file_report to authenticated;

-- is_suspended(): answers only for the caller, like is_admin(); the UI may ask.
grant execute on function public.is_suspended to authenticated;

-- Visitors (signed in or not) record views, as in 0003.
grant execute on function public.track_view to anon, authenticated;

-- Check-constraint helpers: pure functions, anyone may evaluate them (same as 0002's shop_links_valid).
-- A CHECK constraint is permission-checked against the writer, not the table owner, so a client that
-- may insert into products/shops must be able to evaluate these.
grant execute on function public.image_url_allowed, public.storage_host, public.storage_host_regex,
  public.current_terms_version, public.is_client_request to anon, authenticated;

-- Housekeeping: service role / pg_cron only.
grant execute on function
  public.expire_unpaid_orders, public.auto_complete_shipped_orders, public.purge_closed_orders,
  public.storage_orphans
  to service_role;

-- thread_is_reported() keeps 0003's grant on purpose (section 10 explains why revoking it takes chat
-- down); its body now refuses to answer anyone who is not an admin.
revoke execute on function public.thread_is_reported from public, anon;
grant execute on function public.thread_is_reported to authenticated;

/* ======================================================================================
   18. Scheduled jobs (pg_cron)
   Nothing in this migration needs a NEW job: the fixes ride on the four that already exist. The block
   is repeated (idempotent, jobs replaced by name) so a database where pg_cron was enabled only after
   0004 still ends up scheduled. The storage-cleanup Edge Function is scheduled separately with pg_net
   and now also clears orphans in the two public buckets; see supabase/functions/storage-cleanup.
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
