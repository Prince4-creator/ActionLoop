require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');
const crypto = require('crypto');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const resendKey = process.env.RESEND_API_KEY;
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const toEmail = 'princeboame0@gmail.com';
const adminEmail = (process.env.ADMIN_EMAILS || 'princeboame4@gmail.com').split(',')[0].trim();

(async () => {
  if (!url || !key || !resendKey) {
    console.error('Missing required env vars.');
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    console.log('Admin email:', adminEmail);
    const { data: userList, error: userError } = await supabase.auth.admin.listUsers({ limit: 100 });
    if (userError) throw userError;
    const user = userList?.users?.find((u) => u.email?.toLowerCase() === adminEmail.toLowerCase());
    if (!user) {
      console.error('Admin user not found for email', adminEmail);
      process.exit(1);
    }
    console.log('Found admin user:', user.id, user.email);

    const { data: membership, error: membershipError } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();
    if (membershipError) throw membershipError;
    if (!membership || !membership.team_id) {
      console.error('No team membership found for admin user', user.id);
      process.exit(1);
    }
    const teamId = membership.team_id;
    console.log('Using team id:', teamId);

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: invite, error: inviteError } = await supabase
      .from('team_invites')
      .insert({
        team_id: teamId,
        email: toEmail,
        invited_by: user.id,
        token,
        status: 'pending',
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (inviteError) throw inviteError;
    console.log('Invite created:', invite.id, invite.email, invite.status, invite.expires_at);

    const resend = new Resend(resendKey);
    const inviteUrl = `${appUrl}/invite/${token}`;
    const result = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'ActionLoop <onboarding@resend.dev>',
      to: toEmail,
      subject: `You're invited to join a team on ActionLoop`,
      html: `<p>You have been invited to join a team on ActionLoop.</p><p><a href="${inviteUrl}">Accept invitation</a></p><p>Expires: ${new Date(expiresAt).toLocaleString()}</p>`,
    });
    console.log('Email send result:', result);
    console.log('Invite URL:', inviteUrl);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
})();