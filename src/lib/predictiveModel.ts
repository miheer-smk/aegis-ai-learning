/**
 * AEGIS Predictive Learning Model
 *
 * Forward-projects the student's knowledge state using:
 *   - Ebbinghaus forgetting curve (decay per concept)
 *   - Session behavior patterns (velocity, dropout risk)
 *   - Prerequisite graph (bottleneck propagation)
 *   - Mastery trajectory (trend, not just snapshot)
 *
 * Pure computation — NO LLM calls. Runs synchronously in <5ms.
 *
 * Output:
 *   predictedRiskMap  — per-concept risk score 7 days out
 *   learningPath      — ordered list of recommended next concepts
 *   bottlenecks       — concepts blocking the largest subtree
 *   dropoutRisk       — probability student disengages before goal
 */

import { getDb } from './db';
import type { ConceptNode } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ConceptRisk {
  concept: string;
  currentMastery: number;
  predictedRetention7d: number;   // estimated retention 7 days from now
  riskScore: number;               // [0..1] composite risk
  riskReason: 'decay' | 'low_mastery' | 'misconception' | 'prerequisite_gap' | 'stale';
  urgency: 'critical' | 'high' | 'medium' | 'low';
}

export interface LearningPathItem {
  concept: string;
  reason: string;
  estimatedSessions: number;    // rough estimate to reach mastery
  prerequisitesMet: boolean;
  priority: number;             // higher = more important to tackle first
}

export interface PredictiveModel {
  predictedRiskMap: ConceptRisk[];
  learningPath: LearningPathItem[];
  bottlenecks: string[];           // concept names
  dropoutRisk: number;             // [0..1]
  projectedMastery7d: number;      // avg mastery after 7 days without review
  projectedMastery30d: number;
  strongestConcept: string | null;
  weakestConcept: string | null;
  sessionVelocity: number;         // avg concepts gaining mastery per session
  estimatedSessionsToGoal: number; // rough sessions needed to reach goal mastery
}

// ─── Prerequisite Graph (hardcoded heuristics) ────────────────────────────────

/**
 * Infers rough prerequisite relationships from concept names.
 * In production, this would be a domain ontology. Here we use keyword signals.
 */
function inferPrerequisites(concept: string, allConcepts: string[]): string[] {
  const lower = concept.toLowerCase();
  const prereqs: string[] = [];

  for (const c of allConcepts) {
    if (c === concept) continue;
    const cl = c.toLowerCase();

    // "advanced X" requires "X"
    if (lower.includes('advanced') && lower.includes(cl.replace('advanced', '').trim())) {
      prereqs.push(c);
    }
    // "X applications" requires "X"
    if (lower.includes('application') && lower.includes(cl)) {
      prereqs.push(c);
    }
    // Differentiation ← limits; integration ← differentiation
    if (lower === 'differentiation' && cl === 'limits') prereqs.push(c);
    if (lower === 'integration' && cl === 'differentiation') prereqs.push(c);
    if (lower === 'probability' && (cl === 'statistics' || cl === 'combinations')) prereqs.push(c);
    if (lower === 'recursion' && cl === 'functions') prereqs.push(c);
    if (lower === 'linked lists' && cl === 'pointers') prereqs.push(c);
    if (lower === 'binary search' && cl === 'arrays') prereqs.push(c);
  }

  return Array.from(new Set(prereqs));
}

// ─── Risk Scoring ─────────────────────────────────────────────────────────────

function computeRetentionAt(lastReviewed: string, stability: number, daysAhead: number): number {
  const now = Date.now();
  const last = new Date(lastReviewed).getTime();
  const daysElapsed = (now - last) / (1000 * 60 * 60 * 24);
  return Math.exp(-(daysElapsed + daysAhead) / Math.max(0.5, stability));
}

function scoreConceptRisk(node: ConceptNode, allConcepts: string[]): ConceptRisk {
  const retention7d = computeRetentionAt(node.last_reviewed, node.stability, 7);
  const hasMisconception = Array.isArray(node.misconception) && node.misconception.length > 0;

  const prereqs = inferPrerequisites(node.concept, allConcepts);
  const prereqGap = prereqs.length > 0;  // simplified: assume gap if prereqs exist

  // Staleness: how long since last review (in days)
  const daysSinceReview = node.last_reviewed
    ? Math.max(0, (Date.now() - new Date(node.last_reviewed).getTime()) / 86_400_000)
    : 999;

  let riskReason: ConceptRisk['riskReason'] = 'low_mastery';
  let riskScore = 0;

  if (node.mastery < 0.3) {
    riskScore = 0.8;
    riskReason = 'low_mastery';
  } else if (hasMisconception) {
    riskScore = 0.75;
    riskReason = 'misconception';
  } else if (retention7d < 0.5 && node.mastery > 0.4) {
    riskScore = 0.65;
    riskReason = 'decay';
  } else if (prereqGap && node.mastery < 0.5) {
    riskScore = 0.6;
    riskReason = 'prerequisite_gap';
  } else if (daysSinceReview > 14) {
    riskScore = 0.5;
    riskReason = 'stale';
  } else {
    riskScore = (1 - node.mastery) * 0.4 + (1 - retention7d) * 0.6;
    riskReason = 'decay';
  }

  // Clamp
  riskScore = Math.max(0, Math.min(1, riskScore));

  const urgency: ConceptRisk['urgency'] =
    riskScore >= 0.7 ? 'critical' :
    riskScore >= 0.5 ? 'high' :
    riskScore >= 0.3 ? 'medium' : 'low';

  return {
    concept: node.concept,
    currentMastery: node.mastery,
    predictedRetention7d: retention7d,
    riskScore,
    riskReason,
    urgency,
  };
}

