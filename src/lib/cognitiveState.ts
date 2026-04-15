/**
 * AEGIS Always-On Cognitive State Engine
 *
 * This is the persistent brain of AEGIS. Unlike session-scoped epistemic state
 * (which resets), cognitive state survives indefinitely — every interaction
 * updates a continuously evolving model of the student's mind.
 *
 * Architecture:
 *   EpistemicState  = what happened THIS message (volatile)
 *   CognitiveState  = who this student IS as a learner (persistent, always-on)
 *
 * Research basis:
 *   - Anderson (1983) ACT-R: declarative + procedural long-term memory
 *   - Flavell (1979): metacognitive monitoring as a continuous process
 *   - Baddeley (2000): working memory as a gateway to long-term storage
 */

import { getDb } from './db';
import type { CognitiveDNA, AgentType } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LongTermConceptRecord {
  mastery: number;
  confidence: number;           // student's self-assessed confidence (ToM input)
  lastConfirmed: string;
  breakthroughMethod?: string;  // what explanation finally worked
  reviewCount: number;
  misconceptionCount: number;
}

export interface MisconceptionRecord {
  concept: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  detectedAt: string;
  resolvedAt?: string;
  resolutionAttempts: number;
}

export interface LearningPatterns {
  avgMasteryGainPerSession: number;
  avgFrustrationLevel: number;
  bestPerformingAgent: AgentType;
  preferredExplanationStyle: 'brief' | 'detailed' | 'example-first' | 'theory-first';
  totalSessionCount: number;
  totalMessageCount: number;
  inferredDomains: string[];      // hobby/knowledge domains detected from conversation
}

/** Per-agent effectiveness scores (exponential moving average) */
export type TeachingWeights = Record<AgentType, number>;

/** Snapshot of Cognitive DNA at a point in time */
export interface DNASnapshot {
  timestamp: string;
  dna: CognitiveDNA;
  triggerReason: string;  // why a DNA update was recorded
}

/** Theory of Mind prediction stored between messages */
export interface ToMPrediction {
  predictedMisconceptions: string[];
  predictedFrustrationRange: [number, number];  // [min, max] expected
  predictedQuestion: string;                     // what they'll likely ask next
  generatedAt: string;
  agentType: AgentType;
}

export interface CognitiveStateData {
  studentId: string;
  longTermUnderstanding: Record<string, LongTermConceptRecord>;
  misconceptionHistory: MisconceptionRecord[];
  learningPatterns: LearningPatterns;
  dnaEvolution: DNASnapshot[];
  tomAccuracyTrend: number[];       // rolling window of ToM accuracy scores [0..1]
  teachingWeights: TeachingWeights;
  pendingToMPrediction?: ToMPrediction;  // stored after AI response, evaluated on next user msg
  lastUpdated: string;
}

const DEFAULT_WEIGHTS: TeachingWeights = {
  PROBE: 1.0, HINT: 1.0, REPAIR: 1.0,
  CHALLENGE: 1.0, META: 1.0, FEYNMAN: 1.0,
};

const DEFAULT_PATTERNS: LearningPatterns = {
  avgMasteryGainPerSession: 0,
  avgFrustrationLevel: 0,
  bestPerformingAgent: 'PROBE',
  preferredExplanationStyle: 'detailed',
  totalSessionCount: 0,
  totalMessageCount: 0,
  inferredDomains: [],
};

// ─── Read ─────────────────────────────────────────────────────────────────────

export function getCognitiveState(studentId: string): CognitiveStateData {
  const db = getDb();
  const row = db.prepare(
    'SELECT * FROM cognitive_state WHERE student_id = ?'
  ).get(studentId) as Record<string, unknown> | undefined;

  if (!row) {
    return {
      studentId,
      longTermUnderstanding: {},
      misconceptionHistory: [],
      learningPatterns: { ...DEFAULT_PATTERNS },
      dnaEvolution: [],
      tomAccuracyTrend: [],
      teachingWeights: { ...DEFAULT_WEIGHTS },
      lastUpdated: new Date().toISOString(),
    };
  }

  return {
    studentId,
    longTermUnderstanding: parseJSON(row.long_term_understanding, {}),
    misconceptionHistory: parseJSON(row.misconception_history, []),
    learningPatterns: { ...DEFAULT_PATTERNS, ...parseJSON(row.learning_patterns, {}) },
    dnaEvolution: parseJSON(row.dna_evolution, []),
    tomAccuracyTrend: parseJSON(row.tom_accuracy_trend, []),
    teachingWeights: { ...DEFAULT_WEIGHTS, ...parseJSON(row.teaching_weights, {}) },
    pendingToMPrediction: row.pending_tom_prediction
      ? parseJSON(row.pending_tom_prediction, undefined)
      : undefined,
    lastUpdated: (row.last_updated as string) || new Date().toISOString(),
  };
}

// ─── Write ────────────────────────────────────────────────────────────────────

