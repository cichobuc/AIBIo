export type SupervisorPhase =
  | 'IDLE'
  | 'CLASSIFYING'
  | 'DISPATCHING'
  | 'WAITING_APPROVAL'
  | 'STREAMING'
  | 'COMPLETING';

export type SupervisorState = {
  sessionId: string;
  workspaceId: string;
  phase: SupervisorPhase;
  turns: number;
  maxTurns: number;
  startedAt: string;
};

const states = new Map<string, SupervisorState>();

export function createSupervisorState(
  sessionId: string,
  workspaceId: string,
  maxTurns = 20,
): SupervisorState {
  const state: SupervisorState = {
    sessionId,
    workspaceId,
    phase: 'IDLE',
    turns: 0,
    maxTurns,
    startedAt: new Date().toISOString(),
  };
  states.set(sessionId, state);
  return state;
}

export function getSupervisorState(sessionId: string): SupervisorState | undefined {
  return states.get(sessionId);
}

export function advanceSupervisorPhase(
  sessionId: string,
  nextPhase: SupervisorPhase,
): SupervisorState {
  const state = states.get(sessionId);
  if (!state) {
    throw new Error(`No supervisor state for session: ${sessionId}`);
  }
  state.phase = nextPhase;
  return state;
}

export function incrementSupervisorTurns(sessionId: string): { turns: number; exceeded: boolean } {
  const state = states.get(sessionId);
  if (!state) {
    throw new Error(`No supervisor state for session: ${sessionId}`);
  }
  state.turns++;
  return { turns: state.turns, exceeded: state.turns >= state.maxTurns };
}

export function cleanupSupervisorState(sessionId: string): void {
  states.delete(sessionId);
}
