'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';

const PILLARS = [
  {
    icon: '⬡',
    title: 'Epistemic State Modeling',
    subtitle: 'Bartlett (1932) · Piaget',
    description:
      "AEGIS constructs a dynamic cognitive map of what you understand, where your reasoning breaks down, and which prerequisites you're missing — updated in real time through Socratic dialogue.",
    color: '#00FF85',
  },
  {
    icon: '◈',
    title: 'Temporal Memory Decay',
    subtitle: 'Ebbinghaus (1885) · SM-2',
    description:
      'Knowledge erodes over time following the Ebbinghaus forgetting curve R(t) = e^{−t/S}. AEGIS tracks stability per concept and schedules targeted reviews before you forget.',
    color: '#38BDF8',
  },
  {
    icon: '◎',
    title: 'Cognitive DNA Adaptation',
    subtitle: 'Kolb · Gardner',
    description:
      'Every student thinks differently. AEGIS continuously infers your learning style — visual, abstract, example-first, analogy-driven — and dynamically rewires how the AI explains concepts to you.',
    color: '#A78BFA',
  },
];

const AGENTS = [
  { type: 'PROBE', icon: '🔍', color: '#00FF85', desc: 'Socratic questioning to surface gaps' },
  { type: 'HINT', icon: '💡', color: '#FFB347', desc: '5-level progressive scaffolding' },
  { type: 'REPAIR', icon: '🔧', color: '#FF4D6D', desc: 'Targeted misconception correction' },
  { type: 'CHALLENGE', icon: '⚡', color: '#A78BFA', desc: 'Mastery probing via trap problems' },
  { type: 'META', icon: '🧠', color: '#38BDF8', desc: 'Metacognitive learning insights' },
];

