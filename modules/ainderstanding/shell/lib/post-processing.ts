import type { AgentContext } from '@/core/types/agent';

// Supervisor-owned post-processing (BR-SHL-045b).
// The PostToolUse hooks in core/orchestration/hooks.ts handle the deterministic
// cross-phase triggers. This function handles any additional session-level
// cleanup after the supervisor run completes.
export async function runPostProcessing(_ctx: AgentContext): Promise<void> {
  // No-op in P0d — PostToolUse hooks in supervisorHooks cover the mandatory cases.
}
