-- Admin audit log: records admin-only actions (role changes, request
-- conversions/deletions) so the admin dashboard can show a real activity
-- feed. Writes go through the service-role admin client from API routes
-- that already gate on isAdminUser(), consistent with how admin_settings
-- and other admin-only tables are handled elsewhere in this codebase.

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id) on delete cascade,
  actor_email text,
  action text not null,
  target_type text,
  target_id text,
  details jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_audit_log_created_at
  on public.admin_audit_log (created_at desc);

alter table public.admin_audit_log enable row level security;

drop policy if exists "admin_audit_log_insert_self" on public.admin_audit_log;
create policy "admin_audit_log_insert_self"
  on public.admin_audit_log
  for insert
  to authenticated
  with check (actor_id = (select auth.uid()));

-- Reads are served exclusively through /api/admin/audit-log, which checks
-- isAdminUser() and uses the service-role client. This SELECT policy is a
-- narrow fallback for authenticated sessions without a service key locally.
drop policy if exists "admin_audit_log_select_self" on public.admin_audit_log;
create policy "admin_audit_log_select_self"
  on public.admin_audit_log
  for select
  to authenticated
  using (actor_id = (select auth.uid()));