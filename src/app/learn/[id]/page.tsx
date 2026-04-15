'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import KnowledgeGraph from '@/components/KnowledgeGraph';
import AgentBadge from '@/components/AgentBadge';
import VoiceInput from '@/components/VoiceInput';
import ImageUpload from '@/components/ImageUpload';
import SmartSuggestions from '@/components/SmartSuggestions';
import SignLanguageHelper from '@/components/SignLanguageHelper';
import MessageRenderer from '@/components/MessageRenderer';
import { processOutput } from '@/lib/outputProcessor';
import type { AgentType, KGNode, KGLink, ReviewItem, CognitiveDNA, FeynmanResult } from '@/types';

// ── Voice Output (TTS) hook ───────────────────────────────────────────────────
function useSpeakMessage() {
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [ttsSupported, setTtsSupported] = useState(false);

  useEffect(() => {
    setTtsSupported(typeof window !== 'undefined' && 'speechSynthesis' in window);
  }, []);

  const speak = useCallback((id: string, text: string) => {
    if (!ttsSupported) return;
    window.speechSynthesis.cancel();
    if (speakingId === id) { setSpeakingId(null); return; }

    // Strip markdown before speaking
    const clean = text
      .replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1')
      .replace(/`(.*?)`/g, '$1').replace(/#{1,6}\s/g, '').replace(/---/g, '')
      .replace(/\[(.*?)\]\(.*?\)/g, '$1').trim();

    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.rate = 0.88; utterance.pitch = 1.0; utterance.volume = 1.0;
    utterance.onstart = () => setSpeakingId(id);
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);
    window.speechSynthesis.speak(utterance);
  }, [ttsSupported, speakingId]);

  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
    setSpeakingId(null);
  }, []);

  return { speak, stop, speakingId, ttsSupported };
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  agentType: AgentType;
  timestamp: string;
  imagePreview?: string;
  feynmanResult?: FeynmanResult;
  safetyBlocked?: boolean;
  confidence?: number;          // response confidence from anti-hallucination layer
  longTermMemoryUsed?: boolean; // whether long-term memory was injected
}

interface StudentInfo {
  id: string;
  name: string;
  topic: string;
  goal: string;
  cognitive_dna: CognitiveDNA;
}

interface GraphData {
  nodes: KGNode[];
  links: KGLink[];
  stats: {
    conceptCount: number;
    avgMastery: number;
    avgRetention: number;
    totalMisconceptions: number;
    weakConceptCount: number;
  };
  reviewQueue: ReviewItem[];
}

const URGENCY_COLORS: Record<string, string> = {
  critical: '#FF4D6D',
  high: '#FFB347',
  medium: '#38BDF8',
  low: '#00FF85',
};

function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      className="flex items-center gap-1 px-4 py-3"
    >
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: '#00FF85' }}
          animate={{ y: [0, -5, 0], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 0.6, delay: i * 0.1, repeat: Infinity }}
        />
      ))}
    </motion.div>
  );
}

