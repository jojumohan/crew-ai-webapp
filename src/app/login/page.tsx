'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from './login.module.css';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);

    const form = event.currentTarget;
    const username = (form.elements.namedItem('username') as HTMLInputElement).value;
    const password = (form.elements.namedItem('password') as HTMLInputElement).value;

    const response = await signIn('credentials', {
      username,
      password,
      redirect: false,
    });

    setLoading(false);

    if (response?.error) {
      setError(
        response.error === 'CallbackRouteError'
          ? 'Your account is still pending approval.'
          : 'That username and password did not match.'
      );
      return;
    }

    router.push('/dashboard');
  }

  return (
    <main className={styles.main}>
      <section className={styles.panel}>
        <div className={styles.card}>
          <div className={styles.header}>
            <div className={styles.logo}>W</div>
            <h1>Welcome Back</h1>
            <p>Sign in to continue to WhatsApp Web.</p>
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.field}>
              <label htmlFor="username">Username</label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                placeholder="Enter your username"
                required
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="password">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                required
              />
            </div>

            {error ? <p className={styles.error}>{error}</p> : null}

            <button type="submit" className={styles.button} disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <p className={styles.switch}>
            Need an account? <Link href="/register">Request access</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
