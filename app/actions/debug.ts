'use server';

import { createAdminClient } from '@/lib/admin';

export async function testAdminClientCreation() {
  const adminClient = createAdminClient();
  
  console.log('Admin client created:', !!adminClient);
  console.log('SUPABASE_SERVICE_ROLE_KEY env:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
  console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
  
  if (!adminClient) {
    return { error: 'Admin client is null!' };
  }
  
  try {
    const { data, error } = await adminClient
      .from('team_members')
      .select('count', { count: 'exact' })
      .limit(1);
    
    console.log('Query result:', { data, error });
    
    if (error) {
      return { error: error.message };
    }
    
    return { success: true, message: 'Admin client works!' };
  } catch (err) {
    return { error: String(err) };
  }
}
