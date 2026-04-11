'use client';

import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">

      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4">
        <span className="text-white font-bold text-xl">⚡ Guildly</span>
        <Link href="/login"
          className="px-4 py-2 bg-white/20 text-white text-sm font-semibold rounded-full backdrop-blur-sm hover:bg-white/30 transition-colors">
          Sign In
        </Link>
      </nav>

      {/* Hero */}
      <div className="flex flex-col items-center text-center px-6 pt-12 pb-16">
        <div className="text-7xl mb-6">⚡</div>
        <h1 className="text-4xl font-extrabold text-white leading-tight mb-4">
          Quest together.<br />Level up together.
        </h1>
        <p className="text-indigo-100 text-lg max-w-sm mb-8">
          Guildly turns your group's goals into shared quests — with XP, badges, and a live feed to keep everyone moving.
        </p>
        <Link href="/login"
          className="px-8 py-4 bg-white text-indigo-600 font-bold rounded-2xl text-base shadow-xl active:scale-95 transition-transform">
          Get Started — It's Free
        </Link>
      </div>

      {/* Features */}
      <div className="bg-white rounded-t-3xl px-6 pt-10 pb-16">
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">How it works</h2>
        <div className="space-y-6 max-w-sm mx-auto">
          {[
            { emoji: '👥', title: 'Create a Group', desc: 'Invite friends, family, or colleagues with a simple 6-character code. No email required.' },
            { emoji: '🎯', title: 'Launch Quests', desc: 'Pick from 16+ quest templates or build your own — steps, chapters, sessions, anything.' },
            { emoji: '⚡', title: 'Log Progress Together', desc: 'Everyone contributes to the same target. Every log fuels the group forward.' },
            { emoji: '🏆', title: 'Earn XP & Badges', desc: 'Complete quests to earn XP, level up, and unlock badges — individually and as a group.' },
          ].map(({ emoji, title, desc }) => (
            <div key={title} className="flex items-start gap-4">
              <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-2xl shrink-0">
                {emoji}
              </div>
              <div>
                <h3 className="font-bold text-gray-900">{title}</h3>
                <p className="text-sm text-gray-500 mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Quest categories */}
        <div className="mt-12 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Quest categories</h2>
          <p className="text-gray-500 text-sm mb-6">From fitness to creativity — there's a quest for every group.</p>
          <div className="flex flex-wrap justify-center gap-3">
            {[
              { emoji: '👟', label: 'Exercise' },
              { emoji: '📚', label: 'Learning' },
              { emoji: '🎨', label: 'Art' },
              { emoji: '🎵', label: 'Music' },
              { emoji: '🧘', label: 'Wellness' },
              { emoji: '❤️', label: 'Social' },
              { emoji: '✨', label: 'Custom' },
            ].map(({ emoji, label }) => (
              <span key={label} className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-full text-sm font-semibold">
                {emoji} {label}
              </span>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-12 text-center">
          <Link href="/login"
            className="inline-block px-8 py-4 bg-indigo-600 text-white font-bold rounded-2xl text-base shadow-lg active:scale-95 transition-transform">
            Start Your First Quest →
          </Link>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-gray-100 text-center space-y-2">
          <p className="text-xs text-gray-400">© {new Date().getFullYear()} Guildly. All rights reserved.</p>
          <div className="flex justify-center gap-4 text-xs">
            <Link href="/privacy" className="text-indigo-500 underline">Privacy Policy</Link>
            <Link href="/terms" className="text-indigo-500 underline">Terms of Service</Link>
          </div>
        </div>
      </div>

    </div>
  );
}
