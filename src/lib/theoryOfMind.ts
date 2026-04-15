/**
 * AEGIS Theory of Mind Module
 *
 * Dedicated module for modeling WHAT THE STUDENT BELIEVES — independent of
 * what they've said. Based on Premack & Woodruff (1978) Theory of Mind and
 * Winne & Hadwin (1998) self-regulated learning models.
 *
 * Capabilities:
 *   1. Reflection depth scoring — how deeply is the student actually thinking?
 *   2. Meta-cognition score — does the student know what they don't know?
 *   3. Belief divergence — gap between student's confidence and actual mastery
 *   4. Predicted confusion points based on concept graph state
 *   5. Insight string for prompt injection
 */

import type { EpistemicState, ConceptNode, AgentType } from '@/types';
import type { CognitiveStateData } from './cognitiveState';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReflectionDepthResult {
  score: number;        // [0..1] — 0 = surface recall, 1 = deep synthesis
  level: 'surface' | 'elaborative' | 'integrative' | 'synthetic';
  signals: string[];    // what linguistic/epistemic cues contributed
}

export interface MetaCognitionResult {
  score: number;        // [0..1] — how accurately does student self-assess?
  overconfident: boolean;
  underconfident: boolean;
  blindSpots: string[];   // concepts where confidence >> actual mastery
  insights: string[];     // concepts where student underestimates themselves
}

export interface BeliefState {
  believedMastered: string[];      // student thinks they know these
  actuallyMastered: string[];      // they actually do
  overestimated: string[];         // believes mastered, actually struggling
  underestimated: string[];        // thinks weak, actually strong
  activeBeliefConflicts: string[]; // held misconceptions the student doesn't know are wrong
}

export interface ToMInsight {
  reflectionDepth: ReflectionDepthResult;
  metaCognition: MetaCognitionResult;
  beliefState: BeliefState;
  overallToMScore: number;    // composite [0..1]
  promptInjection: string;    // compact text for agent system prompt
}

// ─── Reflection Depth Scoring ─────────────────────────────────────────────────

/**
 * Analyzes the epistemic state and recent message to gauge HOW the student
 * is thinking (not just WHETHER they answered correctly).
 *
 * Heuristics (Bloom's Taxonomy inspired):
 *   Surface:      Single recall, yes/no, one-word answers, confusion markers
 *   Elaborative:  Student explains reasoning, uses "because", connects to example
 *   Integrative:  Student draws connections between concepts
 *   Synthetic:    Student generates novel examples, questions the model, predicts
 */
