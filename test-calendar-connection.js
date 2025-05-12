// Test script to verify calendar connection and token

async function main() {
  try {
    console.log('Testing calendar status...');
    const statusResponse = await fetch(
      'http://localhost:3000/api/calendar/status',
    );
    console.log('Status response status:', statusResponse.status);

    try {
      const responseText = await statusResponse.text();
      console.log(
        'Raw response text sample:',
        responseText.substring(0, 100) +
          (responseText.length > 100 ? '...' : ''),
      );

      // Check if the response is HTML
      if (
        responseText.trim().startsWith('<!DOCTYPE') ||
        responseText.trim().startsWith('<html')
      ) {
        console.error(
          'Received HTML response instead of JSON. The server may not be running or authentication is required.',
        );
      } else {
        try {
          const statusData = JSON.parse(responseText);
          console.log('Calendar status:', statusData);
        } catch (jsonError) {
          console.error('Failed to parse JSON:', jsonError.message);
        }
      }
    } catch (textError) {
      console.error('Failed to read response text:', textError);
    }

    console.log('\nTesting calendar token...');
    const tokenResponse = await fetch(
      'http://localhost:3000/api/user-settings/google-calendar-token',
    );
    console.log('Token response status:', tokenResponse.status);

    try {
      const textResponse = await tokenResponse.text();
      console.log(
        'Raw token response:',
        textResponse.substring(0, 100) +
          (textResponse.length > 100 ? '...' : ''),
      );

      if (
        !textResponse.trim().startsWith('<!DOCTYPE') &&
        !textResponse.trim().startsWith('<html')
      ) {
        try {
          const tokenData = JSON.parse(textResponse);
          console.log('Token exists:', !!tokenData.token);
        } catch (e) {
          console.error('Failed to parse token JSON:', e.message);
        }
      } else {
        console.error('Received HTML instead of JSON for token endpoint');
      }
    } catch (e) {
      console.error('Failed to get token response text:', e.message);
    }

    console.log('\nTesting calendar events...');
    const now = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    const timeMin = encodeURIComponent(now.toISOString());
    const timeMax = encodeURIComponent(nextWeek.toISOString());

    const url = `http://localhost:3000/api/calendar/events?timeMin=${timeMin}&timeMax=${timeMax}&maxResults=10`;
    console.log('Request URL:', url);

    const eventsResponse = await fetch(url);
    console.log('Events response status:', eventsResponse.status);

    try {
      const responseText = await eventsResponse.text();
      console.log(
        'Raw events response:',
        responseText.substring(0, 200) +
          (responseText.length > 200 ? '...' : ''),
      );

      if (
        !responseText.trim().startsWith('<!DOCTYPE') &&
        !responseText.trim().startsWith('<html')
      ) {
        try {
          const eventsData = JSON.parse(responseText);
          console.log('Events data:', eventsData);
        } catch (e) {
          console.error('Failed to parse events JSON:', e.message);
        }
      } else {
        console.error('Received HTML instead of JSON for events endpoint');
      }
    } catch (e) {
      console.error('Failed to get events response text:', e.message);
    }
  } catch (error) {
    console.error('Test failed:', error);
  }
}

main().catch(console.error);
