const { createClient } = require('@supabase/supabase-js');
const url = 'https://thhhywbxqxmtkwrnsqwe.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoaGh5d2J4cXhtdGt3cm5zcXdlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjMxNTAxMiwiZXhwIjoyMDk3ODkxMDEyfQ.PzJ_kesAFA50qM7dAB_u7dG31odaLW2epcc9MRnancU';
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
(async () => {
  const { data, error } = await supabase
    .from('action_items')
    .update({ status: 'done' })
    .eq('id', '84a05f93-3f3a-405d-b925-abd41c4e8510')
    .select('id, status');
  console.log(JSON.stringify({ data, error }, null, 2));
})();
