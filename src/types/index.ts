export interface Student {
  id: string;
  name: string;
  topic: string;
  goal: string;
  cognitive_dna: CognitiveDNA;
  created_at: string;
}

export interface CognitiveDNA {
  visual: number;
  abstract: number;
  exampleFirst: number;
  theoryFirst: number;
  analogyDriven: number;
  pace: 'slow' | 'medium' | 'fast';
  preferredStyle: string;
}

export interface ConceptNode {
  id: string;
  student_id: string;
  concept: string;
  mastery: number;
  stability: number;
  last_reviewed: string;
  misconception: Misconception[];
  review_count: number;
  feynman_clarity?: number;
  feynman_depth?: number;
}

export interface Misconception {
  description: string;
  severity: 'low' | 'medium' | 'high';
  detected_at: string;
}

export interface ChatMessage {
  id: string;
  student_id: string;
  role: 'user' | 'assistant';
  content: string;
  agent_type: AgentType;
  timestamp: string;
  frustration_level: number;
  reflection_score?: number;
}

export interface Session {
  id: string;
  student_id: string;
  started_at: string;
  ended_at: string | null;
  concepts_covered: string[];
  mastery_delta: number;
}

// Extended with FEYNMAN agent
export type AgentType = 'PROBE' | 'HINT' | 'REPAIR' | 'CHALLENGE' | 'META' | 'FEYNMAN';

export interface EpistemicState {
  understood: Array<{ concept: string; confidence: number }>;
  misconceptions: Array<{ concept: string; description: string; severity: 'low' | 'medium' | 'high' }>;
  missingPrerequisites: string[];
  frustrationLevel: number;
  engagementLevel: number;
  clarityScore?: number;
  depthScore?: number;
  reflectionScore?: number;
}

// ─── Feynman Technique ────────────────────────────────────────────────────────

export interface FeynmanResult {
  clarityScore: number;    // 0–1: how clear was the explanation?
  depthScore: number;      // 0–1: how deep / accurate?
  gaps: string[];          // specific gaps identified
  strengths: string[];     // what was explained well
  isStrong: boolean;       // true → mastery boost, false → route to REPAIR
  feedback: string;        // one-paragraph human-readable feedback
  triggeredAgent: AgentType;
}

// ─── Input Safety ─────────────────────────────────────────────────────────────

export interface SafetyResult {
  safe: boolean;
  reason?: string;
  sanitizedMessage: string;
  category: 'ok' | 'abusive' | 'off_topic' | 'irrelevant';
  blockedResponse?: string; // Message to return to user if blocked
}

// ─── Smart Suggestions ────────────────────────────────────────────────────────

export interface Suggestion {
  id: string;
  type: 'next_topic' | 'revision' | 'practice';
  title: string;
  description: string;
  concept?: string;
  urgency: 'high' | 'medium' | 'low';
  actionText: string;   // Text to insert into chat input
}

// ─── Reflection / Meta-Cognition ──────────────────────────────────────────────

export interface ReflectionData {
  quality: number;           // 0–1
  selfAwareness: number;     // 0–1
  actionableInsight: boolean;
  keyInsight: string;
}

// ─── Knowledge Graph ──────────────────────────────────────────────────────────

export interface KGNode {
  id: string;
  concept: string;
  mastery: number;
  retention: number;
  misconceptions: number;
  reviewCount: number;
  feynman_clarity?: number;
  feynman_depth?: number;
  stability?: number;
  last_reviewed?: string;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface KGLink {
  source: string | KGNode;
  target: string | KGNode;
  strength: number;
}

export interface KnowledgeGraphData {
  nodes: KGNode[];
  links: KGLink[];
}

export interface DecayResult {
  conceptId: string;
  concept: string;
  currentRetention: number;
  masteryAfterDecay: number;
  daysUntilForgotten: number;
  urgency: 'critical' | 'high' | 'medium' | 'low';
}

export interface ReviewItem {
  conceptId: string;
  concept: string;
  mastery: number;
  retention: number;
  urgency: 'critical' | 'high' | 'medium' | 'low';
  nextReviewDays: number;
}

export interface StudentAnalytics {
  id: string;
  name: string;
  topic: string;
  avgMastery: number;
  riskScore: number;
  frustrationLevel: number;
  weakConcepts: string[];
  conceptCount: number;
  interventionNeeded: boolean;
  lastActive: string;
}

export interface ClassTrend {
  date: string;
  avgMastery: number;
  activeStudents: number;
}

export interface MisconceptionData {
  concept: string;
  count: number;
  severity: string;
  students: string[];
}

export interface InstructorAnalytics {
  students: StudentAnalytics[];
  classTrends: ClassTrend[];
  misconceptionHeatmap: MisconceptionData[];
  totalStudents: number;
  atRiskCount: number;
  avgClassMastery: number;
}

export interface ChatResponse {
  message: string;
  agentType: AgentType;
  epistemicUpdate: Partial<EpistemicState>;
  graphUpdated: boolean;
  decayAlerts: ReviewItem[];
  feynmanResult?: FeynmanResult;
  safetyBlocked?: boolean;
}
