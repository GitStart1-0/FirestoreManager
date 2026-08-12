import { Plus, Trash2 } from 'lucide-react';
import {
  LOGICAL_EXPRESSION_KINDS,
  LogicalExpression,
  LogicalExpressionKind,
  LogicalSlotDefinition,
  LogicalSymbolDefinition,
  LogicalSymbolKind,
  expression,
} from '../../types/logicalInference';

interface LogicalExpressionEditorProps {
  value: LogicalExpression;
  onChange: (value: LogicalExpression) => void;
  vocabulary: LogicalSymbolDefinition[];
  slots?: LogicalSlotDefinition[];
  allowSlotRefs?: boolean;
  label?: string;
  depth?: number;
  symbolRole?: SymbolRole;
}

type SymbolRole = 'ANY' | 'FORMULA' | 'PREDICATE_HEAD' | 'TERM' | 'VARIABLE';

const selectClass = 'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-800 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200/60';

const defaultSymbolId = (vocabulary: LogicalSymbolDefinition[], predicateHead = false) => {
  const preferred = predicateHead
    ? vocabulary.find(item => item.kind === 'PREDICATE' || item.kind === 'RELATION')
    : vocabulary.find(item => item.kind === 'CONSTANT' || item.kind === 'VARIABLE' || item.kind === 'PROPOSITION');
  return preferred?.id || vocabulary[0]?.id || '';
};

const createForKind = (
  kind: LogicalExpressionKind,
  vocabulary: LogicalSymbolDefinition[],
  slots: LogicalSlotDefinition[],
): LogicalExpression => {
  const symbol = () => expression('SYMBOL', defaultSymbolId(vocabulary));
  switch (kind) {
    case 'SYMBOL':
      return symbol();
    case 'SLOT_REF':
      return expression('SLOT_REF', slots[0]?.id || '');
    case 'PREDICATE':
      return expression('PREDICATE', '', [
        expression('SYMBOL', defaultSymbolId(vocabulary, true)),
        symbol(),
      ]);
    case 'NOT':
      return expression('NOT', '', [symbol()]);
    case 'AND':
    case 'OR':
    case 'IMPLIES':
    case 'IFF':
    case 'EQUALS':
      return expression(kind, '', [symbol(), symbol()]);
    case 'FOR_ALL':
    case 'EXISTS': {
      const variable = vocabulary.find(item => item.kind === 'VARIABLE')?.id || defaultSymbolId(vocabulary);
      return expression(kind, '', [expression('SYMBOL', variable), symbol()]);
    }
  }
};

const kindLabel: Record<LogicalExpressionKind, string> = {
  SYMBOL: 'Символ',
  SLOT_REF: 'Посилання на слот',
  PREDICATE: 'Предикат / відношення',
  NOT: 'Заперечення (NOT)',
  AND: 'Кон’юнкція (AND)',
  OR: 'Диз’юнкція (OR)',
  IMPLIES: 'Імплікація',
  IFF: 'Еквівалентність',
  FOR_ALL: 'Квантор загальності',
  EXISTS: 'Квантор існування',
  EQUALS: 'Тотожність',
};

const symbolKindsByRole: Record<SymbolRole, LogicalSymbolKind[]> = {
  ANY: ['CONSTANT', 'VARIABLE', 'CLASS', 'PREDICATE', 'RELATION', 'PROPOSITION', 'CONNECTIVE', 'QUANTIFIER'],
  FORMULA: ['PROPOSITION'],
  PREDICATE_HEAD: ['PREDICATE', 'RELATION', 'CLASS'],
  TERM: ['CONSTANT', 'VARIABLE'],
  VARIABLE: ['VARIABLE'],
};

const symbolLabelByRole: Record<SymbolRole, string> = {
  ANY: 'Символ зі словника питання',
  FORMULA: 'Пропозиційний символ',
  PREDICATE_HEAD: 'Предикат або відношення',
  TERM: 'Терм (об’єкт або змінна)',
  VARIABLE: 'Зв’язана змінна',
};

