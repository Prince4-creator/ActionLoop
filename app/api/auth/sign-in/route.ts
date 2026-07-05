import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

function copyCookies(fromResponse: NextResponse, toResponse: NextResponse) {
  fromResponse.cookies.getAll().forEach(({ name, value }) => {
    if (name && value) {
      toResponse.cookies.set(name, value);
    }
  });
}

export async function POST(request: Request) {
  const { email, password } = await request.json();
  const response = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return Array.from((request as any).cookies?.getAll?.() ?? []);
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            if (name && value) {
              response.cookies.set(name, value);
            }
          });
        },
      },
    }
  );

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    const errorResponse = NextResponse.json({ error: error.message }, { status: 401 });
    copyCookies(response, errorResponse);
    return errorResponse;
  }

  const successResponse = NextResponse.json({ user: data.user ?? null });
  copyCookies(response, successResponse);
  return successResponse;
}
