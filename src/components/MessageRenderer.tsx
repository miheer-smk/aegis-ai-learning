'use client';

/**
 * AEGIS MessageRenderer
 *
 * Renders assistant message content with:
 *   - KaTeX for inline ($...$) and block ($$...$$) math
 *   - Lightweight markdown: **bold**, *italic*, `code`, ## headers, --- rules
 *   - Bullet lists (- item)
 *   - Numbered lists (1. item)
 *   - Code blocks (```...```)
 *   - Safe HTML output — no dangerouslySetInnerHTML on user-controlled content
 *
 * Architecture: splits text into segments by math delimiters, renders each
 * segment independently, then assembles into React elements.
 * KaTeX errors are caught and shown as styled fallback text.
 */

import React, { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

// ─── Types ────────────────────────────────────────────────────────────────────

type Segment =
  | { type: 'block-math'; content: string }
  | { type: 'inline-math'; content: string }
  | { type: 'text'; content: string };

// ─── Math Renderer ────────────────────────────────────────────────────────────

function renderKatex(latex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(latex.trim(), {
      displayMode,
      throwOnError: false,
      trust: false,
      strict: false,
      output: 'htmlAndMathml',
    });
  } catch {
    return `<span class="katex-error" style="color:#FF4D6D;font-family:monospace;font-size:0.85em">${
      displayMode ? '$$' : '$'}${latex}${displayMode ? '$$' : '$'}</span>`;
  }
}

// ─── Text Segmentation ────────────────────────────────────────────────────────

/**
 * Splits a string into alternating text / math segments.
 * Handles block math ($$...$$) first, then inline ($...$).
 * Preserves original order.
 */
function segmentText(text: string): Segment[] {
  const segments: Segment[] = [];

  // Split on block math first
  const blockParts = text.split(/(^\$\$[\s\S]+?\$\$$)/m);
  // The split above won't work perfectly with multiline; use a proper approach:
  const blockRegex = /\$\$([\s\S]+?)\$\$/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  // eslint-disable-next-line no-cond-assign
  while ((match = blockRegex.exec(text)) !== null) {
    // Text before this block math
    if (match.index > lastIndex) {
      const before = text.slice(lastIndex, match.index);
      // Split this text portion on inline math
      splitInlineMath(before, segments);
    }
    segments.push({ type: 'block-math', content: match[1] });
    lastIndex = match.index + match[0].length;
  }

  // Remaining text after last block math
  if (lastIndex < text.length) {
    splitInlineMath(text.slice(lastIndex), segments);
  }

  return segments;
}

function splitInlineMath(text: string, segments: Segment[]): void {
  // Match $...$ (not $$) — use simple non-greedy pattern without lookbehind
  // to ensure ES5 compatibility
  const inlineRegex = /\$([^$\n]+?)\$/g;
  let last = 0;
  let m: RegExpExecArray | null;

  // eslint-disable-next-line no-cond-assign
  while ((m = inlineRegex.exec(text)) !== null) {
    // Skip if this is part of $$
    if ((m.index > 0 && text[m.index - 1] === '$') ||
        text[m.index + m[0].length] === '$') {
      continue;
    }
    if (m.index > last) {
      segments.push({ type: 'text', content: text.slice(last, m.index) });
    }
    segments.push({ type: 'inline-math', content: m[1] });
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    segments.push({ type: 'text', content: text.slice(last) });
  }
}

// ─── Markdown-Lite Renderer ───────────────────────────────────────────────────

/**
 * Renders a plain-text segment using lightweight markdown rules.
 * Operates line-by-line for block elements, then inline for span elements.
 */
