// Script to check Google Calendar connection
import { db } from './lib/db/index.js';
import { googleCalendarToken, user } from './lib/db/schema.js';
import { eq } from 'drizzle-orm';

async function checkCalendarConnection() {
  try {
    console.log('Checking database for Google Calendar tokens...');

    // Get all users
    const users = await db.select().from(user);
    console.log(`Found ${users.length} users in database`);

    for (const u of users) {
      console.log(`\nUser: ${u.id} (${u.email})`);
      console.log(
        `Google Calendar Connected flag: ${u.googleCalendarConnected}`,
      );

      // Check for calendar tokens
      const tokens = await db
        .select()
        .from(googleCalendarToken)
        .where(eq(googleCalendarToken.userId, u.id));

      if (tokens.length === 0) {
        console.log('No Google Calendar token found for this user');
      } else {
        console.log(`Found ${tokens.length} token(s)`);
        console.log('Token ID:', tokens[0].id);
        console.log('Token created at:', tokens[0].createdAt);
        console.log('Token updated at:', tokens[0].updatedAt);
        console.log('Token exists and has data:', !!tokens[0].token);

        // Don't print the actual token for security reasons
        const tokenObj = tokens[0].token;
        if (tokenObj) {
          console.log('Token properties:', Object.keys(tokenObj).join(', '));
          console.log('Has refresh token:', !!tokenObj.refresh_token);
          console.log('Has access token:', !!tokenObj.access_token);
          console.log(
            'Token expiry:',
            new Date(tokenObj.expiry_date).toISOString(),
          );
        }
      }
    }

    console.log('\nDone checking Google Calendar connections');
  } catch (error) {
    console.error('Error checking calendar connection:', error);
  } finally {
    process.exit(0);
  }
}

checkCalendarConnection();
