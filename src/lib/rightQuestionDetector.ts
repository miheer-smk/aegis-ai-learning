/**
 * AEGIS Right-Question Detector
 *
 * Problem: Students often ask the wrong question.
 *   - Asking about an already-mastered concept (low value)
 *   - Jumping to advanced topics with weak prerequisites (builds on sand)
 *   - Requesting direct answers instead of engaging with reasoning
 *   - Asking surface questions when a deeper question is more valuable
 *
 * Solution: A fast, rule-based pre-processing stage BEFORE agent selection.
 * No LLM call — this runs in <1ms and never adds latency.
 *
 * When a suboptimal question is detected:
 *   - The detector flags it with a reason + suggested redirect
 *   - The chat pipeline can prepend a brief redirect message to the response
 *   - The redirect is non-authoritarian: it offers, doesn't force
 */

import type { EpistemicState, ConceptNode } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QuestionAnalysis {
  isOptimal: boolean;
  redirectConcept?: string;    // concept to redirect to (if applicable)
  redirectReason?: string;     // why this question is suboptimal
  redirectMessage?: string;    // message to prepend (if redirect warranted)
}

// ─── Main Export ──────────────────────────────────────────────────────────────

/**
 * Analyses whether the user's question is the highest-value question
 * they could be asking right now, given their epistemic state.
 *
 * Returns isOptimal=true most of the time — we only interrupt for clear cases.
 */
export function detectRightQuestion(
  userInput: string,
  epistemicState: EpistemicState,
  conceptNodes: ConceptNode[]
): QuestionAnalysis {
  const input = userInput.toLowerCase().trim();

  // ── Gate 1: Direct answer request ────────────────────────────────────────────
  // "Just tell me the answer" when the student hasn't attempted reasoning
  if (isDirectAnswerRequest(input) && epistemicState.misconceptions.length === 0) {
    return {
      isOptimal:       false,
      redirectReason:  'direct_answer_request',
      redirectMessage: buildDirectAnswerRedirect(),
    };
  }

  // ── Gate 2: Already-mastered concept ─────────────────────────────────────────
  // Student asks about something they demonstrably know well
  const mentionedConcept = findMentionedConcept(input, conceptNodes);
  if (mentionedConcept && mentionedConcept.mastery > 0.82) {
    // Only redirect if there's something more important to work on
    const weakerConcept = conceptNodes
      .filter(n => n.mastery < 0.4 && n.concept !== mentionedConcept.concept)
      .sort((a, b) => a.mastery - b.mastery)[0];

    // Only redirect ~35% of the time — don't be intrusive
    if (weakerConcept && seededBool(userInput, 0.35)) {
      return {
        isOptimal:       false,
        redirectConcept: weakerConcept.concept,
        redirectReason:  'mastered_concept',
        redirectMessage: buildMasteredRedirect(mentionedConcept.concept, weakerConcept.concept),
      };
    }
  }

  // ── Gate 3: Prerequisite jump ─────────────────────────────────────────────────
  // Student asks about an advanced topic while prerequisites are weak
  const prereqGap = detectPrerequisiteJump(input, conceptNodes);
  if (prereqGap) {
    return {
      isOptimal:       false,
      redirectConcept: prereqGap,
      redirectReason:  'prerequisite_gap',
      redirectMessage: buildPrerequisiteRedirect(prereqGap),
    };
  }

  // ── Gate 4: Concept with active misconception — this IS the right question ────
  if (mentionedConcept &&
      Array.isArray(mentionedConcept.misconception) &&
      mentionedConcept.misconception.length > 0) {
    return { isOptimal: true }; // confirm: addressing a misconception is always right
  }

  return { isOptimal: true };
}

// ─── Detection Helpers ────────────────────────────────────────────────────────

function isDirectAnswerRequest(input: string): boolean {
  const patterns = [
    /^(what is the answer|give me the answer|just tell me|can you just solve|what's the solution)/,
    /^(solve this for me|calculate this|find the value of)\b/,
    /\b(just give me|tell me the answer|what is the final answer)\b/,
    /^(answer:|solution:)/,
  ];
  return patterns.some(p => p.test(input));
}

function findMentionedConcept(input: string, nodes: ConceptNode[]): ConceptNode | null {
  for (const node of nodes) {
    if (input.includes(node.concept.toLowerCase())) return node;
  }
  return null;
}

const PREREQUISITE_MAP: Array<{ advanced: string[]; requires: string[] }> = [
  { advanced: ['integration', 'integral', 'antiderivative'],    requires: ['derivative', 'differentiation'] },
  { advanced: ['differential equation', 'ode', 'pde'],          requires: ['derivative', 'integration'] },
  { advanced: ['fourier', 'laplace transform'],                  requires: ['integration', 'differential equation'] },
  { advanced: ['probability', 'bayes'],                         requires: ['combinations', 'statistics', 'sets'] },
  { advanced: ['recursion', 'recursive'],                       requires: ['function', 'loop', 'stack'] },
  { advanced: ['binary search tree', 'red-black', 'avl'],       requires: ['binary search', 'tree'] },
  { advanced: ['dynamic programming', 'memoization'],           requires: ['recursion', 'array'] },
  { advanced: ['eigenvector', 'eigenvalue'],                    requires: ['matrix', 'linear algebra'] },
  { advanced: ['neural network', 'backpropagation'],            requires: ['derivative', 'matrix', 'gradient'] },
];

function detectPrerequisiteJump(input: string, nodes: ConceptNode[]): string | null {
  const masteryMap: Record<string, number> = {};
  for (const n of nodes) masteryMap[n.concept.toLowerCase()] = n.mastery;

  for (const rule of PREREQUISITE_MAP) {
    const askingAdvanced = rule.advanced.some(a => input.includes(a));
    if (!askingAdvanced) continue;

    for (const req of rule.requires) {
      const reqMastery = masteryMap[req] ?? 1.0; // if unknown, assume ok
      if (reqMastery < 0.35) {
        // Find the actual node name with closest match
        const actualNode = nodes.find(n =>
          n.concept.toLowerCase().includes(req) || req.includes(n.concept.toLowerCase())
        );
        return actualNode?.concept ?? req;
      }
    }
  }

  return null;
}

/**
 * Deterministic pseudo-random bool from input string.
 * Avoids Math.random() so the same question always gives the same redirect decision
 * (prevents confusing behaviour where the same question sometimes gets redirected and sometimes not).
 */
function seededBool(seed: string, threshold: number): boolean {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return (Math.abs(hash) % 100) / 100 < threshold;
}

// ─── Message Builders ─────────────────────────────────────────────────────────

function buildDirectAnswerRedirect(): string {
  return `I could give you the answer — but that skips the part where you actually learn it. Let's reason through this together instead. What do you think the first step should be?`;
}

function buildMasteredRedirect(mastered: string, weaker: string): string {
  return `You actually have a solid grasp of **${mastered}** already. Before we revisit it, I want to check in on **${weaker}** — it's where I think the most value is right now. What do you know about that?`;
}

function buildPrerequisiteRedirect(gap: string): string {
  return `That's a great question to get to — but I want to make sure **${gap}** is solid first, because it's the foundation for what you're asking. Can you tell me what you know about ${gap}?`;
}
