import { ContentPolicyFields, normalizeContentPolicy } from './contentPolicy';

export type CausalGraphMode = 'CAUSAL_CHAIN' | 'CAUSAL_REASONING_TREE' | 'SCIENTIFIC_INQUIRY_TREE';

export type FeedbackTiming = 'IMMEDIATE' | 'AT_CHECKPOINT' | 'AT_END';

export type CausalNodeType =
  | 'STANDARD'
  | 'CAUSE'
  | 'EFFECT'
  | 'REVISION'
  | 'MERGE'
  | 'ROUTER'
  | 'RESULT_GATE'
  | 'END'
  | 'CHECKPOINT';

export type ScientificValidity = 'SUPPORTED' | 'PARTIALLY_SUPPORTED' | 'UNDETERMINED' | 'CONTRADICTED';

export type LocalCoherence = 'LOW' | 'MEDIUM' | 'HIGH';

export type TransitionType = 'GO_TO_NODE' | 'RETRY_CURRENT_NODE' | 'GO_TO_RESULT_GATE' | 'FINISH';

export type VariableValueType = 'BOOLEAN' | 'INTEGER' | 'STRING' | 'STRING_SET';

export type EffectOperation = 'SET' | 'INCREMENT' | 'DECREMENT' | 'ADD' | 'REMOVE';

export type SourceType = 'PAPER' | 'BOOK' | 'DATASET' | 'ARTICLE' | 'OTHER';

export interface CausalGraphSettings {
  choiceCount: 2; // strictly 2
  shuffleOptions: boolean;
  feedbackTiming: FeedbackTiming;
  allowBacktracking: boolean;
  allowCycles: boolean;
  showVisitedPath: boolean;
  showFullGraphAfterCompletion: boolean;
  requireSourcesForEvidence: boolean;
  maxDecisionCount: number; // 1 to 20, default 8
}

export interface TransitionConfig {
  type: TransitionType;
  targetNodeId?: string;
  endingId?: string;
}

export interface VariableEffect {
  variableId: string;
  operation: EffectOperation;
  value: any;
}

export interface OptionFeedbackObject {
  text: string;
  timing?: FeedbackTiming | string;
}

export type OptionFeedback = string | OptionFeedbackObject;

export interface NodeOption {
  id: string; // e.g., N1_A, N1_B
  text: string; // max 240 chars
  scientificValidity: ScientificValidity;
  localCoherence: LocalCoherence;
  transitionRole: string; // e.g., PRIMARY, ALTERNATIVE, CORRECT, DISTRACTOR
  transition: TransitionConfig;
  effects: VariableEffect[];
  scoreDelta: Record<string, number>; // { reasoning: 20, evidence: -5 }
  misconceptionId?: string;
  feedback?: OptionFeedback;
}

export type RouteConditionOperator =
  | 'EQUALS'
  | 'NOT_EQUALS'
  | 'GREATER'
  | 'LESS'
  | 'CONTAINS'
  | 'GREATER_THAN'
  | 'GREATER_OR_EQUAL'
  | 'LESS_THAN'
  | 'LESS_OR_EQUAL'
  | 'NOT_CONTAINS';

export interface RouteCondition {
  variableId: string;
  operator: RouteConditionOperator;
  value: any;
}

export interface RouteRule {
  id?: string;
  condition?: RouteCondition;
  targetNodeId: string;
  always?: boolean; // default fallback route
  all?: any;
  priority?: number;
}

export interface EndingRule {
  id?: string;
  condition?: RouteCondition;
  endingId: string;
  always?: boolean; // default fallback ending
  all?: any;
  priority?: number;
}

export interface CausalNode {
  id: string; // N1, N2, CHECKPOINT_1, RESULT_GATE
  nodeType: CausalNodeType;
  title: string; // max 80 chars
  text: string; // max 500 chars
  prompt?: string; // max 180 chars
  sourceRefs: string[]; // IDs from sources
  options: NodeOption[]; // exactly 2 for STANDARD/CHECKPOINT, 0 for service nodes
  autoTransition?: { targetNodeId: string; type?: string }; // for MERGE
  routes?: RouteRule[]; // for ROUTER
  endingRules?: EndingRule[]; // for RESULT_GATE
  position?: { x: number; y: number };
}

