'use client';

import { useEffect, useRef } from 'react';
import { ChevronRight } from 'lucide-react';
import { AgentBadge } from '@/core/ui';
import type { SSEEvent } from '@/core/orchestration/streaming';
import { ToolCallChip } from './ToolCallChip';

type ThinkingEvent = Extract<SSEEvent, { type: 'agent_thinking' | 'tool_call' | 'tool_result' }>;

export function pairToolResults(
  events: ThinkingEvent[],
): Map<string, { success: boolean; summary: string }> {
  const map = new Map<string, { success: boolean; summary: string }>();
  for (const e of events) {
    if (e.type === 'tool_result') {
      map.set(e.payload.toolCallId, { success: e.payload.success, summary: e.payload.summary });
    }
  }
  return map;
}

export function ThinkingLog({ events }: { events: ThinkingEvent[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const toolResults = pairToolResults(events);

  const visibleCount = events.filter((e) => e.type !== 'tool_result').length;
  const lastAgent = [...events].reverse().find(
    (e) => e.type === 'agent_thinking' || e.type === 'tool_call',
  );
  const lastAgentName =
    lastAgent?.type === 'agent_thinking' || lastAgent?.type === 'tool_call'
      ? lastAgent.payload.agentName
      : null;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events.length]);

  if (visibleCount === 0) return null;

  return (
    <details className="group rounded border border-border bg-secondary/30 text-caption">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-2 py-1.5 text-muted-foreground hover:text-foreground transition-colors select-none">
        <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
        <span className="animate-spin leading-none">⟳</span>
        <span>Thinking ({visibleCount})</span>
        {lastAgentName && (
          <>
            <span className="text-border">·</span>
            <AgentBadge name={lastAgentName} className="text-caption" />
          </>
        )}
      </summary>
      <div className="border-t border-border px-2 py-1.5 space-y-1 max-h-48 overflow-y-auto">
        {events.map((e, i) => {
          if (e.type === 'agent_thinking') {
            return (
              <div key={i} className="flex items-center gap-1.5 text-muted-foreground">
                <AgentBadge name={e.payload.agentName} className="text-caption" />
                <span>{e.payload.message}</span>
              </div>
            );
          }
          if (e.type === 'tool_call') {
            return (
              <ToolCallChip
                key={i}
                toolName={e.payload.toolName}
                toolCallId={e.payload.toolCallId}
                result={toolResults.get(e.payload.toolCallId)}
              />
            );
          }
          return null;
        })}
        <div ref={bottomRef} />
      </div>
    </details>
  );
}
