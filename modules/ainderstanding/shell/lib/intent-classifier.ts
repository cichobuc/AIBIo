import type { AIMode } from '@/core/types/agent';

export type DispatchMode = 'manual_only' | 'direct_agent' | 'coordinator' | 'multi_phase';

export type DispatchPlan = {
  mode: DispatchMode;
  target?: string;
  steps?: Array<{ agent: string; parallel?: boolean }>;
};

type ClassifyInput = {
  message: string;
  activeModule: string;
  aiMode: AIMode;
};

// Allowed coordinators per AI mode (BR-SHL-011, BR-SHL-012, BR-SHL-040)
const ALLOWED_COORDINATORS: Record<AIMode, string[]> = {
  auto: ['explore-coordinator', 'model-coordinator', 'document-coordinator', 'quality-coordinator'],
  documentation: ['explore-coordinator', 'document-coordinator'],
  queries: ['explore-coordinator', 'model-coordinator', 'quality-coordinator'],
  manual: [],
};

// Module → default coordinator mapping (BR-SHL-021)
const MODULE_COORDINATOR: Record<string, string> = {
  explore: 'explore-coordinator',
  model: 'model-coordinator',
  document: 'document-coordinator',
  test: 'quality-coordinator',
};

const SCHEMA_PATTERNS = /\b(schema|table|column|source|refresh|introspect|discover)\b/i;
const MODEL_PATTERNS = /\b(model|sql|datamart|staging|mart|intermediate|write|build|create)\b/i;
const DOC_PATTERNS = /\b(doc|document|describe|annotate|explain|coverage|interview)\b/i;
const TEST_PATTERNS = /\b(test|quality|check|validate|assert)\b/i;
// Direct schema refresh only (BR-SHL-024a)
const SCHEMA_ONLY_PATTERNS = /\b(refresh schema|introspect schema|update schema|schema refresh)\b/i;

export function classifyIntent(input: ClassifyInput): DispatchPlan {
  const { message, activeModule, aiMode } = input;

  // BR-SHL-010 / BR-SHL-020: Manual mode short-circuits everything
  if (aiMode === 'manual') {
    return { mode: 'manual_only' };
  }

  const allowed = ALLOWED_COORDINATORS[aiMode];

  // BR-SHL-024a: Direct schema-refresh bypass
  if (SCHEMA_ONLY_PATTERNS.test(message)) {
    return { mode: 'direct_agent', target: 'schema-explorer' };
  }

  // BR-SHL-021: Active module provides strong signal — prefer its coordinator
  const moduleSuggestedCoordinator = MODULE_COORDINATOR[activeModule];
  if (moduleSuggestedCoordinator && allowed.includes(moduleSuggestedCoordinator)) {
    // Check if the message is clearly targeted at this module
    const isExplore = activeModule === 'explore' && SCHEMA_PATTERNS.test(message);
    const isModel = activeModule === 'model' && MODEL_PATTERNS.test(message);
    const isDoc = activeModule === 'document' && DOC_PATTERNS.test(message);
    const isTest = activeModule === 'test' && TEST_PATTERNS.test(message);

    if (isExplore || isModel || isDoc || isTest) {
      return { mode: 'coordinator', target: moduleSuggestedCoordinator };
    }
  }

  // Cross-module detection: score each coordinator by keyword match
  const scores: Record<string, number> = {
    'explore-coordinator': SCHEMA_PATTERNS.test(message) ? 1 : 0,
    'model-coordinator': MODEL_PATTERNS.test(message) ? 1 : 0,
    'document-coordinator': DOC_PATTERNS.test(message) ? 1 : 0,
    'quality-coordinator': TEST_PATTERNS.test(message) ? 1 : 0,
  };

  const matched = Object.entries(scores)
    .filter(([coord, score]) => score > 0 && allowed.includes(coord))
    .sort(([, a], [, b]) => b - a);

  if (matched.length === 1) {
    return { mode: 'coordinator', target: matched[0]![0] };
  }

  if (matched.length > 1) {
    // Multiple coordinators needed — LLM fallback (BR-SHL-020)
    return { mode: 'multi_phase' };
  }

  // No clear signal — LLM supervisor decides
  return { mode: 'multi_phase' };
}
