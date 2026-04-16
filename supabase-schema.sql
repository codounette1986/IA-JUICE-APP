create extension if not exists pgcrypto;

create table if not exists public.products (
  id text primary key,
  name text not null,
  code text not null,
  category text not null,
  size text,
  status text default 'Actif',
  product_type text default 'simple',
  description text default '',
  default_price numeric(12,2) default 0,
  default_cost numeric(12,2) default 0,
  pack_size integer default 0,
  known_product_list text default 'yes',
  components jsonb not null default '[]'::jsonb,
  cost_items jsonb not null default '[]'::jsonb,
  pricing_details jsonb,
  linked_pm_product_id text default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.clients (
  id text primary key,
  name text not null,
  phone text default '',
  type text default '',
  city text default '',
  channel text default '',
  notes text default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.production (
  id text primary key,
  date date,
  lot text default '',
  event text default '',
  product_id text not null,
  quantity numeric(12,2) default 0,
  unit_cost numeric(12,2) default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.sales (
  id text primary key,
  date date,
  client_id text,
  product_id text not null,
  quantity numeric(12,2) default 0,
  unit_price numeric(12,2) default 0,
  status text default 'Impayé',
  amount_paid numeric(12,2) default 0,
  sale_components jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.products enable row level security;
alter table public.clients enable row level security;
alter table public.production enable row level security;
alter table public.sales enable row level security;

drop policy if exists "products_full_access" on public.products;
create policy "products_full_access" on public.products for all using (true) with check (true);

drop policy if exists "clients_full_access" on public.clients;
create policy "clients_full_access" on public.clients for all using (true) with check (true);

drop policy if exists "production_full_access" on public.production;
create policy "production_full_access" on public.production for all using (true) with check (true);

drop policy if exists "sales_full_access" on public.sales;
create policy "sales_full_access" on public.sales for all using (true) with check (true);

create or replace function public.get_app_state()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'products', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'name', p.name,
          'code', p.code,
          'category', p.category,
          'size', p.size,
          'status', p.status,
          'productType', p.product_type,
          'description', p.description,
          'defaultPrice', p.default_price,
          'defaultCost', p.default_cost,
          'packSize', p.pack_size,
          'knownProductList', p.known_product_list,
          'components', p.components,
          'costItems', p.cost_items,
          'pricingDetails', p.pricing_details,
          'linkedPmProductId', p.linked_pm_product_id,
          'updatedAt', p.updated_at
        )
        order by p.name, p.code
      )
      from public.products p
    ), '[]'::jsonb),
    'clients', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'name', c.name,
          'phone', c.phone,
          'type', c.type,
          'city', c.city,
          'channel', c.channel,
          'notes', c.notes,
          'updatedAt', c.updated_at
        )
        order by c.name
      )
      from public.clients c
    ), '[]'::jsonb),
    'production', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', pr.id,
          'date', pr.date,
          'lot', pr.lot,
          'event', pr.event,
          'productId', pr.product_id,
          'quantity', pr.quantity,
          'unitCost', pr.unit_cost,
          'updatedAt', pr.updated_at
        )
        order by pr.date, pr.lot
      )
      from public.production pr
    ), '[]'::jsonb),
    'sales', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'date', s.date,
          'clientId', s.client_id,
          'productId', s.product_id,
          'quantity', s.quantity,
          'unitPrice', s.unit_price,
          'status', s.status,
          'amountPaid', s.amount_paid,
          'saleComponents', s.sale_components,
          'updatedAt', s.updated_at
        )
        order by s.date
      )
      from public.sales s
    ), '[]'::jsonb)
  );
$$;