// ─── Bottleneck Detection ─────────────────────────────────────────────────────

/**
 * A bottleneck is a concept whose mastery is low AND is a prerequisite for many others.
 * Fixing it unblocks the largest downstream subtree.
 */
function detectBottlenecks(nodes: ConceptNode[]): string[] {
  const allNames = nodes.map(n => n.concept);
  const dependencyCount: Record<string, number> = {};

  for (const node of nodes) {
    if (node.mastery >= 0.6) continue;  // strong concepts aren't bottlenecks
    const prereqs = inferPrerequisites(node.concept, allNames);
    // Count how many concepts list this as a prereq
    for (const other of nodes) {
      const otherPrereqs = inferPrerequisites(other.concept, allNames);
      if (otherPrereqs.includes(node.concept)) {
        dependencyCount[node.concept] = (dependencyCount[node.concept] || 0) + 1;
      }
    }
  }

  return Object.entries(dependencyCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([c]) => c);
}

// ─── Learning Path Generation ─────────────────────────────────────────────────

function buildLearningPath(
  nodes: ConceptNode[],
  riskMap: ConceptRisk[],
  bottlenecks: string[]
): LearningPathItem[] {
  const allNames = nodes.map(n => n.concept);
  const masteryMap: Record<string, number> = {};
  for (const n of nodes) masteryMap[n.concept] = n.mastery;

  const items: LearningPathItem[] = [];

  // 1. Bottlenecks first (highest leverage)
  for (const b of bottlenecks) {
    const m = masteryMap[b] ?? 0;
    items.push({
      concept: b,
      reason: 'Bottleneck: fixing this unlocks multiple downstream concepts',
      estimatedSessions: Math.ceil((0.8 - m) / 0.15),
      prerequisitesMet: inferPrerequisites(b, allNames).every(p => (masteryMap[p] ?? 0) > 0.5),
      priority: 10,
    });
  }

  // 2. Critical-risk concepts not yet in path
  const inPath = new Set(bottlenecks);
  for (const risk of riskMap.filter(r => r.urgency === 'critical' || r.urgency === 'high')) {
    if (inPath.has(risk.concept)) continue;
    const m = masteryMap[risk.concept] ?? 0;
    items.push({
      concept: risk.concept,
      reason: risk.riskReason === 'misconception'
        ? 'Active misconception needs repair before advancing'
        : risk.riskReason === 'decay'
        ? 'High decay risk — knowledge fading without review'
        : 'Low mastery — needs focused attention',
      estimatedSessions: Math.ceil((0.8 - m) / 0.15),
      prerequisitesMet: inferPrerequisites(risk.concept, allNames).every(p => (masteryMap[p] ?? 0) > 0.5),
      priority: risk.urgency === 'critical' ? 8 : 6,
    });
    inPath.add(risk.concept);
  }

  // 3. Building concepts (mastery 0.4–0.7) — almost there
  for (const node of nodes.filter(n => n.mastery >= 0.4 && n.mastery < 0.7)) {
    if (inPath.has(node.concept)) continue;
    items.push({
      concept: node.concept,
      reason: 'Nearly mastered — a focused session could push to full mastery',
      estimatedSessions: Math.ceil((0.8 - node.mastery) / 0.15),
      prerequisitesMet: inferPrerequisites(node.concept, allNames).every(p => (masteryMap[p] ?? 0) > 0.5),
      priority: 4,
    });
    inPath.add(node.concept);
  }

  // Sort by priority desc, then by prerequisites met first
  return items
    .sort((a, b) => {
      if (a.prerequisitesMet !== b.prerequisitesMet) return a.prerequisitesMet ? -1 : 1;
      return b.priority - a.priority;
    })
    .slice(0, 8);
}

// ─── Session Velocity ─────────────────────────────────────────────────────────

function computeSessionVelocity(studentId: string): number {
  const db = getDb();
  const rows = db.prepare(`
    SELECT COUNT(DISTINCT concept) as gained, strftime('%Y-%W', last_reviewed) as week
    FROM concept_nodes
    WHERE student_id = ? AND mastery > 0.6
    GROUP BY week
    ORDER BY week DESC
    LIMIT 4
  `).all(studentId) as Array<{ gained: number; week: string }>;

  if (rows.length === 0) return 0.5;  // default: 0.5 concepts/session
  const avg = rows.reduce((s, r) => s + r.gained, 0) / rows.length;
  return Math.max(0.1, avg);
}

