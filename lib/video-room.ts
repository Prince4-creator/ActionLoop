export function getMeetingRoomName(meetingId: string) {
  return `actionloop-meeting-${meetingId}`.replace(/[^a-zA-Z0-9-]/g, '');
}

export function generateAdhocRoomName() {
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  return `actionloop-live-${id}`.replace(/[^a-zA-Z0-9-]/g, '');
}