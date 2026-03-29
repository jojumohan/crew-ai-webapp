import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import mysql, { RowDataPacket } from 'mysql2/promise';
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
          console.log('[auth] connecting to DB host:', process.env.DB_HOST);
          const conn = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            port: Number(process.env.DB_PORT) || 3306,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
          });

          const [rows] = await conn.execute<RowDataPacket[]>(
            'SELECT id, username, email, password_hash, role, display_name FROM users WHERE username = ? LIMIT 1',
            [credentials.username as string]
          );
          await conn.end();

          console.log('[auth] rows found:', rows.length);
          if (!rows.length) return null;

          const user = rows[0];
          const valid = await bcrypt.compare(
            credentials.password as string,
            user.password_hash
          );
          console.log('[auth] password valid:', valid);
          if (!valid) return null;

          return {
            id: String(user.id),
            name: user.display_name ?? user.username,
            email: user.email ?? undefined,
            role: user.role,
          };
        } catch (err: any) {
          console.error('[auth] error:', err?.message, err?.code);
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
