-- Idempotent fix for user_settings row-level security policies

drop policy if exists user_settings_manage_self_select on user_settings;
drop policy if exists user_settings_manage_self_insert on user_settings;
drop policy if exists user_settings_manage_self_update on user_settings;
drop policy if exists user_settings_manage_self_delete on user_settings;

create policy user_settings_manage_self_select
  on user_settings
  for select using (user_id = auth.uid());

create policy user_settings_manage_self_insert
  on user_settings
  for insert with check (user_id = auth.uid());

create policy user_settings_manage_self_update
  on user_settings
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy user_settings_manage_self_delete
  on user_settings
  for delete using (user_id = auth.uid());
