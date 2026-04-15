import { NextRequest, NextResponse } from 'next/server';
import { getDb, getStudent } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import type { CognitiveDNA } from '@/types';

const defaultDNA: CognitiveDNA = {
  visual: 0.5,
  abstract: 0.5,
  exampleFirst: 0.5,
  theoryFirst: 0.5,
  analogyDriven: 0.5,
  pace: 'medium',
  preferredStyle: 'balanced mix of theory and examples',
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { name?: string; topic?: string; goal?: string };
    const { name, topic, goal } = body;

    if (!name?.trim() || !topic?.trim() || !goal?.trim()) {
      return NextResponse.json(
        { error: 'name, topic, and goal are required' },
        { status: 400 }
      );
    }

    const db = getDb();
    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO students (id, name, topic, goal, cognitive_dna, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, name.trim(), topic.trim(), goal.trim(), JSON.stringify(defaultDNA), now);

    // Create a seed session
    const sessionId = uuidv4();
    db.prepare(`
      INSERT INTO sessions (id, student_id, started_at, concepts_covered, mastery_delta)
      VALUES (?, ?, ?, ?, ?)
    `).run(sessionId, id, now, '[]', 0);

    return NextResponse.json({
      id,
      name: name.trim(),
      topic: topic.trim(),
      goal: goal.trim(),
      cognitive_dna: defaultDNA,
      created_at: now,
      session_id: sessionId,
    });
  } catch (err) {
    console.error('[POST /api/student]', err);
    return NextResponse.json({ error: 'Failed to create student' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      // Return all students
      const db = getDb();
      const rows = db.prepare('SELECT * FROM students ORDER BY created_at DESC').all() as Record<string, unknown>[];
      const students = rows.map(row => ({
        ...row,
        cognitive_dna: typeof row.cognitive_dna === 'string' ? JSON.parse(row.cognitive_dna) : row.cognitive_dna,
      }));
      return NextResponse.json({ students });
    }

    const student = getStudent(id);
    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    // Get session count and stats
    const db = getDb();
    const msgCount = (db.prepare('SELECT COUNT(*) as cnt FROM chat_messages WHERE student_id = ?').get(id) as { cnt: number }).cnt;
    const conceptCount = (db.prepare('SELECT COUNT(*) as cnt FROM concept_nodes WHERE student_id = ?').get(id) as { cnt: number }).cnt;

    return NextResponse.json({ ...student, messageCount: msgCount, conceptCount });
  } catch (err) {
    console.error('[GET /api/student]', err);
    return NextResponse.json({ error: 'Failed to fetch student' }, { status: 500 });
  }
}
