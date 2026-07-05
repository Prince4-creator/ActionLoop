const fs = require('fs');
const path = 'c:\\Users\\princ\\actionloop\\app\\actions\\meetings.ts';
const text = fs.readFileSync(path, 'utf8');
const oldPhrase = 'Analyze the meeting transcript and extract a concise title, a 1-3 sentence summary, and action items. Use "unassigned@example.com" when assignee details are unclear. Use null for missing due dates.';
const newPhrase = 'Analyze the meeting transcript and extract a concise title, a 1-3 sentence summary, the desired outcome, and action items. Use "unassigned@example.com" when assignee details are unclear. Use null for missing due dates.';
const count = (text.match(new RegExp(oldPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
console.log('matches', count);
if (count === 0) {
  console.error('phrase not found');
  process.exit(1);
}
fs.writeFileSync(path, text.replace(new RegExp(oldPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), newPhrase), 'utf8');
console.log('patched');
