require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');
const crypto = require('crypto');

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const resendKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.RESEND_FROM_EMAIL || 'ActionLoop <onboarding@resend.dev>';
const adminEmail = (process.env.ADMIN_EMAILS || '').split(',')[0]?.trim();
const inviteEmail = 'princeboame0@gmail.com';

if (!supabaseUrl || !supabaseKey || !resendKey || !adminEmail) {
  console.error('Missing required env vars. Ensure NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, and ADMIN_EMAILS are set.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const resend = new Resend(resendKey);

(async () => {
  const { data: userList, error: userError } = await supabase.auth.admin.listUsers({ limit: 100 });
  if (userError) throw userError;
  const adminUser = userList?.users?.find((u) => u.email?.toLowerCase() === adminEmail.toLowerCase());
  if (!adminUser) {
    throw new Error(`Admin user not found for ${adminEmail}`);
  }

  const { data: membership, error: membershipError } = await supabase
    .from('team_members')
    .select('team_id')
    .eq('user_id', adminUser.id)
    .limit(1)
    .maybeSingle();
  if (membershipError) throw membershipError;
  if (!membership?.team_id) throw new Error(`No team membership found for admin user ${adminUser.id}`);

  const teamId = membership.team_id;
  const normalizedEmail = inviteEmail.toLowerCase().trim();
  const { data: existingInvite, error: inviteQueryError } = await supabase
    .from('team_invites')
    .select('*')
    .eq('team_id', teamId)
    .eq('email', normalizedEmail)
    .maybeSingle();
  if (inviteQueryError) throw inviteQueryError;

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  let invite;

  if (existingInvite) {
    if (existingInvite.status === 'pending') {
      invite = existingInvite;
      console.log('Re-sending existing pending invite.');
    } else {
      const { data: updatedInvite, error: updateError } = await supabase
        .from('team_invites')
        .update({ token, status: 'pending', expires_at: expiresAt, invited_by: adminUser.id })
        .eq('id', existingInvite.id)
        .select()
        .single();
      if (updateError) throw updateError;
      invite = updatedInvite;
      console.log(`Updated existing invite from status=${existingInvite.status} to pending.`);
    }
  } else {
    const { data: newInvite, error: insertError } = await supabase
      .from('team_invites')
      .insert({ team_id: teamId, email: normalizedEmail, invited_by: adminUser.id, token, status: 'pending', expires_at: expiresAt })
      .select()
      .single();
    if (insertError) throw insertError;
    invite = newInvite;
    console.log('Created new invite.');
  }

  const inviteUrl = `${appUrl}/invite/${invite.token}`;
  const subject = `You're invited to join a team on ActionLoop`;
  const html = `
    <p>Hello,</p>
    <p>You have been invited to join a team on ActionLoop.</p>
    <p><a href="${inviteUrl}">Accept invitation</a></p>
    <p>Expires: ${new Date(invite.expires_at).toLocaleString()}</p>
  `;

  const sendResult = await resend.emails.send({
    from: fromEmail,
    to: normalizedEmail,
    subject,
    html,
  });

  console.log('Send result:', JSON.stringify(sendResult, null, 2));
  console.log('Invite URL:', inviteUrl);
})();
