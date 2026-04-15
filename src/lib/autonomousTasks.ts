/**
 * AEGIS Autonomous Task System
 *
 * AEGIS acts between sessions — without being prompted by the user.
 *
 * How it works:
 *   1. Background cognition (every 5 minutes) analyses all students
 *   2. For each student: generates tasks based on risk signals
 *   3. Tasks sit in a queue (autonomous_tasks table) until student returns
 *   4. On next login (first chat message), pending tasks are processed
 *      and converted to proactive messages prepended to the response
 *
 * Task types:
 *   revision_reminder       — knowledge is decaying, remind student to review
 *   misconception_correction — unresolved misconception needs attention
 *   feynman_test            — student has mastered a concept, trigger teach-back
 *   re_engagement           — student has been inactive, re-engage them
 *   milestone_celebration   — student hit a milestone, acknowledge it
 */

import { getDb } from './db';
import { v4 as uuidv4 } from 'uuid';
import type { ConceptNode } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TaskType =
  | 'revision_reminder'
  | 'misconception_correction'
  | 'feynman_test'
  | 're_engagement'
  | 'milestone_celebration';

export interface AutonomousTask {
  id: string;
  studentId: string;
  type: TaskType;
  priority: number;      // 1–10, higher = more urgent
  scheduledFor: string;
  status: 'pending' | 'delivered' | 'dismissed' | 'expired';
  payload: Record<string, unknown>;
  createdAt: string;
  deliveredAt?: string;
}

export interface ProactiveMessage {
  type: TaskType;
  message: string;
  taskId: string;
  priority: number;
}

// ─── Task Generation ──────────────────────────────────────────────────────────

/**
 * Generates autonomous tasks for a student based on their current state.
 * Called by background cognition cycle — no LLM needed.
 * Idempotent: skips if a pending task of the same type/concept already exists.
 */
