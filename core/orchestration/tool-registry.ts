import type { ApprovalGateType } from '@/core/types/permissions';
import type { ActorName } from '@/core/types/agent';
import type { AgentContext } from './context';

type AgentTool = {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
};

export type JsonSchema = {
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
};

export type ToolHandler<TInput = Record<string, unknown>, TOutput = unknown> = (
  args: TInput,
  ctx: AgentContext,
) => Promise<TOutput>;

export type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  handler: ToolHandler;
  allowedCallers: ActorName[];
  requiresApproval: ApprovalGateType | null;
};

declare global {
  // eslint-disable-next-line no-var
  var __aibio_tool_registry: Map<string, ToolDefinition> | undefined;
}

if (!global.__aibio_tool_registry) {
  global.__aibio_tool_registry = new Map();
}

const registry = global.__aibio_tool_registry;

export function registerTool(def: ToolDefinition): void {
  if (registry.has(def.name)) {
    throw new Error(`MCP tool already registered: ${def.name}`);
  }
  registry.set(def.name, def);
}

export function getTool(name: string): ToolDefinition | undefined {
  return registry.get(name);
}

export function getAllTools(): ToolDefinition[] {
  return Array.from(registry.values());
}

export function getToolsForAgent(agentName: ActorName): AgentTool[] {
  return getAllTools()
    .filter((t) => t.allowedCallers.includes(agentName))
    .map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema,
    }));
}
