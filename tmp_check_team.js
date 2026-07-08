const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const client = createClient(supabaseUrl, serviceRoleKey);

// ⬇️ fill these in
const MEETING_ID = '81821805-577f-4875-96d8-759acf598a08';
const USER_ID = 'f0eea3d2-1720-4ba5-9d6a-acd0b419f49e';

(async () => {
  const { data: meeting, error: meetingError } = await client
    .from('meetings')
    .select('id, team_id, title')
    .eq('id', MEETING_ID)
    .single();

  const { data: userTeam, error: userTeamError } = await client
    .from('team_members')
    .select('team_id, role')
    .eq('user_id', USER_ID);

  console.log(JSON.stringify({
    meetingTeam: meeting?.team_id,
    meetingTitle: meeting?.title,
    meetingError: meetingError?.message ?? null,
    userTeams: userTeam,
    userTeamError: userTeamError?.message ?? null,
  }, null, 2));
})();