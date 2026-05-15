import type { AgentContext } from '@/core/types/agent';

export type CoordinatorResult = {
  agentName: string;
  success: boolean;
  summary: string;
};

export type AgentResult = {
  agentName: string;
  success: boolean;
  output: string;
};

// P0d stubs — real implementations live in each module's coordinator/agent files.
// The supervisor orchestrator calls these via the Claude Agent SDK Task tool;
// these helpers remain for direct invocation paths in tests and dispatch helpers.

export async function invokeCoordinator(
  _name: string,
  _context: AgentContext,
): Promise<CoordinatorResult> {
  throw new Error('invokeCoordinator: coordinator implementations are registered via SDK agents map');
}

export async function invokeAgent(
  _name: string,
  _context: AgentContext,
): Promise<AgentResult> {
  throw new Error('invokeAgent: agent implementations are registered via SDK agents map');
}

export async function invokeParallel<T>(tasks: Array<() => Promise<T>>): Promise<PromiseSettledResult<T>[]> {
  return Promise.allSettled(tasks.map((t) => t()));
}
