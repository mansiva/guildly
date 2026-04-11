'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';

function LoginForm() {
  const { signIn, signUp, signInWithGoogle, user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/dashboard';
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && user) router.replace(redirect);
  }, [user, authLoading, router, redirect]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await signIn(email, password);
      } else {
        await signUp(email, password, displayName);
      }
      router.push(redirect);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError('');
    setLoading(true);
    try {
      await signInWithGoogle();
      router.push(redirect);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6">
      {/* Google — primary CTA */}
      <button onClick={handleGoogle} disabled={loading}
        className="w-full py-4 bg-indigo-600 text-white font-semibold rounded-2xl text-sm flex items-center justify-center gap-3 active:scale-95 transition-transform shadow-lg shadow-indigo-200 mb-4">
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" opacity=".7"/>
          <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" opacity=".4"/>
          <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" opacity=".55"/>
        </svg>
        Continue with Google
      </button>

      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-xs text-gray-400">or use email</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      <div className="flex bg-gray-100 rounded-2xl p-1 mb-4">
        <button className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${mode === 'login' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}
          onClick={() => setMode('login')}>Sign In</button>
        <button className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${mode === 'signup' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}
          onClick={() => setMode('signup')}>Sign Up</button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {mode === 'signup' && (
          <input type="text" placeholder="Your name" value={displayName} onChange={e => setDisplayName(e.target.value)} required
            className="w-full px-4 py-3 bg-gray-50 text-gray-900 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-indigo-300" />
        )}
        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required
          className="w-full px-4 py-3 bg-gray-50 text-gray-900 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-indigo-300" />
        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required
          className="w-full px-4 py-3 bg-gray-50 text-gray-900 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-indigo-300" />
        {error && <p className="text-red-500 text-xs text-center">{error}</p>}
        <button type="submit" disabled={loading}
          className="w-full py-3 border border-indigo-200 text-indigo-600 font-semibold rounded-2xl text-sm disabled:opacity-50 active:scale-95 transition-transform">
          {loading ? '...' : mode === 'login' ? 'Sign In with Email' : 'Create Account'}
        </button>
      </form>

      {mode === 'signup' && (
        <p className="text-xs text-gray-400 text-center mt-3">
          Email sign-up requires your admin to enable it in Firebase.
        </p>
      )}

      <p className="text-xs text-gray-400 text-center mt-5">
        By continuing, you agree to our{' '}
        <a href="/terms" className="text-indigo-500 underline">Terms of Service</a>
        {' '}and{' '}
        <a href="/privacy" className="text-indigo-500 underline">Privacy Policy</a>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex flex-col items-center justify-center p-6">
      <div className="text-center mb-8">
        <Image src="/logo.png" alt="Guildly" width={96} height={96} className="mx-auto mb-3 drop-shadow-xl" />
        <h1 className="text-4xl font-bold text-white">Guildly</h1>
        <p className="text-indigo-100 mt-1">Quest together. Level up together.</p>
      </div>
      <Suspense fallback={<div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 flex items-center justify-center h-64"><div className="text-4xl animate-pulse">⚡</div></div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
