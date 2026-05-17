import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { getAllTools, getTool } from './tool-registry';
import { getAgentContext, withAgentContext } from './context';
import type { AgentContext } from './context';

type PropSchema = { type?: string; description?: string; enum?: unknown[] };

function propToZod(schema: PropSchema): z.ZodTypeAny {
  if (schema.enum && Array.isArray(schema.enum) && schema.enum.length > 0) {
    if (schema.enum.every((v) => typeof v === 'string')) {
      const values = schema.enum as [string, ...string[]];
      const e = z.enum(values);
      return schema.description ? e.describe(schema.description) : e;
    }
  }
  const base = ((): z.ZodTypeAny => {
    switch (schema.type) {
      case 'string': return z.string();
      case 'number':
      case 'integer': return z.number();
      case 'boolean': return z.boolean();
      case 'array': return z.array(z.unknown());
      case 'object': return z.record(z.string(), z.unknown());
      default: return z.unknown();
    }
  })();
  return schema.description ? base.describe(schema.description) : base;
}

function buildZodShape(
  properties: Record<string, unknown>,
  required: Set<string>,
): z.ZodRawShape {
  const shape: z.ZodRawShape = {};
  for (const [k, v] of Object.entries(properties)) {
    const zodField = propToZod(v as PropSchema);
    shape[k] = required.has(k) ? zodField : zodField.optional();
  }
  return shape;
}

declare global {
  // eslint-disable-next-line no-var
  var __aibio_mcp_sdk: ReturnType<typeof createSdkMcpServer> | undefined;
}

export function getMcpServer(): ReturnType<typeof createSdkMcpServer> {
  if (global.__aibio_mcp_sdk) return global.__aibio_mcp_sdk;

  global.__aibio_mcp_sdk = createSdkMcpServer({
    name: 'aibio',
    version: '0.1.0',
    tools: getAllTools().map((def) => {
      const required = new Set(def.inputSchema.required ?? []);
      const shape = buildZodShape(def.inputSchema.properties, required);
      return tool(
        def.name,
        def.description,
        shape,
        async (args) => {
          const ctx = getAgentContext();
          if (ctx && !def.allowedCallers.includes(ctx.agentName)) {
            return {
              content: [{
                type: 'text' as const,
                text: JSON.stringify({
                  error: 'PERMISSION_DENIED',
                  message: `Tool "${def.name}" is not allowed for agent "${ctx.agentName}". Allowed: ${def.allowedCallers.join(', ')}`,
                }),
              }],
              isError: true,
            };
          }
          const result = await def.handler(args as Record<string, unknown>, ctx!);
          return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
        },
      );
    }),
  });

  return global.__aibio_mcp_sdk;
}

export async function callTool<TOutput = unknown>(
  name: string,
  args: Record<string, unknown>,
  ctx: AgentContext,
): Promise<TOutput> {
  const def = getTool(name);
  if (!def) throw new Error(`Unknown tool: ${name}`);
  if (!def.allowedCallers.includes(ctx.agentName)) {
    throw new Error(
      `Tool "${name}" is not allowed for agent "${ctx.agentName}". Allowed: ${def.allowedCallers.join(', ')}`,
    );
  }
  return withAgentContext(ctx, () => def.handler(args, ctx) as Promise<TOutput>);
}
