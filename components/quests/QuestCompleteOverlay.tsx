'use client';

import { useEffect, useRef, useState } from 'react';
import { Trophy, Zap, Star } from 'lucide-react';
import UserAvatar from '@/components/ui/UserAvatar';

interface ContribEntry {
  uid: string;
  displayName: string;
  photoURL?: string;
  xp: number;
  contributed: number;   // raw value
  pct: number;           // 0–100
  xpEarned: number;
  isTop: boolean;
  isMe: boolean;
}

interface Props {
  questTitle: string;
  unit: string;
  targetValue: number;
  totalXp: number;
  contributions: ContribEntry[];
  onDismiss: () => void;
}

// ── Confetti particle ─────────────────────────────────────────────────────────
const COLORS = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#3b82f6'];

interface Particle {
  x: number; y: number; vx: number; vy: number;
  color: string; size: number; angle: number; spin: number; life: number;
}

function makeParticles(count: number): Particle[] {
  return Array.from({ length: count }, () => ({
    x: Math.random() * window.innerWidth,
    y: -10 - Math.random() * 100,
    vx: (Math.random() - 0.5) * 4,
    vy: 2 + Math.random() * 4,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    size: 6 + Math.random() * 8,
    angle: Math.random() * 360,
    spin: (Math.random() - 0.5) * 8,
    life: 1,
  }));
}

function Confetti() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);
  const raf = useRef<number>(0);

  useEffect(() => {
    particles.current = makeParticles(120);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    function draw() {
      ctx.clearRect(0, 0, canvas!.width, canvas!.height);
      particles.current = particles.current.filter(p => p.life > 0.05);
      for (const p of particles.current) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.angle * Math.PI) / 180);
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.08;
        p.angle += p.spin;
        p.life -= 0.008;
      }
      if (particles.current.length > 0) {
        raf.current = requestAnimationFrame(draw);
      }
    }
    raf.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf.current);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[60]"
      style={{ width: '100vw', height: '100vh' }}
    />
  );
}

// ── Main overlay ──────────────────────────────────────────────────────────────
export default function QuestCompleteOverlay({
  questTitle, unit, targetValue, totalXp, contributions, onDismiss,
}: Props) {
  const [visible, setVisible] = useState(false);
  const me = contributions.find(c => c.isMe);
  const top = contributions.find(c => c.isTop);
  const sorted = [...contributions].sort((a, b) => b.pct - a.pct);

  // Entrance animation
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  function handleDismiss() {
    setVisible(false);
    setTimeout(onDismiss, 300);
  }

  const medal = (i: number) => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;

  return (
    <>
      <Confetti />

      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/60 z-50 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleDismiss}
      />

      {/* Card */}
      <div
        className={`fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] z-50 transition-transform duration-300 ${
          visible ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="bg-white rounded-t-3xl overflow-hidden">
          {/* Hero */}
          <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 px-6 pt-8 pb-6 text-center">
            <div className="text-6xl mb-3 animate-bounce">🏆</div>
            <h1 className="text-2xl font-black text-white mb-1">Quest Complete!</h1>
            <p className="text-indigo-100 text-sm font-medium">{questTitle}</p>
            <div className="flex items-center justify-center gap-2 mt-3">
              <div className="flex items-center gap-1 bg-white/20 rounded-full px-3 py-1">
                <Zap size={14} className="text-yellow-300" />
                <span className="text-white font-bold text-sm">{totalXp} XP pool</span>
              </div>
              <div className="flex items-center gap-1 bg-white/20 rounded-full px-3 py-1">
                <Star size={14} className="text-yellow-300" />
                <span className="text-white font-bold text-sm">{targetValue} {unit} total</span>
              </div>
            </div>
          </div>

          {/* My result callout */}
          {me && (
            <div className={`mx-4 mt-4 rounded-2xl px-4 py-3 flex items-center gap-3 ${
              me.isTop ? 'bg-amber-50 border border-amber-200' : 'bg-indigo-50 border border-indigo-100'
            }`}>
              <div className="text-2xl">{me.isTop ? '👑' : '⚡'}</div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-bold ${me.isTop ? 'text-amber-800' : 'text-indigo-700'}`}>
                  {me.isTop ? "You led the way! Top contributor 👑" : `You contributed ${me.pct}%`}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  +{me.xpEarned} XP{me.isTop ? ' (includes 10% top contributor bonus)' : ''}
                </p>
              </div>
            </div>
          )}

          {/* Rankings */}
          <div className="px-4 mt-4 mb-2">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Final Rankings</p>
            <div className="bg-gray-50 rounded-2xl overflow-hidden">
              {sorted.map((c, i) => (
                <div
                  key={c.uid}
                  className={`flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 last:border-0 ${
                    c.isMe ? 'bg-indigo-50/60' : ''
                  }`}
                >
                  <div className="w-7 text-center shrink-0">
                    {medal(i)
                      ? <span className="text-lg">{medal(i)}</span>
                      : <span className="text-sm font-bold text-gray-300">{i + 1}</span>}
                  </div>
                  <UserAvatar
                    photoURL={c.photoURL}
                    displayName={c.displayName}
                    xp={c.xp}
                    size="sm"
                    showLevel={false}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-sm font-semibold truncate ${c.isMe ? 'text-indigo-700' : 'text-gray-900'}`}>
                        {c.isMe ? 'You' : c.displayName}
                      </span>
                      {c.isTop && <span className="text-xs">👑</span>}
                    </div>
                    {/* Contribution bar */}
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 rounded-full transition-all duration-700"
                          style={{ width: `${c.pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 shrink-0">{c.pct}%</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-bold text-indigo-600">+{c.xpEarned} XP</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Dismiss */}
          <div className="px-4 pb-10 pt-3">
            <button
              onClick={handleDismiss}
              className="w-full py-4 bg-indigo-600 text-white font-bold rounded-2xl active:scale-95 transition-transform text-base"
            >
              Awesome! 🎉
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
