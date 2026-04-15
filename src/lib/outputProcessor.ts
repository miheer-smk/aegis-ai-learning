/**
 * AEGIS Output Processor
 *
 * Post-processing layer that runs on every AI response before it reaches the UI.
 * Responsibilities:
 *   1. Fix malformed LaTeX ($-delimiters, spacing, unclosed expressions)
 *   2. Remove formatting artifacts (redundant symbols, CoT leakage, stray markers)
 *   3. Ensure consistent spacing and readability
 *   4. Math consistency check (heuristic)
 *   5. Explanation clarity check (structural)
 *
 * All functions are pure and synchronous — zero latency.
 */

// ─── LaTeX Normalization ──────────────────────────────────────────────────────

/**
 * Fixes common LaTeX formatting issues in LLM output:
 * - Escaped dollar signs that should be math delimiters
 * - Unclosed inline $ delimiters
 * - Missing spaces around block $$
 * - Stray \( \) that should be $ $
 * - Double-escaped backslashes in common commands
 */
function fixLatex(text: string): string {
  let t = text;

  // Convert \(...\) and \[...\] to $...$ and $$...$$
  t = t.replace(/\\\(([\s\S]+?)\\\)/g, (_, inner) => `$${inner.trim()}$`);
  t = t.replace(/\\\[([\s\S]+?)\\\]/g, (_, inner) => `$$\n${inner.trim()}\n$$`);

  // Ensure block $$ has newlines around it for reliable parsing
  t = t.replace(/([^\n])\$\$([^\n])/g, '$1\n$$$$\n$2');
  t = t.replace(/\$\$([^\n])/g, '$$$$\n$1');
  t = t.replace(/([^\n])\$\$/g, '$1\n$$$$');

  // Fix unclosed inline $ — if odd number of $, close the last one
  // Strategy: count non-$$ lone $ signs
  const lines = t.split('\n');
  const fixed = lines.map(line => {
    // Skip lines that are pure block-math delimiters
    if (line.trim() === '$$') return line;
    // Count standalone $ (not part of $$)
    const cleaned = line.replace(/\$\$/g, '');
    const dollarCount = (cleaned.match(/\$/g) || []).length;
    if (dollarCount % 2 !== 0) {
      // Unclosed — append closing $
      return line + '$';
    }
    return line;
  });
  t = fixed.join('\n');

  // Fix common command spacing issues: \frac{}{} needs no space before {
  t = t.replace(/\\frac\s*\{/g, '\\frac{');
  t = t.replace(/\\sqrt\s*\{/g, '\\sqrt{');
  t = t.replace(/\\left\s*/g, '\\left');
  t = t.replace(/\\right\s*/g, '\\right');

  return t;
}

// ─── Artifact Removal ─────────────────────────────────────────────────────────

/**
 * Removes formatting artifacts that shouldn't reach the UI:
 * - Reasoning protocol headers (CoT leakage)
 * - Redundant horizontal rules at the start
 * - Trailing whitespace on lines
 * - More than 2 consecutive blank lines
 * - Duplicate consecutive punctuation (???, !!!, ...)
 */
function removeArtifacts(text: string): string {
  let t = text;

  // CoT leakage patterns (belt-and-suspenders alongside stripCoT in route.ts)
  t = t.replace(/^(REASONING PROTOCOL|INTERNAL REASONING|━+\s*REASONING.*?━+)[\s\S]*?\n\n/gim, '');
  t = t.replace(/^Step\s+\d+:.*$/gim, '');

  // Leading horizontal rules
  t = t.replace(/^---+\n/, '');

  // Trailing spaces on lines
  t = t.replace(/[ \t]+$/gm, '');

  // More than 2 blank lines → 2
  t = t.replace(/\n{3,}/g, '\n\n');

  // Duplicate punctuation (keep max 2 of any)
  t = t.replace(/([!?.]){3,}/g, '$1$1');

  // Redundant bold markers around nothing: ****
  t = t.replace(/\*{4,}/g, '**');

  return t.trim();
}

// ─── Math Consistency Check ───────────────────────────────────────────────────

export interface MathCheckResult {
  isConsistent: boolean;
  issues: string[];
}

/**
 * Heuristic check for mathematical consistency in a response.
 * Catches common LLM math errors without re-running through Claude.
 */
/** Collect all regex matches into an array (ES5-compatible matchAll replacement) */
function collectMatches(text: string, re: RegExp): RegExpExecArray[] {
  const results: RegExpExecArray[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) results.push(m);
  return results;
}

export function mathConsistencyCheck(text: string): MathCheckResult {
  const issues: string[] = [];

  // Extract all math segments (use exec loop, not matchAll spread)
  const blockMath = collectMatches(text, /\$\$([\s\S]+?)\$\$/g).map(m => m[1]);
  const inlineMath = collectMatches(text, /\$(?!\$)(.+?)\$(?!\$)/g).map(m => m[1]);
  const allMath = blockMath.concat(inlineMath);

  for (const expr of allMath) {
    // Unbalanced braces
    const opens = (expr.match(/\{/g) || []).length;
    const closes = (expr.match(/\}/g) || []).length;
    if (opens !== closes) {
      issues.push(`Unbalanced braces in: ${expr.slice(0, 40)}`);
    }

    // Unbalanced parentheses
    const po = (expr.match(/\(/g) || []).length;
    const pc = (expr.match(/\)/g) || []).length;
    if (po !== pc) {
      issues.push(`Unbalanced parentheses in: ${expr.slice(0, 40)}`);
    }

    // Undefined common commands (very loose check)
    if (/\\[a-z]+/.test(expr)) {
      const unknownCmds = collectMatches(expr, /\\([a-z]+)/g)
        .map(m => m[1])
        .filter(cmd => !KNOWN_LATEX_COMMANDS.has(cmd));
      if (unknownCmds.length > 0) {
        issues.push(`Possibly unknown LaTeX commands: \\${unknownCmds.join(', \\')}`);
      }
    }
  }

  // Check that variables used in text match those in math
  const textVars = collectMatches(text, /\blet ([a-z])\b/gi).map(m => m[1].toLowerCase());
  if (textVars.length > 0) {
    const mathText = allMath.join(' ');
    const unusedVars = textVars.filter(v => !mathText.includes(v));
    if (unusedVars.length > 0) {
      issues.push(`Variable(s) introduced in text but absent from math: ${unusedVars.join(', ')}`);
    }
  }

  return { isConsistent: issues.length === 0, issues };
}

// Known LaTeX math commands — anything not in this set triggers a mild warning
const KNOWN_LATEX_COMMANDS = new Set([
  'frac', 'sqrt', 'sum', 'int', 'lim', 'inf', 'sup', 'max', 'min',
  'sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'arcsin', 'arccos', 'arctan',
  'log', 'ln', 'exp', 'det', 'dim', 'ker', 'deg', 'gcd', 'hom',
  'left', 'right', 'cdot', 'times', 'div', 'pm', 'mp', 'leq', 'geq',
  'neq', 'approx', 'equiv', 'sim', 'simeq', 'propto', 'infty',
  'partial', 'nabla', 'Delta', 'delta', 'alpha', 'beta', 'gamma', 'Gamma',
  'theta', 'Theta', 'lambda', 'Lambda', 'mu', 'nu', 'xi', 'pi', 'Pi',
  'sigma', 'Sigma', 'tau', 'phi', 'Phi', 'psi', 'Psi', 'omega', 'Omega',
  'epsilon', 'varepsilon', 'varphi', 'rho', 'eta', 'zeta',
  'mathbb', 'mathbf', 'mathit', 'mathrm', 'mathcal', 'text', 'textbf',
  'overline', 'underline', 'hat', 'tilde', 'vec', 'dot', 'ddot', 'bar',
  'underbrace', 'overbrace', 'binom', 'matrix', 'pmatrix', 'bmatrix',
  'begin', 'end', 'quad', 'qquad', 'space', 'ldots', 'cdots', 'vdots',
  'forall', 'exists', 'in', 'notin', 'subset', 'supset', 'cup', 'cap',
  'to', 'rightarrow', 'leftarrow', 'Rightarrow', 'Leftarrow', 'iff',
  'implies', 'land', 'lor', 'lnot', 'neg', 'circ', 'bullet', 'star',
  'd', 'rm', 'bf', 'it', 'cal',
]);

// ─── Explanation Clarity Check ────────────────────────────────────────────────

export interface ClarityCheckResult {
  isAdequate: boolean;
  score: number;   // [0..1]
  suggestions: string[];
}

/**
 * Heuristic check for explanation quality.
 * Looks for structural completeness: concept framing, reasoning, example, question.
 */
export function explanationClarityCheck(
  text: string,
  hasMathContent: boolean
): ClarityCheckResult {
  const suggestions: string[] = [];
  let score = 1.0;
  const lower = text.toLowerCase();

  // Must have some explanation body (not just a question)
  if (text.length < 80) {
    score -= 0.3;
    suggestions.push('Response too brief — likely insufficient explanation');
  }

  // Should close with a question (Socratic requirement)
  const endsWithQuestion = text.trim().endsWith('?');
  if (!endsWithQuestion) {
    score -= 0.1;
    suggestions.push('No closing question — Socratic momentum may be lost');
  }

  // Math-heavy responses must have a worked example or step trace
  if (hasMathContent) {
    const hasSteps = /step|first|next|then|therefore|thus|so we get|which gives|applying/i.test(lower);
    const hasExample = /for example|consider|let's try|take|suppose|imagine/i.test(lower);
    if (!hasSteps && !hasExample) {
      score -= 0.2;
      suggestions.push('Math content detected but no step-by-step trace or example found');
    }
  }

  // Should acknowledge the student's state if frustration markers present
  // (handled separately by anti-hallucination; just flag if missing)
  const hasConcept = /concept|idea|think of|what this means|essentially|basically/i.test(lower);
  if (text.length > 200 && !hasConcept) {
    score -= 0.1;
    suggestions.push('Long response without conceptual framing — may be too mechanical');
  }

  score = Math.max(0, Math.min(1, score));
  return { isAdequate: score >= 0.6, score, suggestions };
}

// ─── Master processOutput Function ───────────────────────────────────────────

export interface ProcessedOutput {
  text: string;
  mathCheck: MathCheckResult;
  clarityCheck: ClarityCheckResult;
  wasModified: boolean;
}

/**
 * Main entry point. Run every AI response through this before display.
 * Returns the cleaned text plus quality metadata.
 */
export function processOutput(
  response: string,
  hasMathContent = false
): ProcessedOutput {
  const original = response;

  let text = removeArtifacts(response);
  text = fixLatex(text);

  const mathCheck = mathConsistencyCheck(text);
  const clarityCheck = explanationClarityCheck(text, hasMathContent);

  return {
    text,
    mathCheck,
    clarityCheck,
    wasModified: text !== original,
  };
}