create or replace function public.sync_app_state(payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.products (
    id, name, code, category, size, status, product_type, description,
    default_price, default_cost, pack_size, known_product_list,
    components, cost_items, pricing_details, linked_pm_product_id, updated_at
  )
  select
    item->>'id',
    coalesce(item->>'name', ''),
    coalesce(item->>'code', ''),
    coalesce(item->>'category', ''),
    coalesce(item->>'size', ''),
    coalesce(item->>'status', 'Actif'),
    coalesce(item->>'productType', 'simple'),
    coalesce(item->>'description', ''),
    coalesce((item->>'defaultPrice')::numeric, 0),
    coalesce((item->>'defaultCost')::numeric, 0),
    coalesce((item->>'packSize')::integer, 0),
    coalesce(item->>'knownProductList', 'yes'),
    coalesce(item->'components', '[]'::jsonb),
    coalesce(item->'costItems', '[]'::jsonb),
    item->'pricingDetails',
    coalesce(item->>'linkedPmProductId', ''),
    coalesce(nullif(item->>'updatedAt', '')::timestamptz, timezone('utc', now()))
  from jsonb_array_elements(coalesce(payload->'products', '[]'::jsonb)) item
  on conflict (id) do update
  set
    name = excluded.name,
    code = excluded.code,
    category = excluded.category,
    size = excluded.size,
    status = excluded.status,
    product_type = excluded.product_type,
    description = excluded.description,
    default_price = excluded.default_price,
    default_cost = excluded.default_cost,
    pack_size = excluded.pack_size,
    known_product_list = excluded.known_product_list,
    components = excluded.components,
    cost_items = excluded.cost_items,
    pricing_details = excluded.pricing_details,
    linked_pm_product_id = excluded.linked_pm_product_id,
    updated_at = excluded.updated_at
  where public.products.updated_at <= excluded.updated_at;

  insert into public.clients (
    id, name, phone, type, city, channel, notes, updated_at
  )
  select
    item->>'id',
    coalesce(item->>'name', ''),
    coalesce(item->>'phone', ''),
    coalesce(item->>'type', ''),
    coalesce(item->>'city', ''),
    coalesce(item->>'channel', ''),
    coalesce(item->>'notes', ''),
    coalesce(nullif(item->>'updatedAt', '')::timestamptz, timezone('utc', now()))
  from jsonb_array_elements(coalesce(payload->'clients', '[]'::jsonb)) item
  on conflict (id) do update
  set
    name = excluded.name,
    phone = excluded.phone,
    type = excluded.type,
    city = excluded.city,
    channel = excluded.channel,
    notes = excluded.notes,
    updated_at = excluded.updated_at
  where public.clients.updated_at <= excluded.updated_at;

  insert into public.production (
    id, date, lot, event, product_id, quantity, unit_cost, updated_at
  )
  select
    item->>'id',
    nullif(item->>'date', '')::date,
    coalesce(item->>'lot', ''),
    coalesce(item->>'event', ''),
    coalesce(item->>'productId', ''),
    coalesce((item->>'quantity')::numeric, 0),
    coalesce((item->>'unitCost')::numeric, 0),
    coalesce(nullif(item->>'updatedAt', '')::timestamptz, timezone('utc', now()))
  from jsonb_array_elements(coalesce(payload->'production', '[]'::jsonb)) item
  on conflict (id) do update
  set
    date = excluded.date,
    lot = excluded.lot,
    event = excluded.event,
    product_id = excluded.product_id,
    quantity = excluded.quantity,
    unit_cost = excluded.unit_cost,
    updated_at = excluded.updated_at
  where public.production.updated_at <= excluded.updated_at;

  insert into public.sales (
    id, date, client_id, product_id, quantity, unit_price, status, amount_paid, sale_components, updated_at
  )
  select
    item->>'id',
    nullif(item->>'date', '')::date,
    coalesce(item->>'clientId', ''),
    coalesce(item->>'productId', ''),
    coalesce((item->>'quantity')::numeric, 0),
    coalesce((item->>'unitPrice')::numeric, 0),
    coalesce(item->>'status', 'Impayé'),
    coalesce((item->>'amountPaid')::numeric, 0),
    coalesce(item->'saleComponents', '[]'::jsonb),
    coalesce(nullif(item->>'updatedAt', '')::timestamptz, timezone('utc', now()))
  from jsonb_array_elements(coalesce(payload->'sales', '[]'::jsonb)) item
  on conflict (id) do update
  set
    date = excluded.date,
    client_id = excluded.client_id,
    product_id = excluded.product_id,
    quantity = excluded.quantity,
    unit_price = excluded.unit_price,
    status = excluded.status,
    amount_paid = excluded.amount_paid,
    sale_components = excluded.sale_components,
    updated_at = excluded.updated_at
  where public.sales.updated_at <= excluded.updated_at;
end;
$$;

grant execute on function public.get_app_state() to anon, authenticated;
grant execute on function public.sync_app_state(jsonb) to anon, authenticated;
