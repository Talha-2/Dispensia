create extension if not exists "pgcrypto";

create type public.staff_role as enum ('admin', 'pharmacist', 'technician', 'auditor');
create type public.inventory_status as enum ('active', 'quarantined', 'expired', 'depleted');
create type public.prescription_status as enum ('pending', 'review', 'ready', 'dispensed', 'cancelled');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  address text,
  created_at timestamptz not null default now()
);

create table public.staff_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  full_name text not null,
  role public.staff_role not null default 'technician',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  medical_record_number text not null,
  full_name text not null,
  date_of_birth date,
  gender text,
  allergies text[] not null default '{}',
  risk_level text not null default 'low' check (risk_level in ('low', 'medium', 'high')),
  created_at timestamptz not null default now(),
  unique (organization_id, medical_record_number)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  generic_name text,
  strength text,
  category text not null,
  requires_prescription boolean not null default true,
  controlled_substance boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.inventory_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  batch_number text not null,
  expiry_date date not null,
  quantity integer not null default 0 check (quantity >= 0),
  reorder_level integer not null default 0 check (reorder_level >= 0),
  unit_price numeric(12, 2) not null default 0 check (unit_price >= 0),
  status public.inventory_status not null default 'active',
  created_at timestamptz not null default now(),
  unique (branch_id, product_id, batch_number)
);

create table public.prescriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete restrict,
  prescribed_by text not null,
  status public.prescription_status not null default 'pending',
  safety_notes text,
  reviewed_by uuid references public.staff_profiles(id) on delete set null,
  dispensed_by uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  dispensed_at timestamptz
);

create table public.prescription_items (
  id uuid primary key default gen_random_uuid(),
  prescription_id uuid not null references public.prescriptions(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  dosage text not null,
  quantity integer not null check (quantity > 0)
);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  batch_id uuid not null references public.inventory_batches(id) on delete restrict,
  staff_id uuid references public.staff_profiles(id) on delete set null,
  quantity_delta integer not null check (quantity_delta <> 0),
  reason text not null,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  staff_id uuid references public.staff_profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index inventory_batches_expiry_idx on public.inventory_batches (organization_id, expiry_date);
create index prescriptions_status_idx on public.prescriptions (organization_id, status);
create index audit_logs_created_at_idx on public.audit_logs (organization_id, created_at desc);

alter table public.organizations enable row level security;
alter table public.branches enable row level security;
alter table public.staff_profiles enable row level security;
alter table public.patients enable row level security;
alter table public.products enable row level security;
alter table public.inventory_batches enable row level security;
alter table public.prescriptions enable row level security;
alter table public.prescription_items enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.audit_logs enable row level security;

create or replace function public.current_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.staff_profiles where id = auth.uid() and active = true;
$$;

create policy "staff can read organization branches" on public.branches for select using (organization_id = public.current_organization_id());
create policy "staff can read organization patients" on public.patients for select using (organization_id = public.current_organization_id());
create policy "staff can read organization products" on public.products for select using (organization_id = public.current_organization_id());
create policy "staff can read organization batches" on public.inventory_batches for select using (organization_id = public.current_organization_id());
create policy "staff can read organization prescriptions" on public.prescriptions for select using (organization_id = public.current_organization_id());
create policy "staff can read organization audit logs" on public.audit_logs for select using (organization_id = public.current_organization_id());
