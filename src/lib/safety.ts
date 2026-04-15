/**
 * AEGIS Input Safety & Content Filtering
 *
 * Two-stage pipeline:
 * 1. Fast keyword check — blocks clear violations instantly (no LLM cost)
 * 2. Claude semantic check — handles borderline cases with context awareness
 */

import { callClaudeJSON } from './anthropic';
import { buildSafetyUserPrompt, SAFETY_SYSTEM_PROMPT } from './prompts';
import type { SafetyResult } from '@/types';

// ─── Stage 1: Fast Keyword Filter ────────────────────────────────────────────

const ABUSIVE_PATTERNS = [
  /\b(fuck|shit|bitch|ass\s*hole|bastard|damn\s*you|kill\s*(your|my)self)\b/i,
  /\b(hate\s*you|you\s*suck|stupid\s*(ai|bot|system))\b/i,
  /\b(i\s*want\s*to\s*die|hurt\s*myself|self.harm)\b/i,
];

const CLEARLY_OFFTOPIC_PATTERNS = [
  /\b(latest\s*news|stock\s*price|weather\s*today|sports\s*score|celebrity)\b/i,
  /\b(write\s*my\s*essay|do\s*my\s*homework|give\s*me\s*the\s*answer\s*to)\b/i,
  /\b(hack|jailbreak|ignore\s*(your|all)\s*(instructions|rules|prompt))\b/i,
  /\b(pretend\s*you\s*are|act\s*as\s*if\s*you|forget\s*you\s*are)\b/i,
];

function keywordCheck(message: string): { flagged: boolean; category: SafetyResult['category']; reason?: string } {
  for (const pattern of ABUSIVE_PATTERNS) {
    if (pattern.test(message)) {
      return { flagged: true, category: 'abusive', reason: 'Message contains abusive or harmful language.' };
    }
  }
  for (const pattern of CLEARLY_OFFTOPIC_PATTERNS) {
    if (pattern.test(message)) {
      return { flagged: true, category: 'off_topic', reason: 'Message appears unrelated to the study topic.' };
    }
  }
  // Very short nonsensical messages
  if (message.trim().length < 3 || /^[^a-zA-Z0-9\s]{4,}$/.test(message.trim())) {
    return { flagged: true, category: 'irrelevant', reason: 'Message is too short or contains no meaningful content.' };
  }
  return { flagged: false, category: 'ok' };
}

// ─── Stage 2: Claude Semantic Check ──────────────────────────────────────────

async function semanticCheck(message: string, topic: string): Promise<{
  safe: boolean;
  category: SafetyResult['category'];
  reason?: string;
}> {
  try {
    const result = await callClaudeJSON<{
      safe: boolean;
      category: string;
      reason: string | null;
    }>(
      SAFETY_SYSTEM_PROMPT,
      buildSafetyUserPrompt(message, topic),
      256
    );
    if (!result) return { safe: true, category: 'ok' };
    return {
      safe: result.safe,
      category: (result.category as SafetyResult['category']) || 'ok',
      reason: result.reason || undefined,
    };
  } catch {
    // If Claude fails, default to safe (permissive degradation)
    return { safe: true, category: 'ok' };
  }
}

// ─── Sanitize Message Text ────────────────────────────────────────────────────

function sanitize(message: string): string {
  // Strip control characters, excessive whitespace, and normalize unicode
  return message
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/\s{3,}/g, '  ')
    .trim()
    .slice(0, 4000); // Hard cap at 4000 chars
}

// ─── Blocked Response Templates ──────────────────────────────────────────────

const BLOCKED_RESPONSES: Record<SafetyResult['category'], string> = {
  abusive: "I'm here to help you learn, and I work best in a respectful environment. Let's refocus on your studies — what would you like to understand better?",
  off_topic: "That's outside our study session scope. I'm specialized in helping you master your topic. What question do you have about what we're studying?",
  irrelevant: "I didn't quite catch that. Could you rephrase your question about the topic we're studying?",
  ok: '',
};

// ─── Main Export ──────────────────────────────────────────────────────────────

/**
 * Validates student input before it reaches the LLM pipeline.
 * Returns a SafetyResult with sanitized message and optional blocked response.
 *
 * Usage:
 *   const safety = await validateUserInput(message, topic);
 *   if (!safety.safe) return NextResponse.json({ message: safety.blockedResponse, safetyBlocked: true });
 *   // proceed with safety.sanitizedMessage
 */
export async function validateUserInput(message: string, topic: string): Promise<SafetyResult> {
  const sanitizedMessage = sanitize(message);

  // Stage 1: fast keyword check
  const keywordResult = keywordCheck(sanitizedMessage);
  if (keywordResult.flagged) {
    return {
      safe: false,
      category: keywordResult.category,
      reason: keywordResult.reason,
      sanitizedMessage,
      blockedResponse: BLOCKED_RESPONSES[keywordResult.category],
    };
  }

  // Messages that are clearly fine (long educational content) skip Stage 2
  if (sanitizedMessage.length > 20 && !sanitizedMessage.match(/[^\w\s.,?!;:'"()\-–—]/)) {
    return { safe: true, category: 'ok', sanitizedMessage };
  }

  // Stage 2: semantic check for borderline messages
  const semantic = await semanticCheck(sanitizedMessage, topic);
  if (!semantic.safe) {
    return {
      safe: false,
      category: semantic.category,
      reason: semantic.reason,
      sanitizedMessage,
      blockedResponse: BLOCKED_RESPONSES[semantic.category],
    };
  }

  return { safe: true, category: 'ok', sanitizedMessage };
}
