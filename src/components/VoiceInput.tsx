'use client';

/**
 * VoiceInput — Speech-to-text via Web Speech API
 *
 * Architecture notes:
 * - Recognition instance is created ONCE on mount (useEffect with []).
 * - onTranscript callback is stored in a ref so it always points to the
 *   latest version without forcing recognition re-creation on each render.
 * - Interim results update a preview string; only the final transcript is
 *   passed up to the parent (inserted into input box, NOT auto-sent).
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SpeechRecognitionInstance = any;

export default function VoiceInput({ onTranscript, disabled = false }: VoiceInputProps) {
  const [isListening, setIsListening]   = useState(false);
  const [interim, setInterim]           = useState('');
  const [isSupported, setIsSupported]   = useState<boolean | null>(null); // null = not yet checked
  const [showTooltip, setShowTooltip]   = useState(false);
  const [error, setError]               = useState('');

  // Keep latest callback in a ref — avoids recreating recognition on every parent render
  const onTranscriptRef = useRef(onTranscript);
  useEffect(() => { onTranscriptRef.current = onTranscript; }, [onTranscript]);

  const recognitionRef = useRef<SpeechRecognitionInstance>(null);
  const isListeningRef = useRef(false); // sync ref for handlers

  // ── Initialize recognition ONCE ──────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognitionAPI = (window as any).SpeechRecognition
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      setIsSupported(false);
      return;
    }

    setIsSupported(true);
    const recognition: SpeechRecognitionInstance = new SpeechRecognitionAPI();
    recognition.continuous      = false;   // auto-stop after first pause
    recognition.interimResults  = true;    // show live preview while speaking
    recognition.lang            = 'en-US';
    recognition.maxAlternatives = 1;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript   = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const chunk = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += chunk;
        } else {
          interimTranscript += chunk;
        }
      }

      setInterim(interimTranscript);

      if (finalTranscript.trim()) {
        onTranscriptRef.current(finalTranscript.trim());
        setInterim('');
        setIsListening(false);
        isListeningRef.current = false;
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
      const msg = event.error === 'not-allowed'
        ? 'Microphone permission denied.'
        : event.error === 'no-speech'
        ? 'No speech detected. Try again.'
        : `Speech error: ${event.error}`;
      setError(msg);
      setIsListening(false);
      isListeningRef.current = false;
      setInterim('');
      setTimeout(() => setError(''), 3500);
    };

    recognition.onend = () => {
      // Only update state if we didn't already stop it manually
      if (isListeningRef.current) {
        setIsListening(false);
        isListeningRef.current = false;
        setInterim('');
      }
    };

    recognitionRef.current = recognition;

    return () => {
      recognitionRef.current?.stop();
    };
  }, []); // run only once — onTranscript changes are handled via ref

  // ── Toggle ────────────────────────────────────────────────────────────────
  const toggleListening = useCallback(() => {
    if (!recognitionRef.current || disabled) return;
    setError('');

    if (isListeningRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      isListeningRef.current = false;
      setInterim('');
    } else {
      setInterim('');
      recognitionRef.current.start();
      setIsListening(true);
      isListeningRef.current = true;
    }
  }, [disabled]);

  // ── Unsupported fallback ──────────────────────────────────────────────────
  if (isSupported === false) {
    return (
      <div className="relative flex items-center">
        <button
          disabled
          title="Speech input not supported in this browser"
          style={{
            width: 40, height: 40,
            borderRadius: 12,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'not-allowed', opacity: 0.4,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="#8896A4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
            <line x1="1" y1="1" x2="23" y2="23" stroke="#FF4D6D" strokeWidth="2" />
          </svg>
        </button>
      </div>
    );
  }

  // While checking support (null), render nothing to avoid flicker
  if (isSupported === null) return null;

  return (
    <div className="relative flex items-center">
      {/* ── Mic Button ─────────────────────────────────────────────────── */}
      <motion.button
        onClick={toggleListening}
        disabled={disabled}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
        aria-label={isListening ? 'Stop recording' : 'Start voice input — click and speak'}
        aria-pressed={isListening}
        style={{
          position: 'relative',
          width: 40, height: 40,
          borderRadius: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: isListening
            ? 'rgba(255, 77, 109, 0.18)'
            : 'rgba(255,255,255,0.05)',
          border: `1px solid ${isListening ? 'rgba(255,77,109,0.45)' : 'rgba(255,255,255,0.08)'}`,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          flexShrink: 0,
        }}
        whileHover={!disabled ? { scale: 1.06 } : {}}
        whileTap={!disabled ? { scale: 0.94 } : {}}
        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      >
        {/* Pulsing rings when active */}
        {isListening && (
          <>
            {[0, 1, 2].map(i => (
              <motion.span
                key={i}
                style={{
                  position: 'absolute', inset: 0, borderRadius: 12,
                  border: '1.5px solid #FF4D6D', pointerEvents: 'none',
                }}
                animate={{ scale: [1, 1.7, 1], opacity: [0.6, 0, 0.6] }}
                transition={{ duration: 1.6, delay: i * 0.52, repeat: Infinity }}
              />
            ))}
          </>
        )}

        {/* Mic SVG */}
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke={isListening ? '#FF4D6D' : '#8896A4'}
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
      </motion.button>

      {/* ── Tooltip ────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showTooltip && !isListening && !disabled && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'absolute',
              bottom: 'calc(100% + 8px)',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(21,28,36,0.96)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
              padding: '5px 10px',
              fontSize: 11,
              color: '#E8EDF2',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              zIndex: 100,
            }}
          >
            🎤 Click mic and speak
            <span style={{
              position: 'absolute', top: '100%', left: '50%',
              transform: 'translateX(-50%)',
              width: 0, height: 0,
              borderLeft: '5px solid transparent',
              borderRight: '5px solid transparent',
              borderTop: '5px solid rgba(255,255,255,0.1)',
            }} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Listening indicator + interim transcript ───────────────────── */}
      <AnimatePresence>
        {isListening && (
          <motion.div
            initial={{ opacity: 0, x: -6, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -6, scale: 0.95 }}
            transition={{ duration: 0.18 }}
            style={{
              position: 'absolute',
              left: 48,
              bottom: 'calc(100% + 6px)',
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(21,28,36,0.96)',
              border: '1px solid rgba(255,77,109,0.3)',
              borderRadius: 8,
              padding: '5px 10px',
              zIndex: 100,
              maxWidth: 220,
              pointerEvents: 'none',
            }}
          >
            {/* Red pulsing dot */}
            <motion.span
              style={{
                display: 'inline-block', width: 7, height: 7,
                borderRadius: '50%', background: '#FF4D6D', flexShrink: 0,
              }}
              animate={{ opacity: [1, 0.25, 1] }}
              transition={{ duration: 0.9, repeat: Infinity }}
            />
            <span style={{ fontSize: 11, color: '#FF4D6D', fontFamily: 'monospace', flexShrink: 0 }}>
              Listening...
            </span>
            {interim && (
              <span style={{
                fontSize: 10.5, color: 'rgba(232,237,242,0.65)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {interim}
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Error toast ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            style={{
              position: 'absolute',
              left: 0,
              bottom: 'calc(100% + 8px)',
              background: 'rgba(255,77,109,0.12)',
              border: '1px solid rgba(255,77,109,0.3)',
              borderRadius: 8,
              padding: '5px 10px',
              fontSize: 11,
              color: '#FF4D6D',
              whiteSpace: 'nowrap',
              zIndex: 100,
              pointerEvents: 'none',
            }}
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
