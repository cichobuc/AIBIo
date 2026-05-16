import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import type { SSEEvent } from '@/core/orchestration/streaming';

export type TranslatorContext = {
  workspaceId: string;
  sessionId: string;
  agentName: string;
};

// Runtime-safe block extractors — SDKMessage.message.content is unknown[] at runtime
type RawBlock = Record<string, unknown>;

function isTextBlock(b: RawBlock): b is { type: 'text'; text: string } {
  return b['type'] === 'text' && typeof b['text'] === 'string';
}

function isThinkingBlock(b: RawBlock): b is { type: 'thinking' } {
  return b['type'] === 'thinking';
}

function isToolUseBlock(b: RawBlock): b is { type: 'tool_use'; id: string; name: string } {
  return b['type'] === 'tool_use' && typeof b['id'] === 'string' && typeof b['name'] === 'string';
}

function isToolResultBlock(b: RawBlock): b is {
  type: 'tool_result';
  tool_use_id: string;
  content: unknown;
  is_error?: boolean;
} {
  return b['type'] === 'tool_result' && typeof b['tool_use_id'] === 'string';
}

function extractResultText(content: unknown): string {
  if (typeof content === 'string') return content.slice(0, 120);
  if (Array.isArray(content)) {
    const first = content.find(
      (b): b is { type: 'text'; text: string } =>
        typeof b === 'object' && b !== null && (b as RawBlock)['type'] === 'text',
    );
    return typeof first?.text === 'string' ? first.text.slice(0, 120) : '';
  }
  return '';
}

function rawContent(msg: unknown): RawBlock[] {
  if (
    typeof msg === 'object' &&
    msg !== null &&
    'content' in msg &&
    Array.isArray((msg as { content: unknown }).content)
  ) {
    return (msg as { content: RawBlock[] }).content;
  }
  return [];
}

function makeBase(ctx: TranslatorContext) {
  return {
    workspaceId: ctx.workspaceId,
    sessionId: ctx.sessionId,
    timestamp: new Date().toISOString(),
  };
}

export function translateSDKMessage(
  message: SDKMessage,
  ctx: TranslatorContext,
): SSEEvent[] {
  const base = makeBase(ctx);
  const events: SSEEvent[] = [];

  if (message.type === 'assistant') {
    const blocks = rawContent(message.message);
    for (const block of blocks) {
      if (isThinkingBlock(block)) continue;
      if (isTextBlock(block) && block.text.trim()) {
        events.push({
          ...base,
          type: 'agent_message',
          payload: {
            agentName: ctx.agentName,
            content: block.text,
            isPartial: false,
            messageId: crypto.randomUUID(),
            role: 'assistant',
          },
        });
      } else if (isToolUseBlock(block)) {
        events.push({
          ...base,
          type: 'tool_call',
          payload: {
            agentName: ctx.agentName,
            toolName: block.name,
            toolCallId: block.id,
          },
        });
      }
    }
    return events;
  }

  if (message.type === 'user') {
    const blocks = rawContent(message.message);
    for (const block of blocks) {
      if (isToolResultBlock(block)) {
        events.push({
          ...base,
          type: 'tool_result',
          payload: {
            toolCallId: block.tool_use_id,
            toolName: '',
            success: !block.is_error,
            summary: extractResultText(block.content),
          },
        });
      }
    }
    return events;
  }

  // system, result, rate_limit_event → skip
  return events;
}
