'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';
import AgentBadge from '@/components/AgentBadge';
import type { KGNode, KGLink, ReviewItem, CognitiveDNA } from '@/types';
import type { ConceptNode } from '@/types';

// Dynamically import D3 components to avoid SSR
const KnowledgeGraph = dynamic(() => import('@/components/KnowledgeGraph'), { ssr: false });
const DNARadar = dynamic(() => import('@/components/DNARadar'), { ssr: false });
const ForgettingCurve = dynamic(() => import('@/components/ForgettingCurve'), { ssr: false });

const URGENCY_COLORS: Record<string, string> = {
  critical: '#FF4D6D',
  high: '#FFB347',
  medium: '#38BDF8',
  low: '#00FF85',
};

function StatCard({ label, value, unit, color }: { label: string; value: string | number; unit?: string; color?: string }) {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="text-3xl font-syne font-bold mb-1" style={{ color: color || '#E8EDF2' }}>
        {value}{unit}
      </div>
      <div className="text-xs text-muted font-mono">{label}</div>
    </div>
  );
}

export default function DashboardPage() {
  const params = useParams();
  const router = useRouter();
  const studentId = params.id as string;

  const [student, setStudent] = useState<{ name: string; topic: string; goal: string; cognitive_dna: CognitiveDNA } | null>(null);
  const [graphData, setGraphData] = useState<{ nodes: KGNode[]; links: KGLink[]; stats: Record<string, number> } | null>(null);
  const [reviewQueue, setReviewQueue] = useState<ReviewItem[]>([]);
  const [conceptNodes, setConceptNodes] = useState<ConceptNode[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!studentId) return;
    try {
      const [studentRes, epistemicRes] = await Promise.all([
        fetch(`/api/student?id=${studentId}`),
        fetch(`/api/epistemic?studentId=${studentId}`),
      ]);

      const studentData = await studentRes.json();
      const epistemicData = await epistemicRes.json();

      if ('error' in studentData) { router.push('/'); return; }

      setStudent(studentData);
      setGraphData({
        nodes: epistemicData.nodes || [],
        links: epistemicData.links || [],
        stats: epistemicData.stats || {},
      });
      setReviewQueue(epistemicData.reviewQueue || []);

      // Build ConceptNode-like objects from graph nodes for ForgettingCurve
      const nodes: ConceptNode[] = (epistemicData.nodes || []).map((n: KGNode & { stability?: number; last_reviewed?: string }) => ({
        id: n.id,
        student_id: studentId,
        concept: n.concept,
        mastery: n.mastery,
        stability: n.stability || 2.0,
        last_reviewed: n.last_reviewed || new Date().toISOString(),
        misconception: [],
        review_count: n.reviewCount,
      }));
      setConceptNodes(nodes);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [studentId, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading || !student) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-8 h-8 border-2 border-accent/20 border-t-accent rounded-full" />
      </div>
    );
  }

  const dna = student.cognitive_dna;
  const stats = graphData?.stats || {};

  const getDominantStyle = (d: CognitiveDNA) => {
    const styles: [string, number][] = [
      ['Visual', d.visual],
      ['Abstract', d.abstract],
      ['Example-First', d.exampleFirst],
      ['Theory-First', d.theoryFirst],
      ['Analogy-Driven', d.analogyDriven],
    ];
    const max = styles.reduce((m, s) => s[1] > m[1] ? s : m, ['Balanced', 0]);
    return max[1] > 0.55 ? max[0] : 'Balanced';
  };

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-5 border-b border-border-subtle">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push(`/learn/${studentId}`)}
            className="text-muted hover:text-content text-sm transition-colors flex items-center gap-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back to Learning
          </button>
          <div className="h-4 w-px bg-border-subtle" />
          <div>
            <h1 className="font-syne font-bold text-content">{student.name}</h1>
            <p className="text-xs text-muted font-mono">{student.topic}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-muted font-mono">Cognitive Profile:</span>
          <span className="text-xs font-mono px-2 py-1 rounded-full"
            style={{ background: 'rgba(0,255,133,0.08)', color: '#00FF85', border: '1px solid rgba(0,255,133,0.2)' }}>
            {getDominantStyle(dna)} · {dna.pace} pace
          </span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-8 space-y-8">
        {/* Stat Cards */}
        <motion.div
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <StatCard
            label="Average Mastery"
            value={Math.round((stats.avgMastery || 0) * 100)}
            unit="%"
            color={(stats.avgMastery || 0) > 0.6 ? '#00FF85' : (stats.avgMastery || 0) > 0.3 ? '#FFB347' : '#FF4D6D'}
          />
          <StatCard
            label="Avg Retention"
            value={Math.round((stats.avgRetention || 0) * 100)}
            unit="%"
            color={(stats.avgRetention || 0) > 0.7 ? '#00FF85' : '#FFB347'}
          />
          <StatCard
            label="Concepts Mapped"
            value={stats.conceptCount || 0}
            color="#38BDF8"
          />
          <StatCard
            label="Misconceptions"
            value={stats.totalMisconceptions || 0}
            color={(stats.totalMisconceptions || 0) > 3 ? '#FF4D6D' : '#FFB347'}
          />
        </motion.div>

        {/* DNA Radar + Knowledge Graph */}
        <motion.div
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          {/* DNA Radar */}
          <div className="glass rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-syne font-bold text-content text-lg">Cognitive DNA</h2>
                <p className="text-xs text-muted mt-0.5">Your inferred learning profile</p>
              </div>
              <span className="text-xs font-mono px-2 py-1 rounded-full"
                style={{ background: 'rgba(167,139,250,0.1)', color: '#A78BFA', border: '1px solid rgba(167,139,250,0.2)' }}>
                {dna.pace} pace
              </span>
            </div>

            <div className="flex items-center justify-center">
              <DNARadar dna={dna} size={240} animated />
            </div>

            <div className="mt-4 pt-4 border-t border-border-subtle">
              <p className="text-xs text-muted font-mono mb-2">DNA Breakdown</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Visual', val: dna.visual },
                  { label: 'Abstract', val: dna.abstract },
                  { label: 'Example-First', val: dna.exampleFirst },
                  { label: 'Theory-First', val: dna.theoryFirst },
                  { label: 'Analogy-Driven', val: dna.analogyDriven },
                ].map(({ label, val }) => (
                  <div key={label} className="flex items-center gap-2">
                    <div className="flex-1">
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="text-muted">{label}</span>
                        <span className="font-mono text-accent">{Math.round(val * 100)}%</span>
                      </div>
                      <div className="h-1 rounded-full bg-border-subtle overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: '#00FF85' }}
                          initial={{ width: 0 }}
                          animate={{ width: `${val * 100}%` }}
                          transition={{ duration: 0.8, ease: 'easeOut' }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted mt-3 italic">&ldquo;{dna.preferredStyle}&rdquo;</p>
            </div>
          </div>

          {/* Knowledge Graph */}
          <div className="glass rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-syne font-bold text-content text-lg">Knowledge Graph</h2>
                <p className="text-xs text-muted mt-0.5">
                  {graphData?.nodes.length || 0} concepts · drag to rearrange
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-accent inline-block"></span>High mastery</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-warning inline-block"></span>Medium</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-danger inline-block"></span>Low</span>
              </div>
            </div>
            <KnowledgeGraph
              nodes={graphData?.nodes || []}
              links={graphData?.links || []}
              height={300}
            />
          </div>
        </motion.div>

        {/* Forgetting Curve + Review Queue */}
        <motion.div
          className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {/* Forgetting Curve */}
          <div className="lg:col-span-2 glass rounded-2xl p-6">
            <div className="mb-4">
              <h2 className="font-syne font-bold text-content text-lg">Ebbinghaus Forgetting Curves</h2>
              <p className="text-xs text-muted mt-0.5">
                Predicted retention R(t) = e<sup>−t/S</sup> per concept. Dashed line = 50% threshold.
              </p>
            </div>
            <ForgettingCurve concepts={conceptNodes} height={220} daysToShow={21} />
          </div>

          {/* Review Queue */}
          <div className="glass rounded-2xl p-6">
            <h2 className="font-syne font-bold text-content text-lg mb-1">Review Queue</h2>
            <p className="text-xs text-muted mb-4">Sorted by urgency</p>

            {reviewQueue.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-8">
                <span className="text-2xl mb-2">✓</span>
                <p className="text-muted text-sm">All concepts are fresh!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {reviewQueue.slice(0, 8).map((item, i) => (
                  <motion.div
                    key={item.conceptId}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center justify-between p-3 rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)' }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ background: URGENCY_COLORS[item.urgency] }} />
                      <span className="text-xs text-content truncate">{item.concept}</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                      <span className="text-xs font-mono" style={{ color: URGENCY_COLORS[item.urgency] }}>
                        {Math.round(item.retention * 100)}%
                      </span>
                      <AgentBadge agentType="HINT" size="sm" />
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            <button
              onClick={() => router.push(`/learn/${studentId}`)}
              className="w-full mt-4 py-2.5 rounded-xl text-sm font-semibold font-syne text-bg-primary"
              style={{ background: 'linear-gradient(135deg, #00FF85, #00CC6A)' }}
            >
              Continue Learning →
            </button>
          </div>
        </motion.div>

        {/* Goal Progress */}
        <motion.div
          className="glass rounded-2xl p-6"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h2 className="font-syne font-bold text-content text-lg mb-2">Learning Goal</h2>
          <p className="text-muted text-sm mb-4 italic">&ldquo;{student.goal}&rdquo;</p>
          <div className="h-2 rounded-full bg-border-subtle overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'linear-gradient(90deg, #00FF85, #38BDF8)' }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.round((stats.avgMastery || 0) * 100)}%` }}
              transition={{ duration: 1, ease: 'easeOut', delay: 0.5 }}
            />
          </div>
          <p className="text-xs text-muted font-mono mt-2">
            {Math.round((stats.avgMastery || 0) * 100)}% mastery across {stats.conceptCount || 0} concepts
          </p>
        </motion.div>
      </main>
    </div>
  );
}
