import { db } from '@/core/db/client';
import { models, lineageEdges } from '../db/schema';
import type { Model, ModelLayer, ModelMaterialization } from '../db/schema';
import { getConfig } from '@/core/config';
import { randomUUID } from 'node:crypto';
import { join, resolve } from 'node:path';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { eq, and } from 'drizzle-orm';

const LAYER_PREFIXES: Record<ModelLayer, string[]> = {
  staging: ['stg_'],
  intermediate: ['int_'],
  marts: ['dim_', 'fct_'],
};

export function getWorkspacePath(workspaceId: string): string {
  return resolve(getConfig().workspacesPath, workspaceId);
}

export function getModelFilePath(workspaceId: string, layer: ModelLayer, name: string): string {
  return join('models', layer, `${name}.sql`);
}

export function getModelFileAbs(workspaceId: string, layer: ModelLayer, name: string): string {
  return join(getWorkspacePath(workspaceId), 'models', layer, `${name}.sql`);
}

export function validateModelName(name: string, layer: ModelLayer): void {
  const validPrefixes = LAYER_PREFIXES[layer];
  const hasValidPrefix = validPrefixes.some((p) => name.startsWith(p));
  if (!hasValidPrefix) {
    throw new Error(
      `Model name "${name}" for layer "${layer}" must start with one of: ${validPrefixes.join(', ')}`,
    );
  }
  if (!/^[a-z][a-z0-9_]*$/.test(name)) {
    throw new Error(
      `Model name "${name}" must be lowercase alphanumeric with underscores (snake_case).`,
    );
  }
}

export async function createModel(input: {
  workspaceId: string;
  name: string;
  layer: ModelLayer;
  materialization?: ModelMaterialization;
  initialSql?: string;
  description?: string;
}): Promise<Model> {
  validateModelName(input.name, input.layer);

  const id = randomUUID();
  const filePath = getModelFilePath(input.workspaceId, input.layer, input.name);
  const absPath = getModelFileAbs(input.workspaceId, input.layer, input.name);
  const now = new Date().toISOString();
  const sql = input.initialSql ?? `-- ${input.name}\nSELECT\n  *\nFROM source('...', '...')\n`;

  await mkdir(join(getWorkspacePath(input.workspaceId), 'models', input.layer), {
    recursive: true,
  });
  await writeFile(absPath, sql, 'utf-8');

  const row: typeof models.$inferInsert = {
    id,
    workspaceId: input.workspaceId,
    name: input.name,
    layer: input.layer,
    materialization: input.materialization ?? 'table',
    status: 'draft',
    filePath,
    description: input.description ?? null,
    isDirty: false,
    createdAt: now,
    updatedAt: now,
  };

  db.insert(models).values(row).run();

  return db.select().from(models).where(eq(models.id, id)).get()!;
}

export async function readModelSql(workspaceId: string, modelId: string): Promise<string> {
  const model = db.select().from(models).where(eq(models.id, modelId)).get();
  if (!model) throw new Error(`Model not found: ${modelId}`);

  const absPath = join(getWorkspacePath(workspaceId), model.filePath);
  if (!existsSync(absPath)) return '';
  return readFile(absPath, 'utf-8');
}

export async function writeModelSql(workspaceId: string, modelId: string, sql: string): Promise<void> {
  const model = db.select().from(models).where(eq(models.id, modelId)).get();
  if (!model) throw new Error(`Model not found: ${modelId}`);

  const absPath = join(getWorkspacePath(workspaceId), model.filePath);
  await mkdir(join(absPath, '..'), { recursive: true });
  await writeFile(absPath, sql, 'utf-8');

  db.update(models)
    .set({ isDirty: true, updatedAt: new Date().toISOString() })
    .where(eq(models.id, modelId))
    .run();
}

export async function deleteModel(workspaceId: string, modelId: string): Promise<void> {
  const model = db.select().from(models).where(eq(models.id, modelId)).get();
  if (!model) return;

  const absPath = join(getWorkspacePath(workspaceId), model.filePath);
  try {
    await unlink(absPath);
  } catch {
    // file may already be gone
  }

  db.delete(models).where(eq(models.id, modelId)).run();
}

export function listModels(workspaceId: string, layer?: ModelLayer): Model[] {
  if (layer) {
    return db
      .select()
      .from(models)
      .where(and(eq(models.workspaceId, workspaceId), eq(models.layer, layer)))
      .all();
  }
  return db.select().from(models).where(eq(models.workspaceId, workspaceId)).all();
}

export function getModel(modelId: string): Model | undefined {
  return db.select().from(models).where(eq(models.id, modelId)).get();
}

export function getModelByName(workspaceId: string, name: string): Model | undefined {
  return db
    .select()
    .from(models)
    .where(and(eq(models.workspaceId, workspaceId), eq(models.name, name)))
    .get();
}

export function setModelDirty(modelId: string, isDirty: boolean): void {
  db.update(models)
    .set({ isDirty, updatedAt: new Date().toISOString() })
    .where(eq(models.id, modelId))
    .run();
}

export function updateModelRunStatus(
  modelId: string,
  status: 'success' | 'failed' | 'approval_denied',
): void {
  db.update(models)
    .set({
      lastRunStatus: status,
      lastRunAt: new Date().toISOString(),
      isDirty: status === 'success' ? false : undefined,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(models.id, modelId))
    .run();
}

export function rebuildLineageEdges(
  workspaceId: string,
  modelId: string,
  edges: Array<{
    refType: 'model_ref' | 'source_ref';
    fromModelId?: string;
    fromSourceRef?: string;
  }>,
): void {
  db.delete(lineageEdges)
    .where(and(eq(lineageEdges.workspaceId, workspaceId), eq(lineageEdges.toModelId, modelId)))
    .run();

  const now = new Date().toISOString();
  for (const edge of edges) {
    db.insert(lineageEdges)
      .values({
        id: randomUUID(),
        workspaceId,
        toModelId: modelId,
        fromModelId: edge.fromModelId ?? null,
        fromSourceRef: edge.fromSourceRef ?? null,
        refType: edge.refType,
        createdAt: now,
      })
      .run();
  }
}
