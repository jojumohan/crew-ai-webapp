'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
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
      if (response.error === 'CallbackRouteError') {
        setError('Your account is still pending approval.');
      } else {
        setError('That username and password did not match.');
      }
      return;
    }

    router.push('/dashboard');
  }

  return (
    <main className={styles.main}>
      <section className={styles.panel}>
        <div className={styles.introCard}>
          <p className={styles.eyebrow}>Messaging rebuild</p>
          <h1>Sign in to the new chat workspace.</h1>
          <p className={styles.copy}>
            This login keeps the current auth flow while the product is rebuilt around
            direct messaging, groups, media uploads, and calling.
          </p>

          <div className={styles.featureList}>
            <article>
              <strong>Phase 1</strong>
              <span>Auth, 1-on-1 chat, uploads, message history, presence</span>
            </article>
            <article>
              <strong>Phase 2</strong>
              <span>Group chats, typing, read receipts, last seen</span>
            </article>
            <article>
              <strong>Phase 3</strong>
              <span>Voice and video calls, push notifications, devices</span>
            </article>
          </div>
        </div>

        <div className={styles.formCard}>
          <div className={styles.formHeader}>
            <div className={styles.badge}>W</div>
            <div>
              <p className={styles.eyebrow}>Secure access</p>
              <h2>Welcome back</h2>
            </div>
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
              {loading ? 'Signing in...' : 'Enter workspace'}
            </button>
          </form>

          <p className={styles.footnote}>
            Current build uses the existing credentials flow while the new chat backend is being wired in.
          </p>
        </div>
      </section>
    </main>
  );
}