export function updateCognitiveState(
  studentId: string,
  patch: Partial<Omit<CognitiveStateData, 'studentId'>>
): void {
  const db = getDb();
  const current = getCognitiveState(studentId);
  const merged: CognitiveStateData = {
    ...current,
    ...patch,
    studentId,
    lastUpdated: new Date().toISOString(),
  };

  db.prepare(`
    INSERT INTO cognitive_state (
      student_id, long_term_understanding, misconception_history,
      learning_patterns, dna_evolution, tom_accuracy_trend,
      teaching_weights, pending_tom_prediction, last_updated
    ) VALUES (
      @student_id, @long_term_understanding, @misconception_history,
      @learning_patterns, @dna_evolution, @tom_accuracy_trend,
      @teaching_weights, @pending_tom_prediction, @last_updated
    )
    ON CONFLICT(student_id) DO UPDATE SET
      long_term_understanding = excluded.long_term_understanding,
      misconception_history   = excluded.misconception_history,
      learning_patterns       = excluded.learning_patterns,
      dna_evolution           = excluded.dna_evolution,
      tom_accuracy_trend      = excluded.tom_accuracy_trend,
      teaching_weights        = excluded.teaching_weights,
      pending_tom_prediction  = excluded.pending_tom_prediction,
      last_updated            = excluded.last_updated
  `).run({
    student_id: studentId,
    long_term_understanding: JSON.stringify(merged.longTermUnderstanding),
    misconception_history:   JSON.stringify(merged.misconceptionHistory),
    learning_patterns:       JSON.stringify(merged.learningPatterns),
    dna_evolution:           JSON.stringify(merged.dnaEvolution.slice(-15)),
    tom_accuracy_trend:      JSON.stringify(merged.tomAccuracyTrend.slice(-30)),
    teaching_weights:        JSON.stringify(merged.teachingWeights),
    pending_tom_prediction:  merged.pendingToMPrediction
      ? JSON.stringify(merged.pendingToMPrediction)
      : null,
    last_updated: merged.lastUpdated,
  });
}

// ─── Teaching Weights (Self-Evaluating Loop) ──────────────────────────────────

/**
 * After each interaction, updates the per-agent effectiveness score using an
 * exponential moving average. High mastery delta → agent gets a positive signal.
 * This makes AEGIS gradually favor strategies that actually work for THIS student.
 */
export function updateTeachingWeights(
  studentId: string,
  agentUsed: AgentType,
  masteryDelta: number,
  frustrationDelta: number   // negative = frustration reduced = good
): void {
  const state = getCognitiveState(studentId);
  const weights = { ...state.teachingWeights };

  const α = 0.12;  // learning rate
  // Combined signal: mastery gain is good, frustration reduction is good
  const signal = Math.tanh(masteryDelta * 8 - frustrationDelta * 3);
  const currentW = weights[agentUsed] ?? 1.0;
  const updatedW = currentW * (1 - α) + (1.0 + signal) * α;

  weights[agentUsed] = Math.max(0.4, Math.min(2.2, updatedW));

  // Derive bestPerformingAgent from weights
  const best = (Object.entries(weights) as [AgentType, number][])
    .reduce((a, b) => (b[1] > a[1] ? b : a))[0];

  updateCognitiveState(studentId, {
    teachingWeights: weights,
    learningPatterns: {
      ...state.learningPatterns,
      bestPerformingAgent: best,
    },
  });
}

// ─── Theory of Mind ───────────────────────────────────────────────────────────

/**
 * Stores a prediction of what the student will say/believe after seeing
 * the current AI response. Evaluated on the NEXT user message.
 */
export function storeTomPrediction(
  studentId: string,
  prediction: ToMPrediction
): void {
  updateCognitiveState(studentId, { pendingToMPrediction: prediction });
}

/**
 * Compares a stored ToM prediction against actual observed epistemic state.
 * Returns accuracy score [0..1] and clears the pending prediction.
 */
export function evaluateAndClearTomPrediction(
  studentId: string,
  actualMisconceptions: string[],
  actualFrustration: number
): number | null {
  const state = getCognitiveState(studentId);
  if (!state.pendingToMPrediction) return null;

  const pred = state.pendingToMPrediction;

  // Misconception hit rate
  const predicted = pred.predictedMisconceptions.map(s => s.toLowerCase());
  const actual = actualMisconceptions.map(s => s.toLowerCase());
  const hits = predicted.filter(p => actual.some(a => a.includes(p) || p.includes(a))).length;
  const miscHitRate = predicted.length === 0 ? 1 : hits / predicted.length;

  // Frustration range accuracy
  const [fMin, fMax] = pred.predictedFrustrationRange;
  const frustAccuracy = actualFrustration >= fMin && actualFrustration <= fMax ? 1 : 0.3;

  const accuracy = miscHitRate * 0.6 + frustAccuracy * 0.4;

  // Record and clear
  const trend = [...state.tomAccuracyTrend, accuracy];
  updateCognitiveState(studentId, {
    tomAccuracyTrend: trend.slice(-30),
    pendingToMPrediction: undefined,
  });

  return accuracy;
}

