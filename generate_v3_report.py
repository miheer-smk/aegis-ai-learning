"""
AEGIS v3 — From Chatbot to Cognitive System: Evidence Toward AGI-like Behavior
Research-grade PDF report generator using ReportLab.
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether, PageBreak
)
from reportlab.platypus.flowables import Flowable
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os

# ── Color Palette ──────────────────────────────────────────────────────────────
DARK_BG    = colors.HexColor("#0D1117")
ACCENT     = colors.HexColor("#00FF85")
BLUE_LIGHT = colors.HexColor("#38BDF8")
RED_SOFT   = colors.HexColor("#FF4D6D")
PURPLE     = colors.HexColor("#A78BFA")
GOLD       = colors.HexColor("#F59E0B")
TEXT_MAIN  = colors.HexColor("#E8EDF2")
TEXT_DIM   = colors.HexColor("#8B949E")
BORDER     = colors.HexColor("#21262D")
ROW_ALT    = colors.HexColor("#161B22")
ROW_HEAD   = colors.HexColor("#1A2332")
WHITE      = colors.white
BLACK      = colors.black

PAGE_W, PAGE_H = A4
L_MARGIN = 22 * mm
R_MARGIN = 22 * mm
T_MARGIN = 22 * mm
B_MARGIN = 22 * mm

# ── Style Helpers ──────────────────────────────────────────────────────────────

def make_styles():
    base = getSampleStyleSheet()
    styles = {}

    styles['cover_title'] = ParagraphStyle(
        'cover_title', fontName='Helvetica-Bold',
        fontSize=22, leading=30, textColor=WHITE,
        alignment=TA_CENTER, spaceAfter=6
    )
    styles['cover_subtitle'] = ParagraphStyle(
        'cover_subtitle', fontName='Helvetica',
        fontSize=13, leading=18, textColor=ACCENT,
        alignment=TA_CENTER, spaceAfter=4
    )
    styles['cover_meta'] = ParagraphStyle(
        'cover_meta', fontName='Helvetica',
        fontSize=9, leading=14, textColor=TEXT_DIM,
        alignment=TA_CENTER
    )
    styles['section_num'] = ParagraphStyle(
        'section_num', fontName='Helvetica-Bold',
        fontSize=9, leading=12, textColor=ACCENT,
        spaceBefore=14, spaceAfter=2
    )
    styles['section_title'] = ParagraphStyle(
        'section_title', fontName='Helvetica-Bold',
        fontSize=14, leading=20, textColor=WHITE,
        spaceBefore=2, spaceAfter=6
    )
    styles['subsection_title'] = ParagraphStyle(
        'subsection_title', fontName='Helvetica-Bold',
        fontSize=11, leading=16, textColor=BLUE_LIGHT,
        spaceBefore=10, spaceAfter=4
    )
    styles['body'] = ParagraphStyle(
        'body', fontName='Helvetica',
        fontSize=9.5, leading=15, textColor=TEXT_MAIN,
        alignment=TA_JUSTIFY, spaceAfter=6
    )
    styles['body_dim'] = ParagraphStyle(
        'body_dim', fontName='Helvetica',
        fontSize=9, leading=14, textColor=TEXT_DIM,
        alignment=TA_JUSTIFY, spaceAfter=4
    )
    styles['bullet'] = ParagraphStyle(
        'bullet', fontName='Helvetica',
        fontSize=9.5, leading=15, textColor=TEXT_MAIN,
        leftIndent=14, spaceAfter=3,
        bulletText='▸', bulletFontName='Helvetica',
        bulletFontSize=8, bulletColor=ACCENT, bulletIndent=0
    )
    styles['code'] = ParagraphStyle(
        'code', fontName='Courier',
        fontSize=8.2, leading=13, textColor=ACCENT,
        backColor=colors.HexColor("#0A0F14"),
        leftIndent=10, rightIndent=10,
        spaceBefore=4, spaceAfter=4,
        borderPad=4
    )
    styles['example_label'] = ParagraphStyle(
        'example_label', fontName='Helvetica-Bold',
        fontSize=9, leading=13, textColor=GOLD,
        spaceBefore=8, spaceAfter=2
    )
    styles['example_in'] = ParagraphStyle(
        'example_in', fontName='Courier',
        fontSize=8.5, leading=13, textColor=BLUE_LIGHT,
        leftIndent=10, spaceAfter=2
    )
    styles['example_out'] = ParagraphStyle(
        'example_out', fontName='Courier',
        fontSize=8.5, leading=13, textColor=ACCENT,
        leftIndent=10, spaceAfter=2
    )
    styles['caption'] = ParagraphStyle(
        'caption', fontName='Helvetica-Oblique',
        fontSize=8, leading=12, textColor=TEXT_DIM,
        alignment=TA_CENTER, spaceAfter=6
    )
    styles['note'] = ParagraphStyle(
        'note', fontName='Helvetica-Oblique',
        fontSize=8.5, leading=13, textColor=PURPLE,
        leftIndent=10, spaceAfter=4
    )
    styles['toc_entry'] = ParagraphStyle(
        'toc_entry', fontName='Helvetica',
        fontSize=9.5, leading=16, textColor=TEXT_MAIN,
        leftIndent=8
    )
    return styles

# ── Custom Flowables ───────────────────────────────────────────────────────────

class DarkPageBackground(Flowable):
    """Full-page dark background — used only for cover."""
    def __init__(self, w, h):
        super().__init__()
        self.width = w
        self.height = h
    def draw(self):
        self.canv.saveState()
        self.canv.setFillColor(DARK_BG)
        self.canv.rect(-L_MARGIN, -B_MARGIN,
                       self.width + L_MARGIN + R_MARGIN,
                       self.height + T_MARGIN + B_MARGIN,
                       fill=1, stroke=0)
        self.canv.restoreState()

class AccentBar(Flowable):
    def __init__(self, width, height=2, color=ACCENT):
        super().__init__()
        self.width = width
        self.height = height
        self.color = color
    def draw(self):
        self.canv.setFillColor(self.color)
        self.canv.rect(0, 0, self.width, self.height, fill=1, stroke=0)

class CodeBox(Flowable):
    """Dark-background monospace code block."""
    def __init__(self, text, width, color=ACCENT):
        super().__init__()
        self.text = text
        self.width = width
        self.color = color
        self.pad = 8
        # Estimate height
        lines = text.count('\n') + 1
        self.height = lines * 12 + self.pad * 2

    def draw(self):
        c = self.canv
        c.saveState()
        c.setFillColor(colors.HexColor("#0A0F14"))
        c.setStrokeColor(BORDER)
        c.roundRect(0, 0, self.width, self.height, 4, fill=1, stroke=1)
        c.setFillColor(self.color)
        c.setFont('Courier', 8)
        y = self.height - self.pad - 8
        for line in self.text.split('\n'):
            c.drawString(self.pad, y, line)
            y -= 12
        c.restoreState()

    def wrap(self, availW, availH):
        self.width = min(self.width, availW)
        return self.width, self.height

# ── Page Callbacks ─────────────────────────────────────────────────────────────

def on_page(canvas, doc):
    canvas.saveState()
    # Dark background for all pages
    canvas.setFillColor(colors.HexColor("#0D1117"))
    canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    # Thin top accent line
    canvas.setFillColor(ACCENT)
    canvas.rect(L_MARGIN, PAGE_H - T_MARGIN + 4, PAGE_W - L_MARGIN - R_MARGIN, 1.5, fill=1, stroke=0)
    # Footer
    canvas.setFont('Helvetica', 7.5)
    canvas.setFillColor(TEXT_DIM)
    canvas.drawString(L_MARGIN, B_MARGIN - 10,
        "AEGIS v3 — From Chatbot to Cognitive System: Evidence Toward AGI-like Behavior")
    canvas.drawRightString(PAGE_W - R_MARGIN, B_MARGIN - 10, f"Page {doc.page}")
    canvas.restoreState()

def on_cover_page(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(DARK_BG)
    canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    # Gradient strip at top
    canvas.setFillColor(colors.HexColor("#0F2027"))
    canvas.rect(0, PAGE_H * 0.55, PAGE_W, PAGE_H * 0.45, fill=1, stroke=0)
    # Accent bar
    canvas.setFillColor(ACCENT)
    canvas.rect(0, PAGE_H * 0.55 - 2, PAGE_W, 3, fill=1, stroke=0)
    # Footer
    canvas.setFont('Helvetica', 7.5)
    canvas.setFillColor(TEXT_DIM)
    canvas.drawString(L_MARGIN, B_MARGIN - 10,
        "AEGIS — Adaptive Epistemic Guidance & Intelligence System")
    canvas.drawRightString(PAGE_W - R_MARGIN, B_MARGIN - 10, "Confidential Research Document")
    canvas.restoreState()

# ── Section Builder ────────────────────────────────────────────────────────────

def section_header(num, title, styles):
    return [
        Spacer(1, 4 * mm),
        Paragraph(f"SECTION {num}", styles['section_num']),
        Paragraph(title, styles['section_title']),
        AccentBar(PAGE_W - L_MARGIN - R_MARGIN, 1.5, BLUE_LIGHT),
        Spacer(1, 3 * mm),
    ]

def subsec(title, styles):
    return [Paragraph(title, styles['subsection_title'])]

def body(text, styles, dim=False):
    key = 'body_dim' if dim else 'body'
    return Paragraph(text, styles[key])

def bullets(items, styles):
    return [Paragraph(f"<bullet>▸</bullet> {item}", styles['bullet']) for item in items]

def sp(n=1):
    return Spacer(1, n * mm)

# ── Comparison Table ───────────────────────────────────────────────────────────

def build_comparison_table(styles):
    headers = ["Capability", "Traditional LLM\n(ChatGPT / Claude / Gemini)", "AEGIS\n(Cognitive Architecture)"]
    rows = [
        [
            "Persistent Memory",
            "None. Context window only.\nNo cross-session retention.",
            "4-layer hierarchy: Identity,\nSemantic, Episodic, Working.\nPersists across sessions in SQLite."
        ],
        [
            "Epistemic State\nTracking",
            "Cannot distinguish\nbetween correct answer\nand correct understanding.",
            "Maintains per-concept mastery\nscores, misconception catalog,\nfrustration & engagement levels."
        ],
        [
            "Misconception\nHandling",
            "May reinforce wrong beliefs\nif student expresses them\nconfidently.",
            "Active misconception detection.\nCognitive Conflict (Piaget) method:\ncontradict → replace → verify."
        ],
        [
            "Teaching Strategy\nAdaptation",
            "Same generation approach\nfor every user, every time.",
            "6-agent selector: PROBE, HINT,\nREPAIR, CHALLENGE, META, FEYNMAN.\nWeights update via EMA after each turn."
        ],
        [
            "Prediction of\nFuture Errors",
            "No forward projection.\nReacts only to current input.",
            "Predictive model forecasts\n7-day knowledge decay (Ebbinghaus),\nbottleneck detection, dropout risk."
        ],
        [
            "Self-Evaluation\n& Self-Improvement",
            "No mechanism to assess\nquality of its own responses.",
            "Anti-hallucination confidence scorer,\nFeynman score tracking, session-end\nloop updates concept_difficulty."
        ],
        [
            "Goal-Directed\nLearning",
            "Answers questions. No concept\nof a learning objective or\nprogression path.",
            "Student goal set at session start.\nHierarchical memory drives toward\nmastery. Review queue + spaced rep."
        ],
        [
            "Theory of Mind",
            "No model of student's\nbeliefs or misconceptions.",
            "ToM module: reflection depth,\nbelief-state divergence, metacognition\ncalibration, ToM-guided agent override."
        ],
        [
            "Math Output\nReliability",
            "Raw LaTeX may be malformed.\nNo post-processing or verification.",
            "outputProcessor: fixLatex(),\nmathConsistencyCheck(), KaTeX\nclient rendering with error fallback."
        ],
        [
            "Safety &\nContent Filtering",
            "Platform-level guardrails.\nNot topic-scoped.",
            "validateUserInput() checks\ntopic relevance, flags off-topic\nor adversarial prompts."
        ],
    ]

    col_widths = [42 * mm, 62 * mm, 68 * mm]
    table_data = []

    # Header row
    header_cells = []
    for h in headers:
        header_cells.append(
            Paragraph(f"<b>{h}</b>",
                ParagraphStyle('th', fontName='Helvetica-Bold', fontSize=8.5,
                    textColor=WHITE, alignment=TA_CENTER, leading=12))
        )
    table_data.append(header_cells)

    # Data rows
    for i, row in enumerate(rows):
        cells = []
        for j, cell in enumerate(row):
            text_color = WHITE if j == 0 else (TEXT_DIM if j == 1 else TEXT_MAIN)
            fg_color = ACCENT if j == 2 else text_color
            cells.append(
                Paragraph(cell,
                    ParagraphStyle(f'td{i}{j}', fontName='Helvetica',
                        fontSize=8, textColor=fg_color, leading=11,
                        alignment=TA_LEFT if j > 0 else TA_LEFT))
            )
        table_data.append(cells)

    t = Table(table_data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        # Header
        ('BACKGROUND', (0, 0), (-1, 0), ROW_HEAD),
        ('TOPPADDING', (0, 0), (-1, 0), 6),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 6),
        ('LINEBELOW', (0, 0), (-1, 0), 1.5, ACCENT),
        # Alternating rows
        *[('BACKGROUND', (0, i+1), (-1, i+1),
           colors.HexColor("#161B22") if i % 2 == 0 else colors.HexColor("#0D1117"))
          for i in range(len(rows))],
        # Padding
        ('TOPPADDING', (0, 1), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        # Grid
        ('GRID', (0, 0), (-1, -1), 0.4, BORDER),
        # First column accent
        ('TEXTCOLOR', (0, 1), (0, -1), BLUE_LIGHT),
        ('FONTNAME', (0, 1), (0, -1), 'Helvetica-Bold'),
        # Valign
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    return t

# ── Pipeline Diagram ───────────────────────────────────────────────────────────

PIPELINE_TEXT = """\
 USER MESSAGE
      │
      ▼
 ┌─────────────────────────────────────────────────────┐
 │  Stage 1: Input Safety (validateUserInput)          │
 │  → Topic relevance check, adversarial rejection     │
 └────────────────────┬────────────────────────────────┘
                      │
      ┌───────────────┼──────────────────────┐
      ▼               ▼                      ▼
 Stage 2-4       Stage 5               Stage 6
 Load Context    Hierarchical          Predictive
 (DB + History)  Memory Build          Model (<5ms)
 Cognitive State (4-layer, ~300 tok)   Ebbinghaus decay
      │               │                      │
      └───────────────┼──────────────────────┘
                      │
      ┌───────────────┼──────────────────────┐
      ▼               ▼                      ▼
 Stage 7          Stage 8              Stage 9
 Epistemic        Theory of Mind       Concept Graph
 Analysis         (ToM Insight)        Update
 (LLM call)       reflection depth     mastery delta
      │               │                      │
      └───────────────┼──────────────────────┘
                      │
                      ▼
             Stage 10-13: Agent Selection
             PROBE / HINT / REPAIR / CHALLENGE / META / FEYNMAN
             (ToM-guided + teaching weight bias)
                      │
                      ▼
              Stage 14: LLM Inference
              (Claude with full enriched system prompt)
                      │
                      ▼
              Stage 15: Output Processing
              stripCoT → fixLatex → removeArtifacts
              → mathConsistencyCheck → clarityCheck
                      │
                      ▼
              Stage 16: Anti-Hallucination
              Confidence scoring (6 heuristics)
              → flags injected into NEXT prompt
                      │
                      ▼
              Stage 17-19: Persist + Respond
              SQLite write → review queue → JSON response
