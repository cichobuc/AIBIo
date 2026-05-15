**Deprecated** — use `/new-agent` instead. This command uses old flat-agent patterns; `/new-agent` supports the Two-Tier architecture (Tier 2 coordinator vs Tier 3 atomic).

Scaffold a new AIBIo subagent with correct boilerplate.

Arguments: $ARGUMENTS
(format: "<agent-name> [haiku|sonnet]", e.g. "schema-validator haiku" or "etl-planner sonnet")

## AIBIo subagent architecture

Each subagent lives in `src/modules/ainderstanding/<module>/agents/<agent-name>.ts` or `src/core/agents/<agent-name>.ts` for cross-module agents.

Subagents:
- Use `@anthropic-ai/claude-agent-sdk` directly (no LangChain)
- Receive an `AgentContext` via `AsyncLocalStorage` (from `core/orchestration/context.ts`)
- Call MCP tools via `callTool(name, args, ctx)` from `core/orchestration/mcp-server.ts`
- Emit SSE events via `sseEmitter.emit(workspaceId, event)` from `core/orchestration/streaming.ts`
- Handle `tool_use` stop reason in a loop (standard Anthropic tool-use pattern)
- Include `cache_control: { type: "ephemeral" }` on system prompt for prompt caching

## Steps

1. **Parse arguments** — extract agent name and model from `$ARGUMENTS`. Default model: `sonnet` unless explicitly `haiku`.

2. **Determine location** — infer from agent name which module it belongs to. If cross-module, use `src/core/agents/`. If module-specific, ask which module.

3. **Create the agent file** with this structure:
   ```typescript
   import { query } from '@anthropic-ai/claude-agent-sdk';
   import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
   import { getAgentContext } from '@/core/orchestration/context.js';
   import { sseEmitter } from '@/core/orchestration/streaming.js';
   import { getToolsForAgent } from '@/core/orchestration/mcp-server.js';
   // ... relevant tool imports

   const MODEL = 'claude-haiku-4-5-20251001'; // or claude-sonnet-4-6

   export async function run<AgentName>(input: <InputType>): Promise<<OutputType>> {
     const ctx = getAgentContext();

     sseEmitter.emit(ctx.workspaceId, {
       type: 'agent_thinking',
       agentName: '<agent-name>',
     });

     let finalText = '';

     for await (const message of query({
       model: MODEL,
       system: [{
         type: 'text',
         text: SYSTEM_PROMPT,
         cache_control: { type: 'ephemeral' },
       }],
       tools: getToolsForAgent('<agent-name>'),
       messages: [{ role: 'user', content: /* build from input */ }],
     })) {
       if (message.type === 'text') {
         finalText += message.text;
         sseEmitter.emit(ctx.workspaceId, {
           type: 'agent_message',
           agentName: '<agent-name>',
           text: message.text,
         });
       } else if (message.type === 'tool_use') {
         sseEmitter.emit(ctx.workspaceId, {
           type: 'tool_call',
           agentName: '<agent-name>',
           toolName: message.name,
         });
       } else if (message.type === 'tool_result') {
         sseEmitter.emit(ctx.workspaceId, {
           type: 'tool_result',
           toolName: message.toolName,
           summary: String(message.content).slice(0, 100),
           success: true,
         });
       }
     }

     return /* parse finalText into OutputType */;
   }
   ```

4. **Write the SYSTEM_PROMPT** — specific to the agent's responsibility. Include:
   - What the agent does (1 sentence)
   - What tools it can use and when
   - What format to return results in
   - GDPR constraints if it touches data (Tier 1/2/3 rules)

5. **Register tools** — if this agent needs new MCP tools, scaffold them in the appropriate module's `tools/` directory following the `ToolDefinition` pattern from `core/orchestration/tool-registry.ts`.

6. **Update agent type** — add the new agent name to `SubagentName` union in `core/types/agent.ts`.

7. **Run `npx tsc --noEmit`** to verify no type errors.
