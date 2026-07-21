import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Capture a reference to fetch before Next.js has a chance to further patch
// anything in this module's scope — most reliable if this module is only
// ever imported server-side (which lib/admin.ts already is).
const nodeFetch: typeof fetch = globalThis.fetch;

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
        fetch: nodeFetch,
      },
    }
  );
}