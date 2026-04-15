'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SignLanguageHelperProps {
  text: string;
  isVisible?: boolean;
}

// ── Gesture Alphabet Mapping ─────────────────────────────────────────────────
// Maps key educational terms to ASL-inspired emoji gesture sequences
// In production, these would link to actual sign language video clips
const GESTURE_HINTS: Record<string, string[]> = {
  'understand': ['👉', '🧠', '✓'],
  'question': ['🤔', '❓'],
  'explain': ['👐', '💬'],
  'learn': ['📚', '🧠'],
  'concept': ['💡', '🔑'],
  'example': ['👆', '📋'],
  'wrong': ['❌', '🔄'],
  'correct': ['✅', '👍'],
  'think': ['🤔', '💭'],
  'try': ['💪', '▶️'],
  'practice': ['🔄', '✏️'],
  'remember': ['🧠', '💾'],
  'important': ['⚠️', '💡'],
  'next': ['→', '▶️'],
  'done': ['✅', '🎉'],
};

// ── Text Simplifier ──────────────────────────────────────────────────────────

function simplifyForAccessibility(text: string): string {
  return text
    // Remove markdown formatting
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/#{1,6}\s/g, '')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    // Simplify punctuation
    .replace(/[—–]/g, '-')
    .replace(/\.\.\./g, '.')
    // Break into shorter sentences
    .replace(/([.!?])\s+/g, '$1\n')
    .trim();
}

function extractKeyTerms(text: string): string[] {
  const words = text.toLowerCase().match(/\b\w{4,}\b/g) || [];
  return words.filter(w => w in GESTURE_HINTS).slice(0, 5);
}

// ── TTS Hook ─────────────────────────────────────────────────────────────────

function useTTS() {
  const [speaking, setSpeaking] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported(typeof window !== 'undefined' && 'speechSynthesis' in window);
  }, []);

  const speak = useCallback((text: string) => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    const simplified = simplifyForAccessibility(text);
    const utterance = new SpeechSynthesisUtterance(simplified);
    utterance.rate = 0.85;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, [supported]);

  const stop = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  return { speak, stop, speaking, supported };
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function SignLanguageHelper({ text, isVisible = true }: SignLanguageHelperProps) {
  const [expanded, setExpanded] = useState(false);
  const [simplifiedText, setSimplifiedText] = useState('');
  const [keyTerms, setKeyTerms] = useState<string[]>([]);
  const { speak, stop, speaking, supported: ttsSupported } = useTTS();

  useEffect(() => {
    if (text) {
      setSimplifiedText(simplifyForAccessibility(text));
      setKeyTerms(extractKeyTerms(text));
    }
  }, [text]);

  if (!isVisible || !text) return null;

  return (
    <div className="mt-2">
      {/* Toggle button */}
      <button
        onClick={() => setExpanded(prev => !prev)}
        className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors"
        aria-label="Toggle accessibility options"
        title="Accessibility options"
      >
        <span>♿</span>
        <span className="font-mono">Accessibility</span>
        <span className="text-white/20">{expanded ? '▲' : '▼'}</span>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-2 border border-white/10 rounded-lg p-3 bg-white/3 space-y-3">

              {/* TTS Section */}
              {ttsSupported && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-white/50 font-mono">Text-to-Speech</span>
                    <div className="flex gap-2">
                      {speaking ? (
                        <button
                          onClick={stop}
                          className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors"
                        >
                          <motion.span
                            animate={{ opacity: [1, 0.4, 1] }}
                            transition={{ duration: 1, repeat: Infinity }}
                          >
                            ■
                          </motion.span>
                          Stop
                        </button>
                      ) : (
                        <button
                          onClick={() => speak(text)}
                          className="flex items-center gap-1 text-xs text-accent hover:text-accent/80 transition-colors"
                        >
                          <span>▶</span>
                          Read aloud
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Simplified Text */}
              <div>
                <div className="text-xs text-white/50 font-mono mb-1">Simplified text</div>
                <div className="text-xs text-white/70 leading-relaxed whitespace-pre-line max-h-32 overflow-y-auto">
                  {simplifiedText}
                </div>
              </div>

              {/* Gesture Hints */}
              {keyTerms.length > 0 && (
                <div>
                  <div className="text-xs text-white/50 font-mono mb-1.5">Key terms — gesture hints</div>
                  <div className="flex flex-wrap gap-2">
                    {keyTerms.map(term => (
                      <div
                        key={term}
                        className="flex items-center gap-1.5 bg-white/5 rounded-lg px-2 py-1"
                        title={`ASL gesture hint for "${term}"`}
                      >
                        <span className="text-xs text-white/60">{term}</span>
                        <span className="text-base leading-none">
                          {(GESTURE_HINTS[term] || []).join(' ')}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-white/25 mt-1.5 leading-relaxed">
                    Emoji represent simplified gesture concepts. For full ASL reference, consult a certified interpreter.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
