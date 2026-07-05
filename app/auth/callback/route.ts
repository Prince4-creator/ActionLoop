import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isAdminUser } from '@/lib/auth';

function copyCookies(fromResponse: NextResponse, toResponse: NextResponse) {
  fromResponse.cookies.getAll().forEach(({ name, value }) => {
    toResponse.cookies.set(name, value);
  });
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const redirectTarget = requestUrl.searchParams.get('next') ?? '/dashboard';
  const redirectUrl = new URL(redirectTarget, requestUrl.origin);
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const code = requestUrl.searchParams.get('code');
  const authError = requestUrl.searchParams.get('error');
  const errorDescription = requestUrl.searchParams.get('error_description');

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      redirectUrl.pathname = '/login';
      redirectUrl.search = '';
      redirectUrl.searchParams.set('error', 'auth_callback_failed');
      redirectUrl.searchParams.set('message', error.message);
      response = NextResponse.redirect(redirectUrl);
      return response;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) {
      await fetch(`${requestUrl.origin}/api/teams/ensure-default`, {
        method: 'POST',
        headers: { cookie: request.headers.get('cookie') || '' },
      });

      if (user && isAdminUser(user)) {
        if (redirectUrl.pathname !== '/admin') {
          redirectUrl.pathname = '/admin';
          redirectUrl.search = '';
        }
      }
    }

    const redirectResponse = NextResponse.redirect(redirectUrl);
    copyCookies(response, redirectResponse);
    return redirectResponse;
  }

  if (authError) {
    redirectUrl.pathname = '/login';
    redirectUrl.search = '';
    redirectUrl.searchParams.set('error', authError);
    if (errorDescription) {
      redirectUrl.searchParams.set('message', errorDescription);
    }
    const redirectResponse = NextResponse.redirect(redirectUrl);
    copyCookies(response, redirectResponse);
    return redirectResponse;
  }

  return response;
}