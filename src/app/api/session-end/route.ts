/**
 * AEGIS Session-End Continuous Learning Loop
 *
 * Called when a student ends their session (or automatically every 15 messages).
 * Runs a full cognitive analysis and writes a personalized learning plan.
 *
 * Stages:
 *   1. Aggregate session metrics (mastery delta, frustration arc, concepts touched)
 *   2. Run predictive model (identify 7-day risk map)
 *   3. Update concept_difficulty table (global learning insights)
 *   4. Generate + persist learning plan
 *   5. Update prompt_performance table (for self-improving prompts)
 *   6. Update cognitive state session count
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb, getConceptNodes, getChatHistory, getStudent } from '@/lib/db';
import { getCognitiveState, updateCognitiveState } from '@/lib/cognitiveState';
import { predictFutureState } from '@/lib/predictiveModel';
import { computeRetention } from '@/lib/decay';
import { v4 as uuidv4 } from 'uuid';
import type { ConceptNode } from '@/types';
// AGI upgrade imports
import { consolidateMemory } from '@/lib/memoryConsolidation';
import { generateAutonomousTasks } from '@/lib/autonomousTasks';
import { recordSessionOutcome } from '@/lib/tutorProfile';
import { emitSessionEnd } from '@/lib/eventSystem';

interface SessionEndBody {
  studentId: string;
  sessionId?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as SessionEndBody;
    const { studentId } = body;

    if (!studentId) {
      return NextResponse.json({ error: 'studentId is required' }, { status: 400 });
    }

    const student = getStudent(studentId);
    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    const db = getDb();
    const conceptNodes = getConceptNodes(studentId) as ConceptNode[];
    const cognitiveState = getCognitiveState(studentId);

    // ── Stage 1: Compute session metrics ─────────────────────────────────────
    // Last 20 messages = one session worth
    const recentHistory = getChatHistory(studentId, 20).reverse() as Array<{
      role: string;
      content: string;
      agent_type: string;
      frustration_level: number;
      timestamp: string;
    }>;

    const userMessages = recentHistory.filter(m => m.role === 'user');
    const avgFrustration = userMessages.length > 0
      ? userMessages.reduce((s, m) => s + (m.frustration_level || 0), 0) / userMessages.length
      : 0;

    const avgMastery = conceptNodes.length > 0
      ? conceptNodes.reduce((s, n) => s + n.mastery, 0) / conceptNodes.length
      : 0;

    // ── Stage 2: Run predictive model ─────────────────────────────────────────
    const predictive = predictFutureState(
      studentId,
      conceptNodes,
      avgFrustration,
      cognitiveState.learningPatterns.totalMessageCount
    );

    // ── Stage 3: Update concept_difficulty (global analytics) ─────────────────
    // For each concept the student has interacted with, update global difficulty stats
    for (const node of conceptNodes) {
      const hasMisconception = Array.isArray(node.misconception) && node.misconception.length > 0;
      const commonMisconceptions: string[] = [];
      if (hasMisconception) {
        for (const m of (node.misconception as Array<{ description: string }> )) {
          commonMisconceptions.push(m.description.slice(0, 100));
        }
      }

      db.prepare(`
        INSERT INTO concept_difficulty (
          concept, avg_attempts_to_master, misconception_frequency,
          common_misconceptions, total_students, last_updated
        ) VALUES (
          @concept, @avg_attempts, @misc_freq, @common_misc, 1, @now
        )
        ON CONFLICT(concept) DO UPDATE SET
          avg_attempts_to_master  = (avg_attempts_to_master * total_students + @avg_attempts) / (total_students + 1),
          misconception_frequency = (misconception_frequency * total_students + @misc_freq) / (total_students + 1),
          common_misconceptions   = @common_misc,
          total_students          = total_students + 1,
          last_updated            = @now
      `).run({
        concept: node.concept,
        avg_attempts: node.review_count || 1,
        misc_freq: hasMisconception ? 1 : 0,
        common_misc: JSON.stringify(commonMisconceptions.slice(0, 5)),
        now: new Date().toISOString(),
      });
    }

    // ── Stage 4: Generate and persist learning plan ───────────────────────────
    const plan = predictive.learningPath.map(item => ({
      concept: item.concept,
      reason: item.reason,
      estimatedSessions: item.estimatedSessions,
      priority: item.priority,
    }));

    // Mark old plans as superseded
    db.prepare(`
      UPDATE learning_plans SET status = 'superseded'
      WHERE student_id = ? AND status = 'active'
    `).run(studentId);

    if (plan.length > 0) {
      db.prepare(`
        INSERT INTO learning_plans (id, student_id, created_at, plan, status)
        VALUES (?, ?, ?, ?, 'active')
      `).run(uuidv4(), studentId, new Date().toISOString(), JSON.stringify(plan));
    }

    // ── Stage 5: Log prompt performance ──────────────────────────────────────
    // Log aggregate session performance per agent used
    const agentUsage: Record<string, { masteryDelta: number; frustrationEnd: number; count: number }> = {};
    for (const msg of recentHistory) {
      const agent = msg.agent_type || 'PROBE';
      if (!agentUsage[agent]) agentUsage[agent] = { masteryDelta: 0, frustrationEnd: 0, count: 0 };
      agentUsage[agent].count++;
      agentUsage[agent].frustrationEnd = msg.frustration_level || 0;
    }

    const tomAccuracyAvg = cognitiveState.tomAccuracyTrend.length > 0
      ? cognitiveState.tomAccuracyTrend.slice(-5).reduce((a, b) => a + b, 0) /
        Math.min(5, cognitiveState.tomAccuracyTrend.length)
      : null;

    for (const [agentType, stats] of Object.entries(agentUsage)) {
      db.prepare(`
        INSERT INTO prompt_performance (
          id, student_id, agent_type, timestamp,
          mastery_delta, frustration_end, reflection_score, tom_accuracy
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        uuidv4(), studentId, agentType, new Date().toISOString(),
        avgMastery,               // proxy for mastery delta
        stats.frustrationEnd,
        0,                        // reflection score tracked per-message
        tomAccuracyAvg
      );
    }

    // ── Stage 6: Update cognitive state (session count + patterns) ────────────
    const prevRetentions = conceptNodes.map(n =>
      computeRetention(n.last_reviewed, n.stability)
    );
    const avgRetention = prevRetentions.length > 0
      ? prevRetentions.reduce((a, b) => a + b, 0) / prevRetentions.length
      : 1;

    updateCognitiveState(studentId, {
      learningPatterns: {
        ...cognitiveState.learningPatterns,
        totalSessionCount: cognitiveState.learningPatterns.totalSessionCount + 1,
        avgMasteryGainPerSession:
          (cognitiveState.learningPatterns.avgMasteryGainPerSession * 0.8) +
          (avgMastery * 0.2),
      },
    });

    // ── Stage 7 [AGI]: Memory Consolidation ───────────────────────────────────
    // Episodic → Semantic → Identity; prune noise from old snapshots
    void Promise.resolve().then(() => {
      try { consolidateMemory(studentId); } catch { /* non-critical */ }
    });

    // ── Stage 8 [AGI]: Generate autonomous tasks for next visit ───────────────
    void Promise.resolve().then(() => {
      try {
        const lastMessage = recentHistory[recentHistory.length - 1];
        const lastActiveAt = lastMessage?.timestamp ?? new Date().toISOString();
        generateAutonomousTasks(
          studentId, conceptNodes, avgFrustration, lastActiveAt, predictive.dropoutRisk
        );
      } catch { /* non-critical */ }
    });

    // ── Stage 9 [AGI]: Update tutor self-model ────────────────────────────────
    void Promise.resolve().then(() => {
      try {
        const isNewStudent = cognitiveState.learningPatterns.totalSessionCount === 0;
        recordSessionOutcome(avgMastery, isNewStudent);
      } catch { /* non-critical */ }
    });

    // ── Stage 10 [AGI]: Emit session-end event ────────────────────────────────
    emitSessionEnd(studentId, {
      avgMastery, avgFrustration, avgRetention,
      conceptsTouched: conceptNodes.length,
    });

    // ── Response ──────────────────────────────────────────────────────────────
    return NextResponse.json({
      success: true,
      sessionAnalysis: {
        avgMastery: Math.round(avgMastery * 1000) / 1000,
        avgFrustration: Math.round(avgFrustration * 1000) / 1000,
        avgRetention: Math.round(avgRetention * 1000) / 1000,
        conceptsTouched: conceptNodes.length,
      },
      predictive: {
        dropoutRisk: predictive.dropoutRisk,
        projectedMastery7d: predictive.projectedMastery7d,
        criticalConcepts: predictive.predictedRiskMap
          .filter(r => r.urgency === 'critical')
          .map(r => r.concept),
        bottlenecks: predictive.bottlenecks,
        estimatedSessionsToGoal: predictive.estimatedSessionsToGoal,
      },
      learningPlan: plan,
    });

  } catch (err) {
    console.error('[POST /api/session-end]', err);
    const message = err instanceof Error ? err.message : 'An error occurred';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
