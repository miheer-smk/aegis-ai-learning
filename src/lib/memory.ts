/**
 * AEGIS Dual-Memory Architecture
 *
 * Human cognition uses two memory systems (Baddeley, 2000):
 *   Working memory:  limited capacity, current context window (~7 items)
 *   Long-term memory: unlimited, compressed, associative
 *
 * AEGIS mirrors this:
 *   Working memory  = last 10 raw messages (passed directly to Claude)
 *   Long-term memory = compressed JSON snapshots in SQLite
 *                      retrieved semantically by query relevance
 *
 * This architecture:
 *   1. Solves the token-limit problem (never send full history)
 *   2. Provides cross-session context (past sessions inform current)
 *   3. Focuses attention (only relevant memories are retrieved)
 *
 * Compression trigger: every 20 messages → compress oldest 20 → store snapshot
 */

import { getDb } from './db';
import { callClaudeJSON } from './anthropic';
import { v4 as uuidv4 } from 'uuid';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MemorySummary {
  masteredConcepts: string[];
  activeMisconceptions: string[];
  resolvedMisconceptions: string[];
  breakthroughs: Array<{ concept: string; method: string }>;
  learningPatterns: string[];
  emotionalJourney: string;
}

export interface MemorySnapshot {
  id: string;
  studentId: string;
  createdAt: string;
  summary: MemorySummary;
  messageCount: number;
  keywords: string[];
}

// ─── Compression ──────────────────────────────────────────────────────────────

const COMPRESSION_PROMPT = `You are a cognitive memory compression system for an AI tutor.
Extract the most pedagogically significant information from this tutoring conversation.
Prioritize: genuine understanding gains, misconceptions detected/resolved, breakthrough moments, learning style signals.
Return ONLY valid JSON — no markdown, no explanation.`;