/** Rolling average ToM accuracy (returns null if insufficient data) */
export function getAvgTomAccuracy(studentId: string): number | null {
  const state = getCognitiveState(studentId);
  if (state.tomAccuracyTrend.length < 3) return null;
  const last10 = state.tomAccuracyTrend.slice(-10);
  return last10.reduce((a, b) => a + b, 0) / last10.length;
}

// ─── Domain Inference ─────────────────────────────────────────────────────────

/**
 * Infers student's familiar domains from conversational signals.
 * Used by the Cross-Domain Analogy Engine.
 */
export function inferStudentDomains(
  conversationHistory: Array<{ content: string }>
): string[] {
  const text = conversationHistory.map(m => m.content).join(' ').toLowerCase();

  const DOMAIN_SIGNALS: Record<string, string[]> = {
    music:       ['music', 'guitar', 'piano', 'melody', 'rhythm', 'chord', 'beat', 'song', 'frequency'],
    sports:      ['basketball', 'football', 'soccer', 'cricket', 'tennis', 'game', 'match', 'score', 'player'],
    cooking:     ['cook', 'recipe', 'ingredient', 'bake', 'kitchen', 'temperature', 'mixture'],
    programming: ['code', 'function', 'variable', 'loop', 'algorithm', 'bug', 'program', 'array'],
    gaming:      ['game', 'level', 'character', 'quest', 'damage', 'health bar', 'respawn', 'map'],
    art:         ['draw', 'paint', 'design', 'color', 'sketch', 'canvas', 'palette'],
    economics:   ['money', 'price', 'market', 'profit', 'cost', 'supply', 'demand', 'trade'],
    biology:     ['cell', 'organism', 'dna', 'evolution', 'species', 'gene', 'protein'],
    history:     ['century', 'war', 'revolution', 'ancient', 'empire', 'historical'],
    travel:      ['country', 'city', 'culture', 'language', 'border', 'visit', 'trip'],
  };

  const found: string[] = [];
  for (const [domain, signals] of Object.entries(DOMAIN_SIGNALS)) {
    if (signals.some(s => text.includes(s))) found.push(domain);
  }
  return Array.from(new Set(found)).slice(0, 4);
}

// ─── Cognitive State Summary for Prompt Injection ─────────────────────────────

/**
 * Returns a compact, prompt-ready summary of the student's long-term cognitive state.
 * Injected into every agent prompt to provide cross-session context.
 */
export function buildCognitiveContextString(state: CognitiveStateData): string {
  const parts: string[] = [];

  const masteredConcepts = Object.entries(state.longTermUnderstanding)
    .filter(([, v]) => v.mastery > 0.7)
    .map(([concept]) => concept)
    .slice(0, 5);

  if (masteredConcepts.length > 0) {
    parts.push(`Long-term mastery: ${masteredConcepts.join(', ')}`);
  }

  const persistentMisconceptions = state.misconceptionHistory
    .filter(m => !m.resolvedAt && m.resolutionAttempts > 0)
    .map(m => m.concept)
    .slice(0, 3);

  if (persistentMisconceptions.length > 0) {
    parts.push(`Recurring misconceptions (resistant to correction): ${persistentMisconceptions.join(', ')}`);
  }

  const breakthroughs = Object.entries(state.longTermUnderstanding)
    .filter(([, v]) => v.breakthroughMethod)
    .map(([concept, v]) => `${concept} → "${v.breakthroughMethod}"`)
    .slice(0, 2);

  if (breakthroughs.length > 0) {
    parts.push(`What has worked before: ${breakthroughs.join('; ')}`);
  }

  const patterns = state.learningPatterns;
  if (patterns.totalMessageCount > 20) {
    parts.push(
      `Learning profile: ${patterns.preferredExplanationStyle} style, ` +
      `avg mastery gain ${(patterns.avgMasteryGainPerSession * 100).toFixed(1)}%/session, ` +
      `best agent: ${patterns.bestPerformingAgent}`
    );
  }

  const tomAvg = state.tomAccuracyTrend.length >= 5
    ? state.tomAccuracyTrend.slice(-5).reduce((a, b) => a + b, 0) / 5
    : null;
  if (tomAvg !== null) {
    parts.push(
      `Predictability: ${tomAvg > 0.7 ? 'high (responses match expectations)' : 'moderate (student surprises often)'}`
    );
  }

  if (parts.length === 0) return '';
  return `\nPERSISTENT COGNITIVE PROFILE (across all sessions):\n${parts.map(p => `• ${p}`).join('\n')}`;
}

// ─── Utils ────────────────────────────────────────────────────────────────────

function parseJSON<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string') return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}
