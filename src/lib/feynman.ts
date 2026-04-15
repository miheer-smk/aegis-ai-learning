/**
 * AEGIS Feynman Technique Engine
 *
 * The Feynman Technique (Feynman, 1985):
 * 1. Choose a concept
 * 2. Teach it in simple language as if to a child
 * 3. Identify gaps and return to source material
 * 4. Simplify and use analogies
 *
 * In AEGIS, this is triggered when a concept reaches mastery > 0.6,
 * asking: "Explain this concept as if teaching a 10-year-old."
 * The explanation is then scored for clarity and depth.
 * Strong → mastery boost. Weak → route to REPAIR agent.
 */

import { callClaudeJSON } from './anthropic';
import { buildFeynmanEvaluationPrompt, FEYNMAN_SYSTEM_PROMPT } from './prompts';
import { getDb } from './db';
import type { FeynmanResult, AgentType, ConceptNode } from '@/types';

// ─── Trigger Detection ────────────────────────────────────────────────────────

/**
 * Returns concepts ready for Feynman challenge:
 * mastery > 0.6 and not yet Feynman-tested (feynman_clarity is null)
 * or last tested more than 5 reviews ago.
 */
export function getFeynmanCandidates(concepts: ConceptNode[]): ConceptNode[] {
  return concepts.filter(c => {
    const readyMastery = c.mastery > 0.6;
    const notTested = !c.feynman_clarity;
    const recentlyImproved = c.review_count > 0 && c.review_count % 5 === 0;
    return readyMastery && (notTested || recentlyImproved);
  });
}

/**
 * Returns the Feynman trigger prompt to send as the assistant message.
 * This starts the Feynman evaluation cycle.
 */
export function buildFeynmanTriggerMessage(concept: string): string {
  return `You're doing well with **${concept}**! Let's test how deeply you understand it.

Imagine you need to explain **${concept}** to a 10-year-old who has never heard of it before. No jargon allowed — just your own words, a simple explanation, and maybe an analogy or real-world example.

Go ahead — teach me!`;
}

// ─── Evaluation ───────────────────────────────────────────────────────────────

/**
 * Evaluates a student's Feynman explanation using Claude.
 * Returns structured feedback with clarity/depth scores.
 */
export async function evaluateFeynmanExplanation(
  concept: string,
  studentExplanation: string,
  topic: string
): Promise<FeynmanResult> {
  const raw = await callClaudeJSON<{
    clarityScore: number;
    depthScore: number;
    gaps: string[];
    strengths: string[];
    isStrong: boolean;
    feedback: string;
  }>(
    FEYNMAN_SYSTEM_PROMPT,
    buildFeynmanEvaluationPrompt(concept, studentExplanation, topic),
    512
  );

  if (!raw) {
    return {
      clarityScore: 0.5,
      depthScore: 0.5,
      gaps: [],
      strengths: [],
      isStrong: false,
      feedback: 'Keep working on simplifying your explanation.',
      triggeredAgent: 'REPAIR',
    };
  }

  // Determine which agent to trigger next
  const triggeredAgent: AgentType = raw.isStrong ? 'CHALLENGE' : 'REPAIR';

  return {
    clarityScore: Math.min(1, Math.max(0, raw.clarityScore || 0)),
    depthScore: Math.min(1, Math.max(0, raw.depthScore || 0)),
    gaps: Array.isArray(raw.gaps) ? raw.gaps : [],
    strengths: Array.isArray(raw.strengths) ? raw.strengths : [],
    isStrong: raw.isStrong ?? false,
    feedback: raw.feedback || 'Keep working on simplifying your explanation.',
    triggeredAgent,
  };
}

// ─── DB Update ────────────────────────────────────────────────────────────────

/**
 * Persists Feynman scores back to the concept node.
 * Applies mastery boost if strong, no penalty if weak (REPAIR handles that).
 */
export function saveFeynmanResult(
  studentId: string,
  concept: string,
  result: FeynmanResult
): void {
  const db = getDb();

  // Run migration to ensure columns exist
  try {
    db.exec(`ALTER TABLE concept_nodes ADD COLUMN feynman_clarity REAL`);
  } catch { /* column already exists */ }
  try {
    db.exec(`ALTER TABLE concept_nodes ADD COLUMN feynman_depth REAL`);
  } catch { /* column already exists */ }

  const masteryBoost = result.isStrong ? 0.08 : 0;

  db.prepare(`
    UPDATE concept_nodes
    SET
      feynman_clarity = ?,
      feynman_depth   = ?,
      mastery         = MIN(1.0, mastery + ?),
      last_reviewed   = datetime('now'),
      review_count    = review_count + 1
    WHERE student_id = ? AND concept = ?
  `).run(result.clarityScore, result.depthScore, masteryBoost, studentId, concept);
}

// ─── Feynman Concept Detector from Conversation ───────────────────────────────

/**
 * Detects if the previous assistant message was a Feynman trigger.
 * If so, extracts the concept name so we can evaluate the user's reply.
 */
export function detectFeynmanContext(
  lastAssistantMessage: string
): { isFeynmanResponse: boolean; concept: string | null } {
  const match = lastAssistantMessage.match(/explain\s+\*\*(.+?)\*\*\s+to\s+a\s+10-year-old/i)
    || lastAssistantMessage.match(/teach\s+me.*\*\*(.+?)\*\*/i)
    || lastAssistantMessage.match(/doing\s+well\s+with\s+\*\*(.+?)\*\*/i);

  if (match) {
    return { isFeynmanResponse: true, concept: match[1] };
  }
  return { isFeynmanResponse: false, concept: null };
}
