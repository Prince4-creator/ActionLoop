import type { User } from '@supabase/supabase-js';

function normalizeEmails(value: string | undefined) {
  return (value ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function collectStringValues(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string').map((item) => item.toLowerCase());
  }

  return typeof value === 'string' ? [value.toLowerCase()] : [];
}

export function isAdminUser(user: Pick<User, 'email' | 'app_metadata' | 'user_metadata'>) {
  const adminEmails = new Set(normalizeEmails(process.env.ADMIN_EMAILS));
  adminEmails.add('princeboame4@gmail.com');

  const emailCandidates = [user.email, user.user_metadata?.email, user.user_metadata?.preferred_username]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toLowerCase());

  const appMeta = user.app_metadata as Record<string, unknown> | undefined;
  const userMeta = user.user_metadata as Record<string, unknown> | undefined;
  const roleCandidates = [
    ...collectStringValues(appMeta?.role),
    ...collectStringValues(appMeta?.roles),
    ...collectStringValues(userMeta?.role),
    ...collectStringValues(userMeta?.roles),
    ...(typeof appMeta?.is_admin === 'boolean' && appMeta.is_admin ? ['admin'] : []),
    ...(typeof userMeta?.is_admin === 'boolean' && userMeta.is_admin ? ['admin'] : []),
  ];

  const isAdminByRole = roleCandidates.some((value) => value.includes('admin'));
  const isAdminByEmail = emailCandidates.some((email) => adminEmails.has(email));

  return isAdminByRole || isAdminByEmail;
}
