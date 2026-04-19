# Contributing to AEGIS

First off — thank you for considering contributing to AEGIS. This project exists to explore what an AGI-inspired cognitive tutor can look like in practice, and every contribution (bug report, idea, line of code) moves that forward.

This document explains how to get involved without friction.

---

## Ways to Contribute

You don't have to write code to help. Any of these are genuinely valuable:

- **Bug reports** — found something broken? Open an issue.
- **Feature ideas** — want AEGIS to do something new? Open a discussion.
- **Research references** — know a paper relevant to any of the cognitive systems? Send it.
- **Documentation improvements** — clearer READMEs, better comments, architecture notes.
- **Pedagogical feedback** — if you use AEGIS as a learner, tell us what worked and what didn't.
- **Code contributions** — everything from small fixes to new cognitive systems.

---

## Before You Start

1. **Check open issues first** — your idea or bug may already be tracked.
2. **For big changes, open an issue first** — don't spend 3 days on a feature we won't merge. Discuss the approach before coding.
3. **Small fixes don't need an issue** — typo fixes, obvious bugs, dependency bumps — just open a PR.

---

## Development Setup

```bash
# 1. Fork the repo on GitHub, then:
git clone https://github.com/YOUR_USERNAME/aegis-ai-learning.git
cd aegis-ai-learning

# 2. Install dependencies
npm install

# 3. Configure your API key
cp .env.local.example .env.local
# Add your ANTHROPIC_API_KEY (see README — ~$5–10 in credits is enough for testing)

# 4. Run the dev server
npm run dev
```

Create a feature branch before making changes:

```bash
git checkout -b feature/my-improvement
# or
git checkout -b fix/issue-42
```

---

## Coding Guidelines

AEGIS is TypeScript-strict with a specific architectural style. Please follow these:

### General

- **TypeScript strict mode** — no `any`, use proper types. If a type is genuinely unknown, use `unknown` with a runtime check.
- **Descriptive naming** — `computeBeliefState()` not `compute()`. Code is read more than written.
- **Comments explain *why*, not *what*** — the code shows *what*. If the *why* is obvious, skip the comment.

### Architecture

- **Pure computation > LLM calls** — if a feature can be implemented deterministically (like the predictive model), do that. LLM calls are expensive and slow.
- **EMA over hard thresholds** — most cognitive signals in AEGIS use exponential moving averages (α = 0.12–0.15). Follow that pattern for new systems.
- **Singletons for global state** — use `globalThis` pattern for anything that needs to survive Next.js hot reloads (see `db.ts`, `backgroundCognition.ts`).
- **Fire-and-forget for non-critical work** — use the `eventSystem` for anything that shouldn't block a request.

### Database Changes

- **Add migrations, don't rewrite schema** — `db.ts` handles schema evolution. Add new columns with `ALTER TABLE ... IF NOT EXISTS`.
- **JSON columns for flexible data** — `cognitive_dna`, `misconception`, etc. are JSON-encoded. Follow that pattern for new structured data.

### Prompts

- **System prompts live in `lib/prompts.ts`** — don't inline prompts in API routes.
- **Chain-of-Thought is always stripped** — use `stripCoT()` before returning to the client.

---

## Commit Messages

Use conventional commit prefixes:

```
feat:      new feature
fix:       bug fix
docs:      documentation only
refactor:  code change that neither fixes a bug nor adds a feature
perf:      performance improvement
test:      adding or updating tests
chore:     build / tooling / dependency updates
```

Examples:
- `feat: add autonomous task generation for re-engagement`
- `fix: prevent emotion state drift when no messages in last 24h`
- `docs: clarify hierarchical memory token budget`

---

## Pull Request Process

1. **Branch from `main`** — not from stale feature branches.
2. **One PR per concern** — don't bundle a bug fix, a feature, and a refactor in the same PR.
3. **Fill the PR template** — what did you change, why, how was it tested?
4. **Link related issues** — use `Closes #42` in the description so the issue auto-closes.
5. **Respond to review feedback** — don't take it personally. Reviews make the code better.

### What a good PR description looks like

```
## What this changes
Adds a new REPAIR-variant agent for students who show repeated deflection patterns.

## Why
Currently the deflection counter just locks to REPAIR, but stock REPAIR assumes
an identifiable misconception. When the misconception is deflection itself, a
different framing works better (see issue #87).

## How I tested it
- Added a unit test in experiments/test_agents.ts
- Manually ran 5 sessions with the new agent on synthetic deflection patterns
- Compared frustration trajectories vs. stock REPAIR (reduced by 18% on avg)

## Anything reviewers should focus on
The EMA weight initialisation — I used 1.0 but an argument could be made for 0.8
to prevent over-selection early on.
```

---

## Reporting Bugs

Open a GitHub issue with:

1. **What you did** — minimal steps to reproduce
2. **What you expected to happen**
3. **What actually happened** — include error messages, stack traces
4. **Environment** — Node version, OS, browser (for frontend bugs)
5. **Severity** — does it crash? silently misbehave? cosmetic?

---

## Suggesting Features

Open a GitHub issue (or a Discussion for larger ideas) with:

1. **The problem** — what limitation you hit, or what question you want answered
2. **Your proposed solution** — even a rough sketch is fine
3. **Alternatives you considered**
4. **Why AEGIS specifically** — is this a fit for a cognitive tutor, or more general?

---

## Questions?

Open a GitHub Discussion, or email **miheer.smk@gmail.com**.

Thanks for being here.
