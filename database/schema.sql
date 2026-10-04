create extension if not exists pgcrypto;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand text not null,
  description text not null,
  price numeric(12,2) not null check (price >= 0),
  images text[] not null default '{}',
  cover_image text,
  size text not null,
  fragrance_notes text[] not null default '{}',
  category_id uuid references public.categories(id),
  sku text not null unique,
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  active boolean not null default true,
  tags text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  address text,
  city text,
  state text,
  email text not null,
  role text not null default 'customer' check (role in ('customer', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, product_id)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  order_reference text not null unique,
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,
  delivery_address text not null,
  delivery_state text not null,
  delivery_city text not null,
  subtotal numeric(12,2) not null default 0,
  shipping_fee numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid', 'failed', 'refunded')),
  order_status text not null default 'pending' check (order_status in ('pending', 'processing', 'shipped', 'delivered', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id),
  product_name text not null,
  product_brand text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.customer_inquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  message text not null,
  status text not null default 'new' check (status in ('new', 'in_progress', 'resolved')),
  created_at timestamptz not null default now()
);

create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.email_logs (
  id uuid primary key default gen_random_uuid(),
  email_type text not null,
  recipient text not null,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed')),
  error_details text,
  created_at timestamptz not null default now()
);

alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.profiles enable row level security;
alter table public.cart_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.customer_inquiries enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.email_logs enable row level security;

create policy "Public can read active products" on public.products
for select using (active = true);

create policy "Public can read categories" on public.categories
for select using (true);

create policy "Users can read own profile" on public.profiles
for select using (auth.uid() = id);

create policy "Users can update own profile" on public.profiles
for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "Users can read own cart items" on public.cart_items
for select using (auth.uid() = user_id);

create policy "Users can insert own cart items" on public.cart_items
for insert with check (auth.uid() = user_id);

create policy "Users can update own cart items" on public.cart_items
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can delete own cart items" on public.cart_items
for delete using (auth.uid() = user_id);

create policy "Users can read own orders and items" on public.orders
for select using (auth.uid() = user_id or auth.uid() is null);

create policy "Users can insert own orders" on public.orders
for insert with check (auth.uid() = user_id or user_id is null);

create policy "Users can read own order items" on public.order_items
for select using (exists (
  select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()
));

create policy "Public can submit inquiries" on public.customer_inquiries
for insert with check (true);

create policy "Customers can read own inquiries" on public.customer_inquiries
for select using (email = current_setting('request.jwt.claims', true)::json->>'email' or auth.uid() is not null);

create policy "Public can subscribe" on public.newsletter_subscribers
for insert with check (true);

create policy "Admins manage products" on public.products
for all using (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  )
) with check (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  )
);

create policy "Admins manage categories" on public.categories
for all using (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  )
) with check (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  )
);

create policy "Admins manage all orders" on public.orders
for all using (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  )
) with check (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  )
);

create policy "Admins manage all order items" on public.order_items
for all using (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  )
) with check (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  )
);

create policy "Admins can read inquiries and emails" on public.customer_inquiries
for all using (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  )
) with check (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  )
);

create policy "Admins can read email logs" on public.email_logs
for all using (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  )
) with check (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  )
);

create index if not exists idx_products_active on public.products(active);
create index if not exists idx_products_category on public.products(category_id);
create index if not exists idx_orders_user on public.orders(user_id);
create index if not exists idx_cart_user on public.cart_items(user_id);
create index if not exists idx_inquiries_email on public.customer_inquiries(email);
