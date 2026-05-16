import { db } from '@/core/db/client';
import { modelRuns } from '../db/schema';
import type { ModelRun, ModelRunStatus, ModelRunScope } from '../db/schema';
import { randomUUID } from 'node:crypto';
import { eq, desc, and, or } from 'drizzle-orm';

export function startRun(input: {
  workspaceId: string;
  runScope: ModelRunScope;
  sessionId?: string;
  triggeringModelId?: string;
  parentRunId?: string;
  modelNames: string[];
  selfHealAttempt?: number;
}): string {
  const id = randomUUID();
  const now = new Date().toISOString();

  db.insert(modelRuns).values({
    id,
    workspaceId: input.workspaceId,
    runScope: input.runScope,
    sessionId: input.sessionId ?? null,
    triggeringModelId: input.triggeringModelId ?? null,
    parentRunId: input.parentRunId ?? null,
    status: 'running',
    modelsAffectedJson: JSON.stringify(input.modelNames),
    modelsTotal: input.modelNames.length,
    modelsSucceeded: 0,
    modelsFailed: 0,
    selfHealAttempt: input.selfHealAttempt ?? 0,
    startedAt: now,
  }).run();

  return id;
}

export function updateRun(
  runId: string,
  patch: Partial<{
    status: ModelRunStatus;
    modelsSucceeded: number;
    modelsFailed: number;
    errorMessage: string;
    finishedAt: string;
  }>,
): void {
  db.update(modelRuns).set(patch).where(eq(modelRuns.id, runId)).run();
}

export function finishRun(runId: string, status: ModelRunStatus, errorMessage?: string): void {
  db.update(modelRuns)
    .set({
      status,
      finishedAt: new Date().toISOString(),
      errorMessage: errorMessage ?? null,
    })
    .where(eq(modelRuns.id, runId))
    .run();
}

export function getRunsForWorkspace(workspaceId: string, limit = 20): ModelRun[] {
  return db
    .select()
    .from(modelRuns)
    .where(eq(modelRuns.workspaceId, workspaceId))
    .orderBy(desc(modelRuns.startedAt))
    .limit(limit)
    .all();
}

export function getRun(runId: string): ModelRun | undefined {
  return db.select().from(modelRuns).where(eq(modelRuns.id, runId)).get();
}

export function hasRunningRun(workspaceId: string): boolean {
  const row = db
    .select({ id: modelRuns.id })
    .from(modelRuns)
    .where(
      and(
        eq(modelRuns.workspaceId, workspaceId),
        or(eq(modelRuns.status, 'running'), eq(modelRuns.status, 'pending')),
      ),
    )
    .get();
  return row !== undefined;
}
