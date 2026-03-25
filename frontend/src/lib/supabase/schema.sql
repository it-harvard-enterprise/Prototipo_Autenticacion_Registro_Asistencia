-- Profiles table (extends auth.users)
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  first_name text not null,
  last_name text not null,
  email text not null,
  created_at timestamptz default now()
);

-- Students table
create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  cedula text unique not null,
  nombres text not null,
  apellidos text not null,
  edad integer not null,
  grado text not null,
  fingerprint_right text,
  fingerprint_left text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Courses table
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  schedule text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.courses enable row level security;

-- RLS Policies: allow authenticated users full access for now
create policy "Authenticated users can manage profiles"
  on public.profiles for all
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated users can manage students"
  on public.students for all
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated users can manage courses"
  on public.courses for all
  to authenticated
  using (true)
  with check (true);

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger students_updated_at before update on public.students
  for each row execute function update_updated_at();

create trigger courses_updated_at before update on public.courses
  for each row execute function update_updated_at();
