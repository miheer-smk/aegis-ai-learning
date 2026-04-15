/**
 * AEGIS Lightweight Event System
 *
 * Provides a fire-and-forget publish/subscribe bus that decouples
 * event emission from event handling. Handlers run asynchronously
 * and never block the main request pipeline.
 *
 * Events:
 *   user_message          — student sent a message
 *   session_end           — session ended (manual or auto at 15 messages)
 *   time_trigger          — background cognition cycle fired
 *   inactivity_detected   — student has been inactive > 3 days
 *   task_delivered        — a proactive task was surfaced to a student
 *   mastery_breakthrough  — student crossed mastery threshold on a concept
 *   dropout_risk_elevated — dropout risk exceeded 0.6 threshold
 *
 * Design notes:
 *   - No external broker (Redis, etc.) — pure in-process
 *   - Handlers silently swallow errors (background events must not crash requests)
 *   - All emits are logged for observability
 */

import type { AgentType, EpistemicState } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export type EventType =
  | 'user_message'
  | 'session_end'
  | 'time_trigger'
  | 'inactivity_detected'
  | 'task_delivered'
  | 'mastery_breakthrough'
  | 'dropout_risk_elevated';

export interface AegisEvent {
  type: EventType;
  studentId?: string;
  agentType?: AgentType;
  epistemicState?: EpistemicState;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

type EventHandler = (event: AegisEvent) => void | Promise<void>;

// ─── Registry ─────────────────────────────────────────────────────────────────

// Persist handlers across hot reloads in dev (same pattern as DB singleton)
const globalBus = globalThis as typeof globalThis & {
  aegisEventHandlers?: Map<EventType, EventHandler[]>;
};

function getHandlers(): Map<EventType, EventHandler[]> {
  if (!globalBus.aegisEventHandlers) {
    globalBus.aegisEventHandlers = new Map();
  }
  return globalBus.aegisEventHandlers;
}

// ─── Subscribe ────────────────────────────────────────────────────────────────

export function onEvent(type: EventType, handler: EventHandler): void {
  const handlers = getHandlers();
  const existing = handlers.get(type) ?? [];
  handlers.set(type, [...existing, handler]);
}

// ─── Emit ─────────────────────────────────────────────────────────────────────

/**
 * Emits an event to all registered handlers.
 * Fire-and-forget: never awaited, never blocks the caller.
 */
export function emitEvent(event: AegisEvent): void {
  const handlers = getHandlers();
  const eventHandlers = handlers.get(event.type) ?? [];

  for (const handler of eventHandlers) {
    void Promise.resolve()
      .then(() => handler(event))
      .catch(err => {
        console.error(
          `[AEGIS Event] Handler error for ${event.type}:`,
          err instanceof Error ? err.message : String(err)
        );
      });
  }
}

// ─── Convenience Helpers ──────────────────────────────────────────────────────

export function emitUserMessage(
  studentId: string,
  agentType: AgentType,
  epistemicState: EpistemicState
): void {
  emitEvent({
    type: 'user_message',
    studentId,
    agentType,
    epistemicState,
    timestamp: new Date().toISOString(),
  });
}

export function emitSessionEnd(studentId: string, metadata?: Record<string, unknown>): void {
  emitEvent({
    type: 'session_end',
    studentId,
    metadata,
    timestamp: new Date().toISOString(),
  });
}

export function emitDropoutRisk(studentId: string, riskScore: number): void {
  emitEvent({
    type: 'dropout_risk_elevated',
    studentId,
    metadata: { riskScore },
    timestamp: new Date().toISOString(),
  });
}

export function emitMasteryBreakthrough(studentId: string, concept: string, mastery: number): void {
  emitEvent({
    type: 'mastery_breakthrough',
    studentId,
    metadata: { concept, mastery },
    timestamp: new Date().toISOString(),
  });
}

export function emitTimeTrigger(metadata?: Record<string, unknown>): void {
  emitEvent({
    type: 'time_trigger',
    metadata,
    timestamp: new Date().toISOString(),
  });
}
