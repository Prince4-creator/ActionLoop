import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { fetch as undiciFetch } from 'undici';

export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    return null;
  }

  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        // Next.js's dev server patches the global `fetch` for its own
        // request caching/dedup instrumentation. That patched fetch is a
        // known source of `AuthRetryableFetchError` (empty message, status
        // 500) specifically for Supabase's Auth Admin API calls
        // (auth.admin.deleteUser, auth.admin.listUsers, etc.) when invoked
        // from inside an API route. Using undici's fetch directly bypasses
        // Next's wrapper for this client only — everything else (regular
        // table queries via .from()) is unaffected and keeps working as
        // before.
        fetch: undiciFetch as unknown as typeof fetch,
      },
    }
  );
}