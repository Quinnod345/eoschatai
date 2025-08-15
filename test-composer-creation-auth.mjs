import fetch from 'node-fetch';

async function testComposerCreationWithAuth() {
  console.log('Testing composer creation with authentication...');

  try {
    // First, we need to get a session cookie by logging in
    // For testing, we'll use a direct API call with proper headers
    const response = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add any necessary authentication headers
        Cookie: 'next-auth.session-token=your-session-token-here', // You'll need to get this from your browser
      },
      body: JSON.stringify({
        id: `test-chat-${Date.now()}`,
        message: {
          id: `msg-${Date.now()}`,
          role: 'user',
          content:
            'Create a simple text document titled "Test Document" with some sample content about EOS.',
          parts: [
            'Create a simple text document titled "Test Document" with some sample content about EOS.',
          ],
        },
        selectedChatModel: 'gpt-4.1',
        selectedVisibilityType: 'private',
        selectedProvider: 'openai',
      }),
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', response.headers);

    if (!response.ok) {
      console.error(
        'API request failed:',
        response.status,
        response.statusText,
      );
      const text = await response.text();
      console.error('Response body:', `${text.substring(0, 500)}...`);

      if (response.status === 401 || response.status === 200) {
        console.error('\n=== AUTHENTICATION REQUIRED ===');
        console.error('The API requires authentication. Please:');
        console.error('1. Open http://localhost:3000 in your browser');
        console.error('2. Log in to the application');
        console.error('3. Open Developer Tools (F12)');
        console.error('4. Go to Application/Storage > Cookies');
        console.error('5. Find the "next-auth.session-token" cookie');
        console.error(
          '6. Copy its value and replace "your-session-token-here" in this script',
        );
        console.error('7. Run this script again');
      }
      return;
    }

    // Read the streaming response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let result = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      result += chunk;

      // Log each chunk as it arrives
      console.log('Received chunk:', chunk);
    }

    console.log('\nFull response:', result);
    console.log('\nTest completed successfully!');
  } catch (error) {
    console.error('Error testing composer creation:', error);
  }
}

// Instructions for getting the session token
console.log('=== ARTIFACT CREATION TEST ===\n');
console.log('This test requires authentication.');
console.log("If you haven't logged in yet, please:");
console.log('1. Open http://localhost:3000 in your browser');
console.log('2. Log in to the application');
console.log('3. Get the session token as described in the error message\n');

testComposerCreationWithAuth();
