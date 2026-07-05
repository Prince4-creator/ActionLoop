// quick schema check script
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(2);
}

const supabase = createClient(url, key);

async function check() {
  try {
    console.log('Checking connection to', url);
    const { data: meetings, error: mErr } = await supabase
      .from('meetings')
      .select('id, title, desired_outcome, decision, outcome_score')
      .limit(1);

    if (mErr) {
      console.error('Meetings query error:', mErr.message || mErr);
    } else {
      console.log('Meetings query succeeded. Sample rows:', meetings.length);
      console.log(meetings);
    }

    const { data: items, error: iErr } = await supabase
      .from('action_items')
      .select('id, meeting_id, nudges_sent, last_nudged_at, last_nudge_error, team_id')
      .limit(1);

    if (iErr) {
      console.error('Action_items query error:', iErr.message || iErr);
    } else {
      console.log('Action_items query succeeded. Sample rows:', items.length);
      console.log(items);
    }

    process.exit(0);
  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(1);
  }
}

check();
