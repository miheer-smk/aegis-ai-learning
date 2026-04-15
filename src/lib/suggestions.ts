/**
 * AEGIS Intelligent Learning Suggestion Engine
 *
 * Generates personalized, actionable learning suggestions based on:
 * - Current mastery levels and weak concepts
 * - Memory decay (Ebbinghaus forgetting curve alerts)
 * - Cognitive DNA learning style
 * - Session goal and topic context
 *
 * Uses Claude with few-shot prompting for high-quality personalization.
 */

import { callClaudeJSON } from './anthropic';
import { buildSuggestionsUserPrompt, SUGGESTIONS_SYSTEM_PROMPT } from './prompts';
import { getStudent, getConceptNodes } from './db';
import { generateReviewQueue } from './decay';
import { computeAvgMastery } from './agents';
import type { Suggestion, ConceptNode, CognitiveDNA, Student } from '@/types';

// ─── Default Suggestions (fallback if Claude fails) ──────────────────────────

function defaultSuggestions(topic: string, weakConcepts: string[]): Suggestion[] {
  return [
    {
      id: 's1',
      type: 'practice',
      title: 'Practice weak concepts',
      description: weakConcepts.length > 0
        ? `You have low mastery in ${weakConcepts[0]}. Practice with targeted questions.`
        : `Build your foundation in ${topic} with practice questions.`,
      concept: weakConcepts[0],
      urgency: 'high',
      actionText: weakConcepts.length > 0
        ? `Can you give me a practice problem about ${weakConcepts[0]}?`
        : `Can you give me a practice problem about ${topic}?`,
    },
    {
      id: 's2',
      type: 'next_topic',
      title: 'Explore next topic',
      description: `Continue your learning journey in ${topic} by exploring a related concept.`,
      urgency: 'medium',
      actionText: `What should I learn next after the basics of ${topic}?`,
    },
    {
      id: 's3',
      type: 'revision',
      title: 'Quick review session',
      description: 'Reinforce what you\'ve learned to prevent memory decay.',
      urgency: 'low',
      actionText: `Can we quickly review the key concepts we've covered in ${topic}?`,
    },
  ];
}

// ─── Main Export ──────────────────────────────────────────────────────────────

/**
 * Generates 3 targeted learning suggestions for a student.
 * Incorporates decay alerts, weak concepts, DNA, and goal.
 */
export async function generateLearningSuggestions(studentId: string): Promise<Suggestion[]> {
  // Load student data
  const student = getStudent(studentId) as (Student & { cognitive_dna: CognitiveDNA }) | null;
  if (!student) return [];

  const conceptNodes = getConceptNodes(studentId) as ConceptNode[];
  const avgMastery = computeAvgMastery(conceptNodes);

  // Get decaying concepts (critical + high urgency only)
  const reviewQueue = generateReviewQueue(conceptNodes);
  const decayAlerts = reviewQueue
    .filter(r => r.urgency === 'critical' || r.urgency === 'high')
    .map(r => r.concept)
    .slice(0, 3);

  // Get weak concepts (mastery < 0.5)
  const weakConcepts = conceptNodes
    .filter(c => c.mastery < 0.5)
    .sort((a, b) => a.mastery - b.mastery)
    .map(c => c.concept)
    .slice(0, 3);

  const dna: CognitiveDNA = student.cognitive_dna || {
    visual: 0.5,
    abstract: 0.5,
    exampleFirst: 0.5,
    theoryFirst: 0.5,
    analogyDriven: 0.5,
    pace: 'medium',
    preferredStyle: 'balanced approach',
  };

  try {
    const raw = await callClaudeJSON<Array<{
      id: string;
      type: string;
      title: string;
      description: string;
      concept?: string;
      urgency: string;
      actionText: string;
    }>>(
      SUGGESTIONS_SYSTEM_PROMPT,
      buildSuggestionsUserPrompt({
        topic: student.topic,
        goal: student.goal,
        weakConcepts,
        decayAlerts,
        avgMastery,
        dna,
      }),
      512
    );

    if (!Array.isArray(raw) || raw.length === 0) {
      return defaultSuggestions(student.topic, weakConcepts);
    }

    return raw.slice(0, 3).map((s, i) => ({
      id: s.id || `s${i + 1}`,
      type: (['next_topic', 'revision', 'practice'].includes(s.type) ? s.type : 'next_topic') as Suggestion['type'],
      title: s.title || 'Learn something new',
      description: s.description || '',
      concept: s.concept,
      urgency: (['high', 'medium', 'low'].includes(s.urgency) ? s.urgency : 'medium') as Suggestion['urgency'],
      actionText: s.actionText || `Tell me more about ${student.topic}`,
    }));
  } catch {
    return defaultSuggestions(student.topic, weakConcepts);
  }
}
