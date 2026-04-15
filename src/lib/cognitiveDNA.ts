import { callClaudeJSON } from './anthropic';
import { updateStudentDNA } from './db';
import type { CognitiveDNA } from '@/types';

interface RawDNA {
  visual: number;
  abstract: number;
  exampleFirst: number;
  theoryFirst: number;
  analogyDriven: number;
  pace: string;
  preferredStyle: string;
}

/**
 * Cognitive DNA — learning style inference from conversation patterns.
 * Inspired by Kolb's learning styles and Gardner's multiple intelligences.
 *
 * Dimensions:
 * - visual: prefers diagrams, pictures, spatial reasoning
 * - abstract: comfortable with symbols and theory
 * - exampleFirst: wants examples before rules
 * - theoryFirst: wants theory before examples
 * - analogyDriven: learns through comparisons and metaphors
 * - pace: preferred learning pace
 */
export async function inferCognitiveDNA(
  recentMessages: Array<{ role: string; content: string }>,
  existingDNA: CognitiveDNA | null
): Promise<CognitiveDNA> {
  if (recentMessages.length < 3) {
    return existingDNA || defaultDNA();
  }

  const conversationText = recentMessages
    .slice(-12)
    .map(m => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n');

  const systemPrompt = `You are an expert educational psychologist analyzing learning styles.
You MUST return ONLY valid JSON, no other text.`;

  const priorContext = existingDNA
    ? `Prior inferred DNA: visual=${existingDNA.visual.toFixed(2)}, abstract=${existingDNA.abstract.toFixed(2)}, exampleFirst=${existingDNA.exampleFirst.toFixed(2)}, theoryFirst=${existingDNA.theoryFirst.toFixed(2)}, analogyDriven=${existingDNA.analogyDriven.toFixed(2)}, pace=${existingDNA.pace}`
    : 'No prior data.';

  const userPrompt = `Analyze this student's messages to infer their learning style DNA.
${priorContext}

Conversation:
${conversationText}

Return JSON (blend prior values at 70% weight if they exist):
{
  "visual": 0.0-1.0,
  "abstract": 0.0-1.0,
  "exampleFirst": 0.0-1.0,
  "theoryFirst": 0.0-1.0,
  "analogyDriven": 0.0-1.0,
  "pace": "slow|medium|fast",
  "preferredStyle": "one sentence description of this student's ideal explanation style"
}

Signals to detect:
- visual=HIGH if they ask "can you show me", "draw it out", "imagine if"
- exampleFirst=HIGH if they say "give me an example first" or "what does this look like"
- theoryFirst=HIGH if they ask "but why does this work" or "what's the principle"
- abstract=HIGH if comfortable with formulas, symbols, proofs
- analogyDriven=HIGH if they respond well to "it's like..." phrases
- pace=slow if repeated questions on same topic; fast if jumping ahead`;

  const result = await callClaudeJSON<RawDNA>(systemPrompt, userPrompt, 400);

  if (!result) return existingDNA || defaultDNA();

  const blend = (newVal: number, oldVal: number) =>
    existingDNA ? oldVal * 0.7 + newVal * 0.3 : newVal;

  return {
    visual: Math.max(0, Math.min(1, blend(result.visual || 0.5, existingDNA?.visual || 0.5))),
    abstract: Math.max(0, Math.min(1, blend(result.abstract || 0.5, existingDNA?.abstract || 0.5))),
    exampleFirst: Math.max(0, Math.min(1, blend(result.exampleFirst || 0.5, existingDNA?.exampleFirst || 0.5))),
    theoryFirst: Math.max(0, Math.min(1, blend(result.theoryFirst || 0.5, existingDNA?.theoryFirst || 0.5))),
    analogyDriven: Math.max(0, Math.min(1, blend(result.analogyDriven || 0.5, existingDNA?.analogyDriven || 0.5))),
    pace: validatePace(result.pace) || existingDNA?.pace || 'medium',
    preferredStyle: result.preferredStyle || existingDNA?.preferredStyle || 'balanced explanation style',
  };
}

function validatePace(pace: string): 'slow' | 'medium' | 'fast' | null {
  if (pace === 'slow' || pace === 'medium' || pace === 'fast') return pace;
  return null;
}

function defaultDNA(): CognitiveDNA {
  return {
    visual: 0.5,
    abstract: 0.5,
    exampleFirst: 0.5,
    theoryFirst: 0.5,
    analogyDriven: 0.5,
    pace: 'medium',
    preferredStyle: 'balanced mix of theory and examples',
  };
}

/**
 * Persist updated DNA to database.
 */
export async function saveDNA(studentId: string, dna: CognitiveDNA): Promise<void> {
  updateStudentDNA(studentId, dna);
}

/**
 * Build a DNA-adapted instruction suffix for the AI system prompt.
 * This dynamically modifies how Claude explains concepts.
 */
export function buildDNAInstruction(dna: CognitiveDNA): string {
  const parts: string[] = [];

  if (dna.visual > 0.65) {
    parts.push('Use spatial analogies, ASCII diagrams, and visual metaphors whenever possible.');
  }
  if (dna.exampleFirst > 0.65) {
    parts.push('Always lead with a concrete example BEFORE explaining the rule or theory.');
  } else if (dna.theoryFirst > 0.65) {
    parts.push('State the underlying principle or theorem FIRST, then demonstrate with examples.');
  }
  if (dna.analogyDriven > 0.65) {
    parts.push('Use strong real-world analogies and comparisons (\'This is like...\', \'Think of it as...\').');
  }
  if (dna.abstract > 0.7) {
    parts.push('Feel free to use mathematical notation and abstract reasoning — this student is comfortable with it.');
  } else if (dna.abstract < 0.35) {
    parts.push('Avoid heavy notation. Keep explanations intuitive and grounded in concrete reality.');
  }
  if (dna.pace === 'slow') {
    parts.push('Go slowly. Repeat key ideas in different ways. Check understanding frequently.');
  } else if (dna.pace === 'fast') {
    parts.push('This student is quick — you can skip basic explanations and move to nuances directly.');
  }

  if (parts.length === 0) {
    parts.push('Use a balanced approach mixing theory and concrete examples.');
  }

  return `\n\nSTUDENT LEARNING DNA ADAPTATION:\n${parts.join('\n')}`;
}

/**
 * Compute the dominant learning style label for display.
 */
export function getDominantStyle(dna: CognitiveDNA): string {
  const styles: [string, number][] = [
    ['Visual', dna.visual],
    ['Abstract', dna.abstract],
    ['Example-First', dna.exampleFirst],
    ['Theory-First', dna.theoryFirst],
    ['Analogy-Driven', dna.analogyDriven],
  ];
  const dominant = styles.reduce((max, s) => (s[1] > max[1] ? s : max), ['Balanced', 0]);
  return dominant[1] > 0.6 ? dominant[0] : 'Balanced';
}
