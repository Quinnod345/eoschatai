import { compare } from 'bcrypt-ts';
import NextAuth, { type DefaultSession } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { getOrCreateGoogleUser, getUser } from '@/lib/db/queries';
import { authConfig } from './auth.config';
import { DUMMY_PASSWORD } from '@/lib/server-constants';
import type { DefaultJWT } from 'next-auth/jwt';
import { verifyPassword } from '@/lib/db/utils';

export type UserType = 'guest' | 'regular';

declare module 'next-auth' {
  interface Session extends DefaultSession {
    user: {
      id: string;
      type: UserType;
    } & DefaultSession['user'];
  }

  interface User {
    id?: string;
    email?: string | null;
    type: UserType;
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    id: string;
    type: UserType;
  }
}

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    }),
    Credentials({
      credentials: {},
      async authorize({ email, password }: any) {
        try {
          // Check if user exists
          const users = await getUser(email);

          if (users.length === 0) {
            console.log(`Login attempt: User with email ${email} not found`);
            // Use a constant time comparison with dummy password to prevent timing attacks
            await compare(password, DUMMY_PASSWORD);
            return null;
          }

          const [user] = users;

          // Check if the account has a password (e.g., might be Google account only)
          if (!user.password) {
            console.log(
              `Login attempt: User ${email} exists but has no password (OAuth user)`,
            );
            // Use a constant time comparison with dummy password to prevent timing attacks
            await compare(password, DUMMY_PASSWORD);
            return null;
          }

          // Check if password matches
          const passwordsMatch = verifyPassword(password, user.password);

          if (!passwordsMatch) {
            console.log(`Login attempt: Password mismatch for user ${email}`);
            return null;
          }

          // Authentication successful
          console.log(`Login successful: User ${email} authenticated`);
          return { ...user, type: 'regular' };
        } catch (error) {
          console.error('Authentication error:', error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id as string;
        token.type = user.type;
      }

      // If the user signed in with Google, let's check if they exist in our database
      // If not, we'll create a new user
      if (account && account.provider === 'google' && token.email) {
        const user = await getOrCreateGoogleUser(token.email);
        token.id = user.id;
        token.type = 'regular';
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.type = token.type;
      }

      return session;
    },
  },
});