export default function LandingPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', topic: '', goal: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeParticles, setActiveParticles] = useState<Array<{ id: number; x: number; y: number }>>([]);

  // Generate floating particles on mount
  useEffect(() => {
    const particles = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
    }));
    setActiveParticles(particles);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.topic.trim() || !form.goal.trim()) {
      setError('All fields are required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (!res.ok) throw new Error('Failed to create student');

      const data = await res.json() as { id: string };
      router.push(`/learn/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary relative overflow-hidden">
      {/* Floating particles */}
      {activeParticles.map(p => (
        <motion.div
          key={p.id}
          className="absolute w-1 h-1 rounded-full"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            background: p.id % 3 === 0 ? '#00FF85' : p.id % 3 === 1 ? '#38BDF8' : '#A78BFA',
            opacity: 0.2,
          }}
          animate={{
            y: [0, -30, 0],
            opacity: [0.1, 0.3, 0.1],
          }}
          transition={{
            duration: 4 + (p.id % 4),
            delay: p.id * 0.3,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}

      {/* Background gradient */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 20% 50%, rgba(0,255,133,0.04) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(56,189,248,0.04) 0%, transparent 60%)',
        }}
      />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-5 border-b border-border-subtle">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center font-syne font-bold text-sm"
            style={{ background: 'linear-gradient(135deg, #00FF85, #38BDF8)' }}
          >
            <span className="text-bg-primary">Æ</span>
          </div>
          <span className="font-syne font-700 text-content text-lg">AEGIS</span>
          <span
            className="text-xs font-mono px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(0,255,133,0.1)', color: '#00FF85', border: '1px solid rgba(0,255,133,0.2)' }}
          >
            v1.0 · INSOMNIA ACM
          </span>
        </div>
        <button
          onClick={() => router.push('/instructor')}
          className="text-sm text-muted hover:text-content transition-colors flex items-center gap-2"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          Instructor Dashboard
        </button>
      </nav>

      <main className="relative z-10 max-w-6xl mx-auto px-8 py-16">
        {/* Hero */}
        <div className="text-center mb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 text-xs font-mono mb-6 px-3 py-1.5 rounded-full"
              style={{ background: 'rgba(0,255,133,0.08)', border: '1px solid rgba(0,255,133,0.15)', color: '#00CC6A' }}>
              ◆ Agentic AI Learning Platform — Problem Statement 5
            </div>

            <h1 className="heading-display text-6xl md:text-7xl mb-6">
              <span className="gradient-text">Learn Deeper.</span>
              <br />
              <span className="text-content">Think Clearer.</span>
            </h1>

            <p className="text-muted text-lg max-w-2xl mx-auto leading-relaxed">
              AEGIS models <em className="text-content not-italic">how you think</em>, not just what you answer.
              An agentic AI tutor that adapts to your cognitive style, tracks your forgetting curve,
              and guides you through Socratic dialogue to genuine understanding.
            </p>
          </motion.div>
        </div>

        {/* Three Pillars */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-20"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          {PILLARS.map((pillar, i) => (
            <motion.div
              key={pillar.title}
              className="glass rounded-2xl p-6 relative overflow-hidden"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * i + 0.3 }}
              whileHover={{ y: -3 }}
            >
              <div className="absolute top-0 right-0 w-24 h-24 rounded-bl-full opacity-5"
                style={{ background: pillar.color }} />
              <div className="text-3xl mb-3" style={{ color: pillar.color }}>{pillar.icon}</div>
              <h3 className="font-syne font-semibold text-content text-sm mb-1">{pillar.title}</h3>
              <p className="text-xs font-mono mb-3" style={{ color: pillar.color + '88' }}>{pillar.subtitle}</p>
              <p className="text-muted text-xs leading-relaxed">{pillar.description}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Two-column: form + agents */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Onboarding Form */}
          <motion.div
            className="glass-elevated rounded-2xl p-8"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
          >
            <h2 className="font-syne font-bold text-content text-xl mb-2">Start Your Journey</h2>
            <p className="text-muted text-sm mb-6">AEGIS will build a cognitive model uniquely tailored to you.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-muted mb-1.5 uppercase tracking-wider">Your Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Arjun Sharma"
                  className="w-full bg-bg-primary border border-border-subtle rounded-xl px-4 py-3 text-content text-sm placeholder-muted/40 focus:border-accent/40"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-muted mb-1.5 uppercase tracking-wider">Topic to Master</label>
                <input
                  type="text"
                  value={form.topic}
                  onChange={e => setForm(f => ({ ...f, topic: e.target.value }))}
                  placeholder="e.g. Calculus, Quantum Mechanics, Neural Networks"
                  className="w-full bg-bg-primary border border-border-subtle rounded-xl px-4 py-3 text-content text-sm placeholder-muted/40 focus:border-accent/40"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-muted mb-1.5 uppercase tracking-wider">Learning Goal</label>
                <textarea
                  value={form.goal}
                  onChange={e => setForm(f => ({ ...f, goal: e.target.value }))}
                  placeholder="e.g. Understand backpropagation well enough to implement it from scratch"
                  rows={3}
                  className="w-full bg-bg-primary border border-border-subtle rounded-xl px-4 py-3 text-content text-sm placeholder-muted/40 resize-none focus:border-accent/40"
                />
              </div>

              <AnimatePresence>
                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-danger text-xs font-mono"
                  >
                    ⚠ {error}
                  </motion.p>
                )}
              </AnimatePresence>

              <motion.button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl font-syne font-semibold text-bg-primary text-sm relative overflow-hidden"
                style={{ background: 'linear-gradient(135deg, #00FF85, #00CC6A)' }}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <motion.div
                      className="w-4 h-4 border-2 border-bg-primary/40 border-t-bg-primary rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                    />
                    Initializing AEGIS...
                  </span>
                ) : (
                  'Begin Learning →'
                )}
              </motion.button>
            </form>
          </motion.div>

          {/* Agent Architecture */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
          >
            <h2 className="font-syne font-bold text-content text-xl mb-2">5-Agent Architecture</h2>
            <p className="text-muted text-sm mb-5">Autonomous agent selection based on your real-time cognitive state.</p>

            <div className="space-y-3">
              {AGENTS.map((agent, i) => (
                <motion.div
                  key={agent.type}
                  className="glass rounded-xl p-4 flex items-start gap-3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 * i + 0.5 }}
                  whileHover={{ x: 4 }}
                >
                  <span className="text-xl">{agent.icon}</span>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-mono font-semibold text-xs" style={{ color: agent.color }}>
                        {agent.type}
                      </span>
                    </div>
                    <p className="text-muted text-xs">{agent.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="mt-4 glass rounded-xl p-4">
              <p className="text-xs font-mono text-muted">
                <span className="text-accent">◆</span> Agent switching is automatic — AEGIS reads frustration, misconceptions, mastery levels, and message cadence to choose the optimal pedagogical strategy.
              </p>
            </div>
          </motion.div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border-subtle mt-20 px-8 py-6 flex items-center justify-between">
        <span className="text-xs text-muted font-mono">AEGIS · INSOMNIA ACM VNIT Hackathon · Problem Statement 5</span>
        <span className="text-xs text-muted font-mono">Ebbinghaus (1885) · Piaget · Bartlett (1932) · SM-2</span>
      </footer>
    </div>
  );
}
