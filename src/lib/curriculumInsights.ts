/**
 * AEGIS Cross-Student Curriculum Intelligence
 *
 * Every student who uses AEGIS teaches AEGIS something.
 * This module aggregates patterns across ALL students to build
 * population-level intelligence that benefits every individual.
 *
 * What it tracks:
 *   common_misconception — concepts where multiple students share the same wrong belief
 *   difficulty_spike     — concepts requiring unusually many review sessions
 *   failure_cluster      — topics associated with high frustration across students
 *   mastery_pattern      — concepts that students tend to master together
 *
 * How it's used:
 *   - Injected into system prompt as a small context block per relevant concept
 *   - AEGIS can pre-empt known-difficult concepts before errors occur
 *   - AEGIS knows "70% of students who hit this concept get confused here"
 */

import { getDb } from './db';
import { v4 as uuidv4 } from 'uuid';

// ─── Types ────────────────────────────────────────────────────────────────────

export type InsightType =
  | 'common_misconception'
  | 'difficulty_spike'
  | 'failure_cluster'
  | 'mastery_pattern';

export interface CurriculumInsight {
  id: string;
  insightType: InsightType;
  concept: string | null;
  data: Record<string, unknown>;
  studentCount: number;
  confidence: number;      // [0..1] grows with sample size
  generatedAt: string;
}

// ─── Aggregation (called by background cognition cycle) ───────────────────────

/**
 * Runs aggregate queries across ALL students.
 * Updates or inserts curriculum_insights rows.
 * Called every background cycle — pure SQL, no LLM.
 */
export function aggregateCurriculumInsights(): void {
  aggregateMisconceptions();
  aggregateDifficultySpikes();
  aggregateFailureClusters();
}

function aggregateMisconceptions(): void {
  const db = getDb();

  const rows = db.prepare(`
    SELECT concept,
           COUNT(DISTINCT student_id) AS student_count,
           AVG(mastery)               AS avg_mastery
    FROM   concept_nodes
    WHERE  json_array_length(misconception) > 0
    GROUP  BY concept
    HAVING student_count > 1
    ORDER  BY student_count DESC
    LIMIT  15
  `).all() as Array<{ concept: string; student_count: number; avg_mastery: number }>;

  for (const row of rows) {
    upsertInsight({
      insightType:  'common_misconception',
      concept:       row.concept,
      data:         { avgMastery: row.avg_mastery, studentCount: row.student_count },
      studentCount: row.student_count,
      confidence:   Math.min(1, row.student_count / 5),
    });
  }
}

function aggregateDifficultySpikes(): void {
  const db = getDb();

  const rows = db.prepare(`
    SELECT concept,
           COUNT(DISTINCT student_id) AS student_count,
           AVG(mastery)               AS avg_mastery,
           AVG(review_count)          AS avg_reviews
    FROM   concept_nodes
    GROUP  BY concept
    HAVING student_count > 1 AND avg_mastery < 0.45
    ORDER  BY avg_mastery ASC
    LIMIT  10
  `).all() as Array<{
    concept: string;
    student_count: number;
    avg_mastery: number;
    avg_reviews: number;
  }>;

  for (const row of rows) {
    upsertInsight({
      insightType:  'difficulty_spike',
      concept:       row.concept,
      data:         {
        avgMastery:   row.avg_mastery,
        avgReviews:   row.avg_reviews,
        studentCount: row.student_count,
      },
      studentCount: row.student_count,
      confidence:   Math.min(1, row.student_count / 3),
    });
  }
}

function aggregateFailureClusters(): void {
  const db = getDb();

  // Find topics (by agent type context) with persistent high frustration
  const rows = db.prepare(`
    SELECT agent_type,
           COUNT(*)                    AS msg_count,
           AVG(frustration_level)      AS avg_frustration,
           COUNT(DISTINCT student_id)  AS student_count
    FROM   chat_messages
    WHERE  frustration_level > 0.55
    GROUP  BY agent_type
    HAVING msg_count > 5
  `).all() as Array<{
    agent_type: string;
    msg_count: number;
    avg_frustration: number;
    student_count: number;
  }>;

  for (const row of rows) {
    upsertInsight({
      insightType:  'failure_cluster',
      concept:       null,
      data:         {
        agentType:      row.agent_type,
        avgFrustration: row.avg_frustration,
        messageCount:   row.msg_count,
      },
      studentCount: row.student_count,
      confidence:   Math.min(1, row.msg_count / 20),
    });
  }
}

