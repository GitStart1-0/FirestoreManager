import { ContentPolicyFields, normalizeContentPolicy } from './contentPolicy';

export type LogicalInferenceFamily =
  | 'CATEGORICAL'
  | 'SINGULAR'
  | 'PROPOSITIONAL'
  | 'RELATIONAL';

export type LogicalSystem =
  | 'CLASSICAL_PROPOSITIONAL'
  | 'MODERN_CLASSICAL_FOL_FRAGMENT'
  | 'TRADITIONAL_SYLLOGISTIC';

export type LogicalSymbolKind =
  | 'CONSTANT'
  | 'VARIABLE'
  | 'CLASS'
  | 'PREDICATE'
  | 'RELATION'
  | 'PROPOSITION'
  | 'CONNECTIVE'
  | 'QUANTIFIER';

export type LogicalExpressionKind =
  | 'SYMBOL'
  | 'SLOT_REF'
  | 'PREDICATE'
  | 'NOT'
  | 'AND'
  | 'OR'
  | 'IMPLIES'
  | 'IFF'
  | 'FOR_ALL'
  | 'EXISTS'
  | 'EQUALS';

export type LogicalSlotType =
  | 'QUANTIFIER'
  | 'POLARITY'
  | 'TERM'
  | 'PREDICATE'
  | 'RELATION'
  | 'PROPOSITION'
  | 'CONNECTIVE'
  | 'NEGATION';

export type LogicalBuilderPresentation =
  | 'CATEGORICAL'
  | 'PREDICATION'
  | 'PROPOSITIONAL'
  | 'RELATIONAL';

export type LogicalExpectedAnswerKind = 'CONCLUSION' | 'NO_VALID_CONCLUSION';

export interface LogicalSymbolDefinition {
  id: string;
  label: string;
  kind: LogicalSymbolKind;
  arity: number;
  argumentTypes?: string[];
}

export interface LogicalExpression {
  kind: LogicalExpressionKind;
  value?: string;
  children?: LogicalExpression[];
}

export interface LogicalPremise {
  id: string;
  text: string;
  formula: LogicalExpression;
}

export interface LogicalSlotOption {
  id: string;
  label: string;
  expression: LogicalExpression;
}

export interface LogicalSlotDefinition {
  id: string;
  label: string;
  type: LogicalSlotType;
  options: LogicalSlotOption[];
}

export interface LogicalConclusionBuilder {
  presentation: LogicalBuilderPresentation;
  slots: LogicalSlotDefinition[];
  resultTemplate: LogicalExpression;
  textTemplate: string;
}

export interface LogicalAnswerPolicy {
  allowNoValidConclusion: boolean;
}

export interface LogicalExpectedAnswer {
  kind: LogicalExpectedAnswerKind;
  formula?: LogicalExpression;
}

export interface LogicalMisconception {
  id: string;
  type: string;
  formula?: LogicalExpression;
  feedback: string;
}

export interface RecommendedLiteratureItem {
  name: string;
  link: string;
}

export interface LogicalInferenceQuestionDocument extends ContentPolicyFields {
  type: 'LOGICAL_INFERENCE';
  lang: string;
  number: number;
  block: string;
  question: string;
  schemaVersion: number;
  engineVersion: number;
  contentVersion: number;
  logicSystem: LogicalSystem;
  inferenceFamily: LogicalInferenceFamily;
  vocabulary: LogicalSymbolDefinition[];
  premises: LogicalPremise[];
  conclusionBuilder: LogicalConclusionBuilder;
  answerPolicy: LogicalAnswerPolicy;
  expectedAnswer: LogicalExpectedAnswer;
  misconceptions: LogicalMisconception[];
  explanation: string;
  topics: string[];
  scientificDisciplines: string[];
  recommendedLiterature: RecommendedLiteratureItem[];
  literatureHiddenAtStart: boolean;
}

export interface LogicalValidationIssue {
  path: string;
  message: string;
  severity: 'ERROR' | 'WARNING';
}

export const LOGICAL_EXPRESSION_KINDS: LogicalExpressionKind[] = [
  'SYMBOL',
  'SLOT_REF',
  'PREDICATE',
  'NOT',
  'AND',
  'OR',
  'IMPLIES',
  'IFF',
  'FOR_ALL',
  'EXISTS',
  'EQUALS',
];

