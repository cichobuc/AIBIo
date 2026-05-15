import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { getAllTools, getTool } from './tool-registry';
import { getAgentContext, withAgentContext } from './context';
import type { AgentContext } from './context';

type McpInstance = { server: Server; client: Client };

declare global {
  // eslint-disable-next-line no-var
  var __aibio_mcp: Promise<McpInstance> | undefined;
}

async function createInstance(): Promise<McpInstance> {
  const server = new Server(
    { name: 'aibio', version: '0.1.0' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: getAllTools().map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const def = getTool(request.params.name);
    if (!def) {
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
    }

    const args = (request.params.arguments ?? {}) as Record<string, unknown>;

    // AgentContext propagates via AsyncLocalStorage through InMemoryTransport's
    // synchronous message passing + Promise microtask chain. getAgentContext()
    // is safe here because callTool() below wraps its caller in withAgentContext().
    const ctx = getAgentContext();

    // CR-MCP-002 / CR-MCP-004: enforce allowedCallers at runtime
    const callerName = ctx?.agentName;
    if (callerName !== undefined && !def.allowedCallers.includes(callerName)) {
      return {
        isError: true,
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            error: 'PERMISSION_DENIED',
            message: `Tool "${request.params.name}" is not allowed for agent "${callerName}". Allowed: ${def.allowedCallers.join(', ')}`,
          }),
        }],
      };
    }

    try {
      const result = await def.handler(args, ctx);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result) }],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new McpError(ErrorCode.InternalError, message);
    }
  });

  const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);

  const client = new Client({ name: 'aibio-client', version: '0.1.0' });
  await client.connect(clientTransport);

  return { server, client };
}

function getMcpInstance(): Promise<McpInstance> {
  if (!global.__aibio_mcp) {
    global.__aibio_mcp = createInstance().catch((err) => {
      global.__aibio_mcp = undefined;
      throw err;
    });
  }
  return global.__aibio_mcp;
}

export async function callTool<TOutput = unknown>(
  name: string,
  args: Record<string, unknown>,
  ctx: AgentContext,
): Promise<TOutput> {
  return withAgentContext(ctx, async () => {
    const { client } = await getMcpInstance();

    const result = await client.callTool({ name, arguments: args });

    const content = result.content as Array<{ type: string; text: string }>;
    const text = content[0]?.text;
    if (text === undefined) {
      throw new Error(`Tool "${name}" returned empty content`);
    }

    if (result.isError) {
      const parsed = JSON.parse(text) as { error: string; message: string };
      throw new Error(parsed.message ?? text);
    }

    return JSON.parse(text) as TOutput;
  });
}
