import { callClaudeJSON } from './anthropic';
import type { EpistemicState, ConceptNode, Misconception } from '@/types';
import { getConceptNodes, upsertConceptNode } from './db';
import { v4 as uuidv4 } from 'uuid';
import { computeRetention } from './decay';

interface RawEpistemicState {
  understood: Array<{ concept: string; confidence: number }>;
  misconceptions: Array<{ concept: string; description: string; severity: string }>;
  missingPrerequisites: string[];
  frustrationLevel: number;
  engagementLevel: number;
}

/**
 * Uses Claude to extract the student's epistemic state from conversation.
 * Returns structured data about what they understand, misunderstand, and are missing.
 */
export async function analyzeEpistemicState(
  recentMessages: Array<{ role: string; content: string }>,
  topic: string
): Promise<EpistemicState> {
  const conversationText = recentMessages
    .slice(-8)
    .map(m => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n');

  const systemPrompt = `You are an expert educational psychologist specializing in epistemic state analysis.
Your task is to analyze a student-tutor conversation and extract precise cognitive state information.
You MUST return ONLY valid JSON with no additional text.`;

  const userPrompt = `Topic: ${topic}

Conversation:
${conversationText}

Analyze the student's epistemic state and return this exact JSON structure:
{
  "understood": [{"concept": "string", "confidence": 0.0-1.0}],
  "misconceptions": [{"concept": "string", "description": "string", "severity": "low|medium|high"}],
  "missingPrerequisites": ["concept1", "concept2"],
  "frustrationLevel": 0.0-1.0,
  "engagementLevel": 0.0-1.0
}

Rules:
- frustrationLevel: 0=calm, 1=very frustrated (detect from confused statements, repeated questions, "I don't get it")
- confidence: how strongly student demonstrated understanding (not just stated it)
- severity: how much the misconception will block further learning
- missingPrerequisites: concepts they NEED but haven't learned yet`;

  const result = await callClaudeJSON<RawEpistemicState>(systemPrompt, userPrompt, 600);

  if (!result) {
    return {
      understood: [],
      misconceptions: [],
      missingPrerequisites: [],
      frustrationLevel: 0.2,
      engagementLevel: 0.5,
    };
  }

  return {
    understood: result.understood || [],
    misconceptions: (result.misconceptions || []).map(m => ({
      concept: m.concept,
      description: m.description,
      severity: (m.severity as 'low' | 'medium' | 'high') || 'medium',
    })),
    missingPrerequisites: result.missingPrerequisites || [],
    frustrationLevel: Math.max(0, Math.min(1, result.frustrationLevel || 0.2)),
    engagementLevel: Math.max(0, Math.min(1, result.engagementLevel || 0.5)),
  };
}

/**
 * Updates concept nodes in the database based on the latest epistemic analysis.
 * Applies mastery gains to understood concepts and records new misconceptions.
 */
export async function updateConceptGraph(
  studentId: string,
  epistemicState: EpistemicState
): Promise<void> {
  const existingNodes = getConceptNodes(studentId) as ConceptNode[];
  const nodeMap = new Map(existingNodes.map(n => [n.concept.toLowerCase(), n]));

  // Process understood concepts
  for (const { concept, confidence } of epistemicState.understood) {
    const key = concept.toLowerCase();
    const existing = nodeMap.get(key);
    const now = new Date().toISOString();

    if (existing) {
      // Apply mastery gain (bounded by confidence and diminishing returns)
      const gain = (confidence - existing.mastery) * 0.3;
      const newMastery = Math.min(0.99, existing.mastery + Math.max(0, gain));
      // SM-2 inspired stability increase
      const newStability = existing.mastery > 0.7
        ? existing.stability * 1.5
        : existing.stability * 1.2;

      upsertConceptNode({
        id: existing.id,
        student_id: studentId,
        concept: existing.concept,
        mastery: newMastery,
        stability: Math.min(60, newStability),
        last_reviewed: now,
        misconception: existing.misconception,
        review_count: existing.review_count + 1,
      });
    } else {
      // New concept discovered
      upsertConceptNode({
        id: uuidv4(),
        student_id: studentId,
        concept: concept,
        mastery: confidence * 0.5, // Initial mastery is half the observed confidence
        stability: 2.0,
        last_reviewed: now,
        misconception: [],
        review_count: 1,
      });
    }
  }

  // Process misconceptions
  for (const { concept, description, severity } of epistemicState.misconceptions) {
    const key = concept.toLowerCase();
    const existing = nodeMap.get(key);
    const now = new Date().toISOString();

    const newMisconception: Misconception = {
      description,
      severity,
      detected_at: now,
    };

    if (existing) {
      // Reduce mastery for misconceptions, add to misconception list
      const masteryPenalty = severity === 'high' ? 0.15 : severity === 'medium' ? 0.08 : 0.03;
      const existingMisconceptions: Misconception[] = existing.misconception || [];
      const alreadyRecorded = existingMisconceptions.some(
        m => m.description.toLowerCase() === description.toLowerCase()
      );

      upsertConceptNode({
        id: existing.id,
        student_id: studentId,
        concept: existing.concept,
        mastery: Math.max(0.05, existing.mastery - masteryPenalty),
        stability: existing.stability,
        last_reviewed: existing.last_reviewed,
        misconception: alreadyRecorded
          ? existingMisconceptions
          : [...existingMisconceptions.slice(-4), newMisconception],
        review_count: existing.review_count,
      });
    } else {
      upsertConceptNode({
        id: uuidv4(),
        student_id: studentId,
        concept: concept,
        mastery: 0.1,
        stability: 1.5,
        last_reviewed: now,
        misconception: [newMisconception],
        review_count: 0,
      });
    }
  }
}

/**
 * Builds a knowledge graph from concept nodes, computing retention and inferring links.
 */
export function buildKnowledgeGraph(conceptNodes: ConceptNode[]): {
  nodes: Array<{
    id: string;
    concept: string;
    mastery: number;
    retention: number;
    misconceptions: number;
    reviewCount: number;
  }>;
  links: Array<{ source: string; target: string; strength: number }>;
} {
  const nodes = conceptNodes.map(node => ({
    id: node.id,
    concept: node.concept,
    mastery: node.mastery,
    retention: computeRetention(node.last_reviewed, node.stability),
    misconceptions: (node.misconception || []).length,
    reviewCount: node.review_count,
  }));

  // Build links: concepts reviewed within 3 days of each other are linked
  const links: Array<{ source: string; target: string; strength: number }> = [];
  const sorted = [...conceptNodes].sort(
    (a, b) => new Date(a.last_reviewed).getTime() - new Date(b.last_reviewed).getTime()
  );

  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < Math.min(i + 4, sorted.length); j++) {
      const daysDiff =
        Math.abs(
          new Date(sorted[i].last_reviewed).getTime() -
            new Date(sorted[j].last_reviewed).getTime()
        ) /
        (1000 * 60 * 60 * 24);

      if (daysDiff < 3) {
        const strength = Math.max(0.1, 1 - daysDiff / 3);
        links.push({ source: sorted[i].id, target: sorted[j].id, strength });
      }
    }
  }

  return { nodes, links };
}

/**
 * Identifies which concepts are flagged as weak (low mastery or low retention).
 */
export function getWeakConcepts(
  conceptNodes: ConceptNode[],
  threshold = 0.4
): string[] {
  return conceptNodes
    .filter(n => {
      const retention = computeRetention(n.last_reviewed, n.stability);
      return n.mastery * retention < threshold;
    })
    .map(n => n.concept);
}
