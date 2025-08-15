import fetch from 'node-fetch';

async function testComposerCreation() {
  console.log('Testing composer creation...');

  try {
    // First, let's test if the API is accessible
    const response = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content:
              'Create a simple text document titled "Test Document" with some sample content about EOS.',
          },
        ],
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
      console.error('Response body:', text);

      if (response.status === 401) {
        console.error(
          '\nAuthentication required. The API needs a valid session.',
        );
        console.error(
          'Please login to the application first at http://localhost:3000/login',
        );
      }
      return;
    }

    // Read the response as text
    const responseText = await response.text();
    console.log('Response:', responseText);

    console.log('Test completed');
  } catch (error) {
    console.error('Error testing composer creation:', error);
  }
}

testComposerCreation();
