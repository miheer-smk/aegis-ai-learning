/**
 * AEGIS Memory Consolidation Pipeline
 *
 * Mirrors human memory consolidation (Stickgold, 2005 — sleep-dependent consolidation):
 *   Episodic → Semantic: extract stable facts from session snapshots
 *   Semantic → Identity: surface patterns that define the learner's identity
 *   Pruning: remove noise and stale episodic entries
 *
 * Called at session end (not during chat — zero latency impact).
 *
 * Why this matters:
 *   Without consolidation, memory_snapshots accumulate indefinitely and
 *   episodic layer becomes diluted with noise. Consolidation keeps the
 *   Identity and Semantic layers sharp and accurate over time.
 */

import { getDb } from './db';
import { getCognitiveState, updateCognitiveState } from './cognitiveState';

// ─── Main Entry Point ─────────────────────────────────────────────────────────

/**
 * Full consolidation pipeline. Runs at session end.
 * Safe to call multiple times — idempotent.
 */
export function consolidateMemory(studentId: string): void {
  consolidateEpisodicToSemantic(studentId);
  updateIdentityFromSemantic(studentId);
  pruneOldEpisodicSnapshots(studentId);
}

// ─── Stage 1: Episodic → Semantic ────────────────────────────────────────────

/**
 * Scans recent episodic memory snapshots.
 * Extracts recurring patterns → writes to longTermUnderstanding (semantic layer).
 * Identifies persistent misconceptions (seen in >30% of sessions).
 */
function consolidateEpisodicToSemantic(studentId: string): void {
  const db = getDb();

  const snapshots = db.prepare(`
    SELECT summary, keywords, created_at
    FROM   memory_snapshots
    WHERE  student_id = ?
    ORDER  BY created_at DESC
    LIMIT  12
  `).all(studentId) as Array<{ summary: string; keywords: string; created_at: string }>;

  if (snapshots.length < 3) return;

  const state = getCognitiveState(studentId);

  // Accumulate patterns across snapshots
  const masteryCount:   Record<string, number> = {};
  const miscCount:      Record<string, number> = {};
  const breakthroughs:  Record<string, string> = {};

  for (const snap of snapshots) {
    let s: {
      masteredConcepts?:     string[];
      activeMisconceptions?: string[];
      breakthroughs?:        Array<{ concept: string; method: string }>;
    } = {};
    try { s = JSON.parse(snap.summary); } catch { continue; }

    for (const c of (s.masteredConcepts ?? [])) {
      masteryCount[c] = (masteryCount[c] ?? 0) + 1;
    }
    for (const m of (s.activeMisconceptions ?? [])) {
      miscCount[m] = (miscCount[m] ?? 0) + 1;
    }
    for (const b of (s.breakthroughs ?? [])) {
      breakthroughs[b.concept] = b.method; // most recent method wins
    }
  }

  // Write stable mastery to long-term understanding
  const newLTU = { ...state.longTermUnderstanding };
  for (const [concept, count] of Object.entries(masteryCount)) {
    if (count < 2) continue; // skip single-session flukes
    if (!newLTU[concept]) {
      newLTU[concept] = {
        mastery:           0.65,
        confidence:        0.5,
        lastConfirmed:     new Date().toISOString(),
        reviewCount:       count,
        misconceptionCount: miscCount[concept] ?? 0,
      };
    } else {
      // Reinforce existing record
      newLTU[concept].reviewCount   = (newLTU[concept].reviewCount ?? 0) + 1;
      newLTU[concept].lastConfirmed = new Date().toISOString();
    }
    if (breakthroughs[concept]) {
      newLTU[concept].breakthroughMethod = breakthroughs[concept];
    }
  }

  // Flag persistent misconceptions (seen in >30% of snapshots)
  const threshold = Math.max(2, snapshots.length * 0.3);
  const persistent = Object.entries(miscCount)
    .filter(([, count]) => count >= threshold)
    .map(([concept]) => concept);

  const newHistory = [...state.misconceptionHistory];
  for (const concept of persistent) {
    const alreadyTracked = newHistory.some(m => m.concept === concept && !m.resolvedAt);
    if (!alreadyTracked) {
      newHistory.push({
        concept,
        description:          `Persisted across ${miscCount[concept]} sessions — needs direct repair`,
        severity:             'medium',
        detectedAt:           new Date().toISOString(),
        resolutionAttempts:   0,
      });
    }
  }

  updateCognitiveState(studentId, {
    longTermUnderstanding: newLTU,
    misconceptionHistory:  newHistory,
  });
}

// ─── Stage 2: Semantic → Identity ────────────────────────────────────────────

/**
 * Updates the Identity layer (Layer 0) from semantic patterns.
 * Specifically: infers and records the student's preferred explanation style.
 */
function updateIdentityFromSemantic(studentId: string): void {
  const state = getCognitiveState(studentId);
  if (state.learningPatterns.totalMessageCount < 20) return;

  const dna = state.dnaEvolution.length > 0
    ? state.dnaEvolution[state.dnaEvolution.length - 1]?.dna
    : null;

  if (!dna) return;

  let style: 'brief' | 'detailed' | 'example-first' | 'theory-first' = 'detailed';

  if (dna.exampleFirst > 0.65) style = 'example-first';
  else if (dna.abstract > 0.65) style = 'theory-first';
  else if (dna.pace === 'fast' && state.learningPatterns.avgFrustrationLevel < 0.3) style = 'brief';

  // Only update if changed
  if (state.learningPatterns.preferredExplanationStyle !== style) {
    updateCognitiveState(studentId, {
      learningPatterns: {
        ...state.learningPatterns,
        preferredExplanationStyle: style,
      },
    });
  }
}

// ─── Stage 3: Pruning ─────────────────────────────────────────────────────────

/**
 * Keeps only the 20 most recent episodic snapshots.
 * The rest have been consolidated into semantic/identity layers and can be discarded.
 */
function pruneOldEpisodicSnapshots(studentId: string): void {
  const db = getDb();

  db.prepare(`
    DELETE FROM memory_snapshots
    WHERE student_id = ?
      AND id NOT IN (
        SELECT id FROM memory_snapshots
        WHERE  student_id = ?
        ORDER  BY created_at DESC
        LIMIT  20
      )
  `).run(studentId, studentId);
}

// ─── Diagnostics ─────────────────────────────────────────────────────────────

export function getConsolidationSummary(studentId: string): string {
  const state = getCognitiveState(studentId);
  const mastered    = Object.keys(state.longTermUnderstanding).length;
  const persistent  = state.misconceptionHistory.filter(m => !m.resolvedAt).length;

  if (mastered === 0) return '';
  return (
    `[CONSOLIDATED MEMORY: ${mastered} concepts in long-term store, ` +
    `${persistent} unresolved misconception${persistent !== 1 ? 's' : ''}]`
  );
}
