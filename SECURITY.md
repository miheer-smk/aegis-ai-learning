# Security Policy

## Supported Versions

AEGIS is currently a single-track project on the `main` branch. Security fixes
are applied to the latest commit on `main`. If you're running an older fork, we
recommend updating before reporting issues specific to outdated dependencies.

| Version | Supported |
|---|---|
| `main` (latest) | ✅ |
| older commits | ❌ — please update |

---

## Reporting a Vulnerability

**Please do NOT open a public GitHub issue for security vulnerabilities.**

If you discover a security issue, report it privately by emailing:

📧 **miheer.smk@gmail.com**

Include as much of the following as you can:

- **Description** — what the vulnerability is
- **Impact** — what can an attacker do with it?
- **Steps to reproduce** — ideally a minimal proof-of-concept
- **Affected components** — e.g. `/api/chat`, `db.ts`, client-side XSS, etc.
- **Your contact info** — so I can follow up

You can expect:

- **Acknowledgment within 72 hours**
- **Initial assessment within 7 days**
- **Fix or mitigation plan within 30 days** for confirmed vulnerabilities
- **Credit in the fix commit / release notes** (if you want it)

---

## Scope

AEGIS is a local/self-hosted application. Security issues worth reporting include:

### In scope ✅

- **Prompt injection** vulnerabilities that bypass the two-stage safety filter
- **SQL injection** in any of the SQLite queries
- **XSS** in message rendering (KaTeX, markdown, HTML)
- **Authentication / authorisation bypass** for instructor or student endpoints
- **Student data leakage** across different `student_id` sessions
- **API key exposure** in logs, error messages, or client-side code
- **Dependency vulnerabilities** in critical packages (better-sqlite3, next, anthropic SDK)
- **Denial of service** via unbounded loops, infinite token consumption, etc.

### Out of scope ❌

- **Self-hosting misconfigurations** — if you expose `.env.local` publicly, that's your setup, not an AEGIS vulnerability
- **Social engineering** of students or instructors
- **Issues requiring unrealistic preconditions** (e.g. "attacker has root on the server")
- **Claude model output** — if Claude says something wrong or misleading, that's a model issue, not an AEGIS security bug (though please do file it as a regular issue)
- **Vulnerabilities in dependencies that don't affect AEGIS** — if `some-transitive-dep` has a CVE but we don't use the vulnerable code path, it's not actionable here

---

## Data Handling Note

AEGIS stores student data locally in SQLite (`data.db` by default). This includes:

- Student names, topics, and learning goals
- All chat messages (including any personal details students share)
- Cognitive model state (DNA, misconceptions, mastery levels)
- Emotion state history

**If you deploy AEGIS for real students:**

- Enable HTTPS
- Set up authentication (not included out of the box — add your own)
- Be aware that **all chat messages are sent to Anthropic's Claude API** — review their [privacy policy](https://www.anthropic.com/legal/privacy) before deploying for minors or sensitive use cases
- Consider GDPR / FERPA / local education-data laws that apply to your jurisdiction

This is a research prototype. It is **not** audited for production student-data deployment.

---

## Recognition

Security researchers who responsibly disclose valid vulnerabilities will be
credited in the fix commit and in a `SECURITY_HALL_OF_FAME.md` file (created
once we have the first entry).

Thank you for helping keep AEGIS safe.
