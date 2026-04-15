# AEGIS — AGI Upgrade

This branch extends AEGIS from a reactive tutor into a **persistent cognitive agent**.

## What's New

### 1. Always-On Cognition (`src/lib/backgroundCognition.ts`)
- Runs every **5 minutes** using a `setInterval` singleton — starts automatically on first request
- Processes every active student: decay model, dropout risk, task generation
- **No LLM calls** — pure computation, completes in < 2 seconds
- Aggregates cross-student curriculum insights each cycle

### 2. Autonomous Tasks (`src/lib/autonomousTasks.ts`)
- AEGIS generates tasks **between sessions** without user prompting
- Task types: `revision_reminder`, `misconception_correction`, `feynman_test`, `re_engagement`
- Delivered as proactive messages when student next logs in
- Endpoint: `GET /api/tasks?studentId=xxx`

### 3. Tutor Self-Model (`src/lib/tutorProfile.ts`)
- Global persistent identity: AEGIS knows **what it is as a teacher**
- Tracks empirical agent success rates across all students
- Auto-generates teaching wisdom at milestone thresholds
- Injected into every system prompt: tutor learns from experience

### 4. Functional Emotion Engine (`src/lib/emotionEngine.ts`)
- 3D emotion state: **concern / curiosity / confidence**
- Updated per message via exponential moving average
- Influences agent selection (high concern → downgrade CHALLENGE to HINT)
- Injected into system prompt as cognitive context

### 5. Cross-Student Intelligence (`src/lib/curriculumInsights.ts`)
- Aggregates misconception patterns, difficulty spikes across ALL students
- AEGIS knows "70% of students who reach this concept get confused here"
- Injected per-concept into system prompt to pre-empt known errors

### 6. Right-Question Detector (`src/lib/rightQuestionDetector.ts`)
- Pre-processing stage before agent selection — **zero latency** (rule-based, no LLM)
- Detects: direct answer requests, already-mastered concepts, prerequisite jumps
- Prepends gentle redirect message when suboptimal question detected

### 7. Memory Consolidation (`src/lib/memoryConsolidation.ts`)
- Runs at session end: episodic → semantic → identity
- Extracts stable patterns from session snapshots into long-term understanding
- Flags persistent misconceptions (seen in > 30% of sessions)
- Prunes old snapshots — keeps memory compact and sharp

### 8. Event System (`src/lib/eventSystem.ts`)
- Lightweight fire-and-forget event bus
- Events: `user_message`, `session_end`, `time_trigger`, `inactivity_detected`, `mastery_breakthrough`, `dropout_risk_elevated`
- All handlers async, silently swallow errors — never blocks requests

## New Database Tables
- `tutor_profile` — global tutor self-model
- `autonomous_tasks` — between-session task queue
- `curriculum_insights` — cross-student intelligence
- `emotion_state` — per-student tutor emotion state

All tables created automatically on first run via `initializeSchema()`.

## How to Run
```bash
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh"
npm install
cp .env.local.example .env.local  # add ANTHROPIC_API_KEY
npm run dev
```

## AGI Properties Achieved
| Property | Status |
|---|---|
| Persistent memory across sessions | ✅ (existing + consolidated) |
| Prediction / forward simulation | ✅ (existing Ebbinghaus model) |
| Autonomous initiation | ✅ **NEW** — acts without user prompt |
| Tutor self-model / identity | ✅ **NEW** — knows who it is as a teacher |
| Functional emotion states | ✅ **NEW** — concern / curiosity / confidence |
| Cross-student pattern learning | ✅ **NEW** — population-level intelligence |
| Right-question wisdom | ✅ **NEW** — redirects suboptimal questions |
| Memory consolidation | ✅ **NEW** — episodic → semantic pipeline |
| Event-driven architecture | ✅ **NEW** — decoupled reactive system |
