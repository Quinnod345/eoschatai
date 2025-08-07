#!/usr/bin/env node

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function testNexusAPI() {
  const query = 'How to implement EOS in my business';

  console.log('🚀 Testing Nexus Mode via API\n');
  console.log(`Query: "${query}"\n`);

  try {
    const response = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: 'test-nexus-' + Date.now(),
        messages: [
          {
            role: 'user',
            content: query,
            id: 'msg-1',
            parts: [{ type: 'text', text: query }],
            createdAt: new Date(),
          },
        ],
        model: 'gpt-4.1',
        researchMode: 'nexus',
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let eventCount = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.trim() === '') continue;

        // Parse SSE data
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            eventCount++;

            switch (data.type) {
              case 'nexus-progress':
                console.log(`📊 [${data.phase}] ${data.message}`);
                break;
              case 'nexus-plan-complete':
                console.log(`\n✅ Research Plan Created:`);
                console.log(`   Objective: ${data.plan.mainObjective}`);
                console.log(`   Steps: ${data.plan.steps.length}`);
                data.plan.steps.forEach((step) => {
                  console.log(
                    `   - Step ${step.number}: ${step.title} (${step.questionsCount} questions)`,
                  );
                });
                break;
              case 'nexus-search-update':
                console.log(`   🔍 ${data.message}`);
                break;
              case 'nexus-search-complete':
                console.log(
                  `\n✅ Search Complete: ${data.totalResults} results across ${data.stepsCompleted} steps`,
                );
                break;
              case 'nexus-analysis-update':
                console.log(
                  `   🧠 Analyzed Step ${data.stepNumber}: ${data.stepTitle} (${data.findingsCount} findings)`,
                );
                break;
              case 'text':
                if (eventCount === 1) {
                  console.log('\n📝 Final Response:\n');
                }
                process.stdout.write(data.content);
                break;
              case 'nexus-synthesis-complete':
                console.log(
                  `\n\n✅ Synthesis Complete with ${data.citations.length} citations`,
                );
                break;
              case 'nexus-error':
                console.error(`\n❌ Error: ${data.error}`);
                break;
            }
          } catch (e) {
            // Not JSON, might be other SSE data
          }
        }
      }
    }

    console.log('\n\n✨ Test complete!');
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

// Check if server is running
fetch('http://localhost:3000/api/auth/session')
  .then(() => testNexusAPI())
  .catch(() => {
    console.error(
      '❌ Server is not running. Please start the dev server first.',
    );
    process.exit(1);
  });
