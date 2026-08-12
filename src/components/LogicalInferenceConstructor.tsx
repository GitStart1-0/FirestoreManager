import React, { useEffect, useMemo, useState } from 'react';
import { Auth } from 'firebase/auth';
import { Firestore, doc, getDoc, setDoc } from 'firebase/firestore';
import {
  AlertTriangle,
  Binary,
  BookOpen,
  Braces,
  Check,
  CheckCircle2,
  Clipboard,
  Download,
  FileJson,
  FileText,
  Lightbulb,
  ListTree,
  Plus,
  RefreshCw,
  Save,
  Settings2,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import { LogicalExpressionEditor } from '../features/logicalInference/LogicalExpressionEditor';
import { stripUndefinedValues } from '../shared/data/stripUndefinedValues';
import {
  LOGICAL_SLOT_TYPES,
  LOGICAL_SYMBOL_KINDS,
  LogicalBuilderPresentation,
  LogicalExpectedAnswerKind,
  LogicalInferenceFamily,
  LogicalInferenceQuestionDocument,
  LogicalSlotDefinition,
  LogicalSystem,
  createSampleLogicalInferenceQuestion,
  expression,
  normalizeLogicalInferenceQuestion,
  validateLogicalInferenceQuestion,
} from '../types/logicalInference';

type EditorTab = 'overview' | 'vocabulary' | 'premises' | 'builder' | 'answer' | 'feedback' | 'validation' | 'json';

interface LogicalInferenceConstructorProps {
  dbInstance: Firestore | null;
  authInstance: Auth | null;
  category: string;
  levelId: string;
  questionId: string;
  lang: string;
  questionNumber: string;
  block: string;
  hasConstructorPermission: boolean;
  triggerToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  onRefreshExplorer: () => void;
}

const inputClass = 'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-medium text-slate-800 outline-none transition focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-200/60';
const labelClass = 'block text-[11px] font-bold text-slate-600';
const panelClass = 'rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm';

const systems: { value: LogicalSystem; label: string }[] = [
  { value: 'CLASSICAL_PROPOSITIONAL', label: 'Класична пропозиційна логіка' },
  { value: 'MODERN_CLASSICAL_FOL_FRAGMENT', label: 'Фрагмент сучасної логіки першого порядку' },
  { value: 'TRADITIONAL_SYLLOGISTIC', label: 'Традиційна силогістика' },
];

const families: { value: LogicalInferenceFamily; label: string }[] = [
  { value: 'CATEGORICAL', label: 'Категоричний висновок' },
  { value: 'SINGULAR', label: 'Одиничний висновок' },
  { value: 'PROPOSITIONAL', label: 'Пропозиційний висновок' },
  { value: 'RELATIONAL', label: 'Реляційний висновок' },
];

const presentations: { value: LogicalBuilderPresentation; label: string }[] = [
  { value: 'CATEGORICAL', label: 'Категоричний' },
  { value: 'PREDICATION', label: 'Предикація' },
  { value: 'PROPOSITIONAL', label: 'Пропозиційний' },
  { value: 'RELATIONAL', label: 'Реляційний' },
];

const tabs: { id: EditorTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'overview', label: 'Основне', icon: Settings2 },
  { id: 'vocabulary', label: 'Словник', icon: BookOpen },
  { id: 'premises', label: 'Засновки', icon: ListTree },
  { id: 'builder', label: 'Конструктор', icon: Binary },
  { id: 'answer', label: 'Відповідь', icon: CheckCircle2 },
  { id: 'feedback', label: 'Пояснення', icon: Lightbulb },
  { id: 'validation', label: 'Перевірка', icon: ShieldCheck },
  { id: 'json', label: 'JSON', icon: Braces },
];

const csv = (value: string) => value.split(',').map(item => item.trim()).filter(Boolean);

const cloneQuestion = (question: LogicalInferenceQuestionDocument) =>
  structuredClone(question) as LogicalInferenceQuestionDocument;

