import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.AUTH_SECRET,
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
          // Lazy import to prevent Firebase init errors from crashing all auth routes
          const { db } = await import('@/lib/firebase-admin');

          const snap = await db
            .collection('users')
            .where('username', '==', (credentials.username as string).toLowerCase())
            .limit(1)
            .get();

          if (snap.empty) return null;

          const doc = snap.docs[0];
          const user = doc.data();

          if (user.status === 'pending') {
            throw new Error('PENDING');
          }

          const valid = await bcrypt.compare(
            credentials.password as string,
            user.password_hash
          );
          if (!valid) return null;

          return {
            id: doc.id,
            name: user.display_name ?? user.username,
            email: user.email ?? undefined,
            role: user.role,
          };
        } catch (err: any) {
          if (err.message === 'PENDING') throw err;
          console.error('[auth] error:', err?.message);
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