export function generateAutonomousTasks(
  studentId: string,
  conceptNodes: ConceptNode[],
  avgFrustration: number,
  lastActiveAt: string,
  dropoutRisk: number
): void {
  const db = getDb();
  const now = Date.now();
  const daysSinceActive = (now - new Date(lastActiveAt).getTime()) / 86_400_000;

  const tasks: Omit<AutonomousTask, 'deliveredAt'>[] = [];

  // ── 1. Re-engagement (inactive > 3 days) ────────────────────────────────────
  if (daysSinceActive > 3) {
    const existing = db.prepare(`
      SELECT id FROM autonomous_tasks
      WHERE student_id = ? AND type = 're_engagement' AND status = 'pending'
    `).get(studentId);

    if (!existing) {
      tasks.push({
        id:           uuidv4(),
        studentId,
        type:         're_engagement',
        priority:     dropoutRisk > 0.6 ? 10 : 8,
        scheduledFor: new Date().toISOString(),
        status:       'pending',
        payload:      { daysSinceActive: Math.round(daysSinceActive) },
        createdAt:    new Date().toISOString(),
      });
    }
  }

  // ── 2. Revision reminders for decaying concepts ──────────────────────────────
  const decaying = conceptNodes
    .filter(n => {
      const elapsedDays = (now - new Date(n.last_reviewed).getTime()) / 86_400_000;
      const retention = Math.exp(-elapsedDays / Math.max(0.5, n.stability));
      return retention < 0.55 && n.mastery > 0.35;
    })
    .sort((a, b) => a.mastery - b.mastery)  // weakest first
    .slice(0, 2);

  for (const node of decaying) {
    const existing = db.prepare(`
      SELECT id FROM autonomous_tasks
      WHERE student_id = ? AND type = 'revision_reminder' AND status = 'pending'
      AND json_extract(payload, '$.concept') = ?
    `).get(studentId, node.concept);

    if (!existing) {
      const elapsedDays = (now - new Date(node.last_reviewed).getTime()) / 86_400_000;
      const retention = Math.exp(-elapsedDays / Math.max(0.5, node.stability));

      tasks.push({
        id:           uuidv4(),
        studentId,
        type:         'revision_reminder',
        priority:     retention < 0.3 ? 9 : 7,
        scheduledFor: new Date().toISOString(),
        status:       'pending',
        payload:      {
          concept:   node.concept,
          retention: Math.round(retention * 100),
          mastery:   Math.round(node.mastery * 100),
        },
        createdAt:    new Date().toISOString(),
      });
    }
  }

  // ── 3. Misconception correction ──────────────────────────────────────────────
  const withMisconceptions = conceptNodes
    .filter(n => Array.isArray(n.misconception) && n.misconception.length > 0)
    .slice(0, 1);

  for (const node of withMisconceptions) {
    const existing = db.prepare(`
      SELECT id FROM autonomous_tasks
      WHERE student_id = ? AND type = 'misconception_correction' AND status = 'pending'
      AND json_extract(payload, '$.concept') = ?
    `).get(studentId, node.concept);

    if (!existing) {
      const misconception = (node.misconception as Array<{ description: string; severity: string }>)[0];
      tasks.push({
        id:           uuidv4(),
        studentId,
        type:         'misconception_correction',
        priority:     misconception?.severity === 'high' ? 9 : 7,
        scheduledFor: new Date().toISOString(),
        status:       'pending',
        payload:      {
          concept:      node.concept,
          misconception: misconception?.description?.slice(0, 120) || '',
          severity:     misconception?.severity || 'medium',
        },
        createdAt:    new Date().toISOString(),
      });
    }
  }

  // ── 4. Feynman test for mastered-but-untested concepts ────────────────────────
  const feynmanCandidates = conceptNodes
    .filter(n => n.mastery > 0.75 && n.feynman_clarity === undefined)
    .slice(0, 1);

  for (const node of feynmanCandidates) {
    const existing = db.prepare(`
      SELECT id FROM autonomous_tasks
      WHERE student_id = ? AND type = 'feynman_test' AND status = 'pending'
      AND json_extract(payload, '$.concept') = ?
    `).get(studentId, node.concept);

    if (!existing) {
      tasks.push({
        id:           uuidv4(),
        studentId,
        type:         'feynman_test',
        priority:     6,
        scheduledFor: new Date().toISOString(),
        status:       'pending',
        payload:      { concept: node.concept, mastery: Math.round(node.mastery * 100) },
        createdAt:    new Date().toISOString(),
      });
    }
  }

  // ── Insert all new tasks ─────────────────────────────────────────────────────
  if (tasks.length === 0) return;

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO autonomous_tasks
    (id, student_id, type, priority, scheduled_for, status, payload, created_at)
    VALUES (@id, @student_id, @type, @priority, @scheduled_for, @status, @payload, @created_at)
  `);

  for (const task of tasks) {
    stmt.run({
      id:            task.id,
      student_id:    task.studentId,
      type:          task.type,
      priority:      task.priority,
      scheduled_for: task.scheduledFor,
      status:        task.status,
      payload:       JSON.stringify(task.payload),
      created_at:    task.createdAt,
    });
  }
}

// ─── Task Processing (on student return) ─────────────────────────────────────

/**
 * Called at the START of every chat request.
 * Retrieves up to 2 pending tasks, marks them delivered, returns proactive messages.
 * These are prepended to the AI response.
 */
export function processPendingTasks(studentId: string): ProactiveMessage[] {
  const db = getDb();

  const rows = db.prepare(`
    SELECT id, type, priority, payload
    FROM autonomous_tasks
    WHERE student_id = ? AND status = 'pending'
      AND scheduled_for <= datetime('now')
    ORDER BY priority DESC
    LIMIT 2
  `).all(studentId) as Array<{
    id: string;
    type: string;
    priority: number;
    payload: string;
  }>;

  if (rows.length === 0) return [];

  const messages: ProactiveMessage[] = [];
  const now = new Date().toISOString();

  for (const row of rows) {
    let payload: Record<string, unknown> = {};
    try { payload = JSON.parse(row.payload); } catch { /* */ }

    const message = buildTaskMessage(row.type as TaskType, payload);
    messages.push({ type: row.type as TaskType, message, taskId: row.id, priority: row.priority });

    db.prepare(
      "UPDATE autonomous_tasks SET status = 'delivered', delivered_at = ? WHERE id = ?"
    ).run(now, row.id);
  }

  // Expire stale tasks (> 7 days old)
  db.prepare(`
    UPDATE autonomous_tasks SET status = 'expired'
    WHERE student_id = ? AND status = 'pending'
      AND created_at < datetime('now', '-7 days')
  `).run(studentId);

  return messages;
}

// ─── Message Builder ──────────────────────────────────────────────────────────

function buildTaskMessage(type: TaskType, payload: Record<string, unknown>): string {
  switch (type) {
    case 're_engagement':
      return `Welcome back! It's been **${payload.daysSinceActive || 'several'} days** since your last session. Some knowledge may have faded — let's do a quick reset before diving in. What were you working on?`;

    case 'revision_reminder':
      return `Before we continue — I noticed your retention of **${payload.concept}** has dropped to ~${payload.retention}%. A 2-minute refresh now will save a lot of re-learning later. Want to do a quick check on that first?`;

    case 'misconception_correction':
      return `I want to address something from our last session. There's a misconception about **${payload.concept}** that I'd like to clear up before we build further on it. It's a common trap. Ready?`;

    case 'feynman_test':
      return `You've built solid mastery of **${payload.concept}** (${payload.mastery}%). The best way to lock this in permanently is to teach it. Can you explain ${payload.concept} in your own words — as if to someone hearing it for the first time?`;

    case 'milestone_celebration':
      return String(payload.message || 'You\'ve reached a significant milestone in your learning journey. Well done.');

    default:
      return 'Ready to continue where we left off?';
  }
}

// ─── Utility ──────────────────────────────────────────────────────────────────

export function getPendingTaskCount(studentId: string): number {
  const db = getDb();
  const row = db.prepare(`
    SELECT COUNT(*) as count FROM autonomous_tasks
    WHERE student_id = ? AND status = 'pending'
  `).get(studentId) as { count: number } | undefined;
  return row?.count ?? 0;
}
