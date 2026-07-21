import type { SupabaseClient, User } from '@supabase/supabase-js';

export async function getDisplayName(
  supabase: SupabaseClient,
  user: Pick<User, 'email'>
): Promise<string> {
  const emailFallback = user.email?.split('@')[0] || 'there';

  if (!user.email) return emailFallback;

  const { data, error } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('email', user.email)
    .maybeSingle();

  if (error || !data?.full_name) {
    return emailFallback;
  }

  return data.full_name;
}