export default function LearnPage() {
  const params = useParams();
  const router = useRouter();
  const studentId = params.id as string;

  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [currentAgent, setCurrentAgent] = useState<AgentType>('PROBE');
  const [decayAlerts, setDecayAlerts] = useState<ReviewItem[]>([]);
  const [imagePending, setImagePending] = useState<{ base64: string; mimeType: string; preview: string } | null>(null);
  const [selectedNode, setSelectedNode] = useState<KGNode | null>(null);
  const [streak, setStreak] = useState(0);
  const [frustration, setFrustration] = useState(0);
  const [suggestionRefreshTrigger, setSuggestionRefreshTrigger] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { speak, stop, speakingId, ttsSupported } = useSpeakMessage();

  // Load student info
  useEffect(() => {
    if (!studentId) return;

    fetch(`/api/student?id=${studentId}`)
      .then(r => r.json())
      .then((data: StudentInfo & { messageCount?: number }) => {
        if ('error' in data) {
          router.push('/');
          return;
        }
        setStudent(data);
        if (data.messageCount && data.messageCount > 0) setStreak(Math.min(7, Math.floor(data.messageCount / 3)));
      })
      .catch(() => router.push('/'));
  }, [studentId, router]);

  // Load graph data
  const loadGraph = useCallback(async () => {
    if (!studentId) return;
    try {
      const res = await fetch(`/api/epistemic?studentId=${studentId}`);
      const data = await res.json() as GraphData;
      setGraphData(data);
    } catch {
      /* silent */
    }
  }, [studentId]);

  useEffect(() => {
    loadGraph();
  }, [loadGraph]);

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const sendMessage = async (text: string = inputText, img?: typeof imagePending) => {
    if (!text.trim() && !img) return;
    if (isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text.trim() || '(image attached)',
      agentType: currentAgent,
      timestamp: new Date().toISOString(),
      imagePreview: img?.preview,
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setImagePending(null);
    setIsLoading(true);
    setIsTyping(true);

    try {
      const body: Record<string, unknown> = { studentId, message: text.trim() || 'Please analyze this image.' };
      if (img) {
        body.imageBase64 = img.base64;
        body.imageMimeType = img.mimeType;
      }

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json() as {
        message: string;
        agentType: AgentType;
        decayAlerts: ReviewItem[];
        epistemicUpdate: { frustrationLevel: number };
        graphUpdated: boolean;
        feynmanResult?: FeynmanResult;
        safetyBlocked?: boolean;
        cognitiveInsights?: {
          confidence: number;
          confidenceFlags: string[];
          tomAccuracy: number | null;
          hasMathContent: boolean;
          studentDomains: string[];
          longTermMemoryLoaded: boolean;
        };
      };

      setIsTyping(false);

      if ('error' in data) throw new Error((data as { error: string }).error);

      // Run response through output processor: fix LaTeX, remove artifacts
      const processed = processOutput(
        data.message,
        data.cognitiveInsights?.hasMathContent ?? false
      );

      const asstMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: processed.text,
        agentType: data.agentType,
        timestamp: new Date().toISOString(),
        feynmanResult: data.feynmanResult,
        safetyBlocked: data.safetyBlocked,
        confidence: data.cognitiveInsights?.confidence,
        longTermMemoryUsed: data.cognitiveInsights?.longTermMemoryLoaded,
      };

      setMessages(prev => [...prev, asstMsg]);
      setCurrentAgent(data.agentType);
      setDecayAlerts(data.decayAlerts || []);
      setFrustration(data.epistemicUpdate?.frustrationLevel || 0);
      if (!data.safetyBlocked) setStreak(s => s + 1);

      if (data.graphUpdated) {
        setTimeout(loadGraph, 800);
        // Refresh suggestions after graph updates
        setSuggestionRefreshTrigger(t => t + 1);
      }
    } catch (err) {
      setIsTyping(false);
      const errMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `⚠ Error: ${err instanceof Error ? err.message : 'Something went wrong. Please try again.'}`,
        agentType: 'META',
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleVoiceTranscript = useCallback((text: string) => {
    setInputText(prev => prev + (prev ? ' ' : '') + text);
    // Small delay so React can flush the state before focusing
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const handleSuggestionClick = (actionText: string) => {
    setInputText(actionText);
    inputRef.current?.focus();
  };

  if (!student) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-8 h-8 border-2 border-accent/20 border-t-accent rounded-full"
        />
      </div>
    );
  }

  const avgMastery = graphData?.stats.avgMastery || 0;

  return (
    <div className="h-screen bg-bg-primary flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 flex items-center justify-between px-6 py-3 border-b border-border-subtle">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-1.5 text-muted hover:text-content text-sm transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md flex items-center justify-center font-syne font-bold text-xs"
              style={{ background: 'linear-gradient(135deg, #00FF85, #38BDF8)' }}>
              <span className="text-bg-primary">Æ</span>
            </div>
            <span className="font-syne font-bold text-content text-sm">AEGIS</span>
          </div>

          <div className="h-4 w-px bg-border-subtle" />
          <span className="text-content text-sm font-medium">{student.name}</span>
          <span className="text-muted text-xs">studying</span>
          <span className="text-accent text-xs font-mono">{student.topic}</span>
        </div>

        <div className="flex items-center gap-4">
          {/* Frustration indicator */}
          {frustration > 0.5 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs font-mono text-warning flex items-center gap-1"
            >
              <span>⚡</span>
              <span>{Math.round(frustration * 100)}% frustrated</span>
            </motion.div>
          )}

          {/* Mastery */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted font-mono">Mastery</span>
            <span
              className="font-mono font-semibold"
              style={{ color: avgMastery > 0.6 ? '#00FF85' : avgMastery > 0.3 ? '#FFB347' : '#FF4D6D' }}
            >
              {Math.round(avgMastery * 100)}%
            </span>
          </div>

          <button
            onClick={() => router.push(`/dashboard/${studentId}`)}
            className="text-xs text-muted hover:text-content transition-colors font-mono flex items-center gap-1"
          >
            Dashboard →
          </button>
        </div>
      </header>

      {/* Decay Alert Banner */}
      <AnimatePresence>
        {decayAlerts.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex-shrink-0 decay-alert px-6 py-2.5"
          >
            <div className="flex items-center gap-2 text-xs">
              <span className="text-danger font-mono">⚠ MEMORY DECAY ALERT</span>
              <span className="text-muted">—</span>
              {decayAlerts.slice(0, 3).map(a => (
                <span key={a.conceptId} className="font-mono"
                  style={{ color: URGENCY_COLORS[a.urgency] }}>
                  {a.concept} ({Math.round(a.retention * 100)}%)
                </span>
              ))}
              {decayAlerts.length > 3 && <span className="text-muted">+{decayAlerts.length - 3} more</span>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat Panel */}
        <div className="flex flex-col w-full max-w-2xl border-r border-border-subtle">
          {/* Agent indicator */}
          <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 border-b border-border-subtle">
            <span className="text-xs text-muted">Active agent:</span>
            <AgentBadge agentType={currentAgent} showDescription />
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center h-full text-center py-12"
              >
                <div className="text-4xl mb-4">🧠</div>
                <h3 className="font-syne font-semibold text-content text-lg mb-2">
                  Ready to explore {student.topic}
                </h3>
                <p className="text-muted text-sm max-w-sm">
                  Start with a question, share what you already know, or describe a concept you're struggling with.
                </p>
                <div className="mt-4 glass rounded-xl px-4 py-3 max-w-xs">
                  <p className="text-xs text-muted">
                    <span className="text-accent">Goal:</span> {student.goal}
                  </p>
                </div>
              </motion.div>
            )}

            <AnimatePresence initial={false}>
              {messages.map(msg => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                    {msg.role === 'assistant' && (
                      <AgentBadge agentType={msg.agentType} size="sm" />
                    )}

                    {msg.imagePreview && (
                      <div className="w-40 h-28 rounded-xl overflow-hidden mb-1 border border-border-subtle">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={msg.imagePreview} alt="Uploaded" className="w-full h-full object-cover" />
                      </div>
                    )}

                    <div
                      className={`rounded-2xl px-4 py-3 ${
                        msg.role === 'user'
                          ? 'rounded-tr-sm'
                          : 'rounded-tl-sm'
                      }`}
                      style={{
                        background: msg.role === 'user'
                          ? 'rgba(0, 255, 133, 0.1)'
                          : msg.safetyBlocked
                            ? 'rgba(255, 77, 109, 0.08)'
                            : 'rgba(21, 28, 36, 0.8)',
                        border: `1px solid ${msg.role === 'user' ? 'rgba(0,255,133,0.2)' : msg.safetyBlocked ? 'rgba(255,77,109,0.2)' : 'rgba(255,255,255,0.06)'}`,
                      }}
                    >
                      {msg.role === 'assistant' ? (
                        <MessageRenderer content={msg.content} />
                      ) : (
                        <span style={{ color: '#E8EDF2', fontSize: '0.875rem',
                          lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                          {msg.content}
                        </span>
                      )}
                    </div>

                    {/* Voice Output button — assistant messages only */}
                    {msg.role === 'assistant' && !msg.safetyBlocked && ttsSupported && (
                      <button
                        onClick={() => speakingId === msg.id ? stop() : speak(msg.id, msg.content)}
                        className="self-start flex items-center gap-1 text-xs font-mono transition-colors mt-0.5"
                        style={{ color: speakingId === msg.id ? '#FF4D6D' : 'rgba(255,255,255,0.25)' }}
                        title={speakingId === msg.id ? 'Stop speaking' : 'Read aloud'}
                        aria-label={speakingId === msg.id ? 'Stop speaking' : 'Read aloud'}
                      >
                        {speakingId === msg.id ? (
                          <>
                            <motion.span
                              animate={{ opacity: [1, 0.3, 1] }}
                              transition={{ duration: 0.8, repeat: Infinity }}
                            >■</motion.span>
                            <span>stop</span>
                          </>
                        ) : (
                          <>
                            <span>🔊</span>
                            <span>speak</span>
                          </>
                        )}
                      </button>
                    )}

                    {/* Feynman evaluation result */}
                    {msg.feynmanResult && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-xl p-3 text-xs border"
                        style={{
                          background: msg.feynmanResult.isStrong ? 'rgba(0,255,133,0.06)' : 'rgba(255,179,71,0.06)',
                          borderColor: msg.feynmanResult.isStrong ? 'rgba(0,255,133,0.2)' : 'rgba(255,179,71,0.2)',
                        }}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <span>📖</span>
                          <span className="font-mono font-semibold"
                            style={{ color: msg.feynmanResult.isStrong ? '#00FF85' : '#FFB347' }}>
                            Feynman Score: {msg.feynmanResult.isStrong ? 'Strong' : 'Needs Work'}
                          </span>
                        </div>
                        <div className="flex gap-4 font-mono text-white/60 mb-1.5">
                          <span>Clarity: {Math.round(msg.feynmanResult.clarityScore * 100)}%</span>
                          <span>Depth: {Math.round(msg.feynmanResult.depthScore * 100)}%</span>
                        </div>
                        {msg.feynmanResult.gaps.length > 0 && (
                          <div className="text-white/50">
                            Gaps: {msg.feynmanResult.gaps.slice(0, 2).join(' · ')}
                          </div>
                        )}
                      </motion.div>
                    )}

                    {/* Sign Language / Accessibility Helper */}
                    {msg.role === 'assistant' && !msg.safetyBlocked && (
                      <SignLanguageHelper text={msg.content} />
                    )}

                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted/50 font-mono">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {/* Confidence indicator (only shown for low confidence) */}
                      {msg.role === 'assistant' && msg.confidence !== undefined && msg.confidence < 0.7 && (
                        <span
                          className="text-xs font-mono px-1.5 py-0.5 rounded"
                          style={{
                            background: 'rgba(255,179,71,0.1)',
                            color: '#FFB347',
                            fontSize: '9px',
                          }}
                          title={`Response confidence: ${Math.round((msg.confidence || 0) * 100)}%`}
                        >
                          ⚡ {Math.round((msg.confidence || 0) * 100)}%
                        </span>
                      )}
                      {/* Memory badge — indicates long-term memory was used */}
                      {msg.role === 'assistant' && msg.longTermMemoryUsed && (
                        <span
                          className="text-xs font-mono px-1.5 py-0.5 rounded"
                          style={{
                            background: 'rgba(56,189,248,0.08)',
                            color: 'rgba(56,189,248,0.6)',
                            fontSize: '9px',
                          }}
                          title="Long-term memory was used for this response"
                        >
                          🧠 memory
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            <AnimatePresence>
              {isTyping && (
                <motion.div className="flex justify-start">
                  <div className="rounded-2xl rounded-tl-sm glass-elevated">
                    <TypingIndicator />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="flex-shrink-0 p-4 border-t border-border-subtle">
            {imagePending && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mb-2 flex items-center gap-2 text-xs text-muted"
              >
                <span className="text-accent">📎 Image attached</span>
                <button onClick={() => setImagePending(null)} className="text-danger hover:text-danger/80">
                  Remove
                </button>
              </motion.div>
            )}

            <div className="flex items-end gap-2">
              <VoiceInput onTranscript={handleVoiceTranscript} disabled={isLoading} />
              <ImageUpload
                onImage={(base64, mimeType, preview) => setImagePending({ base64, mimeType, preview })}
                onClear={() => setImagePending(null)}
                hasImage={!!imagePending}
                disabled={isLoading}
              />

              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask a question, explain your thinking, or describe what confuses you..."
                  rows={1}
                  disabled={isLoading}
                  className="w-full bg-bg-elevated border border-border-subtle rounded-xl px-4 py-3 text-content text-sm placeholder-muted/40 resize-none focus:border-accent/40 pr-12"
                  style={{ minHeight: '44px', maxHeight: '120px' }}
                  onInput={e => {
                    const t = e.target as HTMLTextAreaElement;
                    t.style.height = 'auto';
                    t.style.height = Math.min(120, t.scrollHeight) + 'px';
                  }}
                />
              </div>

              <motion.button
                onClick={() => sendMessage(inputText, imagePending || undefined)}
                disabled={isLoading || (!inputText.trim() && !imagePending)}
                className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
                style={{
                  background: (inputText.trim() || imagePending) ? 'linear-gradient(135deg, #00FF85, #00CC6A)' : 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {isLoading ? (
                  <motion.div
                    className="w-4 h-4 border-2 border-bg-primary/40 border-t-bg-primary rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                  />
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke={(inputText.trim() || imagePending) ? '#080C10' : '#8896A4'} strokeWidth="2.5">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                )}
              </motion.button>
            </div>
            <p className="text-xs text-muted/40 mt-1.5 text-center font-mono">
              Enter to send · Shift+Enter for new line · 🎤 Voice · 📸 Image
            </p>
          </div>
        </div>

        {/* Right Panel */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Knowledge Graph */}
          <div className="flex-1 p-4 overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-syne font-semibold text-content text-sm">Knowledge Graph</h3>
              <button onClick={loadGraph} className="text-xs text-muted hover:text-accent transition-colors font-mono">
                ↺ Refresh
              </button>
            </div>
            <div className="glass rounded-2xl overflow-hidden" style={{ height: 'calc(100% - 40px)' }}>
              <KnowledgeGraph
                nodes={graphData?.nodes || []}
                links={graphData?.links || []}
                height={280}
                onNodeClick={setSelectedNode}
              />
            </div>
          </div>

          {/* Status Cards */}
          <div className="flex-shrink-0 px-4 pb-2">
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="glass rounded-xl p-3 text-center">
                <div className="font-mono font-bold text-xl"
                  style={{ color: avgMastery > 0.6 ? '#00FF85' : avgMastery > 0.3 ? '#FFB347' : '#FF4D6D' }}>
                  {Math.round(avgMastery * 100)}%
                </div>
                <div className="text-xs text-muted mt-0.5">Mastery</div>
              </div>
              <div className="glass rounded-xl p-3 text-center">
                <div className="font-mono font-bold text-xl text-accent">{streak}</div>
                <div className="text-xs text-muted mt-0.5">Streak</div>
              </div>
              <div className="glass rounded-xl p-3 text-center">
                <div className="font-mono font-bold text-xl text-content">{graphData?.stats.conceptCount || 0}</div>
                <div className="text-xs text-muted mt-0.5">Concepts</div>
              </div>
            </div>

            {/* Selected Node Detail */}
            <AnimatePresence>
              {selectedNode && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="glass rounded-xl p-3 mb-3"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-content text-sm font-semibold">{selectedNode.concept}</span>
                    <button onClick={() => setSelectedNode(null)} className="text-muted text-xs hover:text-danger">✕</button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                    <div>
                      <span className="text-muted">Mastery</span>
                      <div className="text-accent">{Math.round(selectedNode.mastery * 100)}%</div>
                    </div>
                    <div>
                      <span className="text-muted">Retention</span>
                      <div style={{ color: selectedNode.retention > 0.6 ? '#00FF85' : '#FFB347' }}>
                        {Math.round(selectedNode.retention * 100)}%
                      </div>
                    </div>
                    <div>
                      <span className="text-muted">Reviews</span>
                      <div className="text-content">{selectedNode.reviewCount}</div>
                    </div>
                  </div>
                  {selectedNode.misconceptions > 0 && (
                    <p className="text-danger text-xs mt-1.5">⚠ {selectedNode.misconceptions} active misconception(s)</p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Smart Suggestions */}
            <SmartSuggestions
              studentId={studentId}
              onSuggestionClick={handleSuggestionClick}
              refreshTrigger={suggestionRefreshTrigger}
            />

            {/* Review Queue */}
            {graphData?.reviewQueue && graphData.reviewQueue.length > 0 && (
              <div className="glass rounded-xl p-3">
                <p className="text-xs font-mono text-muted mb-2">Review Queue</p>
                <div className="space-y-1.5">
                  {graphData.reviewQueue.slice(0, 4).map(item => (
                    <div key={item.conceptId} className="flex items-center justify-between">
                      <span className="text-xs text-content truncate max-w-[120px]">{item.concept}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-mono" style={{ color: URGENCY_COLORS[item.urgency] }}>
                          {Math.round(item.retention * 100)}%
                        </span>
                        <span className="text-xs font-mono px-1.5 py-0.5 rounded"
                          style={{
                            background: URGENCY_COLORS[item.urgency] + '15',
                            color: URGENCY_COLORS[item.urgency],
                            fontSize: '9px',
                          }}>
                          {item.urgency.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
