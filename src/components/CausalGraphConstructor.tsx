import React, { useState, useMemo, useEffect } from 'react';
import { 
  CausalGraphQuestion, 
  CausalNode, 
  NodeOption, 
  StateVariable, 
  ScoreDimension, 
  GraphEnding, 
  ScientificSource, 
  ValidationError,
  CausalNodeType,
  CausalGraphMode,
  ScientificValidity,
  LocalCoherence,
  TransitionType,
  VariableValueType,
  EffectOperation,
  SourceType,
  RouteCondition,
  OptionFeedbackObject,
  allowedCausalNodeTypes,
  isTechnicalCausalNodeType,
  normalizeCausalGraphQuestion
} from '../types/causalGraph';
import { Firestore } from 'firebase/firestore';
import { Auth } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { ContentPolicyFields } from './ContentPolicyFields';
import { 
  GitFork, 
  Plus, 
  Trash2, 
  Copy, 
  Play, 
  CheckCircle2, 
  AlertTriangle, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  RefreshCw, 
  Save, 
  Settings, 
  Sliders, 
  BookOpen, 
  FileText, 
  Flag, 
  Database, 
  ArrowRight, 
  RotateCcw, 
  Check, 
  HelpCircle,
  Code,
  Link as LinkIcon,
  Sparkles,
  Layers,
  Upload,
  Download,
  FileCode,
  Move,
  GripVertical
} from 'lucide-react';
import { GraphSimulator } from '../features/causalGraph/GraphSimulator';
import { stripUndefinedValues } from '../shared/data/stripUndefinedValues';

interface CausalGraphConstructorProps {
  dbInstance: Firestore | null;
  authInstance: Auth | null;
  category: string;
  levelId: string;
  questionId: string;
  hasConstructorPermission: boolean;
  triggerToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onRefreshExplorer: () => void;
  activeConnId?: string;
  activeConnName?: string;
}

const createDefaultCausalOptions = (
  nodeId: string,
  endingId: string,
  feedbackTiming: CausalGraphQuestion['settings']['feedbackTiming']
): NodeOption[] => [
  {
    id: `${nodeId}_A`,
    text: 'Перший варіант дій або вибору',
    scientificValidity: 'SUPPORTED',
    localCoherence: 'HIGH',
    transitionRole: 'PRIMARY',
    transition: { type: 'FINISH', endingId },
    effects: [],
    scoreDelta: {},
    feedback: { text: '', timing: feedbackTiming }
  },
  {
    id: `${nodeId}_B`,
    text: 'Другий альтернативний варіант',
    scientificValidity: 'PARTIALLY_SUPPORTED',
    localCoherence: 'MEDIUM',
    transitionRole: 'ALTERNATIVE',
    transition: { type: 'FINISH', endingId },
    effects: [],
    scoreDelta: {},
    feedback: { text: '', timing: feedbackTiming }
  }
];

// Initial sample template generator for CAUSAL_GRAPH
const createSampleGraph = (): CausalGraphQuestion => ({
  type: 'CAUSAL_GRAPH',
  minimumAge: 16,
  contentWarnings: [],
  contentTags: [],
  question: 'Причинно-наслідкове дослідження фотосинтезу та хлоропластів',
  introduction: 'У цьому науковому дослідження вам потрібно встановити причинно-наслідкові зв’язки між світловою фазою фотосинтезу та виділенням кисню при підвищенні температури.',
  scientificDisciplines: ['Біологія'],
  topics: ['Фотосинтез', 'Біохімія', 'Екологія'],
  explanation: 'Загальне пояснення: підвищення температури активує ферменти фотосинтезу до певної межі, після чого відбувається денатурація білків.',
  schemaVersion: 1,
  contentVersion: 1,
  mode: 'CAUSAL_REASONING_TREE',
  settings: {
    choiceCount: 2,
    shuffleOptions: true,
    feedbackTiming: 'IMMEDIATE',
    allowBacktracking: true,
    allowCycles: false,
    showVisitedPath: true,
    showFullGraphAfterCompletion: true,
    requireSourcesForEvidence: true,
    maxDecisionCount: 8,
  },
  startNodeId: 'N1',
  nodes: [
    {
      id: 'N1',
      nodeType: 'CAUSE',
      title: 'Первинна гіпотеза ролі світла',
      text: 'Як інтенсивність світла впливає на швидкість фотосинтезу у рослин?',
      prompt: 'Оберіть найбільш науково обґрунтоване припущення:',
      sourceRefs: ['SRC_1'],
      position: { x: 50, y: 100 },
      options: [
        {
          id: 'N1_A',
          text: 'Підвищення інтенсивності світла збільшує збудження хлорофілу та генерацію АТФ.',
          scientificValidity: 'SUPPORTED',
          localCoherence: 'HIGH',
          transitionRole: 'PRIMARY',
          transition: { type: 'GO_TO_NODE', targetNodeId: 'N2' },
          effects: [
            { variableId: 'lightPhaseActive', operation: 'SET', value: 'true' }
          ],
          scoreDelta: { reasoning: 10, evidence: 5 },
          feedback: {
            text: 'Чудово! Світлова фаза активує фотосистему II.',
            timing: 'IMMEDIATE'
          }
        },
        {
          id: 'N1_B',
          text: 'Інтенсивність світла впливає лише на темнову фазу фотосинтезу у темряві.',
          scientificValidity: 'CONTRADICTED',
          localCoherence: 'LOW',
          transitionRole: 'DISTRACTOR',
          transition: { type: 'GO_TO_NODE', targetNodeId: 'N3' },
          effects: [
            { variableId: 'lightPhaseActive', operation: 'SET', value: 'false' }
          ],
          scoreDelta: { reasoning: 0, evidence: 0 },
          feedback: {
            text: 'Невірно! Темнова фаза фіксує CO2 і не залежить безпосередньо від фотонів.',
            timing: 'IMMEDIATE'
          }
        }
      ]
    },
    {
      id: 'N2',
      nodeType: 'EFFECT',
      title: 'Вплив температури',
      text: 'Як зміна температури навколишнього середовища змінить ферментативну активність РуБісКо?',
      prompt: 'Аналіз температурного фактора:',
      sourceRefs: ['SRC_1'],
      position: { x: 350, y: 50 },
      options: [
        {
          id: 'N2_A',
          text: 'Помірне підвищення до +25°C прискорює ферментативні реакції Темнової фази.',
          scientificValidity: 'SUPPORTED',
          localCoherence: 'HIGH',
          transitionRole: 'PRIMARY',
          transition: { type: 'GO_TO_RESULT_GATE', targetNodeId: 'RESULT_GATE' },
          effects: [
            { variableId: 'optimalTemp', operation: 'SET', value: 'true' }
          ],
          scoreDelta: { reasoning: 15, evidence: 10 },
          feedback: {
            text: 'Точно! Оптимальна температура сприяє ефективності ферментів.',
            timing: 'IMMEDIATE'
          }
        },
        {
          id: 'N2_B',
          text: 'Нагрівання до +70°C значно прискорить синтез глюкози без денатурації.',
          scientificValidity: 'CONTRADICTED',
          localCoherence: 'LOW',
          transitionRole: 'DISTRACTOR',
          transition: { type: 'GO_TO_NODE', targetNodeId: 'N3' },
          effects: [
            { variableId: 'optimalTemp', operation: 'SET', value: 'false' }
          ],
          scoreDelta: { reasoning: 0, evidence: -5 },
          feedback: {
            text: 'Помилка! При +70°C білки денатурують.',
            timing: 'IMMEDIATE'
          }
        }
      ]
    },
    {
      id: 'N3',
      nodeType: 'REVISION',
      title: 'Повторна корекція міркувань',
      text: 'Ви виявили відхилення від експериментальних даних. Яка причина денатурації?',
      prompt: 'Перевірка розуміння фотофізичних процесів:',
      sourceRefs: [],
      position: { x: 350, y: 250 },
      options: [
        {
          id: 'N3_A',
          text: 'Переглянути гіпотезу: ферменти мають чіткий температурний оптимум.',
          scientificValidity: 'SUPPORTED',
          localCoherence: 'HIGH',
          transitionRole: 'CORRECT',
          transition: { type: 'GO_TO_RESULT_GATE', targetNodeId: 'RESULT_GATE' },
          effects: [
            { variableId: 'optimalTemp', operation: 'SET', value: 'false' }
          ],
          scoreDelta: { reasoning: 5, evidence: 5 },
          feedback: {
            text: 'Добре, що ви скоригували свій шлях.',
            timing: 'IMMEDIATE'
          }
        },
        {
          id: 'N3_B',
          text: 'Заперечувати закони біохімії та продовжити без корекції.',
          scientificValidity: 'CONTRADICTED',
          localCoherence: 'LOW',
          transitionRole: 'DISTRACTOR',
          transition: { type: 'FINISH', endingId: 'END_FAIL' },
          effects: [],
          scoreDelta: { reasoning: -10, evidence: -10 },
          feedback: {
            text: 'Наукове дослідження вимагає врахування експериментальних фактів.',
            timing: 'IMMEDIATE'
          }
        }
      ]
    },
    {
      id: 'RESULT_GATE',
      nodeType: 'RESULT_GATE',
      title: 'Шлюз оцінки результату',
      text: 'Службовий вузол обчислення підсумкового висновку на основі змінних стану.',
      sourceRefs: [],
      position: { x: 650, y: 150 },
      options: [],
      endingRules: [
        {
          priority: 0,
          all: [{ variableId: 'optimalTemp', operator: 'EQUALS', value: 'true' }],
          endingId: 'END_SUCCESS',
          always: false
        },
        {
          priority: 100,
          all: [],
          endingId: 'END_PARTIAL',
          always: true
        }
      ]
    }
  ],
  stateVariables: [
    { id: 'lightPhaseActive', valueType: 'BOOLEAN', defaultValue: false },
    { id: 'optimalTemp', valueType: 'BOOLEAN', defaultValue: false }
  ],
  scoreDimensions: [
    { id: 'reasoning', title: 'Логіка міркувань', maxScore: 25, weight: 1.0 },
    { id: 'evidence', title: 'Обґрунтування фактами', maxScore: 20, weight: 1.0 }
  ],
  endings: [
    {
      id: 'END_SUCCESS',
      title: 'Успішне наукове відкриття',
      summary: 'Ви правильно встановили причинно-наслідковий ланцюг фотосинтезу!',
      explanation: 'Ви точно визначили вплив світлової фази та температурного оптимуму ферментів.',
      resultTags: ['Експерт', 'Відмінна логіка']
    },
    {
      id: 'END_PARTIAL',
      title: 'Частково правильне дослідження',
      summary: 'Ви пройшли шлях з декількома підказками та корекціями.',
      explanation: 'Основні висновки зроблені, але рекомендовано повторити тему біохімії.',
      resultTags: ['Початківець']
    },
    {
      id: 'END_FAIL',
      title: 'Хибний науковий висновок',
      summary: 'Дослідження перервано через ігнорування термодинамічних обмежень.',
      explanation: 'Спробуйте ще раз, зважаючи на межі стійкості ферментів до високих температур.',
      resultTags: ['Помилка гіпотези']
    }
  ],
  sources: [
    {
      id: 'SRC_1',
      sourceType: 'PAPER',
      title: 'Kinetics of Photosynthesis and Enzyme Activity',
      authors: ['Dr. A. Smith', 'Prof. B. Jones'],
      year: 2022,
      publisher: 'Journal of Plant Physiology',
      url: 'https://example.org/photosynthesis-study',
      doi: '10.1016/j.jplant.2022.01.005'
    }
  ]
});

