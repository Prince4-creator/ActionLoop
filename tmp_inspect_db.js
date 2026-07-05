const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(process.cwd(), '.env.local') });
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing env');
  process.exit(1);
}
const client = createClient(supabaseUrl, serviceRoleKey);
(async () => {
  const id = 'e763d0f2-3b3f-4428-ba8c-2ee53791c92a';
  const { data: meeting, error: meetingError } = await client.from('meetings').select('*').eq('id', id).single();
  console.log('meeting', { meeting, meetingError });
  const { data: items, error: itemsError } = await client.from('action_items').select('*').eq('meeting_id', id);
  console.log('items', { items, itemsError });
  const { data: teams, error: teamsError } = await client.from('teams').select('*');
  console.log('teamsCount', teams?.length, { teamsError });
  const { data: members, error: membersError } = await client.from('team_members').select('*');
  console.log('teamMembersCount', members?.length, { membersError });
})();
