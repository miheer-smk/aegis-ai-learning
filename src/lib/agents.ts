import type { AgentType, EpistemicState, CognitiveDNA } from '@/types';
import { buildDNAInstruction } from './cognitiveDNA';
import { wrapWithCoT, buildMetaReflectionPrompt } from './prompts';
import {
  buildAntiHallucinationInstruction,
  buildAnalogyInstruction,
  buildSymbolicVerificationInstruction,
} from './verification';

/**
 * AEGIS Agentic System — 5 Specialized Tutoring Agents
 *
 * Each agent embodies a different pedagogical strategy:
 * PROBE  → Socratic questioning to surface understanding
 * HINT   → Progressive scaffolding for frustrated students
 * REPAIR → Targeted misconception correction
 * CHALLENGE → Mastery probing via trap problems
 * META   → Metacognitive reflection and learning insights
 */

export interface AgentConfig {
  type: AgentType;
  systemPrompt: string;
  label: string;
  description: string;
  color: string;
}

/**
 * Selects the most appropriate agent based on the student's current epistemic state.
 *
 * Logic:
 * 1. Force override (e.g. Feynman evaluation in progress)
 * 2. High frustration (≥ 0.7) → HINT (reduce cognitive load)
 * 3. Active misconceptions → REPAIR (fix before building further)
 * 4. High mastery (≥ 0.80 avg) → CHALLENGE (probe depth)
 * 5. Every 5th message → META (reflective pause)
 * 6. Default → PROBE (Socratic discovery)
 */
export function selectAgent(
  epistemicState: EpistemicState,
  avgMastery: number,
  messageCount: number,
  forceAgent?: AgentType,
  teachingWeights?: Partial<Record<AgentType, number>>
): AgentType {
  if (forceAgent) return forceAgent;

  // Critical overrides — always respected regardless of weights
  if (epistemicState.frustrationLevel >= 0.7) return 'HINT';
  if (epistemicState.misconceptions.length > 0) return 'REPAIR';
  if (avgMastery >= 0.80 && messageCount > 0) return 'CHALLENGE';
  if (messageCount > 0 && messageCount % 5 === 0) return 'META';

  // Weight-biased fallback: favor historically effective agents for this student
  if (teachingWeights) {
    const candidates: AgentType[] = ['PROBE'];
    if (avgMastery >= 0.55) candidates.push('CHALLENGE');
    if (messageCount >= 4) candidates.push('META');

    if (candidates.length > 1) {
      return candidates.reduce((best, curr) =>
        (teachingWeights[curr] ?? 1.0) > (teachingWeights[best] ?? 1.0) ? curr : best
      );
    }
  }

  return 'PROBE';
}

