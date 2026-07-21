require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('URL:', url);
console.log('Key present:', !!key, key ? key.length : 0);

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

(async () => {
  try {
    const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });
    console.log('listUsers result:', { count: data?.users?.length, error });
  } catch (err) {
    console.error('THREW:', err);
  }
})();