export function evaluateReflectionDepth(
  epistemicState: EpistemicState,
  studentMessage: string
): ReflectionDepthResult {
  const msg = studentMessage.toLowerCase();
  const signals: string[] = [];
  let score = 0.2;  // baseline

  // Surface signals (reduce score)
  if (msg.split(' ').length < 6) {
    signals.push('very short response — likely recall not reasoning');
    score -= 0.05;
  }
  if (/^(yes|no|i don'?t know|idk|maybe|ok|okay)[\s.?!]*$/.test(msg)) {
    signals.push('one-word or surface acknowledgment');
    score = 0.1;
    return { score, level: 'surface', signals };
  }

  // Elaborative signals
  if (/because|since|therefore|this means|which means|that'?s why/.test(msg)) {
    score += 0.2;
    signals.push('uses causal reasoning language');
  }
  if (/for example|like when|similar to|such as/.test(msg)) {
    score += 0.15;
    signals.push('provides concrete example');
  }
  if (epistemicState.understood.length > 0 && epistemicState.frustrationLevel < 0.4) {
    score += 0.1;
    signals.push('demonstrates understanding with low frustration');
  }

  // Integrative signals
  if (/connect|relate|similar|different from|compared to|both|either/.test(msg)) {
    score += 0.2;
    signals.push('draws connections between concepts');
  }
  if (epistemicState.understood.length >= 2) {
    score += 0.1;
    signals.push('multiple concepts understood simultaneously');
  }

  // Synthetic signals (highest order)
  if (/what if|suppose|imagine|could we|would it|does this apply/.test(msg)) {
    score += 0.25;
    signals.push('generates hypothetical or transfers knowledge');
  }
  if (/i wonder|i notice|i realize|i see that|actually/.test(msg)) {
    score += 0.15;
    signals.push('metacognitive awareness marker');
  }
  if (msg.split('?').length > 2) {
    score += 0.1;
    signals.push('student asking multiple questions — active inquiry');
  }

  // Penalty for misconceptions
  if (epistemicState.misconceptions.length > 0) {
    score -= 0.15 * epistemicState.misconceptions.length;
    signals.push('active misconceptions reduce depth score');
  }

  score = Math.max(0, Math.min(1, score));

  const level: ReflectionDepthResult['level'] =
    score >= 0.75 ? 'synthetic' :
    score >= 0.55 ? 'integrative' :
    score >= 0.35 ? 'elaborative' : 'surface';

  return { score, level, signals };
}

// ─── Meta-Cognition Score ─────────────────────────────────────────────────────

/**
 * Measures how accurately the student models their OWN knowledge.
 * Based on Dunning-Kruger research and calibration theory.
 *
 * Uses the gap between stated confidence (from epistemic state)
 * and actual mastery (from concept nodes).
 */
export function getMetaCognitionScore(
  epistemicState: EpistemicState,
  conceptNodes: ConceptNode[]
): MetaCognitionResult {
  const masteryMap: Record<string, number> = {};
  for (const n of conceptNodes) masteryMap[n.concept] = n.mastery;

  const blindSpots: string[] = [];
  const insights: string[] = [];
  let calibrationErrors = 0;
  let totalChecked = 0;

  for (const understood of epistemicState.understood) {
    const actualMastery = masteryMap[understood.concept] ?? 0;
    const statedConfidence = understood.confidence;
    const gap = statedConfidence - actualMastery;

    totalChecked++;
    if (gap > 0.3) {
      blindSpots.push(understood.concept);
      calibrationErrors++;
    } else if (gap < -0.25) {
      insights.push(understood.concept);
      calibrationErrors++;
    }
  }

  // Check for misconceptions the student hasn't self-flagged
  for (const misc of epistemicState.misconceptions) {
    if ((masteryMap[misc.concept] ?? 0) > 0.5) {
      blindSpots.push(misc.concept);
    }
  }

  const errorRate = totalChecked > 0 ? calibrationErrors / totalChecked : 0;
  const score = Math.max(0, 1 - errorRate);

  return {
    score,
    overconfident: blindSpots.length > insights.length,
    underconfident: insights.length > blindSpots.length,
    blindSpots: Array.from(new Set(blindSpots)).slice(0, 4),
    insights: Array.from(new Set(insights)).slice(0, 3),
  };
}

// ─── Belief State Modeling ─────────────────────────────────────────────────────

/**
 * Computes the divergence between what the student BELIEVES about their
 * knowledge vs. what the concept graph says is true.
 */
export function computeBeliefState(
  epistemicState: EpistemicState,
  conceptNodes: ConceptNode[]
): BeliefState {
  const masteryMap: Record<string, number> = {};
  for (const n of conceptNodes) masteryMap[n.concept] = n.mastery;

  const believedMastered = epistemicState.understood
    .filter(u => u.confidence > 0.6)
    .map(u => u.concept);

  const actuallyMastered = conceptNodes
    .filter(n => n.mastery > 0.7)
    .map(n => n.concept);

  const overestimated = believedMastered.filter(
    c => !actuallyMastered.includes(c) && (masteryMap[c] ?? 0) < 0.5
  );

  const underestimated = actuallyMastered.filter(
    c => !believedMastered.includes(c)
  );

  const activeBeliefConflicts = epistemicState.misconceptions
    .filter(m => (masteryMap[m.concept] ?? 0) > 0.3)  // they think they know it but have misconception
    .map(m => m.concept);

  return {
    believedMastered,
    actuallyMastered,
    overestimated,
    underestimated,
    activeBeliefConflicts,
  };
}

// ─── ToM Accuracy from Cognitive State ────────────────────────────────────────

/**
 * Gets average ToM prediction accuracy from stored trend.
 * Returns null if insufficient data.
 */
export function getToMAccuracy(cognitiveState: CognitiveStateData): number | null {
  if (cognitiveState.tomAccuracyTrend.length < 3) return null;
  const last = cognitiveState.tomAccuracyTrend.slice(-10);
  return last.reduce((a, b) => a + b, 0) / last.length;
}

// ─── Full ToM Analysis ────────────────────────────────────────────────────────

/**
 * Runs the complete Theory of Mind analysis.
 * Used by session-end analysis and periodically in chat to guide agent selection.
 */
export function analyzeTheoryOfMind(
  epistemicState: EpistemicState,
  studentMessage: string,
  conceptNodes: ConceptNode[],
  cognitiveState: CognitiveStateData
): ToMInsight {
  const reflectionDepth = evaluateReflectionDepth(epistemicState, studentMessage);
  const metaCognition = getMetaCognitionScore(epistemicState, conceptNodes);
  const beliefState = computeBeliefState(epistemicState, conceptNodes);

  // Composite ToM score: reflection depth + metacognitive calibration
  const tomAccuracy = getToMAccuracy(cognitiveState) ?? 0.5;
  const overallToMScore = (
    reflectionDepth.score * 0.35 +
    metaCognition.score * 0.35 +
    tomAccuracy * 0.30
  );

  const promptInjection = buildToMInsightString({
    reflectionDepth,
    metaCognition,
    beliefState,
    overallToMScore,
    promptInjection: '',  // placeholder
  });

  return {
    reflectionDepth,
    metaCognition,
    beliefState,
    overallToMScore,
    promptInjection,
  };
}

// ─── Prompt Injection Builder ─────────────────────────────────────────────────

/**
 * Produces a compact, prompt-ready string summarizing the ToM analysis.
 * Injected into agent system prompts to guide pedagogical response.
 */
export function buildToMInsightString(insight: ToMInsight): string {
  const lines: string[] = ['[THEORY OF MIND — student belief model]'];

  const { reflectionDepth, metaCognition, beliefState } = insight;

  lines.push(`  Thinking depth: ${reflectionDepth.level} (${Math.round(reflectionDepth.score * 100)}%)`);

  if (metaCognition.overconfident && metaCognition.blindSpots.length > 0) {
    lines.push(`  Overconfident about: ${metaCognition.blindSpots.slice(0, 2).join(', ')} — probe gently`);
  } else if (metaCognition.underconfident && metaCognition.insights.length > 0) {
    lines.push(`  Underestimates self on: ${metaCognition.insights.slice(0, 2).join(', ')} — affirm and build`);
  }

  if (beliefState.activeBeliefConflicts.length > 0) {
    lines.push(`  Believes correct but has misconception: ${beliefState.activeBeliefConflicts.slice(0, 2).join(', ')}`);
  }

  if (beliefState.overestimated.length > 0) {
    lines.push(`  Thinks mastered (actually weak): ${beliefState.overestimated.slice(0, 2).join(', ')}`);
  }

  if (insight.overallToMScore < 0.4) {
    lines.push(`  ⚠ Low predictability — student responses are hard to anticipate, proceed carefully`);
  }

  return lines.join('\n');
}

/**
 * Selects the optimal agent based on ToM insights.
 * Supplements the standard agent selection logic.
 */
export function tomGuidedAgentHint(
  insight: ToMInsight,
  currentAgent: AgentType
): AgentType | null {
  const { reflectionDepth, metaCognition, beliefState } = insight;

  // Active belief conflict = misconception student doesn't know they have → REPAIR
  if (beliefState.activeBeliefConflicts.length > 0 && currentAgent !== 'REPAIR') {
    return 'REPAIR';
  }

  // Overconfident + surface thinking = need a challenge to create cognitive conflict
  if (metaCognition.overconfident && reflectionDepth.level === 'surface' && currentAgent !== 'CHALLENGE') {
    return 'CHALLENGE';
  }

  // Synthetic thinking = student is ready for META reflection
  if (reflectionDepth.level === 'synthetic' && currentAgent === 'PROBE') {
    return 'META';
  }

  return null;  // no override
}
