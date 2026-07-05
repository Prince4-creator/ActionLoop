import 'dotenv/config';
import { Mistral } from './node_modules/@mistralai/mistralai/esm/index.js';

const mistral = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });
const transcript = 'Alice: We need to finish the billing integration by end of sprint. Bob: I will handle the API work and update the docs. Carol: I will finalize the QA plan by Thursday.';

async function run() {
  try {
    const response = await mistral.chat.complete({
      model: process.env.MISTRAL_MODEL || 'mistral-7b-instruct',
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: 'Extract meeting metadata from transcripts. Return only valid JSON that matches the provided schema.',
        },
        {
          role: 'user',
          content: `Analyze the meeting transcript and extract a concise title, a 1-3 sentence summary, and action items. Use "unassigned@example.com" when assignee details are unclear. Use null for missing due dates.\n\nTranscript:\n${transcript}`,
        },
      ],
      responseFormat: {
        type: 'json_schema',
        jsonSchema: {
          name: 'meeting_extraction',
          description: 'Meeting extraction schema',
          schemaDefinition: {
            type: 'object',
            additionalProperties: false,
            properties: {
              title: { type: 'string' },
              summary: { type: 'string' },
              action_items: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    description: { type: 'string' },
                    assignee_email: { type: 'string' },
                    due_date: { type: ['string', 'null'] },
                  },
                  required: ['description', 'assignee_email', 'due_date'],
                },
              },
            },
            required: ['title', 'summary', 'action_items'],
          },
          strict: true,
        },
      },
    });
    console.log('RESPONSE', JSON.stringify(response, null, 2));
  } catch (err) {
    console.error('ERROR', err);
    if (err && err instanceof Object) {
      try { console.error('ERR JSON', JSON.stringify(err, null, 2)); } catch (_) {}
    }
  }
}

run();
