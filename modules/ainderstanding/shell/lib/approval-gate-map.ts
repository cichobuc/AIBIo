import type { ApprovalGateType } from '@/core/types/permissions';

// Maps MCP tool names to their approval gate type.
// Tools not listed here are allowed without approval.
const GATED_TOOLS: Record<string, ApprovalGateType> = {
  'mcp__aibio__guarded_run_select_query': 'execute_query',
  'mcp__aibio__guarded_share_results': 'share_results_with_ai',
  'mcp__aibio__write_model_file': 'write_model_file',
  'mcp__aibio__write_test_file': 'write_test_file',
  'mcp__aibio__write_doc_record': 'write_to_docs',
  'mcp__aibio__update_doc_record': 'write_to_docs',
  'mcp__aibio__edit_query_session': 'edit_query_session',
};

export function getApprovalGateForTool(toolName: string): ApprovalGateType | null {
  return GATED_TOOLS[toolName] ?? null;
}
