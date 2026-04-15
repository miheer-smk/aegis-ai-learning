'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Suggestion } from '@/types';

interface SmartSuggestionsProps {
  studentId: string;
  onSuggestionClick: (actionText: string) => void;
  refreshTrigger?: number; // increment to force refresh
}

const URGENCY_STYLES: Record<string, { dot: string; border: string; badge: string }> = {
  high:   { dot: 'bg-red-400',    border: 'border-red-500/30',   badge: 'bg-red-500/20 text-red-300' },
  medium: { dot: 'bg-yellow-400', border: 'border-yellow-500/30', badge: 'bg-yellow-500/20 text-yellow-300' },
  low:    { dot: 'bg-green-400',  border: 'border-green-500/30',  badge: 'bg-green-500/20 text-green-300' },
};

const TYPE_ICONS: Record<string, string> = {
  revision:   '🔄',
  practice:   '✏️',
  next_topic: '→',
};

const TYPE_LABELS: Record<string, string> = {
  revision:   'Review',
  practice:   'Practice',
  next_topic: 'Next Up',
};

export default function SmartSuggestions({ studentId, onSuggestionClick, refreshTrigger }: SmartSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const fetchSuggestions = useCallback(async () => {
    if (!studentId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/suggestions?studentId=${studentId}`);
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.suggestions || []);
        setDismissedIds(new Set()); // reset dismissals on refresh
      }
    } catch {
      // Silently ignore — suggestions are enhancement, not critical
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions, refreshTrigger]);

  const visibleSuggestions = suggestions.filter(s => !dismissedIds.has(s.id));

  if (visibleSuggestions.length === 0 && !loading) return null;

  return (
    <div className="glass rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(prev => !prev)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-accent/70 uppercase tracking-widest">
            AI Suggestions
          </span>
          {visibleSuggestions.length > 0 && (
            <span className="bg-accent/20 text-accent text-xs font-mono px-1.5 py-0.5 rounded-full">
              {visibleSuggestions.length}
            </span>
          )}
        </div>
        <span className="text-white/40 text-xs">{expanded ? '▲' : '▼'}</span>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-3 pb-3 space-y-2">
              {loading ? (
                <div className="flex items-center gap-2 py-2 px-1">
                  <div className="flex gap-1">
                    {[0, 1, 2].map(i => (
                      <motion.div
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-accent/50"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-white/40">Analyzing your progress...</span>
                </div>
              ) : (
                visibleSuggestions.map((suggestion, idx) => {
                  const urgencyStyle = URGENCY_STYLES[suggestion.urgency] || URGENCY_STYLES.low;
                  return (
                    <motion.div
                      key={suggestion.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className={`relative border rounded-lg p-3 ${urgencyStyle.border} bg-white/3 group`}
                    >
                      {/* Dismiss button */}
                      <button
                        onClick={() => setDismissedIds(prev => { const next = new Set(prev); next.add(suggestion.id); return next; })}
                        className="absolute top-2 right-2 text-white/20 hover:text-white/50 transition-colors text-xs opacity-0 group-hover:opacity-100"
                        aria-label="Dismiss"
                      >
                        ✕
                      </button>

                      <div className="flex items-start gap-2">
                        <div className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${urgencyStyle.dot}`} />
                        <div className="flex-1 min-w-0">
                          {/* Title row */}
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium text-white/90 truncate">
                              {TYPE_ICONS[suggestion.type]} {suggestion.title}
                            </span>
                            <span className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${urgencyStyle.badge}`}>
                              {TYPE_LABELS[suggestion.type]}
                            </span>
                          </div>

                          {/* Description */}
                          <p className="text-xs text-white/50 leading-relaxed mb-2 line-clamp-2">
                            {suggestion.description}
                          </p>

                          {/* Action button */}
                          <button
                            onClick={() => onSuggestionClick(suggestion.actionText)}
                            className="text-xs text-accent hover:text-accent/80 font-mono transition-colors flex items-center gap-1"
                          >
                            Start this →
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}

              {/* Refresh button */}
              {!loading && (
                <button
                  onClick={fetchSuggestions}
                  className="w-full text-xs text-white/30 hover:text-white/60 transition-colors py-1 font-mono"
                >
                  ↻ Refresh suggestions
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
