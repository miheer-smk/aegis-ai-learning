/**
 * AEGIS Functional Emotion Engine
 *
 * Moves beyond a scalar "frustration" float to a 3D emotion state vector:
 *   concern    — tutor's worry about this student's trajectory
 *   curiosity  — tutor's interest in the student's unique patterns
 *   confidence — tutor's self-assurance in understanding this student
 *
 * These are not simulated feelings — they are cognitive states that
 * change what AEGIS does: agent selection, response tone, and risk prioritization.
 *
 * Architecture:
 *   - Stored per student in emotion_state table
 *   - Updated every message via exponential moving average
 *   - Influences (not overrides) agent selection
 *   - Injected into system prompt as a small context block
 */

import { getDb } from './db';
import type { EpistemicState } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EmotionState {
  concern: number;    // [0..1] worry about student's progress / wellbeing
  curiosity: number;  // [0..1] interest in student's unique reasoning patterns
  confidence: number; // [0..1] how well the tutor understands this particular student
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export function getEmotionState(studentId: string): EmotionState {
  const db = getDb();
  const row = db.prepare(
    'SELECT concern, curiosity, confidence FROM emotion_state WHERE student_id = ?'
  ).get(studentId) as EmotionState | undefined;

  return row ?? { concern: 0.3, curiosity: 0.5, confidence: 0.5 };
}

// ─── Update ───────────────────────────────────────────────────────────────────

/**
 * Updates the tutor's emotional state after each interaction.
 * Uses EMA (α=0.12 to 0.15) so state evolves gradually, not erratically.
 */
export function updateEmotionState(
  studentId: string,
  epistemicState: EpistemicState,
  masteryDelta: number,
  consecutiveFailures: number
): EmotionState {
  const db = getDb();
  const current = getEmotionState(studentId);

  // ── Concern: rises with frustration, misconceptions, repeated failures ──────
  const concernSignal =
    epistemicState.frustrationLevel * 0.4 +
    (epistemicState.misconceptions.length > 0 ? 0.25 : 0) +
    (consecutiveFailures > 2 ? 0.35 : 0);
  const newConcern = current.concern * 0.85 + Math.min(1, concernSignal) * 0.15;

  // ── Curiosity: rises with novel patterns, high-severity errors, engagement ──
  const curiositySignal =
    epistemicState.misconceptions.some(m => m.severity === 'high') ? 0.85 :
    epistemicState.engagementLevel > 0.7 ? 0.75 :
    epistemicState.engagementLevel < 0.3 ? 0.15 : 0.4;
  const newCuriosity = current.curiosity * 0.9 + curiositySignal * 0.1;

  // ── Confidence: rises when mastery improves; falls on unpredictable outcomes
  const confidenceSignal = masteryDelta > 0.05 ? 0.85 : masteryDelta < -0.02 ? 0.2 : 0.5;
  const newConfidence = current.confidence * 0.88 + confidenceSignal * 0.12;

  const updated: EmotionState = {
    concern:    Math.max(0, Math.min(1, newConcern)),
    curiosity:  Math.max(0, Math.min(1, newCuriosity)),
    confidence: Math.max(0, Math.min(1, newConfidence)),
  };

  db.prepare(`
    INSERT INTO emotion_state (student_id, concern, curiosity, confidence, last_updated)
    VALUES (@student_id, @concern, @curiosity, @confidence, @last_updated)
    ON CONFLICT(student_id) DO UPDATE SET
      concern      = excluded.concern,
      curiosity    = excluded.curiosity,
      confidence   = excluded.confidence,
      last_updated = excluded.last_updated
  `).run({
    student_id:   studentId,
    concern:      updated.concern,
    curiosity:    updated.curiosity,
    confidence:   updated.confidence,
    last_updated: new Date().toISOString(),
  });

  return updated;
}

// ─── Prompt Injection ─────────────────────────────────────────────────────────

/**
 * Compact string injected into the system prompt.
 * Only emitted when emotion state carries meaningful signal.
 */
export function buildEmotionContextString(emotion: EmotionState): string {
  const lines: string[] = [];

  if (emotion.concern > 0.65) {
    lines.push('HIGH CONCERN: Student showing distress signals — prioritize emotional support, reduce complexity');
  } else if (emotion.concern > 0.45) {
    lines.push('MODERATE CONCERN: Monitor frustration — lean toward scaffolding over challenge');
  }

  if (emotion.curiosity > 0.72) {
    lines.push('HIGH CURIOSITY: Unusual reasoning pattern detected — probe deeper before correcting');
  }

  if (emotion.confidence > 0.75) {
    lines.push('HIGH CONFIDENCE: Strong model of this student — bold pedagogical choices are appropriate');
  } else if (emotion.confidence < 0.38) {
    lines.push('LOW CONFIDENCE: Student is unpredictable — default to Socratic probing to gather data');
  }

  if (lines.length === 0) return '';
  return `[TUTOR EMOTION STATE]\n${lines.map(l => `  ${l}`).join('\n')}`;
}

// ─── Agent Bias ───────────────────────────────────────────────────────────────

/**
 * Soft emotion-driven agent bias.
 * Does NOT override critical rules (frustration→HINT, misconception→REPAIR).
 * Only applies when the pipeline has landed on a non-forced default.
 */
export function applyEmotionBias(
  emotion: EmotionState,
  currentAgent: string
): string {
  // High concern + challenge = dangerous combination → downgrade to HINT
  if (emotion.concern > 0.70 && currentAgent === 'CHALLENGE') return 'HINT';

  // Very low confidence → prefer PROBE (gather data, don't assume)
  if (emotion.confidence < 0.30 && currentAgent !== 'REPAIR' && currentAgent !== 'HINT') return 'PROBE';

  return currentAgent;
}
