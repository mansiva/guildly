'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
      router.push('/dashboard');
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
      router.push('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex flex-col items-center justify-center p-6">
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="text-6xl mb-2">⚡</div>
        <h1 className="text-4xl font-bold text-white">Synergo</h1>
        <p className="text-indigo-100 mt-1">Quest together. Win together.</p>
      </div>

      {/* Card */}
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6">
        {/* Mode toggle */}
        <div className="flex bg-gray-100 rounded-2xl p-1 mb-6">
          <button
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${mode === 'login' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}
            onClick={() => setMode('login')}
          >
            Sign In
          </button>
          <button
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${mode === 'signup' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}
            onClick={() => setMode('signup')}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <input
              type="text"
              placeholder="Your name"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              required
              className="w-full px-4 py-3 bg-gray-50 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-indigo-300"
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="w-full px-4 py-3 bg-gray-50 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-indigo-300"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="w-full px-4 py-3 bg-gray-50 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-indigo-300"
          />
          {error && <p className="text-red-500 text-xs text-center">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-2xl text-sm disabled:opacity-50 active:scale-95 transition-transform"
          >
            {loading ? '...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400">or</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <button
          onClick={handleGoogle}
          disabled={loading}
          className="w-full py-3 border border-gray-200 rounded-2xl text-sm font-medium flex items-center justify-center gap-2 active:scale-95 transition-transform"
        >
          <span>🌐</span> Continue with Google
        </button>
      </div>
    </div>
  );
}
