function formatIcsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function escapeIcsText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

export function buildActionItemIcs({
  uid,
  title,
  description,
  dueDate,
  url,
}: {
  uid: string;
  title: string;
  description: string;
  dueDate: string; // ISO date string, e.g. "2026-07-25"
  url: string;
}): string {
  const due = new Date(`${dueDate}T09:00:00Z`);
  const end = new Date(due.getTime() + 30 * 60 * 1000);
  const now = formatIcsDate(new Date());

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ActionLoop//Reminder//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}@actionloop.app`,
    `DTSTAMP:${now}`,
    `DTSTART:${formatIcsDate(due)}`,
    `DTEND:${formatIcsDate(end)}`,
    `SUMMARY:${escapeIcsText(title)}`,
    `DESCRIPTION:${escapeIcsText(description)}\\n\\n${escapeIcsText(url)}`,
    `URL:${escapeIcsText(url)}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}