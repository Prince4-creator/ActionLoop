require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const email = 'princeboame0@gmail.com';

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

(async () => {
  const { data, error } = await supabase
    .from('team_invites')
    .select('team_id, token, status, expires_at')
    .eq('email', email)
    .maybeSingle();

  if (error) {
    console.error('Error querying team_invites:', error);
    process.exit(1);
  }

  if (!data) {
    console.log('No invite found for', email);
    process.exit(0);
  }

  console.log('Invite found:', JSON.stringify(data, null, 2));
  console.log('Invite URL:', `${appUrl}/invite/${data.token}`);
})();
