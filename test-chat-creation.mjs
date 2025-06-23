import fetch from 'node-fetch';

async function testChatCreation() {
  console.log('Testing chat creation...');

  try {
    // First, get a session by making a test request
    const response = await fetch(
      'http://localhost:3000/api/voice/recordings/send-to-chat',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // You might need to add auth cookies here
        },
        body: JSON.stringify({
          transcript: 'This is a test transcript for debugging.',
          speakers: 1,
          segments: [
            { speaker: 1, text: 'This is a test transcript for debugging.' },
          ],
        }),
      },
    );

    const data = await response.json();
    console.log('Response:', data);

    if (data.chatId) {
      console.log('Chat created with ID:', data.chatId);

      // Now try to fetch the chat
      const verifyResponse = await fetch(
        `http://localhost:3000/api/chat/${data.chatId}/verify`,
      );
      const verifyData = await verifyResponse.json();
      console.log('Verification result:', verifyData);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testChatCreation();
