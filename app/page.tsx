'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function RootPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      router.replace(user ? '/dashboard' : '/login');
    }
  }, [user, loading, router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-indigo-50">
      <div className="text-center">
        <div className="text-5xl mb-4">⚡</div>
        <p className="text-indigo-600 font-semibold text-lg">Guildly</p>
        <p className="text-gray-400 text-sm mt-1">Loading...</p>
      </div>
    </div>
  );
}
