'use client';
import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuthStore, AuthUser } from '@/store/authStore';

export default function RegisterForm() {
  const router = useRouter(); const setAuth = useAuthStore((s) => s.setAuth);
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  async function handleSubmit(e: FormEvent) {
    e.preventDefault(); setError(''); setLoading(true);
    try { const { user, token } = await api.post<{ user: AuthUser; token: string }>('/api/auth/register', { email, password, displayName: name }); setAuth(user, token); router.replace('/chat'); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'Registration failed'); }
    finally { setLoading(false); }
  }
  return (
    <form onSubmit={handleSubmit} className="bg-wa-panel rounded-xl p-6 space-y-4">
      {error && <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-lg px-4 py-3 text-sm">{error}</div>}
      <div><label className="block text-sm text-wa-muted mb-1.5">Display Name</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} required maxLength={50} placeholder="Your name" className="w-full bg-wa-hover border border-transparent focus:border-wa-green rounded-lg px-4 py-2.5 text-wa-text placeholder-wa-muted outline-none transition-colors" /></div>
      <div><label className="block text-sm text-wa-muted mb-1.5">Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" className="w-full bg-wa-hover border border-transparent focus:border-wa-green rounded-lg px-4 py-2.5 text-wa-text placeholder-wa-muted outline-none transition-colors" /></div>
      <div><label className="block text-sm text-wa-muted mb-1.5">Password</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} placeholder="Min 8 characters" className="w-full bg-wa-hover border border-transparent focus:border-wa-green rounded-lg px-4 py-2.5 text-wa-text placeholder-wa-muted outline-none transition-colors" /></div>
      <button type="submit" disabled={loading} className="w-full bg-wa-green hover:bg-green-500 disabled:opacity-50 text-white font-semibold rounded-lg py-2.5 transition-colors">{loading ? 'Creating…' : 'Create Account'}</button>
      <p className="text-center text-sm text-wa-muted">Have an account? <Link href="/login" className="text-wa-green hover:underline">Sign in</Link></p>
    </form>
  );
}
