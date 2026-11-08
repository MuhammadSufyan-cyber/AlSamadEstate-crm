-- Al Samad Estate CRM: database schema, security rules and audit trail.
-- Paste this whole file into Supabase > SQL Editor > New query > Run.
-- Safe to run once on a fresh project.

-- 1. PROFILES (one row per login; role decides what a user may do) --------------------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null default '',
  email       text,
  phone       text,
  role        text not null default 'staff' check (role in ('admin', 'staff')),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Create a profile automatically whenever a user is added in Supabase Auth.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper used by the security rules below.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and is_active);
$$;

-- Turned-off consultants can no longer read or save leads.
create or replace function public.is_active_user()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and is_active);
$$;

-- 2. LEADS (client requirements) ------------------------------------------------------
create table public.leads (
  id                  uuid primary key default gen_random_uuid(),
  consultant_id       uuid not null references public.profiles(id) on delete restrict default auth.uid(),
  consultant_name     text not null default '',        -- name typed by the consultant on the form
  client_name         text not null check (length(trim(client_name)) > 0),
  transaction_type    text not null check (transaction_type in ('Rent', 'Sale')),
  requirement_type    text not null check (requirement_type in ('Buying', 'Renting', 'Investment', 'Commercial')),
  property_type       text not null check (property_type in ('House', 'Shop', 'Apartment', 'Plot', 'Office', 'Other')),
  contact_numbers     jsonb not null default '[]'::jsonb,
  preferred_locations jsonb not null default '[]'::jsonb,
  budget_min          numeric(14, 2) not null default 0,
  budget_max          numeric(14, 2) not null default 0,
  notes               text not null default '',
  custom_attributes   jsonb not null default '{}'::jsonb,
  status              text not null default 'New' check (status in ('New', 'Contacted', 'In Progress', 'Closed', 'Archived')),
  deleted_at          timestamptz,                      -- soft delete (admin can restore)
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (budget_max >= budget_min)
);

create index leads_consultant_idx on public.leads (consultant_id);
create index leads_status_idx on public.leads (status);
create index leads_custom_idx on public.leads using gin (custom_attributes);
create index leads_locations_idx on public.leads using gin (preferred_locations);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger leads_touch before update on public.leads
  for each row execute function public.touch_updated_at();

-- 3. AUDIT LOG (every change to a lead is recorded automatically) ---------------------
create table public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references public.leads(id) on delete cascade,
  changed_by  uuid references public.profiles(id) on delete set null,
  field       text not null,
  old_value   text,
  new_value   text,
  changed_at  timestamptz not null default now()
);
create index audit_logs_lead_idx on public.audit_logs (lead_id, changed_at desc);

create or replace function public.log_lead_changes()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  f text;
  o jsonb := to_jsonb(old);
  n jsonb := to_jsonb(new);
begin
  if tg_op = 'INSERT' then
    insert into public.audit_logs (lead_id, changed_by, field, old_value, new_value)
    values (new.id, auth.uid(), 'created', null, 'Lead created');
    return new;
  end if;
  foreach f in array array['client_name','transaction_type','requirement_type','property_type','contact_numbers',
                           'preferred_locations','budget_min','budget_max','notes','custom_attributes','status','deleted_at','consultant_id']
  loop
    if o->f is distinct from n->f then
      insert into public.audit_logs (lead_id, changed_by, field, old_value, new_value)
      values (new.id, auth.uid(), f, o->>f, n->>f);
    end if;
  end loop;
  return new;
end $$;

create trigger leads_audit after insert or update on public.leads
  for each row execute function public.log_lead_changes();

-- 4. SECURITY RULES (row level security) ----------------------------------------------
alter table public.profiles   enable row level security;
alter table public.leads      enable row level security;
alter table public.audit_logs enable row level security;

-- profiles: you can read your own; admins read and manage everyone.
create policy "profiles read own or admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy "profiles admin update" on public.profiles
  for update using (public.is_admin()) with check (public.is_admin());

-- leads: a consultant creates and reads only their own; admins do everything.
create policy "leads staff insert own" on public.leads
  for insert with check (consultant_id = auth.uid() and deleted_at is null and status = 'New' and public.is_active_user());
create policy "leads staff read own" on public.leads
  for select using (consultant_id = auth.uid() and deleted_at is null and public.is_active_user());
create policy "leads admin all" on public.leads
  for all using (public.is_admin()) with check (public.is_admin());

-- audit log: admins only (written by the trigger above, never by the app).
create policy "audit admin read" on public.audit_logs
  for select using (public.is_admin());

-- Needed so signed-in users can use the tables through the API.
grant usage on schema public to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.leads to authenticated;
grant select on public.audit_logs to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_active_user() to authenticated;

-- Live dashboard updates.
alter publication supabase_realtime add table public.leads;

-- 5. MAKE YOURSELF THE FIRST ADMIN ----------------------------------------------------
-- 1) In Supabase: Authentication > Users > Add user (your email + a password, tick "Auto Confirm").
-- 2) Then run this line with your own email:
--
--    update public.profiles set role = 'admin' where email = 'you@example.com';
