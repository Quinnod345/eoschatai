import { addSuggestion } from '@/lib/redis/autocomplete';

const SEED: Array<{ text: string; score: number }> = [
  { text: 'What are my Level 10 meeting headlines today?', score: 100 },
  { text: 'Show my EOS Scorecard metrics for this week', score: 95 },
  { text: 'Help me prepare for our EOS quarterly planning session', score: 90 },
  { text: 'Summarize the issues list from our last Level 10', score: 85 },
  { text: 'Draft a follow-up for the IDS topics we resolved', score: 80 },
  { text: 'Outline next steps for the EOS implementation roadmap', score: 75 },
  { text: 'Analyze accountability gaps from the People Analyzer', score: 70 },
  { text: 'Find available time for a leadership meeting next week', score: 68 },
  { text: 'Create a rock for increasing weekly qualified leads', score: 66 },
  { text: 'What measurables are off track this week?', score: 64 },
];

async function main() {
  for (const { text, score } of SEED) {
    await addSuggestion(text, score, false);
    console.log('Added', text);
  }
  console.log('Seeding complete');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
