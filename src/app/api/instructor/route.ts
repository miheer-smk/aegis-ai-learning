import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { computeRetention } from '@/lib/decay';
import { computeRiskScore } from '@/lib/agents';
import type { ConceptNode, StudentAnalytics, MisconceptionData, InstructorAnalytics } from '@/types';

interface DbStudent {
  id: string;
  name: string;
  topic: string;
  goal: string;
  cognitive_dna: string;
  created_at: string;
}

export async function GET() {
  try {
    const db = getDb();

    const students = db.prepare('SELECT * FROM students ORDER BY created_at DESC').all() as DbStudent[];

    const studentAnalytics: StudentAnalytics[] = [];
    const misconceptionMap = new Map<string, { count: number; severity: string; students: string[] }>();

    for (const student of students) {
      // Get concept nodes
      const conceptNodes = db
        .prepare('SELECT * FROM concept_nodes WHERE student_id = ?')
        .all(student.id) as (ConceptNode & { misconception: string })[];

      const parsedNodes = conceptNodes.map(n => ({
        ...n,
        misconception: typeof n.misconception === 'string' ? JSON.parse(n.misconception) : n.misconception,
      }));

      // Compute averages
      const avgMastery =
        parsedNodes.length > 0
          ? parsedNodes.reduce((s, n) => s + n.mastery, 0) / parsedNodes.length
          : 0;

      const avgRetention =
        parsedNodes.length > 0
          ? parsedNodes.reduce((s, n) => s + computeRetention(n.last_reviewed, n.stability), 0) /
            parsedNodes.length
          : 1;

      // Get last frustration level
      const lastMsg = db
        .prepare(
          'SELECT frustration_level FROM chat_messages WHERE student_id = ? ORDER BY timestamp DESC LIMIT 1'
        )
        .get(student.id) as { frustration_level: number } | undefined;
      const frustrationLevel = lastMsg?.frustration_level || 0;

      // Weak concepts
      const weakConcepts = parsedNodes
        .filter(n => {
          const ret = computeRetention(n.last_reviewed, n.stability);
          return n.mastery * ret < 0.4;
        })
        .map(n => n.concept)
        .slice(0, 5);

      const riskScore = computeRiskScore(avgMastery, frustrationLevel, avgRetention);

      // Collect misconceptions for heatmap
      for (const node of parsedNodes) {
        const misconceptions = node.misconception || [];
        for (const m of misconceptions) {
          const key = node.concept;
          const existing = misconceptionMap.get(key);
          if (existing) {
            existing.count++;
            if (!existing.students.includes(student.name)) {
              existing.students.push(student.name);
            }
            if (m.severity === 'high') existing.severity = 'high';
          } else {
            misconceptionMap.set(key, {
              count: 1,
              severity: m.severity || 'medium',
              students: [student.name],
            });
          }
        }
      }

      // Last active
      const lastActive = db
        .prepare(
          'SELECT timestamp FROM chat_messages WHERE student_id = ? ORDER BY timestamp DESC LIMIT 1'
        )
        .get(student.id) as { timestamp: string } | undefined;

      studentAnalytics.push({
        id: student.id,
        name: student.name,
        topic: student.topic,
        avgMastery,
        riskScore,
        frustrationLevel,
        weakConcepts,
        conceptCount: parsedNodes.length,
        interventionNeeded: riskScore > 0.65,
        lastActive: lastActive?.timestamp || student.created_at,
      });
    }

    // Sort by risk score descending
    studentAnalytics.sort((a, b) => b.riskScore - a.riskScore);

    // Build misconception heatmap
    const misconceptionHeatmap: MisconceptionData[] = Array.from(misconceptionMap.entries())
      .map(([concept, data]) => ({
        concept,
        count: data.count,
        severity: data.severity,
        students: data.students,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    // Class trends (last 7 days)
    const classTrends = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const activeStudents = db
        .prepare(
          "SELECT COUNT(DISTINCT student_id) as cnt FROM chat_messages WHERE date(timestamp) = ?"
        )
        .get(dateStr) as { cnt: number };

      classTrends.push({
        date: dateStr,
        avgMastery:
          studentAnalytics.length > 0
            ? studentAnalytics.reduce((s, st) => s + st.avgMastery, 0) / studentAnalytics.length
            : 0,
        activeStudents: activeStudents.cnt,
      });
    }

    const avgClassMastery =
      studentAnalytics.length > 0
        ? studentAnalytics.reduce((s, st) => s + st.avgMastery, 0) / studentAnalytics.length
        : 0;

    const analytics: InstructorAnalytics = {
      students: studentAnalytics,
      classTrends,
      misconceptionHeatmap,
      totalStudents: students.length,
      atRiskCount: studentAnalytics.filter(s => s.interventionNeeded).length,
      avgClassMastery,
    };

    return NextResponse.json(analytics);
  } catch (err) {
    console.error('[GET /api/instructor]', err);
    return NextResponse.json({ error: 'Failed to fetch instructor analytics' }, { status: 500 });
  }
}
