import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;

        try {
          const { db } = await import('@/db');
          const { users } = await import('@/db/schema');
          const { eq } = await import('drizzle-orm');

          const [user] = await db
            .select()
            .from(users)
            .where(eq(users.username, credentials.username as string))
            .limit(1);

          if (!user) return null;

          const valid = await bcrypt.compare(
            credentials.password as string,
            user.passwordHash
          );

          if (!valid) return null;

          return {
            id: String(user.id),
            name: user.displayName ?? user.username,
            email: user.email ?? undefined,
            role: user.role,
          };
        } catch (err) {
          console.error('[auth] DB error:', err);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.role = (user as { role?: string }).role;
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { role?: string }).role = token.role as string;
        session.user.id = token.sub!;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
});
