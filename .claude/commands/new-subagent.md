Scaffold a new AIBIo subagent with correct boilerplate.

Arguments: $ARGUMENTS
(format: "<agent-name> [haiku|sonnet]", e.g. "schema-validator haiku" or "etl-planner sonnet")

## AIBIo subagent architecture

Each subagent lives in `src/modules/ainderstanding/<module>/agents/<agent-name>.ts` or `src/core/agents/<agent-name>.ts` for cross-module agents.

Subagents:
- Use `@anthropic-ai/sdk` directly (no LangChain)
- Receive an `AgentContext` via `AsyncLocalStorage` (from `core/agent-sdk/context.ts`)
- Call MCP tools via `callTool(name, args, ctx)` from `core/agent-sdk/mcp-server.ts`
- Emit SSE events via `sseEmitter.emit(workspaceId, event)` from `core/agent-sdk/streaming.ts`
- Handle `tool_use` stop reason in a loop (standard Anthropic tool-use pattern)
- Include `cache_control: { type: "ephemeral" }` on system prompt for prompt caching

## Steps

1. **Parse arguments** — extract agent name and model from `$ARGUMENTS`. Default model: `sonnet` unless explicitly `haiku`.

2. **Determine location** — infer from agent name which module it belongs to. If cross-module, use `src/core/agents/`. If module-specific, ask which module.

3. **Create the agent file** with this structure:
   ```typescript
   import Anthropic from '@anthropic-ai/sdk';
   import type { MessageParam } from '@anthropic-ai/sdk/resources/messages.js';
   import { getAgentContext } from '@/core/agent-sdk/context.js';
   import { sseEmitter } from '@/core/agent-sdk/streaming.js';
   import { callTool, getToolsForAgent } from '@/core/agent-sdk/mcp-server.js';
   // ... relevant tool imports

   const client = new Anthropic();
   const MODEL = 'claude-haiku-4-5-20251001'; // or claude-sonnet-4-6

   export async function run<AgentName>(input: <InputType>): Promise<<OutputType>> {
     const ctx = getAgentContext();
     
     sseEmitter.emit(ctx.workspaceId, {
       type: 'agent_thinking',
       agentName: '<agent-name>',
     });

     const messages: MessageParam[] = [
       { role: 'user', content: /* build from input */ }
     ];

     while (true) {
       const response = await client.messages.create({
         model: MODEL,
         max_tokens: 4096,
         system: [{
           type: 'text',
           text: SYSTEM_PROMPT,
           cache_control: { type: 'ephemeral' },
         }],
         tools: getToolsForAgent('<agent-name>'),
         messages,
       });

       if (response.stop_reason === 'end_turn') {
         const text = response.content
           .filter(b => b.type === 'text')
           .map(b => b.text)
           .join('');
         sseEmitter.emit(ctx.workspaceId, {
           type: 'agent_message',
           agentName: '<agent-name>',
           text,
         });
         return /* parse text into OutputType */;
       }

       if (response.stop_reason === 'tool_use') {
         const toolUseBlocks = response.content.filter(b => b.type === 'tool_use');
         const toolResults = await Promise.all(
           toolUseBlocks.map(async (block) => {
             sseEmitter.emit(ctx.workspaceId, {
               type: 'tool_call',
               agentName: '<agent-name>',
               toolName: block.name,
             });
             const result = await callTool(block.name, block.input as Record<string, unknown>, ctx);
             sseEmitter.emit(ctx.workspaceId, {
               type: 'tool_result',
               toolName: block.name,
               summary: String(result).slice(0, 100),
               success: true,
             });
             return {
               type: 'tool_result' as const,
               tool_use_id: block.id,
               content: JSON.stringify(result),
             };
           })
         );

         messages.push({ role: 'assistant', content: response.content });
         messages.push({ role: 'user', content: toolResults });
         continue;
       }

       throw new Error(`Unexpected stop_reason: ${response.stop_reason}`);
     }
   }
   ```

4. **Write the SYSTEM_PROMPT** — specific to the agent's responsibility. Include:
   - What the agent does (1 sentence)
   - What tools it can use and when
   - What format to return results in
   - GDPR constraints if it touches data (Tier 1/2/3 rules)

5. **Register tools** — if this agent needs new MCP tools, scaffold them in the appropriate module's `tools/` directory following the `ToolDefinition` pattern from `core/agent-sdk/tool-registry.ts`.

6. **Update agent type** — add the new agent name to `SubagentName` union in `core/types/agent.ts`.

7. **Run `npx tsc --noEmit`** to verify no type errors.
