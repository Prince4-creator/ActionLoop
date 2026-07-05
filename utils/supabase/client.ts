import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    console.error('Supabase client: missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
    // Return a lightweight stub to avoid uncaught exceptions in the browser.
    // Callers will get predictable errors instead of an uncaught exception.
    return {
      auth: {
        signInWithPassword: async () => ({ data: null, error: new Error('Missing Supabase public env') }),
        signUp: async () => ({ data: null, error: new Error('Missing Supabase public env') }),
        signInWithOAuth: async () => ({ error: new Error('Missing Supabase public env') }),
      },
      from: () => ({ select: async () => ({ data: null, error: new Error('Missing Supabase public env') }) }),
    } as any;
  }

  return createBrowserClient(url, key);
}