/**
 * AEGIS Anti-Hallucination & Response Verification Layer
 *
 * Problem: LLMs can generate plausible-sounding but pedagogically wrong
 * responses — inventing prior exchanges, misattributing the student's
 * understanding, or giving advice inconsistent with the known epistemic state.
 *
 * Solution: A lightweight heuristic confidence scorer that runs on every
 * response WITHOUT an extra API call. If confidence is critically low, a
 * self-reflection instruction is injected into the NEXT prompt.
 *
 * Architecture:
 *   1. assessResponseConfidence() → heuristic, instant, no LLM
 *   2. buildAntiHallucinationInstruction() → injected into system prompts
 *   3. buildSymbolicVerificationInstruction() → injected when math detected
 */

import type { EpistemicState } from '@/types';

// ─── Confidence Assessment ────────────────────────────────────────────────────

export interface VerificationResult {
  confidence: number;       // 0.0–1.0
  flags: string[];          // reasons for deductions
  shouldReasonMore: boolean;
  needsPedagogyCheck: boolean;
  mathConsistent: boolean;  // math content passes consistency heuristics
  clarityAdequate: boolean; // explanation structure is adequate
}

export function assessResponseConfidence(
  response: string,
  epistemicState: EpistemicState,
  studentMessage: string
): VerificationResult {
  const flags: string[] = [];
  let confidence = 0.92;
  const respLower = response.toLowerCase();
  const msgLen = studentMessage.length;

  // ── Heuristic checks ─────────────────────────────────────────────────

  // 1. Too brief for a substantive question
  if (msgLen > 120 && response.length < 90) {
    flags.push('response unusually brief for complex query');
    confidence -= 0.18;
  }

  // 2. Excessive uncertainty language (signs of hallucinated confidence)
  const uncertainMarkers = ["i think", "i believe", "i'm not sure", "probably", "might be", "i'm not certain"];
  const uncertainCount = uncertainMarkers.filter(m => respLower.includes(m)).length;
  if (uncertainCount >= 2) {
    flags.push(`${uncertainCount} uncertainty markers (potential knowledge boundary)`);
    confidence -= 0.08 * uncertainCount;
  }

  // 3. High frustration not acknowledged (emotionally misaligned response)
  if (epistemicState.frustrationLevel >= 0.7) {
    const empathyWords = ['understand', 'tricky', 'difficult', "let's", 'step', 'together', 'okay', 'that\'s okay', 'break it down'];
    if (!empathyWords.some(w => respLower.includes(w))) {
      flags.push('high frustration not acknowledged');
      confidence -= 0.12;
    }
  }

  // 4. Socratic agents must end with a question
  if (!response.trim().endsWith('?') && response.length < 350) {
    flags.push('no closing question (pedagogical momentum lost)');
    confidence -= 0.06;
  }

  // 5. Response references "previously" or "we discussed" without epistemic backing
  const fabricationPatterns = ['as we discussed', 'as you mentioned before', 'earlier you said', 'you told me that', 'as i explained'];
  if (fabricationPatterns.some(p => respLower.includes(p)) && epistemicState.understood.length === 0) {
    flags.push('claims prior context without confirmed epistemic base');
    confidence -= 0.2;
  }

  // 6. Misconceptions present but REPAIR language absent
  if (epistemicState.misconceptions.length > 0) {
    const repairWords = ['actually', 'misconception', 'incorrect', 'not quite', 'let me clarify', 'the key distinction', 'common mistake'];
    if (!repairWords.some(w => respLower.includes(w))) {
      flags.push('active misconceptions unaddressed');
      confidence -= 0.10;
    }
  }

  confidence = Math.max(0.1, Math.min(1.0, confidence));

  // ── Math consistency check (re-exported from outputProcessor) ─────────────
  // Runs inline here so verification has the full picture in one pass
  const hasMath = MATH_PATTERNS.some(p => p.test(response));
  let mathConsistent = true;
  if (hasMath) {
    // Use exec loop instead of matchAll spread for ES5 target compatibility
    const collectExec = (re: RegExp, src: string): string[] => {
      const out: string[] = [];
      let m: RegExpExecArray | null;
      // eslint-disable-next-line no-cond-assign
      while ((m = re.exec(src)) !== null) out.push(m[1]);
      return out;
    };
    const blockMath = collectExec(/\$\$([\s\S]+?)\$\$/g, response);
    const inlineMath = collectExec(/\$([^$\n]+?)\$/g, response);
    for (const expr of blockMath.concat(inlineMath)) {
      const opens = (expr.match(/\{/g) || []).length;
      const closes = (expr.match(/\}/g) || []).length;
      if (opens !== closes) { mathConsistent = false; break; }
    }
    if (!mathConsistent) {
      flags.push('unbalanced LaTeX braces detected');
      confidence -= 0.08;
    }
  }

  // ── Explanation clarity check ──────────────────────────────────────────────
  const clarityAdequate = response.length >= 80 &&
    (response.trim().endsWith('?') || response.length > 300);

  if (!clarityAdequate && response.length < 80) {
    flags.push('response too brief for adequate explanation');
    confidence -= 0.05;
  }

  confidence = Math.max(0.1, Math.min(1.0, confidence));

  return {
    confidence,
    flags,
    shouldReasonMore: confidence < 0.60,
    needsPedagogyCheck: flags.includes('no closing question (pedagogical momentum lost)'),
    mathConsistent,
    clarityAdequate,
  };
}