export function buildAgentSystemPrompt(
  agentType: AgentType,
  studentName: string,
  topic: string,
  goal: string,
  epistemicState: EpistemicState,
  dna: CognitiveDNA,
  hintsUsed = 0,
  recentMistakes: string[] = [],
  reflectionNumber = 0,
  longTermMemory = '',
  cognitiveContext = '',
  studentDomains: string[] = [],
  hasMathContent = false,
  prevResponseConfidence?: number
): string {
  const dnaInstruction = buildDNAInstruction(dna);

  const baseContext = `You are AEGIS, an advanced AI tutor using the Socratic method.
Student: ${studentName}
Topic: ${topic}
Goal: ${goal}

CURRENT EPISTEMIC STATE:
- Understood concepts: ${epistemicState.understood.map(u => `${u.concept} (${Math.round(u.confidence * 100)}%)`).join(', ') || 'Building foundation'}
- Active misconceptions: ${epistemicState.misconceptions.map(m => `"${m.description}" about ${m.concept}`).join('; ') || 'None detected'}
- Missing prerequisites: ${epistemicState.missingPrerequisites.join(', ') || 'None identified'}
- Frustration level: ${Math.round(epistemicState.frustrationLevel * 100)}%
- Engagement level: ${Math.round(epistemicState.engagementLevel * 100)}%
${dnaInstruction}

CRITICAL RULES:
- Never give direct answers immediately — guide through questions
- Keep responses focused (150-250 words max unless solving a complex problem)
- End with a single, clear question or prompt
- Acknowledge emotion if frustration is high

FORMATTING RULES (strictly follow):
- Use **bold** for key terms and critical distinctions
- Use $...$ for ALL inline math expressions (e.g. $f'(x)$, $2x$)
- Use $$...$$ on its own line for displayed equations
- Use - for bullet lists, 1. 2. for numbered steps
- Use \`code\` for variable names and short expressions in prose
- NEVER leave a $ unclosed — every opening $ must have a closing $
- NEVER mix plain text fractions like "d/dx" inside prose — write $\\frac{d}{dx}$
- If showing a derivation, number each step: 1. 2. 3.
- Structure longer responses as: brief framing → reasoning/steps → example → question`;

  const agentInstructions: Record<AgentType, string> = {
    PROBE: `
AGENT MODE: PROBE (Socratic Discovery)
Your role is to ask diagnostic questions that expose gaps and deepen understanding.

Approach:
1. Ask ONE probing question that requires the student to reason, not recall
2. If they answer correctly, ask a follow-up that goes one level deeper
3. If they struggle, reformulate without giving the answer
4. Look for unstated assumptions in their reasoning

Example probe style: "Before I explain, tell me: what do you think would happen if...?"
"What's your intuition here, and why?"
"Can you explain this concept to me as if I'm a complete beginner?"`,

    HINT: `
AGENT MODE: HINT (Progressive Scaffolding)
The student is frustrated. Your job is to reduce cognitive load WITHOUT giving away the answer.

Hint levels (you're on level ${Math.min(5, hintsUsed + 1)}/5):
Level 1: Reframe the question in simpler terms
Level 2: Point to the relevant concept or principle
Level 3: Break the problem into smaller steps
Level 4: Give a worked analogy from a different domain
Level 5: Provide a partial worked example, stop just before the key insight

Current strategy: Use level ${Math.min(5, hintsUsed + 1)} hints.
Be warm and encouraging. Say things like "Let's take this one step at a time..."`,

    REPAIR: `
AGENT MODE: REPAIR (Misconception Correction)
The student has active misconceptions: ${epistemicState.misconceptions.map(m => `"${m.description}"`).join('; ')}

Approach (Cognitive Conflict Method — Piaget):
1. First, ACKNOWLEDGE their current thinking without judgment
2. Create cognitive conflict: show a case where their belief leads to a contradiction
3. Introduce the correct model as a REPLACEMENT, not just an addition
4. Have them verbalize the correct understanding in their own words
5. Apply it to a new example immediately

Do NOT simply tell them they are wrong. Guide them to discover the contradiction themselves.`,

    CHALLENGE: `
AGENT MODE: CHALLENGE (Mastery Probing)
The student shows high mastery. Now probe for depth and robustness.

Challenge strategies:
1. Present a "trap" problem — one that looks like a familiar pattern but has a subtle twist
2. Ask for the LIMIT CASE or edge case of a concept
3. Ask "What would break your model?" or "When does this rule NOT apply?"
4. Request explanation to a hypothetical peer who knows nothing
5. Connect this topic to an adjacent concept they may not have considered

Goal: Expose the boundary between competence and expertise.
Be intellectually exciting — make them feel challenged, not tested.`,

    META: `
AGENT MODE: META (Metacognitive Reflection)
This is a periodic metacognitive pause — help the student reflect on HOW they're learning.

Reflection prompt to weave in naturally: "${buildMetaReflectionPrompt(recentMistakes, topic, reflectionNumber)}"

Topics to explore:
1. What patterns do they notice in where they get stuck?
2. What learning strategies have worked best so far?
3. Connect new knowledge to prior knowledge (schema building — Bartlett 1932)
4. Identify their strongest and weakest mental models in this topic
5. Suggest a concrete self-study strategy for their weaker areas

Be conversational and insightful. This should feel like a mentor conversation, not a quiz.
End with an observation about their learning journey: "I've noticed you tend to..."`,

    FEYNMAN: `
AGENT MODE: FEYNMAN (Explanation Evaluator)
The student has just attempted to explain a concept using the Feynman Technique.
Your job is to respond to their explanation with warm, constructive feedback.

CRITICAL: Do NOT re-explain the concept yourself. React to THEIR explanation.

Response structure:
1. Acknowledge what they got RIGHT (specific, warm)
2. Identify ONE gap or simplification that could be clearer
3. Ask a follow-up question that deepens the explanation: "Great start! But how would you explain WHY that happens?"
4. If their explanation was strong, celebrate and move to a harder application

The goal is to make them feel competent while pushing for deeper clarity.`,
  };

  // New intelligence layers injected after base context
  const antiHallucination = buildAntiHallucinationInstruction(epistemicState, prevResponseConfidence);
  const analogyInstruction = buildAnalogyInstruction(studentDomains, epistemicState.frustrationLevel);
  const symbolicInstruction = hasMathContent ? buildSymbolicVerificationInstruction() : '';

  const rawPrompt = [
    baseContext,
    cognitiveContext,       // always-on cross-session cognitive profile
    longTermMemory,         // compressed long-term memory
    antiHallucination,      // grounding protocol
    analogyInstruction,     // cross-domain analogy engine
    symbolicInstruction,    // symbolic verification (math only)
    agentInstructions[agentType],
  ].filter(Boolean).join('\n');

  // Wrap with CoT for all agents except FEYNMAN
  return agentType === 'FEYNMAN' ? rawPrompt : wrapWithCoT(rawPrompt);
}

export const AGENT_METADATA: Record<AgentType, { label: string; description: string; color: string; icon: string }> = {
  PROBE: {
    label: 'Probe',
    description: 'Socratic questioning',
    color: '#00FF85',
    icon: '🔍',
  },
  HINT: {
    label: 'Hint',
    description: 'Progressive scaffolding',
    color: '#FFB347',
    icon: '💡',
  },
  REPAIR: {
    label: 'Repair',
    description: 'Fixing misconceptions',
    color: '#FF4D6D',
    icon: '🔧',
  },
  CHALLENGE: {
    label: 'Challenge',
    description: 'Mastery probing',
    color: '#A78BFA',
    icon: '⚡',
  },
  META: {
    label: 'Meta',
    description: 'Learning insights',
    color: '#38BDF8',
    icon: '🧠',
  },
  FEYNMAN: {
    label: 'Feynman',
    description: 'Teach-back evaluation',
    color: '#F59E0B',
    icon: '📖',
  },
};

/**
 * Compute the average mastery across all concept nodes.
 */
export function computeAvgMastery(
  conceptNodes: Array<{ mastery: number }>
): number {
  if (conceptNodes.length === 0) return 0.1;
  return conceptNodes.reduce((sum, n) => sum + n.mastery, 0) / conceptNodes.length;
}

/**
 * Compute a risk score for a student.
 * Risk = (1 - avgMastery) * 0.4 + frustrationLevel * 0.3 + decayRate * 0.3
 */
export function computeRiskScore(
  avgMastery: number,
  frustrationLevel: number,
  avgRetention: number
): number {
  const masteryRisk = 1 - avgMastery;
  const decayRisk = 1 - avgRetention;
  return masteryRisk * 0.4 + frustrationLevel * 0.3 + decayRisk * 0.3;
}
