import type {
  HookCallback,
  HookCallbackMatcher,
  HookEvent,
  PostToolUseHookInput,
} from '@anthropic-ai/claude-agent-sdk';

// PostToolUse hook: write_model_file → parse_lineage (BR-SHL-045b)
// P0d: parse_lineage tool not yet registered — hook is structurally correct but a no-op.
// Wire up callTool when mcp__aibio__parse_lineage is implemented.
const onWriteModelFile: HookCallback = async (input, _toolUseID, _opts) => {
  if (input.hook_event_name !== 'PostToolUse') return {};
  const ptu = input as PostToolUseHookInput;
  if (ptu.tool_name !== 'mcp__aibio__write_model_file') return {};
  return {};
};

// PostToolUse hook: materialize_models → run_tests (BR-SHL-045b)
// P0d: run_tests tool not yet registered — hook is structurally correct but a no-op.
const onMaterializeModels: HookCallback = async (input, _toolUseID, _opts) => {
  if (input.hook_event_name !== 'PostToolUse') return {};
  const ptu = input as PostToolUseHookInput;
  if (ptu.tool_name !== 'mcp__aibio__materialize_models') return {};
  return {};
};

const writeModelFileMatchers: HookCallbackMatcher[] = [
  { matcher: 'mcp__aibio__write_model_file', hooks: [onWriteModelFile] },
];

const materializeModelsMatchers: HookCallbackMatcher[] = [
  { matcher: 'mcp__aibio__materialize_models', hooks: [onMaterializeModels] },
];

export const supervisorHooks: Partial<Record<HookEvent, HookCallbackMatcher[]>> = {
  PostToolUse: [...writeModelFileMatchers, ...materializeModelsMatchers],
};
