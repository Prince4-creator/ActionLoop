import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // Protect middleware from throwing when environment variables are missing
  // or when the Supabase client initialization fails in production.
  let supabase = null;
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!url || !key) {
      console.error('Supabase middleware: missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
      return supabaseResponse;
    }

    supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            supabaseResponse = NextResponse.next({ request });
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    });
  } catch (error) {
    console.error('Supabase middleware initialization failed:', error);
    return supabaseResponse;
  }

  const hasAuthCookie =
    !!request.cookies.get('sb-access-token') ||
    !!request.cookies.get('sb-refresh-token');

  if (hasAuthCookie) {
    try {
      await Promise.race([
        supabase!.auth.getClaims(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Supabase auth.getClaims timed out')), 2000)
        ),
      ]);
    } catch (error) {
      console.error('Supabase middleware auth refresh failed:', error);
    }
  }

  return supabaseResponse;
}