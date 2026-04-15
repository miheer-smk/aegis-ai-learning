import type { ConceptNode, ReviewItem } from '@/types';

/**
 * Ebbinghaus Forgetting Curve Implementation
 * Reference: Ebbinghaus, H. (1885). Über das Gedächtnis.
 *
 * R(t) = e^(-t/S)
 * R = retention probability [0, 1]
 * t = time elapsed since last review (days)
 * S = stability (characteristic decay constant, in days)
 */
export function computeRetention(lastReviewed: string, stability: number): number {
  const now = Date.now();
  const last = new Date(lastReviewed).getTime();
  const days = (now - last) / (1000 * 60 * 60 * 24);
  return Math.exp(-days / Math.max(0.5, stability));
}

/**
 * Apply temporal decay to mastery.
 * The effective mastery is mastery × retention.
 */
export function applyDecay(mastery: number, lastReviewed: string, stability: number): number {
  const retention = computeRetention(lastReviewed, stability);
  return mastery * retention;
}

/**
 * SM-2 inspired stability update after a successful review.
 * Higher quality responses lead to larger stability increases.
 * Reference: Wozniak, P. A. (1990). Optimization of learning.
 */
export function updateStability(
  currentStability: number,
  quality: number // 0-5 scale (SM-2 quality)
): number {
  if (quality < 3) {
    // Failed recall — reset to initial stability
    return Math.max(1.0, currentStability * 0.6);
  }
  // Successful recall — increase stability
  const easeFactor = 2.5 + 0.1 * (quality - 3);
  return currentStability * easeFactor;
}

/**
 * Compute the urgency of reviewing a concept.
 * Returns: critical (< 30% retention), high (30-50%), medium (50-70%), low (> 70%)
 */
export function getReviewUrgency(
  retention: number
): 'critical' | 'high' | 'medium' | 'low' {
  if (retention < 0.3) return 'critical';
  if (retention < 0.5) return 'high';
  if (retention < 0.7) return 'medium';
  return 'low';
}

/**
 * Compute days until retention drops below a threshold.
 * R(t) = e^(-t/S) → t = -S * ln(threshold)
 */
export function daysUntilThreshold(stability: number, threshold = 0.5): number {
  return -stability * Math.log(threshold);
}

/**
 * Generate a sorted review queue from all concept nodes.
 * Concepts with lowest retention × mastery are prioritized.
 */
export function generateReviewQueue(conceptNodes: ConceptNode[]): ReviewItem[] {
  const items: ReviewItem[] = conceptNodes.map(node => {
    const retention = computeRetention(node.last_reviewed, node.stability);
    const urgency = getReviewUrgency(retention);
    const nextReviewDays = daysUntilThreshold(node.stability, 0.5);

    return {
      conceptId: node.id,
      concept: node.concept,
      mastery: node.mastery,
      retention,
      urgency,
      nextReviewDays: Math.max(0, nextReviewDays),
    };
  });

  // Sort: critical first, then by effective mastery (mastery × retention) ascending
  return items.sort((a, b) => {
    const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    }
    return a.mastery * a.retention - b.mastery * b.retention;
  });
}

/**
 * Apply batch decay to all concept nodes.
 * Returns nodes with updated effective mastery.
 */
export function applyBatchDecay(conceptNodes: ConceptNode[]): Array<ConceptNode & { effectiveMastery: number; retention: number }> {
  return conceptNodes.map(node => {
    const retention = computeRetention(node.last_reviewed, node.stability);
    return {
      ...node,
      retention,
      effectiveMastery: node.mastery * retention,
    };
  });
}

/**
 * Generate data points for a forgetting curve visualization.
 * Returns an array of {day, retention} pairs for a given stability.
 */
export function forgettingCurvePoints(
  stability: number,
  days = 30,
  points = 60
): Array<{ day: number; retention: number }> {
  return Array.from({ length: points }, (_, i) => {
    const day = (i / (points - 1)) * days;
    return { day, retention: Math.exp(-day / Math.max(0.5, stability)) };
  });
}

/**
 * Compute the average class retention across all students' concepts.
 */
export function computeClassRetention(allNodes: ConceptNode[]): number {
  if (allNodes.length === 0) return 0;
  const total = allNodes.reduce(
    (sum, n) => sum + computeRetention(n.last_reviewed, n.stability),
    0
  );
  return total / allNodes.length;
}
