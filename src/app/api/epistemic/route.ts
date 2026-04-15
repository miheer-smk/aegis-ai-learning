import { NextRequest, NextResponse } from 'next/server';
import { getConceptNodes } from '@/lib/db';
import { buildKnowledgeGraph } from '@/lib/epistemic';
import { generateReviewQueue, applyBatchDecay } from '@/lib/decay';
import type { ConceptNode } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');

    if (!studentId) {
      return NextResponse.json({ error: 'studentId is required' }, { status: 400 });
    }

    const rawNodes = getConceptNodes(studentId) as ConceptNode[];

    // Apply decay to get current effective mastery
    const nodesWithDecay = applyBatchDecay(rawNodes);

    // Build knowledge graph
    const { nodes, links } = buildKnowledgeGraph(rawNodes);

    // Generate review queue
    const reviewQueue = generateReviewQueue(rawNodes);

    // Compute summary stats
    const avgMastery = rawNodes.length > 0
      ? rawNodes.reduce((s, n) => s + n.mastery, 0) / rawNodes.length
      : 0;
    const avgRetention = nodesWithDecay.length > 0
      ? nodesWithDecay.reduce((s, n) => s + n.retention, 0) / nodesWithDecay.length
      : 1;
    const totalMisconceptions = rawNodes.reduce(
      (s, n) => s + (n.misconception || []).length,
      0
    );

    return NextResponse.json({
      nodes,
      links,
      reviewQueue: reviewQueue.slice(0, 10),
      stats: {
        conceptCount: rawNodes.length,
        avgMastery,
        avgRetention,
        totalMisconceptions,
        weakConceptCount: reviewQueue.filter(r => r.urgency === 'critical' || r.urgency === 'high').length,
      },
    });
  } catch (err) {
    console.error('[GET /api/epistemic]', err);
    return NextResponse.json({ error: 'Failed to fetch epistemic state' }, { status: 500 });
  }
}
