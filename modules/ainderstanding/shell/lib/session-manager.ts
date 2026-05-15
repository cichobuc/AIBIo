import { randomUUID } from 'node:crypto';

export type Session = {
  sessionId: string;
  workspaceId: string;
  createdAt: string;
};

// One active session per workspace (BR-SHL-033)
const activeSessions = new Map<string, Session>();

export function createSession(workspaceId: string): Session {
  const session: Session = {
    sessionId: randomUUID(),
    workspaceId,
    createdAt: new Date().toISOString(),
  };
  activeSessions.set(workspaceId, session);
  return session;
}

export function getActiveSession(workspaceId: string): Session | null {
  return activeSessions.get(workspaceId) ?? null;
}

export function endSession(sessionId: string): void {
  for (const [workspaceId, session] of activeSessions) {
    if (session.sessionId === sessionId) {
      activeSessions.delete(workspaceId);
      return;
    }
  }
}
