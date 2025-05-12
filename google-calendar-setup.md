# Fixing Google Calendar OAuth Integration

You're encountering the error:
> "You can't sign in to this app because it doesn't comply with Google's OAuth 2.0 policy for keeping apps secure."

## Steps to Fix:

### 1. Update Environment Variables

Add to your `.env.local` file:
```
NEXT_PUBLIC_BASE_URL="http://localhost:3000"
```

### 2. Configure Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Select your project (project-1049075599545)
3. Go to "OAuth consent screen" tab and:
   - Set User Type to "External" (if not in production)
   - Add a proper app name, user support email, and developer contact information 
   - Add your application homepage (http://localhost:3000 for development)
   - Add authorized domains including `localhost` for development
   - In the "Scopes" section, add:
     - `https://www.googleapis.com/auth/calendar`
     - `https://www.googleapis.com/auth/calendar.events`
   - Save changes

4. Go to "Credentials" tab:
   - Edit your OAuth 2.0 Client ID
   - Under "Authorized JavaScript origins", add:
     - `http://localhost:3000`
   - Under "Authorized redirect URIs", add:
     - `http://localhost:3000/api/calendar/auth/callback`
   - Save changes

5. Enable required APIs:
   - Go to "APIs & Services" > "Library"
   - Search for and enable:
     - Google Calendar API

### 3. Testing the Integration

After making these changes:

1. Restart your development server:
   ```
   npm run dev
   ```

2. Visit the test page to verify the integration:
   ```
   http://localhost:3000/calendar-test.html
   ```

3. Click "Connect Calendar" and follow the Google authentication process.

4. After successful authentication, you should be redirected back to the test page with a success message.

### Fixing Common Issues:

#### "Error: redirect_uri_mismatch"
- Ensure the redirect URI in your Google Cloud Console exactly matches:
  ```
  http://localhost:3000/api/calendar/auth/callback
  ```
- Check for typos or missing/extra slashes

#### "Invalid client" or "unauthorized_client"
- Verify your Client ID and Client Secret in `.env.local`
- Make sure you're using the correct project in Google Cloud Console

#### "Error 400: invalid_request"
- Check that your OAuth consent screen is properly configured
- Ensure all required fields are filled out
- Verify that you've added the necessary scopes

#### "Access blocked: This app's request is invalid"
- Enable the Google Calendar API in the API Library
- Ensure the OAuth consent screen has been properly configured

### Debugging Tools:

If you're still having issues, check the server logs for more detailed error information. You can also use the Network tab in Chrome DevTools to inspect the OAuth requests and responses.

For additional help, refer to the [Google Identity OAuth 2.0 documentation](https://developers.google.com/identity/protocols/oauth2).

### 4. Publishing Requirements

If you're moving to production, note that Google requires verification for apps that request sensitive scopes. You'll need to:
1. Verify your domain ownership
2. Complete the OAuth verification process
3. Provide a privacy policy URL

### 5. Testing

After making these changes:
1. Restart your development server
2. Try the Google Calendar integration again

### Common Issues:

- **Mismatched URIs**: The redirect URI in your code must exactly match what's in Google Cloud Console
- **Missing scopes**: Calendar access requires the proper scopes to be configured
- **localhost restrictions**: For development, make sure you've added localhost as a JavaScript origin
- **API not enabled**: The Google Calendar API must be enabled for your project 