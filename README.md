<div align="center">

# AEGIS

### Adaptive Engine for Guided Intelligent Study

**An AGI-inspired cognitive tutoring system that thinks between sessions, acts without being prompted, and evolves its own teaching identity over time.**

[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Claude AI](https://img.shields.io/badge/Claude-claude--opus--4--5-orange?style=flat-square)](https://anthropic.com)
[![SQLite](https://img.shields.io/badge/SQLite-WAL%20Mode-green?style=flat-square&logo=sqlite)](https://sqlite.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

</div>

---

## What Makes AEGIS Different

Most AI tutors are reactive chatbots — they wait, respond, forget. AEGIS is a **persistent cognitive agent**.

| Reactive Chatbot | AEGIS |
|---|---|
| Responds only when messaged | Thinks every 5 minutes, regardless |
| Forgets between sessions | Maintains 4-layer memory across all time |
| No sense of self | Has a persistent tutor identity that evolves |
| Single scalar "frustration" | 3D emotion state: concern / curiosity / confidence |
| Treats every student in isolation | Learns from patterns across all students |
| Answers whatever is asked | Detects wrong questions and redirects |
| Memory grows unbounded | Consolidates episodic → semantic → identity |
| Static teaching strategy | Self-evolving per-student teaching weights |

---

## System Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                      AEGIS COGNITIVE ARCHITECTURE                        │
│                                                                          │
│  ╔══════════════════════════════════════════════════════════════════╗    │
│  ║           ALWAYS-ON LAYER  (runs every 5 min, no LLM)           ║    │
│  ║  backgroundCognition → predictiveModel → autonomousTasks        ║    │
│  ║  curriculumInsights (cross-student aggregation)                  ║    │
│  ╚══════════════════════════════════════════════════════════════════╝    │
│                              ↓ feeds into                                │
│  ┌─────────────────────────────────────────────────────────────────┐     │
│  │            HIERARCHICAL MEMORY STACK (~300 tokens)              │     │
│  │  Layer 0 · Identity Model     — who this student is             │     │
│  │  Layer 1 · Semantic Memory    — concept graph + mastery         │     │
│  │  Layer 2 · Episodic Memory    — compressed past sessions        │     │
│  │  Layer 3 · Working Memory     — current conversation (raw)      │     │
│  └─────────────────────────────────────────────────────────────────┘     │
│                                                                          │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐   │
│  │ PREDICTIVE MODEL │  │  THEORY OF MIND  │  │   EMOTION ENGINE     │   │
│  │ 7-day risk map   │  │  Belief vs. true │  │  concern / curiosity │   │
│  │ Bottleneck det.  │  │  Reflection depth│  │  confidence (EMA)    │   │
│  │ Dropout risk     │  │  Metacognition   │  │  Drives agent bias   │   │
│  └──────────────────┘  └──────────────────┘  └──────────────────────┘   │
│                                                                          │
│  ┌───────────────────────────────────────────────────────────────────┐   │
│  │                    TUTOR SELF-MODEL (global)                      │   │
│  │  empirical agent success rates · accumulated teaching wisdom      │   │
│  │  totalStudentsTaught · avgMasteryImprovement · auto-insights      │   │
│  └───────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌───────────────────────────────────────────────────────────────────┐   │
│  │                  19-STAGE CHAT PIPELINE (per request)             │   │
│  │  Safety → Tasks → Emotion → Memory → Predict → Epistemic →       │   │
│  │  RightQuestion → ToM → Graph → DNA → Feynman → AgentSelect →     │   │
│  │  EmotionBias → Prompt → LLM → AntiHallucination → Persist →      │   │
│  │  BackgroundUpdates → ReviewQueue                                  │   │
│  └───────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Core Systems

### Pedagogical Agents — 6 Specialized Teaching Modes

AEGIS automatically selects the right agent for every message based on the student's epistemic state:

| Agent | Trigger | Strategy |
|---|---|---|
| **PROBE** | Default | Socratic questioning — surfaces gaps without giving answers |
| **HINT** | Frustration ≥ 70% | Progressive scaffolding — 5 hint levels, reduces cognitive load |
| **REPAIR** | Active misconception | Piaget's cognitive conflict — student discovers the contradiction |
| **CHALLENGE** | Mastery ≥ 80% | Trap problems, edge cases, limit cases — probes depth |
| **META** | Every 5th message | Metacognitive reflection — learning pattern analysis |
| **FEYNMAN** | Mastery threshold | Teach-back evaluation — student explains, AEGIS scores |

### Original Cognitive Systems

| System | Description |
|---|---|
| **Hierarchical Memory** | 4-layer compression: ~300 tokens vs 2000+ raw history, 6–10× denser |
| **Ebbinghaus Decay** | `R(t) = e^(-t/S)` per concept; SM-2 stability scheduling |
| **Cognitive DNA** | 6D learning style vector inferred and updated every 4 messages |
| **Theory of Mind** | Models what student *believes* vs. what they actually know |
| **Feynman Engine** | Triggered at mastery thresholds — evaluates student teach-back quality |
| **Predictive Model** | 7-day risk map, bottleneck detection, dropout risk — pure computation, <5ms |
| **Anti-Hallucination** | 6-heuristic scorer; reasoning-first mode when confidence < 0.60 |
| **Chain-of-Thought** | Hidden 5-step CoT; `stripCoT()` prevents leakage into responses |
| **Teaching Weights** | EMA signal per agent, self-evolving per student, clamped [0.4, 2.2] |
| **Multimodal Input** | Image upload (diagrams, equations) alongside text |
| **Voice I/O** | Web Speech API — speech-to-text input |
| **Input Safety** | Two-stage: regex gate + Claude semantic classification |
| **Knowledge Graph** | D3.js force simulation — live mastery and retention arcs |

### AGI Upgrade — 8 New Systems

| System | File | What it does |
|---|---|---|
| **Always-On Cognition** | `backgroundCognition.ts` | `setInterval` singleton, 5-min cycle, processes all active students — zero LLM |
| **Autonomous Tasks** | `autonomousTasks.ts` | Generates tasks between sessions; delivers proactively on student return |
| **Functional Emotions** | `emotionEngine.ts` | 3D state: concern/curiosity/confidence; EMA-updated; biases agent selection |
| **Tutor Self-Model** | `tutorProfile.ts` | Global identity: empirical success rates, accumulated wisdom, self-improving |
| **Right-Question Detector** | `rightQuestionDetector.ts` | Prereq jumps, answer-seeking, mastered topics — zero latency, no LLM |
| **Curriculum Intelligence** | `curriculumInsights.ts` | Cross-student aggregation: misconception clusters, difficulty spikes |
| **Memory Consolidation** | `memoryConsolidation.ts` | Session end: episodic → semantic → identity; prunes noise |
| **Event System** | `eventSystem.ts` | Fire-and-forget bus: 7 event types, never blocks requests |

---

## AGI Architecture: Deep Dive

### 1. Always-On Cognition

AEGIS does not sleep between sessions. Every 5 minutes, with zero LLM calls:

```
For each active student (last 30 days):
  → predictFutureState()       — Ebbinghaus decay, dropout risk
  → generateAutonomousTasks()  — queue tasks based on risk signals
  → emit dropout_risk event    — if risk > 0.6

Globally:
  → aggregateCurriculumInsights()  — SQL aggregation across all students
```

Uses `globalThis` singleton — same pattern as the DB connection. Survives Next.js hot reloads. Completes in < 2 seconds.

---

### 2. Autonomous Task System

AEGIS acts without user input. Between sessions it generates and queues:

| Task Type | Trigger |
|---|---|
| `re_engagement` | Student inactive > 3 days |
| `revision_reminder` | Concept retention dropped below 55% |
| `misconception_correction` | Unresolved misconception persists |
| `feynman_test` | Mastery > 75% but never Feynman-tested |
| `milestone_celebration` | Significant mastery breakthrough |

Tasks sit in SQLite. On the student's next message, pending tasks are prepended to the response as proactive messages.

```
GET /api/tasks?studentId=xxx  →  { pendingCount, tasks[] }
```

---

### 3. Functional Emotion Engine

Moves beyond a single frustration float to a 3D cognitive state:

```
concern    = worry about student trajectory
             rises with: frustration, misconceptions, consecutive failures

curiosity  = interest in student's unique patterns
             rises with: high-severity errors, unusual engagement

confidence = how well the tutor understands this student
             rises with: mastery gains; falls with unpredictable responses

Update rule: state = state × 0.85 + signal × 0.15  (EMA, α = 0.15)
```

Agent bias: `concern > 0.70 AND currentAgent == CHALLENGE → downgrade to HINT`

---

### 4. Tutor Self-Model

AEGIS has a persistent global identity — what it knows about itself as a teacher:

```
agentOutcomes:         { PROBE: { avgMasteryDelta, successRate, count }, ... }
teachingWisdom:        auto-generated strings at count milestones (every 30 uses)
totalSessions:         population-level statistics
avgMasteryImprovement: measured across all students, all time
```

Example auto-generated insight (injected into every system prompt):
> *"After 240 sessions: REPAIR yields +8.3% mastery per use (71% success rate) — most effective agent overall"*

---

### 5. Right-Question Detector

Pre-processing before agent selection — rule-based, zero LLM, zero latency.

Detects three failure modes:
- **Direct answer requests** → redirects to reasoning process
- **Already-mastered concept** → redirects to weaker area (35% probability, non-intrusive)
- **Prerequisite jump** → 9 domain rules covering calculus, DSA, probability, linear algebra, ML

Also detects **deflection loops** — when a student asks consecutive meta-questions to avoid engaging with a diagnostic question. If deflection count ≥ 2, agent selection locks to REPAIR and the prompt guard blocks answer-reveal.

---

### 6. Cross-Student Curriculum Intelligence

Every student teaches AEGIS something about the curriculum:

```sql
-- Common misconceptions
SELECT concept, COUNT(DISTINCT student_id) FROM concept_nodes
WHERE json_array_length(misconception) > 0 GROUP BY concept

-- Difficulty spikes
SELECT concept, AVG(mastery), AVG(review_count) FROM concept_nodes
GROUP BY concept HAVING avg_mastery < 0.45
```

Injected per-concept into system prompt: *"⚠ 7 students have struggled here (avg mastery: 34%)"*

---

### 7. Memory Consolidation Pipeline

Runs at session end — never during active chat:

```
Stage 1 — Episodic → Semantic
  Scan last 12 session snapshots
  Concepts mastered in 2+ sessions → promote to longTermUnderstanding
  Misconceptions in > 30% of sessions → flag as persistent

Stage 2 — Semantic → Identity
  Infer preferredExplanationStyle from DNA + frustration patterns

Stage 3 — Pruning
  Keep 20 most recent episodic snapshots; discard consolidated entries
```

---

### 8. Hierarchical Memory Stack

```
Layer 0  Identity (~40 tokens)   — learning style, pace, breakthrough methods
Layer 1  Semantic (~100 tokens)  — concept mastery, misconceptions, decay, Feynman scores
Layer 2  Episodic (~120 tokens)  — keyword-scored compressed session snapshots
Layer 3  Working (full)          — raw last 10 messages passed directly to Claude
```

Total: ~300 tokens. **6–10× information density** vs. naive history injection.

---

### 9. Predictive Learning Model

```
Input:  mastery[], stability[], last_reviewed[], frustration, session velocity
Output: riskMap (7-day per-concept), learningPath (prereq-gated),
        bottlenecks, dropoutRisk, projectedMastery7d / projectedMastery30d
Runtime: pure computation, <5ms, zero LLM calls
```

---

## Database Schema — 12 Tables

```sql
-- Core
students            — name, topic, goal, cognitive_dna (JSON)
concept_nodes       — mastery, stability, last_reviewed, misconception[], feynman scores
chat_messages       — role, content, agent_type, frustration_level
sessions            — started_at, ended_at, concepts_covered, mastery_delta

-- Cognitive Model
cognitive_state     — long_term_understanding, dna_evolution, teaching_weights, tom_accuracy_trend
memory_snapshots    — compressed session summaries with keyword index

-- Analytics
concept_difficulty  — global: avg_attempts, misconception_frequency per concept
learning_plans      — personalized study plans from session-end analysis
prompt_performance  — per-agent mastery_delta, frustration_end, tom_accuracy

-- AGI Upgrade
tutor_profile       — global tutor identity: agent_success_rates, teaching_wisdom
autonomous_tasks    — between-session task queue (revision, feynman, re-engagement)
curriculum_insights — cross-student: misconception clusters, difficulty spikes
emotion_state       — per-student: concern, curiosity, confidence (EMA)
```

---

## API Routes

| Route | Method | Description |
|---|---|---|
| `/api/chat` | POST | 19-stage cognitive pipeline |
| `/api/session-end` | POST | Consolidation + task generation + tutor self-model update |
| `/api/tasks` | GET | Pending autonomous tasks for a student |
| `/api/epistemic` | POST | Epistemic state analysis |
| `/api/student` | GET/POST | Student CRUD |
| `/api/suggestions` | GET | Smart decay-aware learning nudges |
| `/api/instructor` | GET | Instructor analytics dashboard |

---

## Getting Started

**Prerequisites:** Node.js 18+, Anthropic API key

```bash
git clone https://github.com/miheer-smk/aegis-ai-learning.git
cd aegis-ai-learning

npm install

cp .env.local.example .env.local
# Edit .env.local and add:
# ANTHROPIC_API_KEY=sk-ant-...

npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Demo Flow

1. **Create a student** — name, topic (e.g. "Calculus"), learning goal
2. **Start chatting** — cognitive model builds from message 1; background cognition starts automatically in 15s
3. **Watch the knowledge graph** — concepts appear, mastery grows, decay arcs show forgetting
4. **Check emotion state** — `cognitiveInsights.emotionState` in the API response payload
5. **Trigger Feynman** — after mastery builds, AEGIS asks you to explain the concept back
6. **Return after 3+ days** — proactive task messages appear in the first response
7. **Instructor dashboard** — mastery trends, decay alerts, agent distribution, Cognitive DNA radar

---

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── chat/               — 19-stage cognitive pipeline
│   │   ├── session-end/        — consolidation + task gen + tutor update
│   │   ├── tasks/              — GET pending autonomous tasks
│   │   ├── epistemic/          — epistemic state analysis
│   │   ├── suggestions/        — smart learning suggestions
│   │   ├── student/            — student CRUD
│   │   └── instructor/         — teacher overview panel
│   ├── learn/[id]/             — main chat interface
│   ├── dashboard/[id]/         — cognitive analytics dashboard
│   └── instructor/             — teacher analytics view
├── lib/
│   ├── backgroundCognition.ts  — always-on 5-min cycle
│   ├── autonomousTasks.ts      — between-session task queue
│   ├── emotionEngine.ts        — concern/curiosity/confidence model
│   ├── tutorProfile.ts         — global tutor self-model
│   ├── rightQuestionDetector.ts — prereq gap + deflection detection
│   ├── curriculumInsights.ts   — cross-student aggregation
│   ├── memoryConsolidation.ts  — episodic→semantic pipeline
│   ├── eventSystem.ts          — fire-and-forget event bus
│   ├── hierarchicalMemory.ts   — 4-layer memory abstraction stack
│   ├── predictiveModel.ts      — 7-day knowledge forecast engine
│   ├── theoryOfMind.ts         — student belief state modeling
│   ├── cognitiveState.ts       — always-on persistent student model
│   ├── agents.ts               — 6 pedagogical agents + selection logic
│   ├── epistemic.ts            — epistemic state analysis (Claude)
│   ├── decay.ts                — Ebbinghaus forgetting curve
│   ├── memory.ts               — long-term memory compression
│   ├── cognitiveDNA.ts         — learning style inference
│   ├── feynman.ts              — Feynman technique engine
│   ├── verification.ts         — anti-hallucination + confidence scoring
│   ├── outputProcessor.ts      — LaTeX fixing, artifact removal
│   ├── safety.ts               — two-stage input safety filter
│   ├── prompts.ts              — CoT, meta-reflection prompts
│   └── db.ts                   — SQLite singleton + schema (12 tables)
└── components/
    ├── KnowledgeGraph.tsx      — D3.js force simulation
    ├── MessageRenderer.tsx     — KaTeX math rendering
    ├── VoiceInput.tsx          — Web Speech API STT
    ├── AgentBadge.tsx          — pedagogical agent indicator
    ├── SmartSuggestions.tsx    — context-aware nudges
    └── SignLanguageHelper.tsx  — accessibility panel
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router, TypeScript strict) |
| AI Model | Anthropic Claude claude-opus-4-5 (multimodal) |
| Database | SQLite via better-sqlite3 (WAL mode, singleton) |
| Visualization | D3.js v7 (force simulation, glow filters, retention arcs) |
| Animation | Framer Motion (AnimatePresence, layout transitions) |
| Math Rendering | KaTeX (client-side, block + inline) |
| Voice | Web Speech API (STT) |
| Styling | Tailwind CSS v3 |

---

## AGI Properties

| Property | Status | Implementation |
|---|---|---|
| Persistent memory across sessions | ✅ | 4-layer hierarchical memory stack |
| Autonomous initiation | ✅ | Acts between sessions without prompting |
| Prediction / forward simulation | ✅ | 7-day Ebbinghaus risk map per concept |
| Tutor self-model / identity | ✅ | Empirical success rates, auto-generated wisdom |
| Functional emotion states | ✅ | 3D EMA: concern / curiosity / confidence |
| Cross-student pattern learning | ✅ | Population-level curriculum intelligence |
| Right-question wisdom | ✅ | Prereq gap detection + deflection guard |
| Memory consolidation | ✅ | Episodic → semantic → identity pipeline |
| Event-driven architecture | ✅ | Fire-and-forget, 7 event types |
| Anti-jailbreak (deflection) | ✅ | Counter + agent lock + REPAIR prompt guard |

---

## Research Foundation

| Concept | Source |
|---|---|
| Forgetting Curve | Ebbinghaus, H. (1885). *Über das Gedächtnis* |
| Episodic / Semantic Memory | Tulving, E. (1972). Episodic and semantic memory |
| Working Memory | Baddeley, A. (2000). The episodic buffer |
| Theory of Mind | Premack & Woodruff (1978). *Behavioral and Brain Sciences* |
| Metacognitive Monitoring | Flavell, J. (1979). *American Psychologist* |
| ACT-R Architecture | Anderson, J. (1983). *The Architecture of Cognition* |
| Cognitive Conflict | Piaget, J. (1952). Accommodation/assimilation model |
| Schema Theory | Bartlett, F. (1932). *Remembering* |
| Self-Regulated Learning | Winne & Hadwin (1998). Studying as self-regulated learning |
| Spaced Repetition | SM-2 Algorithm, Wozniak (1990) |
| Memory Consolidation | Stickgold, R. (2005). Sleep-dependent memory consolidation |

---

## Contributors

| Name | GitHub |
|---|---|
| Miheer | [@miheer-smk](https://github.com/miheer-smk) |
| Aditya Jaiswal | [@adityajaiswaliiitn](https://github.com/adityajaiswaliiitn) |
| Chirag | [@achirag649](https://github.com/achirag649) |

---

## License

MIT