export const LOGICAL_SYMBOL_KINDS: LogicalSymbolKind[] = [
  'CONSTANT',
  'VARIABLE',
  'CLASS',
  'PREDICATE',
  'RELATION',
  'PROPOSITION',
  'CONNECTIVE',
  'QUANTIFIER',
];

export const LOGICAL_SLOT_TYPES: LogicalSlotType[] = [
  'QUANTIFIER',
  'POLARITY',
  'TERM',
  'PREDICATE',
  'RELATION',
  'PROPOSITION',
  'CONNECTIVE',
  'NEGATION',
];

export const expression = (
  kind: LogicalExpressionKind,
  value = '',
  children: LogicalExpression[] = [],
): LogicalExpression => ({ kind, ...(value ? { value } : {}), ...(children.length ? { children } : {}) });

export function createSampleLogicalInferenceQuestion(): LogicalInferenceQuestionDocument {
  return {
    type: 'LOGICAL_INFERENCE',
    lang: 'ua',
    number: 1,
    block: 'A',
    question: 'Який висновок логічно випливає із засновків?',
    schemaVersion: 1,
    engineVersion: 1,
    contentVersion: 1,
    logicSystem: 'MODERN_CLASSICAL_FOL_FRAGMENT',
    inferenceFamily: 'SINGULAR',
    vocabulary: [
      { id: 'human', label: 'людина', kind: 'PREDICATE', arity: 1 },
      { id: 'mortal', label: 'смертний', kind: 'PREDICATE', arity: 1 },
      { id: 'socrates', label: 'Сократ', kind: 'CONSTANT', arity: 0 },
      { id: 'plato', label: 'Платон', kind: 'CONSTANT', arity: 0 },
      { id: 'x', label: 'x', kind: 'VARIABLE', arity: 0 },
    ],
    premises: [
      {
        id: 'p1',
        text: 'Усі люди смертні.',
        formula: expression('FOR_ALL', '', [
          expression('SYMBOL', 'x'),
          expression('IMPLIES', '', [
            expression('PREDICATE', '', [expression('SYMBOL', 'human'), expression('SYMBOL', 'x')]),
            expression('PREDICATE', '', [expression('SYMBOL', 'mortal'), expression('SYMBOL', 'x')]),
          ]),
        ]),
      },
      {
        id: 'p2',
        text: 'Сократ - людина.',
        formula: expression('PREDICATE', '', [
          expression('SYMBOL', 'human'),
          expression('SYMBOL', 'socrates'),
        ]),
      },
    ],
    conclusionBuilder: {
      presentation: 'PREDICATION',
      slots: [
        {
          id: 'subject',
          label: "Суб'єкт",
          type: 'TERM',
          options: [
            { id: 'socrates', label: 'Сократ', expression: expression('SYMBOL', 'socrates') },
            { id: 'plato', label: 'Платон', expression: expression('SYMBOL', 'plato') },
          ],
        },
        {
          id: 'predicate',
          label: 'Предикат',
          type: 'PREDICATE',
          options: [
            { id: 'mortal', label: 'смертний', expression: expression('SYMBOL', 'mortal') },
            { id: 'human', label: 'людина', expression: expression('SYMBOL', 'human') },
          ],
        },
      ],
      resultTemplate: expression('PREDICATE', '', [
        expression('SLOT_REF', 'predicate'),
        expression('SLOT_REF', 'subject'),
      ]),
      textTemplate: '{subject} - {predicate}.',
    },
    answerPolicy: { allowNoValidConclusion: false },
    expectedAnswer: {
      kind: 'CONCLUSION',
      formula: expression('PREDICATE', '', [
        expression('SYMBOL', 'mortal'),
        expression('SYMBOL', 'socrates'),
      ]),
    },
    misconceptions: [
      {
        id: 'repeat-premise',
        type: 'PREMISE_REPETITION',
        formula: expression('PREDICATE', '', [
          expression('SYMBOL', 'human'),
          expression('SYMBOL', 'socrates'),
        ]),
        feedback: 'Це повторення другого засновку, а не новий висновок.',
      },
    ],
    explanation: 'Із загального правила та факту про Сократа випливає, що Сократ смертний.',
    topics: ['класична логіка', 'дедукція'],
    scientificDisciplines: ['logic'],
    recommendedLiterature: [],
    literatureHiddenAtStart: false,
    minimumAge: 16,
    contentWarnings: [],
    contentTags: [],
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function normalizeLogicalInferenceQuestion(value: unknown): LogicalInferenceQuestionDocument {
  const fallback = createSampleLogicalInferenceQuestion();
  if (!isRecord(value)) return fallback;

  const rawBuilder = isRecord(value.conclusionBuilder) ? value.conclusionBuilder : {};
  const rawPolicy = isRecord(value.answerPolicy) ? value.answerPolicy : {};
  const rawExpected = isRecord(value.expectedAnswer) ? value.expectedAnswer : {};
  const contentPolicy = normalizeContentPolicy(value as Partial<ContentPolicyFields>);

  return {
    ...fallback,
    ...value,
    type: 'LOGICAL_INFERENCE',
    ...contentPolicy,
    lang: typeof value.lang === 'string' ? value.lang : fallback.lang,
    number: Number.isFinite(Number(value.number)) ? Number(value.number) : fallback.number,
    block: typeof value.block === 'string' ? value.block : fallback.block,
    vocabulary: Array.isArray(value.vocabulary) ? value.vocabulary as LogicalSymbolDefinition[] : [],
    premises: Array.isArray(value.premises) ? value.premises as LogicalPremise[] : [],
    conclusionBuilder: {
      presentation: typeof rawBuilder.presentation === 'string'
        ? rawBuilder.presentation as LogicalBuilderPresentation
        : fallback.conclusionBuilder.presentation,
      slots: Array.isArray(rawBuilder.slots) ? rawBuilder.slots as LogicalSlotDefinition[] : [],
      resultTemplate: isRecord(rawBuilder.resultTemplate)
        ? rawBuilder.resultTemplate as unknown as LogicalExpression
        : fallback.conclusionBuilder.resultTemplate,
      textTemplate: typeof rawBuilder.textTemplate === 'string' ? rawBuilder.textTemplate : '',
    },
    answerPolicy: {
      allowNoValidConclusion: rawPolicy.allowNoValidConclusion === true,
    },
    expectedAnswer: {
      kind: typeof rawExpected.kind === 'string'
        ? rawExpected.kind as LogicalExpectedAnswerKind
        : fallback.expectedAnswer.kind,
      formula: isRecord(rawExpected.formula)
        ? rawExpected.formula as unknown as LogicalExpression
        : undefined,
    },
    misconceptions: Array.isArray(value.misconceptions)
      ? value.misconceptions as LogicalMisconception[]
      : [],
    topics: Array.isArray(value.topics) ? value.topics.map(String) : [],
    scientificDisciplines: Array.isArray(value.scientificDisciplines)
      ? value.scientificDisciplines.map(String)
      : [],
    recommendedLiterature: Array.isArray(value.recommendedLiterature)
      ? value.recommendedLiterature as RecommendedLiteratureItem[]
      : [],
  };
}

const collectDuplicates = (values: string[]) => {
  const seen = new Set<string>();
  return new Set(values.filter(value => seen.has(value) || !seen.add(value)));
};

const childCountFor = (kind: LogicalExpressionKind): number | null => {
  if (kind === 'SYMBOL' || kind === 'SLOT_REF') return 0;
  if (kind === 'NOT') return 1;
  if (kind === 'PREDICATE') return null;
  return 2;
};

export function validateLogicalInferenceQuestion(
  question: LogicalInferenceQuestionDocument,
): LogicalValidationIssue[] {
  const issues: LogicalValidationIssue[] = [];
  const error = (path: string, message: string) => issues.push({ path, message, severity: 'ERROR' });
  const warning = (path: string, message: string) => issues.push({ path, message, severity: 'WARNING' });

  if (!question.question.trim()) error('question', 'Формулювання питання є обов’язковим.');
  if (!(['CLASSICAL_PROPOSITIONAL', 'MODERN_CLASSICAL_FOL_FRAGMENT', 'TRADITIONAL_SYLLOGISTIC'] as string[]).includes(question.logicSystem)) {
    error('logicSystem', `Непідтримувана логічна система: ${question.logicSystem}.`);
  }
  if (!(['CATEGORICAL', 'SINGULAR', 'PROPOSITIONAL', 'RELATIONAL'] as string[]).includes(question.inferenceFamily)) {
    error('inferenceFamily', `Непідтримуване сімейство: ${question.inferenceFamily}.`);
  }
  if (!(['CATEGORICAL', 'PREDICATION', 'PROPOSITIONAL', 'RELATIONAL'] as string[]).includes(question.conclusionBuilder.presentation)) {
    error('conclusionBuilder.presentation', `Непідтримуване представлення: ${question.conclusionBuilder.presentation}.`);
  }
  if (question.schemaVersion !== 1) error('schemaVersion', 'Підтримується лише schemaVersion = 1.');
  if (question.engineVersion !== 1) error('engineVersion', 'Підтримується лише engineVersion = 1.');
  if (!Number.isInteger(question.contentVersion) || question.contentVersion < 1) {
    error('contentVersion', 'Версія контенту має бути додатним цілим числом.');
  }
  if (question.premises.length < 1 || question.premises.length > 6) {
    error('premises', 'Потрібно від 1 до 6 засновків.');
  }
  if (question.conclusionBuilder.slots.length < 1 || question.conclusionBuilder.slots.length > 6) {
    error('conclusionBuilder.slots', 'Потрібно від 1 до 6 слотів висновку.');
  }

  const vocabularyIds = question.vocabulary.map(item => item.id.trim());
  const symbolIds = new Set(vocabularyIds);
  collectDuplicates(vocabularyIds).forEach(id => error('vocabulary', `Дублікат ID символу: ${id || '(порожній)'}.`));
  question.vocabulary.forEach((item, index) => {
    if (!item.id.trim()) error(`vocabulary[${index}].id`, 'ID символу є обов’язковим.');
    if (!item.label.trim()) error(`vocabulary[${index}].label`, 'Підпис символу є обов’язковим.');
    if (!Number.isInteger(item.arity) || item.arity < 0 || item.arity > 3) {
      error(`vocabulary[${index}].arity`, 'Арність має бути цілим числом від 0 до 3.');
    }
  });

  const slotIds = question.conclusionBuilder.slots.map(slot => slot.id.trim());
  const slotIdSet = new Set(slotIds);
  collectDuplicates(slotIds).forEach(id => error('conclusionBuilder.slots', `Дублікат ID слота: ${id || '(порожній)'}.`));

  const validateExpression = (
    node: LogicalExpression | undefined,
    path: string,
    allowSlotRefs: boolean,
    depth = 0,
  ) => {
    if (!node || typeof node !== 'object') {
      error(path, 'Відсутній AST-вузол формули.');
      return;
    }
    if (depth > 16) {
      error(path, 'Глибина AST перевищує 16 рівнів.');
      return;
    }
    const children = Array.isArray(node.children) ? node.children : [];
    const expectedChildren = childCountFor(node.kind);
    if (expectedChildren !== null && children.length !== expectedChildren) {
      error(path, `${node.kind} повинен мати ${expectedChildren} дочірніх вузлів.`);
    }
    if (node.kind === 'PREDICATE' && (children.length < 2 || children.length > 4)) {
      error(path, 'PREDICATE повинен містити символ предиката і від 1 до 3 аргументів.');
    }
    if (node.kind === 'SYMBOL') {
      if (!node.value?.trim()) error(`${path}.value`, 'SYMBOL повинен посилатися на ID символу.');
      else if (!symbolIds.has(node.value.trim())) error(`${path}.value`, `Невідомий символ: ${node.value}.`);
    }
    if (node.kind === 'SLOT_REF') {
      if (!allowSlotRefs) error(path, 'SLOT_REF дозволено лише у resultTemplate.');
      if (!node.value?.trim() || !slotIdSet.has(node.value.trim())) {
        error(`${path}.value`, `Невідомий слот: ${node.value || '(порожній)'}.`);
      }
    }
    if (node.kind === 'PREDICATE' && children[0]?.kind === 'SYMBOL') {
      const head = question.vocabulary.find(item => item.id === children[0]?.value);
      if (head && head.arity !== children.length - 1) {
        error(path, `Арність ${head.id} дорівнює ${head.arity}, але передано ${children.length - 1} аргументів.`);
      }
    }
    children.forEach((child, index) => validateExpression(child, `${path}.children[${index}]`, allowSlotRefs, depth + 1));
  };

  const premiseIds = question.premises.map(premise => premise.id.trim());
  collectDuplicates(premiseIds).forEach(id => error('premises', `Дублікат ID засновку: ${id || '(порожній)'}.`));
  question.premises.forEach((premise, index) => {
    if (!premise.id.trim()) error(`premises[${index}].id`, 'ID засновку є обов’язковим.');
    if (!premise.text.trim()) error(`premises[${index}].text`, 'Текст засновку є обов’язковим.');
    validateExpression(premise.formula, `premises[${index}].formula`, false);
  });

  question.conclusionBuilder.slots.forEach((slot, slotIndex) => {
    if (!slot.id.trim()) error(`conclusionBuilder.slots[${slotIndex}].id`, 'ID слота є обов’язковим.');
    if (!slot.label.trim()) error(`conclusionBuilder.slots[${slotIndex}].label`, 'Підпис слота є обов’язковим.');
    if (slot.options.length < 2 || slot.options.length > 12) {
      error(`conclusionBuilder.slots[${slotIndex}].options`, 'Слот повинен мати від 2 до 12 варіантів.');
    }
    const optionIds = slot.options.map(option => option.id.trim());
    collectDuplicates(optionIds).forEach(id => error(`conclusionBuilder.slots[${slotIndex}].options`, `Дублікат ID варіанта: ${id || '(порожній)'}.`));
    slot.options.forEach((option, optionIndex) => {
      if (!option.id.trim()) error(`conclusionBuilder.slots[${slotIndex}].options[${optionIndex}].id`, 'ID варіанта є обов’язковим.');
      if (!option.label.trim()) error(`conclusionBuilder.slots[${slotIndex}].options[${optionIndex}].label`, 'Підпис варіанта є обов’язковим.');
      validateExpression(option.expression, `conclusionBuilder.slots[${slotIndex}].options[${optionIndex}].expression`, false);
    });
  });

  validateExpression(question.conclusionBuilder.resultTemplate, 'conclusionBuilder.resultTemplate', true);
  const resultSlotRefs = new Set<string>();
  const collectSlotRefs = (node?: LogicalExpression) => {
    if (!node) return;
    if (node.kind === 'SLOT_REF' && node.value) resultSlotRefs.add(node.value);
    node.children?.forEach(collectSlotRefs);
  };
  collectSlotRefs(question.conclusionBuilder.resultTemplate);
  if (slotIds.some(id => !resultSlotRefs.has(id)) || [...resultSlotRefs].some(id => !slotIdSet.has(id))) {
    error('conclusionBuilder.resultTemplate', 'Шаблон результату повинен посилатися на кожен оголошений слот.');
  }

  const textRefs = new Set(
    [...question.conclusionBuilder.textTemplate.matchAll(/\{([A-Za-z0-9_-]+)\}/g)].map(match => match[1]),
  );
  if (question.conclusionBuilder.textTemplate.trim()
    && (slotIds.some(id => !textRefs.has(id)) || [...textRefs].some(id => !slotIdSet.has(id)))) {
    error('conclusionBuilder.textTemplate', 'Текстовий шаблон повинен містити плейсхолдер кожного слота, наприклад {subject}.');
  }

  if (question.expectedAnswer.kind === 'CONCLUSION') {
    if (!question.expectedAnswer.formula) error('expectedAnswer.formula', 'Для CONCLUSION потрібна формула.');
    else validateExpression(question.expectedAnswer.formula, 'expectedAnswer.formula', false);
  } else {
    if (!question.answerPolicy.allowNoValidConclusion) {
      error('answerPolicy.allowNoValidConclusion', 'NO_VALID_CONCLUSION потребує дозволу в answerPolicy.');
    }
    if (question.expectedAnswer.formula) warning('expectedAnswer.formula', 'Формула ігнорується для NO_VALID_CONCLUSION.');
  }

  const misconceptionIds = question.misconceptions.map(item => item.id.trim());
  collectDuplicates(misconceptionIds).forEach(id => error('misconceptions', `Дублікат ID типової помилки: ${id || '(порожній)'}.`));
  question.misconceptions.forEach((item, index) => {
    if (!item.id.trim()) error(`misconceptions[${index}].id`, 'ID типової помилки є обов’язковим.');
    if (!item.type.trim()) error(`misconceptions[${index}].type`, 'Тип помилки є обов’язковим.');
    if (!item.feedback.trim()) error(`misconceptions[${index}].feedback`, 'Навчальний зворотний зв’язок є обов’язковим.');
    if (!item.formula) error(`misconceptions[${index}].formula`, 'Для типової помилки потрібна формула.');
    else validateExpression(item.formula, `misconceptions[${index}].formula`, false);
  });

  if (!question.explanation.trim()) warning('explanation', 'Рекомендовано додати загальне пояснення.');
  if (!question.scientificDisciplines.length) warning('scientificDisciplines', 'Рекомендовано вказати дисципліну logic.');
  return issues;
}