const childSymbolRole = (parentKind: LogicalExpressionKind, childIndex: number): SymbolRole => {
  if (parentKind === 'PREDICATE') return childIndex === 0 ? 'PREDICATE_HEAD' : 'TERM';
  if (parentKind === 'FOR_ALL' || parentKind === 'EXISTS') return childIndex === 0 ? 'VARIABLE' : 'FORMULA';
  if (parentKind === 'EQUALS') return 'TERM';
  if (parentKind === 'NOT' || parentKind === 'AND' || parentKind === 'OR' || parentKind === 'IMPLIES' || parentKind === 'IFF') {
    return 'FORMULA';
  }
  return 'ANY';
};

export function LogicalExpressionEditor({
  value,
  onChange,
  vocabulary,
  slots = [],
  allowSlotRefs = false,
  label,
  depth = 0,
  symbolRole = 'ANY',
}: LogicalExpressionEditorProps) {
  const kinds = allowSlotRefs
    ? LOGICAL_EXPRESSION_KINDS
    : LOGICAL_EXPRESSION_KINDS.filter(kind => kind !== 'SLOT_REF');
  const children = value.children || [];
  const allowedSymbolKinds = symbolKindsByRole[symbolRole];
  const compatibleVocabulary = vocabulary.filter(symbol =>
    allowedSymbolKinds.includes(symbol.kind) || symbol.id === value.value,
  );
  const referenceOptions = value.kind === 'SLOT_REF'
    ? slots.map(slot => ({ id: slot.id, label: `${slot.label} (${slot.id})` }))
    : compatibleVocabulary.map(symbol => ({ id: symbol.id, label: `${symbol.label} (${symbol.id})` }));

  const updateChild = (index: number, child: LogicalExpression) => {
    onChange({ ...value, children: children.map((item, childIndex) => childIndex === index ? child : item) });
  };

  return (
    <div className={`border ${depth === 0 ? 'border-slate-300 bg-slate-50' : 'border-slate-200 bg-white'} rounded-lg p-3 space-y-3`}>
      <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-2 items-end">
        <label className="space-y-1">
          <span className="block text-[11px] font-bold text-slate-600">{label || `AST-вузол ${depth + 1}`}</span>
          <select
            value={value.kind}
            onChange={event => onChange(createForKind(event.target.value as LogicalExpressionKind, vocabulary, slots))}
            className={selectClass}
          >
            {kinds.map(kind => <option key={kind} value={kind}>{kindLabel[kind]}</option>)}
          </select>
        </label>

        {(value.kind === 'SYMBOL' || value.kind === 'SLOT_REF') && (
          <label className="space-y-1">
            <span className="block text-[11px] font-bold text-slate-600">
              {value.kind === 'SLOT_REF' ? 'Слот конструктора' : symbolLabelByRole[symbolRole]}
            </span>
            <select
              value={value.value || ''}
              onChange={event => onChange({ ...value, value: event.target.value })}
              className={selectClass}
            >
              <option value="">Оберіть значення…</option>
              {referenceOptions.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </label>
        )}
      </div>

      {children.length > 0 && (
        <div className="space-y-2 border-l-2 border-amber-200 pl-3">
          {children.map((child, index) => (
            <div key={`${value.kind}-${index}`} className="relative">
              <LogicalExpressionEditor
                value={child}
                onChange={next => updateChild(index, next)}
                vocabulary={vocabulary}
                slots={slots}
                allowSlotRefs={allowSlotRefs}
                label={value.kind === 'PREDICATE' && index === 0
                  ? 'Голова предиката'
                  : value.kind === 'PREDICATE'
                    ? `Аргумент ${index}`
                    : `Частина виразу ${index + 1}`}
                depth={depth + 1}
                symbolRole={childSymbolRole(value.kind, index)}
              />
              {value.kind === 'PREDICATE' && index > 1 && (
                <button
                  type="button"
                  onClick={() => onChange({ ...value, children: children.filter((_, childIndex) => childIndex !== index) })}
                  className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-md text-red-500 hover:bg-red-50"
                  title="Видалити аргумент"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {value.kind === 'PREDICATE' && children.length < 4 && (
        <button
          type="button"
          onClick={() => onChange({ ...value, children: [...children, expression('SYMBOL', defaultSymbolId(vocabulary))] })}
          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:border-amber-400 hover:text-amber-700"
        >
          <Plus className="h-3.5 w-3.5" />
          Додати аргумент
        </button>
      )}
    </div>
  );
}
