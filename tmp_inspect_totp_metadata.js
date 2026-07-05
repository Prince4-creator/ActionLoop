const path = require('path');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

dotenv.config({ path: path.join(__dirname, '.env.local') });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing Supabase env');
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
(async () => {
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 100 });
  if (error) {
    console.error('listUsers error', error);
    process.exit(1);
  }
  const user = data.users.find((u) => u.email === 'princeboame4@gmail.com');
  console.log('found', !!user);
  if (user) {
    console.log('id', user.id);
    console.log('email', user.email);
    console.log('app_metadata', JSON.stringify(user.app_metadata, null, 2));
    console.log('user_metadata', JSON.stringify(user.user_metadata, null, 2));
  }
})();
