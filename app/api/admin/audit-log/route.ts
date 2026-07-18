import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/lib/admin';
import { isAdminUser } from '@/lib/auth';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !isAdminUser(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const adminClient = createAdminClient();
  const client = adminClient ?? supabase;

  const { data, error } = await client
    .from('admin_audit_log')
    .select('id, actor_email, action, target_type, target_id, details, created_at')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ entries: [], error: error.message });
  }

  return NextResponse.json({ entries: data ?? [] });
}