// ─── Dropout Risk ─────────────────────────────────────────────────────────────

function computeDropoutRisk(
  avgFrustration: number,
  sessionVelocity: number,
  avgMastery: number,
  totalMessages: number
): number {
  // Low velocity + high frustration + low mastery = dropout risk
  const frustrationFactor = avgFrustration * 0.4;
  const velocityFactor = (1 - Math.min(1, sessionVelocity / 2)) * 0.3;
  const masteryFactor = (1 - avgMastery) * 0.2;
  const engagementFactor = totalMessages < 10 ? 0.1 : 0;  // new student risk

  return Math.min(1, frustrationFactor + velocityFactor + masteryFactor + engagementFactor);
}

// ─── Main Export ──────────────────────────────────────────────────────────────

/**
 * Runs the full predictive model for a student.
 * Pure computation — no API calls.
 * Returns a rich risk map + learning path + meta-predictions.
 */
export function predictFutureState(
  studentId: string,
  conceptNodes: ConceptNode[],
  avgFrustration: number,
  totalMessages: number
): PredictiveModel {
  if (conceptNodes.length === 0) {
    return {
      predictedRiskMap: [],
      learningPath: [],
      bottlenecks: [],
      dropoutRisk: 0.2,
      projectedMastery7d: 0,
      projectedMastery30d: 0,
      strongestConcept: null,
      weakestConcept: null,
      sessionVelocity: 0.5,
      estimatedSessionsToGoal: 20,
    };
  }

  const allNames = conceptNodes.map(n => n.concept);
  const riskMap = conceptNodes
    .map(n => scoreConceptRisk(n, allNames))
    .sort((a, b) => b.riskScore - a.riskScore);

  const bottlenecks = detectBottlenecks(conceptNodes);
  const learningPath = buildLearningPath(conceptNodes, riskMap, bottlenecks);

  const sessionVelocity = computeSessionVelocity(studentId);
  const avgMastery = conceptNodes.reduce((s, n) => s + n.mastery, 0) / conceptNodes.length;

  // Project mastery forward assuming no review (pure decay)
  const projected7d = conceptNodes.reduce((s, n) => {
    const r = computeRetentionAt(n.last_reviewed, n.stability, 7);
    return s + n.mastery * r;
  }, 0) / conceptNodes.length;

  const projected30d = conceptNodes.reduce((s, n) => {
    const r = computeRetentionAt(n.last_reviewed, n.stability, 30);
    return s + n.mastery * r;
  }, 0) / conceptNodes.length;

  const dropoutRisk = computeDropoutRisk(avgFrustration, sessionVelocity, avgMastery, totalMessages);

  const sorted = [...conceptNodes].sort((a, b) => b.mastery - a.mastery);
  const strongestConcept = sorted[0]?.concept ?? null;
  const weakestConcept = sorted[sorted.length - 1]?.concept ?? null;

  // Sessions to reach 0.8 avg mastery
  const masteryGap = Math.max(0, 0.8 - avgMastery);
  const estimatedSessionsToGoal = sessionVelocity > 0
    ? Math.ceil(masteryGap / (sessionVelocity * 0.15))
    : 20;

  return {
    predictedRiskMap: riskMap,
    learningPath,
    bottlenecks,
    dropoutRisk,
    projectedMastery7d: Math.round(projected7d * 1000) / 1000,
    projectedMastery30d: Math.round(projected30d * 1000) / 1000,
    strongestConcept,
    weakestConcept,
    sessionVelocity,
    estimatedSessionsToGoal,
  };
}

/**
 * Compact prompt injection for the predictive model.
 * Gives the AI a forward-looking picture of the student's trajectory.
 */
export function buildPredictiveContextString(model: PredictiveModel): string {
  if (model.predictedRiskMap.length === 0) return '';

  const lines: string[] = ['[PREDICTIVE MODEL — 7-day forecast]'];

  const critical = model.predictedRiskMap.filter(r => r.urgency === 'critical').slice(0, 2);
  if (critical.length > 0) {
    lines.push(`  At-risk (7d): ${critical.map(r => `${r.concept} (${Math.round(r.predictedRetention7d * 100)}% retention left)`).join(', ')}`);
  }

  if (model.bottlenecks.length > 0) {
    lines.push(`  Bottlenecks: ${model.bottlenecks.join(', ')}`);
  }

  if (model.learningPath.length > 0) {
    lines.push(`  Recommended next: ${model.learningPath.slice(0, 3).map(p => p.concept).join(' → ')}`);
  }

  if (model.dropoutRisk > 0.5) {
    lines.push(`  ⚠ Disengagement risk: ${Math.round(model.dropoutRisk * 100)}% — reduce friction`);
  }

  lines.push(`  Velocity: ${model.sessionVelocity.toFixed(1)} concepts/session, ~${model.estimatedSessionsToGoal} sessions to goal`);

  return lines.join('\n');
}