export interface StateVariable {
  id: string;
  valueType: VariableValueType;
  defaultValue: boolean | number | string | string[];
}

export interface ScoreDimension {
  id: string;
  title: string;
  maxScore: number; // > 0
  weight: number; // >= 0
}

export interface GraphEnding {
  id: string;
  title: string;
  summary: string;
  explanation: string;
  resultTags: string[];
}

export interface ScientificSource {
  id: string;
  sourceType: SourceType;
  title: string;
  authors: string[];
  year: number;
  publisher: string;
  url: string;
  doi: string;
}

export interface CausalGraphQuestion extends ContentPolicyFields {
  type: 'CAUSAL_GRAPH';
  question: string;
  introduction: string; // max 800 chars
  scientificDisciplines: string[]; // exactly 1 discipline
  topics: string[];
  explanation: string;
  schemaVersion: number; // default 1
  contentVersion: number; // default 1
  mode: CausalGraphMode;
  settings: CausalGraphSettings;
  startNodeId: string;
  nodes: CausalNode[];
  stateVariables: StateVariable[];
  scoreDimensions: ScoreDimension[];
  endings: GraphEnding[];
  sources: ScientificSource[];
}

export interface ValidationError {
  field?: string;
  nodeId?: string;
  message: string;
  severity: 'ERROR' | 'WARNING';
}

export function allowedCausalNodeTypes(mode: CausalGraphMode): CausalNodeType[] {
  switch (mode) {
    case 'CAUSAL_CHAIN':
      return ['STANDARD', 'CAUSE', 'EFFECT', 'REVISION', 'END'];
    case 'CAUSAL_REASONING_TREE':
    case 'SCIENTIFIC_INQUIRY_TREE':
    default:
      return [
        'STANDARD',
        'CAUSE',
        'EFFECT',
        'REVISION',
        'MERGE',
        'ROUTER',
        'RESULT_GATE',
        'END',
        'CHECKPOINT'
      ];
  }
}

export function isTechnicalCausalNodeType(type: CausalNodeType): boolean {
  return type === 'MERGE' || type === 'ROUTER' || type === 'RESULT_GATE';
}

export function normalizeCausalGraphQuestion(q: Partial<CausalGraphQuestion>): CausalGraphQuestion {
  const contentPolicy = normalizeContentPolicy(q);
  return {
    type: 'CAUSAL_GRAPH',
    question: q.question || '',
    introduction: q.introduction || '',
    scientificDisciplines:
      Array.isArray(q.scientificDisciplines) && q.scientificDisciplines.length > 0
        ? q.scientificDisciplines
        : ['фізика'],
    topics: q.topics || [],
    explanation: q.explanation || '',
    ...contentPolicy,
    schemaVersion: q.schemaVersion || 1,
    contentVersion: q.contentVersion || 1,
    mode: q.mode || 'CAUSAL_CHAIN',
    settings: {
      choiceCount: 2,
      shuffleOptions: q.settings?.shuffleOptions ?? false,
      feedbackTiming: q.settings?.feedbackTiming || 'IMMEDIATE',
      allowBacktracking: q.settings?.allowBacktracking ?? false,
      allowCycles: q.settings?.allowCycles ?? false,
      showVisitedPath: q.settings?.showVisitedPath ?? true,
      showFullGraphAfterCompletion: q.settings?.showFullGraphAfterCompletion ?? true,
      requireSourcesForEvidence: q.settings?.requireSourcesForEvidence ?? false,
      maxDecisionCount: q.settings?.maxDecisionCount || 8
    },
    startNodeId: q.startNodeId || 'N1',
    nodes: q.nodes || [],
    stateVariables: q.stateVariables || [],
    scoreDimensions: q.scoreDimensions || [],
    endings: q.endings || [],
    sources: q.sources || []
  };
}
