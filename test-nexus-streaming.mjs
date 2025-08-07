#!/usr/bin/env node

import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function testNexusStreaming() {
  console.log('Testing Nexus mode streaming...\n');

  try {
    // First, we need to get a session (you'll need to be logged in)
    const response = await fetch('http://localhost:3002/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: 'test-chat-' + Date.now(),
        messages: [
          {
            id: 'msg-1',
            role: 'user',
            content: 'How can I implement EOS in my business?',
          },
        ],
        model: 'gpt-4.1-mini',
        researchMode: 'nexus',
      }),
    });

    if (!response.ok) {
      console.error('❌ Request failed:', response.status, response.statusText);
      const text = await response.text();
      console.error('Response:', text);
      return;
    }

    console.log('✅ Got streaming response\n');
    console.log('Reading stream...\n');

    // Read the streaming response
    const reader = response.body;
    let buffer = '';

    reader.on('data', (chunk) => {
      buffer += chunk.toString();

      // Process complete lines
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim()) {
          // Parse different types of streaming data
          if (line.startsWith('0:')) {
            // This is a data chunk
            const content = line.substring(2);
            try {
              const parsed = JSON.parse(content);
              if (parsed.type) {
                console.log(`[${parsed.type}]`, parsed.message || parsed);
              }
            } catch {
              // Not JSON, might be text
              if (content && content !== '""') {
                process.stdout.write(content.replace(/^"|"$/g, ''));
              }
            }
          } else if (line.startsWith('data: ')) {
            // SSE format
            const data = line.substring(6);
            if (data !== '[DONE]') {
              try {
                const parsed = JSON.parse(data);
                console.log('[SSE]', parsed);
              } catch {
                console.log('[SSE Text]', data);
              }
            }
          }
        }
      }
    });

    reader.on('end', () => {
      console.log('\n\n✅ Stream completed');
    });

    reader.on('error', (err) => {
      console.error('❌ Stream error:', err);
    });
  } catch (error) {
    console.error('❌ Error:', error.message || error);
  }
}

testNexusStreaming();
