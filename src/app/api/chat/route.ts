import { NextRequest, NextResponse } from 'next/server';
import { getStudent, getConceptNodes, getChatHistory, insertMessage } from '@/lib/db';
import { analyzeEpistemicState, updateConceptGraph } from '@/lib/epistemic';
import { generateReviewQueue } from '@/lib/decay';
import { inferCognitiveDNA, saveDNA } from '@/lib/cognitiveDNA';
import { selectAgent, buildAgentSystemPrompt, computeAvgMastery } from '@/lib/agents';
import { validateUserInput } from '@/lib/safety';
import {
  detectFeynmanContext, evaluateFeynmanExplanation,
  saveFeynmanResult, getFeynmanCandidates, buildFeynmanTriggerMessage,
} from '@/lib/feynman';
import {
  getCognitiveState, updateCognitiveState, updateTeachingWeights,
  inferStudentDomains, storeTomPrediction, evaluateAndClearTomPrediction,
} from '@/lib/cognitiveState';
import { shouldCompress, summarizeAndCompressMemory } from '@/lib/memory';
import {
  assessResponseConfidence, detectMathContent, generateTomPrediction,
} from '@/lib/verification';
import { processOutput } from '@/lib/outputProcessor';
import { buildHierarchicalContext } from '@/lib/hierarchicalMemory';
import { predictFutureState, buildPredictiveContextString } from '@/lib/predictiveModel';
import {
  analyzeTheoryOfMind, buildToMInsightString, tomGuidedAgentHint,
} from '@/lib/theoryOfMind';

// ── AGI Upgrade Imports ────────────────────────────────────────────────────────
import { startBackgroundCognition } from '@/lib/backgroundCognition';
import { getEmotionState, updateEmotionState, buildEmotionContextString, applyEmotionBias } from '@/lib/emotionEngine';
import { getTutorProfile, buildTutorStateString, recordAgentOutcome } from '@/lib/tutorProfile';
import { processPendingTasks } from '@/lib/autonomousTasks';
import { detectRightQuestion, buildRedirectMessage } from '@/lib/rightQuestionDetector';
import { getCurriculumInsightForConcept, getTopCurriculumInsights } from '@/lib/curriculumInsights';
import { emitUserMessage, emitDropoutRisk, emitMasteryBreakthrough } from '@/lib/eventSystem';

import { v4 as uuidv4 } from 'uuid';
import type { ConceptNode, CognitiveDNA } from '@/types';
import Anthropic from '@anthropic-ai/sdk';
import { MODEL, getAnthropicClient } from '@/lib/anthropic';

// ── Ensure always-on cognition starts with first request ──────────────────────
startBackgroundCognition();

interface ChatBody {
  studentId: string;
  message: string;
  imageBase64?: string;
  imageMimeType?: string;
}