// ─── Anti-Hallucination System Prompt Injection ───────────────────────────────

/**
 * Injected into every agent system prompt.
 * Grounds the model in the verified epistemic state before generating.
 */
export function buildAntiHallucinationInstruction(
  epistemicState: EpistemicState,
  prevConfidence?: number
): string {
  const known = epistemicState.understood.map(u => `${u.concept} (${Math.round(u.confidence * 100)}%)`);
  const misconceptions = epistemicState.misconceptions.map(m => m.concept);

  const isLowConfidence = prevConfidence !== undefined && prevConfidence < 0.60;
  const lowConfidenceNote = isLowConfidence
    ? '\n⚠ REASONING-FIRST MODE: Previous confidence was low. Before formulating a response, explicitly state:\n  (a) What do I know for certain from the confirmed facts above?\n  (b) What am I inferring, and how confident am I?\n  (c) Where is my reasoning uncertain? Acknowledge uncertainty explicitly.'
    : (prevConfidence !== undefined && prevConfidence < 0.75)
    ? '\n⚠ CAUTION: Previous response had moderate confidence. Be especially precise and grounded this turn.'
    : '';

  return `
GROUNDING PROTOCOL (MANDATORY):
• Only confirmed mastered concepts: ${known.join(', ') || 'none yet — do not assume prior knowledge'}
• Active misconceptions to address: ${misconceptions.join(', ') || 'none detected'}
• Do NOT fabricate prior conversations or student statements
• Do NOT claim the student understands something not in the confirmed list above
• If uncertain about a fact, acknowledge it explicitly rather than confabulating${lowConfidenceNote}`;
}

// ─── Symbolic Verification ────────────────────────────────────────────────────

