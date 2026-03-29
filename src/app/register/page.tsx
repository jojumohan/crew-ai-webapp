'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../login/login.module.css';

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const form = e.currentTarget;
    const username     = (form.elements.namedItem('username') as HTMLInputElement).value;
    const display_name = (form.elements.namedItem('display_name') as HTMLInputElement).value;
    const email        = (form.elements.namedItem('email') as HTMLInputElement).value;
    const password     = (form.elements.namedItem('password') as HTMLInputElement).value;

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, display_name, email, password }),
    });
    const data = await res.json();
    setLoading(false);

    if (data.ok) {
      setSuccess(true);
    } else {
      setError(data.error || 'Registration failed');
    }
  }

  if (success) {
    return (
      <main className={styles.main}>
        <div className={styles.card + ' glass'}>
          <div className={styles.header}>
            <div className={styles.logo}>✅</div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#10b981' }}>Request Sent!</h1>
            <p>Your account is pending admin approval.<br />You'll be able to log in once approved.</p>
          </div>
          <button className={styles.btn} onClick={() => router.push('/login')}>
            Back to Login
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.main}>
      <div className={styles.card + ' glass'}>
        <div className={styles.header}>
          <div className={styles.logo}>⚡️</div>
          <h1>Join Aronlabz Teams</h1>
          <p>Request access — admin will approve your account</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="display_name">Full Name</label>
            <input id="display_name" name="display_name" type="text" required placeholder="e.g. Arun Kumar" />
          </div>
          <div className={styles.field}>
            <label htmlFor="username">Username</label>
            <input id="username" name="username" type="text" required placeholder="e.g. arun" autoComplete="username" />
          </div>
          <div className={styles.field}>
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" placeholder="arun@example.com" autoComplete="email" />
          </div>
          <div className={styles.field}>
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" required placeholder="Min 6 characters" autoComplete="new-password" />
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button type="submit" className={styles.btn} disabled={loading}>
            {loading ? 'Submitting…' : 'Request Access'}
          </button>

          <p style={{ textAlign: 'center', fontSize: '0.85rem', opacity: 0.5 }}>
            Already have an account?{' '}
            <a href="/login" style={{ color: 'var(--primary)' }}>Sign in</a>
          </p>
        </form>
      </div>
    </main>
  );
}