function renderTextSegment(text: string, segKey: string): React.ReactNode[] {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block ```
    if (line.trimStart().startsWith('```')) {
      const lang = line.trim().replace(/^```/, '').trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <pre key={`${segKey}-cb-${i}`}
          style={{
            background: 'rgba(0,0,0,0.4)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '8px',
            padding: '12px 14px',
            fontFamily: 'Courier New, monospace',
            fontSize: '0.82em',
            color: '#00FF85',
            overflowX: 'auto',
            margin: '8px 0',
            whiteSpace: 'pre',
          }}>
          {lang && <span style={{ color: '#8B949E', fontSize: '0.75em', display: 'block', marginBottom: 4 }}>{lang}</span>}
          {codeLines.join('\n')}
        </pre>
      );
      i++; // skip closing ```
      continue;
    }

    // Horizontal rule ---
    if (/^---+$/.test(line.trim())) {
      elements.push(
        <hr key={`${segKey}-hr-${i}`}
          style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.08)', margin: '12px 0' }} />
      );
      i++;
      continue;
    }

    // Headings ## / ###
    const hMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (hMatch) {
      const level = hMatch[1].length;
      const sizes = ['1.1em', '1em', '0.95em', '0.9em'];
      elements.push(
        <div key={`${segKey}-h-${i}`}
          style={{
            fontSize: sizes[level - 1] || '1em',
            fontWeight: 700,
            color: level === 1 ? '#00FF85' : level === 2 ? '#38BDF8' : '#E6EDF3',
            marginTop: '12px',
            marginBottom: '4px',
            fontFamily: 'inherit',
          }}>
          {renderInline(hMatch[2], `${segKey}-h-${i}`)}
        </div>
      );
      i++;
      continue;
    }

    // Bullet list items (- or * or •)
    if (/^[\-\*•]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[\-\*•]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[\-\*•]\s+/, ''));
        i++;
      }
      elements.push(
        <ul key={`${segKey}-ul-${i}`}
          style={{ paddingLeft: '1.25em', margin: '4px 0', listStyle: 'none' }}>
          {items.map((item, j) => (
            <li key={j} style={{ marginBottom: '3px', display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
              <span style={{ color: '#00FF85', marginTop: '1px', flexShrink: 0 }}>▸</span>
              <span>{renderInline(item, `${segKey}-li-${j}`)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Numbered list items (1. 2. etc.)
    if (/^\d+\.\s+/.test(line)) {
      const items: Array<{ num: string; text: string }> = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        const nm = lines[i].match(/^(\d+)\.\s+(.+)$/);
        if (nm) items.push({ num: nm[1], text: nm[2] });
        i++;
      }
      elements.push(
        <ol key={`${segKey}-ol-${i}`}
          style={{ paddingLeft: '0', margin: '4px 0', listStyle: 'none' }}>
          {items.map((item, j) => (
            <li key={j} style={{ marginBottom: '3px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <span style={{ color: '#38BDF8', fontFamily: 'monospace', fontSize: '0.85em',
                minWidth: '18px', marginTop: '1px', flexShrink: 0 }}>
                {item.num}.
              </span>
              <span>{renderInline(item.text, `${segKey}-ol-li-${j}`)}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Blank line → spacing
    if (line.trim() === '') {
      elements.push(<div key={`${segKey}-sp-${i}`} style={{ height: '6px' }} />);
      i++;
      continue;
    }

    // Regular paragraph line
    elements.push(
      <span key={`${segKey}-p-${i}`} style={{ display: 'block', marginBottom: '2px' }}>
        {renderInline(line, `${segKey}-p-${i}`)}
      </span>
    );
    i++;
  }

  return elements;
}

/**
 * Renders inline markdown: **bold**, *italic*, `code`, and plain text.
 */
function renderInline(text: string, key: string): React.ReactNode {
  // Split on inline code first, then bold, then italic
  const parts: React.ReactNode[] = [];
  // Unified inline regex: `code` | **bold** | *italic*
  const inlineRegex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let idx = 0;

  // eslint-disable-next-line no-cond-assign
  while ((m = inlineRegex.exec(text)) !== null) {
    if (m.index > last) {
      parts.push(<React.Fragment key={`${key}-t${idx}`}>{text.slice(last, m.index)}</React.Fragment>);
    }
    const tok = m[0];
    if (tok.startsWith('`')) {
      parts.push(
        <code key={`${key}-c${idx}`}
          style={{
            fontFamily: 'Courier New, monospace',
            fontSize: '0.85em',
            background: 'rgba(0,255,133,0.08)',
            border: '1px solid rgba(0,255,133,0.15)',
            borderRadius: '3px',
            padding: '1px 5px',
            color: '#00FF85',
          }}>
          {tok.slice(1, -1)}
        </code>
      );
    } else if (tok.startsWith('**')) {
      parts.push(
        <strong key={`${key}-b${idx}`}
          style={{ fontWeight: 700, color: '#E8EDF2' }}>
          {tok.slice(2, -2)}
        </strong>
      );
    } else if (tok.startsWith('*')) {
      parts.push(
        <em key={`${key}-i${idx}`}
          style={{ fontStyle: 'italic', color: '#C0C8D0' }}>
          {tok.slice(1, -1)}
        </em>
      );
    }
    last = m.index + tok.length;
    idx++;
  }
  if (last < text.length) {
    parts.push(<React.Fragment key={`${key}-t${idx}`}>{text.slice(last)}</React.Fragment>);
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface MessageRendererProps {
  content: string;
  className?: string;
}

export default function MessageRenderer({ content, className }: MessageRendererProps) {
  const rendered = useMemo(() => {
    const segments = segmentText(content);

    return segments.map((seg, si) => {
      if (seg.type === 'block-math') {
        const html = renderKatex(seg.content, true);
        return (
          <div
            key={`seg-${si}`}
            className="katex-block"
            style={{
              overflowX: 'auto',
              margin: '10px 0',
              textAlign: 'center',
              padding: '6px 0',
            }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      }

      if (seg.type === 'inline-math') {
        const html = renderKatex(seg.content, false);
        return (
          <span
            key={`seg-${si}`}
            className="katex-inline"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      }

      // Text segment — render through markdown-lite
      return (
        <React.Fragment key={`seg-${si}`}>
          {renderTextSegment(seg.content, `seg-${si}`)}
        </React.Fragment>
      );
    });
  }, [content]);

  return (
    <div
      className={className}
      style={{
        lineHeight: 1.65,
        color: '#E8EDF2',
        fontSize: '0.875rem',
        wordBreak: 'break-word',
      }}
    >
      {rendered}
    </div>
  );
}
