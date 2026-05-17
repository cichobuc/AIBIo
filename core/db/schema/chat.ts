import { sqliteTable, text, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { workspaces } from './workspace';

export const chatMessages = sqliteTable(
  'chat_messages',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    sessionId: text('session_id').notNull(),
    threadId: text('thread_id'),
    role: text('role', { enum: ['user', 'assistant'] }).notNull(),
    content: text('content').notNull(),
    agentName: text('agent_name'),
    activeModule: text('active_module'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (t) => [
    index('chat_messages_workspace_session_idx').on(t.workspaceId, t.sessionId, t.createdAt),
    index('chat_messages_thread_idx').on(t.workspaceId, t.threadId, t.createdAt),
  ],
);
