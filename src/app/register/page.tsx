'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from '../login/login.module.css';

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);

    const form = event.currentTarget;
    const username = (form.elements.namedItem('username') as HTMLInputElement).value;
    const display_name = (form.elements.namedItem('display_name') as HTMLInputElement).value;
    const email = (form.elements.namedItem('email') as HTMLInputElement).value;
    const password = (form.elements.namedItem('password') as HTMLInputElement).value;

    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, display_name, email, password }),
    });

    const data = (await response.json()) as { ok?: boolean; error?: string };
    setLoading(false);

    if (data.ok) {
      setSuccess(true);
      return;
    }

    setError(data.error || 'Registration failed');
  }

  return (
    <main className={styles.main}>
      <section className={styles.panel}>
        <div className={styles.card}>
          <div className={styles.header}>
            <div className={styles.logo}>{success ? '✓' : 'W'}</div>
            <h1>{success ? 'Request Sent' : 'Welcome'}</h1>
            <p>
              {success
                ? 'Your account is pending admin approval.'
                : 'Request access to join the workspace.'}
            </p>
          </div>

          {success ? (
            <>
              <button className={styles.btn} onClick={() => router.push('/login')}>
                Back to login
              </button>
              <p className={styles.switch}>
                You can sign in after an admin approves the request.
              </p>
            </>
          ) : (
            <>
              <form onSubmit={handleSubmit} className={styles.form}>
                <div className={styles.field}>
                  <label htmlFor="display_name">Full name</label>
                  <input id="display_name" name="display_name" type="text" placeholder="Full name" required />
                </div>
                <div className={styles.field}>
                  <label htmlFor="username">Username</label>
                  <input id="username" name="username" type="text" placeholder="Username" required />
                </div>
                <div className={styles.field}>
                  <label htmlFor="email">Email</label>
                  <input id="email" name="email" type="email" placeholder="Email address" />
                </div>
                <div className={styles.field}>
                  <label htmlFor="password">Password</label>
                  <input id="password" name="password" type="password" placeholder="Minimum 6 characters" required />
                </div>

                {error ? <p className={styles.error}>{error}</p> : null}

                <button type="submit" className={styles.btn} disabled={loading}>
                  {loading ? 'Submitting...' : 'Request access'}
                </button>
              </form>

              <p className={styles.switch}>
                Already have an account? <Link href="/login">Sign in</Link>
              </p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
