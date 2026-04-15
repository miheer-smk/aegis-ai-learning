/**
 * AEGIS Tutor Self-Model
 *
 * This is the tutor's own persistent identity — what AEGIS knows about
 * itself as a teacher. Unlike student models (which track per-student state),
 * the tutor profile is global and accumulates wisdom across ALL students.
 *
 * What is stored:
 *   - Per-agent effectiveness rates (empirical, not hardcoded)
 *   - Accumulated teaching wisdom (auto-generated insights)
 *   - Population-level statistics (how many students, avg improvement)
 *
 * Why this matters:
 *   Without this, AEGIS treats every interaction as if it's never taught before.
 *   With this, AEGIS has a growing sense of what actually works — and can
 *   inject that knowledge into every future student's experience.
 *
 * This is the simplest possible form of institutional memory.
 */

import { getDb } from './db';
import type { AgentType } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AgentOutcome {
  avgMasteryDelta: number;
  avgFrustrationDelta: number; // negative = frustration reduced = good
  count: number;
  successRate: number;         // fraction of uses where mastery improved
}

export interface TutorProfile {
  agentOutcomes: Record<AgentType, AgentOutcome>;
  preferredStyles: Record<string, number>;   // explanation style → effectiveness score
  teachingWisdom: string[];                  // auto-generated insights
  totalStudentsTaught: number;
  totalSessions: number;
  avgMasteryImprovement: number;
  lastUpdated: string;
}

const DEFAULT_OUTCOME: AgentOutcome = {
  avgMasteryDelta: 0,
  avgFrustrationDelta: 0,
  count: 0,
  successRate: 0.5,
};