export const LogicalInferenceConstructor: React.FC<LogicalInferenceConstructorProps> = ({
  dbInstance,
  authInstance,
  category,
  levelId,
  questionId,
  lang,
  questionNumber,
  block,
  hasConstructorPermission,
  triggerToast,
  onRefreshExplorer,
}) => {
  const [question, setQuestion] = useState<LogicalInferenceQuestionDocument>(() => {
    const initial = createSampleLogicalInferenceQuestion();
    initial.lang = lang;
    initial.number = Number(questionNumber) || 1;
    initial.block = block || 'A';
    return initial;
  });
  const [activeTab, setActiveTab] = useState<EditorTab>('overview');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [existingForeignType, setExistingForeignType] = useState<string | null>(null);
  const [allowOverwrite, setAllowOverwrite] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);

  useEffect(() => {
    setQuestion(current => ({
      ...current,
      lang,
      number: Number(questionNumber) || 1,
      block: block || 'A',
    }));
  }, [lang, questionNumber, block]);

  useEffect(() => {
    let subscribed = true;
    const load = async () => {
      if (!dbInstance || !category || !levelId || !questionId) return;
      setIsLoading(true);
      setAllowOverwrite(false);
      try {
        const reference = doc(dbInstance, category, String(levelId), 'questions', questionId);
        const snapshot = await getDoc(reference);
        if (!subscribed) return;
        if (!snapshot.exists()) {
          const fresh = createSampleLogicalInferenceQuestion();
          fresh.lang = lang;
          fresh.number = Number(questionNumber) || 1;
          fresh.block = block || 'A';
          setQuestion(fresh);
          setExistingForeignType(null);
          return;
        }
        const data = snapshot.data();
        if (data.type === 'LOGICAL_INFERENCE') {
          setQuestion(normalizeLogicalInferenceQuestion(data));
          setExistingForeignType(null);
          triggerToast(`Завантажено LOGICAL_INFERENCE (${questionId})`, 'info');
        } else {
          const fresh = createSampleLogicalInferenceQuestion();
          fresh.lang = lang;
          fresh.number = Number(questionNumber) || 1;
          fresh.block = block || 'A';
          setQuestion(fresh);
          setExistingForeignType(String(data.type || 'UNKNOWN'));
        }
      } catch (error) {
        console.warn('Could not load LOGICAL_INFERENCE:', error);
      } finally {
        if (subscribed) setIsLoading(false);
      }
    };
    load();
    return () => { subscribed = false; };
  }, [dbInstance, category, levelId, questionId]);

  useEffect(() => {
    if (activeTab === 'json') {
      setJsonText(JSON.stringify(question, null, 2));
      setJsonError(null);
    }
  }, [activeTab, question]);

  const validationIssues = useMemo(() => validateLogicalInferenceQuestion(question), [question]);
  const errorCount = validationIssues.filter(issue => issue.severity === 'ERROR').length;
  const warningCount = validationIssues.filter(issue => issue.severity === 'WARNING').length;
  const isValid = errorCount === 0;

  const previewConclusion = useMemo(() => {
    return question.conclusionBuilder.slots.reduce((text, slot) => {
      return text.replaceAll(`{${slot.id}}`, slot.options[0]?.label || `{${slot.id}}`);
    }, question.conclusionBuilder.textTemplate || 'Заповніть textTemplate');
  }, [question.conclusionBuilder]);

  const update = (mutator: (draft: LogicalInferenceQuestionDocument) => void) => {
    setQuestion(current => {
      const draft = cloneQuestion(current);
      mutator(draft);
      return draft;
    });
  };

  const addVocabularyItem = () => update(draft => {
    const index = draft.vocabulary.length + 1;
    draft.vocabulary.push({ id: `symbol_${index}`, label: `Символ ${index}`, kind: 'PROPOSITION', arity: 0 });
  });

  const addPremise = () => update(draft => {
    const index = draft.premises.length + 1;
    draft.premises.push({
      id: `p${index}`,
      text: 'Новий засновок.',
      formula: expression('SYMBOL', draft.vocabulary[0]?.id || ''),
    });
  });

  const addSlot = () => update(draft => {
    const index = draft.conclusionBuilder.slots.length + 1;
    const symbolId = draft.vocabulary[0]?.id || '';
    draft.conclusionBuilder.slots.push({
      id: `slot_${index}`,
      label: `Слот ${index}`,
      type: 'TERM',
      options: [
        { id: `option_${index}_1`, label: 'Варіант 1', expression: expression('SYMBOL', symbolId) },
        { id: `option_${index}_2`, label: 'Варіант 2', expression: expression('SYMBOL', symbolId) },
      ],
    });
  });

  const addSlotOption = (slotIndex: number) => update(draft => {
    const slot = draft.conclusionBuilder.slots[slotIndex];
    const index = slot.options.length + 1;
    slot.options.push({
      id: `${slot.id || `slot_${slotIndex + 1}`}_${index}`,
      label: `Варіант ${index}`,
      expression: expression('SYMBOL', draft.vocabulary[0]?.id || ''),
    });
  });

  const addMisconception = () => update(draft => {
    const index = draft.misconceptions.length + 1;
    draft.misconceptions.push({
      id: `misconception_${index}`,
      type: 'INVALID_INFERENCE',
      formula: expression('SYMBOL', draft.vocabulary[0]?.id || ''),
      feedback: 'Поясніть, у чому полягає логічна помилка.',
    });
  });

  const applyJson = () => {
    try {
      const parsed = JSON.parse(jsonText);
      const normalized = normalizeLogicalInferenceQuestion(parsed);
      if (parsed.type !== 'LOGICAL_INFERENCE') throw new Error('type повинен дорівнювати LOGICAL_INFERENCE.');
      setQuestion(normalized);
      setJsonError(null);
      triggerToast('JSON застосовано до редактора.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Некоректний JSON.';
      setJsonError(message);
      triggerToast(`Помилка JSON: ${message}`, 'error');
    }
  };

  const copyJson = async () => {
    await navigator.clipboard.writeText(JSON.stringify(question, null, 2));
    triggerToast('JSON скопійовано.', 'success');
  };

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(question, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `logical_inference_${questionId || 'question'}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const uploadJson = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setJsonText(String(reader.result || ''));
      setActiveTab('json');
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const save = async () => {
    if (!dbInstance || !authInstance) {
      triggerToast('Відсутнє активне підключення до Firestore або Auth.', 'error');
      return;
    }
    if (!hasConstructorPermission) {
      triggerToast('Немає дозволу конструктора на запис.', 'error');
      return;
    }
    if (!isValid) {
      setActiveTab('validation');
      triggerToast('Виправте помилки валідації перед збереженням.', 'error');
      return;
    }
    if (existingForeignType && !allowOverwrite) {
      triggerToast(`За цим шляхом уже є питання ${existingForeignType}. Підтвердьте заміну.`, 'error');
      return;
    }

    setIsSaving(true);
    try {
      const clean = cloneQuestion(question);
      clean.question = clean.question.trim();
      clean.explanation = clean.explanation.trim();
      clean.block = clean.block.trim();
      clean.topics = clean.topics.map(item => item.trim()).filter(Boolean);
      clean.scientificDisciplines = clean.scientificDisciplines.map(item => item.trim()).filter(Boolean);
      const reference = doc(dbInstance, category, String(levelId), 'questions', questionId);
      await setDoc(reference, stripUndefinedValues(clean) as LogicalInferenceQuestionDocument);
      const readBack = await getDoc(reference);
      if (!readBack.exists() || readBack.data().type !== 'LOGICAL_INFERENCE') {
        throw new Error('Не вдалося підтвердити записаний документ.');
      }
      setExistingForeignType(null);
      setAllowOverwrite(false);
      triggerToast(`LOGICAL_INFERENCE (${questionId}) збережено і перевірено.`, 'success');
      onRefreshExplorer();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Невідома помилка.';
      triggerToast(`Помилка запису LOGICAL_INFERENCE: ${message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="constructor-shell flex w-full flex-col gap-5 animate-fadeIn">
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-slate-100 shadow-md sm:p-5">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="flex min-w-0 items-start gap-3">
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/15 p-2.5 text-amber-300">
              <Binary className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold text-white sm:text-lg">Логіка</h2>
                <span className="rounded bg-amber-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-300">LOGICAL_INFERENCE</span>
              </div>
              <p className="mt-1 break-all font-mono text-[11px] text-slate-400">
                {category}/{levelId}/questions/{questionId}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={save}
            disabled={isSaving || isLoading || !hasConstructorPermission || !isValid || Boolean(existingForeignType && !allowOverwrite)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-xs font-extrabold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          >
            {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Зберегти у Firestore
          </button>
        </div>
      </div>

      {existingForeignType && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="space-y-2">
              <p><strong>Конфлікт шляху:</strong> тут уже збережено питання типу {existingForeignType}.</p>
              <label className="flex cursor-pointer items-center gap-2 font-bold">
                <input type="checkbox" checked={allowOverwrite} onChange={event => setAllowOverwrite(event.target.checked)} />
                Дозволити заміну цього документа на LOGICAL_INFERENCE
              </label>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-bold transition ${active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
              {tab.id === 'validation' && errorCount > 0 && <span className="rounded-full bg-red-500 px-1.5 text-[9px] text-white">{errorCount}</span>}
            </button>
          );
        })}
      </div>

      {activeTab === 'overview' && (
        <div className={`${panelClass} space-y-5`}>
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <FileText className="h-4 w-4 text-amber-600" />
            <h3 className="text-sm font-bold text-slate-900">Основна конфігурація</h3>
          </div>
          <label className="space-y-1.5">
            <span className={labelClass}>Завдання (question) *</span>
            <textarea value={question.question} onChange={event => update(draft => { draft.question = event.target.value; })} rows={3} className={inputClass} />
          </label>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="space-y-1.5">
              <span className={labelClass}>Логічна система (logicSystem)</span>
              <select value={question.logicSystem} onChange={event => update(draft => { draft.logicSystem = event.target.value as LogicalSystem; })} className={inputClass}>
                {systems.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className={labelClass}>Сімейство задачі (inferenceFamily)</span>
              <select value={question.inferenceFamily} onChange={event => update(draft => { draft.inferenceFamily = event.target.value as LogicalInferenceFamily; })} className={inputClass}>
                {families.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {(['schemaVersion', 'engineVersion', 'contentVersion'] as const).map(field => (
              <label key={field} className="space-y-1.5">
                <span className={labelClass}>{field}</span>
                <input type="number" min={1} value={question[field]} readOnly={field !== 'contentVersion'} onChange={event => update(draft => { draft[field] = Number(event.target.value) || 1; })} className={`${inputClass} read-only:text-slate-400`} />
              </label>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="space-y-1.5">
              <span className={labelClass}>Теми через кому (topics)</span>
              <input value={question.topics.join(', ')} onChange={event => update(draft => { draft.topics = csv(event.target.value); })} className={inputClass} />
            </label>
            <label className="space-y-1.5">
              <span className={labelClass}>Дисципліни через кому (scientificDisciplines)</span>
              <input value={question.scientificDisciplines.join(', ')} onChange={event => update(draft => { draft.scientificDisciplines = csv(event.target.value); })} className={inputClass} />
            </label>
          </div>
        </div>
      )}

      {activeTab === 'vocabulary' && (
        <div className={`${panelClass} space-y-4`}>
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Словник символів</h3>
              <p className="mt-1 max-w-3xl text-[11px] text-slate-500">
                Значення «людина», «смертний», «Сократ» і «Платон» належать лише до стартового прикладу.
                Для кожного нового міркування замініть їх власними предикатами, відношеннями, об’єктами та змінними.
                Стабільні ID цього словника використовуються в усіх AST-формулах питання.
              </p>
            </div>
            <button type="button" onClick={addVocabularyItem} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-[11px] font-bold text-white"><Plus className="h-3.5 w-3.5" /> Додати</button>
          </div>
          <div className="space-y-2">
            {question.vocabulary.map((item, index) => (
              <div key={`${index}-${item.id}`} className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 md:grid-cols-[1fr_1.2fr_1fr_90px_36px]">
                <input value={item.id} onChange={event => update(draft => { draft.vocabulary[index].id = event.target.value; })} placeholder="id" className={inputClass} />
                <input value={item.label} onChange={event => update(draft => { draft.vocabulary[index].label = event.target.value; })} placeholder="Підпис" className={inputClass} />
                <select value={item.kind} onChange={event => update(draft => { draft.vocabulary[index].kind = event.target.value as typeof item.kind; })} className={inputClass}>
                  {LOGICAL_SYMBOL_KINDS.map(kind => <option key={kind} value={kind}>{kind}</option>)}
                </select>
                <input type="number" min={0} max={3} value={item.arity} onChange={event => update(draft => { draft.vocabulary[index].arity = Number(event.target.value); })} className={inputClass} title="Арність" />
                <button type="button" onClick={() => update(draft => { draft.vocabulary.splice(index, 1); })} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-red-500 hover:bg-red-50" title="Видалити"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'premises' && (
        <div className="space-y-4">
          <div className={`${panelClass} flex items-center justify-between gap-3`}>
            <div><h3 className="text-sm font-bold text-slate-900">Засновки</h3><p className="mt-1 text-[11px] text-slate-500">Від 1 до 6 текстових тверджень із формальним AST.</p></div>
            <button type="button" onClick={addPremise} disabled={question.premises.length >= 6} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-[11px] font-bold text-white disabled:opacity-40"><Plus className="h-3.5 w-3.5" /> Додати</button>
          </div>
          {question.premises.map((premise, index) => (
            <div key={`${index}-${premise.id}`} className={`${panelClass} space-y-4`}>
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-xs font-extrabold text-slate-800">Засновок {index + 1}</h4>
                <button type="button" onClick={() => update(draft => { draft.premises.splice(index, 1); })} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-[180px_1fr]">
                <label className="space-y-1"><span className={labelClass}>ID</span><input value={premise.id} onChange={event => update(draft => { draft.premises[index].id = event.target.value; })} className={inputClass} /></label>
                <label className="space-y-1"><span className={labelClass}>Текст для гравця</span><input value={premise.text} onChange={event => update(draft => { draft.premises[index].text = event.target.value; })} className={inputClass} /></label>
              </div>
              <LogicalExpressionEditor value={premise.formula} onChange={formula => update(draft => { draft.premises[index].formula = formula; })} vocabulary={question.vocabulary} label="Формула засновку" />
            </div>
          ))}
        </div>
      )}

      {activeTab === 'builder' && (
        <div className="space-y-4">
          <div className={`${panelClass} space-y-4`}>
            <h3 className="border-b border-slate-100 pb-3 text-sm font-bold text-slate-900">Побудова відповіді гравцем</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="space-y-1"><span className={labelClass}>presentation</span><select value={question.conclusionBuilder.presentation} onChange={event => update(draft => { draft.conclusionBuilder.presentation = event.target.value as LogicalBuilderPresentation; })} className={inputClass}>{presentations.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
              <label className="space-y-1"><span className={labelClass}>Текстовий шаблон</span><input value={question.conclusionBuilder.textTemplate} onChange={event => update(draft => { draft.conclusionBuilder.textTemplate = event.target.value; })} placeholder="{subject} - {predicate}." className={inputClass} /></label>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"><strong>Попередній перегляд:</strong> {previewConclusion}</div>
          </div>

          <div className={`${panelClass} space-y-4`}>
            <div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-bold text-slate-900">Типізовані слоти</h3><p className="mt-1 text-[11px] text-slate-500">Кожен слот має 2-12 дозволених варіантів.</p></div><button type="button" onClick={addSlot} disabled={question.conclusionBuilder.slots.length >= 6} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-[11px] font-bold text-white disabled:opacity-40"><Plus className="h-3.5 w-3.5" /> Слот</button></div>
          </div>

          {question.conclusionBuilder.slots.map((slot, slotIndex) => (
            <div key={`${slotIndex}-${slot.id}`} className={`${panelClass} space-y-4`}>
              <div className="flex items-center justify-between"><h4 className="text-xs font-extrabold text-slate-800">Слот {slotIndex + 1}</h4><button type="button" onClick={() => update(draft => { draft.conclusionBuilder.slots.splice(slotIndex, 1); })} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button></div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <label className="space-y-1"><span className={labelClass}>ID</span><input value={slot.id} onChange={event => update(draft => { draft.conclusionBuilder.slots[slotIndex].id = event.target.value; })} className={inputClass} /></label>
                <label className="space-y-1"><span className={labelClass}>Підпис</span><input value={slot.label} onChange={event => update(draft => { draft.conclusionBuilder.slots[slotIndex].label = event.target.value; })} className={inputClass} /></label>
                <label className="space-y-1"><span className={labelClass}>Тип</span><select value={slot.type} onChange={event => update(draft => { draft.conclusionBuilder.slots[slotIndex].type = event.target.value as LogicalSlotDefinition['type']; })} className={inputClass}>{LOGICAL_SLOT_TYPES.map(type => <option key={type} value={type}>{type}</option>)}</select></label>
              </div>
              <div className="space-y-3">
                {slot.options.map((option, optionIndex) => (
                  <div key={`${optionIndex}-${option.id}`} className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_1.5fr_36px]">
                      <input value={option.id} onChange={event => update(draft => { draft.conclusionBuilder.slots[slotIndex].options[optionIndex].id = event.target.value; })} placeholder="option_id" className={inputClass} />
                      <input value={option.label} onChange={event => update(draft => { draft.conclusionBuilder.slots[slotIndex].options[optionIndex].label = event.target.value; })} placeholder="Текст варіанта" className={inputClass} />
                      <button type="button" onClick={() => update(draft => { draft.conclusionBuilder.slots[slotIndex].options.splice(optionIndex, 1); })} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                    </div>
                    <LogicalExpressionEditor value={option.expression} onChange={next => update(draft => { draft.conclusionBuilder.slots[slotIndex].options[optionIndex].expression = next; })} vocabulary={question.vocabulary} label="Вираз варіанта" />
                  </div>
                ))}
                <button type="button" onClick={() => addSlotOption(slotIndex)} disabled={slot.options.length >= 12} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-[11px] font-bold text-slate-600 hover:border-amber-400 disabled:opacity-40"><Plus className="h-3.5 w-3.5" /> Варіант</button>
              </div>
            </div>
          ))}

          <div className={panelClass}>
            <LogicalExpressionEditor value={question.conclusionBuilder.resultTemplate} onChange={next => update(draft => { draft.conclusionBuilder.resultTemplate = next; })} vocabulary={question.vocabulary} slots={question.conclusionBuilder.slots} allowSlotRefs label="AST-шаблон зібраного висновку" />
          </div>
        </div>
      )}

      {activeTab === 'answer' && (
        <div className={`${panelClass} space-y-5`}>
          <h3 className="border-b border-slate-100 pb-3 text-sm font-bold text-slate-900">Правильна відповідь</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="space-y-1"><span className={labelClass}>expectedAnswer.kind</span><select value={question.expectedAnswer.kind} onChange={event => update(draft => { const kind = event.target.value as LogicalExpectedAnswerKind; draft.expectedAnswer.kind = kind; draft.expectedAnswer.formula = kind === 'CONCLUSION' ? draft.expectedAnswer.formula || expression('SYMBOL', draft.vocabulary[0]?.id || '') : undefined; })} className={inputClass}><option value="CONCLUSION">CONCLUSION</option><option value="NO_VALID_CONCLUSION">NO_VALID_CONCLUSION</option></select></label>
            <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700"><input type="checkbox" checked={question.answerPolicy.allowNoValidConclusion} onChange={event => update(draft => { draft.answerPolicy.allowNoValidConclusion = event.target.checked; })} /> Дозволити «Валідного висновку немає»</label>
          </div>
          {question.expectedAnswer.kind === 'CONCLUSION' && question.expectedAnswer.formula && (
            <LogicalExpressionEditor value={question.expectedAnswer.formula} onChange={next => update(draft => { draft.expectedAnswer.formula = next; })} vocabulary={question.vocabulary} label="Канонічний AST правильної відповіді" />
          )}
        </div>
      )}

      {activeTab === 'feedback' && (
        <div className="space-y-4">
          <div className={`${panelClass} space-y-4`}>
            <label className="space-y-1"><span className={labelClass}>Загальне пояснення (explanation)</span><textarea rows={5} value={question.explanation} onChange={event => update(draft => { draft.explanation = event.target.value; })} className={inputClass} /></label>
            <label className="flex items-center gap-2 text-xs font-bold text-slate-700"><input type="checkbox" checked={question.literatureHiddenAtStart} onChange={event => update(draft => { draft.literatureHiddenAtStart = event.target.checked; })} /> Приховувати літературу до перевірки</label>
          </div>
          <div className={`${panelClass} space-y-4`}>
            <div className="flex items-center justify-between"><div><h3 className="text-sm font-bold text-slate-900">Типові логічні помилки</h3><p className="mt-1 text-[11px] text-slate-500">Точний AST дозволяє показати спеціальне пояснення помилки.</p></div><button type="button" onClick={addMisconception} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-[11px] font-bold text-white"><Plus className="h-3.5 w-3.5" /> Додати</button></div>
            {question.misconceptions.map((item, index) => (
              <div key={`${index}-${item.id}`} className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_1fr_36px]">
                  <input value={item.id} onChange={event => update(draft => { draft.misconceptions[index].id = event.target.value; })} placeholder="misconception_id" className={inputClass} />
                  <input value={item.type} onChange={event => update(draft => { draft.misconceptions[index].type = event.target.value; })} placeholder="PREMISE_REPETITION" className={inputClass} />
                  <button type="button" onClick={() => update(draft => { draft.misconceptions.splice(index, 1); })} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                </div>
                <textarea rows={2} value={item.feedback} onChange={event => update(draft => { draft.misconceptions[index].feedback = event.target.value; })} placeholder="Навчальне пояснення помилки" className={inputClass} />
                {item.formula && <LogicalExpressionEditor value={item.formula} onChange={next => update(draft => { draft.misconceptions[index].formula = next; })} vocabulary={question.vocabulary} label="AST помилкового висновку" />}
              </div>
            ))}
          </div>
          <div className={`${panelClass} space-y-3`}>
            <div className="flex items-center justify-between"><h3 className="text-sm font-bold text-slate-900">Рекомендована література</h3><button type="button" onClick={() => update(draft => { draft.recommendedLiterature.push({ name: '', link: '' }); })} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-[11px] font-bold text-slate-700"><Plus className="h-3.5 w-3.5" /> Джерело</button></div>
            {question.recommendedLiterature.map((item, index) => (
              <div key={index} className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_1.3fr_36px]">
                <input value={item.name} onChange={event => update(draft => { draft.recommendedLiterature[index].name = event.target.value; })} placeholder="Назва" className={inputClass} />
                <input value={item.link} onChange={event => update(draft => { draft.recommendedLiterature[index].link = event.target.value; })} placeholder="https://…" className={inputClass} />
                <button type="button" onClick={() => update(draft => { draft.recommendedLiterature.splice(index, 1); })} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'validation' && (
        <div className={`${panelClass} space-y-4`}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div><h3 className="text-sm font-bold text-slate-900">Перевірка сумісності з Android</h3><p className="mt-1 text-[11px] text-slate-500">Ті самі обмеження структури, що й у застосунку.</p></div>
            <div className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold ${isValid ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{isValid ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}{errorCount} помилок, {warningCount} попереджень</div>
          </div>
          {validationIssues.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold text-emerald-800"><Check className="h-4 w-4" /> Документ готовий до публікації.</div>
          ) : validationIssues.map((issue, index) => (
            <div key={`${issue.path}-${index}`} className={`rounded-lg border p-3 text-xs ${issue.severity === 'ERROR' ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
              <div className="font-mono text-[10px] opacity-70">{issue.path}</div><div className="mt-1 font-semibold">{issue.message}</div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'json' && (
        <div className={`${panelClass} space-y-4`}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div><h3 className="flex items-center gap-2 text-sm font-bold text-slate-900"><FileJson className="h-4 w-4 text-amber-600" /> Повний документ JSON</h3><p className="mt-1 text-[11px] text-slate-500">Імпорт, експорт і точне редагування складної структури.</p></div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={copyJson} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-[11px] font-bold text-slate-700"><Clipboard className="h-3.5 w-3.5" /> Копіювати</button>
              <button type="button" onClick={downloadJson} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-[11px] font-bold text-slate-700"><Download className="h-3.5 w-3.5" /> Завантажити</button>
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-[11px] font-bold text-slate-700"><Upload className="h-3.5 w-3.5" /> Імпорт<input type="file" accept="application/json,.json" onChange={uploadJson} className="hidden" /></label>
            </div>
          </div>
          <textarea value={jsonText} onChange={event => setJsonText(event.target.value)} rows={28} spellCheck={false} className="w-full rounded-lg border border-slate-300 bg-slate-950 p-4 font-mono text-[11px] leading-5 text-slate-100 outline-none focus:border-amber-400" />
          {jsonError && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700">{jsonError}</div>}
          <button type="button" onClick={applyJson} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-bold text-white"><FileJson className="h-4 w-4" /> Застосувати JSON</button>
        </div>
      )}
    </div>
  );
};
