Scaffold a new AIBIo agent with correct boilerplate.

Arguments: $ARGUMENTS
(format: "<agent-name> [haiku|sonnet] [coordinator|atomic]", e.g. "schema-validator haiku atomic" or "etl-coordinator sonnet coordinator")

## AIBIo Two-Tier Agent Architecture

**Tier 2 — Phase Coordinator:**
- Has `'Task'` as first entry in `tools` array
- Orchestrates Tier 3 atomic agents via `Task('agent-name', ctx)` calls
- Drží intra-phase working memory (retry state, session history)
- Registrovaný v `supervisorAgents` mape v `shell/orchestrator.ts`
- Model: `sonnet` (complex reasoning required)

**Tier 3 — Atomic Agent:**
- **No** `'Task'` in tools — cannot dispatch sub-agents
- Single responsibility — one specific operation
- `AgentDefinition` registrovaný v `supervisorAgents` mape (resolved by coordinators via `Task`)
- Model: `haiku` (speed/cost) or `sonnet` (reasoning-heavy)

All agents:
- Are `AgentDefinition` objects — **never** raw `query()` calls with manual tool loops
- Use `@anthropic-ai/claude-agent-sdk` — no LangChain
- Include `cache_control: { type: "ephemeral" }` on system prompt block
- Call MCP tools via the SDK's built-in tool dispatch — no manual `callTool()` needed in the agent
- Emit SSE events are handled by the streaming adapter in `core/orchestration/streaming.ts`

## Steps

1. **Parse arguments** — extract agent name, model, and tier from `$ARGUMENTS`. Defaults: `sonnet`, `atomic`.

2. **Ask tier clarification** if not provided:
   - Coordinator: orchestrates multiple atomic agents, has retry/session state, uses `Task` tool
   - Atomic: single-responsibility specialist, no `Task` tool, called by coordinators

3. **Determine location:**
   - Coordinators: `modules/ainderstanding/<module>/agents/<module>-coordinator.ts`
   - Atomic agents: `modules/ainderstanding/<module>/agents/<agent-name>.ts`
   - Infer module from agent name; if ambiguous, ask.

4. **Create the `AgentDefinition` file:**

   **Coordinator scaffold:**
   ```typescript
   import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';

   const SYSTEM_PROMPT = `You are the <module>-coordinator for AIBIo AInderstanding.
   You orchestrate the <module> phase by dispatching atomic agents in the correct sequence.
   
   Phase flow:
   1. Task('<first-agent>', context) — sequential
   2. Task('<second-agent>', ...) × N — parallel where applicable
   3. Return compact summary to supervisor: { ... }
   
   Invariants:
   - You NEVER call write tools directly — only atomic agents do
   - Max 3 self-heal retries per model/item — track in your context
   - Always return a summary even on partial failure
   `;

   export const <moduleName>CoordinatorDefinition: AgentDefinition = {
     description: 'Invoke for <module> phase: <one-line trigger description>.',
     prompt: SYSTEM_PROMPT,
     tools: [
       'Task',
       // Read-only orchestration tools this coordinator needs:
       // 'mcp__aibio__read_schema_snapshot',
       // 'mcp__aibio__validate_sql',
       // 'mcp__aibio__parse_lineage',
     ],
     model: 'sonnet',
   };
   ```

   **Atomic agent scaffold:**
   ```typescript
   import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';

   const SYSTEM_PROMPT = `You are the <agent-name> agent for AIBIo AInderstanding.
   <One sentence: what you do.>
   
   Tools available:
   - <tool-name>: <when and why to call it>
   
   Output format: <describe expected structured output>
   
   GDPR constraints: <if touching data, state Tier 1/2/3 rules>
   `;

   export const <agentName>Definition: AgentDefinition = {
     description: 'Invoke when <trigger condition — what task this agent handles>.',
     prompt: SYSTEM_PROMPT,
     tools: [
       'mcp__aibio__<tool_name>',
       // NO 'Task' here — atomic agents cannot dispatch sub-agents
     ],
     model: 'haiku', // or 'sonnet' for reasoning-heavy agents
   };
   ```

5. **Write the system prompt** — specific to the agent's responsibility:
   - What the agent does (1 sentence)
   - What tools it can use and when
   - Expected output format (structure, not prose)
   - GDPR constraints if it touches data (Tier 1/2/3 rules from ARCHITECTURE.md §7)
   - For coordinators: explicit phase flow + self-heal retry instructions

6. **Register MCP tools** — if this agent needs new MCP tools:
   - Add to the module's `lib/mcp-tools.ts` via `registerTool()`
   - Set `allowedCallers` precisely (CR-MCP-002, CR-MCP-004)
   - Write tool at `ToolDefinition` shape from `core/orchestration/tool-registry.ts`
   - Add to `docs/MCP_TOOLS.md` catalog + Tool Ownership Matrix

7. **Update type** — add agent name to appropriate union in `core/types/agent.ts`:
   - Coordinator → `CoordinatorName`
   - Atomic agent → `AtomicAgentName`

8. **Register in `supervisorAgents`** — in `modules/ainderstanding/shell/orchestrator.ts`:
   - Coordinators: in Tier 2 section
   - Atomic agents: in Tier 3 section
   - Both in the same flat `supervisorAgents: Record<string, AgentDefinition>` map

9. **Update `docs/AGENT_PROMPTS.md`** — add the new agent spec section.

10. **Run `npx tsc --noEmit`** to verify no type errors.
