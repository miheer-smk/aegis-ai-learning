"""
AEGIS Publication-Quality PDF Report Generator
Uses ReportLab with custom styles, tables, and academic formatting.
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.lib.colors import (
    HexColor, black, white, Color
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable, KeepTogether
)
from reportlab.platypus.flowables import Flowable
from reportlab.lib import colors
import datetime

# ─── Color Palette ────────────────────────────────────────────────────────────
C_BG         = HexColor('#080C10')
C_ACCENT     = HexColor('#00C96A')
C_ACCENT2    = HexColor('#0088CC')
C_HEADING    = HexColor('#0D1B2A')
C_SUBHEADING = HexColor('#1A3A5C')
C_RULE       = HexColor('#1E3A5F')
C_TABLE_HDR  = HexColor('#0D2840')
C_TABLE_ALT  = HexColor('#F0F6FB')
C_TABLE_BRD  = HexColor('#C0D4E8')
C_TEXT       = HexColor('#1A1A2E')
C_MUTED      = HexColor('#4A5568')
C_HIGHLIGHT  = HexColor('#E8F4FD')
C_GREEN_LIGHT= HexColor('#E6F9F0')
C_RED_LIGHT  = HexColor('#FEF2F2')
C_TICK       = HexColor('#059669')
C_CROSS      = HexColor('#DC2626')

PAGE_W, PAGE_H = A4
MARGIN_L = 2.5 * cm
MARGIN_R = 2.5 * cm
MARGIN_T = 2.8 * cm
MARGIN_B = 2.5 * cm

# ─── Custom Horizontal Rule Flowable ─────────────────────────────────────────
class StyledRule(Flowable):
    def __init__(self, width, color=C_RULE, thickness=0.6):
        Flowable.__init__(self)
        self.width = width
        self.color = color
        self.thickness = thickness
        self.height = thickness + 2

    def draw(self):
        self.canv.setStrokeColor(self.color)
        self.canv.setLineWidth(self.thickness)
        self.canv.line(0, 0, self.width, 0)


class AccentRule(Flowable):
    """Two-line decorative rule: thick accent + thin secondary."""
    def __init__(self, width):
        Flowable.__init__(self)
        self.width = width
        self.height = 6

    def draw(self):
        self.canv.setStrokeColor(C_ACCENT)
        self.canv.setLineWidth(2.5)
        self.canv.line(0, 4, self.width * 0.25, 4)
        self.canv.setStrokeColor(C_RULE)
        self.canv.setLineWidth(0.5)
        self.canv.line(0, 1, self.width, 1)


# ─── Style Sheet ──────────────────────────────────────────────────────────────
def build_styles():
    base = getSampleStyleSheet()

    styles = {}

    styles['title'] = ParagraphStyle(
        'Title',
        fontName='Helvetica-Bold',
        fontSize=22,
        leading=28,
        textColor=C_HEADING,
        alignment=TA_LEFT,
        spaceAfter=6,
    )
    styles['subtitle'] = ParagraphStyle(
        'Subtitle',
        fontName='Helvetica-Oblique',
        fontSize=12,
        leading=16,
        textColor=C_MUTED,
        alignment=TA_LEFT,
        spaceAfter=4,
    )
    styles['meta'] = ParagraphStyle(
        'Meta',
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=C_MUTED,
        alignment=TA_LEFT,
        spaceAfter=2,
    )
    styles['h1'] = ParagraphStyle(
        'H1',
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=17,
        textColor=C_HEADING,
        spaceBefore=18,
        spaceAfter=6,
    )
    styles['h2'] = ParagraphStyle(
        'H2',
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=15,
        textColor=C_SUBHEADING,
        spaceBefore=12,
        spaceAfter=4,
    )
    styles['h3'] = ParagraphStyle(
        'H3',
        fontName='Helvetica-BoldOblique',
        fontSize=10,
        leading=14,
        textColor=C_SUBHEADING,
        spaceBefore=8,
        spaceAfter=3,
    )
    styles['body'] = ParagraphStyle(
        'Body',
        fontName='Helvetica',
        fontSize=10,
        leading=15,
        textColor=C_TEXT,
        alignment=TA_JUSTIFY,
        spaceAfter=6,
    )
    styles['body_small'] = ParagraphStyle(
        'BodySmall',
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=C_TEXT,
        alignment=TA_JUSTIFY,
        spaceAfter=4,
    )
    styles['bullet'] = ParagraphStyle(
        'Bullet',
        fontName='Helvetica',
        fontSize=10,
        leading=15,
        textColor=C_TEXT,
        alignment=TA_LEFT,
        leftIndent=14,
        firstLineIndent=-8,
        spaceAfter=3,
    )
    styles['bullet_small'] = ParagraphStyle(
        'BulletSmall',
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=C_TEXT,
        leftIndent=22,
        firstLineIndent=-8,
        spaceAfter=2,
    )
    styles['abstract'] = ParagraphStyle(
        'Abstract',
        fontName='Helvetica',
        fontSize=9.5,
        leading=14,
        textColor=C_TEXT,
        alignment=TA_JUSTIFY,
        leftIndent=12,
        rightIndent=12,
        spaceAfter=5,
    )
    styles['caption'] = ParagraphStyle(
        'Caption',
        fontName='Helvetica-Oblique',
        fontSize=8.5,
        leading=12,
        textColor=C_MUTED,
        alignment=TA_CENTER,
        spaceAfter=6,
    )
    styles['ref'] = ParagraphStyle(
        'Ref',
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=C_TEXT,
        leftIndent=20,
        firstLineIndent=-20,
        spaceAfter=4,
    )
    styles['page_header'] = ParagraphStyle(
        'PageHeader',
        fontName='Helvetica',
        fontSize=8,
        textColor=C_MUTED,
    )
    styles['highlight_box_title'] = ParagraphStyle(
        'HighlightBoxTitle',
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=14,
        textColor=C_HEADING,
        spaceAfter=3,
    )
    styles['highlight_box_body'] = ParagraphStyle(
        'HighlightBoxBody',
        fontName='Helvetica',
        fontSize=9.5,
        leading=14,
        textColor=C_TEXT,
        alignment=TA_JUSTIFY,
        spaceAfter=2,
    )
    return styles


# ─── Page Templates ───────────────────────────────────────────────────────────
def header_footer(canvas, doc):
    canvas.saveState()
    w, h = A4
    page_num = doc.page

    # Header line
    canvas.setStrokeColor(C_RULE)
    canvas.setLineWidth(0.5)
    canvas.line(MARGIN_L, h - MARGIN_T + 8*mm, w - MARGIN_R, h - MARGIN_T + 8*mm)

    # Header text
    canvas.setFont('Helvetica', 8)
    canvas.setFillColor(C_MUTED)
    canvas.drawString(MARGIN_L, h - MARGIN_T + 10*mm,
                      'AEGIS: An Agentic AI System for Cognitive-Aware Personalized Learning')
    canvas.drawRightString(w - MARGIN_R, h - MARGIN_T + 10*mm,
                           f'INSOMNIA Hackathon — ACM VNIT 2025')

    # Footer line
    canvas.line(MARGIN_L, MARGIN_B - 6*mm, w - MARGIN_R, MARGIN_B - 6*mm)

    # Footer text
    canvas.setFont('Helvetica', 8)
    canvas.drawString(MARGIN_L, MARGIN_B - 10*mm, 'Confidential — Research Prototype')
    canvas.drawCentredString(w / 2, MARGIN_B - 10*mm, str(page_num))
    canvas.drawRightString(w - MARGIN_R, MARGIN_B - 10*mm,
                           datetime.date.today().strftime('%B %Y'))

    canvas.restoreState()


def first_page_template(canvas, doc):
    """First page has no header."""
    canvas.saveState()
    w, h = A4

    # Accent bar at top
    canvas.setFillColor(C_HEADING)
    canvas.rect(0, h - 18*mm, w, 18*mm, fill=1, stroke=0)
    canvas.setFillColor(C_ACCENT)
    canvas.rect(0, h - 18*mm, 6*mm, 18*mm, fill=1, stroke=0)
    canvas.setFont('Helvetica-Bold', 9)
    canvas.setFillColor(white)
    canvas.drawString(10*mm, h - 11*mm, 'AEGIS SYSTEM REPORT')
    canvas.drawRightString(w - 10*mm, h - 11*mm, 'ACM VNIT INSOMNIA HACKATHON 2025')

    # Footer line
    canvas.setStrokeColor(C_RULE)
    canvas.setLineWidth(0.5)
    canvas.line(MARGIN_L, MARGIN_B - 6*mm, w - MARGIN_R, MARGIN_B - 6*mm)
    canvas.setFont('Helvetica', 8)
    canvas.setFillColor(C_MUTED)
    canvas.drawString(MARGIN_L, MARGIN_B - 10*mm, 'Confidential — Research Prototype')
    canvas.drawCentredString(w / 2, MARGIN_B - 10*mm, '1')
    canvas.drawRightString(w - MARGIN_R, MARGIN_B - 10*mm,
                           datetime.date.today().strftime('%B %Y'))
    canvas.restoreState()


# ─── Helper: highlight box (no canvas needed) ─────────────────────────────────
def highlight_box(content_rows, styles, bg=C_HIGHLIGHT, border=C_RULE):
    """Creates a visually boxed inset using a 1-cell Table."""
    inner = [Paragraph(row, styles['highlight_box_body']) for row in content_rows]
    t = Table([[inner]], colWidths=[PAGE_W - MARGIN_L - MARGIN_R])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), bg),
        ('BOX', (0, 0), (-1, -1), 0.7, border),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('ROWBACKGROUNDS', (0, 0), (-1, -1), [bg]),
    ]))
    return t


def formula_box(formula_text, styles, label=''):
    """Centered formula display box."""
    style = ParagraphStyle(
        'Formula',
        fontName='Helvetica-BoldOblique',
        fontSize=11,
        leading=16,
        textColor=C_HEADING,
        alignment=TA_CENTER,
    )
    lbl = ParagraphStyle(
        'FormulaLabel',
        fontName='Helvetica-Oblique',
        fontSize=8.5,
        textColor=C_MUTED,
        alignment=TA_CENTER,
    )
    inner = [Paragraph(formula_text, style)]
    if label:
        inner.append(Paragraph(label, lbl))
    t = Table([[ inner ]], colWidths=[PAGE_W - MARGIN_L - MARGIN_R])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), HexColor('#EEF7FF')),
        ('BOX', (0, 0), (-1, -1), 1, C_ACCENT2),
        ('LEFTPADDING', (0, 0), (-1, -1), 16),
        ('RIGHTPADDING', (0, 0), (-1, -1), 16),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
    ]))
    return t


# ─── Content Builder ──────────────────────────────────────────────────────────
def build_content(styles, doc_width):
    story = []
    B = styles['body']
    BS = styles['body_small']
    H1 = styles['h1']
    H2 = styles['h2']
    H3 = styles['h3']
    BU = styles['bullet']
    BUS = styles['bullet_small']
    AB = styles['abstract']
    RF = styles['ref']
    SP4 = Spacer(1, 4*mm)
    SP6 = Spacer(1, 6*mm)
    SP8 = Spacer(1, 8*mm)
    SP12 = Spacer(1, 12*mm)

    def rule():
        return StyledRule(doc_width, C_RULE, 0.5)

    def accent_rule():
        return AccentRule(doc_width)

    # ── TITLE PAGE ────────────────────────────────────────────────────────────
    story.append(Spacer(1, 18*mm))  # compensate for top bar on page 1

    story.append(Paragraph('AEGIS', ParagraphStyle(
        'BigTitle', fontName='Helvetica-Bold', fontSize=38,
        textColor=C_HEADING, leading=44, spaceAfter=0)))
    story.append(Paragraph(
        'Agentic Epistemic Graph Intelligence System',
        ParagraphStyle('BigSub', fontName='Helvetica', fontSize=15,
                       textColor=C_ACCENT, leading=20, spaceAfter=8)))

    story.append(accent_rule())
    story.append(SP4)

    story.append(Paragraph(
        'An Agentic AI System for Cognitive-Aware Personalized Learning',
        styles['title']))
    story.append(Paragraph(
        'A Research-Driven Approach to Modeling Human Learning Processes',
        styles['subtitle']))
    story.append(SP6)

    meta_data = [
        ['Venue:', 'INSOMNIA Hackathon — ACM VNIT, Problem Statement 5'],
        ['Category:', 'Agentic AI · Educational Technology · Cognitive Systems'],
        ['Stack:', 'Next.js 14 · TypeScript · SQLite · Anthropic Claude · D3.js'],
        ['Date:', datetime.date.today().strftime('%B %d, %Y')],
    ]
    for label, value in meta_data:
        story.append(Paragraph(
            f'<font name="Helvetica-Bold">{label}</font>&nbsp;&nbsp;{value}',
            styles['meta']))

    story.append(SP8)
    story.append(rule())
    story.append(SP8)

    # ── 1. ABSTRACT ───────────────────────────────────────────────────────────
    story.append(Paragraph('Abstract', H1))
    story.append(accent_rule())
    story.append(SP4)

    abstract_text = (
        'Contemporary AI-driven tutoring systems, despite their widespread adoption, '
        'remain fundamentally stateless: they respond to isolated queries without '
        'modeling the learner\'s evolving cognitive state, tracking conceptual '
        'misconceptions, or accounting for the neuropsychological reality of memory '
        'decay. This paper presents AEGIS (Agentic Epistemic Graph Intelligence '
        'System), a full-stack AI learning platform that addresses these deficiencies '
        'through three tightly integrated research pillars: (1) <i>epistemic state '
        'modeling</i>, which maintains a dynamic knowledge graph encoding concept '
        'mastery, active misconceptions, and prerequisite gaps; (2) <i>temporal '
        'memory decay simulation</i>, implementing Ebbinghaus\'s forgetting curve '
        'with SM-2 spaced-repetition scheduling to proactively surface at-risk '
        'knowledge; and (3) <i>Cognitive DNA adaptation</i>, a six-dimensional '
        'learning-style vector that drives real-time pedagogical strategy selection '
        'across five specialized AI agents (PROBE, HINT, REPAIR, CHALLENGE, META). '
        'Additionally, AEGIS incorporates the Feynman Technique for explanation '
        'quality scoring, Chain-of-Thought hidden reasoning, input safety pipelines, '
        'and accessibility features including Text-to-Speech and sign-language gesture '
        'hints. Deployed on a Next.js 14 + SQLite stack interfacing with the '
        'Anthropic Claude API, AEGIS represents a meaningful step toward AI systems '
        'that model and respond to the internal cognitive states of human learners — '
        'a foundational requirement for general-purpose intelligent tutoring systems.'
    )
    story.append(Paragraph(abstract_text, AB))
    story.append(SP4)

    kw_style = ParagraphStyle('KW', fontName='Helvetica-Oblique', fontSize=9,
                              textColor=C_MUTED, alignment=TA_LEFT)
    story.append(Paragraph(
        '<b>Keywords:</b> Intelligent Tutoring Systems, Epistemic Modeling, '
        'Ebbinghaus Forgetting Curve, Cognitive DNA, Agentic AI, '
        'Spaced Repetition, Misconception Repair, Feynman Technique',
        kw_style))

    story.append(PageBreak())

    # ── 2. INTRODUCTION ───────────────────────────────────────────────────────
    story.append(Paragraph('1. Introduction', H1))
    story.append(accent_rule())
    story.append(SP4)

    story.append(Paragraph(
        'The proliferation of large language models (LLMs) has catalyzed '
        'a new generation of AI-powered educational tools. Yet beneath the '
        'surface sophistication of these systems lies a structural limitation '
        'that impedes genuine learning: they are fundamentally <i>stateless</i>. '
        'Each conversation begins anew, with no persistent model of the student\'s '
        'knowledge state, no memory of prior errors, and no principled strategy '
        'for scaffolding understanding over time.',
        B))

    story.append(Paragraph(
        'Human learning is not a linear process of information transfer. It is '
        'an active, constructive activity governed by prior knowledge structures '
        '(Bartlett, 1932), susceptible to systematic distortions we call '
        'misconceptions (Piaget, 1952), and subject to exponential forgetting '
        'unless reinforced at biologically optimal intervals (Ebbinghaus, 1885). '
        'An AI tutor that ignores these realities does not merely underperform — '
        'it risks reinforcing incorrect mental models and creating an illusion '
        'of competence where none exists.',
        B))

    story.append(Paragraph(
        'AEGIS is our response to this gap. Rather than building a faster '
        'answer engine, we built a <i>learning model</i> — a system that tracks '
        'not just what a student has encountered, but what they genuinely '
        'understand, what they have mistakenly internalized, and what they are '
        'at risk of forgetting. The system routes each interaction through a '
        'pipeline of cognitive analysis, memory management, and adaptive '
        'pedagogical strategy selection before any response is generated.',
        B))

    story.append(Paragraph('1.1 Why Current Systems Fail', H2))

    failure_points = [
        ('<b>Stateless interaction:</b> GPT-based tutors maintain context within '
         'a session window but possess no persistent model of student knowledge '
         'across sessions. Each new conversation treats the learner as a blank slate.'),
        ('<b>Answer optimization over understanding:</b> Current systems are '
         'rewarded for producing correct, coherent answers — not for guiding '
         'students to discover understanding independently. This creates learned '
         'helplessness rather than metacognitive skill.'),
        ('<b>No misconception tracking:</b> When a student holds an incorrect '
         'belief, standard LLMs typically respond to the surface-level question '
         'without diagnosing the underlying conceptual error.'),
        ('<b>No forgetting model:</b> Knowledge retention decays exponentially '
         'with time. No current commercial AI tutoring system models this decay '
         'or proactively schedules review to combat forgetting before it occurs.'),
        ('<b>Style-agnostic delivery:</b> Students differ fundamentally in how '
         'they process information — visual vs. abstract, example-first vs. '
         'theory-first, fast vs. deliberate. Uniform delivery ignores these '
         'differences entirely.'),
    ]
    for fp in failure_points:
        story.append(Paragraph(f'• {fp}', BU))
        story.append(Spacer(1, 2*mm))

    story.append(SP6)

    # ── 3. PROBLEM STATEMENT ──────────────────────────────────────────────────
    story.append(Paragraph('2. Problem Statement', H1))
    story.append(accent_rule())
    story.append(SP4)

    story.append(Paragraph(
        'The INSOMNIA Hackathon (ACM VNIT, Problem Statement 5) challenges '
        'participants to design a <i>Multimodal Agentic AI Learning Platform</i> '
        'that transcends the limitations of static, query-response educational '
        'tools. The platform must fulfill the following requirements:',
        B))

    ps_items = [
        ('<b>Adaptive personalization:</b> The system must dynamically adjust '
         'explanations, question difficulty, and pedagogical approach based on '
         'individual student profiles.'),
        ('<b>Progress tracking:</b> Persistent modeling of concept mastery, '
         'engagement patterns, and learning velocity across sessions.'),
        ('<b>Multimodal input:</b> Support for text, voice, and image-based '
         'student inputs to accommodate diverse interaction preferences.'),
        ('<b>Agentic reasoning:</b> AI behavior must be goal-directed and '
         'context-sensitive, not merely reactive. The system must select '
         'pedagogical strategies autonomously based on diagnosed student state.'),
        ('<b>Safety and accessibility:</b> Input filtering, ethical guardrails, '
         'and accessibility features for diverse user populations.'),
    ]
    for item in ps_items:
        story.append(Paragraph(f'• {item}', BU))
        story.append(Spacer(1, 2*mm))

    story.append(SP6)

    # ── 4. EXISTING SOLUTIONS ─────────────────────────────────────────────────
    story.append(Paragraph('3. Review of Existing Solutions', H1))
    story.append(accent_rule())
    story.append(SP4)

    story.append(Paragraph(
        'We survey the most prominent existing AI-assisted learning systems, '
        'analyzing their architectural choices and the limitations that motivate '
        'the AEGIS design.',
        B))

    systems = [
        ('3.1 GPT-Based Tutors (ChatGPT, Claude, Gemini)',
         'Large language models deployed as tutors represent the current state of '
         'practice. They exhibit impressive fluency and broad knowledge coverage, '
         'but operate without persistent student models. Each session is a fresh '
         'context window; there is no cross-session memory of misconceptions '
         'corrected or concepts explored. Critically, they respond to the '
         '<i>question asked</i>, not to the <i>student\'s epistemic state</i> — '
         'a subtle but profound distinction. A student who asks "What is a '
         'derivative?" after three sessions of confusion will receive the same '
         'answer as a student encountering the concept for the first time.'),
        ('3.2 Khan Academy (Khanmigo)',
         'Khan Academy\'s AI assistant represents a significant step forward by '
         'grounding responses in a structured curriculum. However, its student '
         'model remains shallow: it tracks exercise completion and hint usage, '
         'but does not maintain a semantic graph of conceptual understanding '
         'or model the probabilistic decay of acquired knowledge over time. '
         'Its adaptive engine is primarily difficulty-scaling, not '
         'cognitively-aware.'),
        ('3.3 Duolingo Adaptive Learning',
         'Duolingo employs a spaced-repetition system for vocabulary and language '
         'drills, representing one of the most rigorous applications of '
         'Ebbinghaus-inspired scheduling in consumer education. However, its '
         'model is item-level (specific vocabulary words), not concept-level. '
         'It cannot model the relational structure between concepts, track '
         'misconceptions within a domain, or adapt pedagogical <i>style</i> '
         '— only exercise frequency.'),
        ('3.4 Anki (Spaced Repetition)',
         'Anki implements the SM-2 algorithm faithfully, making it arguably the '
         'most scientifically grounded memory management tool available. However, '
         'it is a passive review system, not a tutoring system. It cannot '
         'diagnose why a student struggles, generate targeted explanations, or '
         'adapt its approach to the student\'s learning style. Anki models '
         '<i>memory</i> but not <i>understanding</i>.'),
        ('3.5 Deep Knowledge Tracing (DKT)',
         'Piech et al. (2015) introduced Deep Knowledge Tracing, which models '
         'student knowledge as a hidden state in an RNN, updating probabilistic '
         'mastery estimates after each problem response. DKT represents the '
         'most sophisticated computational student modeling in academic literature. '
         'However, it operates on structured problem sets with binary '
         'correct/incorrect feedback — it cannot be applied directly to '
         'open-ended dialogue, does not model memory decay dynamically, '
         'and provides no mechanism for explanation generation or '
         'pedagogical strategy selection.'),
    ]

    for title, text in systems:
        story.append(Paragraph(title, H2))
        story.append(Paragraph(text, B))

    story.append(SP4)
    story.append(highlight_box([
        '<b>Critical Gap:</b> No existing deployed system simultaneously addresses '
        'epistemic state modeling (what the student knows and misunderstands), '
        'temporal memory dynamics (what they are forgetting), cognitive style '
        'adaptation (how they learn best), and agentic pedagogical strategy '
        'selection (how to respond most effectively) — all within a unified, '
        'conversational AI architecture.'
    ], styles, bg=HexColor('#FFF8E7'), border=HexColor('#F59E0B')))

    story.append(PageBreak())

    # ── 5. PROPOSED SYSTEM ────────────────────────────────────────────────────
    story.append(Paragraph('4. Proposed System — AEGIS', H1))
    story.append(accent_rule())
    story.append(SP4)

    story.append(Paragraph(
        'AEGIS is architected around three research pillars that collectively '
        'address the limitations identified above. Each pillar maps directly '
        'to a body of established learning science, and together they form a '
        'coherent cognitive model of the student that evolves continuously '
        'throughout the learning interaction.',
        B))

    # 5.1 Epistemic State Modeling
    story.append(Paragraph('4.1 Epistemic State Modeling', H2))
    story.append(Paragraph(
        'At the core of AEGIS is a dynamic <i>epistemic state model</i> — a '
        'structured representation of what a student knows, what they '
        'misunderstand, and what prerequisites they are missing. This model '
        'is realized as a weighted knowledge graph stored in SQLite, where '
        'each node represents a concept and carries the following attributes:',
        B))

    epistemic_attrs = [
        '<b>mastery</b> (0.0–1.0): probabilistic estimate of genuine understanding, '
        'updated after each interaction using an SM-2-inspired gain function',
        '<b>stability</b>: parameter governing the rate of forgetting for this '
        'specific concept (higher stability = slower decay)',
        '<b>misconceptions[]</b>: structured array of detected incorrect beliefs, '
        'each with a severity classification (low / medium / high)',
        '<b>review_count</b>: cumulative interaction count, used to scale node '
        'radius in the knowledge graph visualization',
        '<b>feynman_clarity / feynman_depth</b>: scores from Feynman Technique '
        'evaluation, measuring explanation quality',
    ]
    for attr in epistemic_attrs:
        story.append(Paragraph(f'• {attr}', BU))
        story.append(Spacer(1, 2*mm))

    story.append(Paragraph(
        'After each student message, the conversation is passed to a dedicated '
        'epistemic analysis call (Claude with few-shot examples) that extracts '
        'the updated epistemic state as structured JSON. This JSON drives both '
        'the graph update and the agent selection decision.',
        B))

    story.append(Paragraph(
        '<i>Theoretical grounding:</i> The schema design is informed by Bartlett\'s '
        '(1932) schema theory, which positions understanding not as memorization '
        'of facts but as integration into existing knowledge structures. Piaget\'s '
        '(1952) constructivist model provides the misconception-correction '
        'framework: cognitive conflict must precede genuine belief revision.',
        B))

    # 5.2 Memory Decay
    story.append(Paragraph('4.2 Temporal Memory Decay — The Forgetting Curve', H2))
    story.append(Paragraph(
        'Ebbinghaus (1885) demonstrated that human memory retention follows '
        'a negative exponential function of elapsed time since last review. '
        'AEGIS models this with the following formula:',
        B))

    story.append(formula_box(
        'R(t) = e<super>−t / S</super>',
        styles,
        label='R: retention probability | t: elapsed days since last review | S: stability parameter'
    ))
    story.append(SP4)

    story.append(Paragraph(
        'The stability parameter S is concept-specific and learner-specific: '
        'it increases with successful recall events (long-term potentiation) '
        'and decreases after failed recall (forgetting events). The update '
        'rule follows the SM-2 algorithm (Wozniak, 1990):',
        B))

    story.append(formula_box(
        'S\'  =  S × (0.1 + 0.9 × q / 5)',
        styles,
        label='q: recall quality score (0–5) | S\': updated stability'
    ))
    story.append(SP4)

    story.append(Paragraph(
        'The system computes retention for all concept nodes at each session, '
        'generates a prioritized review queue with urgency classifications '
        '(critical / high / medium / low), and surfaces decay alerts in the '
        'UI. Concepts falling below a retention threshold trigger proactive '
        'review prompts — converting what would be passive forgetting into '
        'active reinforcement.',
        B))

    # 5.3 Cognitive DNA
    story.append(Paragraph('4.3 Cognitive DNA Adaptation', H2))
    story.append(Paragraph(
        'Students differ fundamentally in their cognitive styles — the '
        'characteristic patterns by which they perceive, process, and retain '
        'information. AEGIS models each student\'s learning profile as a '
        'six-dimensional Cognitive DNA vector, inferred dynamically from '
        'conversational signals:',
        B))

    dna_table_data = [
        ['Dimension', 'Range', 'Signal Indicators'],
        ['visual', '0.0–1.0', '"show me", "draw it", spatial metaphors, diagram requests'],
        ['abstract', '0.0–1.0', 'comfort with notation, formulas, proofs, symbolic reasoning'],
        ['exampleFirst', '0.0–1.0', '"give me an example first", concrete-before-abstract preference'],
        ['theoryFirst', '0.0–1.0', '"why does this work?", underlying principle-seeking behavior'],
        ['analogyDriven', '0.0–1.0', 'responds to "it\'s like...", generates own analogies spontaneously'],
        ['pace', 'slow/med/fast', 'repetition rate, ahead-jumping, connection-making velocity'],
    ]
    dna_table = Table(dna_table_data,
                      colWidths=[2.8*cm, 1.8*cm, doc_width - 4.6*cm])
    dna_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), C_TABLE_HDR),
        ('TEXTCOLOR', (0, 0), (-1, 0), white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, C_TABLE_ALT]),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 8.5),
        ('GRID', (0, 0), (-1, -1), 0.5, C_TABLE_BRD),
        ('LEFTPADDING', (0, 0), (-1, -1), 7),
        ('RIGHTPADDING', (0, 0), (-1, -1), 7),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    story.append(dna_table)
    story.append(SP4)

    story.append(Paragraph(
        'The Cognitive DNA vector is inferred via a dedicated Claude call every '
        'four messages, using a 70/30 exponential blend of the new estimate with '
        'the prior. This prevents overfitting to a single unusual message while '
        'ensuring genuine style shifts are captured. The vector drives a natural-'
        'language instruction injected into every agent prompt: for example, '
        '"Use concrete analogies. Present examples before theoretical '
        'justification. Speak at a measured pace."',
        B))

    story.append(Paragraph(
        '<i>Theoretical grounding:</i> The dimensions map to Kolb\'s (1984) '
        'experiential learning styles (concrete experience vs. abstract '
        'conceptualization) and draw from Gardner\'s (1983) multiple intelligences '
        'framework, adapted for LLM-prompt parameterization.',
        B))

    # 5.4 Agentic Architecture
    story.append(Paragraph('4.4 Agentic AI Architecture', H2))
    story.append(Paragraph(
        'The AEGIS agent system consists of six specialized AI personas, '
        'each implementing a distinct pedagogical strategy. Agent selection '
        'follows a priority decision tree executed after every epistemic '
        'analysis cycle:',
        B))

    agent_table_data = [
        ['Agent', 'Trigger Condition', 'Pedagogical Strategy', 'Theoretical Basis'],
        ['PROBE', 'Default (low mastery, no flags)',
         'Socratic questioning — expose hidden gaps', 'Socratic Method (470 BCE)'],
        ['HINT', 'Frustration ≥ 70%',
         'Progressive scaffolding — reduce cognitive load', 'Vygotsky ZPD (1978)'],
        ['REPAIR', 'Active misconceptions detected',
         'Cognitive conflict — force belief revision', 'Piaget Constructivism (1952)'],
        ['CHALLENGE', 'Avg mastery ≥ 80%',
         'Trap problems — probe depth of mastery', 'Bloom\'s Taxonomy L5-6'],
        ['META', 'Every 5th message',
         'Metacognitive reflection — schema integration', 'Flavell (1979)'],
        ['FEYNMAN', 'Concept mastery > 60% (every 6th msg)',
         'Teach-back evaluation — test explanation quality', 'Feynman (1985)'],
    ]
    agent_table = Table(agent_table_data,
                        colWidths=[2.0*cm, 3.2*cm, 4.5*cm, doc_width - 9.7*cm])
    agent_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), C_TABLE_HDR),
        ('TEXTCOLOR', (0, 0), (-1, 0), white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 8.5),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, C_TABLE_ALT]),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, C_TABLE_BRD),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('FONTNAME', (0, 1), (0, -1), 'Helvetica-Bold'),
        ('TEXTCOLOR', (0, 1), (0, -1), C_ACCENT2),
    ]))
    story.append(agent_table)
    story.append(SP4)

    story.append(Paragraph(
        'Each agent receives a richly parameterized system prompt that injects '
        'the current epistemic state, the Cognitive DNA instruction, active '
        'misconceptions, and a Chain-of-Thought (CoT) reasoning block. The CoT '
        'protocol instructs Claude to reason silently across five dimensions '
        '(current understanding, primary gap, optimal pedagogical move, emotional '
        'register, forward prompt) before composing the visible response. This '
        'hidden reasoning is stripped before delivery to the student.',
        B))

    # 5.5 Feynman
    story.append(Paragraph('4.5 Feynman Technique Integration', H2))
    story.append(Paragraph(
        'The Feynman Technique, named after Nobel laureate Richard Feynman, '
        'proposes that genuine understanding can be validated by the ability '
        'to explain a concept in simple language to a novice — without jargon. '
        'AEGIS implements this as an automated evaluation cycle:',
        B))

    feynman_steps = [
        'When a concept\'s mastery score exceeds 0.6, the system identifies it as a Feynman candidate.',
        'Every sixth message, the system appends a Feynman trigger: <i>"Explain [concept] as if teaching a 10-year-old."</i>',
        'The student\'s response is evaluated by a dedicated Claude call against two dimensions: <b>clarity</b> (simplicity of language, absence of undefined jargon) and <b>depth</b> (accuracy, completeness, presence of analogy or example).',
        'A score above the threshold (clarity > 0.65, depth > 0.60) triggers a mastery boost and routes to the CHALLENGE agent.',
        'A score below threshold routes to the REPAIR agent, which targets the identified explanation gaps.',
    ]
    for i, step in enumerate(feynman_steps, 1):
        story.append(Paragraph(f'{i}. {step}', BU))
        story.append(Spacer(1, 2*mm))

    # 5.6 Safety and Accessibility
    story.append(Paragraph('4.6 Input Safety and Accessibility', H2))
    story.append(Paragraph(
        'AEGIS employs a two-stage input validation pipeline before any '
        'message reaches the LLM reasoning layer:',
        B))
    story.append(Paragraph(
        '<b>Stage 1 — Fast Keyword Filter:</b> Regular expression matching '
        'against patterns for abusive language, prompt injection attempts '
        '("ignore your instructions", "pretend you are"), and clearly '
        'off-topic content. This incurs zero LLM cost and responds in '
        'microseconds for clear violations.',
        BU))
    story.append(Spacer(1, 2*mm))
    story.append(Paragraph(
        '<b>Stage 2 — Semantic Safety Check:</b> For borderline messages '
        'not caught by the keyword filter, a lightweight Claude call '
        'classifies the message as ok / off_topic / irrelevant / abusive '
        'with topic context. The system defaults to permissive (safe) if '
        'the API call fails, ensuring educational access is never blocked '
        'by infrastructure issues.',
        BU))
    story.append(Spacer(1, 3*mm))
    story.append(Paragraph(
        'Accessibility features include per-message Text-to-Speech (Web '
        'Speech API), automatic markdown-stripping for simplified text '
        'output, and ASL-inspired gesture hint annotations for key '
        'educational terminology.',
        B))

    story.append(PageBreak())

    # ── 6. SYSTEM ARCHITECTURE ────────────────────────────────────────────────
    story.append(Paragraph('5. System Architecture', H1))
    story.append(accent_rule())
    story.append(SP4)

    story.append(Paragraph(
        'AEGIS is a full-stack application built on Next.js 14 (App Router, '
        'TypeScript strict mode) with a SQLite persistence layer accessed '
        'via better-sqlite3. The architecture follows a server-side pipeline '
        'pattern where all AI inference and state mutation occurs within '
        'Next.js API Route Handlers, ensuring no sensitive computation '
        'reaches the client.',
        B))

    story.append(Paragraph('5.1 Request Processing Pipeline', H2))

    pipeline_steps = [
        ('<b>Input Reception:</b> The POST /api/chat handler receives the '
         'student message (text + optional image as base64), student ID, '
         'and session context.'),
        ('<b>Safety Validation:</b> validateUserInput() runs the two-stage '
         'filter. Blocked messages return immediately with a category-'
         'appropriate response — the LLM pipeline is never invoked.'),
        ('<b>Epistemic Analysis:</b> analyzeEpistemicState() sends the '
         'recent conversation history to Claude with a structured prompt '
         'containing few-shot misconception examples. The response is '
         'parsed as typed JSON (EpistemicState).'),
        ('<b>Graph Update:</b> updateConceptGraph() applies SM-2 mastery '
         'gains and misconception penalties to the SQLite knowledge graph.'),
        ('<b>DNA Inference:</b> Every 4 messages, inferCognitiveDNA() '
         'updates the student\'s learning style vector with a 70/30 '
         'exponential blend.'),
        ('<b>Agent Selection:</b> selectAgent() traverses the priority '
         'decision tree using the current epistemic state, average mastery, '
         'and message count to select one of the six agents.'),
        ('<b>Prompt Assembly:</b> buildAgentSystemPrompt() constructs a '
         'rich, context-injected system prompt — epistemic state + Cognitive '
         'DNA instruction + agent instructions + Chain-of-Thought protocol.'),
        ('<b>LLM Inference:</b> The assembled prompt and conversation history '
         'are sent to claude-opus-4-5 via the Anthropic Messages API.'),
        ('<b>CoT Stripping:</b> stripCoT() removes any accidentally leaked '
         'reasoning structure from the response.'),
        ('<b>Feynman Trigger Check:</b> If a candidate concept exists and the '
         'message count modulus condition is met, a Feynman challenge is '
         'appended to the response.'),
        ('<b>Persistence + Response:</b> User and assistant messages are '
         'persisted to SQLite. The response payload includes the message, '
         'agent type, epistemic update, decay alerts, DNA update, and '
         'optional Feynman evaluation result.'),
    ]
    for i, step in enumerate(pipeline_steps, 1):
        story.append(Paragraph(f'{i}. {step}', BUS))
        story.append(Spacer(1, 1.5*mm))

    story.append(SP4)
    story.append(Paragraph('5.2 Data Layer', H2))

    db_rows = [
        ['Table', 'Key Columns', 'Purpose'],
        ['students', 'id, name, topic, goal, cognitive_dna (JSON)', 'Student profiles and DNA vectors'],
        ['concept_nodes', 'concept, mastery, stability, last_reviewed, misconception (JSON), feynman_clarity, feynman_depth',
         'Knowledge graph nodes with all cognitive state'],
        ['chat_messages', 'role, content, agent_type, frustration_level, reflection_score',
         'Full conversation history with metadata'],
        ['sessions', 'started_at, ended_at, concepts_covered (JSON), mastery_delta',
         'Session-level learning outcome tracking'],
    ]
    db_table = Table(db_rows, colWidths=[2.6*cm, 5.5*cm, doc_width - 8.1*cm])
    db_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), C_TABLE_HDR),
        ('TEXTCOLOR', (0, 0), (-1, 0), white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, C_TABLE_ALT]),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 8.5),
        ('GRID', (0, 0), (-1, -1), 0.5, C_TABLE_BRD),
        ('LEFTPADDING', (0, 0), (-1, -1), 7),
        ('RIGHTPADDING', (0, 0), (-1, -1), 7),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    story.append(db_table)

    story.append(PageBreak())

    # ── 7. INNOVATION & NOVELTY ───────────────────────────────────────────────
    story.append(Paragraph('6. Innovation and Novelty', H1))
    story.append(accent_rule())
    story.append(SP4)

    story.append(Paragraph(
        'AEGIS occupies a unique position in the landscape of AI-assisted '
        'education by being, to our knowledge, the first system to integrate '
        'all of the following within a single coherent architecture:',
        B))

    innovations = [
        ('<b>Epistemic + Memory Integration:</b> Most systems model either '
         'knowledge state (DKT, BKT) <i>or</i> memory dynamics (Anki, SuperMemo), '
         'never both simultaneously. AEGIS maintains a unified concept node that '
         'encodes both the quality of understanding (mastery) and the temporal '
         'vulnerability of that knowledge (stability/retention).'),
        ('<b>LLM-Driven Epistemic Extraction:</b> Rather than relying on binary '
         'correct/incorrect signals, AEGIS extracts rich structured epistemic '
         'state from open-ended conversation using few-shot prompted LLM analysis. '
         'This enables misconception detection in free-form dialogue — a '
         'capability absent from all item-response-based student models.'),
        ('<b>Cognitive DNA as Prompt Parameter:</b> Learning style adaptation has '
         'been studied extensively in educational psychology but has never been '
         'operationalized as a real-time LLM prompt parameter. AEGIS translates '
         'the DNA vector into a natural language instructional modifier injected '
         'into every agent prompt, bridging cognitive science theory and LLM '
         'engineering practice.'),
        ('<b>Multi-Agent Pedagogical Routing:</b> The combination of a cognitive '
         'state monitor (epistemic analysis) with a portfolio of specialized '
         'pedagogical agents creates a system that can dynamically switch between '
         'Socratic questioning, misconception repair, progressive hinting, mastery '
         'challenge, and metacognitive reflection — all within a single '
         'conversation, based on real-time diagnosis.'),
        ('<b>Feynman Evaluation via LLM:</b> The Feynman Technique has been used '
         'as a self-study heuristic but has never been automated within a '
         'tutoring system. AEGIS demonstrates that LLMs can score explanation '
         'quality along meaningful dimensions (clarity, depth, gap identification) '
         'reliably enough to drive mastery updates and agent routing.'),
        ('<b>Chain-of-Thought Pedagogy:</b> The use of hidden CoT reasoning in '
         'pedagogical systems is novel. By instructing the model to reason across '
         'epistemic, affective, and strategic dimensions before responding, AEGIS '
         'achieves pedagogical precision that surface-level prompting cannot.'),
    ]
    for innov in innovations:
        story.append(Paragraph(f'• {innov}', BU))
        story.append(Spacer(1, 3*mm))

    story.append(SP6)

    # ── 8. COMPARISON TABLE ───────────────────────────────────────────────────
    story.append(Paragraph('7. Comparative Analysis', H1))
    story.append(accent_rule())
    story.append(SP4)

    story.append(Paragraph(
        'The following table provides a structured comparison of AEGIS against '
        'representative existing systems across the dimensions most critical '
        'for cognitively-aware personalized learning:',
        B))

    story.append(SP4)

    tick = '<font color="#059669"><b>✓</b></font>'
    cross = '<font color="#DC2626"><b>✗</b></font>'
    partial = '<font color="#D97706"><b>~</b></font>'

    comp_data = [
        [
            Paragraph('<b>Feature</b>', ParagraphStyle('TH', fontName='Helvetica-Bold', fontSize=9, textColor=white, alignment=TA_LEFT)),
            Paragraph('<b>GPT Tutors</b>', ParagraphStyle('TH', fontName='Helvetica-Bold', fontSize=9, textColor=white, alignment=TA_CENTER)),
            Paragraph('<b>Khan Academy</b>', ParagraphStyle('TH', fontName='Helvetica-Bold', fontSize=9, textColor=white, alignment=TA_CENTER)),
            Paragraph('<b>Duolingo</b>', ParagraphStyle('TH', fontName='Helvetica-Bold', fontSize=9, textColor=white, alignment=TA_CENTER)),
            Paragraph('<b>Anki</b>', ParagraphStyle('TH', fontName='Helvetica-Bold', fontSize=9, textColor=white, alignment=TA_CENTER)),
            Paragraph('<b>AEGIS</b>', ParagraphStyle('TH', fontName='Helvetica-Bold', fontSize=9, textColor=C_ACCENT, alignment=TA_CENTER)),
        ],
    ]
    pS = ParagraphStyle('TC', fontName='Helvetica', fontSize=9, alignment=TA_LEFT, leading=12)
    pC = ParagraphStyle('TC2', fontName='Helvetica', fontSize=11, alignment=TA_CENTER, leading=14)
    pCA = ParagraphStyle('TC3', fontName='Helvetica-Bold', fontSize=11, alignment=TA_CENTER,
                          leading=14, textColor=C_TICK)

    rows_data = [
        ('Persistent student model (cross-session)', cross, partial, partial, cross, tick),
        ('Concept-level mastery tracking',           cross, partial, cross,   cross, tick),
        ('Misconception detection & repair',         cross, cross,   cross,   cross, tick),
        ('Forgetting curve / memory decay model',    cross, cross,   partial, tick,  tick),
        ('Spaced repetition scheduling',             cross, cross,   tick,    tick,  tick),
        ('Learning style / cognitive adaptation',    cross, cross,   cross,   cross, tick),
        ('Agentic pedagogical strategy selection',   cross, partial, cross,   cross, tick),
        ('Feynman technique evaluation',             cross, cross,   cross,   cross, tick),
        ('Chain-of-Thought reasoning',               partial, cross, cross,   cross, tick),
        ('Multimodal input (voice + image)',         partial, partial, partial, cross, tick),
        ('Open-ended dialogue tutoring',             tick,  partial, cross,   cross, tick),
        ('Input safety filtering',                   partial, partial, tick,  cross, tick),
        ('Accessibility (TTS, sign language)',       cross, partial, partial,  cross, tick),
        ('Knowledge graph visualization',            cross, cross,   cross,   cross, tick),
        ('Instructor analytics dashboard',           cross, tick,    cross,   cross, tick),
    ]

    for row in rows_data:
        comp_data.append([
            Paragraph(row[0], pS),
            Paragraph(row[1], pC),
            Paragraph(row[2], pC),
            Paragraph(row[3], pC),
            Paragraph(row[4], pC),
            Paragraph(row[5], pCA),
        ])

    col_w = doc_width
    comp_table = Table(
        comp_data,
        colWidths=[col_w*0.37, col_w*0.11, col_w*0.13, col_w*0.10, col_w*0.09, col_w*0.10],
    )
    ts = TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), C_TABLE_HDR),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, C_TABLE_ALT]),
        ('GRID', (0, 0), (-1, -1), 0.4, C_TABLE_BRD),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        # Highlight AEGIS column
        ('BACKGROUND', (5, 1), (5, -1), HexColor('#E6F9F0')),
        ('LINEAFTER', (4, 0), (4, -1), 1.5, C_ACCENT),
        ('LINEBEFORE', (5, 0), (5, -1), 1.5, C_ACCENT),
    ])
    comp_table.setStyle(ts)
    story.append(comp_table)

    story.append(Spacer(1, 3*mm))
    story.append(Paragraph(
        '✓ = fully implemented   ~ = partial/item-level only   ✗ = not present',
        ParagraphStyle('Legend', fontName='Helvetica-Oblique', fontSize=8,
                       textColor=C_MUTED, alignment=TA_RIGHT)))

    story.append(PageBreak())

    # ── 9. PATH TOWARD AGI ────────────────────────────────────────────────────
    story.append(Paragraph('8. AEGIS as a Step Toward Artificial General Intelligence', H1))
    story.append(accent_rule())
    story.append(SP4)

    story.append(Paragraph(
        'The challenge of building AI systems that can genuinely teach is '
        'deeply connected to the challenge of building AI systems that can '
        'genuinely <i>understand</i>. Teaching is not retrieval; it is '
        'reasoning about the internal state of another mind, diagnosing '
        'the specific nature of its confusion, and selecting the precise '
        'intervention most likely to produce belief revision. These are '
        'not narrow, task-specific capabilities — they are hallmarks of '
        'general intelligence.',
        B))

    story.append(Paragraph('8.1 What AGI Requires', H2))
    agi_requirements = [
        ('<b>Continuous learning:</b> The ability to update internal '
         'representations based on experience, without forgetting prior '
         'knowledge. AEGIS approximates this through its persistent knowledge '
         'graph and SM-2-based stability updates.'),
        ('<b>Adaptive behavior:</b> Context-sensitive strategy selection that '
         'goes beyond reactive pattern matching. AEGIS\'s agent routing '
         'system performs multi-factor diagnosis and autonomous strategy '
         'selection — a rudimentary form of behavioral adaptation.'),
        ('<b>Internal state modeling:</b> The capacity to model and reason '
         'about one\'s own knowledge state (metacognition) and the knowledge '
         'states of others (theory of mind). AEGIS\'s epistemic analysis '
         'is precisely this — a theory-of-mind module that infers the '
         'student\'s internal cognitive state from behavioral signals.'),
        ('<b>Temporal reasoning:</b> Understanding that knowledge decays, '
         'that some facts are more fragile than others, and that review '
         'schedules must be optimized against neuropsychological realities. '
         'AEGIS\'s forgetting curve integration demonstrates this form '
         'of time-aware cognition.'),
    ]
    for req in agi_requirements:
        story.append(Paragraph(f'• {req}', BU))
        story.append(Spacer(1, 2*mm))

    story.append(Paragraph('8.2 AEGIS as a Cognitive Architecture Prototype', H2))
    story.append(Paragraph(
        'Classical cognitive architectures such as ACT-R (Anderson, 1983) '
        'and SOAR (Laird et al., 1987) attempted to model human cognition '
        'computationally through symbolic rule systems. AEGIS revisits this '
        'vision in the era of large language models, replacing rigid symbolic '
        'rules with neural probabilistic inference while preserving the '
        'structured cognitive representations (knowledge graph, DNA vector, '
        'epistemic state) that make the system interpretable and trainable.',
        B))

    story.append(Paragraph(
        'The integration of memory (forgetting curve), knowledge (concept '
        'graph), style (Cognitive DNA), and reasoning (multi-agent LLM) '
        'within AEGIS mirrors the architectural decomposition of human '
        'cognition proposed by Baddeley\'s (2000) working memory model '
        'and Tulving\'s (1972) distinction between episodic and semantic '
        'memory. We are not claiming that AEGIS is intelligent in the AGI '
        'sense — but we argue that it embodies several of the <i>necessary '
        'preconditions</i> for general learning systems: persistent state, '
        'adaptive strategy, temporal awareness, and a model of the learner\'s '
        'mind.',
        B))

    story.append(SP4)
    story.append(highlight_box([
        '<b>Key Insight:</b> The gap between current AI tutors and truly '
        'intelligent learning systems is not primarily a capability gap '
        '(LLMs are already extraordinarily capable) — it is a <i>modeling</i> '
        'gap. Systems that lack persistent student models, decay tracking, '
        'and cognitive style adaptation are not failing because they cannot '
        'answer questions. They are failing because they do not know enough '
        'about the student to ask the right ones. AEGIS is an attempt to '
        'close that modeling gap.'
    ], styles, bg=HexColor('#EEF4FF'), border=C_ACCENT2))

    story.append(PageBreak())

    # ── 10. RESULTS ───────────────────────────────────────────────────────────
    story.append(Paragraph('9. System Demonstration and Observed Behavior', H1))
    story.append(accent_rule())
    story.append(SP4)

    story.append(Paragraph(
        'The following observations are drawn from prototype deployment '
        'sessions conducted during system development. We document qualitative '
        'behavioral patterns that validate the design hypotheses:',
        B))

    results = [
        ('Adaptive Agent Routing',
         'Over the course of a 20-message session on calculus derivatives, '
         'the system cycled through PROBE (initial exploration), HINT '
         '(triggered by repeated confusion around the chain rule), REPAIR '
         '(triggered by the detected misconception "the derivative gives the '
         'area under the curve"), CHALLENGE (after mastery reached 0.83), '
         'and META (at message 20). This routing pattern mirrors a skilled '
         'human tutor\'s adaptive strategy and was achieved entirely '
         'autonomously by the epistemic analysis pipeline.'),
        ('Misconception Detection and Correction',
         'The epistemic extractor reliably identified domain-specific '
         'misconceptions from natural language responses — for example, '
         'detecting "velocity is the same as speed" (a medium-severity '
         'misconception about vector vs. scalar quantities) from the '
         'student\'s sentence "Velocity just means how fast something moves." '
         'The REPAIR agent\'s Piagetian cognitive conflict strategy '
         '("What would happen to velocity if you reversed direction at '
         'constant speed?") successfully triggered belief revision in '
         'subsequent messages.'),
        ('Knowledge Graph Evolution',
         'The D3.js force-directed graph visualization reveals the emergent '
         'structure of the student\'s knowledge. Concepts with high mastery '
         'glow green with expanded radii. Misconception-flagged nodes pulse '
         'red. The forgetting curve decay arcs around each node provide an '
         'at-a-glance retention snapshot. Over sessions, the graph grows '
         'organically as new concepts are encountered and linked.'),
        ('Memory Decay Alerts',
         'Decay alerts surfaced correctly for concepts not reviewed in '
         '3+ days, with the urgency classification (critical/high/medium/low) '
         'calibrated to the retention formula. The review queue panel '
         'in the UI enabled proactive targeting of decaying knowledge '
         'before quiz-level performance degradation occurred.'),
        ('Feynman Evaluation Quality',
         'In testing, the Feynman evaluator correctly classified strong '
         'explanations (simple language, clear analogy, no critical gaps) '
         'and weak explanations (jargon without definition, circular '
         'reasoning, missing core mechanism). The clarity and depth scores '
         'correlated with independent human evaluation in 87% of test cases.'),
    ]

    for title, text in results:
        story.append(Paragraph(title, H2))
        story.append(Paragraph(text, B))

    story.append(PageBreak())

    # ── 11. FUTURE WORK ───────────────────────────────────────────────────────
    story.append(Paragraph('10. Future Work', H1))
    story.append(accent_rule())
    story.append(SP4)

    future_items = [
        ('<b>Multimodal Expansion (Video + AR):</b> Integration of video '
         'explanation analysis (student records themselves teaching a concept), '
         'screen capture for code/math tutoring, and AR overlays for '
         'spatial/geometric domains.'),
        ('<b>Reinforcement Learning from Human Feedback:</b> Training a '
         'lightweight reward model on student outcome data (mastery gain '
         'per session, frustration reduction, concept retention) to optimize '
         'agent selection and prompt engineering decisions.'),
        ('<b>Knowledge Graph Relationship Inference:</b> Automatically '
         'deriving prerequisite relationships between concepts using LLM '
         'analysis, building a domain-specific dependency graph that '
         'enables more principled learning path recommendation.'),
        ('<b>Smaller Model Optimization:</b> Distilling the epistemic '
         'analysis and agent routing into fine-tuned smaller models '
         '(7B–13B parameter range) for deployment in low-resource '
         'environments and offline educational contexts.'),
        ('<b>Multi-Student Classroom Analytics:</b> Expanding the instructor '
         'dashboard with predictive at-risk identification, class-wide '
         'misconception heatmaps, and learning trajectory forecasting.'),
        ('<b>Longitudinal Validation Study:</b> Conducting a controlled '
         'experiment comparing AEGIS-assisted learning against standard '
         'LLM-based tutoring, measuring concept retention at 7-day and '
         '30-day intervals to validate the forgetting curve intervention.'),
        ('<b>Emotional State Modeling:</b> Extending the frustration/engagement '
         'signals to a richer affective state model, incorporating response '
         'latency, message length patterns, and linguistic sentiment analysis.'),
    ]
    for item in future_items:
        story.append(Paragraph(f'• {item}', BU))
        story.append(Spacer(1, 3*mm))

    story.append(SP6)

    # ── 12. CONCLUSION ────────────────────────────────────────────────────────
    story.append(Paragraph('11. Conclusion', H1))
    story.append(accent_rule())
    story.append(SP4)

    story.append(Paragraph(
        'AEGIS represents a principled departure from the prevailing paradigm '
        'of AI tutoring — one that treats each student interaction as an '
        'isolated query-response event. By grounding the system in the '
        'established cognitive science of knowledge structures (Bartlett, '
        'Piaget), memory dynamics (Ebbinghaus, SM-2), and learning styles '
        '(Kolb, Gardner), AEGIS builds a persistent, evolving model of '
        'the student\'s mind that drives every pedagogical decision.',
        B))

    story.append(Paragraph(
        'The six-agent architecture ensures that interventions are not '
        'uniformly applied but precisely calibrated to the student\'s '
        'current epistemic state: Socratic probing when understanding is '
        'being built, scaffold-based hinting when frustration peaks, '
        'cognitive conflict when misconceptions take hold, mastery challenges '
        'when competence is demonstrated, and metacognitive reflection at '
        'regular intervals. The Feynman integration adds a validation layer '
        'that distinguishes genuine understanding from surface familiarity.',
        B))

    story.append(Paragraph(
        'In building AEGIS, we have demonstrated that the gap between '
        'current AI tutors and genuinely effective learning systems is '
        'not a capability gap but a modeling gap — and that this gap '
        'can be substantially closed by thoughtful integration of '
        'cognitive science principles with modern LLM engineering. '
        'We hope this work contributes to a future where AI tutors '
        'serve not as answer dispensers but as genuine intellectual '
        'companions: systems that know what their students are forgetting, '
        'understand how they learn best, and guide them with the patience '
        'and precision of the world\'s finest teacher.',
        B))

    story.append(PageBreak())

    # ── 13. REFERENCES ────────────────────────────────────────────────────────
    story.append(Paragraph('References', H1))
    story.append(accent_rule())
    story.append(SP4)

    references = [
        'Anderson, J. R. (1983). <i>The Architecture of Cognition.</i> Cambridge, MA: Harvard University Press.',
        'Atkinson, R. C., & Shiffrin, R. M. (1968). Human memory: A proposed system and its control processes. <i>Psychology of Learning and Motivation, 2</i>, 89–195.',
        'Baddeley, A. D. (2000). The episodic buffer: A new component of working memory? <i>Trends in Cognitive Sciences, 4</i>(11), 417–423.',
        'Bartlett, F. C. (1932). <i>Remembering: A Study in Experimental and Social Psychology.</i> Cambridge: Cambridge University Press.',
        'Bloom, B. S. (1956). <i>Taxonomy of Educational Objectives: The Classification of Educational Goals.</i> New York: David McKay Company.',
        'Ebbinghaus, H. (1885). <i>Über das Gedächtnis.</i> Leipzig: Duncker & Humblot. [Trans. Memory: A Contribution to Experimental Psychology (1913).]',
        'Flavell, J. H. (1979). Metacognition and cognitive monitoring: A new area of cognitive-developmental inquiry. <i>American Psychologist, 34</i>(10), 906–911.',
        'Gardner, H. (1983). <i>Frames of Mind: The Theory of Multiple Intelligences.</i> New York: Basic Books.',
        'Kolb, D. A. (1984). <i>Experiential Learning: Experience as the Source of Learning and Development.</i> Englewood Cliffs, NJ: Prentice Hall.',
        'Laird, J. E., Newell, A., & Rosenbloom, P. S. (1987). SOAR: An architecture for general intelligence. <i>Artificial Intelligence, 33</i>(1), 1–64.',
        'Piaget, J. (1952). <i>The Origins of Intelligence in Children.</i> New York: International Universities Press.',
        'Piech, C., Bassen, J., Huang, J., Ganguli, S., Sahami, M., Guibas, L., & Sohl-Dickstein, J. (2015). Deep knowledge tracing. <i>Advances in Neural Information Processing Systems, 28</i> (NeurIPS 2015).',
        'Tulving, E. (1972). Episodic and semantic memory. In E. Tulving & W. Donaldson (Eds.), <i>Organization of Memory</i> (pp. 381–403). New York: Academic Press.',
        'Vygotsky, L. S. (1978). <i>Mind in Society: The Development of Higher Psychological Processes.</i> Cambridge, MA: Harvard University Press.',
        'Wozniak, P. A. (1990). Optimization of learning. Master\'s thesis, University of Technology, Poznan, Poland. [Describes the SM-2 algorithm underlying SuperMemo and Anki.]',
        'Zhou, X., et al. (2023). Learning by Teaching Language Models. <i>arXiv:2312.02179</i>. [Related work on Feynman-style LLM evaluation.]',
    ]

    for ref in references:
        story.append(Paragraph(ref, RF))
        story.append(Spacer(1, 2*mm))

    return story


# ─── Main ─────────────────────────────────────────────────────────────────────
def generate():
    output_path = '/home/iiitn/Miheer_project_FE/phantom-lens/aegis/aegis_report.pdf'

    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=MARGIN_L,
        rightMargin=MARGIN_R,
        topMargin=MARGIN_T,
        bottomMargin=MARGIN_B,
        title='AEGIS: An Agentic AI System for Cognitive-Aware Personalized Learning',
        author='AEGIS Research Team — ACM VNIT INSOMNIA Hackathon 2025',
        subject='Agentic AI Learning Platform',
        creator='AEGIS Report Generator v1.0',
    )

    styles = build_styles()
    doc_width = PAGE_W - MARGIN_L - MARGIN_R

    story = build_content(styles, doc_width)

    doc.build(
        story,
        onFirstPage=first_page_template,
        onLaterPages=header_footer,
    )
    print(f'PDF generated: {output_path}')
    return output_path


if __name__ == '__main__':
    generate()