/** Strip any accidentally leaked CoT reasoning block */
function stripCoT(text: string): string {
  return text
    .replace(/^(Step\s+\d+:|REASONING PROTOCOL|━+\s*REASONING.*?━+)/gim, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as ChatBody;
    const { studentId, message, imageBase64, imageMimeType } = body;

    if (!studentId || !message?.trim()) {
      return NextResponse.json({ error: 'studentId and message are required' }, { status: 400 });
    }

    // ── Load student ──────────────────────────────────────────────────────────
    const student = getStudent(studentId) as {
      id: string; name: string; topic: string; goal: string; cognitive_dna: CognitiveDNA;
    } | null;
    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    // ── Stage 1: Input Safety ─────────────────────────────────────────────────
    const safety = await validateUserInput(message, student.topic);
    if (!safety.safe) {
      return NextResponse.json({
        message: safety.blockedResponse || "Let's keep our conversation focused on learning.",
        agentType: 'PROBE',
        epistemicUpdate: {},
        graphUpdated: false,
        decayAlerts: [],
        safetyBlocked: true,
      });
    }
    const safeMessage = safety.sanitizedMessage;

    // ── Stage 2: Load session context ─────────────────────────────────────────
    const rawHistory = getChatHistory(studentId, 16).reverse() as Array<{
      role: string; content: string; agent_type: string; frustration_level: number;
    }>;
    const conceptNodes = getConceptNodes(studentId) as ConceptNode[];

    // ── Stage 3: Always-On Cognitive State ────────────────────────────────────
    const cognitiveState = getCognitiveState(studentId);

    // ── Stage 3a [AGI]: Process pending autonomous tasks ──────────────────────
    // AEGIS acts without being prompted — tasks generated between sessions
    const pendingTasks = processPendingTasks(studentId);

    // ── Stage 3b [AGI]: Load emotion state ────────────────────────────────────
    const emotionState = getEmotionState(studentId);

    // ── Stage 3c [AGI]: Load tutor self-model ─────────────────────────────────
    const tutorProfile = getTutorProfile();

    // ── Stage 4: Hierarchical Memory ─────────────────────────────────────────
    const hierarchical = buildHierarchicalContext(studentId, safeMessage, conceptNodes);

    // ── Stage 5: Predictive Model ─────────────────────────────────────────────
    const predictive = predictFutureState(
      studentId,
      conceptNodes,
      cognitiveState.learningPatterns.avgFrustrationLevel,
      cognitiveState.learningPatterns.totalMessageCount
    );
    const predictiveContext = buildPredictiveContextString(predictive);

    // ── Stage 6: Epistemic Analysis ───────────────────────────────────────────
    const epistemicState = await analyzeEpistemicState(
      [...rawHistory, { role: 'user', content: safeMessage }],
      student.topic
    );

    // ── Stage 6a [AGI]: Right-Question Detection ──────────────────────────────
    // Runs before agent selection — redirects suboptimal questions
    const questionAnalysis = detectRightQuestion(safeMessage, epistemicState, conceptNodes);

    // ── Stage 7: Theory of Mind ───────────────────────────────────────────────
    const tomInsight = analyzeTheoryOfMind(
      epistemicState, safeMessage, conceptNodes, cognitiveState
    );
    const tomContext = buildToMInsightString(tomInsight);

    // Evaluate previous ToM prediction
    let tomAccuracy: number | null = null;
    if (cognitiveState.pendingToMPrediction) {
      tomAccuracy = evaluateAndClearTomPrediction(
        studentId,
        epistemicState.misconceptions.map(m => m.concept),
        epistemicState.frustrationLevel
      );
    }

    // ── Stage 8: Graph Update ─────────────────────────────────────────────────
    await updateConceptGraph(studentId, epistemicState);

    // ── Stage 9: DNA Update ───────────────────────────────────────────────────
    let currentDNA: CognitiveDNA = student.cognitive_dna;
    if (rawHistory.length % 4 === 0) {
      const updatedDNA = await inferCognitiveDNA(
        [...rawHistory, { role: 'user', content: safeMessage }],
        student.cognitive_dna
      );
      await saveDNA(studentId, updatedDNA);
      currentDNA = updatedDNA;
    }

    // ── Stage 10: Feynman Context Detection ───────────────────────────────────
    const lastAssistant = rawHistory.filter(m => m.role === 'assistant').slice(-1)[0];
    const feynmanCtx = lastAssistant
      ? detectFeynmanContext(lastAssistant.content)
      : { isFeynmanResponse: false, concept: null };

    let feynmanResult = undefined;
    let forceAgent = undefined;

    if (feynmanCtx.isFeynmanResponse && feynmanCtx.concept) {
      feynmanResult = await evaluateFeynmanExplanation(
        feynmanCtx.concept, safeMessage, student.topic
      );
      saveFeynmanResult(studentId, feynmanCtx.concept, feynmanResult);
      forceAgent = feynmanResult.triggeredAgent;
    }

    // ── Stage 11: Agent Selection (ToM-guided + teaching weights) ─────────────
    const avgMastery = computeAvgMastery(conceptNodes);
    let agentType = selectAgent(
      epistemicState, avgMastery, rawHistory.length,
      forceAgent, cognitiveState.teachingWeights
    );

    // ToM override
    if (!forceAgent) {
      const tomOverride = tomGuidedAgentHint(tomInsight, agentType);
      if (tomOverride) agentType = tomOverride;
    }

    // [AGI] Emotion bias — soft nudge, never overrides critical rules
    if (!forceAgent) {
      agentType = applyEmotionBias(emotionState, agentType) as typeof agentType;
    }

    const hintsUsed       = rawHistory.filter(m => m.agent_type === 'HINT').length;
    const recentMistakes  = epistemicState.misconceptions.map(m => m.concept);
    const reflectionNumber = Math.floor(rawHistory.length / 5);

    // ── Stage 12: Detect math content + student domains ───────────────────────
    const hasMathContent  = detectMathContent(safeMessage);
    const studentDomains  = inferStudentDomains(rawHistory.map(m => ({ content: m.content })));

    // ── Stage 13 [AGI]: Build enriched system prompt ──────────────────────────
    // Assemble all context layers: hierarchical + predictive + ToM + emotion + tutor + curriculum
    const emotionContext   = buildEmotionContextString(emotionState);
    const tutorContext     = buildTutorStateString(tutorProfile);
    const curriculumContext = getTopCurriculumInsights();

    // Per-concept curriculum insight for the most-relevant concept in this message
    const mostRelevantConcept = conceptNodes
      .filter(n => safeMessage.toLowerCase().includes(n.concept.toLowerCase()))
      .sort((a, b) => b.mastery - a.mastery)[0];
    const conceptCurriculumContext = mostRelevantConcept
      ? getCurriculumInsightForConcept(mostRelevantConcept.concept)
      : '';

    const fullMemoryContext = [
      hierarchical.fullContext,
      predictiveContext,
      tomContext,
      emotionContext,
      tutorContext,
      curriculumContext,
      conceptCurriculumContext,
    ].filter(Boolean).join('\n');

    const systemPrompt = buildAgentSystemPrompt(
      agentType,
      student.name,
      student.topic,
      student.goal,
      epistemicState,
      currentDNA,
      hintsUsed,
      recentMistakes,
      reflectionNumber,
      '',
      fullMemoryContext,
      studentDomains,
      hasMathContent,
      undefined
    );

    // ── Stage 14: LLM Inference ───────────────────────────────────────────────
    const conversationMessages: Anthropic.MessageParam[] = rawHistory.map(m => ({
      role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.content,
    }));

    let newUserContent: Anthropic.MessageParam['content'];
    if (imageBase64) {
      const mimeType = (imageMimeType || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
      newUserContent = [
        { type: 'image' as const, source: { type: 'base64' as const, media_type: mimeType, data: imageBase64 } },
        { type: 'text' as const, text: safeMessage },
      ];
    } else {
      newUserContent = safeMessage;
    }
    conversationMessages.push({ role: 'user', content: newUserContent });

    const client = getAnthropicClient();
    const aiResponse = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages: conversationMessages,
    });

    const rawResponseText = aiResponse.content[0]?.type === 'text'
      ? aiResponse.content[0].text
      : 'I need a moment to think about that.';

    const stripped   = stripCoT(rawResponseText);
    const processed  = processOutput(stripped, hasMathContent);
    let responseText = processed.text;

    // ── Stage 14a [AGI]: Prepend right-question redirect if needed ────────────
    if (!questionAnalysis.isOptimal && questionAnalysis.redirectMessage) {
      responseText = questionAnalysis.redirectMessage + '\n\n' + responseText;
    }

    // ── Stage 14b [AGI]: Prepend proactive task messages ─────────────────────
    // These come from tasks generated while the student was away
    if (pendingTasks.length > 0) {
      const taskBlock = pendingTasks
        .map(t => `> **${taskLabel(t.type)}:** ${t.message}`)
        .join('\n\n');
      responseText = taskBlock + '\n\n---\n\n' + responseText;
    }

    // ── Stage 15: Anti-Hallucination Confidence Assessment ────────────────────
    const verification = assessResponseConfidence(responseText, epistemicState, safeMessage);

    // ── Stage 16: Feynman Trigger Check ───────────────────────────────────────
    let finalResponse    = responseText;
    let triggeringFeynman = false;
    if (!feynmanCtx.isFeynmanResponse && agentType !== 'FEYNMAN') {
      const updatedNodes = getConceptNodes(studentId) as ConceptNode[];
      const candidates   = getFeynmanCandidates(updatedNodes);
      if (candidates.length > 0 && rawHistory.length > 0 && rawHistory.length % 6 === 0) {
        finalResponse    = responseText + '\n\n---\n\n' + buildFeynmanTriggerMessage(candidates[0].concept);
        triggeringFeynman = true;
      }
    }

    // ── Stage 17: Persist messages ────────────────────────────────────────────
    const now = new Date().toISOString();
    insertMessage({
      id: uuidv4(), student_id: studentId, role: 'user',
      content: safeMessage, agent_type: agentType,
      timestamp: now, frustration_level: epistemicState.frustrationLevel,
    });
    insertMessage({
      id: uuidv4(), student_id: studentId, role: 'assistant',
      content: finalResponse,
      agent_type: triggeringFeynman ? 'FEYNMAN' : agentType,
      timestamp: new Date(Date.now() + 1).toISOString(),
      frustration_level: epistemicState.frustrationLevel,
    });

    // ── Stage 18: Background cognitive updates (fire-and-forget) ─────────────
    const prevFrustration = rawHistory.length > 0
      ? (rawHistory[rawHistory.length - 1].frustration_level || 0)
      : 0;
    const masteryDelta     = avgMastery - computeAvgMastery(conceptNodes);
    const frustrationDelta = epistemicState.frustrationLevel - prevFrustration;

    // Count consecutive failures (frustration increasing messages)
    let consecutiveFailures = 0;
    for (let i = rawHistory.length - 1; i >= 0 && i >= rawHistory.length - 3; i--) {
      if ((rawHistory[i].frustration_level || 0) > 0.5) consecutiveFailures++;
      else break;
    }

    void Promise.resolve().then(() => {
      // Existing
      updateTeachingWeights(studentId, agentType, masteryDelta, frustrationDelta);

      const tomPrediction = generateTomPrediction(agentType, epistemicState, epistemicState.frustrationLevel);
      storeTomPrediction(studentId, tomPrediction);

      updateCognitiveState(studentId, {
        learningPatterns: {
          ...cognitiveState.learningPatterns,
          totalMessageCount: cognitiveState.learningPatterns.totalMessageCount + 1,
          avgFrustrationLevel:
            (cognitiveState.learningPatterns.avgFrustrationLevel * 0.9) +
            (epistemicState.frustrationLevel * 0.1),
          inferredDomains: Array.from(
            new Set(cognitiveState.learningPatterns.inferredDomains.concat(studentDomains))
          ).slice(0, 6),
        },
      });

      // [AGI] Update emotion state
      updateEmotionState(studentId, epistemicState, masteryDelta, consecutiveFailures);

      // [AGI] Record agent outcome in tutor self-model
      recordAgentOutcome(agentType, masteryDelta, frustrationDelta);

      // [AGI] Emit events
      emitUserMessage(studentId, agentType, epistemicState);
      if (predictive.dropoutRisk > 0.6) {
        emitDropoutRisk(studentId, predictive.dropoutRisk);
      }
      // Mastery breakthrough event (concept crossed 0.8 threshold)
      const updatedNodesForEvents = getConceptNodes(studentId) as ConceptNode[];
      for (const node of updatedNodesForEvents) {
        const oldNode = conceptNodes.find(n => n.id === node.id);
        if (oldNode && oldNode.mastery < 0.8 && node.mastery >= 0.8) {
          emitMasteryBreakthrough(studentId, node.concept, node.mastery);
        }
      }
    });

    // Memory compression
    const totalMessages = rawHistory.length + 1;
    if (shouldCompress(totalMessages)) {
      const toCompress = getChatHistory(studentId, 20).reverse() as Array<{
        role: string; content: string;
      }>;
      void summarizeAndCompressMemory(studentId, toCompress, totalMessages - 20);
    }

    // Continuous learning loop trigger (every 15 messages)
    if (totalMessages > 0 && totalMessages % 15 === 0) {
      void fetch(`${request.nextUrl.origin}/api/session-end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId }),
      }).catch(() => {/* non-blocking */});
    }

    // ── Stage 19: Review queue & response ─────────────────────────────────────
    const updatedNodes = getConceptNodes(studentId) as ConceptNode[];
    const reviewQueue  = generateReviewQueue(updatedNodes).slice(0, 5);

    return NextResponse.json({
      message: finalResponse,
      agentType: triggeringFeynman ? 'FEYNMAN' : agentType,
      epistemicUpdate: {
        understood:      epistemicState.understood,
        misconceptions:  epistemicState.misconceptions,
        frustrationLevel: epistemicState.frustrationLevel,
        engagementLevel: epistemicState.engagementLevel,
      },
      graphUpdated: epistemicState.understood.length > 0 || epistemicState.misconceptions.length > 0,
      decayAlerts:  reviewQueue.filter(r => r.urgency === 'critical' || r.urgency === 'high'),
      dna:          currentDNA,
      feynmanResult,
      safetyBlocked: false,
      // ── AGI Metadata ──────────────────────────────────────────────────────
      proactiveTasks: pendingTasks.length,
      questionRedirected: !questionAnalysis.isOptimal,
      cognitiveInsights: {
        confidence:       verification.confidence,
        confidenceFlags:  verification.flags,
        mathConsistent:   verification.mathConsistent,
        clarityAdequate:  verification.clarityAdequate,
        outputWasFixed:   processed.wasModified,
        tomAccuracy,
        tomDepth:         tomInsight.reflectionDepth.level,
        tomScore:         tomInsight.overallToMScore,
        hasMathContent,
        studentDomains,
        teachingWeights:  cognitiveState.teachingWeights,
        hierarchicalTokens: hierarchical.tokenEstimate,
        dropoutRisk:      predictive.dropoutRisk,
        bottlenecks:      predictive.bottlenecks,
        nextRecommended:  predictive.learningPath[0]?.concept ?? null,
        // [AGI] New fields
        emotionState:     { ...emotionState },
        tutorSessions:    tutorProfile.totalSessions,
        pendingTaskCount: pendingTasks.length,
      },
    });

  } catch (err) {
    console.error('[POST /api/chat]', err);
    const message = err instanceof Error ? err.message : 'An error occurred';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function taskLabel(type: string): string {
  const labels: Record<string, string> = {
    re_engagement:           'Welcome Back',
    revision_reminder:       'Quick Revision',
    misconception_correction: 'Concept Check',
    feynman_test:            'Feynman Challenge',
    milestone_celebration:   'Milestone',
  };
  return labels[type] ?? 'Note';
}
