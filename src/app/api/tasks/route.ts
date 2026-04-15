/**
 * GET /api/tasks?studentId=xxx
 *
 * Returns pending autonomous tasks for a student.
 * The frontend uses this to show a badge ("AEGIS has 2 things to tell you").
 *
 * This is a read-only endpoint — it does NOT mark tasks as delivered.
 * Delivery happens when the student sends a chat message.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getPendingTaskCount } from '@/lib/autonomousTasks';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get('studentId');

  if (!studentId) {
    return NextResponse.json({ error: 'studentId is required' }, { status: 400 });
  }

  try {
    const db = getDb();

    // Check student exists
    const student = db.prepare('SELECT id FROM students WHERE id = ?').get(studentId);
    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    const count = getPendingTaskCount(studentId);

    // Return task summaries (not full payloads — keep it lightweight)
    const tasks = db.prepare(`
      SELECT id, type, priority, scheduled_for, created_at
      FROM   autonomous_tasks
      WHERE  student_id = ? AND status = 'pending'
      ORDER  BY priority DESC
      LIMIT  5
    `).all(studentId) as Array<{
      id: string;
      type: string;
      priority: number;
      scheduled_for: string;
      created_at: string;
    }>;

    return NextResponse.json({
      pendingCount: count,
      tasks: tasks.map(t => ({
        id:           t.id,
        type:         t.type,
        priority:     t.priority,
        scheduledFor: t.scheduled_for,
        createdAt:    t.created_at,
      })),
    });

  } catch (err) {
    console.error('[GET /api/tasks]', err);
    return NextResponse.json({ error: 'Failed to load tasks' }, { status: 500 });
  }
}
