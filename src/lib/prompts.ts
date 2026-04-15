/**
 * AEGIS Centralized Prompt Engineering Layer
 *
 * All AI prompts are defined here with:
 * - Structured role-based templates
 * - Chain-of-Thought (CoT) reasoning wrapper
 * - Few-shot examples for reliability
 * - Context injection (epistemic state, DNA, decay)
 * - Strict JSON output formatting
 */

import type { EpistemicState, CognitiveDNA, ReviewItem } from '@/types';

// ─── Chain-of-Thought Wrapper ─────────────────────────────────────────────────

/**
 * Injects a hidden CoT reasoning instruction into any system prompt.
 * Claude reasons step-by-step internally, then delivers a clean final response.
 * The reasoning is never shown to the student.
 */
export function wrapWithCoT(systemPrompt: string): string {
  return systemPrompt + `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REASONING PROTOCOL (INTERNAL — NEVER SHOWN TO STUDENT):
Before composing your response, silently work through these steps:
1. What exactly does the student currently understand vs. believe incorrectly?
2. What is the single most important gap to address right now?
3. Which pedagogical move (question, hint, example, contradiction) best fits the Cognitive DNA?
4. What emotional tone is appropriate given their frustration level?
5. How can I end this response in a way that maximally prompts forward thinking?

Only AFTER this internal reasoning, write your actual response.
Do NOT include "Step 1:", "Step 2:" or any reasoning structure in your visible response.
Your response must be natural, conversational, and pedagogically precise.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
}

// ─── Context Injection Helpers ────────────────────────────────────────────────

export function buildEpistemicContext(state: EpistemicState): string {
  return `EPISTEMIC STATE:
• Understood: ${state.understood.map(u => `${u.concept} (${Math.round(u.confidence * 100)}%)`).join(', ') || 'none yet'}
• Misconceptions: ${state.misconceptions.map(m => `"${m.description}" [${m.severity}]`).join('; ') || 'none detected'}
• Missing prerequisites: ${state.missingPrerequisites.join(', ') || 'none'}
• Frustration: ${Math.round(state.frustrationLevel * 100)}% | Engagement: ${Math.round(state.engagementLevel * 100)}%`;
}

export function buildDecayContext(alerts: ReviewItem[]): string {
  if (alerts.length === 0) return '';
  return `\nDECAY ALERTS (concepts at risk of being forgotten):
${alerts.map(a => `• ${a.concept}: ${Math.round(a.retention * 100)}% retention [${a.urgency}]`).join('\n')}
Consider weaving review of these concepts into your response if natural.`;
}

// ─── Epistemic Analysis Prompt ────────────────────────────────────────────────

export const EPISTEMIC_SYSTEM_PROMPT = `You are an expert educational psychologist specializing in epistemic state analysis.
Your task is to analyze a student-tutor conversation and extract precise cognitive state data.

FEW-SHOT EXAMPLES of misconception detection:
---
User: "Velocity just means how fast something moves"
→ misconception: { concept: "velocity", description: "Velocity is a vector (direction matters), not just speed", severity: "medium" }

User: "Objects fall faster if they're heavier"
→ misconception: { concept: "free fall", description: "All objects fall at the same acceleration g=9.8m/s² regardless of mass", severity: "high" }

User: "The derivative tells you the area under the curve"
→ misconception: { concept: "derivative", description: "Derivative gives rate of change, not area; that's the integral", severity: "high" }
---

You MUST return ONLY valid JSON. No markdown, no explanation, just the JSON object.`;

export function buildEpistemicUserPrompt(topic: string, conversationText: string): string {
  return `Topic: ${topic}

Conversation:
${conversationText}

Return ONLY this JSON:
{
  "understood": [{"concept": "string", "confidence": 0.0-1.0}],
  "misconceptions": [{"concept": "string", "description": "string", "severity": "low|medium|high"}],
  "missingPrerequisites": ["concept1"],
  "frustrationLevel": 0.0-1.0,
  "engagementLevel": 0.0-1.0
}

Scoring rules:
- confidence: demonstrated understanding strength, not just stated
- frustrationLevel: 0=calm, 1=very frustrated (detect "I don't get it", repeated questions, short frustrated answers)
- severity: how much the misconception blocks further learning`;
}

// ─── Feynman Evaluation Prompt ────────────────────────────────────────────────

export const FEYNMAN_SYSTEM_PROMPT = `You are an expert educational evaluator assessing the quality of a student's Feynman-technique explanation.
The Feynman Technique requires a student to explain a concept simply enough that a child could understand it.

A STRONG explanation:
- Uses simple, non-jargon language
- Covers the core idea accurately
- Uses an analogy or concrete example
- Has no critical gaps or errors

A WEAK explanation:
- Uses jargon without defining it
- Misses the fundamental mechanism
- Contains factual errors
- Is vague or circular

Return ONLY valid JSON.`;

export function buildFeynmanEvaluationPrompt(concept: string, explanation: string, topic: string): string {
  return `Topic domain: ${topic}
Concept being explained: "${concept}"

Student's explanation:
"${explanation}"

Evaluate this as a Feynman-technique explanation. Return ONLY this JSON:
{
  "clarityScore": 0.0-1.0,
  "depthScore": 0.0-1.0,
  "gaps": ["specific gap 1", "specific gap 2"],
  "strengths": ["what they got right 1"],
  "isStrong": true/false,
  "feedback": "One warm, constructive paragraph acknowledging strengths and pointing out gaps without discouraging."
}

isStrong = true if clarityScore > 0.65 AND depthScore > 0.60 AND no critical gaps.`;
}

// ─── Cognitive DNA Inference Prompt ───────────────────────────────────────────

export const DNA_SYSTEM_PROMPT = `You are an expert educational psychologist analyzing learning styles.
Infer the student's cognitive learning DNA from conversation patterns.

Signals to detect:
- visual=HIGH: "show me", "draw it out", "picture this", spatial metaphors
- exampleFirst=HIGH: "give me an example first", "what does this look like in practice"
- theoryFirst=HIGH: "but why does this work", "what's the underlying principle"
- abstract=HIGH: comfortable with notation, formulas, proofs, symbols
- analogyDriven=HIGH: responds to "it's like...", uses own analogies
- pace=slow: repeats same topic, asks for clarification often
- pace=fast: jumps ahead, makes connections quickly

Return ONLY valid JSON.`;

export function buildDNAUserPrompt(conversationText: string, prior: CognitiveDNA | null): string {
  const priorStr = prior
    ? `Prior DNA (blend at 70% weight): visual=${prior.visual.toFixed(2)}, abstract=${prior.abstract.toFixed(2)}, exampleFirst=${prior.exampleFirst.toFixed(2)}, theoryFirst=${prior.theoryFirst.toFixed(2)}, analogyDriven=${prior.analogyDriven.toFixed(2)}, pace=${prior.pace}`
    : 'No prior data — infer fresh from conversation.';

  return `${priorStr}

Conversation:
${conversationText}

Return ONLY this JSON:
{
  "visual": 0.0-1.0,
  "abstract": 0.0-1.0,
  "exampleFirst": 0.0-1.0,
  "theoryFirst": 0.0-1.0,
  "analogyDriven": 0.0-1.0,
  "pace": "slow|medium|fast",
  "preferredStyle": "one sentence describing ideal explanation approach for this student"
}`;
}

// ─── Input Safety Prompt ──────────────────────────────────────────────────────

export const SAFETY_SYSTEM_PROMPT = `You are a content moderation system for an educational AI tutor.
Your job is to classify student input as safe or unsafe for the learning context.

Categories:
- "ok": relevant educational content, questions, explanations
- "off_topic": unrelated to the student's study topic (social chat, news, etc.)
- "irrelevant": nonsensical, random, or test inputs that serve no learning purpose
- "abusive": profanity, harassment, threatening language, self-harm

IMPORTANT: Be PERMISSIVE. Students can ask tangentially related questions.
Only block clear violations. Return ONLY valid JSON.`;

export function buildSafetyUserPrompt(message: string, topic: string): string {
  return `Student's study topic: "${topic}"
Student's message: "${message}"

Is this message appropriate for an educational AI tutoring session?
Return ONLY this JSON:
{
  "safe": true/false,
  "category": "ok|off_topic|irrelevant|abusive",
  "reason": "brief explanation only if not safe, else null"
}`;
}

// ─── Learning Suggestions Prompt ──────────────────────────────────────────────

export const SUGGESTIONS_SYSTEM_PROMPT = `You are an adaptive learning coach analyzing a student's progress.
Generate highly personalized, actionable learning suggestions based on their cognitive data.
Make suggestions specific, motivating, and achievable.
Return ONLY valid JSON.`;

export function buildSuggestionsUserPrompt(params: {
  topic: string;
  goal: string;
  weakConcepts: string[];
  decayAlerts: string[];
  avgMastery: number;
  dna: CognitiveDNA;
}): string {
  const dnaStyle = `${params.dna.exampleFirst > 0.6 ? 'example-first' : params.dna.theoryFirst > 0.6 ? 'theory-first' : 'balanced'}, ${params.dna.visual > 0.6 ? 'visual learner' : 'conceptual learner'}, ${params.dna.pace} pace`;

  return `Student profile:
- Topic: ${params.topic}
- Goal: ${params.goal}
- Average mastery: ${Math.round(params.avgMastery * 100)}%
- Learning style: ${dnaStyle}
- Weak concepts (low mastery): ${params.weakConcepts.join(', ') || 'none identified'}
- Concepts fading from memory: ${params.decayAlerts.join(', ') || 'none'}

Generate 3 targeted learning suggestions. Return ONLY this JSON:
[
  {
    "id": "s1",
    "type": "next_topic|revision|practice",
    "title": "short action title (5 words max)",
    "description": "1-2 sentences explaining why this matters now",
    "concept": "the specific concept this targets (if applicable)",
    "urgency": "high|medium|low",
    "actionText": "the exact text to start this learning activity (a question or prompt to send to the tutor)"
  }
]

Rules:
- type "revision": for decaying memories (use actionText like "Can we review [concept]?")
- type "practice": for weak mastery (use actionText like a practice problem request)
- type "next_topic": for natural next step in learning progression
- Make actionText feel natural as a student message, not robotic`;
}

// ─── Meta-Cognitive Reflection Prompts ───────────────────────────────────────

export const REFLECTION_PROMPTS = [
  'Why do you think you found [concept] confusing initially?',
  'What assumption were you making that turned out to be wrong?',
  "If you had to teach this to a classmate, what's the first thing you'd say?",
  "Looking back at our conversation, what was the moment where things 'clicked'?",
  'What strategy helped you most today — examples, analogies, or step-by-step breakdown?',
  'What would you do differently if you were studying this topic from scratch?',
];

export function buildMetaReflectionPrompt(
  recentMistakes: string[],
  topic: string,
  reflectionNumber: number
): string {
  const prompt = REFLECTION_PROMPTS[reflectionNumber % REFLECTION_PROMPTS.length];
  const conceptHint = recentMistakes.length > 0 ? recentMistakes[0] : topic;
  return prompt.replace('[concept]', conceptHint);
}