const MATH_PATTERNS = [
  /\d+\s*[+\-×÷*/^%]\s*\d+/,
  /\b(derivative|integral|limit|equation|solve|simplify|factor|expand|prove|differentiate)\b/i,
  /[=<>≤≥]\s*[-\d]/,
  /\b\d*x\s*[\^²³]?\b|\bx\s*=\s*[\d\-]/,
  /\b(sin|cos|tan|log|ln|sqrt|lim|sum|det|matrix)\s*\(/i,
  /\b(dx|dy|d\/dx|∫|∑|∏|∂)\b/,
];

/** Returns true if student message contains mathematical content */
export function detectMathContent(message: string): boolean {
  return MATH_PATTERNS.some(p => p.test(message));
}

/**
 * Injected when math is detected.
 * Forces Claude to verify each step symbolically, not just semantically.
 */
export function buildSymbolicVerificationInstruction(): string {
  return `
SYMBOLIC VERIFICATION PROTOCOL (math detected):
1. Parse the student's mathematical claim or step EXPLICITLY before responding
2. Trace each algebraic/logical step independently — do not skip steps
3. If the student made an error: identify the EXACT step where it occurs (e.g. "Line 3 is incorrect because...")
4. Show the correct derivation in parallel if an error exists
5. If the student's answer is correct: confirm it by tracing the path, don't just say "correct"
6. Prioritize reasoning transparency over brevity for mathematical content`;
}

// ─── Cross-Domain Analogy Injection ──────────────────────────────────────────

/**
 * When frustration is detected and the student has known domains,
 * inject a targeted analogy instruction into the agent prompt.
 */
export function buildAnalogyInstruction(
  studentDomains: string[],
  frustrationLevel: number
): string {
  if (studentDomains.length === 0 || frustrationLevel < 0.3) return '';

  const topDomains = studentDomains.slice(0, 2).join(' or ');
  return `
ANALOGY ENGINE (frustration detected):
The student is familiar with: ${topDomains}.
If they are confused, STOP and generate a structural analogy from one of these domains.
A good analogy maps the RELATIONSHIPS, not just surface features.
Example format: "Think of it like [concrete analogy from ${studentDomains[0]}]..."`;
}

// ─── ToM Prediction (lightweight, no extra Claude call) ──────────────────────

import type { AgentType } from '@/types';
import type { ToMPrediction } from './cognitiveState';

/**
 * Generates a Theory of Mind prediction using deterministic rules
 * (no extra API call — based on the known epistemic state and agent used).
 * This is stored and compared against the next user message.
 */
export function generateTomPrediction(
  agentUsed: AgentType,
  epistemicState: EpistemicState,
  frustrationLevel: number
): ToMPrediction {
  const activeMisconceptions = epistemicState.misconceptions.map(m => m.concept);

  let predictedMisconceptions: string[] = [];
  let predictedFrustrationRange: [number, number] = [frustrationLevel - 0.1, frustrationLevel + 0.1];
  let predictedQuestion = '';

  switch (agentUsed) {
    case 'REPAIR':
      // After REPAIR: misconceptions should reduce but may persist
      predictedMisconceptions = activeMisconceptions.slice(0, Math.ceil(activeMisconceptions.length * 0.6));
      predictedFrustrationRange = [Math.max(0, frustrationLevel - 0.2), frustrationLevel + 0.05];
      predictedQuestion = 'student will ask follow-up confirming or challenging the correction';
      break;
    case 'HINT':
      // After HINT: frustration drops, same misconceptions may persist
      predictedMisconceptions = activeMisconceptions;
      predictedFrustrationRange = [Math.max(0, frustrationLevel - 0.3), frustrationLevel];
      predictedQuestion = 'student will attempt the problem again or ask for another hint';
      break;
    case 'CHALLENGE':
      // After CHALLENGE: frustration may spike, student may reveal new gaps
      predictedMisconceptions = activeMisconceptions;
      predictedFrustrationRange = [frustrationLevel, Math.min(1, frustrationLevel + 0.2)];
      predictedQuestion = 'student will attempt the challenge or express confusion about the trap';
      break;
    case 'FEYNMAN':
      // After FEYNMAN trigger: student will provide explanation (all outcomes possible)
      predictedMisconceptions = activeMisconceptions;
      predictedFrustrationRange = [0, 0.4];
      predictedQuestion = 'student will explain the concept in their own words';
      break;
    case 'META':
      // After META: reflection — student may reveal learning insights
      predictedMisconceptions = activeMisconceptions.slice(0, 1);
      predictedFrustrationRange = [Math.max(0, frustrationLevel - 0.15), frustrationLevel];
      predictedQuestion = 'student will reflect on their learning or ask about next steps';
      break;
    default: // PROBE
      predictedMisconceptions = activeMisconceptions;
      predictedFrustrationRange = [frustrationLevel - 0.05, frustrationLevel + 0.15];
      predictedQuestion = 'student will answer the probe question or reveal a new gap';
  }

  // Clamp range
  predictedFrustrationRange = [
    Math.max(0, Math.min(1, predictedFrustrationRange[0])),
    Math.max(0, Math.min(1, predictedFrustrationRange[1])),
  ];

  return {
    predictedMisconceptions,
    predictedFrustrationRange,
    predictedQuestion,
    generatedAt: new Date().toISOString(),
    agentType: agentUsed,
  };
}