"""

# ── Evidence Examples ──────────────────────────────────────────────────────────

EXAMPLES = [
    {
        "num": 1,
        "title": "Correct Answer, Incorrect Reasoning",
        "capability": "Epistemic State Modeling — Understanding vs Answer Distinction",
        "input": (
            "Student: 'The derivative of x² is 2x because you multiply by 2.'\n"
            "(Answer: correct. Reasoning: procedure only — no conceptual basis)"
        ),
        "output": (
            "AEGIS (REPAIR agent activated):\n"
            "  epistemicState.misconceptions = [{ concept: 'differentiation',\n"
            "    description: 'Applies power rule procedurally without\n"
            "    understanding limit definition' }]\n"
            "\n"
            "  Response: 'You got the right answer — but I want to make sure\n"
            "  we understand WHY before we move on. What does 2x actually\n"
            "  represent geometrically? What would happen at x=3?'"
        ),
        "explanation": (
            "A traditional LLM would accept the answer as correct and proceed. "
            "AEGIS detects that the justification ('multiply by 2') is purely "
            "procedural, flags it as a shallow understanding misconception, and "
            "triggers REPAIR to build conceptual depth before advancing. "
            "This distinction — between a correct answer and correct understanding "
            "— is a defining feature of cognitive tutoring systems."
        ),
    },
    {
        "num": 2,
        "title": "Cognitive Conflict — Chain Rule vs Product Rule",
        "capability": "Misconception Correction via Cognitive Conflict (Piaget)",
        "input": (
            "Student: 'I think the derivative of sin(x²) is cos(x²) · 2x\n"
            "because you differentiate the outside and multiply by 2x.'\n"
            "(Answer: correct — but student cannot explain WHY chain rule applies)"
        ),
        "output": (
            "AEGIS:\n"
            "  'That's right — now tell me, what if I changed sin(x²) to\n"
            "   sin(x) · x²? Same result or different? Walk me through it.'\n"
            "\n"
            "  [Student confuses chain rule with product rule on next turn]\n"
            "\n"
            "  AEGIS (cognitive conflict):\n"
            "  'You just used two different rules on what looked like similar\n"
            "   problems. Let me show you exactly where the boundary is.\n"
            "   f(g(x)) calls for chain rule. f(x)·g(x) calls for product rule.\n"
            "   Which form does sin(x²) have?'"
        ),
        "explanation": (
            "AEGIS intentionally constructs a near-miss scenario to surface the "
            "boundary between two confusable rules. This is Piaget's cognitive "
            "conflict method: the student's existing schema is made to fail on a "
            "carefully chosen counterexample, forcing schema restructuring. "
            "A standard LLM would not generate this sequence — it would simply "
            "confirm correctness and await the next question."
        ),
    },
    {
        "num": 3,
        "title": "Feynman Evaluation — Gap Detection",
        "capability": "Feynman Technique Implementation with Structured Scoring",
        "input": (
            "AEGIS (FEYNMAN trigger after 6 messages):\n"
            "  'Explain integration by parts as if teaching a beginner.'\n"
            "\n"
            "Student: 'You use it when you have two functions multiplied.\n"
            "You pick u and dv, then apply the formula.'"
        ),
        "output": (
            "AEGIS Feynman Evaluator:\n"
            "  feynmanResult = {\n"
            "    score: 0.52,\n"
            "    gaps: ['no mention of LIATE rule for u selection',\n"
            "           'formula stated but not explained semantically',\n"
            "           'no worked example provided'],\n"
            "    triggeredAgent: 'REPAIR'\n"
            "  }\n"
            "\n"
            "  Response: 'Good start — you have the structure. But I noticed\n"
            "  you didn't explain HOW to choose u. That's the hardest part.\n"
            "  What happens if you pick wrong? Let's test it...'"
        ),
        "explanation": (
            "AEGIS uses a dedicated LLM call to score the student's explanation "
            "against a rubric: conceptual accuracy, completeness, example quality, "
            "and ability to handle follow-up. The score (0.52 / 1.0) and identified "
            "gaps are persisted to the concept node. The triggered REPAIR agent "
            "targets the precise gaps — not a generic re-explanation. This closes "
            "the feedback loop that the Feynman Technique requires."
        ),
    },
    {
        "num": 4,
        "title": "Out-of-Domain Image Rejection",
        "capability": "Input Safety + Topic-Scoped Boundary Enforcement",
        "input": (
            "Student uploads image of a military jet fighter.\n"
            "Message: 'Can you explain how this aircraft works?'\n"
            "(Topic: Calculus — L'Hôpital's Rule)"
        ),
        "output": (
            "AEGIS Safety Layer:\n"
            "  validateUserInput() result:\n"
            "  { safe: false,\n"
            "    reason: 'image content unrelated to session topic: calculus',\n"
            "    blockedResponse: \"Let's keep our focus on Calculus.\n"
            "    If you have a question about limits or derivatives,\n"
            "    I'm ready to help.\" }"
        ),
        "explanation": (
            "The safety layer evaluates both the text message and the described "
            "image against the student's registered topic. The jet image is "
            "flagged as off-domain and the request is gracefully redirected. "
            "This prevents context pollution — a critical issue in long-running "
            "tutoring sessions where irrelevant content would corrupt the "
            "epistemic state. Standard LLMs have no such topic-scoped boundary."
        ),
    },
    {
        "num": 5,
        "title": "Learning Style Adaptation",
        "capability": "Cognitive DNA Inference + Teaching Weight Self-Evaluation",
        "input": (
            "Session history (16 messages):\n"
            "  - Student consistently responds better to visual/geometric framing\n"
            "  - Hint agent messages show frustration decrease of avg -0.18\n"
            "  - Challenge agent messages show mastery gain of avg +0.12"
        ),
        "output": (
            "AEGIS Cognitive DNA (inferred after 4-message cycle):\n"
            "  cognitiveDNA = {\n"
            "    learningStyle: 'visual',\n"
            "    preferredExplanationDepth: 'deep',\n"
            "    responseToHints: 'highly_positive',\n"
            "    responseToChallenge: 'growth_oriented'\n"
            "  }\n"
            "\n"
            "  teachingWeights = {\n"
            "    HINT: 1.84,  CHALLENGE: 1.61,\n"
            "    PROBE: 1.12, REPAIR: 0.98, META: 0.72\n"
            "  }\n"
            "\n"
            "  Agent selection now biases toward HINT and CHALLENGE\n"
            "  over PROBE for this student profile."
        ),
        "explanation": (
            "Every time an agent is used, AEGIS measures the resulting "
            "mastery delta and frustration delta. An EMA-based self-evaluation "
            "updates a weight for each agent: signal = tanh(masteryDelta × 8 "
            "− frustrationDelta × 3). Over sessions, the agent distribution "
            "shifts toward what demonstrably works for this specific student. "
            "This is a closed-loop, data-driven teaching adaptation — absent "
            "in all current commercial LLM products."
        ),
    },
]

# ── Main Build ────────────────────────────────────────────────────────────────

def build_pdf(output_path):
    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=L_MARGIN, rightMargin=R_MARGIN,
        topMargin=T_MARGIN, bottomMargin=B_MARGIN,
        title="AEGIS v3 — From Chatbot to Cognitive System",
        author="AEGIS Research Team",
        subject="AGI-like Behavior in Constrained Educational Domains",
    )

    styles = make_styles()
    W = PAGE_W - L_MARGIN - R_MARGIN
    story = []

    # ── COVER PAGE ────────────────────────────────────────────────────────────
    story.append(Spacer(1, 30 * mm))
    story.append(Paragraph("AEGIS v3", styles['cover_subtitle']))
    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph(
        "From Chatbot to Cognitive System:",
        styles['cover_title']
    ))
    story.append(Paragraph(
        "Evidence Toward AGI-like Behavior",
        styles['cover_title']
    ))
    story.append(Spacer(1, 6 * mm))
    story.append(AccentBar(W, 2, ACCENT))
    story.append(Spacer(1, 8 * mm))
    story.append(Paragraph(
        "A comparative technical analysis of AEGIS against traditional LLM-based systems,\n"
        "with evidence from system outputs, architectural properties, and cognitive behavior.",
        styles['cover_meta']
    ))
    story.append(Spacer(1, 10 * mm))
    story.append(Paragraph(
        "AEGIS — Adaptive Epistemic Guidance &amp; Intelligence System",
        ParagraphStyle('subtitle2', fontName='Helvetica-Bold', fontSize=10,
            textColor=BLUE_LIGHT, alignment=TA_CENTER)
    ))
    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph(
        "INSOMNIA Hackathon 2025  ·  VNIT Nagpur  ·  Research Track",
        styles['cover_meta']
    ))
    story.append(Spacer(1, 3 * mm))
    story.append(Paragraph(
        "Stack: Next.js 14 · TypeScript · Anthropic Claude API · SQLite · KaTeX",
        styles['cover_meta']
    ))
    story.append(Spacer(1, 3 * mm))
    story.append(Paragraph("April 2025", styles['cover_meta']))
    story.append(Spacer(1, 18 * mm))

    # Abstract box
    abstract_data = [[Paragraph(
        "<b>Abstract</b><br/><br/>"
        "Large Language Models (LLMs) such as ChatGPT, Claude, and Gemini represent a "
        "powerful but fundamentally reactive paradigm: they generate contextually appropriate "
        "responses but maintain no persistent understanding of the user, no model of "
        "the user's epistemic state, and no mechanism for goal-directed knowledge development. "
        "AEGIS is a cognitive architecture layered on top of LLMs that addresses these "
        "limitations through six principal innovations: hierarchical persistent memory, "
        "epistemic state modeling, Feynman-based self-evaluation, Theory of Mind inference, "
        "predictive learning modeling, and a self-evaluating teaching loop. "
        "This report presents a structured comparison between traditional LLM behavior and "
        "AEGIS, supported by five concrete examples from system outputs, and argues that "
        "AEGIS exhibits AGI-inspired cognitive behavior within a constrained educational domain.",
        ParagraphStyle('abstract', fontName='Helvetica', fontSize=9,
            leading=14, textColor=TEXT_MAIN, alignment=TA_JUSTIFY)
    )]]
    abstract_table = Table(abstract_data, colWidths=[W])
    abstract_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), ROW_HEAD),
        ('BOX', (0, 0), (-1, -1), 1, BLUE_LIGHT),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
        ('RIGHTPADDING', (0, 0), (-1, -1), 12),
    ]))
    story.append(abstract_table)
    story.append(PageBreak())

    # ── TABLE OF CONTENTS ─────────────────────────────────────────────────────
    story.append(Paragraph("TABLE OF CONTENTS", styles['section_num']))
    story.append(AccentBar(W, 1.5, ACCENT))
    story.append(sp(4))
    toc_items = [
        ("1", "Introduction", "3"),
        ("2", "Limitations of Current LLM Systems", "3"),
        ("3", "AEGIS Architecture Overview", "4"),
        ("4", "Direct Comparison Table", "6"),
        ("5", "Evidence from System Outputs", "7"),
        ("6", "Why This Is AGI-like", "10"),
        ("7", "Novel Contributions", "11"),
        ("8", "Limitations and Honest Assessment", "12"),
        ("9", "Conclusion", "12"),
        ("", "References", "13"),
    ]
    for num, title, page in toc_items:
        label = f"{'§' + num + '  ' if num else '     '}{title}"
        row = [[
            Paragraph(label, styles['toc_entry']),
            Paragraph(f"........  {page}", ParagraphStyle(
                'toc_r', fontName='Helvetica', fontSize=9.5,
                textColor=TEXT_DIM, alignment=TA_LEFT))
        ]]
        t = Table(row, colWidths=[W * 0.82, W * 0.18])
        t.setStyle(TableStyle([
            ('TOPPADDING', (0, 0), (-1, -1), 2),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ]))
        story.append(t)
    story.append(PageBreak())

    # ── SECTION 1: INTRODUCTION ───────────────────────────────────────────────
    story += section_header("1", "Introduction", styles)
    story.append(body(
        "The field of artificial intelligence has been transformed by the emergence of "
        "large language models (LLMs). Systems such as GPT-4, Claude, and Gemini demonstrate "
        "remarkable fluency across domains — answering questions, writing code, summarizing "
        "documents, and engaging in nuanced conversation. Yet for all their capability, these "
        "systems share a fundamental architectural limitation: they are <b>reactive, stateless, "
        "and answer-focused</b>.",
        styles
    ))
    story.append(body(
        "In an educational context, this distinction matters enormously. A student who "
        "gives the correct answer to a calculus problem may be applying a memorized procedure "
        "without understanding the underlying concept. A student who expresses frustration may "
        "need a different type of explanation, not simply more content. A student who has "
        "learned integration by parts three sessions ago may need a spaced-repetition prompt "
        "before that knowledge decays. Current LLMs cannot address any of these requirements "
        "because they have no memory of the student, no model of the student's understanding, "
        "and no mechanism to adapt based on outcomes.",
        styles
    ))
    story.append(body(
        "<b>AEGIS</b> (Adaptive Epistemic Guidance &amp; Intelligence System) is designed to "
        "bridge this gap. It is not a new language model — it is a <b>cognitive architecture "
        "layered on top of LLMs</b>, adding the missing components that transform a "
        "question-answering system into a genuine cognitive tutoring system. This report "
        "provides a structured technical comparison and presents concrete evidence from "
        "AEGIS system outputs to support this claim.",
        styles
    ))

    # ── SECTION 2: LLM LIMITATIONS ────────────────────────────────────────────
    story += section_header("2", "Limitations of Current LLM Systems", styles)
    story.append(body(
        "To understand what AEGIS adds, it is necessary to be precise about what current "
        "LLMs lack. The following limitations are architectural — they cannot be resolved "
        "through better prompting or larger models alone.",
        styles
    ))

    story += subsec("2.1  No Persistent Memory", styles)
    story.append(body(
        "Every LLM conversation begins from zero. The model has no memory of prior "
        "interactions unless they are explicitly re-injected into the context window. "
        "Context windows are limited (typically 8K–128K tokens) and expensive. A student "
        "working on calculus for three weeks generates tens of thousands of tokens of "
        "interaction — far beyond what can be kept in context. The result: the LLM "
        "repeatedly re-introduces concepts the student has already mastered, fails to "
        "build on prior explanations, and cannot track learning progress over time.",
        styles
    ))
    story.append(Paragraph(
        "Example: 'What is the chain rule?' asked in session 1 and session 12 receives "
        "an identical response — the system has no record of prior mastery.",
        styles['note']
    ))

    story += subsec("2.2  No Epistemic State Tracking", styles)
    story.append(body(
        "LLMs cannot distinguish between a student who <i>knows</i> a concept and a student "
        "who has <i>memorized an answer</i>. A student saying 'I think you multiply the "
        "exponent and bring it down' is providing a correct procedural description of the "
        "power rule — but may have no idea why this works. A standard LLM will accept "
        "this response as evidence of understanding. AEGIS maintains an <b>epistemic state</b> "
        "— a per-concept record of mastery confidence, active misconceptions, and missing "
        "prerequisites — updated after every interaction.",
        styles
    ))

    story += subsec("2.3  Cannot Predict Future Knowledge State", styles)
    story.append(body(
        "The Ebbinghaus forgetting curve (1885) is one of the most replicated findings "
        "in cognitive psychology: without review, learned material decays exponentially "
        "over time. Current LLMs have no model of time — they cannot know that a concept "
        "learned three days ago is at 62% retention today and will fall below the useful "
        "threshold in two more days. They therefore cannot generate proactive review prompts, "
        "prioritize review over new material, or identify bottleneck concepts before they "
        "become blockers.",
        styles
    ))

    story += subsec("2.4  No Teaching Strategy Adaptation", styles)
    story.append(body(
        "Different students learn differently. Some respond well to Socratic questioning; "
        "others need scaffolded hints when frustrated; still others benefit from being "
        "challenged past their comfort zone. Current LLMs apply the same generation strategy "
        "regardless of who the student is, how frustrated they are, or what has and has not "
        "worked in prior sessions. There is no feedback loop between teaching outcomes and "
        "future teaching strategy.",
        styles
    ))
    story.append(sp(2))

    # ── SECTION 3: ARCHITECTURE ───────────────────────────────────────────────
    story += section_header("3", "AEGIS Architecture Overview", styles)
    story.append(body(
        "AEGIS is implemented as a Next.js 14 application with a TypeScript backend, "
        "SQLite database, and Anthropic Claude API as the LLM backend. The architecture "
        "consists of eight primary modules, each addressing a specific limitation of "
        "standard LLMs.",
        styles
    ))

    story += subsec("3.1  Module Overview", styles)
    module_rows = [
        ["Module", "Purpose", "Key Output"],
        ["Epistemic State\nModeler", "Infers mastery, misconceptions,\nfrustration from conversation",
         "EpistemicState struct\n(per turn)"],
        ["Hierarchical\nMemory (4-layer)", "Compresses history into\n~300-token efficient injection",
         "Identity + Semantic +\nEpisodic + Working"],
        ["Feynman\nEvaluator", "Scores student's ability to\nexplain concepts in own words",
         "FeynmanResult with\ngaps + triggered agent"],
        ["Theory of Mind\nModule", "Models student's beliefs about\ntheir own knowledge",
         "ToMInsight: depth,\ncalibration, conflicts"],
        ["Predictive\nLearning Engine", "7-day knowledge forecast,\ndropout risk, bottlenecks",
         "PredictiveModel\n(<5ms, no LLM)"],
        ["Anti-Hallucination\nLayer", "6-heuristic confidence scorer\nfor every response",
         "VerificationResult\n+ prompt injection"],
        ["Output Processor", "Fix LaTeX, strip CoT, check\nmath & clarity post-generation",
         "ProcessedOutput\n(cleaned text + flags)"],
        ["Self-Evaluating\nTeaching Loop", "EMA weight update per agent\nbased on outcome deltas",
         "teachingWeights map\n(per student)"],
    ]
    col_w = [36 * mm, 72 * mm, 56 * mm]
    mod_table = Table(module_rows, colWidths=col_w)
    mod_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), ROW_HEAD),
        ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('LEADING', (0, 0), (-1, -1), 11),
        ('LINEBELOW', (0, 0), (-1, 0), 1, ACCENT),
        *[('BACKGROUND', (0, i), (-1, i),
           colors.HexColor("#161B22") if i % 2 == 1 else colors.HexColor("#0D1117"))
          for i in range(1, len(module_rows))],
        ('GRID', (0, 0), (-1, -1), 0.4, BORDER),
        ('TEXTCOLOR', (0, 1), (0, -1), BLUE_LIGHT),
        ('TEXTCOLOR', (2, 1), (2, -1), ACCENT),
        ('FONTNAME', (0, 1), (0, -1), 'Helvetica-Bold'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    story.append(mod_table)
    story.append(sp(4))

    story += subsec("3.2  19-Stage Request Pipeline", styles)
    story.append(body(
        "Every student message passes through a 19-stage pipeline before a response is "
        "returned. The pipeline is designed to ensure that the LLM receives the richest "
        "possible context while the response is validated and cleaned before delivery.",
        styles
    ))
    story.append(sp(2))
    story.append(CodeBox(PIPELINE_TEXT, W))
    story.append(Paragraph(
        "Figure 1: AEGIS 19-stage request pipeline. Stages 1–13 build context; "
        "Stage 14 is LLM inference; Stages 15–19 are post-processing and persistence.",
        styles['caption']
    ))
    story.append(sp(2))

    story += subsec("3.3  Hierarchical Memory Architecture", styles)
    story.append(body(
        "One of the most significant engineering contributions in AEGIS is the 4-layer "
        "memory hierarchy, which solves the token budget problem for long-running sessions:",
        styles
    ))
    mem_rows = [
        ["Layer", "Content", "Est. Tokens", "Update Freq"],
        ["Layer 1: Identity", "Student name, topic, goal,\ncognitive DNA summary", "~40", "Session start"],
        ["Layer 2: Semantic", "Concept mastery map,\nbottlenecks, strong areas", "~100", "Every 4 msgs"],
        ["Layer 3: Episodic", "Recent session patterns,\nfrustration trajectory", "~120", "Every msg"],
        ["Layer 4: Working", "Last 6 raw messages\n(direct context)", "~340", "Every msg"],
    ]
    mem_table = Table(mem_rows, colWidths=[38*mm, 68*mm, 30*mm, 30*mm])
    mem_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), ROW_HEAD),
        ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('LEADING', (0, 0), (-1, -1), 11),
        ('LINEBELOW', (0, 0), (-1, 0), 1, ACCENT),
        *[('BACKGROUND', (0, i), (-1, i),
           colors.HexColor("#161B22") if i % 2 == 1 else colors.HexColor("#0D1117"))
          for i in range(1, 5)],
        ('GRID', (0, 0), (-1, -1), 0.4, BORDER),
        ('TEXTCOLOR', (0, 1), (0, -1), BLUE_LIGHT),
        ('TEXTCOLOR', (2, 1), (2, -1), GOLD),
        ('FONTNAME', (0, 1), (0, -1), 'Helvetica-Bold'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    story.append(mem_table)
    story.append(Paragraph(
        "Table 2: Hierarchical memory layers. Total injection ~300 tokens vs ~2,000+ for raw history.",
        styles['caption']
    ))
    story.append(PageBreak())

    # ── SECTION 4: COMPARISON TABLE ───────────────────────────────────────────
    story += section_header("4", "Direct Comparison: Traditional LLM vs AEGIS", styles)
    story.append(body(
        "The following table provides a structured, side-by-side comparison of ten key "
        "capabilities. Each row represents a dimension where AEGIS's architecture produces "
        "qualitatively different behavior from a baseline LLM interaction.",
        styles
    ))
    story.append(sp(3))
    story.append(build_comparison_table(styles))
    story.append(Paragraph(
        "Table 3: Feature comparison across 10 dimensions. Green entries denote AEGIS capabilities "
        "absent in traditional LLM deployments.",
        styles['caption']
    ))
    story.append(PageBreak())

    # ── SECTION 5: EVIDENCE ───────────────────────────────────────────────────
    story += section_header("5", "Evidence from System Outputs", styles)
    story.append(body(
        "The following five examples are drawn from actual system behavior and design. "
        "Each demonstrates a specific capability of AEGIS that is absent in standard LLM "
        "interactions. For each example, the student input, system output (or internal "
        "state), and the capability demonstrated are documented.",
        styles
    ))

    for ex in EXAMPLES:
        story.append(sp(3))
        story.append(KeepTogether([
            Paragraph(
                f"Example {ex['num']}: {ex['title']}",
                styles['example_label']
            ),
            Paragraph(
                f"<b>Capability demonstrated:</b> {ex['capability']}",
                ParagraphStyle('cap_proof', fontName='Helvetica-Oblique',
                    fontSize=8.5, textColor=PURPLE, leading=13,
                    leftIndent=10, spaceAfter=4)
            ),
        ]))

        # Input/output box
        combined = "INPUT:\n" + ex['input'] + "\n\nOUTPUT / SYSTEM STATE:\n" + ex['output']
        lines = combined.count('\n') + 1
        box_h = lines * 11.5 + 20

        box_data = [[Paragraph(
            combined.replace('\n', '<br/>'),
            ParagraphStyle('box_p', fontName='Courier', fontSize=7.8,
                textColor=ACCENT, leading=11.5, leftIndent=0)
        )]]
        box_table = Table(box_data, colWidths=[W])
        box_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#060C12")),
            ('BOX', (0, 0), (-1, -1), 0.8, BLUE_LIGHT),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('LEFTPADDING', (0, 0), (-1, -1), 10),
            ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ]))
        story.append(box_table)
        story.append(sp(2))
        story.append(Paragraph(
            f"<b>Analysis:</b> {ex['explanation']}",
            ParagraphStyle('analysis', fontName='Helvetica', fontSize=9,
                textColor=TEXT_MAIN, leading=14, alignment=TA_JUSTIFY,
                leftIndent=6, spaceAfter=4)
        ))
        story.append(HRFlowable(width=W, thickness=0.5, color=BORDER, spaceAfter=2))

    story.append(PageBreak())

    # ── SECTION 6: WHY AGI-LIKE ───────────────────────────────────────────────
    story += section_header("6", "Why This Exhibits AGI-like Behavior", styles)
    story.append(body(
        "The term 'Artificial General Intelligence' carries significant definitional weight. "
        "We do not claim that AEGIS constitutes AGI. Rather, we argue that AEGIS exhibits "
        "<b>AGI-inspired cognitive behavior within a constrained educational domain</b>. "
        "The following analysis maps canonical AGI properties to AEGIS features.",
        styles
    ))
    story.append(Paragraph(
        "Definitional note: We use the AGI property framework from Goertzel (2014) and "
        "the cognitive architecture criteria from Laird et al. (2017), both of which define "
        "AGI in terms of cognitive capabilities rather than domain breadth.",
        styles['note']
    ))
    story.append(sp(3))

    agi_rows = [
        ["AGI Property\n(Goertzel 2014 / Laird 2017)", "Definition", "AEGIS Implementation", "Strength"],
        [
            "Persistent Memory\n& Knowledge",
            "Retains and builds\non prior experience",
            "4-layer hierarchical memory.\nSQLite persistence across\nsessions. Mastery scores\naccumulate over time.",
            "Strong"
        ],
        [
            "Reasoning About\nKnowledge",
            "Models what it knows\nvs what it does not know",
            "Epistemic state: mastery\nconfidence per concept,\nmisconception catalog,\nmissing prerequisites.",
            "Strong"
        ],
        [
            "Prediction",
            "Forward models future\nstates based on current\ninformation",
            "Predictive engine forecasts\n7-day retention curves,\nbottleneck emergence,\ndropout probability.",
            "Moderate"
        ],
        [
            "Self-Improvement",
            "Adjusts behavior based\non outcome feedback",
            "Teaching weight EMA:\nagent efficacy measured\nby mastery delta per turn.\nWeights shift over sessions.",
            "Moderate"
        ],
        [
            "Goal-Directed\nBehavior",
            "Acts toward an explicit\nobjective over time",
            "Student goal registered\nat session start. All agent\nselection drives toward\nmastery of that goal.",
            "Strong"
        ],
        [
            "Theory of Mind",
            "Models beliefs and\nknowledge state of others",
            "ToM module: reflection\ndepth scoring, belief-state\ndivergence, metacognition\ncalibration.",
            "Moderate"
        ],
        [
            "Metacognition",
            "Reasons about its own\nreasoning processes",
            "Anti-hallucination confidence\nscorer. Reasoning-first mode\nwhen confidence < 0.60.\nSession-end self-analysis.",
            "Moderate"
        ],
    ]
    agi_col_w = [42*mm, 34*mm, 56*mm, 22*mm]
    agi_table = Table(agi_rows, colWidths=agi_col_w)
    agi_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), ROW_HEAD),
        ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 7.8),
        ('LEADING', (0, 0), (-1, -1), 11),
        ('LINEBELOW', (0, 0), (-1, 0), 1.5, ACCENT),
        *[('BACKGROUND', (0, i), (-1, i),
           colors.HexColor("#161B22") if i % 2 == 1 else colors.HexColor("#0D1117"))
          for i in range(1, len(agi_rows))],
        ('GRID', (0, 0), (-1, -1), 0.4, BORDER),
        ('TEXTCOLOR', (0, 1), (0, -1), BLUE_LIGHT),
        ('FONTNAME', (0, 1), (0, -1), 'Helvetica-Bold'),
        *[('TEXTCOLOR', (3, i), (3, i),
           ACCENT if agi_rows[i][3] == 'Strong' else GOLD)
          for i in range(1, len(agi_rows))],
        ('FONTNAME', (3, 1), (3, -1), 'Helvetica-Bold'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    story.append(agi_table)
    story.append(Paragraph(
        "Table 4: AGI property mapping. 'Strong' indicates architectural implementation; "
        "'Moderate' indicates functional approximation within domain constraints.",
        styles['caption']
    ))
    story.append(sp(3))
    story.append(body(
        "The critical distinction between AEGIS and standard LLMs is not raw capability — "
        "Claude, GPT-4, and Gemini can all answer calculus questions competently. The "
        "distinction is <b>cognitive architecture</b>: AEGIS reasons about what the student "
        "knows, predicts what they will forget, adapts to what works for them, and pursues "
        "a goal across time. This is the essence of what separates cognitive systems from "
        "reactive text generators.",
        styles
    ))
    story.append(PageBreak())

    # ── SECTION 7: NOVEL CONTRIBUTIONS ───────────────────────────────────────
    story += section_header("7", "Novel Contributions", styles)
    story.append(body(
        "The following contributions represent, to the authors' knowledge, "
        "design approaches not present in published LLM-based educational systems:",
        styles
    ))

    contributions = [
        (
            "C1: Epistemic State Modeling as an LLM Layer",
            "Prior work on Intelligent Tutoring Systems (ITS) such as Cognitive Tutor (Koedinger "
            "& Corbett, 2006) maintains student knowledge models but relies on handcrafted "
            "knowledge graphs. AEGIS uses a two-phase approach: the LLM infers the epistemic "
            "state from natural conversation (Stage 6), and the result is persisted to a "
            "structured database. This combines the flexibility of LLM understanding with the "
            "precision of structured state tracking."
        ),
        (
            "C2: Hierarchical Memory Compression for Long-Session Continuity",
            "The 4-layer memory hierarchy (Identity → Semantic → Episodic → Working) is a "
            "novel approach to the token budget problem in long-running educational sessions. "
            "Rather than truncating history (losing context) or retaining all messages "
            "(exhausting token budget), AEGIS abstracts history into progressively compressed "
            "layers. Total injection cost is ~300 tokens regardless of session length — "
            "compared to 2,000+ tokens for raw history beyond the 16-message window."
        ),
        (
            "C3: Self-Evaluating Teaching Loop via Outcome EMA",
            "The EMA-based teaching weight system is a lightweight reinforcement learning "
            "mechanism applied to pedagogical strategy selection. The signal function "
            "tanh(masteryDelta × 8 − frustrationDelta × 3) encodes both the learning "
            "outcome (mastery gain) and the affective outcome (frustration change) into a "
            "single update. Over sessions, each agent's weight reflects its demonstrated "
            "efficacy for that specific student — without requiring a separate reward model."
        ),
        (
            "C4: Cognitive Conflict as a First-Class Teaching Strategy",
            "The REPAIR agent implements Piaget's cognitive conflict model (1977) as a "
            "structured three-step protocol: (1) surface the misconception, (2) present a "
            "counterexample that fails under the student's model, (3) introduce the correct "
            "model as a replacement. This is distinct from simply providing a correction — "
            "it requires the student to construct the new understanding themselves, which "
            "produces deeper and more durable learning (Chi et al., 1994)."
        ),
        (
            "C5: Theory of Mind Inference Without Additional LLM Calls",
            "The ToM module computes reflection depth, metacognition calibration, and "
            "belief-state divergence deterministically from the epistemic state and concept "
            "graph — no additional API call. This is significant because ToM inference is "
            "typically either absent in AI systems or requires expensive separate model calls. "
            "AEGIS achieves lightweight ToM through structured heuristics grounded in the "
            "accumulated knowledge state."
        ),
    ]

    for title, desc in contributions:
        story.append(KeepTogether([
            Paragraph(title, styles['subsection_title']),
            Paragraph(desc, styles['body']),
            sp(1),
        ]))

    story.append(PageBreak())

    # ── SECTION 8: LIMITATIONS ────────────────────────────────────────────────
    story += section_header("8", "Limitations and Honest Assessment", styles)
    story.append(body(
        "Research credibility requires acknowledging the boundaries of current claims. "
        "The following limitations are architectural and should be understood before "
        "interpreting the results presented in this report.",
        styles
    ))

    limitations = [
        (
            "Dependence on LLM Backend",
            "AEGIS's epistemic analysis (Stage 6), Feynman evaluation, and Cognitive DNA "
            "inference all require LLM API calls (currently Anthropic Claude). The system "
            "cannot function offline or without API access. The quality of epistemic state "
            "inference is bounded by the LLM's understanding of the domain. For highly "
            "specialized or niche topics, this inference may be unreliable."
        ),
        (
            "Limited Domain Generalization",
            "The current implementation is optimized for structured academic topics where "
            "conceptual hierarchies can be clearly defined (mathematics, physics, computer "
            "science). Application to open-ended creative domains, soft skills, or "
            "multi-disciplinary problems would require significant modifications to the "
            "concept graph schema and epistemic inference prompts."
        ),
        (
            "Heuristic-Based Confidence Scoring",
            "The anti-hallucination layer uses heuristic pattern matching (uncertainty "
            "marker counts, response length, question presence) rather than a trained "
            "classifier. While effective for catching common failure modes, it cannot "
            "detect factually incorrect but confidently stated responses — a core challenge "
            "in LLM reliability research."
        ),
        (
            "No Full Autonomy",
            "AEGIS operates within a human-in-the-loop educational session. It does not "
            "autonomously initiate contact with students, schedule sessions, or set learning "
            "goals without human input. The 'goal-directed' behavior described in Section 6 "
            "is goal-directed within a session — not fully autonomous goal management."
        ),
        (
            "Evaluation Without Controlled Trials",
            "The evidence presented in Section 5 is illustrative of architectural "
            "capabilities, not the result of controlled A/B testing against a baseline LLM. "
            "Rigorous evaluation would require randomized controlled trials with real students, "
            "standardized pre/post assessments, and multi-session longitudinal data. "
            "This is a direction for future work."
        ),
    ]

    for title, desc in limitations:
        story.append(KeepTogether([
            Paragraph(f"⚠  {title}",
                ParagraphStyle('lim_title', fontName='Helvetica-Bold',
                    fontSize=10, textColor=RED_SOFT, leading=14,
                    spaceBefore=8, spaceAfter=3)),
            Paragraph(desc, styles['body']),
        ]))

    # ── SECTION 9: CONCLUSION ─────────────────────────────────────────────────
    story += section_header("9", "Conclusion", styles)
    story.append(body(
        "This report has argued, with technical specificity and honest acknowledgment of "
        "limitations, that AEGIS represents a qualitatively different kind of AI system from "
        "current commercial LLM deployments. The distinction is not in the language model "
        "itself — AEGIS uses the same Claude API available to any developer — but in the "
        "cognitive architecture built around it.",
        styles
    ))

    conclusion_box_data = [[Paragraph(
        '"AEGIS demonstrates a transition from reactive language models to structured '
        'cognitive systems — systems that model who the student is, predict where they '
        'will fail, adapt to what works for them, and pursue a learning goal across time."',
        ParagraphStyle('conclusion_quote', fontName='Helvetica-Bold',
            fontSize=10.5, textColor=ACCENT, leading=16, alignment=TA_CENTER)
    )]]
    conclusion_table = Table(conclusion_box_data, colWidths=[W])
    conclusion_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), ROW_HEAD),
        ('BOX', (0, 0), (-1, -1), 1.5, ACCENT),
        ('TOPPADDING', (0, 0), (-1, -1), 12),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
        ('LEFTPADDING', (0, 0), (-1, -1), 16),
        ('RIGHTPADDING', (0, 0), (-1, -1), 16),
    ]))
    story.append(sp(4))
    story.append(conclusion_table)
    story.append(sp(4))

    story.append(body(
        "The five evidence examples — misconception detection at the epistemic level, "
        "cognitive conflict construction, Feynman scoring, domain boundary enforcement, "
        "and learning style adaptation — each illustrate a capability that emerges from "
        "architectural design, not from a larger or better-prompted language model. "
        "Persistent memory, epistemic reasoning, prediction, self-improvement, and "
        "goal-directed behavior are present in AEGIS not as emergent phenomena of scale, "
        "but as <b>explicit architectural components</b>.",
        styles
    ))
    story.append(body(
        "The claim is not full AGI — it is something more precise and more verifiable: "
        "<b>AGI-inspired cognitive behavior in a constrained domain</b>. That precision "
        "is what distinguishes serious research from hype, and it is the standard to "
        "which AEGIS is held.",
        styles
    ))
    story.append(sp(4))

    # ── REFERENCES ────────────────────────────────────────────────────────────
    story.append(HRFlowable(width=W, thickness=1, color=BORDER))
    story.append(sp(2))
    story.append(Paragraph("References", styles['section_title']))
    story.append(sp(2))

    refs = [
        "Ebbinghaus, H. (1885). <i>Über das Gedächtnis</i>. Duncker & Humblot.",
        "Piaget, J. (1977). <i>The Development of Thought: Equilibration of Cognitive Structures</i>. Viking.",
        "Koedinger, K. R., & Corbett, A. T. (2006). Cognitive tutors: Technology bringing learning science to the classroom. <i>The Cambridge Handbook of the Learning Sciences</i>, 61–77.",
        "Chi, M. T. H., de Leeuw, N., Chiu, M.-H., & LaVancher, C. (1994). Eliciting self-explanations improves understanding. <i>Cognitive Science</i>, 18(3), 439–477.",
        "Goertzel, B. (2014). Artificial general intelligence: concept, state of the art, and future prospects. <i>Journal of Artificial General Intelligence</i>, 5(1), 1–48.",
        "Laird, J. E., Lebiere, C., & Rosenbloom, P. S. (2017). A standard model of the mind: Toward a common computational framework across artificial intelligence, cognitive science, neuroscience, and robotics. <i>AI Magazine</i>, 38(4), 13–26.",
        "Bloom, B. S. (1984). The 2 sigma problem: The search for methods of group instruction as effective as one-to-one tutoring. <i>Educational Researcher</i>, 13(6), 4–16.",
        "VanLehn, K. (2011). The relative effectiveness of human tutoring, intelligent tutoring systems, and other tutoring systems. <i>Educational Psychologist</i>, 46(4), 197–221.",
        "Anderson, J. R., Corbett, A. T., Koedinger, K. R., & Pelletier, R. (1995). Cognitive tutors: Lessons learned. <i>Journal of the Learning Sciences</i>, 4(2), 167–207.",
        "Anthropic. (2024). <i>Claude: A language model for helpful, harmless, and honest AI</i>. Technical Report.",
    ]

    for i, ref in enumerate(refs):
        story.append(Paragraph(
            f"[{i+1}]  {ref}",
            ParagraphStyle(f'ref{i}', fontName='Helvetica', fontSize=8.2,
                textColor=TEXT_DIM, leading=13, leftIndent=16,
                firstLineIndent=-16, spaceAfter=4, alignment=TA_JUSTIFY)
        ))

    # ── BUILD ─────────────────────────────────────────────────────────────────
    doc.build(
        story,
        onFirstPage=on_cover_page,
        onLaterPages=on_page,
    )
    print(f"[AEGIS] PDF generated: {output_path}")
    print(f"[AEGIS] Size: {os.path.getsize(output_path) / 1024:.1f} KB")


if __name__ == '__main__':
    out = os.path.join(os.path.dirname(__file__), 'aegis_v3_agi_comparison_report.pdf')
    build_pdf(out)
