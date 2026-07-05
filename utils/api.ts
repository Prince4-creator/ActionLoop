async function handleResponse(response: Response) {
  const text = await response.text();
  let data: any;
  try {
    data = text ? JSON.parse(text) : {};
  } catch (error) {
    throw new Error(`Invalid JSON response from ${response.url}: ${text}`);
  }

  if (!response.ok) {
    const message = data?.error || data?.message || text || `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return data;
}

export async function markActionItemDone(actionItemId: string) {
  return handleResponse(
    await fetch('/api/meetings/action-item/done', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actionItemId }),
    })
  );
}

export async function sendReminders() {
  return handleResponse(
    await fetch('/api/reminders/send', { method: 'POST' })
  );
}

export async function sendReminderForItem(actionItemId: string) {
  return handleResponse(
    await fetch('/api/reminders/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actionItemId }),
    })
  );
}

export async function shareMeetingWithUser(meetingId: string, email: string) {
  return handleResponse(
    await fetch('/api/meetings/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meetingId, email }),
    })
  );
}

export async function inviteTeamMember(teamId: string, email: string) {
  return handleResponse(
    await fetch('/api/team/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamId, email }),
    })
  );
}

export async function getTeamInvites(teamId: string) {
  return handleResponse(
    await fetch(`/api/team/invites?teamId=${encodeURIComponent(teamId)}`)
  );
}

export async function revokeTeamInvite(inviteId: string) {
  return handleResponse(
    await fetch('/api/team/invite/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteId }),
    })
  );
}

export async function acceptTeamInvite(token: string) {
  return handleResponse(
    await fetch('/api/team/invite/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
  );
}

export async function getInviteDetails(token: string) {
  return handleResponse(
    await fetch(`/api/team/invite/details?token=${encodeURIComponent(token)}`)
  );
}

export async function deleteMeeting(meetingId: string) {
  return handleResponse(
    await fetch('/api/meetings/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meetingId }),
    })
  );
}