export const CausalGraphConstructor: React.FC<CausalGraphConstructorProps> = ({
  dbInstance,
  authInstance,
  category,
  levelId,
  questionId,
  hasConstructorPermission,
  triggerToast,
  onRefreshExplorer,
  activeConnId,
  activeConnName
}) => {
  const [graphData, setGraphData] = useState<CausalGraphQuestion>(createSampleGraph);
  const [activeTab, setActiveTab] = useState<'editor' | 'variables' | 'endings' | 'sources' | 'simulator' | 'validation' | 'json'>('editor');
  
  // JSON Editor state
  const [jsonText, setJsonText] = useState<string>('');
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Sync jsonText whenever activeTab becomes 'json'
  useEffect(() => {
    if (activeTab === 'json') {
      setJsonText(JSON.stringify(graphData, null, 2));
      setJsonError(null);
    }
  }, [activeTab, graphData]);

  const handleApplyJson = () => {
    try {
      const parsed = JSON.parse(jsonText);
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Некоректний JSON об’єкт.');
      }
      if (!Array.isArray(parsed.nodes)) {
        throw new Error('Поле "nodes" повинно бути масивом вузлів.');
      }
      if (!parsed.startNodeId) {
        throw new Error('Поле "startNodeId" є обов’язковим.');
      }
      setGraphData(normalizeCausalGraphQuestion(parsed));
      setJsonError(null);
      triggerToast('JSON успішно перевірено та застосовано до конструктора!', 'success');
    } catch (err: any) {
      setJsonError(err.message || 'Помилка синтаксису JSON');
      triggerToast(`Помилка JSON: ${err.message}`, 'error');
    }
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(graphData, null, 2));
    triggerToast('JSON скопійовано в буфер обміну!', 'success');
  };

  const handleDownloadJson = () => {
    const blob = new Blob([JSON.stringify(graphData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `causal_graph_${questionId || 'question'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    triggerToast('Файл JSON успішно завантажено!', 'success');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result as string;
        setJsonText(text);
        const parsed = JSON.parse(text);
        if (!parsed || typeof parsed !== 'object') {
          throw new Error('Завантажений файл не містить валідного JSON об’єкта.');
        }
        if (!Array.isArray(parsed.nodes)) {
          throw new Error('Завантажений документ не містить масив "nodes".');
        }
        setGraphData(normalizeCausalGraphQuestion(parsed));
        setJsonError(null);
        triggerToast(`Успішно імпортовано JSON з файлу "${file.name}"!`, 'success');
      } catch (err: any) {
        setJsonError(err.message);
        triggerToast(`Помилка зчитування файлу: ${err.message}`, 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };
  
  // Canvas & Drag state in visual canvas
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>('N1');
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanningCanvas, setIsPanningCanvas] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [panOffsetStart, setPanOffsetStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Node Dragging state
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ startMouseX: number; startMouseY: number; startNodeX: number; startNodeY: number }>({
    startMouseX: 0,
    startMouseY: 0,
    startNodeX: 0,
    startNodeY: 0
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingDoc, setIsLoadingDoc] = useState(false);

  // Load existing question document if it exists in Firestore
  useEffect(() => {
    let isSubscribed = true;
    const loadFromFirestore = async () => {
      if (!dbInstance || !category || !levelId || !questionId) return;
      try {
        setIsLoadingDoc(true);
        const docRef = doc(dbInstance, category, levelId, 'questions', questionId);
        const snap = await getDoc(docRef);
        if (snap.exists() && isSubscribed) {
          const data = snap.data();
          if (data && data.type === 'CAUSAL_GRAPH') {
            setGraphData(normalizeCausalGraphQuestion(data));
            triggerToast(`Завантажено існуюче питання CAUSAL_GRAPH (${questionId})`, 'info');
          }
        }
      } catch (err) {
        console.warn('Could not load question from Firestore:', err);
      } finally {
        if (isSubscribed) setIsLoadingDoc(false);
      }
    };

    loadFromFirestore();
    return () => { isSubscribed = false; };
  }, [dbInstance, category, levelId, questionId]);

  // Selected node reference
  const selectedNode = useMemo(() => {
    return graphData.nodes.find(n => n.id === selectedNodeId) || null;
  }, [graphData.nodes, selectedNodeId]);

  // Comprehensive Validation Engine (Section 8)
  const validationErrors = useMemo<ValidationError[]>(() => {
    const errors: ValidationError[] = [];
    const allowedNodeTypes = new Set(allowedCausalNodeTypes(graphData.mode));
    const endingIds = graphData.endings.map(item => item.id.trim());
    const variableIds = graphData.stateVariables.map(item => item.id.trim());
    const scoreDimensionIds = graphData.scoreDimensions.map(item => item.id.trim());

    if (!graphData.question.trim()) {
      errors.push({ message: 'Помилка: основне формулювання question не може бути порожнім.', severity: 'ERROR' });
    }
    if (graphData.introduction.length > 800) {
      errors.push({ message: 'Помилка: introduction перевищує 800 символів.', severity: 'ERROR' });
    }
    if (graphData.scientificDisciplines.length !== 1 || !graphData.scientificDisciplines[0]?.trim()) {
      errors.push({ message: 'Помилка: потрібна рівно одна основна дисципліна.', severity: 'ERROR' });
    }
    if (graphData.settings.choiceCount !== 2) {
      errors.push({ message: 'Помилка: settings.choiceCount має дорівнювати 2.', severity: 'ERROR' });
    }
    if (graphData.settings.maxDecisionCount < 1 || graphData.settings.maxDecisionCount > 20) {
      errors.push({ message: 'Помилка: maxDecisionCount має бути в межах 1–20.', severity: 'ERROR' });
    }
    if (graphData.nodes.length < 2 || graphData.nodes.length > 64) {
      errors.push({ message: 'Помилка: граф має містити від 2 до 64 вузлів.', severity: 'ERROR' });
    }
    if (graphData.nodes.some(node => !allowedNodeTypes.has(node.nodeType))) {
      errors.push({ message: `Помилка: граф містить тип вузла, недопустимий для режиму ${graphData.mode}.`, severity: 'ERROR' });
    }

    // 1. Check start node
    if (!graphData.startNodeId || !graphData.startNodeId.trim()) {
      errors.push({ message: 'Помилка: не вказано стартовий вузол (startNodeId).', severity: 'ERROR' });
    } else if (!graphData.nodes.some(n => n.id === graphData.startNodeId)) {
      errors.push({ message: `Помилка: стартовий вузол "${graphData.startNodeId}" відсутній у списку вузлів.`, severity: 'ERROR' });
    }

    // 2. Check endings
    if (!graphData.endings || graphData.endings.length === 0) {
      errors.push({ message: 'Помилка: відсутній хоча б один фінальний результат (endings).', severity: 'ERROR' });
    }
    if (endingIds.some(id => !id) || new Set(endingIds).size !== endingIds.length) {
      errors.push({ message: 'Помилка: ID завершень мають бути непорожніми та унікальними.', severity: 'ERROR' });
    }
    if (variableIds.some(id => !id) || new Set(variableIds).size !== variableIds.length) {
      errors.push({ message: 'Помилка: ID змінних стану мають бути непорожніми та унікальними.', severity: 'ERROR' });
    }
    if (scoreDimensionIds.some(id => !id) || new Set(scoreDimensionIds).size !== scoreDimensionIds.length) {
      errors.push({ message: 'Помилка: ID шкал оцінювання мають бути непорожніми та унікальними.', severity: 'ERROR' });
    }
    if (graphData.scoreDimensions.some(item => item.maxScore <= 0 || item.weight < 0)) {
      errors.push({ message: 'Помилка: maxScore має бути > 0, а weight — не менше 0.', severity: 'ERROR' });
    }

    // 3. Duplicate Node IDs
    const nodeIds = graphData.nodes.map(n => n.id.trim());
    const duplicateNodeIds = nodeIds.filter((id, index) => nodeIds.indexOf(id) !== index);
    if (duplicateNodeIds.length > 0) {
      errors.push({ message: `Помилка: дубльовані ID вузлів: ${Array.from(new Set(duplicateNodeIds)).join(', ')}`, severity: 'ERROR' });
    }

    // Duplicate Option IDs
    const optionIds: string[] = [];
    graphData.nodes.forEach(n => {
      n.options?.forEach(opt => {
        if (opt.id) optionIds.push(opt.id.trim());
      });
    });
    const duplicateOptIds = optionIds.filter((id, index) => optionIds.indexOf(id) !== index);
    if (optionIds.some(id => !id)) {
      errors.push({ message: 'Помилка: ID варіанта відповіді не може бути порожнім.', severity: 'ERROR' });
    }
    if (duplicateOptIds.length > 0) {
      errors.push({ message: `Помилка: дубльовані ID варіантів: ${Array.from(new Set(duplicateOptIds)).join(', ')}`, severity: 'ERROR' });
    }

    // Node-specific rules
    graphData.nodes.forEach(node => {
      // Every non-technical node is interactive in the Android runtime.
      if (!isTechnicalCausalNodeType(node.nodeType)) {
        if (!node.options || node.options.length !== 2) {
          errors.push({ 
            nodeId: node.id, 
            message: `Вузол "${node.id}": звичайний вузол мусить мати рівно 2 варіанти відповідей (зараз: ${node.options?.length || 0}).`, 
            severity: 'ERROR' 
          });
        }
      }

      if (
        !isTechnicalCausalNodeType(node.nodeType) &&
        (node.title.length > 80 || node.text.length > 500 || (node.prompt?.length || 0) > 180 ||
          node.options.some(option => !option.id.trim() || !option.text.trim() || option.text.length > 240))
      ) {
        errors.push({
          nodeId: node.id,
          message: `Вузол "${node.id}": обов’язковий текст відсутній або перевищено ліміт довжини.`,
          severity: 'ERROR'
        });
      }

      // Service nodes must not have options
      if (['MERGE', 'ROUTER', 'RESULT_GATE', 'END'].includes(node.nodeType)) {
        if (node.options && node.options.length > 0) {
          errors.push({ 
            nodeId: node.id, 
            message: `Службовий вузол "${node.id}" (${node.nodeType}) не повинен містити варіантів відповідей.`, 
            severity: 'ERROR' 
          });
        }
      }

      // MERGE autoTransition check
      if (node.nodeType === 'MERGE') {
        if (!node.autoTransition || !node.autoTransition.targetNodeId) {
          errors.push({ 
            nodeId: node.id, 
            message: `Службовий вузол MERGE "${node.id}" повинен мати автоперехід autoTransition.targetNodeId.`, 
            severity: 'ERROR' 
          });
        } else if (!graphData.nodes.some(n => n.id === node.autoTransition?.targetNodeId)) {
          errors.push({ 
            nodeId: node.id, 
            message: `Службовий вузол MERGE "${node.id}" посилається на неіснуючий вузол автопереходу "${node.autoTransition.targetNodeId}".`, 
            severity: 'ERROR' 
          });
        }
      }

      // ROUTER and RESULT_GATE default rule check
      if (node.nodeType === 'ROUTER') {
        const defaultRules = node.routes?.filter(r => r.always) || [];
        if (defaultRules.length !== 1) {
          errors.push({ 
            nodeId: node.id, 
            message: `Вузол ROUTER "${node.id}" повинен мати рівно одне дефолтне правило (always=true).`, 
            severity: 'ERROR' 
          });
        }
      }

      if (node.nodeType === 'RESULT_GATE') {
        const defaultRules = node.endingRules?.filter(r => r.always) || [];
        if (defaultRules.length !== 1) {
          errors.push({ 
            nodeId: node.id, 
            message: `Вузол RESULT_GATE "${node.id}" повинен мати рівно одне дефолтне правило завершення (always=true).`, 
            severity: 'ERROR' 
          });
        }
      }

      if (node.nodeType === 'END' && !endingIds.includes(node.id)) {
        errors.push({
          nodeId: node.id,
          message: `END-вузол "${node.id}" має мати завершення з тим самим ID.`,
          severity: 'ERROR'
        });
      }

      if (
        graphData.settings.requireSourcesForEvidence &&
        (node.nodeType === 'EVIDENCE' || node.nodeType === 'EVIDENCE_QUALITY') &&
        (!node.sourceRefs || node.sourceRefs.length === 0)
      ) {
        errors.push({
          nodeId: node.id,
          message: `Вузол "${node.id}" повинен посилатися на джерело.`,
          severity: 'ERROR'
        });
      }

      // Option transitions and target integrity
      node.options?.forEach(opt => {
        if (opt.transition?.type === 'GO_TO_NODE' || opt.transition?.type === 'GO_TO_RESULT_GATE') {
          if (!opt.transition.targetNodeId || !opt.transition.targetNodeId.trim()) {
            errors.push({ 
              nodeId: node.id, 
              message: `Варіант "${opt.id}" у вузлі "${node.id}" містить порожній targetNodeId.`, 
              severity: 'ERROR' 
            });
          } else if (!graphData.nodes.some(n => n.id === opt.transition.targetNodeId)) {
            errors.push({ 
              nodeId: node.id, 
              message: `Варіант "${opt.id}" у вузлі "${node.id}" веде на відсутній вузол "${opt.transition.targetNodeId}".`, 
              severity: 'ERROR' 
            });
          }
        } else if (opt.transition?.type === 'FINISH') {
          if (!opt.transition.endingId || !opt.transition.endingId.trim()) {
            errors.push({ 
              nodeId: node.id, 
              message: `Варіант "${opt.id}" у вузлі "${node.id}" містить порожній endingId.`, 
              severity: 'ERROR' 
            });
          } else if (!graphData.endings.some(e => e.id === opt.transition.endingId)) {
            errors.push({ 
              nodeId: node.id, 
              message: `Варіант "${opt.id}" у вузлі "${node.id}" посилається на неіснуюче завершення "${opt.transition.endingId}".`, 
              severity: 'ERROR' 
            });
          }
        }

        // Variable & Score references check in options
        opt.effects?.forEach(eff => {
          if (!graphData.stateVariables.some(v => v.id === eff.variableId)) {
            errors.push({ 
              nodeId: node.id, 
              message: `Варіант "${opt.id}" посилається на невідому змінну стану "${eff.variableId}".`, 
              severity: 'ERROR' 
            });
          }
        });

        if (opt.scoreDelta) {
          Object.keys(opt.scoreDelta).forEach(scoreKey => {
            if (!scoreDimensionIds.includes(scoreKey)) {
              errors.push({ 
                nodeId: node.id, 
                message: `Варіант "${opt.id}" має зміну балів для невідомої шкали "${scoreKey}".`, 
                severity: 'ERROR' 
              });
            }
          });
        }
      });

      node.routes?.forEach(route => {
        if (!graphData.nodes.some(item => item.id === route.targetNodeId)) {
          errors.push({ nodeId: node.id, message: `Маршрут вузла "${node.id}" веде до неіснуючого вузла.`, severity: 'ERROR' });
        }
        route.all.forEach(condition => {
          if (!variableIds.includes(condition.variableId)) {
            errors.push({ nodeId: node.id, message: `Умова ROUTER посилається на невідому змінну "${condition.variableId}".`, severity: 'ERROR' });
          }
        });
      });

      node.endingRules?.forEach(rule => {
        if (!endingIds.includes(rule.endingId)) {
          errors.push({ nodeId: node.id, message: `Правило RESULT_GATE посилається на невідоме завершення.`, severity: 'ERROR' });
        }
        rule.all.forEach(condition => {
          if (!variableIds.includes(condition.variableId)) {
            errors.push({ nodeId: node.id, message: `Умова RESULT_GATE посилається на невідому змінну "${condition.variableId}".`, severity: 'ERROR' });
          }
        });
      });
    });

    // Reachability graph check (BFS from startNodeId)
    if (graphData.startNodeId && graphData.nodes.some(n => n.id === graphData.startNodeId)) {
      const visited = new Set<string>();
      const queue: string[] = [graphData.startNodeId];

      while (queue.length > 0) {
        const currId = queue.shift()!;
        if (visited.has(currId)) continue;
        visited.add(currId);

        const currNode = graphData.nodes.find(n => n.id === currId);
        if (!currNode) continue;

        // Collect target nodes
        if (currNode.autoTransition?.targetNodeId) {
          queue.push(currNode.autoTransition.targetNodeId);
        }
        currNode.routes?.forEach(r => {
          if (r.targetNodeId) queue.push(r.targetNodeId);
        });
        currNode.options?.forEach(opt => {
          if (opt.transition?.targetNodeId) queue.push(opt.transition.targetNodeId);
        });
      }

      const unreachableNodes = graphData.nodes.filter(n => !visited.has(n.id));
      if (unreachableNodes.length > 0) {
        unreachableNodes.forEach(un => {
          errors.push({ 
            nodeId: un.id, 
            message: `Попередження/Помилка: вузол "${un.id}" недосяжний зі стартового вузла "${graphData.startNodeId}".`, 
            severity: 'ERROR' 
          });
        });
      }
    }

    if (!graphData.settings.allowCycles && graphData.startNodeId) {
      const edges = new Map<string, string[]>();
      graphData.nodes.forEach(node => {
        const targets = [
          node.autoTransition?.targetNodeId,
          ...(node.routes || []).map(route => route.targetNodeId),
          ...(node.options || []).map(option => option.transition?.targetNodeId)
        ].filter((target): target is string => Boolean(target));
        edges.set(node.id, Array.from(new Set(targets)));
      });
      const visiting = new Set<string>();
      const visited = new Set<string>();
      const hasCycle = (nodeId: string): boolean => {
        if (visiting.has(nodeId)) return true;
        if (visited.has(nodeId)) return false;
        visiting.add(nodeId);
        if ((edges.get(nodeId) || []).some(hasCycle)) return true;
        visiting.delete(nodeId);
        visited.add(nodeId);
        return false;
      };
      if (hasCycle(graphData.startNodeId)) {
        errors.push({
          message: 'Помилка: граф містить цикл, але settings.allowCycles=false.',
          severity: 'ERROR'
        });
      }
    }

    return errors;
  }, [graphData]);

  const isValid = useMemo(() => {
    return validationErrors.filter(e => e.severity === 'ERROR').length === 0;
  }, [validationErrors]);

  // Rename Node ID helper - cascades to all references automatically
  const handleRenameNodeId = (oldId: string, newId: string) => {
    const cleanNew = newId.trim();
    if (!cleanNew || oldId === cleanNew) return;

    // Check duplicate
    if (graphData.nodes.some(n => n.id === cleanNew)) {
      triggerToast(`ID вузла "${cleanNew}" вже існує!`, 'error');
      return;
    }

    setGraphData(prev => {
      const updatedNodes = prev.nodes.map(n => {
        const updated = { ...n };
        if (updated.id === oldId) {
          updated.id = cleanNew;
        }

        // Cascade autoTransition
        if (updated.autoTransition?.targetNodeId === oldId) {
          updated.autoTransition = { ...updated.autoTransition, targetNodeId: cleanNew };
        }

        // Cascade routes
        if (updated.routes) {
          updated.routes = updated.routes.map(r => r.targetNodeId === oldId ? { ...r, targetNodeId: cleanNew } : r);
        }

        // Cascade options transitions
        if (updated.options) {
          updated.options = updated.options.map(opt => {
            if (opt.transition?.targetNodeId === oldId) {
              return {
                ...opt,
                transition: { ...opt.transition, targetNodeId: cleanNew }
              };
            }
            return opt;
          });
        }

        return updated;
      });

      return {
        ...prev,
        startNodeId: prev.startNodeId === oldId ? cleanNew : prev.startNodeId,
        nodes: updatedNodes
      };
    });

    if (selectedNodeId === oldId) setSelectedNodeId(cleanNew);
    triggerToast(`ID вузла змінено з ${oldId} на ${cleanNew}`, 'success');
  };

  const handleNodeTypeChange = (nodeId: string, nodeType: CausalNodeType) => {
    setGraphData(prev => {
      const endingId = prev.endings[0]?.id || 'END_SUCCESS';
      const fallbackTarget = prev.startNodeId || prev.nodes[0]?.id || '';
      return {
        ...prev,
        nodes: prev.nodes.map(node => {
          if (node.id !== nodeId) return node;
          const technical = isTechnicalCausalNodeType(nodeType);
          const options = technical
            ? []
            : node.options.length === 2
              ? node.options
              : createDefaultCausalOptions(node.id, endingId, prev.settings.feedbackTiming);
          return {
            ...node,
            nodeType,
            options,
            autoTransition: nodeType === 'MERGE'
              ? node.autoTransition || { type: 'GO_TO_NODE', targetNodeId: fallbackTarget }
              : undefined,
            routes: nodeType === 'ROUTER'
              ? node.routes?.length
                ? node.routes
                : [{ priority: 100, all: [], always: true, targetNodeId: fallbackTarget }]
              : [],
            endingRules: nodeType === 'RESULT_GATE'
              ? node.endingRules?.length
                ? node.endingRules
                : [{ priority: 100, all: [], always: true, endingId }]
              : []
          };
        })
      };
    });
  };

  // Add Node
  const handleAddNode = (type: CausalNodeType = 'CAUSE') => {
    const nextIdx = graphData.nodes.length + 1;
    const newId = type === 'CAUSE' ? `N${nextIdx}` : `${type}_${nextIdx}`;

    // Calculate smart non-overlapping position
    let targetX = 50;
    let targetY = 50;

    const selected = graphData.nodes.find(n => n.id === selectedNodeId);
    if (selected && selected.position) {
      targetX = selected.position.x + 220;
      targetY = selected.position.y;
    } else if (graphData.nodes.length > 0) {
      const maxX = Math.max(...graphData.nodes.map(n => n.position?.x || 0));
      const lastInMaxX = graphData.nodes.find(n => (n.position?.x || 0) === maxX);
      targetX = maxX + 220;
      targetY = lastInMaxX?.position?.y || 50;
    }

    // Ensure target position doesn't overlap existing nodes
    const isOccupied = (x: number, y: number) => {
      return graphData.nodes.some(n => {
        const nx = n.position?.x || 0;
        const ny = n.position?.y || 0;
        return Math.abs(nx - x) < 170 && Math.abs(ny - y) < 130;
      });
    };

    let attempts = 0;
    while (isOccupied(targetX, targetY) && attempts < 20) {
      targetY += 150;
      if (targetY > 600) {
        targetY = 50;
        targetX += 220;
      }
      attempts++;
    }

    const newPos = { x: targetX, y: targetY };

    let newOptions: NodeOption[] = [];
    if (!isTechnicalCausalNodeType(type)) {
      newOptions = createDefaultCausalOptions(
        newId,
        graphData.endings[0]?.id || 'END_SUCCESS',
        graphData.settings.feedbackTiming
      );
    }

    const newNode: CausalNode = {
      id: newId,
      nodeType: type,
      title: `Новий вузол ${newId}`,
      text: 'Введіть опис причинно-наслідкової події або експериментального кроку.',
      prompt: 'Оберіть правильний напрямок дій:',
      sourceRefs: [],
      options: newOptions,
      position: newPos
    };

    if (type === 'MERGE') {
      newNode.autoTransition = { type: 'GO_TO_NODE', targetNodeId: graphData.startNodeId || 'N1' };
    } else if (type === 'ROUTER') {
      newNode.routes = [
        { priority: 100, all: [], targetNodeId: graphData.startNodeId || 'N1', always: true }
      ];
    } else if (type === 'RESULT_GATE') {
      newNode.endingRules = [
        { priority: 100, all: [], endingId: graphData.endings[0]?.id || 'END_SUCCESS', always: true }
      ];
    }

    setGraphData(prev => ({
      ...prev,
      nodes: [...prev.nodes, newNode]
    }));

    setSelectedNodeId(newId);
    triggerToast(`Створено новий вузол ${newId}`, 'success');
  };

  // Duplicate Node
  const handleDuplicateNode = (nodeId: string) => {
    const src = graphData.nodes.find(n => n.id === nodeId);
    if (!src) return;

    const dupId = `${src.id}_COPY`;
    const dupNode: CausalNode = JSON.parse(JSON.stringify(src));
    dupNode.id = dupId;
    dupNode.title = `${src.title} (Копія)`;
    dupNode.position = { x: (src.position?.x || 100) + 40, y: (src.position?.y || 100) + 40 };

    // Make option IDs unique
    if (dupNode.options) {
      dupNode.options = dupNode.options.map((opt, idx) => ({
        ...opt,
        id: `${dupId}_${idx === 0 ? 'A' : 'B'}`
      }));
    }

    setGraphData(prev => ({
      ...prev,
      nodes: [...prev.nodes, dupNode]
    }));

    setSelectedNodeId(dupId);
    triggerToast(`Вузол дубльовано: ${dupId}`, 'info');
  };

  // Delete Node
  const handleDeleteNode = (nodeId: string) => {
    if (graphData.nodes.length <= 1) {
      triggerToast('Неможливо видалити єдиний вузол графа.', 'error');
      return;
    }

    setGraphData(prev => ({
      ...prev,
      nodes: prev.nodes.filter(n => n.id !== nodeId)
    }));

    if (selectedNodeId === nodeId) {
      const remain = graphData.nodes.filter(n => n.id !== nodeId);
      setSelectedNodeId(remain[0]?.id || null);
    }
    triggerToast(`Вузол ${nodeId} видалено`, 'info');
  };

  // Auto-layout algorithm for nodes
  const handleAutoLayout = () => {
    const startId = graphData.startNodeId || graphData.nodes[0]?.id;
    if (!startId) return;

    const layers: string[][] = [];
    const visited = new Set<string>();
    let currentLayer = [startId];

    while (currentLayer.length > 0) {
      layers.push(currentLayer);
      currentLayer.forEach(id => visited.add(id));

      const nextLayer: string[] = [];
      currentLayer.forEach(id => {
        const node = graphData.nodes.find(n => n.id === id);
        if (!node) return;

        if (node.autoTransition?.targetNodeId && !visited.has(node.autoTransition.targetNodeId)) {
          nextLayer.push(node.autoTransition.targetNodeId);
        }
        node.routes?.forEach(r => {
          if (r.targetNodeId && !visited.has(r.targetNodeId)) nextLayer.push(r.targetNodeId);
        });
        node.options?.forEach(opt => {
          if (opt.transition?.targetNodeId && !visited.has(opt.transition.targetNodeId)) {
            nextLayer.push(opt.transition.targetNodeId);
          }
        });
      });

      // Filter unique
      currentLayer = Array.from(new Set(nextLayer));
    }

    // Add unvisited nodes to final layer
    const unvisited = graphData.nodes.filter(n => !visited.has(n.id)).map(n => n.id);
    if (unvisited.length > 0) layers.push(unvisited);

    setGraphData(prev => {
      const updated = prev.nodes.map(node => {
        let layerIdx = 0;
        let posInLayer = 0;

        layers.forEach((l, lIdx) => {
          const itemIdx = l.indexOf(node.id);
          if (itemIdx !== -1) {
            layerIdx = lIdx;
            posInLayer = itemIdx;
          }
        });

        return {
          ...node,
          position: {
            x: 60 + layerIdx * 280,
            y: 80 + posInLayer * 180
          }
        };
      });

      return { ...prev, nodes: updated };
    });

    triggerToast('Вузли графа автоматично впорядковано за шарами!', 'success');
  };

  // Save to Firestore (Section 10)
  const handleSaveToFirestore = async () => {
    if (!dbInstance || !authInstance) {
      triggerToast('Відсутнє активне підключення до Firestore або Auth!', 'error');
      return;
    }

    if (!hasConstructorPermission) {
      triggerToast('У вас немає дозволу конструктора для запису у Firestore.', 'error');
      return;
    }

    if (!isValid) {
      triggerToast('Блокування збереження: виправте помилки валідації графа.', 'error');
      setActiveTab('validation');
      return;
    }

    try {
      setIsSaving(true);

      // Clean & Sanitize document
      const cleanDoc = normalizeCausalGraphQuestion(graphData);
      cleanDoc.question = cleanDoc.question.trim();
      cleanDoc.introduction = cleanDoc.introduction.trim();
      cleanDoc.explanation = cleanDoc.explanation.trim();

      // Trim node IDs and texts
      cleanDoc.nodes = cleanDoc.nodes.map(n => ({
        ...n,
        id: n.id.trim(),
        title: n.title.trim(),
        text: n.text.trim(),
        prompt: n.prompt?.trim() || '',
        options: n.options?.map(opt => ({
          ...opt,
          id: opt.id.trim(),
          text: opt.text.trim(),
          transitionRole: opt.transitionRole.trim(),
          feedback: typeof opt.feedback === 'object' && opt.feedback !== null ? {
            text: (opt.feedback as OptionFeedbackObject).text ? String((opt.feedback as OptionFeedbackObject).text).trim() : '',
            timing: (opt.feedback as OptionFeedbackObject).timing
          } : {
            text: typeof opt.feedback === 'string' ? opt.feedback.trim() : '',
            timing: graphData.settings.feedbackTiming
          }
        })) || []
      }));

      const docRef = doc(dbInstance, category, levelId, 'questions', questionId);
      await setDoc(docRef, stripUndefinedValues(cleanDoc) as CausalGraphQuestion);

      // Read back document & verify deserialization (Section 10 step 6)
      const readBack = await getDoc(docRef);
      if (readBack.exists() && readBack.data()?.type === 'CAUSAL_GRAPH') {
        triggerToast(`Успішно збережено та перевірено граф CAUSAL_GRAPH (${questionId}) у Firestore!`, 'success');
        onRefreshExplorer();
      } else {
        throw new Error('Неможливо верифікувати записаний документ у Firestore.');
      }
    } catch (err: any) {
      console.error(err);
      triggerToast(`Помилка запису графа у Firestore: ${err.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Canvas pointer down handler (pan canvas)
  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('.causal-node-card')) return;
    setIsPanningCanvas(true);
    setPanStart({ x: e.clientX, y: e.clientY });
    setPanOffsetStart({ ...panOffset });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  // Node pointer down handler (drag node)
  const handleNodePointerDown = (node: CausalNode, e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setSelectedNodeId(node.id);
    setDraggingNodeId(node.id);
    const pos = node.position || { x: 50, y: 50 };
    setDragOffset({
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startNodeX: pos.x,
      startNodeY: pos.y
    });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  // Pointer move handler (handles canvas panning and node dragging)
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingNodeId) {
      const dx = (e.clientX - dragOffset.startMouseX) / zoomLevel;
      const dy = (e.clientY - dragOffset.startMouseY) / zoomLevel;
      const newX = Math.max(10, Math.round(dragOffset.startNodeX + dx));
      const newY = Math.max(10, Math.round(dragOffset.startNodeY + dy));

      setGraphData(prev => ({
        ...prev,
        nodes: prev.nodes.map(n => n.id === draggingNodeId ? { ...n, position: { x: newX, y: newY } } : n)
      }));
    } else if (isPanningCanvas) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      setPanOffset({
        x: Math.round(panOffsetStart.x + dx),
        y: Math.round(panOffsetStart.y + dy)
      });
    }
  };

  // Pointer up / cancel handler
  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingNodeId) {
      setDraggingNodeId(null);
    }
    if (isPanningCanvas) {
      setIsPanningCanvas(false);
    }
    try {
      if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      }
    } catch (_) {}
  };

  // Canvas wheel scroll / pan handler
  const handleCanvasWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoomDelta = e.deltaY < 0 ? 0.05 : -0.05;
      setZoomLevel(prev => Math.min(2.0, Math.max(0.4, prev + zoomDelta)));
    } else {
      setPanOffset(prev => ({
        x: Math.round(prev.x - e.deltaX * 0.8),
        y: Math.round(prev.y - e.deltaY * 0.8)
      }));
    }
  };

  return (
    <div className="constructor-shell flex flex-col gap-6 w-full animate-fadeIn">
      {/* Top Banner / Breadcrumb info */}
      <div className="bg-slate-900 text-slate-100 p-4 sm:p-5 rounded-2xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-md">
        <div className="flex items-start gap-3 min-w-0">
          <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30 shrink-0">
            <GitFork className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-white">Конструктор CAUSAL_GRAPH</h2>
              <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono text-[11px] font-bold px-2 py-0.5 rounded">
                Складний тип
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 font-mono truncate">
              Шлях: <strong className="text-amber-300 font-bold">{category}/{levelId}/questions/{questionId}</strong>
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleSaveToFirestore}
            disabled={!isValid || isSaving || !hasConstructorPermission}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm ${
              isValid && hasConstructorPermission
                ? 'bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 cursor-pointer'
                : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
            }`}
            title={!isValid ? 'Виправте помилки валідації перед збереженням' : 'Зберегти у Firestore'}
          >
            {isSaving ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            <span>Зберегти у Firestore</span>
          </button>
        </div>
      </div>

      {/* Basic Question Parameters */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 flex flex-col gap-4">
        <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-100 pb-2">
          <FileText className="h-4 w-4 text-amber-500" />
          <span>Основна конфігурація питань графа</span>
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700">
              Завдання / Заголовок (question) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={graphData.question}
              onChange={e => setGraphData(prev => ({ ...prev, question: e.target.value }))}
              placeholder="Наприклад: Аналіз причинно-наслідкового ланцюга фотосинтезу"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700 flex justify-between">
              <span>Вступний текст (introduction)</span>
              <span className="text-[10px] text-slate-400 font-mono">{graphData.introduction.length}/800</span>
            </label>
            <input
              type="text"
              maxLength={800}
              value={graphData.introduction}
              onChange={e => setGraphData(prev => ({ ...prev, introduction: e.target.value }))}
              placeholder="Вступний контекст дослідження..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700">
              Наукова дисципліна (scientificDisciplines - рівно 1)
            </label>
            <input
              type="text"
              value={graphData.scientificDisciplines[0] || ''}
              onChange={e => setGraphData(prev => ({ ...prev, scientificDisciplines: [e.target.value] }))}
              placeholder="Наприклад: Біологія, Фізика, Хімія"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700">
              Тематичні теги (topics - через кому)
            </label>
            <input
              type="text"
              value={graphData.topics.join(', ')}
              onChange={e => setGraphData(prev => ({ 
                ...prev, 
                topics: e.target.value.split(',').map(t => t.trim()).filter(Boolean) 
              }))}
              placeholder="Фотосинтез, Екологія, Енергія"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            />
          </div>
        </div>

        <ContentPolicyFields
          value={graphData}
          onChange={policy => setGraphData(prev => ({ ...prev, ...policy }))}
          compact
        />

        {/* Mode & Settings */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700">Режим графа (mode)</label>
            <select
              value={graphData.mode}
              onChange={e => setGraphData(prev => ({ ...prev, mode: e.target.value as CausalGraphMode }))}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="CAUSAL_CHAIN">CAUSAL_CHAIN (Причинно-наслідковий ланцюг)</option>
              <option value="CAUSAL_REASONING_TREE">CAUSAL_REASONING_TREE (Дерево міркувань)</option>
              <option value="SCIENTIFIC_INQUIRY_TREE">SCIENTIFIC_INQUIRY_TREE (Наукове дослідження)</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700">Стартовий вузол (startNodeId)</label>
            <select
              value={graphData.startNodeId}
              onChange={e => setGraphData(prev => ({ ...prev, startNodeId: e.target.value }))}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              {graphData.nodes.map(n => (
                <option key={n.id} value={n.id}>
                  {n.id} - {n.title}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700">Макс. кількість рішень (1..20)</label>
            <input
              type="number"
              min={1}
              max={20}
              value={graphData.settings.maxDecisionCount}
              onChange={e => {
                const val = Math.max(1, Math.min(20, parseInt(e.target.value) || 8));
                setGraphData(prev => ({ ...prev, settings: { ...prev.settings, maxDecisionCount: val } }));
              }}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="flex border-b border-slate-200 gap-1 bg-white p-1 rounded-2xl shadow-xs border overflow-x-auto scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveTab('editor')}
          className={`py-2 px-4 rounded-xl font-bold text-xs transition cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'editor' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <GitFork className="h-4 w-4" />
          <span>Редактор графа ({graphData.nodes.length} вузлів)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('variables')}
          className={`py-2 px-4 rounded-xl font-bold text-xs transition cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'variables' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Sliders className="h-4 w-4" />
          <span>Змінні ({graphData.stateVariables.length}) та Бали ({graphData.scoreDimensions.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('endings')}
          className={`py-2 px-4 rounded-xl font-bold text-xs transition cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'endings' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Flag className="h-4 w-4" />
          <span>Завершення ({graphData.endings.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('sources')}
          className={`py-2 px-4 rounded-xl font-bold text-xs transition cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'sources' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <BookOpen className="h-4 w-4" />
          <span>Джерела ({graphData.sources.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('simulator')}
          className={`py-2 px-4 rounded-xl font-bold text-xs transition cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'simulator' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Play className="h-4 w-4 text-emerald-400" />
          <span>Локальна симуляція</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('validation')}
          className={`py-2 px-4 rounded-xl font-bold text-xs transition cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'validation' 
              ? (isValid ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white') 
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          {isValid ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          <span>Валідація ({validationErrors.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('json')}
          className={`py-2 px-4 rounded-xl font-bold text-xs transition cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'json' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Code className="h-4 w-4" />
          <span>JSON (Імпорт/Експорт)</span>
        </button>
      </div>

      {/* TAB 1: VISUAL GRAPH EDITOR */}
      {activeTab === 'editor' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Visual Canvas Toolbar & Area */}
          <div className="xl:col-span-7 flex flex-col gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleAddNode('CAUSE')}
                  className="bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" /> Вузол дій
                </button>

                <div className="relative group">
                  <button
                    type="button"
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer border border-slate-700"
                  >
                    <Plus className="h-3.5 w-3.5 text-amber-400" /> Службовий вузол
                  </button>
                  <div className="absolute left-0 top-full mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-xl p-1 hidden group-hover:flex flex-col gap-1 z-30 min-w-[140px]">
                    <button 
                      onClick={() => handleAddNode('MERGE')}
                      className="px-3 py-1.5 text-left text-xs font-bold text-slate-200 hover:bg-slate-700 rounded-lg transition"
                    >
                      🔀 MERGE
                    </button>
                    <button 
                      onClick={() => handleAddNode('ROUTER')}
                      className="px-3 py-1.5 text-left text-xs font-bold text-slate-200 hover:bg-slate-700 rounded-lg transition"
                    >
                      🧭 ROUTER
                    </button>
                    <button 
                      onClick={() => handleAddNode('RESULT_GATE')}
                      className="px-3 py-1.5 text-left text-xs font-bold text-slate-200 hover:bg-slate-700 rounded-lg transition"
                    >
                      🏁 RESULT_GATE
                    </button>
                    <button 
                      onClick={() => handleAddNode('CHECKPOINT')}
                      className="px-3 py-1.5 text-left text-xs font-bold text-slate-200 hover:bg-slate-700 rounded-lg transition"
                    >
                      🚩 CHECKPOINT
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAutoLayout}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer border border-slate-700"
                  title="Автоматично розташувати вузли графа"
                >
                  <Maximize2 className="h-3.5 w-3.5 text-amber-400" /> Авто-розташування
                </button>
              </div>

              {/* Canvas Controls */}
              <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setZoomLevel(prev => Math.min(prev + 0.1, 2.0))}
                  className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
                  title="Збільшити масштаб"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </button>
                <span className="text-[10px] font-mono font-bold text-amber-400 px-1">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoomLevel(prev => Math.max(prev - 0.1, 0.4))}
                  className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
                  title="Зменшити масштаб"
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setZoomLevel(1);
                    setPanOffset({ x: 0, y: 0 });
                  }}
                  className="p-1 text-[10px] font-bold text-slate-400 hover:text-amber-400 hover:bg-slate-800 px-2 rounded-lg transition cursor-pointer border border-slate-800"
                  title="Скинути масштаб та позицію"
                >
                  Скинути
                </button>
              </div>
            </div>

            {/* Canvas Hint */}
            <div className="px-1 text-[11px] text-slate-400 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Move className="h-3.5 w-3.5 text-amber-400 inline shrink-0" />
                <span>Затисніть заголовок вузла для перетягування. Тягніть поле або скрольте коліщатком для панорамування.</span>
              </span>
            </div>

            {/* Canvas Node Grid Visualization */}
            <div 
              onPointerDown={handleCanvasPointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onWheel={handleCanvasWheel}
              className={`bg-slate-950 border border-slate-800 rounded-2xl h-[510px] sm:h-[550px] p-4 relative overflow-auto scrollbar-thin select-none touch-none ${
                isPanningCanvas ? 'cursor-grabbing' : 'cursor-grab'
              }`}
              style={{
                backgroundImage: 'radial-gradient(#334155 1px, transparent 1px)',
                backgroundSize: '24px 24px'
              }}
            >
              <div 
                className="relative transition-transform duration-75 ease-out min-w-[2800px] min-h-[1800px]"
                style={{
                  transform: `scale(${zoomLevel}) translate(${panOffset.x}px, ${panOffset.y}px)`,
                  transformOrigin: '0 0'
                }}
              >
                {/* Visual SVG Links */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-0 min-w-[2800px] min-h-[1800px]">
                  {graphData.nodes.map(sourceNode => {
                    const srcPos = sourceNode.position || { x: 50, y: 50 };
                    const targets: { targetId: string; label?: string }[] = [];

                    if (sourceNode.autoTransition?.targetNodeId) {
                      targets.push({ targetId: sourceNode.autoTransition.targetNodeId, label: 'auto' });
                    }
                    sourceNode.routes?.forEach(r => {
                      if (r.targetNodeId) targets.push({ targetId: r.targetNodeId, label: 'route' });
                    });
                    sourceNode.options?.forEach(opt => {
                      if (opt.transition?.targetNodeId) {
                        targets.push({ targetId: opt.transition.targetNodeId, label: opt.id });
                      }
                    });

                    return targets.map((tgt, i) => {
                      const targetNode = graphData.nodes.find(n => n.id === tgt.targetId);
                      if (!targetNode) return null;
                      const tgtPos = targetNode.position || { x: 100, y: 100 };

                      const x1 = srcPos.x + 168;
                      const y1 = srcPos.y + 32;
                      const x2 = tgtPos.x;
                      const y2 = tgtPos.y + 32;

                      const dx = x2 - x1;
                      const dy = y2 - y1;
                      const cx1 = x1 + Math.max(30, dx / 2);
                      const cy1 = y1;
                      const cx2 = x2 - Math.max(30, dx / 2);
                      const cy2 = y2;

                      return (
                        <g key={`${sourceNode.id}-${tgt.targetId}-${i}`}>
                          <path
                            d={`M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`}
                            fill="none"
                            stroke={sourceNode.id === selectedNodeId ? '#f59e0b' : '#475569'}
                            strokeWidth={sourceNode.id === selectedNodeId ? 2.5 : 1.5}
                            strokeDasharray={tgt.label === 'auto' ? '4,4' : 'none'}
                          />
                        </g>
                      );
                    });
                  })}
                </svg>

                {/* Node Cards */}
                {graphData.nodes.map(node => {
                  const isSelected = node.id === selectedNodeId;
                  const isDragging = node.id === draggingNodeId;
                  const isStart = node.id === graphData.startNodeId;
                  const pos = node.position || { x: 50, y: 50 };

                  return (
                    <div
                      key={node.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedNodeId(node.id);
                      }}
                      onPointerDown={(e) => handleNodePointerDown(node, e)}
                      className={`causal-node-card absolute w-[168px] rounded-xl p-2.5 border transition-all ${
                        isDragging ? 'cursor-grabbing z-30 scale-[1.02] bg-slate-900 border-amber-400 ring-4 ring-amber-400/40 shadow-2xl' : 'cursor-grab z-10'
                      } ${
                        isSelected && !isDragging
                          ? 'bg-slate-900 border-amber-500 ring-2 ring-amber-500/30 shadow-xl z-20' 
                          : !isDragging ? 'bg-slate-900/95 border-slate-800 hover:border-slate-700 shadow-lg' : ''
                      }`}
                      style={{ left: pos.x, top: pos.y }}
                    >
                      <div className="flex items-center justify-between pb-1.5 border-b border-slate-800 mb-1.5 cursor-grab active:cursor-grabbing">
                        <div className="flex items-center gap-1 min-w-0">
                          <GripVertical className="h-3 w-3 text-slate-500 shrink-0" />
                          {isStart && (
                            <span className="bg-emerald-500 text-slate-950 font-extrabold text-[8px] px-1 py-0.2 rounded shrink-0">
                              START
                            </span>
                          )}
                          <span className="font-mono font-bold text-amber-400 text-[11px] truncate">
                            {node.id}
                          </span>
                        </div>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 bg-slate-800 px-1.5 py-0.2 rounded shrink-0">
                          {node.nodeType}
                        </span>
                      </div>

                      <h4 className="font-bold text-slate-100 text-[11px] truncate leading-tight">{node.title}</h4>
                      <p className="text-[10px] text-slate-400 line-clamp-2 mt-1 leading-tight">
                        {node.text}
                      </p>

                      {node.options && node.options.length > 0 && (
                        <div className="mt-2 pt-1.5 border-t border-slate-800/80 flex flex-col gap-1">
                          {node.options.map(opt => (
                            <div 
                              key={opt.id} 
                              className="text-[9px] font-medium text-slate-300 bg-slate-800/60 p-1 rounded-md flex items-center justify-between gap-0.5 truncate"
                            >
                              <span className="truncate">{opt.text}</span>
                              <span className="font-mono text-amber-400 font-bold shrink-0 text-[8.5px]">
                                → {opt.transition?.targetNodeId || opt.transition?.endingId || opt.transition?.type}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Node Inspector / Editor */}
          <div className="xl:col-span-5 flex flex-col gap-4">
            {selectedNode ? (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 flex flex-col gap-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="bg-amber-100 text-amber-800 font-mono font-bold text-xs px-2 py-0.5 rounded-lg">
                      {selectedNode.id}
                    </span>
                    <h3 className="font-bold text-slate-900 text-sm">Редагування вузла</h3>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDuplicateNode(selectedNode.id)}
                      className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
                      title="Дублювати вузол"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteNode(selectedNode.id)}
                      className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition"
                      title="Видалити вузол"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Node ID Rename */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-slate-700">ID вузла (унікальний)</label>
                    <input
                      type="text"
                      value={selectedNode.id}
                      onChange={e => handleRenameNodeId(selectedNode.id, e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-slate-700">Тип вузла (nodeType)</label>
                    <select
                      value={selectedNode.nodeType}
                      onChange={e => {
                        handleNodeTypeChange(selectedNode.id, e.target.value as CausalNodeType);
                      }}
                      className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      {allowedCausalNodeTypes(graphData.mode).map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Title, Text, Prompt */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-700 flex justify-between">
                    <span>Назва (title)</span>
                    <span className="text-[10px] text-slate-400 font-mono">{selectedNode.title.length}/80</span>
                  </label>
                  <input
                    type="text"
                    maxLength={80}
                    value={selectedNode.title}
                    onChange={e => {
                      const val = e.target.value;
                      setGraphData(prev => ({
                        ...prev,
                        nodes: prev.nodes.map(n => n.id === selectedNode.id ? { ...n, title: val } : n)
                      }));
                    }}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-700 flex justify-between">
                    <span>Основний опис (text)</span>
                    <span className="text-[10px] text-slate-400 font-mono">{selectedNode.text.length}/500</span>
                  </label>
                  <textarea
                    maxLength={500}
                    rows={3}
                    value={selectedNode.text}
                    onChange={e => {
                      const val = e.target.value;
                      setGraphData(prev => ({
                        ...prev,
                        nodes: prev.nodes.map(n => n.id === selectedNode.id ? { ...n, text: val } : n)
                      }));
                    }}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                {/* Options editor for every interactive node. */}
                {!isTechnicalCausalNodeType(selectedNode.nodeType) && (
                  <div className="flex flex-col gap-3 pt-3 border-t border-slate-100">
                    <h4 className="font-bold text-xs text-slate-900 flex items-center justify-between">
                      <span>Варіанти дій (рівно 2 за специфікацією)</span>
                      <span className="text-[10px] text-amber-600 font-mono font-bold">
                        {selectedNode.options?.length || 0}/2
                      </span>
                    </h4>

                    {selectedNode.options?.map((opt, optIdx) => (
                      <div key={opt.id} className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col gap-2.5">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                          <span className="font-mono text-xs font-bold text-amber-700">
                            Варіант {optIdx + 1} ({opt.id})
                          </span>
                          <span className="text-[10px] font-bold uppercase text-slate-400">
                            {opt.transitionRole || 'PRIMARY'}
                          </span>
                        </div>

                        <input
                          type="text"
                          maxLength={240}
                          value={opt.text}
                          onChange={e => {
                            const val = e.target.value;
                            setGraphData(prev => ({
                              ...prev,
                              nodes: prev.nodes.map(n => {
                                if (n.id !== selectedNode.id) return n;
                                const opts = [...(n.options || [])];
                                opts[optIdx] = { ...opts[optIdx], text: val };
                                return { ...n, options: opts };
                              })
                            }));
                          }}
                          placeholder="Текст варіанта відповідей (до 240 символів)..."
                          className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />

                        {/* Validity & Transition Target */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-bold text-slate-600">Наукова валидність</label>
                            <select
                              value={opt.scientificValidity}
                              onChange={e => {
                                const val = e.target.value as ScientificValidity;
                                setGraphData(prev => ({
                                  ...prev,
                                  nodes: prev.nodes.map(n => {
                                    if (n.id !== selectedNode.id) return n;
                                    const opts = [...(n.options || [])];
                                    opts[optIdx] = { ...opts[optIdx], scientificValidity: val };
                                    return { ...n, options: opts };
                                  })
                                }));
                              }}
                              className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-800"
                            >
                              <option value="SUPPORTED">SUPPORTED</option>
                              <option value="PARTIALLY_SUPPORTED">PARTIALLY_SUPPORTED</option>
                              <option value="UNDETERMINED">UNDETERMINED</option>
                              <option value="CONTRADICTED">CONTRADICTED</option>
                            </select>
                          </div>

                          <div>
                            <label className="text-[10px] font-bold text-slate-600">Перехід (transition)</label>
                            <select
                              value={opt.transition?.type || 'GO_TO_NODE'}
                              onChange={e => {
                                const val = e.target.value as TransitionType;
                                setGraphData(prev => ({
                                  ...prev,
                                  nodes: prev.nodes.map(n => {
                                    if (n.id !== selectedNode.id) return n;
                                    const opts = [...(n.options || [])];
                                    opts[optIdx] = { 
                                      ...opts[optIdx], 
                                      transition: { 
                                        type: val, 
                                        targetNodeId: graphData.nodes[0]?.id,
                                        endingId: graphData.endings[0]?.id 
                                      } 
                                    };
                                    return { ...n, options: opts };
                                  })
                                }));
                              }}
                              className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-800"
                            >
                              <option value="GO_TO_NODE">GO_TO_NODE</option>
                              <option value="GO_TO_RESULT_GATE">GO_TO_RESULT_GATE</option>
                              <option value="FINISH">FINISH</option>
                              <option value="RETRY_CURRENT_NODE">RETRY_CURRENT_NODE</option>
                            </select>
                          </div>
                        </div>

                        {/* Target Node or Ending picker */}
                        {(opt.transition?.type === 'GO_TO_NODE' || opt.transition?.type === 'GO_TO_RESULT_GATE') && (
                          <div>
                            <label className="text-[10px] font-bold text-slate-600">Цільовий вузол (targetNodeId)</label>
                            <select
                              value={opt.transition.targetNodeId || ''}
                              onChange={e => {
                                const val = e.target.value;
                                setGraphData(prev => ({
                                  ...prev,
                                  nodes: prev.nodes.map(n => {
                                    if (n.id !== selectedNode.id) return n;
                                    const opts = [...(n.options || [])];
                                    opts[optIdx] = { 
                                      ...opts[optIdx], 
                                      transition: { ...opts[optIdx].transition, targetNodeId: val } 
                                    };
                                    return { ...n, options: opts };
                                  })
                                }));
                              }}
                              className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-mono font-bold text-slate-800"
                            >
                              {graphData.nodes.map(n => (
                                <option key={n.id} value={n.id}>{n.id} - {n.title}</option>
                              ))}
                            </select>
                          </div>
                        )}

                        {opt.transition?.type === 'FINISH' && (
                          <div>
                            <label className="text-[10px] font-bold text-slate-600">Фінальне завершення (endingId)</label>
                            <select
                              value={opt.transition.endingId || ''}
                              onChange={e => {
                                const val = e.target.value;
                                setGraphData(prev => ({
                                  ...prev,
                                  nodes: prev.nodes.map(n => {
                                    if (n.id !== selectedNode.id) return n;
                                    const opts = [...(n.options || [])];
                                    opts[optIdx] = { 
                                      ...opts[optIdx], 
                                      transition: { ...opts[optIdx].transition, endingId: val } 
                                    };
                                    return { ...n, options: opts };
                                  })
                                }));
                              }}
                              className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-mono font-bold text-slate-800"
                            >
                              {graphData.endings.map(e => (
                                <option key={e.id} value={e.id}>{e.id} - {e.title}</option>
                              ))}
                            </select>
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-[1fr_150px] gap-2">
                          <div>
                            <label className="text-[10px] font-bold text-slate-600">Зворотний зв’язок</label>
                            <input
                              type="text"
                              value={opt.feedback.text}
                              onChange={e => {
                                const text = e.target.value;
                                setGraphData(prev => ({
                                  ...prev,
                                  nodes: prev.nodes.map(node => {
                                    if (node.id !== selectedNode.id) return node;
                                    const options = [...node.options];
                                    options[optIdx] = {
                                      ...options[optIdx],
                                      feedback: { ...options[optIdx].feedback, text }
                                    };
                                    return { ...node, options };
                                  })
                                }));
                              }}
                              placeholder="Коротке пояснення після вибору…"
                              className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-600">Коли показати</label>
                            <select
                              value={opt.feedback.timing}
                              onChange={e => {
                                const timing = e.target.value as CausalGraphQuestion['settings']['feedbackTiming'];
                                setGraphData(prev => ({
                                  ...prev,
                                  nodes: prev.nodes.map(node => {
                                    if (node.id !== selectedNode.id) return node;
                                    const options = [...node.options];
                                    options[optIdx] = {
                                      ...options[optIdx],
                                      feedback: { ...options[optIdx].feedback, timing }
                                    };
                                    return { ...node, options };
                                  })
                                }));
                              }}
                              className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] font-bold text-slate-800"
                            >
                              <option value="IMMEDIATE">IMMEDIATE</option>
                              <option value="AT_CHECKPOINT">AT_CHECKPOINT</option>
                              <option value="AT_END">AT_END</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 text-center text-slate-500 text-xs">
                Оберіть вузол на полотні для редагування його властивостей.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: VARIABLES & SCORE DIMENSIONS */}
      {activeTab === 'variables' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* State Variables Manager */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Змінні стану (stateVariables)</h3>
              <button
                onClick={() => {
                  const newVar: StateVariable = {
                    id: `var_${graphData.stateVariables.length + 1}`,
                    valueType: 'BOOLEAN',
                    defaultValue: false
                  };
                  setGraphData(prev => ({ ...prev, stateVariables: [...prev.stateVariables, newVar] }));
                }}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-3 py-1 rounded-lg text-xs flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" /> Додати змінну
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {graphData.stateVariables.map((v, idx) => (
                <div key={v.id || idx} className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="text"
                      value={v.id}
                      onChange={e => {
                        const val = e.target.value;
                        setGraphData(prev => ({
                          ...prev,
                          stateVariables: prev.stateVariables.map((item, i) => i === idx ? { ...item, id: val } : item)
                        }));
                      }}
                      className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-mono font-bold text-slate-900"
                    />
                    <button
                      onClick={() => {
                        setGraphData(prev => ({
                          ...prev,
                          stateVariables: prev.stateVariables.filter((_, i) => i !== idx)
                        }));
                      }}
                      className="text-red-500 hover:text-red-700 p-1"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={v.valueType}
                      onChange={e => {
                        const vt = e.target.value as VariableValueType;
                        let defaultVal: any = false;
                        if (vt === 'INTEGER') defaultVal = 0;
                        if (vt === 'STRING') defaultVal = '';
                        if (vt === 'STRING_SET') defaultVal = [];

                        setGraphData(prev => ({
                          ...prev,
                          stateVariables: prev.stateVariables.map((item, i) => i === idx ? { ...item, valueType: vt, defaultValue: defaultVal } : item)
                        }));
                      }}
                      className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800"
                    >
                      <option value="BOOLEAN">BOOLEAN</option>
                      <option value="INTEGER">INTEGER</option>
                      <option value="STRING">STRING</option>
                      <option value="STRING_SET">STRING_SET</option>
                    </select>

                    <span className="text-xs text-slate-500 font-mono flex items-center">
                      Def: {JSON.stringify(v.defaultValue)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Score Dimensions Manager */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Шкали оцінювання (scoreDimensions)</h3>
              <button
                onClick={() => {
                  const newScore: ScoreDimension = {
                    id: `score_${graphData.scoreDimensions.length + 1}`,
                    title: 'Нова шкала',
                    maxScore: 20,
                    weight: 1.0
                  };
                  setGraphData(prev => ({ ...prev, scoreDimensions: [...prev.scoreDimensions, newScore] }));
                }}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-3 py-1 rounded-lg text-xs flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" /> Додати шкалу
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {graphData.scoreDimensions.map((s, idx) => (
                <div key={s.id || idx} className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="text"
                      value={s.id}
                      onChange={e => {
                        const val = e.target.value;
                        setGraphData(prev => ({
                          ...prev,
                          scoreDimensions: prev.scoreDimensions.map((item, i) => i === idx ? { ...item, id: val } : item)
                        }));
                      }}
                      className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-mono font-bold text-slate-900"
                    />
                    <button
                      onClick={() => {
                        setGraphData(prev => ({
                          ...prev,
                          scoreDimensions: prev.scoreDimensions.filter((_, i) => i !== idx)
                        }));
                      }}
                      className="text-red-500 hover:text-red-700 p-1"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <input
                    type="text"
                    value={s.title}
                    onChange={e => {
                      const val = e.target.value;
                      setGraphData(prev => ({
                        ...prev,
                        scoreDimensions: prev.scoreDimensions.map((item, i) => i === idx ? { ...item, title: val } : item)
                      }));
                    }}
                    placeholder="Назва шкали..."
                    className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-900"
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-500">Max Score (&gt;0)</label>
                      <input
                        type="number"
                        value={s.maxScore}
                        onChange={e => {
                          const val = parseInt(e.target.value) || 10;
                          setGraphData(prev => ({
                            ...prev,
                            scoreDimensions: prev.scoreDimensions.map((item, i) => i === idx ? { ...item, maxScore: val } : item)
                          }));
                        }}
                        className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-900 w-full"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500">Weight (&gt;=0)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={s.weight}
                        onChange={e => {
                          const val = parseFloat(e.target.value) || 1.0;
                          setGraphData(prev => ({
                            ...prev,
                            scoreDimensions: prev.scoreDimensions.map((item, i) => i === idx ? { ...item, weight: val } : item)
                          }));
                        }}
                        className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-900 w-full"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ENDINGS MANAGER */}
      {activeTab === 'endings' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="font-bold text-slate-900 text-sm">Фінальні результати / Завершення (endings)</h3>
            <button
              onClick={() => {
                const newEnd: GraphEnding = {
                  id: `END_${graphData.endings.length + 1}`,
                  title: 'Новий результат',
                  summary: 'Короткий підсумок...',
                  explanation: 'Пояснення наукових висновків...',
                  resultTags: ['Результат']
                };
                setGraphData(prev => ({ ...prev, endings: [...prev.endings, newEnd] }));
              }}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1"
            >
              <Plus className="h-3.5 w-3.5" /> Додати результат
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {graphData.endings.map((endItem, idx) => (
              <div key={endItem.id || idx} className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col gap-2.5">
                <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-2">
                  <input
                    type="text"
                    value={endItem.id}
                    onChange={e => {
                      const val = e.target.value;
                      setGraphData(prev => ({
                        ...prev,
                        endings: prev.endings.map((item, i) => i === idx ? { ...item, id: val } : item)
                      }));
                    }}
                    className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-mono font-bold text-slate-900"
                  />
                  <button
                    onClick={() => {
                      setGraphData(prev => ({
                        ...prev,
                        endings: prev.endings.filter((_, i) => i !== idx)
                      }));
                    }}
                    className="text-red-500 hover:text-red-700 p-1"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <input
                  type="text"
                  value={endItem.title}
                  onChange={e => {
                    const val = e.target.value;
                    setGraphData(prev => ({
                      ...prev,
                      endings: prev.endings.map((item, i) => i === idx ? { ...item, title: val } : item)
                    }));
                  }}
                  placeholder="Заголовок завершення..."
                  className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-900"
                />

                <textarea
                  rows={2}
                  value={endItem.summary}
                  onChange={e => {
                    const val = e.target.value;
                    setGraphData(prev => ({
                      ...prev,
                      endings: prev.endings.map((item, i) => i === idx ? { ...item, summary: val } : item)
                    }));
                  }}
                  placeholder="Підсумок результату..."
                  className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-800"
                />

                <textarea
                  rows={2}
                  value={endItem.explanation}
                  onChange={e => {
                    const val = e.target.value;
                    setGraphData(prev => ({
                      ...prev,
                      endings: prev.endings.map((item, i) => i === idx ? { ...item, explanation: val } : item)
                    }));
                  }}
                  placeholder="Пояснення..."
                  className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-800"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: SOURCES MANAGER */}
      {activeTab === 'sources' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="font-bold text-slate-900 text-sm">Наукові джерела (sources)</h3>
            <button
              onClick={() => {
                const newSrc: ScientificSource = {
                  id: `SRC_${graphData.sources.length + 1}`,
                  sourceType: 'PAPER',
                  title: 'Нове наукове джерело',
                  authors: ['Автор'],
                  year: 2024,
                  publisher: 'Видавництво',
                  url: '',
                  doi: ''
                };
                setGraphData(prev => ({ ...prev, sources: [...prev.sources, newSrc] }));
              }}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1"
            >
              <Plus className="h-3.5 w-3.5" /> Додати джерело
            </button>
          </div>

          <div className="flex flex-col gap-3">
            {graphData.sources.map((src, idx) => (
              <div key={src.id || idx} className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={src.id}
                      onChange={e => {
                        const val = e.target.value;
                        setGraphData(prev => ({
                          ...prev,
                          sources: prev.sources.map((item, i) => i === idx ? { ...item, id: val } : item)
                        }));
                      }}
                      className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-mono font-bold text-slate-900"
                    />
                    <select
                      value={src.sourceType}
                      onChange={e => {
                        const st = e.target.value as SourceType;
                        setGraphData(prev => ({
                          ...prev,
                          sources: prev.sources.map((item, i) => i === idx ? { ...item, sourceType: st } : item)
                        }));
                      }}
                      className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800"
                    >
                      <option value="PAPER">PAPER</option>
                      <option value="BOOK">BOOK</option>
                      <option value="DATASET">DATASET</option>
                      <option value="ARTICLE">ARTICLE</option>
                      <option value="OTHER">OTHER</option>
                    </select>
                  </div>

                  <button
                    onClick={() => {
                      setGraphData(prev => ({
                        ...prev,
                        sources: prev.sources.filter((_, i) => i !== idx)
                      }));
                    }}
                    className="text-red-500 hover:text-red-700 p-1"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <input
                  type="text"
                  value={src.title}
                  onChange={e => {
                    const val = e.target.value;
                    setGraphData(prev => ({
                      ...prev,
                      sources: prev.sources.map((item, i) => i === idx ? { ...item, title: val } : item)
                    }));
                  }}
                  placeholder="Назва статті або книги..."
                  className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-900"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: LOCAL SIMULATOR */}
      {activeTab === 'simulator' && (
        <GraphSimulator graphData={graphData} />
      )}

      {/* TAB 6: VALIDATION AUDIT */}
      {activeTab === 'validation' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              {isValid ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <AlertTriangle className="h-5 w-5 text-red-500" />}
              <span>Результати перевірки структури графа ({validationErrors.length})</span>
            </h3>
          </div>

          {validationErrors.length === 0 ? (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
              <span>Граф відповідає всім вимогам специфікації CAUSAL_GRAPH! Збереження дозволено.</span>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {validationErrors.map((err, idx) => (
                <div 
                  key={idx} 
                  className={`p-3 rounded-xl border text-xs font-semibold flex items-start gap-2.5 ${
                    err.severity === 'ERROR' 
                      ? 'bg-red-50 border-red-200 text-red-800' 
                      : 'bg-amber-50 border-amber-200 text-amber-800'
                  }`}
                >
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <p>{err.message}</p>
                    {err.nodeId && (
                      <span className="font-mono text-[10px] underline cursor-pointer mt-1 inline-block" onClick={() => {
                        setSelectedNodeId(err.nodeId!);
                        setActiveTab('editor');
                      }}>
                        → Перейти до вузла {err.nodeId}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 7: JSON IMPORT / EXPORT */}
      {activeTab === 'json' && (
        <div className="flex flex-col gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-md">
            <div>
              <div className="flex items-center gap-2">
                <FileCode className="h-5 w-5 text-amber-400" />
                <h3 className="font-extrabold text-sm text-white">Управління JSON структурою CAUSAL_GRAPH</h3>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Пряме редагування, валідація, імпорт та експорт специфікації графу у форматі JSON.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer border border-slate-700">
                <Upload className="h-3.5 w-3.5 text-amber-400" />
                <span>Завантажити файл JSON</span>
                <input type="file" accept=".json,application/json" onChange={handleFileUpload} className="hidden" />
              </label>

              <button
                type="button"
                onClick={handleCopyJson}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer border border-slate-700"
              >
                <Copy className="h-3.5 w-3.5 text-sky-400" />
                <span>Скопіювати</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadJson}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer border border-slate-700"
              >
                <Download className="h-3.5 w-3.5 text-emerald-400" />
                <span>Експорт .json</span>
              </button>

              <button
                type="button"
                onClick={handleApplyJson}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer shadow-sm active:scale-95"
              >
                <Check className="h-4 w-4" />
                <span>Застосувати зміни</span>
              </button>

              <button
                type="button"
                onClick={handleSaveToFirestore}
                disabled={isSaving || !hasConstructorPermission}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer shadow-sm active:scale-95 disabled:bg-slate-700 disabled:text-slate-500"
                title={!hasConstructorPermission ? "Немає прав на запис у Firestore" : "Записати відразу у Firestore"}
              >
                {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4 text-emerald-200" />}
                <span>Записати в БД (Firestore)</span>
              </button>
            </div>
          </div>

          {jsonError && (
            <div className="bg-red-500/15 border border-red-500/40 text-red-200 p-4 rounded-2xl text-xs flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold text-red-300">Помилка валідації JSON:</strong>
                <p className="mt-0.5 font-mono text-[11px] leading-relaxed text-red-200">{jsonError}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Main Code Editor Area */}
            <div className="lg:col-span-8 flex flex-col gap-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                  <Code className="h-4 w-4 text-amber-500" /> JSON Редактор
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {jsonText.length} символів
                </span>
              </div>
              <textarea
                value={jsonText}
                onChange={e => {
                  setJsonText(e.target.value);
                  setJsonError(null);
                }}
                rows={22}
                className="w-full bg-slate-950 text-emerald-400 font-mono text-xs p-4 rounded-2xl border border-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 leading-relaxed scrollbar-thin"
                placeholder="Вставте або відредагуйте JSON специфікацію..."
                spellCheck={false}
              />
            </div>

            {/* Right Side: Quick Inspector & Actions */}
            <div className="lg:col-span-4 flex flex-col gap-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col gap-3">
                <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider pb-2 border-b border-slate-100 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-500" /> Статистика Графа
                </h4>
                <div className="flex flex-col gap-2 text-xs font-mono">
                  <div className="flex justify-between p-2 bg-slate-50 rounded-xl">
                    <span className="text-slate-500">Тип документа:</span>
                    <span className="font-bold text-amber-600">{graphData.type}</span>
                  </div>
                  <div className="flex justify-between p-2 bg-slate-50 rounded-xl">
                    <span className="text-slate-500">Початковий вузол:</span>
                    <span className="font-bold text-indigo-600">{graphData.startNodeId}</span>
                  </div>
                  <div className="flex justify-between p-2 bg-slate-50 rounded-xl">
                    <span className="text-slate-500">Кількість вузлів:</span>
                    <span className="font-bold text-slate-800">{graphData.nodes?.length || 0}</span>
                  </div>
                  <div className="flex justify-between p-2 bg-slate-50 rounded-xl">
                    <span className="text-slate-500">Змінні стану:</span>
                    <span className="font-bold text-slate-800">{graphData.stateVariables?.length || 0}</span>
                  </div>
                  <div className="flex justify-between p-2 bg-slate-50 rounded-xl">
                    <span className="text-slate-500">Завершення:</span>
                    <span className="font-bold text-slate-800">{graphData.endings?.length || 0}</span>
                  </div>
                  <div className="flex justify-between p-2 bg-slate-50 rounded-xl">
                    <span className="text-slate-500">Джерела:</span>
                    <span className="font-bold text-slate-800">{graphData.sources?.length || 0}</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-white flex flex-col gap-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-amber-400">
                  Інструкція з імпорту JSON
                </h4>
                <p className="text-[11.5px] text-slate-300 leading-relaxed">
                  Ви можете імпортувати повну специфікацію причинно-наслідкового графа. Переконайтесь, що кожен <code>transition.targetNodeId</code> посилається на існуючий ідентифікатор у масиві <code>nodes</code>.
                </p>
                <div className="pt-2 border-t border-slate-800 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setGraphData(createSampleGraph());
                      triggerToast('Завантажено стандартний демо-шаблон!', 'info');
                    }}
                    className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs py-2 px-3 rounded-xl transition cursor-pointer flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="h-3.5 w-3.5 text-amber-400" />
                    <span>Скинути до стандартного шаблону</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