export async function summarizeAndCompressMemory(
  studentId: string,
  messages: Array<{ role: string; content: string }>,
  messageIndexStart: number
): Promise<MemorySnapshot | null> {
  if (messages.length < 6) return null;

  // Truncate to avoid token overflow — take first + last sections
  const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0);
  let conversationText: string;
  if (totalChars > 6000) {
    const firstHalf = messages.slice(0, Math.ceil(messages.length / 2));
    const secondHalf = messages.slice(-Math.floor(messages.length / 3));
    conversationText = [
      ...firstHalf,
      { role: 'system', content: '[...middle of conversation omitted...]' },
      ...secondHalf,
    ].map(m => `[${m.role.toUpperCase()}]: ${m.content.slice(0, 300)}`).join('\n');
  } else {
    conversationText = messages
      .map(m => `[${m.role.toUpperCase()}]: ${m.content.slice(0, 400)}`)
      .join('\n');
  }

  const userPrompt = `Compress this tutoring conversation into a structured memory snapshot.

Conversation (messages ${messageIndexStart} to ${messageIndexStart + messages.length}):
${conversationText}

Return ONLY this JSON:
{
  "masteredConcepts": ["concepts genuinely understood"],
  "activeMisconceptions": ["still-held incorrect beliefs at end of conversation"],
  "resolvedMisconceptions": ["misconceptions that were corrected during this session"],
  "breakthroughs": [{"concept": "X", "method": "what explanation/analogy finally worked"}],
  "learningPatterns": ["observed pattern about how this student learns best"],
  "emotionalJourney": "one sentence: frustration to engagement arc",
  "keywords": ["key topics, concepts, domains covered — for future retrieval"]
}`;

  const raw = await callClaudeJSON<MemorySummary & { keywords: string[] }>(
    COMPRESSION_PROMPT,
    userPrompt,
    600
  );

  if (!raw) return null;

  const snapshot: MemorySnapshot = {
    id: uuidv4(),
    studentId,
    createdAt: new Date().toISOString(),
    summary: {
      masteredConcepts:       raw.masteredConcepts || [],
      activeMisconceptions:   raw.activeMisconceptions || [],
      resolvedMisconceptions: raw.resolvedMisconceptions || [],
      breakthroughs:          raw.breakthroughs || [],
      learningPatterns:       raw.learningPatterns || [],
      emotionalJourney:       raw.emotionalJourney || '',
    },
    messageCount: messages.length,
    keywords: Array.isArray(raw.keywords) ? raw.keywords : [],
  };

  // Persist
  const db = getDb();
  db.prepare(`
    INSERT OR IGNORE INTO memory_snapshots
      (id, student_id, created_at, summary, message_count, keywords)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    snapshot.id,
    snapshot.studentId,
    snapshot.createdAt,
    JSON.stringify(snapshot.summary),
    snapshot.messageCount,
    JSON.stringify(snapshot.keywords)
  );

  return snapshot;
}

// ─── Retrieval ────────────────────────────────────────────────────────────────

/**
 * Retrieves the most relevant compressed memories for a given query.
 * Returns a formatted string ready for injection into a system prompt.
 *
 * Strategy:
 *   1. Always include the most recent snapshot (recency bias)
 *   2. Score remaining snapshots by keyword overlap with current query
 *   3. Include top 1 additional relevant snapshot if score > 0
 */
export function retrieveRelevantMemory(
  studentId: string,
  currentQuery: string
): string {
  const db = getDb();
  const rows = db.prepare(`
    SELECT summary, created_at, keywords, message_count
    FROM memory_snapshots
    WHERE student_id = ?
    ORDER BY created_at DESC
    LIMIT 5
  `).all(studentId) as Array<{
    summary: string;
    created_at: string;
    keywords: string;
    message_count: number;
  }>;

  if (rows.length === 0) return '';

  // Score by keyword relevance
  const queryTokens = currentQuery.toLowerCase().split(/[\s,]+/).filter(w => w.length > 3);

  const scored = rows.map(row => {
    let keywords: string[] = [];
    try { keywords = JSON.parse(row.keywords); } catch { /* */ }
    const kw = keywords.map(k => k.toLowerCase());
    const score = queryTokens.filter(q => kw.some(k => k.includes(q) || q.includes(k))).length;
    return { ...row, score, keywords };
  });

  // Always include most recent; add one more if relevant
  const toInclude = [scored[0]];
  const additional = scored.slice(1).find(r => r.score > 0);
  if (additional) toInclude.push(additional);

  const formatted = toInclude.map(row => {
    let summary: MemorySummary = {
      masteredConcepts: [], activeMisconceptions: [],
      resolvedMisconceptions: [], breakthroughs: [],
      learningPatterns: [], emotionalJourney: '',
    };
    try { summary = JSON.parse(row.summary); } catch { /* */ }

    const daysAgo = Math.round(
      (Date.now() - new Date(row.created_at).getTime()) / 86_400_000
    );
    const age = daysAgo === 0 ? 'today' : `${daysAgo}d ago`;

    const lines = [`[Memory — ${age}, ${row.message_count} messages]`];
    if (summary.masteredConcepts.length)
      lines.push(`  Mastered: ${summary.masteredConcepts.join(', ')}`);
    if (summary.activeMisconceptions.length)
      lines.push(`  Still confused about: ${summary.activeMisconceptions.join(', ')}`);
    if (summary.breakthroughs.length)
      lines.push(`  What worked: ${summary.breakthroughs.slice(0, 2).map(b => `${b.concept} via "${b.method}"`).join('; ')}`);
    if (summary.learningPatterns.length)
      lines.push(`  Pattern: ${summary.learningPatterns[0]}`);
    return lines.join('\n');
  });

  return `\nLONG-TERM MEMORY (compressed, previous sessions):\n${formatted.join('\n\n')}`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns true when the message count crosses a compression threshold */
export function shouldCompress(messageCount: number): boolean {
  return messageCount > 0 && messageCount % 20 === 0;
}

/** Returns how many snapshots exist for a student */
export function getSnapshotCount(studentId: string): number {
  const db = getDb();
  const row = db.prepare(
    'SELECT COUNT(*) as cnt FROM memory_snapshots WHERE student_id = ?'
  ).get(studentId) as { cnt: number };
  return row?.cnt ?? 0;
}
