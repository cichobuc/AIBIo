'use client';

import { useEffect, useRef, useMemo } from 'react';
import { ScrollArea } from '@/core/ui';
import { AgentBadge } from '@/core/ui';
import { useWorkspaceStore } from '../store/workspace-store';
import { ToolCallChip } from './ToolCallChip';
import { ApprovalRequiredCard } from './ApprovalRequiredCard';
import { ThinkingLog } from './ThinkingLog';
import type { SSEEvent } from '@/core/orchestration/streaming';

function UserMessage({ event }: { event: Extract<SSEEvent, { type: 'agent_message' }> }) {
  if (!event.payload.content.trim()) return null;
  return (
    <div className="flex flex-col items-end gap-0.5">
      <span className="text-caption text-muted-foreground">You</span>
      <div className="rounded-lg bg-accent-ai/15 px-3 py-2 text-body text-foreground max-w-[85%]">
        <span className="whitespace-pre-wrap">{event.payload.content}</span>
      </div>
    </div>
  );
}

function AgentMessage({ event }: { event: Extract<SSEEvent, { type: 'agent_message' }> }) {
  if (!event.payload.content.trim()) return null;
  return (
    <div className="space-y-1">
      <AgentBadge name={event.payload.agentName} />
      <div className="rounded-lg bg-secondary px-3 py-2 text-body text-foreground">
        <span>{event.payload.content}</span>
        {event.payload.isPartial && (
          <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-foreground" />
        )}
      </div>
    </div>
  );
}

function SystemMessage({ text }: { text: string }) {
  return <p className="text-caption italic text-muted-foreground/70">~ {text}</p>;
}

export function MessageList({ workspaceId, onApproval }: {
  workspaceId: string;
  onApproval: (requestId: string, decision: 'approved' | 'denied') => Promise<void>;
}) {
  const messages = useWorkspaceStore((s) => s.messages);
  const bottomRef = useRef<HTMLDivElement>(null);

  const thinkingEvents = useMemo(
    () => messages.filter(
      (m): m is Extract<SSEEvent, { type: 'agent_thinking' | 'tool_call' | 'tool_result' }> =>
        m.type === 'agent_thinking' || m.type === 'tool_call' || m.type === 'tool_result',
    ),
    [messages],
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  return (
    <ScrollArea className="flex-1 px-3 py-2">
      <div className="space-y-3">
        <ThinkingLog events={thinkingEvents} />
        {messages.map((event, i) => {
          switch (event.type) {
            case 'agent_thinking':
              return null;

            case 'agent_message':
              return event.payload.role === 'user'
                ? <UserMessage key={`${i}-${event.payload.messageId}`} event={event} />
                : <AgentMessage key={`${i}-${event.payload.messageId}`} event={event} />;

            case 'tool_call':
              return null;

            case 'tool_result':
              return null;

            case 'approval_required':
              return (
                <ApprovalRequiredCard
                  key={event.payload.requestId}
                  requestId={event.payload.requestId}
                  agentName={event.payload.agentName}
                  description={event.payload.description}
                  onApprove={(id, decision) => void onApproval(id, decision)}
                />
              );

            case 'approval_resolved':
              return null;

            case 'stream_end':
              return (
                <SystemMessage key={i} text={`Done in ${Math.round(event.payload.totalDurationMs / 1000)}s`} />
              );

            case 'stream_error':
              return (
                <div key={i} className="rounded border border-layer-3/50 bg-layer-3/10 px-3 py-2 text-body text-layer-3">
                  {event.payload.message}
                </div>
              );

            case 'doc_update':
              return <SystemMessage key={i} text={`Doc ${event.payload.action}: ${event.payload.name}`} />;

            case 'coverage_update':
              return <SystemMessage key={i} text={`Coverage: ${event.payload.coveragePct}%`} />;

            case 'model_run_update':
              return (
                <SystemMessage
                  key={i}
                  text={`Model ${event.payload.modelName}: ${event.payload.status}`}
                />
              );

            case 'test_run_update':
              return (
                <SystemMessage
                  key={i}
                  text={`Test ${event.payload.testName}: ${event.payload.status}`}
                />
              );

            case 'schema_update':
              return <SystemMessage key={i} text={`Schema updated: ${event.payload.dataSourceName}`} />;

            default:
              return null;
          }
        })}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