function makeDefaultProfile(): TutorProfile {
  return {
    agentOutcomes: {
      PROBE:     { ...DEFAULT_OUTCOME },
      HINT:      { ...DEFAULT_OUTCOME },
      REPAIR:    { ...DEFAULT_OUTCOME },
      CHALLENGE: { ...DEFAULT_OUTCOME },
      META:      { ...DEFAULT_OUTCOME },
      FEYNMAN:   { ...DEFAULT_OUTCOME },
    },
    preferredStyles: {},
    teachingWisdom: [],
    totalStudentsTaught: 0,
    totalSessions: 0,
    avgMasteryImprovement: 0,
    lastUpdated: new Date().toISOString(),
  };
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export function getTutorProfile(): TutorProfile {
  const db = getDb();
  const row = db.prepare(
    "SELECT * FROM tutor_profile WHERE id = 'global'"
  ).get() as Record<string, unknown> | undefined;

  if (!row) return makeDefaultProfile();

  return {
    agentOutcomes:         parseJSON(row.agent_success_rates, makeDefaultProfile().agentOutcomes),
    preferredStyles:       parseJSON(row.preferred_explanation_styles, {}),
    teachingWisdom:        parseJSON(row.teaching_wisdom, []),
    totalStudentsTaught:   (row.total_students_taught as number) || 0,
    totalSessions:         (row.total_sessions as number) || 0,
    avgMasteryImprovement: (row.avg_mastery_improvement as number) || 0,
    lastUpdated:           (row.last_updated as string) || new Date().toISOString(),
  };
}

// ─── Write ────────────────────────────────────────────────────────────────────

export function saveTutorProfile(profile: TutorProfile): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO tutor_profile (
      id, agent_success_rates, preferred_explanation_styles,
      teaching_wisdom, total_students_taught, total_sessions,
      avg_mastery_improvement, last_updated
    ) VALUES (
      'global', @agent_success_rates, @preferred_explanation_styles,
      @teaching_wisdom, @total_students_taught, @total_sessions,
      @avg_mastery_improvement, @last_updated
    )
    ON CONFLICT(id) DO UPDATE SET
      agent_success_rates          = excluded.agent_success_rates,
      preferred_explanation_styles = excluded.preferred_explanation_styles,
      teaching_wisdom              = excluded.teaching_wisdom,
      total_students_taught        = excluded.total_students_taught,
      total_sessions               = excluded.total_sessions,
      avg_mastery_improvement      = excluded.avg_mastery_improvement,
      last_updated                 = excluded.last_updated
  `).run({
    agent_success_rates:          JSON.stringify(profile.agentOutcomes),
    preferred_explanation_styles: JSON.stringify(profile.preferredStyles),
    teaching_wisdom:              JSON.stringify(profile.teachingWisdom.slice(-25)),
    total_students_taught:        profile.totalStudentsTaught,
    total_sessions:               profile.totalSessions,
    avg_mastery_improvement:      profile.avgMasteryImprovement,
    last_updated:                 new Date().toISOString(),
  });
}

// ─── Record Outcome ───────────────────────────────────────────────────────────

/**
 * Called after each interaction. Updates empirical success rates per agent.
 * Runs in the fire-and-forget background pipeline.
 */
export function recordAgentOutcome(
  agentUsed: AgentType,
  masteryDelta: number,
  frustrationDelta: number
): void {
  const profile = getTutorProfile();
  const outcomes = { ...profile.agentOutcomes };
  const curr = outcomes[agentUsed] ?? { ...DEFAULT_OUTCOME };

  const n = curr.count + 1;
  const improved = masteryDelta > 0 ? 1 : 0;

  outcomes[agentUsed] = {
    avgMasteryDelta:     (curr.avgMasteryDelta * curr.count + masteryDelta) / n,
    avgFrustrationDelta: (curr.avgFrustrationDelta * curr.count + frustrationDelta) / n,
    count:               n,
    successRate:         (curr.successRate * curr.count + improved) / n,
  };

  // Auto-generate wisdom milestones at count thresholds
  const wisdom = [...profile.teachingWisdom];
  if (n > 0 && n % 30 === 0) {
    const sorted = (Object.entries(outcomes) as [AgentType, AgentOutcome][])
      .filter(([, v]) => v.count > 5)
      .sort((a, b) => b[1].avgMasteryDelta - a[1].avgMasteryDelta);

    if (sorted.length > 0) {
      const [bestAgent, bestStats] = sorted[0];
      const insight =
        `After ${profile.totalSessions + 1} sessions: ${bestAgent} yields +${(bestStats.avgMasteryDelta * 100).toFixed(1)}% mastery per use (${Math.round(bestStats.successRate * 100)}% success rate) — most effective agent overall`;
      wisdom.push(insight);
    }
  }

  saveTutorProfile({ ...profile, agentOutcomes: outcomes, teachingWisdom: wisdom });
}

// ─── Session Update ───────────────────────────────────────────────────────────

/** Called at session end — updates population-level statistics */
export function recordSessionOutcome(
  masteryImprovement: number,
  isNewStudent: boolean
): void {
  const profile = getTutorProfile();
  saveTutorProfile({
    ...profile,
    totalSessions:         profile.totalSessions + 1,
    totalStudentsTaught:   isNewStudent ? profile.totalStudentsTaught + 1 : profile.totalStudentsTaught,
    avgMasteryImprovement:
      (profile.avgMasteryImprovement * profile.totalSessions + masteryImprovement) /
      (profile.totalSessions + 1),
  });
}

// ─── Prompt Injection ─────────────────────────────────────────────────────────

/**
 * Compact string injected into system prompt.
 * Gives AEGIS access to its own accumulated institutional knowledge.
 */
export function buildTutorStateString(profile: TutorProfile): string {
  if (profile.totalSessions < 5) return '';

  const lines: string[] = ['[TUTOR SELF-MODEL]'];

  // Best performing agents (empirically, not hardcoded)
  const top = (Object.entries(profile.agentOutcomes) as [AgentType, AgentOutcome][])
    .filter(([, v]) => v.count > 3)
    .sort((a, b) => b[1].avgMasteryDelta - a[1].avgMasteryDelta)
    .slice(0, 2);

  if (top.length > 0) {
    lines.push(
      `  Empirically most effective: ${top.map(([a, v]) =>
        `${a}(+${(v.avgMasteryDelta * 100).toFixed(0)}%, ${Math.round(v.successRate * 100)}% success)`
      ).join(', ')}`
    );
  }

  if (profile.teachingWisdom.length > 0) {
    const latest = profile.teachingWisdom[profile.teachingWisdom.length - 1];
    lines.push(`  Wisdom: "${latest}"`);
  }

  lines.push(
    `  ${profile.totalStudentsTaught} students taught, ` +
    `avg mastery improvement: +${(profile.avgMasteryImprovement * 100).toFixed(1)}%`
  );

  return lines.join('\n');
}

// ─── Utils ────────────────────────────────────────────────────────────────────

function parseJSON<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string') return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}
