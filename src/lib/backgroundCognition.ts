/**
 * AEGIS Always-On Cognition Layer
 *
 * This is what makes AEGIS persistent — it thinks between sessions.
 *
 * Architecture:
 *   A setInterval loop is registered as a global singleton (same pattern as
 *   the DB connection). In Next.js dev mode it starts on the first request;
 *   in production it starts once and runs for the lifetime of the process.
 *
 * What runs every 5 minutes:
 *   1. Query all active students (active in last 30 days)
 *   2. For each student:
 *      a. Run predictive model (Ebbinghaus decay, dropout risk)
 *      b. Generate autonomous tasks based on risk signals
 *      c. Emit events for elevated dropout risk
 *   3. Aggregate cross-student curriculum insights
 *   4. Emit time_trigger event
 *
 * CRITICAL DESIGN CONSTRAINT:
 *   - NO LLM calls in the background cycle (cost + latency)
 *   - All computation is pure: DB reads + math + DB writes
 *   - Cycle must complete in < 2 seconds for any reasonable student count
 *   - Any errors are silently swallowed — background NEVER crashes the server
 */

import { getDb } from './db';
import { predictFutureState } from './predictiveModel';
import { generateAutonomousTasks } from './autonomousTasks';
import { aggregateCurriculumInsights } from './curriculumInsights';
import { emitTimeTrigger, emitDropoutRisk } from './eventSystem';
import type { ConceptNode } from '@/types';

// ─── Singleton Guard ──────────────────────────────────────────────────────────

const globalCognition = globalThis as typeof globalThis & {
  aegisBackgroundStarted?: boolean;
  aegisBackgroundTimer?:   ReturnType<typeof setInterval>;
};

const CYCLE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// ─── Cognition Cycle ──────────────────────────────────────────────────────────

function runCognitionCycle(): void {
  try {
    const db = getDb();

    // All students active in the last 30 days (or with no messages yet)
    const students = db.prepare(`
      SELECT s.id,
             COALESCE(MAX(cm.timestamp), s.created_at) AS last_active
      FROM   students s
      LEFT   JOIN chat_messages cm ON cm.student_id = s.id
      GROUP  BY s.id
      HAVING last_active > datetime('now', '-30 days')
         OR  MAX(cm.timestamp) IS NULL
    `).all() as Array<{ id: string; last_active: string }>;

    for (const student of students) {
      processStudentCognition(student.id, student.last_active);
    }

    // Aggregate cross-student insights once per cycle
    aggregateCurriculumInsights();

    // Signal that a cycle completed
    emitTimeTrigger({ studentsProcessed: students.length });

    console.log(
      `[AEGIS Background] Cycle complete — ${students.length} student(s) processed`
    );
  } catch (err) {
    // Silently swallow — background cognition MUST NOT crash the server
    console.error(
      '[AEGIS Background] Cycle error:',
      err instanceof Error ? err.message : String(err)
    );
  }
}

function processStudentCognition(studentId: string, lastActiveAt: string): void {
  try {
    const db = getDb();

    // Load concept nodes
    const rawNodes = db.prepare(
      'SELECT * FROM concept_nodes WHERE student_id = ?'
    ).all(studentId) as ConceptNode[];

    if (rawNodes.length === 0) return;

    // Parse misconception JSON (stored as string in SQLite)
    const conceptNodes = rawNodes.map(n => ({
      ...n,
      misconception: parseJsonSafe(n.misconception as unknown as string, []),
    })) as ConceptNode[];

    // Load frustration + message count from cognitive state
    const stateRow = db.prepare(
      'SELECT learning_patterns FROM cognitive_state WHERE student_id = ?'
    ).get(studentId) as { learning_patterns: string } | undefined;

    let avgFrustration = 0;
    let totalMessages  = 0;
    if (stateRow) {
      const patterns = parseJsonSafe(stateRow.learning_patterns, {
        avgFrustrationLevel: 0,
        totalMessageCount:   0,
      });
      avgFrustration = patterns.avgFrustrationLevel ?? 0;
      totalMessages  = patterns.totalMessageCount   ?? 0;
    }

    // Run predictive model (pure math, no LLM)
    const predictive = predictFutureState(
      studentId, conceptNodes, avgFrustration, totalMessages
    );

    // Generate proactive tasks based on risk signals
    generateAutonomousTasks(
      studentId, conceptNodes, avgFrustration, lastActiveAt, predictive.dropoutRisk
    );

    // Emit dropout risk event if elevated
    if (predictive.dropoutRisk > 0.6) {
      emitDropoutRisk(studentId, predictive.dropoutRisk);
    }

  } catch (err) {
    console.error(
      `[AEGIS Background] Error processing student ${studentId}:`,
      err instanceof Error ? err.message : String(err)
    );
  }
}

// ─── Start / Stop ─────────────────────────────────────────────────────────────

/**
 * Starts the always-on cognition loop.
 * Call this once from any API route handler.
 * The globalThis guard ensures it only ever starts once,
 * even across Next.js hot reloads.
 */
export function startBackgroundCognition(): void {
  if (globalCognition.aegisBackgroundStarted) return;
  globalCognition.aegisBackgroundStarted = true;

  // First cycle: 15s after startup (let the server stabilize first)
  setTimeout(() => runCognitionCycle(), 15_000);

  // Recurring cycle: every 5 minutes
  globalCognition.aegisBackgroundTimer = setInterval(
    () => runCognitionCycle(),
    CYCLE_INTERVAL_MS
  );

  console.log('[AEGIS Background] Always-on cognition started (5-min cycle)');
}

export function stopBackgroundCognition(): void {
  if (globalCognition.aegisBackgroundTimer) {
    clearInterval(globalCognition.aegisBackgroundTimer);
    globalCognition.aegisBackgroundTimer   = undefined;
    globalCognition.aegisBackgroundStarted = false;
    console.log('[AEGIS Background] Cognition loop stopped');
  }
}

/** Manual trigger — useful for testing or admin endpoints */
export function triggerCognitionCycle(): Promise<void> {
  return new Promise(resolve => {
    setTimeout(() => {
      runCognitionCycle();
      resolve();
    }, 0);
  });
}

// ─── Utils ────────────────────────────────────────────────────────────────────

function parseJsonSafe<T>(value: string, fallback: T): T {
  try { return JSON.parse(value) as T; } catch { return fallback; }
}