function upsertInsight(
  data: Omit<CurriculumInsight, 'id' | 'generatedAt'>
): void {
  const db = getDb();
  const now = new Date().toISOString();

  const existing = db.prepare(`
    SELECT id FROM curriculum_insights
    WHERE insight_type = ?
      AND (concept = ? OR (concept IS NULL AND ? IS NULL))
  `).get(data.insightType, data.concept ?? null, data.concept ?? null) as { id: string } | undefined;

  if (existing) {
    db.prepare(`
      UPDATE curriculum_insights
      SET data = @data, student_count = @student_count,
          confidence = @confidence, generated_at = @generated_at
      WHERE id = @id
    `).run({
      id:            existing.id,
      data:          JSON.stringify(data.data),
      student_count: data.studentCount,
      confidence:    data.confidence,
      generated_at:  now,
    });
  } else {
    db.prepare(`
      INSERT INTO curriculum_insights
        (id, insight_type, concept, data, student_count, confidence, generated_at)
      VALUES
        (@id, @insight_type, @concept, @data, @student_count, @confidence, @generated_at)
    `).run({
      id:            uuidv4(),
      insight_type:  data.insightType,
      concept:       data.concept ?? null,
      data:          JSON.stringify(data.data),
      student_count: data.studentCount,
      confidence:    data.confidence,
      generated_at:  now,
    });
  }
}

// ─── Prompt Injection ─────────────────────────────────────────────────────────

/**
 * Returns a compact insight string for a specific concept being discussed.
 * Injected into system prompt to pre-empt known-difficult concepts.
 */
export function getCurriculumInsightForConcept(concept: string): string {
  const db = getDb();

  const rows = db.prepare(`
    SELECT insight_type, data, student_count, confidence
    FROM   curriculum_insights
    WHERE  concept = ? AND confidence > 0.35
    ORDER  BY confidence DESC
    LIMIT  2
  `).all(concept) as Array<{
    insight_type: string;
    data: string;
    student_count: number;
    confidence: number;
  }>;

  if (rows.length === 0) return '';

  const lines: string[] = [`[POPULATION DATA — ${concept}]`];

  for (const row of rows) {
    let d: Record<string, unknown> = {};
    try { d = JSON.parse(row.data); } catch { /* */ }

    if (row.insight_type === 'common_misconception') {
      lines.push(
        `  ⚠ ${row.student_count} students have struggled here ` +
        `(avg mastery: ${Math.round((d.avgMastery as number || 0) * 100)}%) — ` +
        `pre-empt confusion before it occurs`
      );
    } else if (row.insight_type === 'difficulty_spike') {
      lines.push(
        `  ⚠ Difficulty spike: avg ${Math.round(d.avgReviews as number || 1)} reviews needed ` +
        `across ${row.student_count} students — go slower than usual here`
      );
    }
  }

  if (lines.length === 1) return '';
  return lines.join('\n');
}

/**
 * Returns a top-level summary of cross-student insights.
 * Used in the global difficulty section of hierarchical memory.
 */
export function getTopCurriculumInsights(): string {
  const db = getDb();

  const rows = db.prepare(`
    SELECT insight_type, concept, data, student_count, confidence
    FROM   curriculum_insights
    WHERE  confidence > 0.5 AND concept IS NOT NULL
    ORDER  BY confidence DESC, student_count DESC
    LIMIT  4
  `).all() as Array<{
    insight_type: string;
    concept: string | null;
    data: string;
    student_count: number;
    confidence: number;
  }>;

  if (rows.length === 0) return '';

  const lines: string[] = ['[CROSS-STUDENT INTELLIGENCE]'];

  for (const row of rows) {
    if (row.insight_type === 'common_misconception' && row.concept) {
      lines.push(
        `  ${row.concept}: ${row.student_count} students struggled ` +
        `(${Math.round(row.confidence * 100)}% confidence)`
      );
    } else if (row.insight_type === 'difficulty_spike' && row.concept) {
      lines.push(`  ${row.concept}: difficulty spike — needs extra scaffolding`);
    }
  }

  if (lines.length === 1) return '';
  return lines.join('\n');
}
