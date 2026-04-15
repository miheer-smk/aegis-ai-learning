'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import RiskBar from '@/components/RiskBar';
import type { InstructorAnalytics, StudentAnalytics } from '@/types';

const HeatmapGrid = dynamic(() => import('@/components/HeatmapGrid'), { ssr: false });

function MasteryBadge({ value }: { value: number }) {
  const color = value > 0.65 ? '#00FF85' : value > 0.35 ? '#FFB347' : '#FF4D6D';
  return (
    <span className="font-mono text-sm font-semibold" style={{ color }}>
      {Math.round(value * 100)}%
    </span>
  );
}

function InterventionCard({ student }: { student: StudentAnalytics }) {
  const router = useRouter();
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-elevated rounded-xl p-4 border-l-2"
      style={{ borderColor: student.riskScore > 0.7 ? '#FF4D6D' : '#FFB347' }}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="font-semibold text-content text-sm">{student.name}</h4>
          <p className="text-xs text-muted font-mono">{student.topic}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-xs font-mono px-2 py-0.5 rounded-full"
            style={{
              background: student.riskScore > 0.7 ? 'rgba(255,77,109,0.1)' : 'rgba(255,179,71,0.1)',
              color: student.riskScore > 0.7 ? '#FF4D6D' : '#FFB347',
              border: `1px solid ${student.riskScore > 0.7 ? 'rgba(255,77,109,0.3)' : 'rgba(255,179,71,0.3)'}`,
            }}>
            {student.riskScore > 0.7 ? '⚠ HIGH RISK' : '⚡ MEDIUM RISK'}
          </span>
        </div>
      </div>

      <RiskBar score={student.riskScore} />

      {student.weakConcepts.length > 0 && (
        <div className="mt-3">
          <p className="text-xs text-muted mb-1.5">Weak concepts:</p>
          <div className="flex flex-wrap gap-1">
            {student.weakConcepts.slice(0, 4).map(c => (
              <span key={c} className="text-xs font-mono px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(255,77,109,0.08)', color: '#FF4D6D' }}>
                {c}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-muted">Frustration: {Math.round(student.frustrationLevel * 100)}%</span>
        <button
          onClick={() => router.push(`/learn/${student.id}`)}
          className="text-xs text-accent hover:text-accent-dim transition-colors font-mono"
        >
          View Session →
        </button>
      </div>
    </motion.div>
  );
}

export default function InstructorPage() {
  const router = useRouter();
  const [analytics, setAnalytics] = useState<InstructorAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'students' | 'heatmap' | 'interventions'>('overview');

  const loadAnalytics = useCallback(async () => {
    try {
      const res = await fetch('/api/instructor');
      const data = await res.json() as InstructorAnalytics;
      setAnalytics(data);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAnalytics();
    const interval = setInterval(loadAnalytics, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [loadAnalytics]);

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-8 h-8 border-2 border-accent/20 border-t-accent rounded-full" />
      </div>
    );
  }

  const a = analytics;
  const interventions = a?.students.filter(s => s.interventionNeeded) || [];

  const TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'students', label: `Students (${a?.totalStudents || 0})` },
    { id: 'heatmap', label: 'Misconceptions' },
    { id: 'interventions', label: `Interventions (${interventions.length})` },
  ] as const;

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-5 border-b border-border-subtle">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/')}
            className="text-muted hover:text-content text-sm transition-colors flex items-center gap-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Home
          </button>
          <div className="h-4 w-px bg-border-subtle" />
          <div>
            <h1 className="font-syne font-bold text-content text-lg">Instructor Dashboard</h1>
            <p className="text-xs text-muted font-mono">Real-time class analytics · auto-refreshes every 30s</p>
          </div>
        </div>

        <button
          onClick={loadAnalytics}
          className="flex items-center gap-2 text-sm text-muted hover:text-content transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          Refresh
        </button>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-8">
        {/* Summary Strip */}
        <motion.div
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {[
            { label: 'Total Students', value: a?.totalStudents || 0, color: '#38BDF8' },
            { label: 'At Risk', value: a?.atRiskCount || 0, color: '#FF4D6D' },
            { label: 'Avg Class Mastery', value: `${Math.round((a?.avgClassMastery || 0) * 100)}%`, color: '#00FF85' },
            { label: 'Need Intervention', value: interventions.length, color: '#FFB347' },
          ].map(card => (
            <div key={card.label} className="glass rounded-2xl p-5">
              <div className="text-3xl font-syne font-bold mb-1" style={{ color: card.color }}>
                {card.value}
              </div>
              <div className="text-xs text-muted font-mono">{card.label}</div>
            </div>
          ))}
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-bg-surface rounded-xl p-1 w-fit">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background: selectedTab === tab.id ? '#151C24' : 'transparent',
                color: selectedTab === tab.id ? '#E8EDF2' : '#8896A4',
                border: selectedTab === tab.id ? '1px solid rgba(255,255,255,0.08)' : '1px solid transparent',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {/* Overview Tab */}
          {selectedTab === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-6"
            >
              {/* Class Trends */}
              <div className="glass rounded-2xl p-6">
                <h2 className="font-syne font-bold text-content text-lg mb-4">7-Day Activity Trend</h2>
                <div className="flex items-end gap-2 h-24">
                  {(a?.classTrends || []).map((t, i) => {
                    const maxStudents = Math.max(...(a?.classTrends || []).map(x => x.activeStudents || 0), 1);
                    const h = maxStudents > 0 ? ((t.activeStudents || 0) / maxStudents) * 100 : 10;
                    return (
                      <div key={t.date} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-xs font-mono text-muted">{t.activeStudents || 0}</span>
                        <motion.div
                          className="w-full rounded-t-md"
                          style={{ background: 'linear-gradient(180deg, #00FF85, #00CC6A)', opacity: 0.7 + i * 0.04 }}
                          initial={{ height: 0 }}
                          animate={{ height: `${Math.max(4, h)}%` }}
                          transition={{ duration: 0.6, delay: i * 0.05 }}
                        />
                        <span className="text-xs font-mono text-muted" style={{ fontSize: '9px' }}>
                          {new Date(t.date).toLocaleDateString([], { weekday: 'short' })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Top 5 at-risk */}
              {interventions.length > 0 && (
                <div className="glass rounded-2xl p-6">
                  <h2 className="font-syne font-bold text-content text-lg mb-4">
                    Top At-Risk Students
                    <span className="ml-2 text-xs font-normal text-danger font-mono">
                      {interventions.length} need attention
                    </span>
                  </h2>
                  <div className="space-y-3">
                    {interventions.slice(0, 5).map((s, i) => (
                      <div key={s.id} className="flex items-center gap-4">
                        <span className="text-xs text-muted w-4 font-mono">{i + 1}.</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <div>
                              <span className="text-sm text-content font-medium">{s.name}</span>
                              <span className="text-xs text-muted ml-2 font-mono">{s.topic}</span>
                            </div>
                            <MasteryBadge value={s.avgMastery} />
                          </div>
                          <RiskBar score={s.riskScore} showLabel={false} height={4} />
                        </div>
                        <button
                          onClick={() => router.push(`/learn/${s.id}`)}
                          className="text-xs text-accent font-mono hover:text-accent-dim"
                        >
                          →
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {(a?.totalStudents || 0) === 0 && (
                <div className="glass rounded-2xl p-12 text-center">
                  <div className="text-4xl mb-3 opacity-30">👥</div>
                  <h3 className="font-syne font-semibold text-content mb-2">No students yet</h3>
                  <p className="text-muted text-sm mb-4">Students will appear here after they start learning</p>
                  <button onClick={() => router.push('/')}
                    className="text-sm text-accent hover:text-accent-dim font-mono">
                    ← Go to landing page
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {/* Students Tab */}
          {selectedTab === 'students' && (
            <motion.div
              key="students"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="glass rounded-2xl overflow-hidden"
            >
              {(a?.students || []).length === 0 ? (
                <div className="p-12 text-center">
                  <p className="text-muted">No students enrolled yet</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border-subtle">
                      {['Student', 'Topic', 'Mastery', 'Risk Score', 'Concepts', 'Frustration', 'Last Active', ''].map(h => (
                        <th key={h} className="text-left text-xs text-muted font-mono py-3 px-4 uppercase tracking-wider">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(a?.students || []).map((s, i) => (
                      <motion.tr
                        key={s.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="border-b border-border-subtle hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {s.interventionNeeded && (
                              <span className="w-1.5 h-1.5 rounded-full bg-danger flex-shrink-0" />
                            )}
                            <span className="text-sm text-content font-medium">{s.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-xs text-muted font-mono">{s.topic}</td>
                        <td className="py-3 px-4"><MasteryBadge value={s.avgMastery} /></td>
                        <td className="py-3 px-4 min-w-[120px]">
                          <RiskBar score={s.riskScore} showLabel={false} height={4} />
                        </td>
                        <td className="py-3 px-4 text-xs font-mono text-content">{s.conceptCount}</td>
                        <td className="py-3 px-4">
                          <div className="w-full h-1 rounded-full bg-border-subtle overflow-hidden max-w-[60px]">
                            <div className="h-full rounded-full"
                              style={{
                                width: `${s.frustrationLevel * 100}%`,
                                background: s.frustrationLevel > 0.6 ? '#FF4D6D' : '#FFB347',
                              }} />
                          </div>
                        </td>
                        <td className="py-3 px-4 text-xs text-muted font-mono">
                          {new Date(s.lastActive).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4">
                          <button onClick={() => router.push(`/learn/${s.id}`)}
                            className="text-xs text-accent hover:text-accent-dim font-mono">
                            View →
                          </button>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              )}
            </motion.div>
          )}

          {/* Heatmap Tab */}
          {selectedTab === 'heatmap' && (
            <motion.div
              key="heatmap"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-4"
            >
              <div className="glass rounded-2xl p-6">
                <h2 className="font-syne font-bold text-content text-lg mb-1">Misconception Heatmap</h2>
                <p className="text-xs text-muted mb-4">
                  Concepts where students have recorded misconceptions. Darker = more frequent.
                </p>
                <HeatmapGrid data={a?.misconceptionHeatmap || []} height={280} />
              </div>

              {/* List view */}
              <div className="glass rounded-2xl p-6">
                <h3 className="font-syne font-semibold text-content mb-4">Misconception Details</h3>
                {(a?.misconceptionHeatmap || []).length === 0 ? (
                  <p className="text-muted text-sm text-center py-4">No misconceptions recorded</p>
                ) : (
                  <div className="space-y-3">
                    {(a?.misconceptionHeatmap || []).slice(0, 10).map((m, i) => (
                      <motion.div
                        key={m.concept}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="flex items-center gap-4 p-3 rounded-xl"
                        style={{ background: 'rgba(255,77,109,0.04)', border: '1px solid rgba(255,77,109,0.1)' }}
                      >
                        <span className="text-danger font-mono font-bold text-lg w-8 text-center">{m.count}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-content font-medium">{m.concept}</p>
                          <p className="text-xs text-muted">{m.students.join(', ')}</p>
                        </div>
                        <span className="text-xs font-mono px-2 py-0.5 rounded"
                          style={{ background: 'rgba(255,77,109,0.1)', color: '#FF4D6D' }}>
                          {m.severity}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Interventions Tab */}
          {selectedTab === 'interventions' && (
            <motion.div
              key="interventions"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              {interventions.length === 0 ? (
                <div className="glass rounded-2xl p-12 text-center">
                  <div className="text-4xl mb-3">✓</div>
                  <h3 className="font-syne font-semibold text-content mb-2">All students on track</h3>
                  <p className="text-muted text-sm">No interventions needed right now</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {interventions.map(s => (
                    <InterventionCard key={s.id} student={s} />
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
