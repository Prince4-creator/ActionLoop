# Admin: distinct theme + bulk actions + audit log

## Order of operations

1. **Run the migration** — `supabase_migrations_20260718000000_admin_audit_log.sql`.
   Copy it into `supabase/migrations/20260718000000_admin_audit_log.sql` and
   apply it (`supabase db push` or run it in the SQL editor). This creates
   `admin_audit_log`.

2. **Add `lib/audit.ts`** — `lib_audit.ts` → `lib/audit.ts`. Small helper
   used by the API routes below; also exports `describeAuditAction` used by
   the dashboard UI.

3. **Replace three API routes** (each file below maps 1:1 to its path):
   - `app_api_admin_users_update_route.ts` → `app/api/admin/users/update/route.ts`
     (now accepts `ids: string[]` for bulk changes, still accepts `id` for
     single changes; logs every role change)
   - `app_api_admin_requests_convert_route.ts` → `app/api/admin/requests/convert/route.ts`
   - `app_api_admin_requests_delete_route.ts` → `app/api/admin/requests/delete/route.ts`

4. **Add the new audit-log endpoint** —
   `app_api_admin_audit-log_route.ts` → `app/api/admin/audit-log/route.ts`.
   (Not currently called by the dashboard — `app/admin/page.tsx` fetches the
   log server-side directly and passes it down as a prop, which is faster.
   This endpoint is there if you ever want to poll/refresh the feed client-side.)

5. **Replace the admin page + dashboard client:**
   - `app_admin_page.tsx` → `app/admin/page.tsx`
   - `app_admin_admin-dashboard-client.tsx` → `app/admin/admin-dashboard-client.tsx`

6. **Apply the CSS** — the `globals.css` from the earlier liquid-glass
   delivery already has the `.admin-scope` block appended (re-download it
   from this conversation if you haven't already applied it).

7. **One-line change in `components/app-shell.tsx`** — see `app-shell-diff.md`.
   This is what actually makes admin pages look different from member
   pages — it's the single wrapper all admin routes share.

## What you get

- **Visual split**: admin pages render in a deep violet/navy glass with a
  gold specular highlight and a tighter `--radius` (denser, more
  "control-panel" than the airy light-blue member theme). This comes
  entirely from CSS variable overrides, so it applies to every admin page
  — dashboard, requests, team settings, TOTP setup — not just the
  dashboard file.
- **Bulk user management**: checkboxes per row + "select all," with a
  toolbar to bulk-promote/demote selected users in one request.
- **Audit log**: every role change, request conversion, and request
  deletion now writes a row to `admin_audit_log`, shown as a live "Recent
  activity" feed on the dashboard — something members never see.
- **Distribution chart**: a small dependency-free SVG/CSS bar chart
  (no new npm packages) showing meetings/action items/pending/teams
  relative to each other, reusing counts you already fetch.

## Notes

- Bulk update calls `.update({ role }).in('id', ids)` on `profiles` through
  the service-role client when `SUPABASE_SERVICE_ROLE_KEY` is set (same
  pattern the rest of your admin routes already use), so it bypasses RLS
  like your other admin writes do.
- If `SUPABASE_SERVICE_ROLE_KEY` isn't set locally, the audit log write
  falls back to the user's session client, which relies on the
  `admin_audit_log_insert_self` RLS policy from the migration.