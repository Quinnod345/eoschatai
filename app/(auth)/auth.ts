import { compare } from 'bcrypt-ts';
import NextAuth, { type DefaultSession } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import {
  getOrCreateGoogleUser,
  getUser,
  getUserSettings,
} from '@/lib/db/queries';
import { authConfig } from './auth.config';
import { DUMMY_PASSWORD } from '@/lib/server-constants';
import type { DefaultJWT } from 'next-auth/jwt';
import { verifyPassword } from '@/lib/db/utils';
import { createLogger } from '@/lib/utils/secure-logger';

export type UserType = 'guest' | 'regular';

declare module 'next-auth' {
  interface Session extends DefaultSession {
    user: {
      id: string;
      type: UserType;
      profilePicture?: string | null;
    } & DefaultSession['user'];
  }

  interface User {
    id?: string;
    email?: string | null;
    type: UserType;
    profilePicture?: string | null;
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    id: string;
    type: UserType;
    profilePicture?: string | null;
  }
}

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      allowDangerousEmailAccountLinking: true,
    }),
    Credentials({
      credentials: {},
      async authorize({ email, password }: any) {
        const authLogger = createLogger('Auth');

        try {
          // Check if user exists
          const users = await getUser(email);

          if (users.length === 0) {
            authLogger.warn('Login attempt for non-existent user', {
              emailDomain: email.split('@')[1],
            });
            // Use a constant time comparison with dummy password to prevent timing attacks
            await compare(password, DUMMY_PASSWORD);
            return null;
          }

          const [user] = users;

          // Check if the account has a password (e.g., might be Google account only)
          if (!user.password) {
            authLogger.warn('Login attempt for OAuth-only account', {
              emailDomain: email.split('@')[1],
            });
            // Use a constant time comparison with dummy password to prevent timing attacks
            await compare(password, DUMMY_PASSWORD);
            return null;
          }

          // Check if password matches
          const passwordsMatch = verifyPassword(password, user.password);

          if (!passwordsMatch) {
            authLogger.warn('Password mismatch', {
              emailDomain: email.split('@')[1],
            });
            return null;
          }

          // Authentication successful
          authLogger.info('Login successful', {
            userId: user.id,
            emailDomain: email.split('@')[1],
          });

          // Load profile picture from user settings
          let profilePicture: string | null = null;
          try {
            const settings = await getUserSettings({ userId: user.id });
            profilePicture = settings.profilePicture || null;
          } catch (error) {
            console.error(
              'Failed to load user settings for profile picture:',
              error,
            );
          }

          return { ...user, type: 'regular', profilePicture };
        } catch (error) {
          console.error('Authentication error:', error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account, profile }) {
      if (user) {
        token.id = user.id as string;
        token.type = user.type;
        token.profilePicture = user.profilePicture || null;
      }

      // If the user signed in with Google, let's check if they exist in our database
      // If not, we'll create a new user
      if (account && account.provider === 'google' && token.email) {
        const dbUser = await getOrCreateGoogleUser(token.email);
        token.id = dbUser.id;
        token.type = 'regular';

        // Load profile picture from user settings, or use Google profile picture
        try {
          const settings = await getUserSettings({ userId: dbUser.id });
          token.profilePicture =
            settings.profilePicture ||
            (profile?.picture as string | undefined) ||
            null;
        } catch (error) {
          console.error(
            'Failed to load user settings for profile picture:',
            error,
          );
          // Fallback to Google profile picture if available
          token.profilePicture =
            (profile?.picture as string | undefined) || null;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.type = token.type;
        session.user.profilePicture = token.profilePicture || null;
      }

      return session;
    },
  },
});
